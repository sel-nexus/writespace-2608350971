/** Exercise real admin login, persisted account operations and cross-author writing; fixture fails on console/page errors. */
import { test, expect } from "./fixtures.js";

/** Follow a responsive authenticated navigation link.
 * Args:
 *   page: Error-capturing fixture page.
 *   name: Exact navbar link label.
 */
async function navigate(page, name) {
  const toggle = page.getByRole("button", { name: "Open menu" });
  if (await toggle.isVisible()) await toggle.click();
  await page
    .getByRole("navigation", { name: "Authenticated navigation" })
    .getByRole("link", { name, exact: true })
    .click();
}
/** Sign in via the actual builtin credential form after initial entry.
 * Args:
 *   page: Fixture page initially at login.
 */
async function loginAdmin(page) {
  await page.getByLabel("Username", { exact: true }).fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("admin");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();
}
/** Create one account using native required fields and role selector.
 * Args:
 *   page: Current user-management page.
 *   username: Unique demo credential.
 *   role: Admin or contributor role value.
 */
async function create(page, username, role) {
  await page.getByLabel("Display Name").fill(username + " Name");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("demo-only");
  await page.getByLabel("Role", { exact: true }).selectOption(role);
  await page.getByRole("button", { name: "Create User", exact: true }).click();
  await expect(page.getByText("Created account for " + username + " Name.")).toBeVisible();
}
/** Locate the one visible desktop-row/mobile-card Delete control.
 * Args:
 *   page: Responsive users screen.
 *   username: Account record to inspect.
 * Returns:
 *   Visible native delete button.
 */
function deletion(page, username) {
  return page
    .locator("button:visible")
    .filter({ hasText: "Delete" })
    .and(page.getByRole("button", { name: "Delete " + username, exact: true }));
}
/** Assert actual dashboard counters with named statistic groups.
 * Args:
 *   page: Dashboard page.
 *   counts: Expected posts, all accounts, admins and contributors.
 */
async function counts(page, counts) {
  for (const [index, label] of [
    "Total Posts",
    "Total Users",
    "Total Admins",
    "Total contributors",
  ].entries()) {
    await expect(page.getByRole("group", { name: label }).locator("p").last()).toHaveText(
      String(counts[index]),
    );
  }
}

test("builtin login -> create contributor/admin -> reload -> cancel/accept deletion -> real counters and retained author writing", async ({
  page,
}, testInfo) => {
  await page.goto("/login");
  await loginAdmin(page);
  await counts(page, [0, 1, 1, 0]);
  await expect(page.getByText(/No posts yet. Write your first post/)).toBeVisible();
  await page.getByRole("link", { name: "Manage Users", exact: true }).click();
  await expect(deletion(page, "admin")).toBeDisabled();
  await expect(deletion(page, "admin")).toHaveAttribute(
    "title",
    "Default admin cannot be deleted.",
  );
  await page.getByRole("button", { name: "Create User", exact: true }).click();
  await expect(page.getByText("Display Name is required.")).toBeVisible();
  await expect(page.getByText("Choose Admin or user.")).toBeVisible();
  await create(page, "contributor", "user");
  await create(page, "editor", "admin");
  const users = await page.evaluate(() => JSON.parse(localStorage.getItem("writespace_users")));
  expect(users.map((user) => user.role)).toEqual(["user", "admin"]);
  for (const account of users) {
    expect(account.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(Number.isFinite(Date.parse(account.createdAt))).toBe(true);
    expect(account.password).toBe("demo-only");
  }
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("writespace_session")).userId),
  ).toBe("admin");
  await page.reload();
  await expect(deletion(page, "contributor")).toBeEnabled();
  // Seed only the real other-author prerequisite; do not replace services or storage methods.
  const retained = {
    id: "retained-author-post",
    title: "Contributor keeps their byline",
    content: "Retained words",
    authorId: users[0].id,
    authorName: users[0].displayName,
    createdAt: users[0].createdAt,
  };
  await page.evaluate(
    (post) => localStorage.setItem("writespace_posts", JSON.stringify([post])),
    retained,
  );
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toContain("posts and author name will be retained");
    await dialog.dismiss();
  });
  await deletion(page, "contributor").click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("writespace_users")))).toEqual(
    users,
  );
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    await dialog.accept();
  });
  await deletion(page, "contributor").click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("writespace_users")))).toEqual([
    users[1],
  ]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("writespace_posts")))).toEqual([
    retained,
  ]);
  await page.getByRole("link", { name: "Back to Dashboard" }).click();
  await counts(page, [1, 2, 2, 0]);
  await page.getByRole("link", { name: retained.title, exact: true }).click();
  await expect(page.locator("article")).toContainText(users[0].displayName);
  await expect(page.getByRole("heading", { name: retained.title })).toBeVisible();
  await navigate(page, "Users");
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    await dialog.accept();
  });
  await deletion(page, "editor").click();
  await page.getByRole("link", { name: "Back to Dashboard" }).click();
  await counts(page, [1, 1, 1, 0]);
  await page.reload();
  await counts(page, [1, 1, 1, 0]);
  await page.screenshot({ path: testInfo.outputPath("admin-overview.png"), fullPage: true });
});

test("created admin can log in but cannot delete its current account", async ({ page }) => {
  await page.goto("/login");
  await loginAdmin(page);
  await page.getByRole("link", { name: "Manage Users", exact: true }).click();
  await create(page, "editor", "admin");
  await page.getByRole("button", { name: "Admin account", exact: true }).click();
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  const publicToggle = page.getByRole("button", { name: "Open menu" });
  if (await publicToggle.isVisible()) await publicToggle.click();
  await page
    .getByRole("navigation", { name: "Public navigation" })
    .getByRole("link", { name: "Login", exact: true })
    .click();
  await page.getByLabel("Username", { exact: true }).fill("editor");
  await page.getByLabel("Password", { exact: true }).fill("demo-only");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.getByRole("link", { name: "Manage Users", exact: true }).click();
  await expect(deletion(page, "editor")).toBeDisabled();
  await expect(deletion(page, "editor")).toHaveAttribute(
    "title",
    "You cannot delete your current account.",
  );
  await expect(deletion(page, "admin")).toBeDisabled();
  await page.reload();
  await expect(deletion(page, "editor")).toBeDisabled();
});

test("admin writes via quick action and edits/deletes another author through real dashboard links", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("admin_other_ready")) return;
    localStorage.setItem(
      "writespace_users",
      JSON.stringify([
        {
          id: "other",
          username: "other",
          displayName: "Other Author",
          password: "demo-only",
          role: "user",
          createdAt: "2026-03-04T12:00:00.000Z",
        },
      ]),
    );
    localStorage.setItem(
      "writespace_posts",
      JSON.stringify([
        {
          id: "other-post",
          title: "Other author original",
          content: "Original words",
          authorId: "other",
          authorName: "Other Author",
          createdAt: "2026-03-04T12:00:00.000Z",
        },
      ]),
    );
    localStorage.setItem("admin_other_ready", "yes");
  });
  await page.goto("/login");
  await loginAdmin(page);
  await page.getByRole("link", { name: "Write New Post" }).click();
  await page.getByLabel("Title").fill("Admin new post");
  await page.getByLabel("Content").fill("Admin published words");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Admin new post" })).toBeVisible();
  const written = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("writespace_posts")).find((post) => post.authorId === "admin"),
  );
  expect(written.authorName).toBe("Admin");
  await navigate(page, "Users");
  await page.getByRole("link", { name: "Back to Dashboard" }).click();
  await counts(page, [2, 2, 1, 1]);
  await page.getByRole("link", { name: "Edit Other author original" }).click();
  await expect(page.getByLabel("Title")).toHaveValue("Other author original");
  await page.getByLabel("Title").fill("Other author revised by Admin");
  await page.getByLabel("Content").fill("Admin correction");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Other author revised by Admin" })).toBeVisible();
  const updated = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("writespace_posts")).find((post) => post.id === "other-post"),
  );
  expect(updated).toEqual({
    id: "other-post",
    title: "Other author revised by Admin",
    content: "Admin correction",
    authorId: "other",
    authorName: "Other Author",
    createdAt: "2026-03-04T12:00:00.000Z",
  });
  await navigate(page, "Users");
  await page.getByRole("link", { name: "Back to Dashboard" }).click();
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "Delete Other author revised by Admin" }).click();
  await counts(page, [2, 2, 1, 1]);
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Delete Other author revised by Admin" }).click();
  await counts(page, [1, 2, 1, 1]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("writespace_posts")))).toEqual([
    written,
  ]);
  await page.reload();
  await counts(page, [1, 2, 1, 1]);
});

for (const path of ["/admin", "/users"]) {
  test("guest initial admin entry " + path + " redirects to login", async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toHaveCount(0);
  });
  test("wrong-role initial entry " + path + " redirects to blogs", async ({ page }) => {
    await page.addInitScript(() => {
      const user = {
        id: "reader",
        username: "reader",
        displayName: "Reader",
        role: "user",
        password: "demo",
        createdAt: "2026-03-04T12:00:00.000Z",
      };
      localStorage.setItem("writespace_users", JSON.stringify([user]));
      localStorage.setItem(
        "writespace_session",
        JSON.stringify({
          userId: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
        }),
      );
    });
    await page.goto(path);
    await expect(page).toHaveURL(/\/blogs$/);
    await expect(page.getByRole("heading", { name: "All Blogs" })).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
  });
}

/** Exercise real registration and writing without mocking storage or application services. */
import { test, expect } from "./fixtures.js";

/** Open a responsive navbar link through its real disclosure when necessary.
 * Args:
 *   page: Fixture page capturing browser errors.
 *   name: Exact authenticated navigation label.
 */
async function navigate(page, name) {
  const toggle = page.getByRole("button", { name: "Open menu" });
  if (await toggle.isVisible()) await toggle.click();
  await page
    .getByRole("navigation", { name: "Authenticated navigation" })
    .getByRole("link", { name, exact: true })
    .click();
}

/** Register through the actual UI after initial app entry.
 * Args:
 *   page: Fixture page capturing browser errors.
 */
async function registerWriter(page) {
  await page.getByRole("link", { name: "Get Started Free" }).first().click();
  await page.getByLabel("Display Name").fill("Writing Author");
  await page.getByLabel("Username", { exact: true }).fill("writer");
  await page.getByLabel("Password", { exact: true }).fill("demo-only");
  await page.getByLabel("Confirm Password").fill("demo-only");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
}

test("register -> write -> read -> edit -> read -> cancel/confirm delete -> list persists across reload", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await registerWriter(page);
  await page
    .getByRole("main")
    .getByRole("link", { name: "Write", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Write a Post" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Title is required.")).toBeVisible();
  await expect(page.getByText("Content is required.")).toBeVisible();
  await page.getByLabel("Title").fill("First published words");
  const content =
    'First line\n\n<script>window.writingUnsafe = true</script>\n<img src=x onerror="window.writingUnsafe = true">\nFinal line';
  await page.getByLabel("Content").fill(content);
  await expect(page.getByText(content.length + " characters")).toBeVisible();
  expect(
    await page
      .getByLabel("Content")
      .evaluate((element) => parseFloat(getComputedStyle(element).minHeight)),
  ).toBeGreaterThanOrEqual(256);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "First published words" }),
  ).toBeVisible();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("writespace_posts"))[0],
  );
  const identity = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("writespace_session")),
  );
  expect(saved).toEqual({
    id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    title: "First published words",
    content,
    createdAt: expect.any(String),
    authorId: identity.userId,
    authorName: "Writing Author",
  });
  expect(Number.isFinite(Date.parse(saved.createdAt))).toBe(true);
  await expect(page).toHaveURL(new RegExp("/blog/" + saved.id + "$"));
  expect(await page.locator("article .whitespace-pre-wrap").textContent()).toBe(
    content,
  );
  await expect(page.locator("article script, article img")).toHaveCount(0);
  expect(await page.evaluate(() => window.writingUnsafe)).toBeUndefined();
  await page.reload();
  await expect(page.getByRole("heading", { name: saved.title })).toBeVisible();
  expect(await page.locator("article .whitespace-pre-wrap").textContent()).toBe(
    content,
  );
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Title")).toHaveValue(saved.title);
  await expect(page.getByLabel("Content")).toHaveValue(content);
  await page.getByLabel("Title").fill("Unsaved revision");
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: saved.title })).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("writespace_posts"))[0],
    ),
  ).toEqual(saved);
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByLabel("Title").fill("Revised published words");
  await page.getByLabel("Content").fill(content + "\nRevision");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const updated = {
    ...saved,
    title: "Revised published words",
    content: content + "\nRevision",
  };
  await expect(
    page.getByRole("heading", { name: updated.title }),
  ).toBeVisible();
  expect(await page.locator("article .whitespace-pre-wrap").textContent()).toBe(
    updated.content,
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("writespace_posts"))[0],
    ),
  ).toEqual(updated);
  await page.reload();
  await expect
    .poll(() => page.locator("article .whitespace-pre-wrap").textContent())
    .toBe(updated.content);
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: updated.title }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("writespace_posts")),
    ),
  ).toEqual([updated]);
  await page.screenshot({
    path: testInfo.outputPath("writing-reader.png"),
    fullPage: true,
  });
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(
    page.getByText("No blogs yet. Be the first to write one!"),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("writespace_posts")),
    ),
  ).toEqual([]);
  await page.reload();
  await expect(
    page.getByText("No blogs yet. Be the first to write one!"),
  ).toBeVisible();
});

test("navbar Write and create Cancel do not publish a draft", async ({
  page,
}) => {
  await page.goto("/");
  await registerWriter(page);
  await navigate(page, "Write");
  await page.getByLabel("Title").fill("Discarded draft");
  await page.getByLabel("Content").fill("Not published");
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("writespace_posts")) ?? [],
    ),
  ).toEqual([]);
});

const identity = {
  userId: "reader",
  username: "reader",
  displayName: "Reader",
  role: "user",
};
const otherPost = {
  id: "someone-else",
  title: "<b>Other author</b>",
  content: "<script>window.deepUnsafe = true</script>\nOther writing",
  createdAt: "2026-03-04T12:00:00.000Z",
  authorId: "other",
  authorName: "Other Author",
};

/** Seed actual local records only for independent deep-entry authorization scenarios.
 * Args:
 *   page: Fixture page capturing browser errors before navigation.
 */
async function seedOtherPost(page) {
  await page.addInitScript(
    ({ identity, otherPost }) => {
      if (localStorage.getItem("writing_deep_ready")) return;
      localStorage.setItem(
        "writespace_users",
        JSON.stringify([
          {
            id: identity.userId,
            username: identity.username,
            displayName: identity.displayName,
            role: identity.role,
            password: "demo-only",
            createdAt: otherPost.createdAt,
          },
        ]),
      );
      localStorage.setItem("writespace_session", JSON.stringify(identity));
      localStorage.setItem("writespace_posts", JSON.stringify([otherPost]));
      localStorage.setItem("writing_deep_ready", "yes");
    },
    { identity, otherPost },
  );
}

test("initial nonowner edit entry denies form and retains writing", async ({
  page,
}) => {
  await seedOtherPost(page);
  await page.goto("/edit/someone-else");
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByLabel("Title")).toHaveCount(0);
  const grid = page.getByRole("region", { name: "Blog posts" });
  await expect(
    grid.getByRole("link", { name: "Edit " + otherPost.title }),
  ).toHaveCount(0);
  await grid
    .getByRole("link", { name: /Other author.*Other writing/s })
    .click();
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("writespace_posts")),
    ),
  ).toEqual([otherPost]);
});

test("initial reader deep-entry renders XSS payload as literal text with no ownership controls", async ({
  page,
}) => {
  await seedOtherPost(page);
  await page.goto("/blog/someone-else");
  await expect(
    page.getByRole("heading", { name: otherPost.title }),
  ).toBeVisible();
  expect(await page.locator("article .whitespace-pre-wrap").textContent()).toBe(
    otherPost.content,
  );
  await expect(page.locator("article b, article script")).toHaveCount(0);
  expect(await page.evaluate(() => window.deepUnsafe)).toBeUndefined();
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await page.getByRole("link", { name: "Back to All Posts" }).click();
  await expect(page.getByRole("region", { name: "Blog posts" })).toBeVisible();
});

for (const path of ["/write", "/edit/someone-else"]) {
  test(
    "guest initial writing entry " + path + " redirects to login",
    async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Title")).toHaveCount(0);
    },
  );
}

test("initial missing edit ID shows useful feedback and back navigation", async ({
  page,
}) => {
  await seedOtherPost(page);
  await page.goto("/edit/missing");
  await expect(
    page.getByRole("heading", { name: "Post not found" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to All Posts" }).click();
  await expect(page).toHaveURL(/\/blogs$/);
});

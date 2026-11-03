/** Exercise real dark reading and account management; the fixture fails on browser errors. */
import { test, expect } from "./fixtures.js";

const account = {
  id: "mira",
  username: "mira",
  displayName: "Mira",
  role: "user",
  password: "demo-only",
  createdAt: "2026-03-04T12:00:00.000Z",
};
const post = {
  id: "local-thought",
  title: "Local thought",
  content: "First line\n\n<b>Literal words</b>",
  authorId: account.id,
  authorName: account.displayName,
  createdAt: account.createdAt,
};

/** Seed prerequisites once so reloads verify persistence rather than restore deleted data. */
async function seed(page) {
  await page.addInitScript(
    ({ account, post }) => {
      if (localStorage.getItem("content_theme_ready")) return;
      localStorage.setItem("writespace_users", JSON.stringify([account]));
      localStorage.setItem("writespace_posts", JSON.stringify([post]));
      localStorage.setItem("content_theme_ready", "true");
    },
    { account, post },
  );
}

/** Follow the existing responsive navbar rather than teleport between routes. */
async function navigate(page, name) {
  const nav = page.getByRole("navigation", {
    name: "Authenticated navigation",
  });
  const menu = nav.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) await menu.click();
  await nav.getByRole("link", { name, exact: true }).click();
}

/** Read computed presentation, not just the presence of Tailwind class strings. */
async function darkSurface(locator) {
  await expect(locator).toHaveCSS("background-color", "rgb(15, 23, 42)");
}

/** Assert that the real document stays within its mobile viewport. */
async function fitsViewport(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

for (const width of [1280, 390]) {
  test(`dark admin reading, creation and confirmed deletion persist at width ${width}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await seed(page);
    await page.goto("/login");
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await page.getByLabel("Username", { exact: true }).fill("admin");
    await page.getByLabel("Password", { exact: true }).fill("admin");
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    const recent = page.getByRole("region", { name: "Recent posts" });
    await darkSurface(recent);
    await expect(page.getByRole("group", { name: "Total Posts" })).toHaveCSS(
      "background-color",
      "rgb(30, 27, 75)",
    );
    await expect(
      page.getByRole("group", { name: "Total Posts" }).locator("p").last(),
    ).toHaveText("1");
    await page.getByRole("link", { name: post.title, exact: true }).click();
    await darkSurface(page.getByRole("article"));
    await expect(page.getByRole("heading", { name: post.title })).toHaveCSS(
      "color",
      "rgb(241, 245, 249)",
    );
    await expect(page.getByRole("article")).toContainText(post.content);
    await expect(page.getByRole("article").locator("b")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Delete", exact: true }),
    ).toHaveCSS("color", "rgb(252, 165, 165)");
    await page.getByRole("link", { name: "Back to All Posts" }).click();
    const card = page.getByRole("article", { name: post.title });
    await darkSurface(card);
    await expect(card.locator("time")).toHaveCSS("color", "rgb(148, 163, 184)");
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(card).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await navigate(page, "Users");
    await darkSurface(page.getByRole("region", { name: "Create User" }));
    const visibleDelete = (username) =>
      page
        .locator("button:visible")
        .and(
          page.getByRole("button", { name: "Delete " + username, exact: true }),
        );
    await expect(visibleDelete("admin")).toBeDisabled();
    await page
      .getByRole("button", { name: "Create User", exact: true })
      .click();
    await expect(page.getByText("Display Name is required.")).toHaveCSS(
      "color",
      "rgb(252, 165, 165)",
    );
    await expect(page.getByText("Choose Admin or user.")).toBeVisible();
    await expect(page.getByLabel("Role", { exact: true })).toHaveCSS(
      "background-color",
      "rgb(15, 23, 42)",
    );
    await page.getByLabel("Display Name").fill("New Editor");
    await page.getByLabel("Username", { exact: true }).fill("neweditor");
    await page.getByLabel("Password", { exact: true }).fill("demo-only");
    await page.getByLabel("Role", { exact: true }).selectOption("admin");
    await page
      .getByRole("button", { name: "Create User", exact: true })
      .click();
    await expect(
      page.getByText("Created account for New Editor."),
    ).toBeVisible();
    const users = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("writespace_users")),
    );
    expect(users).toHaveLength(2);
    expect(users[1]).toMatchObject({
      username: "neweditor",
      displayName: "New Editor",
      role: "admin",
    });
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("writespace_session")).userId,
      ),
    ).toBe("admin");
    if (width === 390) {
      await expect(page.getByRole("table")).toBeHidden();
      await darkSurface(
        page.getByRole("article", { name: "Account neweditor" }),
      );
      await expect(
        page
          .getByRole("article", { name: "Account neweditor" })
          .getByRole("status"),
      ).toHaveCSS("color", "rgb(221, 214, 254)");
    } else {
      await expect(page.getByRole("table")).toBeVisible();
      await expect(
        page.getByRole("row", { name: /New Editor/ }).getByRole("status"),
      ).toHaveCSS("color", "rgb(221, 214, 254)");
    }
    await fitsViewport(page);
    await page.reload();
    await expect(visibleDelete("neweditor")).toBeEnabled();
    await darkSurface(page.getByRole("region", { name: "Create User" }));
    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("confirm");
      expect(dialog.message()).toContain(
        "posts and author name will be retained",
      );
      await dialog.dismiss();
    });
    await visibleDelete("mira").click();
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("writespace_users")),
      ),
    ).toEqual(users);
    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    await visibleDelete("mira").click();
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("writespace_users")),
      ),
    ).toEqual([users[1]]);
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("writespace_posts")),
      ),
    ).toEqual([post]);
    await page.getByRole("link", { name: "Back to Dashboard" }).click();
    await expect(
      page.getByRole("group", { name: "Total Users" }).locator("p").last(),
    ).toHaveText("2");
    await page.getByRole("link", { name: post.title, exact: true }).click();
    await expect(page.getByRole("article")).toContainText("Mira");
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toBe("Delete this post? This cannot be undone.");
      await dialog.dismiss();
    });
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("writespace_posts")),
      ),
    ).toEqual([post]);
    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    await darkSurface(
      page.getByText("No blogs yet. Be the first to write one!").locator(".."),
    );
    await page.reload();
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("writespace_posts")),
      ),
    ).toEqual([]);
    expect(
      await page.evaluate(() => localStorage.getItem("writespace_theme")),
    ).toBe("dark");
    await expect(page.getByText(/No blogs yet/)).toBeVisible();
    await fitsViewport(page);
    await page.screenshot({
      path: testInfo.outputPath(`dark-content-${width}.png`),
      fullPage: true,
    });
  });
}

test("dark guest gate and contributor reading do not expose administration or another author's actions", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/users");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.getByLabel("Username", { exact: true }).fill("mira");
  await page.getByLabel("Password", { exact: true }).fill("demo-only");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(
    page.getByRole("link", { name: "Users", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("article", { name: post.title })
    .getByRole("link")
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Delete", exact: true }),
  ).toBeVisible();
  await darkSurface(page.getByRole("article"));
  // Another author's record is a prerequisite, not a replacement for app behavior.
  const other = {
    ...post,
    id: "other",
    title: "Other author",
    authorId: "admin",
    authorName: "Admin",
  };
  await page.evaluate(
    (record) =>
      localStorage.setItem("writespace_posts", JSON.stringify([record])),
    other,
  );
  await page.getByRole("link", { name: "Back to All Posts" }).click();
  await page
    .getByRole("article", { name: other.title })
    .getByRole("link")
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Delete", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("article")).toContainText("Admin");
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("writespace_posts")),
    ),
  ).toEqual([other]);
});

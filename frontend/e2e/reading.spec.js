/** Exercise real browser-local reading with error capture supplied before initial entry. */
import { test, expect } from "./fixtures.js";

const reader = {
  userId: "u1",
  username: "mira",
  displayName: "Mira",
  role: "user",
};
const admin = {
  userId: "admin",
  username: "admin",
  displayName: "Admin",
  role: "admin",
};
const posts = [
  {
    id: "older",
    title: "Older own writing",
    content: "An older local thought.",
    authorId: "u1",
    authorName: "Mira",
    createdAt: "2026-03-01T12:00:00Z",
  },
  {
    id: "newer",
    title: "Newest shared writing",
    content:
      "First line\n\n<script>window.readingUnsafe = true</script>\nFinal line",
    authorId: "admin",
    authorName: "Admin",
    createdAt: "2026-03-04T12:00:00Z",
  },
  {
    id: "middle",
    title: "Middle writing",
    content: "Another contributor thought.",
    authorId: "u2",
    authorName: "Leo",
    createdAt: "2026-03-02T12:00:00Z",
  },
];

/** Seed real localStorage once, preserving subsequent navigation and reload state.
 * Args:
 *   page: Fixture page already capturing console/page errors.
 *   identity: Complete current identity, or null for guest entry.
 *   records: Actual persisted post collection for the journey.
 */
async function seedReading(page, identity = reader, records = posts) {
  await page.addInitScript(
    ({ identity, records }) => {
      if (localStorage.getItem("reading_fixture_ready")) return;
      localStorage.setItem(
        "writespace_users",
        JSON.stringify([
          {
            id: "u1",
            username: "mira",
            displayName: "Mira",
            role: "user",
            password: "demo-only",
            createdAt: "2026-03-01T12:00:00Z",
          },
          {
            id: "u2",
            username: "leo",
            displayName: "Leo",
            role: "user",
            password: "demo-only",
            createdAt: "2026-03-01T12:00:00Z",
          },
        ]),
      );
      localStorage.setItem("writespace_posts", JSON.stringify(records));
      if (identity)
        localStorage.setItem("writespace_session", JSON.stringify(identity));
      else localStorage.removeItem("writespace_session");
      localStorage.setItem("reading_fixture_ready", "yes");
    },
    { identity, records },
  );
}

test("list/read/back preserves local writing, literal text, ownership and reload persistence", async ({
  page,
}, testInfo) => {
  await seedReading(page);
  await page.goto("/blogs");
  const grid = page.getByRole("region", { name: "Blog posts" });
  await expect(grid.getByRole("heading")).toHaveText([
    "Newest shared writing",
    "Middle writing",
    "Older own writing",
  ]);
  await expect(
    grid.getByRole("link", { name: "Edit Older own writing" }),
  ).toBeVisible();
  await expect(
    grid.getByRole("link", { name: "Edit Newest shared writing" }),
  ).toHaveCount(0);
  await expect(
    grid.getByRole("link", { name: "Edit Middle writing" }),
  ).toHaveCount(0);
  await expect(grid.getByRole("img", { name: "Admin avatar" })).toBeVisible();
  await expect(
    grid.getByRole("img", { name: "Contributor avatar" }),
  ).toHaveCount(2);
  await grid
    .getByRole("link", { name: /Newest shared writing First line/ })
    .click();
  await expect(page).toHaveURL(/\/blog\/newer$/);
  await expect(
    page.getByRole("heading", { name: posts[1].title }),
  ).toBeVisible();
  const content = page.locator("article .whitespace-pre-wrap");
  expect(await content.textContent()).toBe(posts[1].content);
  await expect(content).toHaveCSS("white-space", "pre-wrap");
  await expect(page.locator("article script")).toHaveCount(0);
  expect(await page.evaluate(() => window.readingUnsafe)).toBeUndefined();
  await expect(
    page.getByRole("link", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("article time")).toHaveText("Mar 04, 2026");
  await page.reload();
  expect(await content.textContent()).toBe(posts[1].content);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("writespace_posts")),
    ),
  ).toEqual(posts);
  await page.screenshot({
    path: testInfo.outputPath("reading.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Back to All Posts" }).click();
  await grid.getByRole("link", { name: /Older own writing An older/ }).click();
  await expect(
    page.getByRole("link", { name: "Edit", exact: true }),
  ).toHaveAttribute("href", "/edit/older");
  await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
  await page.getByRole("link", { name: "Back to All Posts" }).click();
  await expect(grid.getByRole("heading")).toHaveCount(3);
});

test("Admin sees every card Edit and can edit another author in the reader", async ({
  page,
}) => {
  await seedReading(page, admin);
  await page.goto("/blogs");
  const grid = page.getByRole("region", { name: "Blog posts" });
  await expect(
    grid.getByRole("link", { name: "Edit Newest shared writing" }),
  ).toBeVisible();
  await expect(
    grid.getByRole("link", { name: "Edit Older own writing" }),
  ).toBeVisible();
  await expect(
    grid.getByRole("link", { name: "Edit Middle writing" }),
  ).toBeVisible();
  await grid.getByRole("link", { name: /Older own writing An older/ }).click();
  await expect(
    page.getByRole("link", { name: "Edit", exact: true }),
  ).toHaveAttribute("href", "/edit/older");
  await page.getByRole("link", { name: "Back to All Posts" }).click();
  await expect(grid).toBeVisible();
});

for (const path of ["/blogs", "/blog/newer"]) {
  test(`guest initial entry ${path} is rejected`, async ({ page }) => {
    await seedReading(page, null);
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(0);
  });
}

test("invalid ID initial entry offers a working back link", async ({
  page,
}) => {
  await seedReading(page);
  await page.goto("/blog/does-not-exist");
  await expect(
    page.getByRole("heading", { name: "Post not found" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to All Posts" }).click();
  await expect(page.getByRole("region", { name: "Blog posts" })).toBeVisible();
});

test("empty local collection offers the specified Write destination", async ({
  page,
}) => {
  await seedReading(page, reader, []);
  await page.goto("/blogs");
  await expect(
    page.getByText("No blogs yet. Be the first to write one!"),
  ).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("link", { name: "Write", exact: true })
    .click();
  await expect(page).toHaveURL(/\/write$/);
});

test("grid responds with one, two and three columns without horizontal overflow", async ({
  page,
}) => {
  await seedReading(page);
  await page.goto("/blogs");
  const grid = page.getByRole("region", { name: "Blog posts" });
  for (const [width, columns] of [
    [390, 1],
    [800, 2],
    [1280, 3],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(async () =>
        grid.evaluate(
          (element) =>
            getComputedStyle(element).gridTemplateColumns.split(" ").length,
        ),
      )
      .toBe(columns);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await grid
    .getByRole("link", { name: /Newest shared writing First line/ })
    .click();
  await expect(page.locator("article .whitespace-pre-wrap")).toHaveCSS(
    "white-space",
    "pre-wrap",
  );
  await page.getByRole("link", { name: "Back to All Posts" }).click();
  await expect(grid).toBeVisible();
});

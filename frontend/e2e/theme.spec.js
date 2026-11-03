/** Exercise raw theme persistence with actual guest/authenticated navigation and fixture error capture. */
import { test, expect } from "./fixtures.js";

/** Verify the visible root and exact raw preference together. */
async function expectTheme(page, theme) {
  if (theme === "dark")
    await expect(page.locator("html")).toHaveClass(/(?:^|\s)dark(?:\s|$)/);
  else
    await expect(page.locator("html")).not.toHaveClass(/(?:^|\s)dark(?:\s|$)/);
  expect(
    await page.evaluate(() => localStorage.getItem("writespace_theme")),
  ).toBe(theme);
  await expect(
    page.getByRole("button", {
      name: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
    }),
  ).toBeVisible();
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(
    "theme survives guest routes, login, reload and logout at width " +
      viewport.width,
    async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await expectTheme(page, "light");
      const toggle = page.getByRole("button", { name: "Switch to dark mode" });
      await toggle.focus();
      await page.keyboard.press("Enter");
      await expectTheme(page, "dark");
      await page.keyboard.press("Space");
      await expectTheme(page, "light");
      await toggle.click();
      await expectTheme(page, "dark");
      await page.getByRole("link", { name: "Start Reading" }).click();
      await expect(page).toHaveURL(/\/login$/);
      await expectTheme(page, "dark");
      await page.getByRole("button", { name: "Switch to light mode" }).click();
      await expectTheme(page, "light");
      await page.getByRole("button", { name: "Switch to dark mode" }).click();
      await page.getByLabel("Username", { exact: true }).fill("admin");
      await page.getByLabel("Password", { exact: true }).fill("admin");
      await page.getByRole("button", { name: "Login", exact: true }).click();
      await expect(page).toHaveURL(/\/admin$/);
      await expect(
        page.getByRole("navigation", { name: "Authenticated navigation" }),
      ).toBeVisible();
      await expectTheme(page, "dark");
      const identity = await page.evaluate(() =>
        localStorage.getItem("writespace_session"),
      );
      expect(JSON.parse(identity)).toEqual({
        userId: "admin",
        username: "admin",
        displayName: "Admin",
        role: "admin",
      });
      const authToggle = page.getByRole("button", {
        name: "Switch to light mode",
      });
      await authToggle.focus();
      await page.keyboard.press("Enter");
      await expectTheme(page, "light");
      await page.keyboard.press("Space");
      await expectTheme(page, "dark");
      expect(
        await page.evaluate(() => localStorage.getItem("writespace_session")),
      ).toBe(identity);
      await page.reload();
      await expectTheme(page, "dark");
      await page.getByRole("link", { name: "WriteSpace", exact: true }).click();
      await expect(page).toHaveURL(/\/$/);
      await expectTheme(page, "dark");
      const nav = page.getByRole("navigation", { name: "Public navigation" });
      const menu = nav.getByRole("button", { name: "Open menu" });
      if (await menu.isVisible()) await menu.click();
      await nav.getByRole("link", { name: "Go to Dashboard" }).click();
      await expect(page).toHaveURL(/\/admin$/);
      await page.getByRole("button", { name: "Admin account" }).click();
      await page.getByRole("button", { name: "Logout" }).click();
      await expect(page).toHaveURL(/\/$/);
      expect(
        await page.evaluate(() => localStorage.getItem("writespace_session")),
      ).toBeNull();
      await expectTheme(page, "dark");
      await page.reload();
      await expectTheme(page, "dark");
      await page.getByRole("link", { name: "Start Reading" }).click();
      await expect(page).toHaveURL(/\/login$/);
      await expectTheme(page, "dark");
    },
  );
}

for (const preference of ["dark", "light", "system", '"dark"']) {
  test(
    "initial raw preference " +
      preference +
      " is validated on protected guest entry",
    async ({ page }) => {
      await page.addInitScript(
        (value) => localStorage.setItem("writespace_theme", value),
        preference,
      );
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/login$/);
      await expect(
        page.getByRole("heading", { name: "Welcome back" }),
      ).toBeVisible();
      await expectTheme(page, preference === "dark" ? "dark" : "light");
      expect(
        await page.evaluate(() => localStorage.getItem("writespace_session")),
      ).toBeNull();
    },
  );
}

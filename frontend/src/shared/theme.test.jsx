/** Verify optional preference persistence, keyboard actions and unchanged identity/routes. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App.jsx";
import { getTheme, saveTheme, THEME_KEY } from "./theme.js";
import { ThemeToggle } from "./ThemeToggle.jsx";
import {
  BUILTIN_ADMIN,
  SESSION_KEY,
  setSession,
} from "../features/auth/session.js";

beforeEach(() => document.documentElement.classList.remove("dark"));
afterEach(() => document.documentElement.classList.remove("dark"));

/** Mount the actual route shell at one initial entry. */
function mount(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("raw optional preference", () => {
  it.each(["light", "dark"])(
    "reads and saves raw %s without JSON encoding",
    (theme) => {
      expect(saveTheme(theme)).toBe(true);
      expect(localStorage.getItem(THEME_KEY)).toBe(theme);
      expect(getTheme()).toBe(theme);
    },
  );
  it.each([
    null,
    "",
    "system",
    "Dark",
    " dark ",
    '"dark"',
    "{}",
    "null",
    "toString",
  ])("defaults unsupported saved value %s to light", (value) => {
    if (value !== null) localStorage.setItem(THEME_KEY, value);
    expect(getTheme()).toBe("light");
  });
  it.each([
    undefined,
    null,
    "",
    "system",
    "Dark",
    " dark ",
    '"dark"',
    {},
    [],
    1,
    true,
  ])(
    "rejects invalid write %j without replacing preference or identity",
    (value) => {
      localStorage.setItem(THEME_KEY, "dark");
      localStorage.setItem(SESSION_KEY, "identity");
      expect(saveTheme(value)).toBe(false);
      expect(localStorage.getItem(THEME_KEY)).toBe("dark");
      expect(localStorage.getItem(SESSION_KEY)).toBe("identity");
    },
  );
  it("returns light when reading storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Denied");
    });
    expect(getTheme()).toBe("light");
  });
  it("returns false on write failure and retains the previous persisted mode", () => {
    localStorage.setItem(THEME_KEY, "light");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Full");
    });
    expect(saveTheme("dark")).toBe(false);
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
  });
  it("handles unavailable storage access without throwing", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("Unavailable");
    });
    expect(getTheme()).toBe("light");
    expect(saveTheme("dark")).toBe(false);
  });
});

describe("native target-mode action", () => {
  it.each(["light", "dark"])(
    "names the opposite of %s and exposes visible keyboard focus",
    async (theme) => {
      const user = userEvent.setup();
      let toggles = 0;
      render(
        <ThemeToggle
          theme={theme}
          onToggle={() => {
            toggles += 1;
          }}
        />,
      );
      const button = screen.getByRole("button", {
        name: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
      });
      expect(button).toHaveAttribute("type", "button");
      expect(button).toHaveClass(
        "focus-visible:ring-2",
        "dark:focus-visible:ring-indigo-400",
      );
      await user.tab();
      expect(button).toHaveFocus();
      await user.keyboard("{Enter}");
      await user.keyboard(" ");
      expect(toggles).toBe(2);
    },
  );
});

describe("root theme and real navigation", () => {
  it.each([null, "light", "dark", "system", '"dark"'])(
    "applies initial saved %s before render completes",
    (value) => {
      document.documentElement.classList.add("unrelated", "dark");
      if (value !== null) localStorage.setItem(THEME_KEY, value);
      mount();
      const expected = value === "dark" ? "dark" : "light";
      expect(document.documentElement.classList.contains("dark")).toBe(
        expected === "dark",
      );
      expect(document.documentElement).toHaveClass("unrelated");
      expect(localStorage.getItem(THEME_KEY)).toBe(expected);
      expect(
        screen.getByRole("button", {
          name:
            expected === "dark"
              ? "Switch to light mode"
              : "Switch to dark mode",
        }),
      ).toBeInTheDocument();
      document.documentElement.classList.remove("unrelated");
    },
  );
  it("keeps a usable light default on read failure", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Denied");
    });
    mount("/login");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    ).toBeInTheDocument();
  });
  it("continues repeated toggling in memory when persistence fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Full");
    });
    mount("/login");
    await user.click(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    );
    expect(document.documentElement).toHaveClass("dark");
    await user.click(
      screen.getByRole("button", { name: "Switch to light mode" }),
    );
    expect(document.documentElement).not.toHaveClass("dark");
    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
  });
  it.each(["/", "/login", "/register"])(
    "toggles the public/guest shell at %s using Enter and Space",
    async (path) => {
      const user = userEvent.setup();
      mount(path);
      const nav = screen.getByRole("navigation", { name: "Public navigation" });
      const toggle = within(nav).getByRole("button", {
        name: "Switch to dark mode",
      });
      toggle.focus();
      await user.keyboard("{Enter}");
      expect(document.documentElement).toHaveClass("dark");
      expect(localStorage.getItem(THEME_KEY)).toBe("dark");
      expect(toggle).toHaveAccessibleName("Switch to light mode");
      expect(toggle).toHaveFocus();
      await user.keyboard(" ");
      expect(document.documentElement).not.toHaveClass("dark");
      expect(localStorage.getItem(THEME_KEY)).toBe("light");
      expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    },
  );
  it("retains dark preference across public navigation and remount", async () => {
    const user = userEvent.setup();
    const view = mount();
    await user.click(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    );
    await user.click(
      within(
        screen.getByRole("navigation", { name: "Public navigation" }),
      ).getByRole("link", { name: "Login", exact: true }),
    );
    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(document.documentElement).toHaveClass("dark");
    view.unmount();
    document.documentElement.classList.remove("dark");
    mount("/login");
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  });
  it("preserves authenticated routes/session, dashboard entry, remount and logout preference", async () => {
    const user = userEvent.setup();
    setSession(BUILTIN_ADMIN);
    const identity = localStorage.getItem(SESSION_KEY);
    const view = mount("/admin");
    const toggle = screen.getByRole("button", { name: "Switch to dark mode" });
    toggle.focus();
    await user.keyboard("{Enter}");
    expect(document.documentElement).toHaveClass("dark");
    await user.keyboard(" ");
    expect(document.documentElement).not.toHaveClass("dark");
    await user.click(toggle);
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(localStorage.getItem(SESSION_KEY)).toBe(identity);
    await user.click(screen.getByRole("link", { name: "Write", exact: true }));
    expect(screen.getByRole("textbox", { name: "Title" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "WriteSpace" }));
    expect(
      screen.getByRole("navigation", { name: "Public navigation" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Go to Dashboard" }));
    expect(
      screen.getByRole("heading", { name: "Admin Dashboard" }),
    ).toBeInTheDocument();
    view.unmount();
    mount("/admin");
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem(SESSION_KEY)).toBe(identity);
    await user.click(screen.getByRole("button", { name: "Admin account" }));
    await user.click(screen.getByRole("button", { name: "Logout" }));
    expect(
      screen.getByRole("navigation", { name: "Public navigation" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
    cleanup();
    mount("/admin");
    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(document.documentElement).toHaveClass("dark");
  });
});

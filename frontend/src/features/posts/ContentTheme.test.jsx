/** Verify paired reading/admin presentation through real routes and browser-local state. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../App.jsx";
import UsersPage from "../admin/UsersPage.jsx";

const account = {
  id: "u1",
  username: "mira",
  displayName: "Mira",
  role: "user",
  password: "demo-only",
  createdAt: "2026-03-04T12:00:00.000Z",
};
const editor = {
  ...account,
  id: "a1",
  username: "editor",
  displayName: "Editor",
  role: "admin",
};
const admin = {
  userId: "admin",
  username: "admin",
  displayName: "Admin",
  role: "admin",
};
const reader = {
  userId: account.id,
  username: account.username,
  displayName: account.displayName,
  role: "user",
};
const post = {
  id: "p1",
  title: "Local thought",
  content: "First line\n\n<b>Literal words</b>",
  authorId: account.id,
  authorName: account.displayName,
  createdAt: account.createdAt,
};

/** Mount the existing App without substituting its theme, permissions or services. */
function mount(path, mode, identity = admin) {
  localStorage.setItem("writespace_theme", mode);
  if (identity)
    localStorage.setItem("writespace_session", JSON.stringify(identity));
  else localStorage.removeItem("writespace_session");
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  expect(document.documentElement.classList.contains("dark")).toBe(
    mode === "dark",
  );
  return view;
}

/** Assert both utility contracts; jsdom cannot evaluate Tailwind computed colors. */
function surface(element) {
  expect(element).toHaveClass(
    "bg-white",
    "dark:bg-slate-900",
    "border-slate-200",
    "dark:border-slate-700",
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("writespace_users", JSON.stringify([account, editor]));
  localStorage.setItem("writespace_posts", JSON.stringify([post]));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.classList.remove("dark");
});

describe.each(["light", "dark"])("content surfaces in %s mode", (mode) => {
  it("preserves four card accents, literal previews, metadata and full reader navigation", async () => {
    const posts = ["indigo", "violet", "pink", "teal"].map((color, index) => ({
      ...post,
      id: "p" + index,
      title: color + " thought",
      createdAt: `2026-03-0${8 - index}T12:00:00.000Z`,
    }));
    localStorage.setItem("writespace_posts", JSON.stringify(posts));
    mount("/blogs", mode, reader);
    const grid = screen.getByRole("region", { name: "Blog posts" });
    expect(grid).toHaveClass("grid-cols-1", "md:grid-cols-2", "lg:grid-cols-3");
    for (const [index, card] of within(grid)
      .getAllByRole("article")
      .entries()) {
      const color = ["indigo", "violet", "pink", "teal"][index];
      expect(card).toHaveClass(
        "bg-white",
        "dark:bg-slate-900",
        `border-${color}-500`,
        `dark:border-${color}-400`,
      );
      expect(within(card).getByRole("heading")).toHaveClass(
        "text-slate-900",
        "dark:text-slate-100",
      );
      expect(within(card).getByText("Mira")).toHaveClass(
        "text-slate-800",
        "dark:text-slate-200",
      );
      expect(card.querySelector("time")).toHaveClass(
        "text-slate-500",
        "dark:text-slate-400",
      );
      expect(card.querySelector("b")).toBeNull();
    }
    await userEvent.setup().click(within(grid).getAllByRole("link")[0]);
    const article = screen.getByRole("article");
    surface(article);
    expect(within(article).getByRole("heading")).toHaveTextContent(
      "indigo thought",
    );
    expect(article.querySelector(".whitespace-pre-wrap")).toHaveClass(
      "text-slate-800",
      "dark:text-slate-200",
    );
    expect(article).toHaveTextContent("<b>Literal words</b>");
    expect(article.querySelector("b")).toBeNull();
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass(
      "bg-red-50",
      "dark:bg-red-950",
      "dark:text-red-300",
    );
    await userEvent
      .setup()
      .click(screen.getByRole("link", { name: "Back to All Posts" }));
    expect(screen.getByRole("heading", { name: "All Blogs" })).toHaveClass(
      "text-slate-900",
      "dark:text-slate-100",
    );
    expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual(posts);
  });

  it("themes empty and missing reading states without changing their destinations", async () => {
    localStorage.setItem("writespace_posts", "[]");
    const view = mount("/blog/missing", mode);
    expect(screen.getByRole("heading", { name: "Post not found" })).toHaveClass(
      "text-slate-900",
      "dark:text-slate-100",
    );
    await userEvent
      .setup()
      .click(screen.getByRole("link", { name: "Back to All Posts" }));
    const empty = screen.getByText("No blogs yet. Be the first to write one!");
    surface(empty.parentElement);
    expect(empty).toHaveClass("text-slate-800", "dark:text-slate-200");
    expect(
      within(empty.parentElement).getByRole("link", { name: "Write" }),
    ).toHaveAttribute("href", "/write");
    view.unmount();
    localStorage.setItem("writespace_posts", "corrupt");
    mount("/blogs", mode);
    expect(screen.getByText(/No blogs yet/)).toBeVisible();
    expect(localStorage.getItem("writespace_posts")).toBe("corrupt");
  });

  it("preserves owner/admin actions and denies other contributors and guests", () => {
    const view = mount("/blog/p1", mode, {
      ...reader,
      userId: editor.id,
      username: editor.username,
      displayName: editor.displayName,
      role: "admin",
    });
    expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();
    view.unmount();
    localStorage.setItem(
      "writespace_posts",
      JSON.stringify([{ ...post, authorId: "other" }]),
    );
    const other = mount("/blog/p1", mode, reader);
    expect(
      screen.queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Edit", exact: true }),
    ).not.toBeInTheDocument();
    other.unmount();
    const denied = mount("/users", mode, reader);
    expect(screen.getByRole("heading", { name: "All Blogs" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Create User" }),
    ).not.toBeInTheDocument();
    denied.unmount();
    mount("/blog/p1", mode, null);
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("themes failed reader deletion and retains persisted writing", async () => {
    mount("/blog/p1", mode, reader);
    vi.spyOn(window, "confirm").mockImplementation(() => {
      throw new Error("Confirmation unavailable");
    });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("alert")).toHaveClass(
      "bg-red-50",
      "dark:bg-red-950",
      "text-red-600",
      "dark:text-red-300",
    );
    expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([
      post,
    ]);
  });

  it("themes all statistics and recent rows while confirmed deletion updates real zero counts", async () => {
    mount("/admin", mode);
    for (const [label, color, count] of [
      ["Total Posts", "indigo", 1],
      ["Total Users", "slate", 3],
      ["Total Admins", "violet", 2],
      ["Total contributors", "teal", 1],
    ]) {
      const group = screen.getByRole("group", { name: label });
      expect(within(group).getByText(String(count))).toHaveClass(
        "tabular-nums",
      );
      expect(group).toHaveClass(
        color === "slate" ? "bg-white" : `bg-${color}-50`,
        color === "slate" ? "dark:bg-slate-900" : `dark:bg-${color}-950`,
      );
    }
    const recent = screen.getByRole("region", { name: "Recent posts" });
    surface(recent);
    expect(recent.querySelector("ul")).toHaveClass(
      "divide-slate-200",
      "dark:divide-slate-700",
    );
    expect(within(recent).getByText(/Mira/)).toHaveClass(
      "text-slate-600",
      "dark:text-slate-300",
    );
    const remove = screen.getByRole("button", { name: "Delete Local thought" });
    expect(remove).toHaveClass(
      "border-red-200",
      "dark:border-red-800",
      "dark:hover:bg-red-900",
    );
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await userEvent.setup().click(remove);
    expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([
      post,
    ]);
    window.confirm.mockReturnValue(true);
    await userEvent.setup().click(remove);
    expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([]);
    expect(
      screen.getByRole("group", { name: "Total Posts" }),
    ).toHaveTextContent("0");
    expect(screen.getByText(/No posts yet. Write your first post/)).toHaveClass(
      "text-slate-600",
      "dark:text-slate-300",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Post deleted.");
  });

  it("themes stale admin errors and retry restores the actual overview", async () => {
    mount("/admin", mode);
    vi.spyOn(window, "confirm").mockImplementation(() => {
      localStorage.removeItem("writespace_session");
      return true;
    });
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Delete Local thought" }),
    );
    expect(screen.getByRole("alert")).toHaveClass(
      "text-red-700",
      "dark:text-red-300",
    );
    expect(screen.getByRole("alert").parentElement).toHaveClass(
      "bg-red-50",
      "dark:bg-red-950",
    );
    await user.click(screen.getByRole("button", { name: "Retry overview" }));
    expect(
      screen.queryByRole("group", { name: "Total Posts" }),
    ).not.toBeInTheDocument();
    localStorage.setItem("writespace_session", JSON.stringify(admin));
    await user.click(screen.getByRole("button", { name: "Retry overview" }));
    expect(
      screen.getByRole("group", { name: "Total Posts" }),
    ).toHaveTextContent("1");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("themes native account fields, associated errors, both row layouts and distinct protected roles", async () => {
    mount("/users", mode, {
      userId: editor.id,
      username: editor.username,
      displayName: editor.displayName,
      role: "admin",
    });
    surface(screen.getByRole("region", { name: "Create User" }));
    const table = screen.getByRole("table");
    surface(table.parentElement);
    expect(table.querySelector("thead")).toHaveClass(
      "bg-slate-100",
      "dark:bg-slate-800",
      "dark:text-slate-200",
    );
    for (const username of ["admin", "editor"]) {
      for (const button of screen.getAllByRole("button", {
        name: "Delete " + username,
      }))
        expect(button).toBeDisabled();
    }
    for (const [name, color] of [
      ["Mira", "indigo"],
      ["Editor", "violet"],
    ]) {
      const row = within(table).getByRole("row", { name: new RegExp(name) });
      expect(row).toHaveClass(
        "border-slate-200",
        "dark:border-slate-700",
        "dark:text-slate-200",
      );
      expect(within(row).getByRole("status")).toHaveClass(
        `bg-${color}-100`,
        `dark:bg-${color}-950`,
        `dark:text-${color}-200`,
      );
    }
    for (const card of screen.getAllByRole("article")) surface(card);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Create User" }));
    for (const label of ["Display Name", "Username", "Password", "Role"]) {
      const field = screen.getByLabelText(label);
      expect(field).toHaveClass(
        "bg-white",
        "dark:bg-slate-900",
        "text-slate-800",
        "dark:text-slate-200",
      );
      expect(field).toHaveAttribute("aria-invalid", "true");
      const error = document.getElementById(
        field.getAttribute("aria-describedby"),
      );
      expect(error).toHaveAttribute("role", "alert");
      expect(error).toHaveClass("text-red-600", "dark:text-red-300");
    }
    expect(JSON.parse(localStorage.getItem("writespace_users"))).toEqual([
      account,
      editor,
    ]);
  });

  it("persists account creation/removal without changing session or retained author writing", async () => {
    mount("/users", mode);
    const user = userEvent.setup();
    const session = localStorage.getItem("writespace_session");
    await user.type(screen.getByLabelText("Display Name"), "New Contributor");
    await user.type(screen.getByLabelText("Username"), "newcontributor");
    await user.type(screen.getByLabelText("Password"), "demo-only");
    await user.selectOptions(screen.getByLabelText("Role"), "user");
    await user.click(screen.getByRole("button", { name: "Create User" }));
    expect(screen.getByRole("table")).toHaveTextContent("New Contributor");
    expect(JSON.parse(localStorage.getItem("writespace_users"))).toHaveLength(
      3,
    );
    expect(localStorage.getItem("writespace_session")).toBe(session);
    const remove = within(screen.getByRole("table")).getByRole("button", {
      name: "Delete mira",
    });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await user.click(remove);
    expect(JSON.parse(localStorage.getItem("writespace_users"))).toHaveLength(
      3,
    );
    window.confirm.mockReturnValue(true);
    await user.click(remove);
    expect(
      JSON.parse(localStorage.getItem("writespace_users")).some(
        (record) => record.id === account.id,
      ),
    ).toBe(false);
    expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([
      post,
    ]);
    await user.click(screen.getByRole("link", { name: "Back to Dashboard" }));
    await user.click(
      screen.getByRole("link", { name: post.title, exact: true }),
    );
    expect(screen.getByRole("article")).toHaveTextContent("Mira");
    expect(localStorage.getItem("writespace_theme")).toBe(mode);
  });

  it("themes built-in-only empty copy and unavailable accounts without fabricated records", () => {
    localStorage.setItem("writespace_users", "[]");
    const view = mount("/users", mode);
    expect(screen.getByText(/No created accounts yet/)).toHaveClass(
      "text-slate-600",
      "dark:text-slate-300",
    );
    view.unmount();
    localStorage.removeItem("writespace_session");
    render(
      <MemoryRouter>
        <UsersPage session={admin} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Accounts are unavailable/)).toHaveClass(
      "text-slate-600",
      "dark:text-slate-300",
    );
    expect(screen.getByRole("alert")).toHaveClass(
      "bg-red-50",
      "dark:bg-red-950",
      "dark:text-red-300",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

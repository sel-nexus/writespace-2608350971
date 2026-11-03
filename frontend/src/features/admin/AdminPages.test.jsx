/** Exercise admin screens with real services, actual localStorage and native user interactions. */
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../App.jsx";
import AdminPage from "./AdminPage.jsx";
import UsersPage from "./UsersPage.jsx";
import { StatCard } from "./StatCard.jsx";
import { BUILTIN_ADMIN, setSession } from "../auth/session.js";
import { saveUsers, savePosts } from "../posts/storage.js";
const account = {
  id: "u1",
  username: "mira",
  displayName: "Mira",
  role: "user",
  password: "demo",
  createdAt: "2026-03-04T12:00:00.000Z",
};
const editor = { ...account, id: "a1", username: "editor", displayName: "Editor", role: "admin" };
const post = {
  id: "p1",
  title: "Other writing",
  content: "Retained writing",
  authorId: "u1",
  authorName: "Mira",
  createdAt: account.createdAt,
};
beforeEach(() => {
  saveUsers([account, editor]);
  setSession(BUILTIN_ADMIN);
});

/** Mount real route wiring from a single initial address.
 * Args:
 *   path: Initial app address.
 * Returns:
 *   Render handle for unmount/persistence checks.
 */
function mount(path = "/admin") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
/** Fill account fields using native input semantics.
 * Args:
 *   user: Testing Library user-event instance.
 *   role: Dropdown role to select.
 */
async function fill(user, role = "user") {
  await user.type(screen.getByLabelText("Display Name"), "<b>New Name</b>");
  await user.type(screen.getByLabelText("Username"), "new");
  await user.type(screen.getByLabelText("Password"), "demo-only");
  await user.selectOptions(screen.getByLabelText("Role"), role);
}

it("StatCard displays meaningful zero in a named tabular group and requested accent", () => {
  render(<StatCard label="Total Posts" value={0} accent="indigo" />);
  const group = screen.getByRole("group", { name: "Total Posts" });
  expect(within(group).getByText("0")).toHaveClass("tabular-nums");
  expect(group).toHaveClass("bg-indigo-50");
});
it("dashboard renders clarified real metrics, newest five and inline edit/read links", () => {
  const posts = Array.from({ length: 7 }, (_, index) => ({
    ...post,
    id: "p" + index,
    title: "Post " + index,
    createdAt: "2026-03-0" + (index + 1) + "T12:00:00Z",
  }));
  savePosts(posts);
  mount();
  for (const [label, count] of [
    ["Total Posts", 7],
    ["Total Users", 3],
    ["Total Admins", 2],
    ["Total contributors", 1],
  ]) {
    expect(screen.getByRole("group", { name: label })).toHaveTextContent(String(count));
  }
  const recent = screen.getByRole("region", { name: "Recent posts" });
  expect(
    within(recent)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent),
  ).toEqual(["Post 6", "Post 5", "Post 4", "Post 3", "Post 2"]);
  expect(within(recent).getByRole("link", { name: "Edit Post 6" })).toHaveAttribute(
    "href",
    "/edit/p6",
  );
  expect(within(recent).getByRole("link", { name: "Post 6", exact: true })).toHaveAttribute(
    "href",
    "/blog/p6",
  );
  expect(screen.getByRole("link", { name: "Write New Post" })).toHaveAttribute("href", "/write");
});
it("empty dashboard explains how to begin and links quick actions to actual screens", async () => {
  saveUsers([]);
  mount();
  expect(screen.getByText(/No posts yet. Write your first post/)).toBeVisible();
  expect(screen.getByRole("group", { name: "Total Users" })).toHaveTextContent("1");
  const user = userEvent.setup();
  await user.click(screen.getByRole("link", { name: "Manage Users", exact: true }));
  expect(screen.getByRole("heading", { level: 1, name: "Manage Users" })).toBeVisible();
  expect(screen.getByText(/No created accounts yet/)).toBeVisible();
  await user.click(screen.getByRole("link", { name: "Back to Dashboard" }));
  await user.click(screen.getByRole("link", { name: "Write New Post" }));
  expect(screen.getByRole("heading", { name: "Write a Post" })).toBeVisible();
});
it("recent deletion cancel preserves writing and accept refreshes counters inline", async () => {
  savePosts([post]);
  mount();
  const user = userEvent.setup();
  vi.spyOn(window, "confirm").mockReturnValue(false);
  await user.click(screen.getByRole("button", { name: "Delete Other writing" }));
  expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([post]);
  expect(screen.getByRole("group", { name: "Total Posts" })).toHaveTextContent("1");
  window.confirm.mockReturnValue(true);
  await user.click(screen.getByRole("button", { name: "Delete Other writing" }));
  expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([]);
  expect(screen.getByRole("group", { name: "Total Posts" })).toHaveTextContent("0");
  expect(screen.getByRole("status")).toHaveTextContent("Post deleted.");
});
it.each(["quota", "session", "missing"])(
  "recent deletion surfaces %s failure without false success",
  async (failure) => {
    savePosts([post]);
    mount();
    vi.spyOn(window, "confirm").mockImplementation(() => {
      if (failure === "session") localStorage.removeItem("writespace_session");
      if (failure === "missing") savePosts([]);
      return true;
    });
    if (failure === "quota")
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota");
      });
    await userEvent.setup().click(screen.getByRole("button", { name: "Delete Other writing" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      failure === "quota" ? /Could not save/ : failure === "session" ? /session/ : /not found/,
    );
    expect(screen.getByRole("status")).not.toHaveTextContent("Post deleted");
    expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual(
      failure === "missing" ? [] : [post],
    );
  },
);
it("invalid overview shows a visible error and Retry reads restored actual session", async () => {
  localStorage.removeItem("writespace_session");
  render(
    <MemoryRouter>
      <AdminPage session={BUILTIN_ADMIN} />
    </MemoryRouter>,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(/session/);
  expect(screen.queryByRole("group", { name: "Total Posts" })).not.toBeInTheDocument();
  setSession(BUILTIN_ADMIN);
  await userEvent.setup().click(screen.getByRole("button", { name: "Retry overview" }));
  expect(screen.getByRole("group", { name: "Total Users" })).toHaveTextContent("3");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("users have semantic table headers and mobile cards, avatars, badges, dates and protected builtin", () => {
  mount("/users");
  const table = screen.getByRole("table", { name: "Local accounts" });
  expect(within(table).getAllByRole("columnheader")).toHaveLength(5);
  for (const header of within(table).getAllByRole("columnheader"))
    expect(header).toHaveAttribute("scope", "col");
  const builtin = within(table).getByRole("button", { name: "Delete admin" });
  expect(builtin).toBeDisabled();
  expect(builtin).toHaveAttribute("title", "Default admin cannot be deleted.");
  expect(within(table).getByText("Built-in account")).toBeVisible();
  const row = within(table).getByRole("row", { name: /Mira/ });
  expect(within(row).getByRole("img", { name: "Contributor avatar" })).toBeVisible();
  expect(within(row).getByRole("status")).toHaveTextContent("user");
  expect(within(row).getByText("Mar 04, 2026")).toHaveAttribute("datetime", account.createdAt);
  expect(screen.getAllByRole("article")).toHaveLength(3);
  expect(table.parentElement).toHaveClass("hidden", "sm:block");
  expect(screen.getByLabelText("Mobile accounts")).toHaveClass("sm:hidden");
  expect(screen.getByText(/plaintext/)).toBeVisible();
});
it("currently signed-in created admin deletion is disabled in both layouts", () => {
  setSession({ userId: "a1", username: "editor", displayName: "Editor", role: "admin" });
  mount("/users");
  for (const control of screen.getAllByRole("button", { name: "Delete editor" })) {
    expect(control).toBeDisabled();
    expect(control).toHaveAttribute("title", "You cannot delete your current account.");
  }
});
it("invalid submission associates each required error with its field", async () => {
  mount("/users");
  await userEvent.setup().click(screen.getByRole("button", { name: "Create User" }));
  for (const label of ["Display Name", "Username", "Password", "Role"]) {
    const control = screen.getByLabelText(label);
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(control).toHaveAttribute("aria-required", "true");
    expect(document.getElementById(control.getAttribute("aria-describedby"))).toHaveAttribute(
      "role",
      "alert",
    );
  }
  expect(JSON.parse(localStorage.getItem("writespace_users"))).toEqual([account, editor]);
});
it.each(["admin", "user"])(
  "creates %s from UI, resets fields, keeps session and renders literal name across remount",
  async (role) => {
    const before = localStorage.getItem("writespace_session");
    const view = mount("/users");
    const user = userEvent.setup();
    await fill(user, role);
    await user.click(screen.getByRole("button", { name: "Create User" }));
    expect(screen.getByRole("table")).toHaveTextContent("<b>New Name</b>");
    expect(screen.getByRole("table").querySelector("b")).toBeNull();
    expect(screen.getByLabelText("Display Name")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Role")).toHaveValue("");
    expect(localStorage.getItem("writespace_session")).toBe(before);
    const created = JSON.parse(localStorage.getItem("writespace_users")).at(-1);
    expect(created.role).toBe(role);
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);
    view.unmount();
    mount("/users");
    expect(screen.getByRole("table")).toHaveTextContent("<b>New Name</b>");
  },
);
it.each(["admin", "MIRA"])(
  "shows reserved or duplicate username %s without writing",
  async (name) => {
    mount("/users");
    const user = userEvent.setup();
    await fill(user);
    await user.clear(screen.getByLabelText("Username"));
    await user.type(screen.getByLabelText("Username"), name);
    await user.click(screen.getByRole("button", { name: "Create User" }));
    expect(screen.getByLabelText("Username")).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByText(
        name === "admin" ? "The admin username is reserved." : "Username is already taken.",
      ),
    ).toBeVisible();
    expect(JSON.parse(localStorage.getItem("writespace_users"))).toEqual([account, editor]);
  },
);
it("creation write failure leaves entered values and no false success", async () => {
  mount("/users");
  const user = userEvent.setup();
  await fill(user);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  await user.click(screen.getByRole("button", { name: "Create User" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/Could not save/);
  expect(screen.getByLabelText("Username")).toHaveValue("new");
  expect(JSON.parse(localStorage.getItem("writespace_users"))).toHaveLength(2);
});
it("account cancellation/accept persists removal and retains posts and author names", async () => {
  savePosts([post]);
  mount("/users");
  const user = userEvent.setup();
  const table = screen.getByRole("table");
  vi.spyOn(window, "confirm").mockReturnValue(false);
  await user.click(within(table).getByRole("button", { name: "Delete mira" }));
  expect(JSON.parse(localStorage.getItem("writespace_users"))).toEqual([account, editor]);
  window.confirm.mockReturnValue(true);
  await user.click(within(table).getByRole("button", { name: "Delete mira" }));
  expect(JSON.parse(localStorage.getItem("writespace_users"))).toEqual([editor]);
  expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([post]);
  expect(screen.getByRole("table")).not.toHaveTextContent("Mira");
  expect(screen.getByText(/Account deleted. Their posts/)).toBeVisible();
  await user.click(screen.getByRole("link", { name: "Back to Dashboard" }));
  expect(screen.getByRole("group", { name: "Total Users" })).toHaveTextContent("2");
  expect(screen.getByRole("group", { name: "Total contributors" })).toHaveTextContent("0");
  expect(screen.getByRole("region", { name: "Recent posts" })).toHaveTextContent("Mira");
});
it.each(["quota", "session", "missing"])(
  "account deletion shows %s failure without reporting removal",
  async (failure) => {
    mount("/users");
    vi.spyOn(window, "confirm").mockImplementation(() => {
      if (failure === "session") localStorage.removeItem("writespace_session");
      if (failure === "missing") saveUsers([editor]);
      return true;
    });
    if (failure === "quota")
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota");
      });
    await userEvent
      .setup()
      .click(within(screen.getByRole("table")).getByRole("button", { name: "Delete mira" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      failure === "quota" ? /Could not save/ : failure === "session" ? /session/ : /not found/,
    );
    expect(screen.queryByText(/Account deleted/)).not.toBeInTheDocument();
  },
);
it("direct invalid users component fails visibly rather than rendering private accounts", () => {
  localStorage.removeItem("writespace_session");
  render(
    <MemoryRouter>
      <UsersPage session={BUILTIN_ADMIN} />
    </MemoryRouter>,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(/session/);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});
it.each(["/admin", "/users"])("guest guard redirects %s to real Login", (path) => {
  localStorage.removeItem("writespace_session");
  mount(path);
  expect(screen.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Admin Dashboard" })).not.toBeInTheDocument();
});
it.each(["/admin", "/users"])("wrong role guard redirects %s to All Blogs", (path) => {
  setSession({ userId: "u1", username: "mira", displayName: "Mira", role: "user" });
  mount(path);
  expect(screen.getByRole("heading", { name: "All Blogs" })).toBeVisible();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

it("mobile account card delegates confirmed deletion and persists removal", async () => {
  mount("/users");
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const card = screen.getByRole("article", { name: "Account mira" });
  await userEvent.setup().click(within(card).getByRole("button", { name: "Delete mira" }));
  expect(screen.queryByRole("article", { name: "Account mira" })).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("writespace_users"))).toEqual([editor]);
});
it("navbar Users and recent Edit links reach the actual account and editor screens", async () => {
  savePosts([post]);
  mount();
  const user = userEvent.setup();
  await user.click(screen.getByRole("link", { name: "Edit Other writing" }));
  expect(screen.getByRole("heading", { name: "Edit Post" })).toBeVisible();
  expect(screen.getByLabelText("Title")).toHaveValue(post.title);
  await user.click(
    within(screen.getByRole("navigation", { name: "Authenticated navigation" })).getByRole("link", {
      name: "Users",
      exact: true,
    }),
  );
  expect(screen.getByRole("heading", { name: "Manage Users", level: 1 })).toBeVisible();
});

/** Verify actual writing forms and route transitions against real localStorage. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../App.jsx";
import { BUILTIN_ADMIN, setSession } from "../auth/session.js";
import { savePosts, saveUsers } from "./storage.js";
import { getPost, getPosts } from "./postService.js";

const owner = {
  userId: "u1",
  username: "mira",
  displayName: "Mira",
  role: "user",
};
const post = {
  id: "p1",
  title: "Original",
  content: "First\nSecond",
  authorId: "u1",
  authorName: "Mira",
  createdAt: "2026-03-04T12:00:00.000Z",
};
beforeEach(() => {
  saveUsers([
    {
      id: "u1",
      username: "mira",
      displayName: "Mira",
      role: "user",
      password: "demo-only",
      createdAt: post.createdAt,
    },
  ]);
  savePosts([post]);
});

/** Mount real App routing from an initial writing address.
 * Args:
 *   path: Initial route to test.
 *   identity: Current persisted identity, or null for guest tests.
 * Returns:
 *   DOM render result for markup safety checks.
 */
function mount(path = "/write", identity = owner) {
  if (identity) setSession(identity);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("PostFormPage", () => {
  it("tracks each typed update, clearing and native paste with exact UTF-16 length", async () => {
    const user = userEvent.setup();
    mount();
    const content = screen.getByLabelText("Content");
    const counter = screen.getByText("0 characters");
    expect(content).not.toHaveAttribute("maxlength");
    expect(content).toHaveAttribute("aria-describedby", counter.id);
    expect(content).toHaveAccessibleDescription("0 characters");
    await user.type(content, "A");
    expect(counter).toHaveTextContent(/^1 characters$/);
    await user.type(content, "B");
    expect(counter).toHaveTextContent(/^2 characters$/);
    await user.clear(content);
    expect(counter).toHaveTextContent(/^0 characters$/);
    const pasted = "  Words 😀\n\nTrailing space  ";
    await user.paste(pasted);
    expect(content).toHaveValue(pasted);
    expect(counter.textContent).toBe(pasted.length + " characters");
    expect(content).toHaveAccessibleDescription(pasted.length + " characters");
    await user.clear(content);
    expect(content).toHaveValue("");
    expect(counter).toHaveTextContent(/^0 characters$/);
  });
  it("saves large pasted content exactly and restores and updates its edit count", async () => {
    const user = userEvent.setup();
    mount();
    const large = "  <b>Literal 😀</b>\n\n".repeat(3000) + "  End  ";
    await user.type(screen.getByLabelText("Title"), "Long writing");
    await user.click(screen.getByLabelText("Content"));
    await user.paste(large);
    expect(screen.getByLabelText("Content")).not.toHaveAttribute("maxlength");
    expect(screen.getByLabelText("Content")).toHaveValue(large);
    expect(screen.getByText(large.length + " characters")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save" }));
    const saved = getPosts().find((item) => item.id !== post.id);
    expect(saved.content).toBe(large);
    expect(
      JSON.parse(localStorage.getItem("writespace_posts")).find(
        (item) => item.id === saved.id,
      ),
    ).toEqual(saved);
    await user.click(screen.getByRole("link", { name: "Edit", exact: true }));
    const content = screen.getByLabelText("Content");
    expect(content).toHaveValue(large);
    expect(screen.getByText(large.length + " characters")).toBeVisible();
    await user.clear(content);
    expect(screen.getByText("0 characters")).toBeVisible();
    const revised = large + "\n  Revision 😀  ";
    await user.paste(revised);
    expect(screen.getByText(revised.length + " characters")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(getPost(saved.id)).toEqual({ ...saved, content: revised });
    expect(
      JSON.parse(localStorage.getItem("writespace_posts")).find(
        (item) => item.id === saved.id,
      ).content,
    ).toBe(revised);
  });
  it.each(["/write", "/edit/p1"])(
    "uses paired editor and counter theme utilities on %s",
    (path) => {
      localStorage.setItem("writespace_theme", "dark");
      mount(path);
      expect(document.documentElement).toHaveClass("dark");
      const heading = screen.getByRole("heading", {
        name: path === "/write" ? "Write a Post" : "Edit Post",
      });
      expect(heading).toHaveClass("text-slate-900", "dark:text-slate-100");
      expect(
        screen.getByText("Your words are saved as plain text in this browser."),
      ).toHaveClass("text-slate-600", "dark:text-slate-300");
      const content = screen.getByLabelText("Content");
      expect(content.closest("form")).toHaveClass(
        "bg-white",
        "dark:bg-slate-800",
        "border-slate-200",
        "dark:border-slate-700",
      );
      expect(content).toHaveClass(
        "bg-white",
        "dark:bg-slate-900",
        "text-slate-800",
        "dark:text-slate-200",
      );
      const counter = screen.getByText(content.value.length + " characters");
      expect(counter).toHaveClass("text-slate-600", "dark:text-slate-300");
      expect(content).toHaveAttribute("aria-describedby", counter.id);
    },
  );
  it.each([owner, BUILTIN_ADMIN])(
    "creates literal writing, counts characters and redirects to saved reader",
    async (identity) => {
      const user = userEvent.setup();
      const { container } = mount("/write", identity);
      expect(
        screen.getByRole("heading", { name: "Write a Post" }),
      ).toBeVisible();
      expect(screen.getByLabelText("Title")).toBeRequired();
      expect(screen.getByLabelText("Content")).toBeRequired();
      expect(screen.getByLabelText("Content")).toHaveClass(
        "min-h-64",
        "w-full",
      );
      expect(screen.getByText("0 characters")).toBeVisible();
      await user.type(screen.getByLabelText("Title"), "<b>New</b>");
      const content = "<script>window.unsafe=true</script>\nLast line";
      await user.type(screen.getByLabelText("Content"), content);
      expect(screen.getByText(content.length + " characters")).toBeVisible();
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(screen.getByRole("heading", { name: "<b>New</b>" })).toBeVisible();
      const created = getPosts().find((item) => item.id !== "p1");
      expect(created).toMatchObject({
        title: "<b>New</b>",
        content,
        authorId: identity.userId,
        authorName: identity.displayName,
      });
      expect(
        screen.getByRole("link", { name: "Edit", exact: true }),
      ).toHaveAttribute("href", "/edit/" + created.id);
      expect(container.querySelector("article script, article b")).toBeNull();
    },
  );
  it.each([owner, BUILTIN_ADMIN])(
    "prefills edit and preserves immutable metadata after Save",
    async (identity) => {
      mount("/edit/p1", identity);
      expect(screen.getByRole("heading", { name: "Edit Post" })).toBeVisible();
      expect(screen.getByLabelText("Title")).toHaveValue(post.title);
      expect(screen.getByLabelText("Content")).toHaveValue(post.content);
      expect(
        screen.getByText(post.content.length + " characters"),
      ).toBeVisible();
      const user = userEvent.setup();
      await user.clear(screen.getByLabelText("Title"));
      await user.type(screen.getByLabelText("Title"), "Revised");
      await user.clear(screen.getByLabelText("Content"));
      expect(screen.getByText("0 characters")).toBeVisible();
      await user.type(screen.getByLabelText("Content"), "Updated\nwords");
      expect(
        screen.getByText("Updated\nwords".length + " characters"),
      ).toBeVisible();
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(screen.getByRole("heading", { name: "Revised" })).toBeVisible();
      expect(getPost("p1")).toEqual({
        ...post,
        title: "Revised",
        content: "Updated\nwords",
      });
    },
  );
  for (const path of ["/write", "/edit/p1"]) {
    it(
      "Cancel from " +
        path +
        " discards changes and returns to deterministic target",
      async () => {
        mount(path);
        const before = localStorage.getItem("writespace_posts");
        const user = userEvent.setup();
        await user.type(screen.getByLabelText("Title"), "Unsaved");
        await user.type(screen.getByLabelText("Content"), "Unsaved");
        const cancel = screen.getByRole("link", { name: "Cancel" });
        expect(cancel).toHaveAttribute(
          "href",
          path === "/write" ? "/blogs" : "/blog/p1",
        );
        await user.click(cancel);
        expect(
          screen.getByRole("heading", {
            name: path === "/write" ? "All Blogs" : post.title,
          }),
        ).toBeVisible();
        expect(localStorage.getItem("writespace_posts")).toBe(before);
      },
    );
    for (const field of ["Title", "Content"]) {
      it(
        "shows individual " +
          field +
          " validation on " +
          path +
          " and allows correction",
        async () => {
          localStorage.setItem("writespace_theme", "dark");
          mount(path);
          const user = userEvent.setup();
          const other = field === "Title" ? "Content" : "Title";
          await user.clear(screen.getByLabelText(other));
          await user.type(screen.getByLabelText(other), "Valid");
          await user.clear(screen.getByLabelText(field));
          await user.type(screen.getByLabelText(field), "   ");
          await user.click(screen.getByRole("button", { name: "Save" }));
          expect(screen.getByRole("alert")).toHaveTextContent(
            field + " is required.",
          );
          expect(screen.getByLabelText(field)).toHaveAttribute(
            "aria-invalid",
            "true",
          );
          expect(screen.getByLabelText(field)).toHaveAccessibleDescription(
            (field === "Content" ? "3 characters " : "") +
              field +
              " is required.",
          );
          expect(screen.getByLabelText(other)).toHaveAttribute(
            "aria-invalid",
            "false",
          );
          const alert = screen.getByRole("alert");
          expect(alert).toHaveClass("text-red-600", "dark:text-red-300");
          expect(screen.getByLabelText(field)).toHaveClass(
            "border-red-600",
            "dark:border-red-400",
          );
          expect(
            screen
              .getByLabelText(field)
              .getAttribute("aria-describedby")
              .split(" "),
          ).toContain(alert.id);
          expect(screen.getByLabelText(field)).toHaveValue("   ");
          expect(getPosts()).toEqual([post]);
          await user.type(screen.getByLabelText(field), "Corrected");
          await user.click(screen.getByRole("button", { name: "Save" }));
          expect(
            screen.queryByRole("button", { name: "Save" }),
          ).not.toBeInTheDocument();
        },
      );
    }
    it(
      "reports failed storage on " +
        path +
        " without navigating or losing input",
      async () => {
        mount(path);
        const user = userEvent.setup();
        await user.type(screen.getByLabelText("Title"), "New");
        await user.type(screen.getByLabelText("Content"), "Words");
        const title = screen.getByLabelText("Title").value;
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
          throw new Error("quota");
        });
        await user.click(screen.getByRole("button", { name: "Save" }));
        expect(screen.getByRole("alert")).toHaveTextContent("Could not save");
        expect(screen.getByRole("alert")).toHaveClass(
          "bg-red-50",
          "dark:bg-red-950",
          "text-red-600",
          "dark:text-red-300",
        );
        expect(screen.getByLabelText("Title")).toHaveValue(title);
        expect(getPosts()).toEqual([post]);
      },
    );
    it("revalidates deleted identity on Save from " + path, async () => {
      mount(path);
      const user = userEvent.setup();
      await user.type(screen.getByLabelText("Title"), "New");
      await user.type(screen.getByLabelText("Content"), "Words");
      saveUsers([]);
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(screen.getByRole("alert")).toHaveTextContent(
        /session is invalid or expired/,
      );
      expect(getPosts()).toEqual([post]);
    });
  }
  it("handles removal of an edit resource before Save with useful feedback", async () => {
    mount("/edit/p1");
    savePosts([]);
    await userEvent.setup().click(screen.getByRole("button", { name: "Save" }));
    expect(
      screen.getByRole("heading", { name: "Post not found" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    expect(getPosts()).toEqual([]);
  });
  it("rechecks changed post ownership when an existing form is saved", async () => {
    mount("/edit/p1");
    savePosts([{ ...post, authorId: "other" }]);
    await userEvent.setup().click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("heading", { name: "All Blogs" })).toBeVisible();
    expect(getPost("p1")).toEqual({ ...post, authorId: "other" });
  });
  it("reports both initially empty fields inline and leaves posts unchanged", async () => {
    mount();
    await userEvent.setup().click(screen.getByRole("button", { name: "Save" }));
    expect(
      screen.getAllByRole("alert").map((item) => item.textContent),
    ).toEqual(["Title is required.", "Content is required."]);
    expect(getPosts()).toEqual([post]);
  });
  it("redirects a non-owner edit to blogs without exposing form or changing data", () => {
    savePosts([{ ...post, authorId: "other" }]);
    mount("/edit/p1");
    expect(screen.getByRole("heading", { name: "All Blogs" })).toBeVisible();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    expect(getPost("p1").title).toBe(post.title);
  });
  it.each(["/edit", "/edit/missing"])(
    "shows useful missing resource feedback for %s",
    async (path) => {
      mount(path);
      expect(
        screen.getByRole("heading", { name: "Post not found" }),
      ).toBeVisible();
      expect(
        screen.getByRole("heading", { name: "Post not found" }),
      ).toHaveClass("text-slate-900", "dark:text-slate-100");
      expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
      await userEvent
        .setup()
        .click(screen.getByRole("link", { name: "Back to All Posts" }));
      expect(screen.getByRole("heading", { name: "All Blogs" })).toBeVisible();
    },
  );
  it.each(["/write", "/edit/p1"])("rejects guests at %s", (path) => {
    mount(path, null);
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });
  it("reaches real form from list card Edit and returns to the same reader", async () => {
    mount("/blogs");
    const user = userEvent.setup();
    await user.click(screen.getByRole("link", { name: "Edit Original" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Original");
    await user.click(screen.getByRole("link", { name: "Cancel" }));
    expect(screen.getByRole("heading", { name: "Original" })).toBeVisible();
  });
});

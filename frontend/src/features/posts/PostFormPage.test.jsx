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
      await user.type(screen.getByLabelText("Content"), "Updated\nwords");
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

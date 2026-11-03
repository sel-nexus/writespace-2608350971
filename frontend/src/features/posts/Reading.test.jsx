/** Exercise reading components and actual route wiring with real local data. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import App from "../../App.jsx";
import { BUILTIN_ADMIN, setSession } from "../auth/session.js";
import { savePosts, saveUsers } from "./storage.js";
import { BlogCard } from "./BlogCard.jsx";
import BlogListPage from "./BlogListPage.jsx";
import BlogReadPage from "./BlogReadPage.jsx";

const session = {
  userId: "u1",
  username: "mira",
  displayName: "Mira",
  role: "user",
};
const post = {
  id: "p1",
  title: "First thought",
  content: 'First line\n\n<script>alert("unsafe")</script>\nLast line',
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
});

/** Mount the actual reader with a route parameter, including an absent-ID route.
 * Args:
 *   identity: Current candidate session supplied to the reader.
 *   path: Initial reader address.
 * Returns:
 *   Testing Library render result for DOM safety assertions.
 */
function renderReader(identity, path = "/blog/p1") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/blog/:id" element={<BlogReadPage session={identity} />} />
        <Route path="/blog" element={<BlogReadPage session={identity} />} />
        <Route path="/blogs" element={<BlogListPage session={identity} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("BlogCard", () => {
  it("renders exactly the first 120 literal characters, title, author, avatar and UTC date", () => {
    const preview = "<img src=x onerror=alert(1)>" + "x".repeat(160);
    const { container } = render(
      <MemoryRouter>
        <BlogCard
          post={{ ...post, title: "<b>Literal title</b>", content: preview }}
          session={session}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: "<b>Literal title</b>" }),
    ).toBeVisible();
    expect(screen.getByText(preview.slice(0, 120))).toBeVisible();
    expect(screen.queryByText(preview)).not.toBeInTheDocument();
    expect(container.querySelector("img, b")).toBeNull();
    expect(screen.getByText("Mira")).toBeVisible();
    expect(screen.getByRole("img", { name: "Contributor avatar" })).toHaveClass(
      "bg-indigo-500",
    );
    expect(screen.getByText("Mar 04, 2026")).toHaveAttribute(
      "datetime",
      post.createdAt,
    );
  });
  it.each([
    ["owner", session, true],
    ["Admin other", BUILTIN_ADMIN, true],
    ["other contributor", session, false],
    ["guest", null, false],
    ["forged owner", { ...session, role: "admin" }, false],
  ])(
    "shows card Edit for Admin and current authors: %s",
    (label, identity, visible) => {
      const candidate =
        label === "other contributor" ? { ...post, authorId: "other" } : post;
      render(
        <MemoryRouter>
          <BlogCard post={candidate} session={identity} />
        </MemoryRouter>,
      );
      const edit = screen.queryByRole("link", { name: `Edit ${post.title}` });
      if (visible) expect(edit).toHaveAttribute("href", "/edit/p1");
      else expect(edit).not.toBeInTheDocument();
    },
  );
  it("shows an Admin author avatar and Edit for the builtin Admin own card", () => {
    render(
      <MemoryRouter>
        <BlogCard
          post={{ ...post, authorId: "admin", authorName: "Admin" }}
          session={BUILTIN_ADMIN}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("img", { name: "Admin avatar" })).toHaveClass(
      "bg-violet-600",
    );
    expect(
      screen.getByRole("link", { name: `Edit ${post.title}` }),
    ).toBeVisible();
  });
  it.each([0, 1, 2, 3, 4])("cycles top accent at index %i", (index) => {
    render(
      <MemoryRouter>
        <BlogCard post={post} index={index} />
      </MemoryRouter>,
    );
    const accents = [
      "border-indigo-500",
      "border-violet-500",
      "border-pink-500",
      "border-teal-500",
    ];
    expect(screen.getByRole("article")).toHaveClass(
      "border-t-4",
      accents[index % 4],
    );
  });
});

describe("BlogListPage", () => {
  it("lists newest first in the required responsive grid and opens the selected full post", async () => {
    savePosts([
      post,
      {
        ...post,
        id: "p2",
        title: "Newest thought",
        createdAt: "2026-03-05T12:00:00Z",
      },
    ]);
    setSession(session);
    render(
      <MemoryRouter initialEntries={["/blogs"]}>
        <App />
      </MemoryRouter>,
    );
    const grid = screen.getByRole("region", { name: "Blog posts" });
    expect(grid).toHaveClass("grid-cols-1", "md:grid-cols-2", "lg:grid-cols-3");
    expect(
      within(grid)
        .getAllByRole("heading")
        .map((heading) => heading.textContent),
    ).toEqual(["Newest thought", "First thought"]);
    const user = userEvent.setup();
    await user.click(
      within(grid).getByRole("link", { name: /Newest thought First line/ }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Newest thought" }),
    ).toBeVisible();
    await user.click(screen.getByRole("link", { name: "Back to All Posts" }));
    expect(screen.getByRole("region", { name: "Blog posts" })).toBeVisible();
  });
  it.each([session, BUILTIN_ADMIN])(
    "provides specified empty copy and Write CTA for either role",
    (identity) => {
      render(
        <MemoryRouter>
          <BlogListPage session={identity} />
        </MemoryRouter>,
      );
      expect(
        screen.getByText("No blogs yet. Be the first to write one!"),
      ).toBeVisible();
      expect(screen.getByRole("link", { name: "Write" })).toHaveAttribute(
        "href",
        "/write",
      );
      expect(screen.queryByRole("article")).not.toBeInTheDocument();
    },
  );
  it("shows the empty state for corrupt storage without altering it", () => {
    localStorage.setItem("writespace_posts", "broken");
    render(
      <MemoryRouter>
        <BlogListPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByText("No blogs yet. Be the first to write one!"),
    ).toBeVisible();
    expect(localStorage.getItem("writespace_posts")).toBe("broken");
  });
});

describe("BlogReadPage", () => {
  it("renders full literal text, preserves line breaks and displays author/date metadata", () => {
    savePosts([post]);
    const { container } = renderReader(session);
    expect(screen.getByRole("heading", { name: post.title })).toBeVisible();
    const content = screen.getByText(
      (text, element) => element.textContent === post.content,
    );
    expect(content.textContent).toBe(post.content);
    expect(content).toHaveClass("whitespace-pre-wrap");
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("Mira")).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Contributor avatar" }),
    ).toBeVisible();
    expect(screen.getByText("Mar 04, 2026")).toHaveAttribute(
      "datetime",
      post.createdAt,
    );
    expect(screen.getByRole("button", { name: "Delete" })).toBeVisible();
  });
  it.each([
    ["owner", session, "u1", true],
    ["Admin", BUILTIN_ADMIN, "other", true],
    ["other", session, "other", false],
    ["guest", null, "u1", false],
    ["forged role", { ...session, role: "admin" }, "u1", false],
  ])(
    "limits reader Edit by validated owner/Admin rights: %s",
    (label, identity, authorId, visible) => {
      savePosts([{ ...post, authorId }]);
      renderReader(identity);
      const edit = screen.queryByRole("link", { name: "Edit", exact: true });
      if (visible) expect(edit).toHaveAttribute("href", "/edit/p1");
      else expect(edit).not.toBeInTheDocument();
      const remove = screen.queryByRole("button", { name: "Delete" });
      if (visible) expect(remove).toBeVisible();
      else expect(remove).not.toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Back to All Posts" }),
      ).toHaveAttribute("href", "/blogs");
    },
  );
  it("renders a registered Admin author with the stored name and UTC boundary date", () => {
    saveUsers([
      {
        id: "a2",
        username: "editor",
        displayName: "Editor",
        role: "admin",
        password: "demo",
        createdAt: post.createdAt,
      },
    ]);
    savePosts([
      {
        ...post,
        authorId: "a2",
        authorName: "Editor",
        createdAt: "2026-01-01T00:30:00+02:00",
      },
    ]);
    renderReader(BUILTIN_ADMIN);
    expect(screen.getByText("Editor")).toBeVisible();
    expect(screen.getByRole("img", { name: "Admin avatar" })).toHaveClass(
      "bg-violet-600",
    );
    expect(screen.getByText("Dec 31, 2025")).toBeVisible();
  });
  it("retains a deleted author name but removes stale owner controls", () => {
    savePosts([post]);
    saveUsers([]);
    renderReader(session);
    expect(screen.getByText("Mira")).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Contributor avatar" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Edit" }),
    ).not.toBeInTheDocument();
  });
  it.each(["/blog/missing", "/blog"])(
    "handles invalid or absent route ID %s with working back navigation",
    async (path) => {
      savePosts([post]);
      renderReader(session, path);
      expect(
        screen.getByRole("heading", { name: "Post not found" }),
      ).toBeVisible();
      expect(screen.queryByRole("article")).not.toBeInTheDocument();
      await userEvent
        .setup()
        .click(screen.getByRole("link", { name: "Back to All Posts" }));
      expect(screen.getByRole("heading", { name: "All Blogs" })).toBeVisible();
    },
  );
});

describe("reader deletion", () => {
  it("canceled confirmation keeps reader and persisted writing unchanged", async () => {
    savePosts([post]);
    renderReader(session);
    const before = localStorage.getItem("writespace_posts");
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("heading", { name: post.title })).toBeVisible();
    expect(localStorage.getItem("writespace_posts")).toBe(before);
  });
  it.each([session, BUILTIN_ADMIN])(
    "confirmed owner/Admin deletion persists removal and redirects to list",
    async (identity) => {
      savePosts([post, { ...post, id: "p2", title: "Retained" }]);
      renderReader(identity);
      vi.spyOn(window, "confirm").mockReturnValue(true);
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "Delete" }));
      expect(screen.getByRole("heading", { name: "All Blogs" })).toBeVisible();
      expect(screen.getByRole("heading", { name: "Retained" })).toBeVisible();
      expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([
        { ...post, id: "p2", title: "Retained" },
      ]);
    },
  );
  it("surfaces write failure without leaving reader or deleting writing", async () => {
    savePosts([post]);
    renderReader(session);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save");
    expect(screen.getByRole("heading", { name: post.title })).toBeVisible();
    expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([
      post,
    ]);
  });
  it("revalidates session after confirmation before deleting", async () => {
    savePosts([post]);
    renderReader(session);
    vi.spyOn(window, "confirm").mockImplementation(() => {
      saveUsers([]);
      return true;
    });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/session/);
    expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([
      post,
    ]);
  });
  it("shows missing-resource error if post disappears during confirmation", async () => {
    savePosts([post]);
    renderReader(session);
    vi.spyOn(window, "confirm").mockImplementation(() => {
      savePosts([]);
      return true;
    });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Delete" }));
    expect(
      screen.getByRole("heading", { name: "Post not found" }),
    ).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Post not found.");
    expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([]);
  });
});

describe("App reading guards and future destinations", () => {
  it.each(["/blogs", "/blog/p1"])("rejects guest entry to %s", (path) => {
    savePosts([post]);
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
  it.each([
    ["/write", "Write a Post"],
    ["/edit/p1", "Edit Post"],
    ["/edit/missing", "Post not found"],
  ])(
    "wires writing destination %s to real product feedback",
    (path, heading) => {
      savePosts([post]);
      setSession(BUILTIN_ADMIN);
      render(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>,
      );
      expect(screen.getByRole("heading", { name: heading })).toBeVisible();
      if (path !== "/edit/missing") {
        expect(screen.getByLabelText("Title")).toHaveValue(
          path === "/write" ? "" : post.title,
        );
        expect(screen.getByLabelText("Content")).toBeRequired();
      } else
        expect(
          screen.getByRole("link", { name: "Back to All Posts" }),
        ).toBeVisible();
    },
  );
  it.each([["/admin", "Admin Dashboard"], ["/users", "Manage Users"]])(
    "wires authorized admin destination %s to its actual heading",
    (path, heading) => {
      setSession(BUILTIN_ADMIN);
      render(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>,
      );
      expect(
        screen.getByRole("heading", { name: heading }),
      ).toBeVisible();
    },
  );
});

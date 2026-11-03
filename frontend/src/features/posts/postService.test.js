/** Verify real browser-storage queries, date formatting and fail-closed ownership. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { savePosts, saveUsers } from "./storage.js";
import { BUILTIN_ADMIN } from "../auth/session.js";
import {
  createPost,
  updatePost,
  deletePost,
  validatePost,
  canManagePost,
  formatPostDate,
  getAuthorRole,
  getPost,
  getPosts,
} from "./postService.js";

const owner = {
  userId: "u1",
  username: "mira",
  displayName: "Mira",
  role: "user",
};
const post = {
  id: "p1",
  title: "A thought",
  content: "First line\nSecond line",
  authorId: "u1",
  authorName: "Mira",
  createdAt: "2026-03-04T12:00:00.000Z",
};
const account = {
  id: "u1",
  username: "mira",
  displayName: "Mira",
  role: "user",
  password: "demo-only",
  createdAt: post.createdAt,
};
beforeEach(() => saveUsers([account]));

describe("post queries", () => {
  it("sorts timestamps newest first without rewriting storage and retains ties", () => {
    const records = [
      post,
      { ...post, id: "p2", createdAt: "2026-03-05T01:00:00+02:00" },
      { ...post, id: "p3", createdAt: post.createdAt },
      { ...post, id: "p4", createdAt: "2025-01-01T00:00:00Z" },
    ];
    savePosts(records);
    const stored = localStorage.getItem("writespace_posts");
    expect(getPosts().map((item) => item.id)).toEqual(["p2", "p1", "p3", "p4"]);
    expect(localStorage.getItem("writespace_posts")).toBe(stored);
    expect(getPost("p1")).toEqual(post);
  });
  it("reads fresh persistent records on every query", () => {
    savePosts([post]);
    expect(getPost("p1")).toEqual(post);
    savePosts([{ ...post, title: "Changed elsewhere" }]);
    expect(getPost("p1").title).toBe("Changed elsewhere");
  });
  it.each([undefined, null, "", " ", 7, {}, [], "missing", " p1"])(
    "rejects absent or invalid ID %j",
    (id) => {
      savePosts([post]);
      expect(getPost(id)).toBeNull();
    },
  );
  it.each([null, "not-json", "{}", '[{"id":"broken"}]'])(
    "degrades unreadable collection %j to empty",
    (raw) => {
      if (raw !== null) localStorage.setItem("writespace_posts", raw);
      expect(getPosts()).toEqual([]);
      expect(getPost("p1")).toBeNull();
      expect(localStorage.getItem("writespace_posts")).toBe(raw);
    },
  );
});

describe("management rights", () => {
  it("permits a current owner and Admin, but rejects another contributor", () => {
    expect(canManagePost(owner, post)).toBe(true);
    expect(canManagePost(BUILTIN_ADMIN, post)).toBe(true);
    expect(canManagePost(owner, { ...post, authorId: "other" })).toBe(false);
  });
  it("permits a registered Admin to manage another author", () => {
    saveUsers([{ ...account, role: "admin" }]);
    expect(
      canManagePost(
        { ...owner, role: "admin" },
        { ...post, authorId: "other" },
      ),
    ).toBe(true);
  });
  it.each([
    null,
    undefined,
    {},
    [],
    "admin",
    { ...owner, role: "admin" },
    { ...owner, displayName: "Forged" },
    { ...owner, username: "admin" },
    { ...owner, password: "extra" },
    { ...BUILTIN_ADMIN, displayName: "Forged" },
  ])("fails closed for invalid identity %j", (session) => {
    expect(canManagePost(session, post)).toBe(false);
  });
  it.each([
    undefined,
    null,
    {},
    [],
    { authorId: "" },
    { authorId: 1 },
    { authorId: " " },
  ])("rejects missing post authorship %j even for Admin", (candidate) => {
    expect(canManagePost(BUILTIN_ADMIN, candidate)).toBe(false);
  });
  it("rejects a deleted account and stale account identity", () => {
    saveUsers([{ ...account, username: "renamed" }]);
    expect(canManagePost(owner, post)).toBe(false);
    saveUsers([]);
    expect(canManagePost(owner, post)).toBe(false);
  });
});

describe("author metadata", () => {
  it("resolves builtin Admin, current Admin and contributor roles", () => {
    expect(getAuthorRole({ authorId: "admin" })).toBe("admin");
    expect(getAuthorRole(post)).toBe("user");
    saveUsers([{ ...account, role: "admin" }]);
    expect(getAuthorRole(post)).toBe("admin");
  });
  it("keeps unknown or deleted authors as contributors without losing posts", () => {
    savePosts([post]);
    saveUsers([]);
    expect(getAuthorRole(post)).toBe("user");
    expect(getAuthorRole()).toBe("user");
    expect(getPost(post.id)).toEqual(post);
  });
  it("formats padded English dates in UTC across timezone and year boundaries", () => {
    expect(formatPostDate(post.createdAt)).toBe("Mar 04, 2026");
    expect(formatPostDate("2026-01-01T00:30:00+02:00")).toBe("Dec 31, 2025");
  });
  it.each([undefined, null, "", "invalid", 0, {}])(
    "handles invalid timestamp %j",
    (value) => {
      expect(formatPostDate(value)).toBe("Unknown date");
    },
  );
});

describe("post mutations", () => {
  it.each([owner, BUILTIN_ADMIN])(
    "creates the exact model using session authorship and real UUID/time",
    (identity) => {
      savePosts([post]);
      const before = Date.now();
      const created = createPost(
        {
          title: " New title ",
          content: " Literal text\n ",
          authorId: "forged",
          createdAt: "old",
          id: "forged",
        },
        identity,
      );
      expect(created).toEqual({
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
        title: " New title ",
        content: " Literal text\n ",
        createdAt: expect.any(String),
        authorId: identity.userId,
        authorName: identity.displayName,
      });
      expect(Date.parse(created.createdAt)).toBeGreaterThanOrEqual(before);
      expect(Date.parse(created.createdAt)).toBeLessThanOrEqual(Date.now());
      expect(getPost(created.id)).toEqual(created);
      expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([
        post,
        created,
      ]);
    },
  );
  it.each([owner, BUILTIN_ADMIN])(
    "updates only title/content and preserves author and createdAt",
    (identity) => {
      const other = { ...post, id: "p2", authorId: "admin" };
      savePosts([post, other]);
      const updated = updatePost(
        "p1",
        {
          title: "Revised",
          content: "New words",
          id: "changed",
          authorId: "admin",
          authorName: "Wrong",
          createdAt: new Date().toISOString(),
        },
        identity,
      );
      expect(updated).toEqual({
        ...post,
        title: "Revised",
        content: "New words",
      });
      expect(getPost("p1")).toEqual(updated);
      expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([
        updated,
        other,
      ]);
    },
  );
  it.each([owner, BUILTIN_ADMIN])(
    "deletes only the selected post and reads back removal",
    (identity) => {
      const other = { ...post, id: "p2" };
      savePosts([post, other]);
      expect(deletePost("p1", identity)).toEqual(post);
      expect(getPost("p1")).toBeNull();
      expect(getPosts()).toEqual([other]);
      expect(() => deletePost("p1", identity)).toThrow("Post not found");
    },
  );
  it("permits registered Admin mutations on other authors and creation with its own identity", () => {
    saveUsers([{ ...account, role: "admin" }]);
    const admin = { ...owner, role: "admin" };
    savePosts([{ ...post, authorId: "other" }]);
    const created = createPost(
      { title: "Admin writing", content: "Words" },
      admin,
    );
    expect(getPost(created.id).authorId).toBe(admin.userId);
    updatePost("p1", { title: "Correction", content: "Corrected" }, admin);
    expect(getPost("p1").authorId).toBe("other");
    deletePost("p1", admin);
    expect(getPost("p1")).toBeNull();
  });
  it("preserves large literal text, markup and newlines through create and edit", () => {
    const content =
      "<script>alert(1)</script>\n<img src=x onerror=alert(2)>\n" +
      "word ".repeat(20000);
    const created = createPost({ title: "<b>Literal</b>", content }, owner);
    expect(getPost(created.id).content).toBe(content);
    updatePost(
      created.id,
      { title: "<i>Changed</i>", content: content + "\nend" },
      owner,
    );
    expect(getPost(created.id)).toEqual({
      ...created,
      title: "<i>Changed</i>",
      content: content + "\nend",
    });
  });
  for (const field of ["title", "content"]) {
    it.each([undefined, null, "", " \n\t ", 123, false, {}, []])(
      "rejects invalid " +
        field +
        " %j independently on create/edit without saving",
      (value) => {
        savePosts([post]);
        const values = {
          title: "Valid title",
          content: "Valid content",
          [field]: value,
        };
        expect(validatePost(values)).toEqual({
          [field]:
            field === "title" ? "Title is required." : "Content is required.",
        });
        for (const mutate of [
          () => createPost(values, owner),
          () => updatePost("p1", values, owner),
        ]) {
          expect(mutate).toThrow("Please correct");
          try {
            mutate();
          } catch (error) {
            expect(Object.keys(error.errors)).toEqual([field]);
          }
          expect(getPosts()).toEqual([post]);
        }
      },
    );
  }
  it.each([undefined, null, {}, [], "bad", 5])(
    "rejects missing/invalid values container %j",
    (values) => {
      savePosts([post]);
      expect(validatePost(values)).toEqual({
        title: "Title is required.",
        content: "Content is required.",
      });
      expect(() => createPost(values, owner)).toThrow("Please correct");
      expect(() => updatePost("p1", values, owner)).toThrow("Please correct");
      expect(getPosts()).toEqual([post]);
    },
  );
  it.each([undefined, null, "", " ", 7, {}, [], "missing", " p1"])(
    "rejects invalid/missing mutation ID %j",
    (id) => {
      savePosts([post]);
      expect(() =>
        updatePost(id, { title: "New", content: "Words" }, owner),
      ).toThrow("Post not found");
      expect(() => deletePost(id, owner)).toThrow("Post not found");
      expect(getPosts()).toEqual([post]);
    },
  );
  it.each([
    null,
    undefined,
    {},
    [],
    "admin",
    { ...owner, role: "admin" },
    { ...owner, userId: "other" },
    { ...owner, displayName: "Forged" },
    { ...owner, username: "forged" },
    { ...owner, extra: "field" },
    { ...BUILTIN_ADMIN, displayName: "Fake" },
  ])("rejects forged/absent session %j for every mutation", (identity) => {
    savePosts([post]);
    expect(() =>
      createPost({ title: "New", content: "Words" }, identity),
    ).toThrow(/session/);
    expect(() =>
      updatePost("p1", { title: "New", content: "Words" }, identity),
    ).toThrow(/session/);
    expect(() => deletePost("p1", identity)).toThrow(/session/);
    expect(getPosts()).toEqual([post]);
  });
  it.each(["deleted", "renamed", "role changed", "name changed"])(
    "revalidates stale sessions at every mutation: %s",
    (change) => {
      savePosts([post]);
      saveUsers(
        change === "deleted"
          ? []
          : [
              {
                ...account,
                ...(change === "renamed"
                  ? { username: "changed" }
                  : change === "role changed"
                    ? { role: "admin" }
                    : { displayName: "Changed" }),
              },
            ],
      );
      expect(() =>
        createPost({ title: "New", content: "Words" }, owner),
      ).toThrow(/session/);
      expect(() =>
        updatePost("p1", { title: "New", content: "Words" }, owner),
      ).toThrow(/session/);
      expect(() => deletePost("p1", owner)).toThrow(/session/);
      expect(getPosts()).toEqual([post]);
    },
  );
  it("rejects valid nonowners on both mutations without changing the stored post", () => {
    savePosts([{ ...post, authorId: "other" }]);
    const before = localStorage.getItem("writespace_posts");
    expect(() =>
      updatePost("p1", { title: "New", content: "Words" }, owner),
    ).toThrow("only manage your own");
    expect(() => deletePost("p1", owner)).toThrow("only manage your own");
    expect(localStorage.getItem("writespace_posts")).toBe(before);
  });
  it.each(["create", "update", "delete"])(
    "surfaces storage write failure for %s without false success",
    (operation) => {
      savePosts([post]);
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota");
      });
      const mutate =
        operation === "create"
          ? () => createPost({ title: "New", content: "Words" }, owner)
          : operation === "update"
            ? () => updatePost("p1", { title: "New", content: "Words" }, owner)
            : () => deletePost("p1", owner);
      expect(mutate).toThrow(/Could not save/);
      expect(getPosts()).toEqual([post]);
    },
  );
  it.each(["create", "update", "delete"])(
    "rejects silently ignored writes for %s via readback",
    (operation) => {
      savePosts([post]);
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
      const mutate =
        operation === "create"
          ? () => createPost({ title: "New", content: "Words" }, owner)
          : operation === "update"
            ? () => updatePost("p1", { title: "New", content: "Words" }, owner)
            : () => deletePost("p1", owner);
      expect(mutate).toThrow(/verify saved writing/);
      expect(getPosts()).toEqual([post]);
    },
  );
});

/** Verify real storage transitions and active-session boundaries for every admin service action. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ADMIN, setSession } from "../auth/session.js";
import { saveUsers, savePosts } from "../posts/storage.js";
import {
  requireAdmin,
  listUsers,
  getDashboard,
  validateUser,
  createUser,
  deleteUser,
  deleteRecentPost,
} from "./adminService.js";
const values = { displayName: "Mira", username: "mira", password: "demo-only", role: "user" };
const account = { ...values, id: "u1", createdAt: "2026-03-04T12:00:00.000Z" };
const editor = { ...account, id: "a1", username: "editor", displayName: "Editor", role: "admin" };
const editorSession = { userId: "a1", username: "editor", displayName: "Editor", role: "admin" };
const userSession = { userId: "u1", username: "mira", displayName: "Mira", role: "user" };
const post = {
  id: "p1",
  title: "Retain me",
  content: "Writing",
  authorId: "u1",
  authorName: "Mira",
  createdAt: account.createdAt,
};
beforeEach(() => {
  saveUsers([account, editor]);
  setSession(BUILTIN_ADMIN);
});

describe("admin reads and current identity", () => {
  it("includes builtin plus created admins and contributors, strips passwords and limits newest posts", () => {
    const posts = Array.from({ length: 7 }, (_, index) => ({
      ...post,
      id: "p" + index,
      createdAt: "2026-03-0" + (index + 1) + "T12:00:00Z",
    }));
    savePosts(posts);
    expect(requireAdmin(BUILTIN_ADMIN)).toEqual(BUILTIN_ADMIN);
    expect(listUsers(BUILTIN_ADMIN).map((user) => user.id)).toEqual(["admin", "u1", "a1"]);
    expect(listUsers(BUILTIN_ADMIN).every((user) => !("password" in user))).toBe(true);
    expect(getDashboard(BUILTIN_ADMIN)).toEqual({
      totalPosts: 7,
      totalUsers: 3,
      totalAdmins: 2,
      totalContributors: 1,
      recentPosts: posts.slice(2).reverse(),
    });
  });
  it("returns meaningful zeros and permanent builtin for empty or corrupt collections without rewriting", () => {
    localStorage.setItem("writespace_users", "bad");
    localStorage.setItem("writespace_posts", "bad");
    expect(getDashboard(BUILTIN_ADMIN)).toEqual({
      totalPosts: 0,
      totalUsers: 1,
      totalAdmins: 1,
      totalContributors: 0,
      recentPosts: [],
    });
    expect(localStorage.getItem("writespace_users")).toBe("bad");
    expect(localStorage.getItem("writespace_posts")).toBe("bad");
  });
  const actions = [
    requireAdmin,
    listUsers,
    getDashboard,
    (session) => validateUser(values, session),
    (session) => createUser(values, session),
    (session) => deleteUser("u1", session),
    (session) => deleteRecentPost("p1", session),
  ];
  it.each(actions)(
    "rejects missing, wrong role, forged and invalid candidate on every action",
    (action) => {
      savePosts([post]);
      for (const candidate of [
        null,
        {},
        [],
        "admin",
        userSession,
        { ...BUILTIN_ADMIN, role: "user" },
        { ...BUILTIN_ADMIN, displayName: "Fake" },
        { ...BUILTIN_ADMIN, extra: true },
        { ...userSession, role: "admin" },
      ]) {
        expect(() => action(candidate)).toThrow(/session/);
      }
      expect(JSON.parse(localStorage.getItem("writespace_users"))).toEqual([account, editor]);
      expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([post]);
    },
  );
  it.each(actions)("rejects expired and switched active sessions on every action", (action) => {
    localStorage.removeItem("writespace_session");
    expect(() => action(BUILTIN_ADMIN)).toThrow(/expired/);
    setSession(editorSession);
    expect(() => action(BUILTIN_ADMIN)).toThrow(/session/);
    saveUsers([account]);
    expect(() => action(editorSession)).toThrow(/expired/);
  });
  it("rejects forged or unreadable persisted session despite a valid passed identity", () => {
    localStorage.setItem(
      "writespace_session",
      JSON.stringify({ ...BUILTIN_ADMIN, username: "fake" }),
    );
    expect(() => getDashboard(BUILTIN_ADMIN)).toThrow(/session/);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => getDashboard(BUILTIN_ADMIN)).toThrow(/session/);
  });
});

describe("account creation", () => {
  it.each(["admin", "user"])(
    "persists generated %s account, trims names, preserves password and administrator session",
    (role) => {
      const before = localStorage.getItem("writespace_session");
      const created = createUser(
        {
          ...values,
          username: " new ",
          displayName: " New Name ",
          password: " demo ",
          role,
          id: "forged",
          createdAt: "forged",
        },
        BUILTIN_ADMIN,
      );
      expect(created).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        username: "new",
        displayName: "New Name",
        password: " demo ",
        role,
        createdAt: expect.any(String),
      });
      expect(Number.isFinite(Date.parse(created.createdAt))).toBe(true);
      expect(JSON.parse(localStorage.getItem("writespace_users"))).toEqual([
        account,
        editor,
        created,
      ]);
      expect(localStorage.getItem("writespace_session")).toBe(before);
      expect(getDashboard(BUILTIN_ADMIN).totalUsers).toBe(4);
    },
  );
  it.each(["displayName", "username", "password", "role"])(
    "rejects missing field %s without writes",
    (field) => {
      const candidate = { ...values, username: "new" };
      delete candidate[field];
      expect(validateUser(candidate, BUILTIN_ADMIN)[field]).toBeTruthy();
      expect(() => createUser(candidate, BUILTIN_ADMIN)).toThrow(/highlighted/);
      expect(JSON.parse(localStorage.getItem("writespace_users"))).toEqual([account, editor]);
    },
  );
  it.each(["displayName", "username", "password", "role"])(
    "rejects blank and invalid types for %s",
    (field) => {
      for (const invalid of ["", "   ", null, 42, [], {}]) {
        expect(validateUser({ ...values, [field]: invalid }, BUILTIN_ADMIN)[field]).toBeTruthy();
        expect(() => createUser({ ...values, [field]: invalid }, BUILTIN_ADMIN)).toThrow(
          /highlighted/,
        );
      }
    },
  );
  it.each([null, undefined, [], 42, "bad"])("rejects invalid whole input %s", (candidate) => {
    expect(Object.keys(validateUser(candidate, BUILTIN_ADMIN))).toHaveLength(4);
    expect(() => createUser(candidate, BUILTIN_ADMIN)).toThrow(/highlighted/);
  });
  it.each(["Admin", "owner", "USER"])("rejects unsupported role %s", (role) => {
    expect(() => createUser({ ...values, username: "new", role }, BUILTIN_ADMIN)).toThrow(
      /highlighted/,
    );
  });
  it.each(["admin", " ADMIN ", "MIRA", " mira ", "editor"])(
    "rejects reserved/duplicate username %s",
    (username) => {
      expect(validateUser({ ...values, username }, BUILTIN_ADMIN).username).toMatch(
        /reserved|taken/,
      );
      expect(() => createUser({ ...values, username }, BUILTIN_ADMIN)).toThrow(/highlighted/);
      expect(JSON.parse(localStorage.getItem("writespace_users"))).toEqual([account, editor]);
    },
  );
  it("preserves literal long names and does not treat markup as privileged identity", () => {
    const displayName = "<script>alert(1)</script>" + "x".repeat(2000);
    const created = createUser({ ...values, username: "literal", displayName }, BUILTIN_ADMIN);
    expect(JSON.parse(localStorage.getItem("writespace_users")).at(-1).displayName).toBe(
      displayName,
    );
    expect(created.role).toBe("user");
  });
});

describe("account and recent post deletion", () => {
  it.each([account, editor])(
    "removes other-role account $role and retains exact writing, author name and session",
    (target) => {
      const writing = { ...post, authorId: target.id, authorName: target.displayName };
      savePosts([writing]);
      const before = localStorage.getItem("writespace_session");
      expect(deleteUser(target.id, BUILTIN_ADMIN)).toEqual(target);
      expect(JSON.parse(localStorage.getItem("writespace_users"))).toEqual(
        [account, editor].filter((u) => u.id !== target.id),
      );
      expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([writing]);
      expect(localStorage.getItem("writespace_session")).toBe(before);
    },
  );
  it("protects builtin and signed-in created admin and allows another admin to remove a contributor", () => {
    expect(() => deleteUser("admin", BUILTIN_ADMIN)).toThrow("Default admin cannot be deleted.");
    setSession(editorSession);
    expect(() => deleteUser("a1", editorSession)).toThrow(/current account/);
    expect(() => deleteUser("admin", editorSession)).toThrow(/Default admin/);
    deleteUser("u1", editorSession);
    expect(JSON.parse(localStorage.getItem("writespace_users"))).toEqual([editor]);
  });
  it("protects reserved admin aliases in stored data", () => {
    saveUsers([account, { ...editor, username: "ADMIN" }]);
    expect(() => deleteUser("a1", BUILTIN_ADMIN)).toThrow(/Default admin/);
    expect(listUsers(BUILTIN_ADMIN)).toHaveLength(2);
  });
  it.each([null, undefined, [], {}, 42, "", "  ", "missing", " u1 "])(
    "rejects invalid or nonexistent deletion identity %s",
    (id) => {
      expect(() => deleteUser(id, BUILTIN_ADMIN)).toThrow(/existing|not found/);
      expect(JSON.parse(localStorage.getItem("writespace_users"))).toEqual([account, editor]);
    },
  );
  it("delegates other-author post deletion and verifies persisted removal and counters", () => {
    savePosts([post]);
    expect(deleteRecentPost("p1", BUILTIN_ADMIN)).toEqual(post);
    expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([]);
    expect(getDashboard(BUILTIN_ADMIN).totalPosts).toBe(0);
    expect(() => deleteRecentPost("missing", BUILTIN_ADMIN)).toThrow(/Post not found/);
  });
  it.each([null, {}, 42, "", "  "])("rejects invalid recent post identity %s", (id) => {
    savePosts([post]);
    expect(() => deleteRecentPost(id, BUILTIN_ADMIN)).toThrow(/Post not found/);
    expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([post]);
  });
  it.each(["create", "delete", "post"])(
    "reports write denial on %s without false success",
    (action) => {
      savePosts([post]);
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota");
      });
      const operation =
        action === "create"
          ? () => createUser({ ...values, username: "new" }, BUILTIN_ADMIN)
          : action === "delete"
            ? () => deleteUser("u1", BUILTIN_ADMIN)
            : () => deleteRecentPost("p1", BUILTIN_ADMIN);
      expect(operation).toThrow(/Could not save/);
      expect(JSON.parse(localStorage.getItem("writespace_users"))).toEqual([account, editor]);
      expect(JSON.parse(localStorage.getItem("writespace_posts"))).toEqual([post]);
    },
  );
  it.each(["create", "delete"])(
    "rejects silent unsuccessful %s writes via actual readback",
    (action) => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
      expect(
        action === "create"
          ? () => createUser({ ...values, username: "new" }, BUILTIN_ADMIN)
          : () => deleteUser("u1", BUILTIN_ADMIN),
      ).toThrow(/verify saved accounts/);
      expect(JSON.parse(localStorage.getItem("writespace_users"))).toEqual([account, editor]);
    },
  );
  it("reports account readback denial after write", () => {
    const write = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      write.call(this, key, value);
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("read denied");
      });
    });
    expect(() => createUser({ ...values, username: "new" }, BUILTIN_ADMIN)).toThrow(
      /verify saved accounts/,
    );
    vi.restoreAllMocks();
    expect(JSON.parse(localStorage.getItem("writespace_users"))).toHaveLength(3);
  });
});

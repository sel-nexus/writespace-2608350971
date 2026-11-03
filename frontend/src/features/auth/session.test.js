/** Verify fail-closed current identity and honest persistence failures. */
import { describe, it, expect, vi } from 'vitest';
import { saveUsers } from '../posts/storage.js';
import {
  BUILTIN_ADMIN,
  SESSION_KEY,
  isValidSession,
  getSession,
  setSession,
  clearSession,
} from './session.js';
const account = {
  id: 'u1',
  username: 'mira',
  displayName: 'Mira',
  password: 'demo',
  role: 'user',
  createdAt: '2026-03-04T12:00:00.000Z',
};
const identity = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };

describe('local session identity', () => {
  it('persists builtin identity with no password and clears it idempotently', () => {
    setSession(BUILTIN_ADMIN);
    expect(JSON.parse(localStorage.getItem(SESSION_KEY))).toEqual(BUILTIN_ADMIN);
    expect(getSession()).toEqual(BUILTIN_ADMIN);
    clearSession();
    clearSession();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(getSession()).toBeNull();
  });
  it.each(['user', 'admin'])(
    'persists a current registered %s then rejects a deleted identity',
    (role) => {
      saveUsers([{ ...account, role }]);
      const session = { ...identity, role };
      setSession(session);
      expect(getSession()).toEqual(session);
      saveUsers([]);
      expect(getSession()).toBeNull();
      expect(() => setSession(session)).toThrow(/invalid or deleted/);
    },
  );
  it.each([
    null,
    [],
    {},
    'admin',
    1,
    true,
    { ...BUILTIN_ADMIN, password: 'admin' },
    { ...BUILTIN_ADMIN, role: 'Admin' },
    { ...BUILTIN_ADMIN, displayName: 'Fake' },
    { ...BUILTIN_ADMIN, userId: 'other' },
    { ...identity, username: 'admin' },
  ])('rejects malformed or spoofed candidate %j', (value) => {
    expect(isValidSession(value)).toBe(false);
    localStorage.setItem(SESSION_KEY, JSON.stringify(value));
    expect(getSession()).toBeNull();
    expect(() => setSession(value)).toThrow(/invalid/);
  });
  it.each(['userId', 'username', 'displayName', 'role'])(
    'rejects missing, blank and wrong-type %s',
    (field) => {
      saveUsers([account]);
      for (const value of [undefined, '', ' ', 2, {}, null])
        expect(isValidSession({ ...identity, [field]: value })).toBe(false);
    },
  );
  it.each(['userId', 'username', 'displayName', 'role'])(
    'rejects a mismatching current %s',
    (field) => {
      saveUsers([account]);
      expect(isValidSession({ ...identity, [field]: field === 'role' ? 'admin' : 'other' })).toBe(
        false,
      );
    },
  );
  it('leaves corrupt session untouched and handles unreadable storage', () => {
    localStorage.setItem(SESSION_KEY, '{bad');
    expect(getSession()).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBe('{bad');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(getSession()).toBeNull();
  });
  it('rejects registered identity when users are malformed or unavailable', () => {
    localStorage.setItem('writespace_users', '{bad');
    expect(isValidSession(identity)).toBe(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(isValidSession(identity)).toBe(false);
    expect(isValidSession(BUILTIN_ADMIN)).toBe(true);
  });
  it('reports denied session writes', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => setSession(BUILTIN_ADMIN)).toThrow(/Could not save your session/);
    expect(getSession()).toBeNull();
  });
  it('reports silently unsuccessful writes/readback', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    expect(() => setSession(BUILTIN_ADMIN)).toThrow(/not signed in/);
    expect(getSession()).toBeNull();
  });
  it('reports denied removals without claiming success', () => {
    setSession(BUILTIN_ADMIN);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => clearSession()).toThrow(/Could not log out/);
    expect(getSession()).toEqual(BUILTIN_ADMIN);
  });
  it('reports silently unsuccessful removals', () => {
    setSession(BUILTIN_ADMIN);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {});
    expect(() => clearSession()).toThrow(/Could not log out/);
  });
  it('reports unavailable storage for set and clear', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(getSession()).toBeNull();
    expect(() => setSession(BUILTIN_ADMIN)).toThrow(/Could not save/);
    expect(() => clearSession()).toThrow(/Could not log out/);
  });
});

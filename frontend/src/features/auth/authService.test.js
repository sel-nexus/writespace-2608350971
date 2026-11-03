/** Exercise credential, validation and persistence branches with actual local records. */
import { describe, it, expect, vi } from 'vitest';
import { getUsers, saveUsers } from '../posts/storage.js';
import { BUILTIN_ADMIN, SESSION_KEY, getSession } from './session.js';
import {
  login,
  register,
  roleHome,
  validateUsername,
  validateRegistration,
} from './authService.js';
const values = {
  displayName: ' Mira ',
  username: ' mira ',
  password: 'demo pass',
  confirmPassword: 'demo pass',
};
const account = {
  id: 'u1',
  displayName: 'Mira',
  username: 'mira',
  password: 'demo pass',
  role: 'user',
  createdAt: '2026-03-04T12:00:00.000Z',
};

describe('local account entry', () => {
  it('checks builtin admin first even with a conflicting stored account', () => {
    saveUsers([{ ...account, username: 'admin', password: 'other' }]);
    expect(login('admin', 'admin')).toEqual(BUILTIN_ADMIN);
    expect(getSession()).toEqual(BUILTIN_ADMIN);
    expect(() => login('admin', 'other')).toThrow('Invalid username or password.');
  });
  it.each(['user', 'admin'])('logs in a stored %s and selects its home', (role) => {
    saveUsers([{ ...account, role }]);
    const session = login(' mira ', 'demo pass');
    expect(session).toEqual({ userId: 'u1', displayName: 'Mira', username: 'mira', role });
    expect(getSession()).toEqual(session);
    expect(roleHome(session)).toBe(role === 'admin' ? '/admin' : '/blogs');
  });
  it.each([null, {}, { role: 'Admin' }, { role: 'toString' }])(
    'routes unsupported identity %j to login',
    (session) => {
      expect(roleHome(session)).toBe('/login');
    },
  );
  it.each([
    ['admin', 'wrong'],
    ['missing', 'demo'],
    ['', 'admin'],
    ['admin', ''],
    [null, 'admin'],
    ['admin', 5],
    [{}, []],
    [' ', ' '],
  ])('rejects invalid credentials %j / %j exactly', (username, password) => {
    expect(() => login(username, password)).toThrow('Invalid username or password.');
    expect(getSession()).toBeNull();
  });
  it('does not authenticate malformed user storage', () => {
    localStorage.setItem('writespace_users', '{bad');
    expect(() => login('mira', 'demo pass')).toThrow('Invalid username or password.');
  });
  it('reports session quota failure without returning success', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => login('admin', 'admin')).toThrow(/Could not save your session/);
    expect(getSession()).toBeNull();
  });
  it('registers with UUID, timestamp, plaintext password and user role regardless of input', () => {
    const session = register({ ...values, role: 'admin' });
    const users = getUsers();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      displayName: 'Mira',
      username: 'mira',
      password: 'demo pass',
      role: 'user',
    });
    expect(users[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isFinite(Date.parse(users[0].createdAt))).toBe(true);
    expect(session).toEqual({
      userId: users[0].id,
      username: 'mira',
      displayName: 'Mira',
      role: 'user',
    });
    expect(getSession()).toEqual(session);
    expect(JSON.parse(localStorage.getItem('writespace_users'))).toEqual(users);
  });
  it.each(['displayName', 'username', 'password', 'confirmPassword'])(
    'validates required %s individually with invalid types',
    (field) => {
      for (const invalid of [undefined, null, '', ' ', 5, {}, []]) {
        const input = { ...values, [field]: invalid };
        expect(Object.keys(validateRegistration(input))).toEqual([field]);
        expect(() => register(input)).toThrow(/correct/);
        expect(getUsers()).toEqual([]);
      }
    },
  );
  it.each([undefined, null, 2, [], 'bad'])('rejects invalid registration container %j', (input) => {
    expect(Object.keys(validateRegistration(input))).toHaveLength(4);
    expect(() => register(input)).toThrow(/correct/);
  });
  it('rejects password mismatch without writing', () => {
    expect(validateRegistration({ ...values, confirmPassword: 'other' })).toEqual({
      confirmPassword: 'Passwords must match.',
    });
    expect(() => register({ ...values, confirmPassword: 'other' })).toThrow(/correct/);
    expect(getUsers()).toEqual([]);
  });
  it.each(['admin', ' ADMIN '])('rejects reserved username %s', (username) => {
    expect(validateUsername(username)).toBe('The admin username is reserved.');
    expect(() => register({ ...values, username })).toThrow(/correct/);
  });
  it('rejects duplicate usernames ignoring case and whitespace, accepts available username', () => {
    saveUsers([account]);
    expect(validateUsername(' MIRA ')).toBe('Username is already taken.');
    expect(() => register(values)).toThrow(/correct/);
    expect(getUsers()).toEqual([account]);
    expect(validateUsername('another')).toBe('');
    expect(validateRegistration({ ...values, username: 'another' })).toEqual({});
  });
  it.each([undefined, null, 3, {}, [], '', ' '])('rejects invalid username %j', (username) => {
    expect(validateUsername(username)).toBe('Username is required.');
  });
  it('retains previous users when account write fails', () => {
    saveUsers([account]);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => register({ ...values, username: 'new' })).toThrow(
      /Could not save writespace_users/,
    );
    expect(getUsers()).toEqual([account]);
    expect(getSession()).toBeNull();
  });
  it('rolls back the new user if only session persistence fails', () => {
    saveUsers([account]);
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === SESSION_KEY) throw new Error('denied');
      return original.call(this, key, value);
    });
    expect(() => register({ ...values, username: 'new' })).toThrow(/Could not save your session/);
    expect(getUsers()).toEqual([account]);
    expect(getSession()).toBeNull();
  });
  it('reports saved account explicitly when rollback also fails', () => {
    const original = Storage.prototype.setItem;
    let count = 0;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      count += 1;
      if (count > 1) throw new Error('denied');
      return original.call(this, key, value);
    });
    expect(() => register(values)).toThrow(/account was saved, but sign-in failed/);
    expect(getUsers()).toHaveLength(1);
    expect(getSession()).toBeNull();
  });
});

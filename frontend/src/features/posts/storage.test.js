/** Specify model validation, graceful recovery and durable browser-local writes. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPosts, savePosts, getUsers, saveUsers } from './storage.js';

const post = {
  id: 'post-1', title: 'A local thought', content: 'Words\n<script>literal text</script>',
  createdAt: '2026-03-04T12:00:00.000Z', authorId: 'writer-1', authorName: 'Mira',
};
const account = {
  id: 'writer-1', displayName: 'Mira', username: 'mira', password: 'demo-only',
  role: 'user', createdAt: '2026-03-04T12:00:00.000Z',
};

beforeEach(() => localStorage.clear());

describe.each([
  ['posts', 'writespace_posts', getPosts, savePosts, post],
  ['users', 'writespace_users', getUsers, saveUsers, account],
])('%s browser storage', (_name, key, read, save, record) => {
  it('returns an empty collection when the key is absent', () => {
    expect(read()).toEqual([]);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('saves, rereads, replaces and clears real persisted records', () => {
    save([record]);
    expect(JSON.parse(localStorage.getItem(key))).toEqual([record]);
    expect(read()).toEqual([record]);
    const changed = { ...record, id: 'replacement' };
    save([changed]);
    expect(read()).toEqual([changed]);
    save([]);
    expect(localStorage.getItem(key)).toBe('[]');
    expect(read()).toEqual([]);
  });

  it('does not mutate caller records or return a live reference', () => {
    const collection = [Object.freeze({ ...record })];
    save(Object.freeze(collection));
    const retrieved = read();
    retrieved[0].id = 'changed-in-memory';
    expect(read()).toEqual([record]);
  });

  it.each(['{broken', 'null', '{}', '"string"', '42', 'true', '[null]', '[[]]'])('degrades %s to empty without destroying the original data', (raw) => {
    localStorage.setItem(key, raw);
    expect(read()).toEqual([]);
    expect(localStorage.getItem(key)).toBe(raw);
  });

  it('returns empty on getItem failure', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Access denied'); });
    expect(read()).toEqual([]);
  });

  it('returns empty on unavailable localStorage and throws actionable writes', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(read()).toEqual([]);
    expect(() => save([record])).toThrow(/Enable browser storage.*retry/);
  });

  it('returns empty when access to the localStorage property throws', () => {
    vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => { throw new Error('SecurityError'); });
    expect(read()).toEqual([]);
    expect(() => save([record])).toThrow(/Your changes were not saved/);
  });

  it('throws on quota failure and leaves earlier data intact', () => {
    save([record]);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    expect(() => save([{ ...record, id: 'new' }])).toThrow(/free local space.*not saved/);
    expect(read()).toEqual([record]);
  });

  it.each([null, {}, 'bad', 2, [null], [[]]])('rejects an invalid collection without replacing existing data: %j', (invalid) => {
    save([record]);
    expect(() => save(invalid)).toThrow(/complete records/);
    expect(read()).toEqual([record]);
  });

  for (const field of Object.keys(record)) {
    it.each([undefined, null, 12, {}, '', '   '])(`rejects invalid ${field}: %j on both read and write`, (value) => {
      const invalid = { ...record, [field]: value };
      const raw = JSON.stringify([invalid]);
      localStorage.setItem(key, raw);
      expect(read()).toEqual([]);
      expect(() => save([invalid])).toThrow(/Cannot save/);
      expect(localStorage.getItem(key)).toBe(raw);
    });
  }

  it.each(['not-a-date', '2026-99-99'])('rejects invalid dates on reads and writes: %s', (createdAt) => {
    const invalid = { ...record, createdAt };
    localStorage.setItem(key, JSON.stringify([invalid]));
    expect(read()).toEqual([]);
    expect(() => save([invalid])).toThrow(/valid dates/);
  });

  it('rejects duplicate IDs without silently filtering records', () => {
    const duplicates = [record, { ...record }];
    localStorage.setItem(key, JSON.stringify(duplicates));
    expect(read()).toEqual([]);
    expect(() => save(duplicates)).toThrow(/unique IDs/);
  });

  it('treats a mixed valid/invalid collection as corrupt without deleting data', () => {
    const raw = JSON.stringify([record, { ...record, id: 'bad', createdAt: 'invalid' }]);
    localStorage.setItem(key, raw);
    expect(read()).toEqual([]);
    expect(() => save(JSON.parse(raw))).toThrow(/Cannot save/);
    expect(localStorage.getItem(key)).toBe(raw);
  });

  it('reports circular serialization failure without replacing prior records', () => {
    save([record]);
    const circular = { ...record };
    circular.extra = circular;
    expect(() => save([circular])).toThrow(/not saved/);
    expect(read()).toEqual([record]);
  });

  it('rejects a toJSON override that would persist invalid records', () => {
    save([record]);
    const transformed = { ...record, toJSON: () => ({ id: 'incomplete' }) };
    expect(() => save([transformed])).toThrow(/not saved/);
    expect(read()).toEqual([record]);
  });
});

describe('post and account model boundaries', () => {
  it.each(['admin', 'user'])('persists the lowercase %s role', (role) => {
    saveUsers([{ ...account, role }]);
    expect(getUsers()[0].role).toBe(role);
  });
  it.each(['Admin', 'guest', 'owner'])('rejects unsupported role %s on reads and writes', (role) => {
    localStorage.setItem('writespace_users', JSON.stringify([{ ...account, role }]));
    expect(getUsers()).toEqual([]);
    expect(() => saveUsers([{ ...account, role }])).toThrow(/roles/);
  });
  it('keeps the two collections isolated and retains plaintext without logging it', () => {
    saveUsers([account]);
    savePosts([post]);
    expect(getUsers()).toEqual([account]);
    expect(getPosts()).toEqual([post]);
    savePosts([]);
    expect(getUsers()).toEqual([account]);
    expect(getPosts()).toEqual([]);
  });
});

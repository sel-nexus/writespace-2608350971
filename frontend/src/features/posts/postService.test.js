/** Verify real browser-storage queries, date formatting and fail-closed ownership. */
import { beforeEach, describe, expect, it } from 'vitest';
import { savePosts, saveUsers } from './storage.js';
import { BUILTIN_ADMIN } from '../auth/session.js';
import { canManagePost, formatPostDate, getAuthorRole, getPost, getPosts } from './postService.js';

const owner = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };
const post = {
  id: 'p1', title: 'A thought', content: 'First line\nSecond line',
  authorId: 'u1', authorName: 'Mira', createdAt: '2026-03-04T12:00:00.000Z',
};
const account = {
  id: 'u1', username: 'mira', displayName: 'Mira', role: 'user',
  password: 'demo-only', createdAt: post.createdAt,
};
beforeEach(() => saveUsers([account]));

describe('post queries', () => {
  it('sorts timestamps newest first without rewriting storage and retains ties', () => {
    const records = [
      post,
      { ...post, id: 'p2', createdAt: '2026-03-05T01:00:00+02:00' },
      { ...post, id: 'p3', createdAt: post.createdAt },
      { ...post, id: 'p4', createdAt: '2025-01-01T00:00:00Z' },
    ];
    savePosts(records);
    const stored = localStorage.getItem('writespace_posts');
    expect(getPosts().map((item) => item.id)).toEqual(['p2', 'p1', 'p3', 'p4']);
    expect(localStorage.getItem('writespace_posts')).toBe(stored);
    expect(getPost('p1')).toEqual(post);
  });
  it('reads fresh persistent records on every query', () => {
    savePosts([post]);
    expect(getPost('p1')).toEqual(post);
    savePosts([{ ...post, title: 'Changed elsewhere' }]);
    expect(getPost('p1').title).toBe('Changed elsewhere');
  });
  it.each([undefined, null, '', ' ', 7, {}, [], 'missing', ' p1'])('rejects absent or invalid ID %j', (id) => {
    savePosts([post]);
    expect(getPost(id)).toBeNull();
  });
  it.each([null, 'not-json', '{}', '[{"id":"broken"}]'])('degrades unreadable collection %j to empty', (raw) => {
    if (raw !== null) localStorage.setItem('writespace_posts', raw);
    expect(getPosts()).toEqual([]);
    expect(getPost('p1')).toBeNull();
    expect(localStorage.getItem('writespace_posts')).toBe(raw);
  });
});

describe('management rights', () => {
  it('permits a current owner and Admin, but rejects another contributor', () => {
    expect(canManagePost(owner, post)).toBe(true);
    expect(canManagePost(BUILTIN_ADMIN, post)).toBe(true);
    expect(canManagePost(owner, { ...post, authorId: 'other' })).toBe(false);
  });
  it('permits a registered Admin to manage another author', () => {
    saveUsers([{ ...account, role: 'admin' }]);
    expect(canManagePost({ ...owner, role: 'admin' }, { ...post, authorId: 'other' })).toBe(true);
  });
  it.each([
    null, undefined, {}, [], 'admin',
    { ...owner, role: 'admin' }, { ...owner, displayName: 'Forged' },
    { ...owner, username: 'admin' }, { ...owner, password: 'extra' },
    { ...BUILTIN_ADMIN, displayName: 'Forged' },
  ])('fails closed for invalid identity %j', (session) => {
    expect(canManagePost(session, post)).toBe(false);
  });
  it.each([undefined, null, {}, [], { authorId: '' }, { authorId: 1 }, { authorId: ' ' }])(
    'rejects missing post authorship %j even for Admin', (candidate) => {
      expect(canManagePost(BUILTIN_ADMIN, candidate)).toBe(false);
    },
  );
  it('rejects a deleted account and stale account identity', () => {
    saveUsers([{ ...account, username: 'renamed' }]);
    expect(canManagePost(owner, post)).toBe(false);
    saveUsers([]);
    expect(canManagePost(owner, post)).toBe(false);
  });
});

describe('author metadata', () => {
  it('resolves builtin Admin, current Admin and contributor roles', () => {
    expect(getAuthorRole({ authorId: 'admin' })).toBe('admin');
    expect(getAuthorRole(post)).toBe('user');
    saveUsers([{ ...account, role: 'admin' }]);
    expect(getAuthorRole(post)).toBe('admin');
  });
  it('keeps unknown or deleted authors as contributors without losing posts', () => {
    savePosts([post]);
    saveUsers([]);
    expect(getAuthorRole(post)).toBe('user');
    expect(getAuthorRole()).toBe('user');
    expect(getPost(post.id)).toEqual(post);
  });
  it('formats padded English dates in UTC across timezone and year boundaries', () => {
    expect(formatPostDate(post.createdAt)).toBe('Mar 04, 2026');
    expect(formatPostDate('2026-01-01T00:30:00+02:00')).toBe('Dec 31, 2025');
  });
  it.each([undefined, null, '', 'invalid', 0, {}])('handles invalid timestamp %j', (value) => {
    expect(formatPostDate(value)).toBe('Unknown date');
  });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentSchema } from '../lib/schema.ts';
import { initial, skills } from '../lib/seed.ts';
import { searchContent } from '../lib/search.ts';
import { postMatches, activityPosts } from '../lib/activity.ts';
import { uploadMime } from '../lib/upload-client.ts';

test('Activity orders publication timestamps newest first and keeps drafts, hidden and scheduled entries separate', () => {
  const data = contentSchema.parse({
    ...initial,
    skills,
    posts: [
      { id: 'old', title: 'Old', visibility: 'public', createdAt: '2026-10-01T00:00:00Z' },
      { id: 'draft', title: 'Draft', visibility: 'draft', createdAt: '2026-10-11T10:00:00Z' },
      {
        id: 'new',
        title: 'New',
        visibility: 'public',
        createdAt: '2026-10-02T00:00:00Z',
        displayAt: '2026-10-11T09:00:00Z',
        type: 'Media',
      },
      { id: 'future', title: 'Scheduled', visibility: 'public', displayAt: '2026-10-12T09:00:00Z' },
      { id: 'hidden', title: 'Hidden', visibility: 'public', visible: false },
      { id: 'undated', title: 'Undated', visibility: 'public' },
    ],
  });
  const now = Date.parse('2026-10-11T12:00:00Z');
  assert.deepEqual(
    activityPosts(data.posts, 'public', 'all', now).map((p) => p.id),
    ['new', 'old', 'undated'],
  );
  assert.deepEqual(
    activityPosts(data.posts, 'draft', 'all', now).map((p) => p.id),
    ['draft'],
  );
  assert.deepEqual(
    activityPosts(data.posts, 'scheduled', 'all', now).map((p) => p.id),
    ['future'],
  );
  assert.deepEqual(
    activityPosts(data.posts, 'hidden', 'all', now).map((p) => p.id),
    ['hidden'],
  );
  assert.deepEqual(
    activityPosts(data.posts, 'public', 'Media', now).map((p) => p.id),
    ['new'],
  );
  assert.equal(data.posts[0].id, 'old', 'sorting does not mutate stored order');
});

test('Search finds related fields across words and accents without exposing private entries', () => {
  const data = contentSchema.parse({
    ...initial,
    skills,
    projects: [
      {
        id: 'live',
        name: 'Đồng hồ',
        role: 'Kỹ sư',
        details: 'SQLite desktop',
        visibility: 'public',
      },
      { id: 'draft', name: 'secret', visibility: 'draft' },
      { id: 'hidden', name: 'secret', visible: false },
      { id: 'future', name: 'secret', displayAt: '2099-01-01T00:00:00Z' },
    ],
    posts: [
      {
        id: 'rich',
        title: 'News',
        visibility: 'public',
        richText: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Kiến trúc độc đáo', marks: [{ type: 'bold' }] }],
            },
          ],
        }),
      },
    ],
    links: { email: 'example@example.com' },
  });
  assert.deepEqual(
    searchContent(data, 'sqlite dong ho ky su').projects.map((p) => p.id),
    ['live'],
  );
  assert.equal(searchContent(data, 'secret').projects.length, 0);
  assert.equal(searchContent(data, 'kien truc').posts.length, 1);
  assert.equal(searchContent(data, 'example mail').links.length, 1);
  assert.equal(searchContent(data, '   ').projects.length, 0);
});

test('Activity filters include embedded media and links and retain explicit categories', () => {
  const post = contentSchema.parse({
    ...initial,
    skills,
    posts: [
      {
        id: 'rich',
        title: 'Embedded content',
        type: 'Bài viết',
        richText: JSON.stringify({
          type: 'doc',
          content: [
            { type: 'image', attrs: { src: 'https://example.com/image.png' } },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Source',
                  marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
                },
              ],
            },
          ],
        }),
      },
    ],
  }).posts[0];
  assert.equal(postMatches(post, 'Media'), true);
  assert.equal(postMatches(post, 'Liên kết'), true);
  assert.equal(postMatches(post, 'Bài viết'), true);
  assert.equal(postMatches(post, 'Cập nhật dự án'), false);
  assert.equal(
    postMatches({ ...post, richText: '', type: 'Cập nhật dự án' }, 'Cập nhật dự án'),
    true,
  );
});

test('CV upload accepts valid PDF with missing MIME and rejects invalid or oversized files early', async () => {
  assert.equal(await uploadMime(new File(['%PDF-1.7\n'], 'Resume.PDF')), 'application/pdf');
  await assert.rejects(uploadMime(new File(['not a pdf'], 'Resume.pdf')), /Invalid PDF/);
  await assert.rejects(
    uploadMime(new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'Resume.pdf')),
    /20 MB/,
  );
});

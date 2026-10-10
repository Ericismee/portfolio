import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentSchema, publicationStatus, publicContent } from '../lib/schema.ts';
import { initial, skills } from '../lib/seed.ts';
import { prepareLegacyImport } from '../lib/client.ts';

test('Publication labels, filters and public pages agree on drafts, hidden entries and schedules', () => {
  const now = Date.parse('2026-10-10T12:00:00Z');
  const live = { visible: true, visibility: 'public' };
  assert.equal(publicationStatus(live, now), 'public');
  assert.equal(publicationStatus({ ...live, visibility: 'draft' }, now), 'draft');
  assert.equal(publicationStatus({ ...live, visible: false }, now), 'hidden');
  assert.equal(publicationStatus({ ...live, displayAt: '2026-10-10T12:00:01Z' }, now), 'scheduled');
  assert.equal(publicationStatus({ ...live, displayAt: '2026-10-10T12:00:00Z' }, now), 'public');
  const data = contentSchema.parse({
    ...initial,
    skills,
    projects: [
      { id: 'published', name: 'Published project', status: 'Bản nháp', ...live },
      { id: 'draft', name: 'Draft project', visible: true, visibility: 'draft' },
    ],
    posts: [
      { id: 'later', title: 'Later', ...live, displayAt: '2026-10-10T12:00:01Z' },
      { id: 'hidden', title: 'Hidden', ...live, visible: false },
      { id: 'now', title: 'Now', ...live, displayAt: '2026-10-10T12:00:00Z' },
    ],
  });
  const visible = publicContent(data, now);
  assert.deepEqual(
    visible.projects.map((p) => p.id),
    ['published'],
    'Explicit publishing overrides the descriptive project status',
  );
  assert.deepEqual(
    visible.posts.map((p) => p.id),
    ['now'],
  );
  assert.deepEqual(
    publicContent(data, now + 1000).posts.map((p) => p.id),
    ['later', 'now'],
  );
  assert.equal(data.posts.length, 3, 'Public filtering never mutates the authored data');
});

test('Backup import retains publication choices and migrates legacy drafts without losing profile data', () => {
  const legacy = {
    ...initial,
    skills,
    projects: [
      { id: 'legacy', name: 'Legacy draft', status: 'Bản nháp' },
      { id: 'explicit', name: 'Explicitly published', status: 'Bản nháp', visibility: 'public' },
    ],
    posts: [
      { id: 'sample', title: 'Example', sample: true },
      { id: 'authored', title: 'Authored post', sample: false },
    ],
  };
  const migrated = contentSchema.parse(prepareLegacyImport({ data: legacy }));
  assert.equal(migrated.projects[0].visibility, 'draft');
  assert.equal(migrated.projects[1].visibility, 'public');
  assert.equal(migrated.posts[0].visibility, 'draft');
  assert.equal(migrated.posts[1].visibility, 'public');
  assert.deepEqual(
    contentSchema.parse(prepareLegacyImport(JSON.parse(JSON.stringify(migrated)))),
    migrated,
  );
  assert.equal(migrated.profile.name, initial.profile.name);
  assert.deepEqual(migrated.skills, skills);
});

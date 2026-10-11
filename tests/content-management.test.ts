import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase, HttpError } from '../lib/database.ts';
import {
  contentSchema,
  projectSchema,
  postSchema,
  itemSchema,
  publicContent,
} from '../lib/schema.ts';
import { initial, skills } from '../lib/seed.ts';
import { duplicateContent, repositoryIdentity, trashEntry } from '../lib/content-management.ts';
const content = () => contentSchema.parse({ ...initial, skills });

test('Duplicate detection normalizes names and repository URLs while allowing distinct updates for the same project', () => {
  const before = content(),
    next = structuredClone(before);
  next.projects = [
    projectSchema.parse({ id: 'one', name: 'One', github: 'https://github.com/Owner/Repo' }),
  ];
  const previous = structuredClone(next);
  next.projects.push(
    projectSchema.parse({ id: 'two', name: 'Two', github: 'https://github.com/owner/repo.git/' }),
  );
  assert.equal(duplicateContent(next, previous), 'project');
  assert.equal(repositoryIdentity('https://github.com/Owner/Repo.git/'), '/owner/repo');
  next.projects = previous.projects;
  next.skills = ['TypeScript', ' typescript '];
  assert.equal(duplicateContent(next, before), 'skill');
  next.skills = before.skills;
  next.posts = [
    postSchema.parse({
      id: 'a',
      title: 'Update',
      text: 'First',
      link: 'https://github.com/owner/repo',
    }),
    postSchema.parse({
      id: 'b',
      title: 'Update',
      text: 'Second',
      link: 'https://github.com/owner/repo',
    }),
  ];
  assert.equal(duplicateContent(next, before), null);
  next.posts[1].text = 'First';
  assert.equal(duplicateContent(next, before), 'post');
  assert.equal(duplicateContent(next, structuredClone(next)), null);
});

test('Rejected duplicate writes preserve the current version and do not add revisions', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'profile-duplicates-'));
  const database = openDatabase(directory);
  try {
    const state = database.read();
    const revisions = database.db.prepare('SELECT count(*) AS n FROM revisions').get();
    state.data.skills.push(state.data.skills[0].toUpperCase());
    assert.throws(
      () => database.write(state.data, state.version),
      (error) =>
        error instanceof HttpError && error.status === 400 && /already exists/.test(error.message),
    );
    assert.equal(database.read().version, state.version);
    assert.deepEqual(database.db.prepare('SELECT count(*) AS n FROM revisions').get(), revisions);
  } finally {
    database.db.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('Hidden skills and hidden skill sections are removed from public JSON without changing administrator data', () => {
  const data = content();
  data.skills = ['Public technology', 'Private technology'];
  data.hiddenSkills = ['Private technology'];
  assert.deepEqual(publicContent(data).skills, ['Public technology']);
  assert.deepEqual(publicContent(data).hiddenSkills, []);
  data.hidden.push('Kỹ năng');
  assert.deepEqual(publicContent(data).skills, []);
  assert.equal(data.skills.length, 2);
});

test('Shared deletion moves each resource to recoverable trash and keeps trash bounded', () => {
  const data = content();
  data.projects = [projectSchema.parse({ id: 'p', name: 'Project' })];
  data.posts = [postSchema.parse({ id: 'q', title: 'Post' })];
  data.items['Custom'] = [itemSchema.parse({ id: 'r', title: 'Entry' })];
  trashEntry(data, 'projects', '', 'p', 'trash-p');
  trashEntry(data, 'posts', '', 'q', 'trash-q');
  trashEntry(data, 'items', 'Custom', 'r', 'trash-r');
  assert.equal(data.projects.length + data.posts.length + data.items['Custom'].length, 0);
  assert.deepEqual(
    data.trash.map((t) => t.value.id),
    ['r', 'q', 'p'],
  );
  for (let i = 0; i < 110; i++) {
    data.posts.push(postSchema.parse({ id: String(i), title: 'Post ' + i }));
    trashEntry(data, 'posts', '', String(i), 'trash-' + i);
  }
  assert.equal(data.trash.length, 100);
  assert.equal(data.trash[0].value.id, '109');
});

test('Section duplicate checks recognize built-in English and Vietnamese names and renamed display titles', () => {
  const before = content();
  for (const title of ['Projects', 'PROJECTS', ' dự ÁN ']) {
    const next = structuredClone(before);
    next.sections.push(title);
    assert.equal(duplicateContent(next, before), 'section');
  }
  const next = structuredClone(before);
  next.sections.push('Custom');
  next.sectionTitles.Custom = 'Skills';
  assert.equal(duplicateContent(next, before), 'section');
});

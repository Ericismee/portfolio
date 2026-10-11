import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchRepositories } from '../lib/repository-search.ts';

test('Repository search combines owner, name and technology terms while respecting visibility', () => {
  const repos = [
    { name: 'Zebra', fullName: 'owner/Zebra', language: 'TypeScript', private: true },
    {
      name: 'NotebookE',
      fullName: 'owner/NotebookE',
      language: 'Python',
      private: false,
      description: 'Nghiên cứu',
      topics: ['ai'],
    },
    { name: 'Note', fullName: 'other/Note', language: 'TypeScript', private: false },
  ];
  assert.deepEqual(
    searchRepositories(repos, '  OWNER python  ', 'all').map((r) => r.name),
    ['NotebookE'],
  );
  assert.deepEqual(
    searchRepositories(repos, 'nghien cuu ai', 'public').map((r) => r.name),
    ['NotebookE'],
  );
  assert.deepEqual(
    searchRepositories(repos, 'typescript', 'private').map((r) => r.name),
    ['Zebra'],
  );
  assert.deepEqual(
    searchRepositories(repos, 'owner', 'public').map((r) => r.name),
    ['NotebookE'],
  );
  assert.deepEqual(searchRepositories(repos, 'missing', 'all'), []);
  assert.deepEqual(
    searchRepositories(repos, '', 'all').map((r) => r.name),
    ['Note', 'NotebookE', 'Zebra'],
  );
  assert.equal(repos[0].name, 'Zebra');
});

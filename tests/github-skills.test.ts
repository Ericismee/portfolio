import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankLanguages, getGithubSkills } from '../lib/github-skills.ts';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('GitHub language ranking aggregates bytes, retains all languages and uses all languages for percentages', () => {
  const languages = rankLanguages([
    { TypeScript: 300, Python: 200, Rust: 100, CSS: 50, JavaScript: 40, HTML: 10 },
    { TypeScript: 300, Python: 100, Rust: -200, invalid: NaN },
  ]);
  assert.deepEqual(
    languages.map((item) => item.name),
    ['TypeScript', 'Python', 'Rust', 'CSS', 'JavaScript', 'HTML'],
  );
  assert.equal(languages[0].bytes, 600);
  assert(Math.abs(languages[0].percent - (600 / 1100) * 100) < 1e-8);
  assert(Math.abs(languages.reduce((sum, language) => sum + language.percent, 0) - 100) < 1e-8);
  assert.deepEqual(rankLanguages([]), []);
});
test('Unavailable GitHub stays an explicit empty state and retries use the cache', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'github-skills-test-'));
  const originalFetch = globalThis.fetch;
  const originalDirectory = process.env.DATA_DIR;
  let calls = 0;
  process.env.DATA_DIR = directory;
  globalThis.fetch = async () => {
    calls++;
    throw Error('Network unavailable');
  };
  try {
    const first = await getGithubSkills('qa-offline-user');
    assert.equal(first.status, 'unavailable');
    assert.deepEqual(first.languages, []);
    assert.deepEqual(await getGithubSkills('qa-offline-user'), first);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDirectory === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = originalDirectory;
    await rm(directory, { recursive: true, force: true });
  }
});

test('GitHub imports paginated public repos, profile and counts while excluding forks from language totals', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'github-pagination-test-'));
  const originalFetch = globalThis.fetch;
  const originalDirectory = process.env.DATA_DIR;
  process.env.DATA_DIR = directory;
  const paths: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    paths.push(url);
    let body: unknown;
    if (url.endsWith('/users/qa-paginated'))
      body = {
        name: 'QA',
        bio: 'Public bio',
        location: null,
        company: null,
        followers: 4,
        following: 3,
        public_repos: 101,
        created_at: '2020-01-01T00:00:00Z',
      };
    else if (new URL(url).searchParams.get('page') === '1')
      body = Array.from({ length: 100 }, (_, index) => ({
        name: 'repo-' + index,
        fork: index !== 0,
        private: false,
        size: 1,
        stargazers_count: 2,
        forks_count: 1,
        language: 'Python',
      }));
    else if (new URL(url).searchParams.get('page') === '2')
      body = [
        {
          name: 'last-repo',
          fork: false,
          private: false,
          size: 1,
          language: 'TypeScript',
          topics: ['web'],
        },
      ];
    else body = url.includes('last-repo') ? { TypeScript: 100 } : { Python: 300 };
    return new Response(JSON.stringify(body), { status: 200 });
  };
  try {
    const result = await getGithubSkills('qa-paginated');
    assert.equal(result.status, 'ready');
    assert.equal(result.partial, false);
    assert.equal(result.repos.length, 101);
    assert.equal(result.profile?.followers, 4);
    assert.equal(result.repositories, 2);
    assert.equal(result.languages[0].percent, 75);
    assert.deepEqual(result.repos.at(-1)?.topics, ['web']);
    assert.equal(paths.filter((url) => url.endsWith('/languages')).length, 2);
    assert.equal(paths.length, 5);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDirectory === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = originalDirectory;
    await rm(directory, { recursive: true, force: true });
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankLanguages, getGithubSkills } from '../lib/github-skills.ts';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('GitHub language ranking aggregates bytes, limits top five and uses all languages for percentages', () => {
  const languages = rankLanguages([
    { TypeScript: 300, Python: 200, Rust: 100, CSS: 50, JavaScript: 40, HTML: 10 },
    { TypeScript: 300, Python: 100, Rust: -200, invalid: NaN },
  ]);
  assert.deepEqual(
    languages.map((item) => item.name),
    ['TypeScript', 'Python', 'Rust', 'CSS', 'JavaScript'],
  );
  assert.equal(languages[0].bytes, 600);
  assert(Math.abs(languages[0].percent - (600 / 1100) * 100) < 1e-8);
  assert(languages.reduce((sum, language) => sum + language.percent, 0) < 100);
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
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDirectory === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = originalDirectory;
    await rm(directory, { recursive: true, force: true });
  }
});

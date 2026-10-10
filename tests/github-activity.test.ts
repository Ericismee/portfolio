import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseContributions, getGithubActivity } from '../lib/github-activity.ts';

function calendarFixture(year: number) {
  const start = Date.UTC(year, 0, 1),
    end = Date.UTC(year + 1, 0, 1);
  return Array.from({ length: (end - start) / 86400000 }, (_, i) => {
    const date = new Date(start + i * 86400000).toISOString().slice(0, 10);
    return (
      '<td id="day-' +
      i +
      '" data-level="' +
      (i === 0 ? 4 : 0) +
      '" data-date="' +
      date +
      '"></td><tool-tip for="day-' +
      i +
      '">' +
      (i === 0 ? '1,234 contributions' : 'No contributions') +
      ' on a date.</tool-tip>'
    );
  }).join('');
}
test('Contribution calendar uses exact source counts, handles leap years and rejects missing markup', () => {
  const html = calendarFixture(2024);
  const result = parseContributions(html, 2024);
  assert.equal(result.days.length, 366);
  assert.equal(result.total, 1234);
  assert.equal(result.days[0].level, 4);
  assert.equal(result.days[1].count, 0);
  assert.throws(() => parseContributions('<div>new upstream markup</div>', 2024));
  assert.throws(() => parseContributions(html.replace('for="day-0"', 'for="missing"'), 2024));
  assert.throws(() =>
    parseContributions(html.replace('data-date="2024-01-01"', 'data-date="2023-01-01"'), 2024),
  );
});
test('Activity fetches public sources, bounds authored commits and deduplicates repeated checks', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'github-activity-test-'));
  const originalFetch = globalThis.fetch,
    originalDir = process.env.DATA_DIR;
  process.env.DATA_DIR = folder;
  let calls = 0;
  globalThis.fetch = async (input) => {
    calls++;
    const url = String(input);
    if (url.includes('/contributions?')) return new Response(calendarFixture(2024));
    if (url.includes('/events/public'))
      return Response.json(
        [
          {
            id: 'e1',
            type: 'PushEvent',
            created_at: '2024-01-01T00:00:00Z',
            repo: { name: 'qa-activity/repo' },
            payload: { ref: 'refs/heads/main' },
          },
        ],
        { headers: { etag: '"v1"', 'x-poll-interval': '120' } },
      );
    assert(url.includes('author=qa-activity'));
    return Response.json([
      {
        sha: 'a'.repeat(40),
        commit: { message: 'Actual commit\nDetails', author: { date: '2024-01-01T00:00:00Z' } },
      },
    ]);
  };
  const repos = [
    {
      name: 'repo',
      description: null,
      language: 'Python',
      stars: 0,
      forks: 0,
      fork: false,
      archived: false,
      updatedAt: '',
      topics: [],
    },
  ];
  try {
    const first = await getGithubActivity('qa-activity', 2024, repos);
    assert.equal(first.calendar?.total, 1234);
    assert.equal(first.events[0].action, 'main');
    assert.equal(first.commits[0].message, 'Actual commit');
    assert.equal(first.pollSeconds, 120);
    assert.equal(calls, 3);
    await getGithubActivity('qa-activity', 2024, repos);
    assert.equal(calls, 3);
    await assert.rejects(getGithubActivity('../unsafe', 2024, repos));
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = originalDir;
    await rm(folder, { recursive: true, force: true });
  }
});
test('Upstream failure keeps an explicitly stale contribution snapshot', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'github-stale-test-'));
  const originalFetch = globalThis.fetch,
    originalDir = process.env.DATA_DIR;
  process.env.DATA_DIR = folder;
  globalThis.fetch = async () => {
    throw Error('Offline');
  };
  try {
    await mkdir(path.join(folder, 'github-cache'), { recursive: true });
    await writeFile(
      path.join(folder, 'github-cache', 'calendar-qa-stale-2024.json'),
      JSON.stringify({
        value: parseContributions(calendarFixture(2024), 2024),
        at: '2024-01-01T00:00:00.000Z',
      }),
    );
    const result = await getGithubActivity('qa-stale', 2024, []);
    assert.equal(result.calendarStatus, 'stale');
    assert.equal(result.calendar?.total, 1234);
    assert.equal(result.eventsStatus, 'unavailable');
    assert.deepEqual(result.events, []);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = originalDir;
    await rm(folder, { recursive: true, force: true });
  }
});

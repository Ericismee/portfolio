import { test } from 'node:test';
import assert from 'node:assert/strict';
import { githubSettingsSchema, publicGithubSettings } from '../lib/schema.ts';
import {
  visibleGithubStats,
  visibleGithubActivity,
  featuredGithubRepos,
} from '../lib/github-display.ts';
import type { GithubSkills } from '../lib/github-skills.ts';
import type { GithubActivity } from '../lib/github-activity.ts';
const repo = (name: string, fork = false) => ({
  name,
  fork,
  description: null,
  language: 'TypeScript',
  stars: 1,
  forks: 0,
  archived: false,
  updatedAt: '',
  topics: [],
});
const stats: GithubSkills = {
  username: 'owner',
  status: 'ready',
  profile: null,
  repos: [repo('Hidden'), repo('Public'), repo('fork', true)],
  languages: [{ name: 'TypeScript', bytes: 100, percent: 100 }],
  repositories: 2,
  partial: false,
  updatedAt: '',
};
const activity: GithubActivity = {
  calendar: { year: 2026, total: 4, days: [] },
  commits: ['owner/hidden', 'Owner/Public', 'owner/fork', 'other/hidden'].map((repo) => ({
    repo,
    sha: 'sha',
    message: '',
    date: '',
  })),
  events: ['owner/hidden', 'owner/Public', 'owner/fork'].map((repo, i) => ({
    repo,
    id: String(i),
    type: 'PushEvent',
    date: '',
    action: '',
  })),
  calendarStatus: 'ready',
  commitsStatus: 'ready',
  eventsStatus: 'ready',
  checkedAt: '',
  calendarUpdatedAt: '',
  commitsUpdatedAt: '',
  eventsUpdatedAt: '',
  pollSeconds: 60,
  commitRepositories: 2,
};

test('GitHub curation filters hidden repositories and own history case-insensitively without altering account totals', () => {
  const settings = githubSettingsSchema.parse({
    hiddenRepos: ['hidden'],
    includeForks: false,
    featuredMode: 'selected',
    featuredRepos: ['Hidden', 'Public', 'fork'],
  });
  const visible = visibleGithubStats(stats, settings);
  assert.deepEqual(
    visible.repos.map((r) => r.name),
    ['Public'],
  );
  assert.deepEqual(visible.languages, stats.languages);
  assert.equal(stats.repos.length, 3, 'Source cache is never mutated');
  const history = visibleGithubActivity(activity, settings, 'owner', stats);
  assert.deepEqual(
    history.commits.map((c) => c.repo),
    ['Owner/Public', 'other/hidden'],
  );
  assert.deepEqual(
    history.events.map((c) => c.repo),
    ['owner/Public'],
  );
  assert.equal(history.calendar?.total, 4);
  assert.deepEqual(
    featuredGithubRepos(visible, settings).map((r) => r.name),
    ['Public'],
  );
  assert.deepEqual(publicGithubSettings(settings).hiddenRepos, []);
  assert(!publicGithubSettings(settings).featuredRepos.includes('Hidden'));
});
test('GitHub manual featured order, empty selection and disabled history remain deliberate choices', () => {
  const settings = githubSettingsSchema.parse({
    featuredMode: 'selected',
    featuredRepos: ['Public', 'Hidden'],
    showCalendar: false,
    showCommits: false,
    showEvents: false,
  });
  assert.deepEqual(
    featuredGithubRepos(stats, settings).map((r) => r.name),
    ['Public', 'Hidden'],
  );
  assert.deepEqual(featuredGithubRepos(stats, { ...settings, featuredRepos: [] }), []);
  const history = visibleGithubActivity(activity, settings, 'owner', stats);
  assert.equal(history.calendar, null);
  assert.deepEqual(history.commits, []);
  assert.deepEqual(history.events, []);
  assert.equal(githubSettingsSchema.parse({}).refreshMinutes, 60);
  assert(!githubSettingsSchema.safeParse({ refreshMinutes: 1 }).success);
  assert(!githubSettingsSchema.safeParse({ hiddenRepos: ['../invalid'] }).success);
});

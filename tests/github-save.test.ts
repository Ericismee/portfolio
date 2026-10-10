import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeGithubChanges } from '../lib/github-save.ts';
import { contentSchema } from '../lib/schema.ts';
import { initial, skills } from '../lib/seed.ts';

test('GitHub saves rebase independent edits and preserve changes to other content', () => {
  const base = contentSchema.parse({ ...initial, skills });
  const latest = structuredClone(base),
    mine = structuredClone(base.github);
  latest.profile.name = 'Changed elsewhere';
  latest.github.showCalendar = false;
  latest.github.hiddenRepos = ['other'];
  mine.showEvents = false;
  mine.hiddenRepos = ['mine'];
  const result = mergeGithubChanges(base, latest, mine, base.githubUsername);
  assert.equal(result.profile.name, 'Changed elsewhere');
  assert.equal(result.github.showCalendar, false);
  assert.equal(result.github.showEvents, false);
  assert.deepEqual(result.github.hiddenRepos, ['other', 'mine']);
  assert.deepEqual(latest.github.hiddenRepos, ['other']);
});
test('Conflicting GitHub choices require explicit resolution; account switches cannot mix repositories', () => {
  const base = contentSchema.parse({ ...initial, skills }),
    latest = structuredClone(base),
    mine = structuredClone(base.github);
  latest.github.refreshMinutes = 15;
  mine.refreshMinutes = 30;
  assert.throws(() => mergeGithubChanges(base, latest, mine, base.githubUsername), { status: 409 });
  assert.equal(
    mergeGithubChanges(base, latest, mine, base.githubUsername, true).github.refreshMinutes,
    30,
  );
  latest.githubUsername = 'different-account';
  latest.github.hiddenRepos = ['different-repo'];
  assert.throws(() => mergeGithubChanges(base, latest, mine, base.githubUsername), { status: 409 });
  const forced = mergeGithubChanges(base, latest, mine, base.githubUsername, true);
  assert.equal(forced.githubUsername, base.githubUsername);
  assert.deepEqual(forced.github, mine);
});

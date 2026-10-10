import type { GithubSettings } from './schema.ts';
import type { GithubSkills } from './github-skills.ts';
import type { GithubActivity } from './github-activity.ts';

// Apply the same curation to server rendering and public refresh responses.
// GitHub's account-wide calendar/language totals intentionally remain intact.
export function visibleGithubStats(stats: GithubSkills, settings: GithubSettings): GithubSkills {
  const hidden = new Set(settings.hiddenRepos.map((name) => name.toLowerCase()));
  return {
    ...stats,
    profile: stats.profile
      ? {
          ...stats.profile,
          avatarUrl:
            stats.profile.avatarUrl ||
            `https://github.com/${encodeURIComponent(stats.username)}.png?size=160`,
        }
      : null,
    repos: stats.repos.filter(
      (repo) => !hidden.has(repo.name.toLowerCase()) && (settings.includeForks || !repo.fork),
    ),
  };
}
export function visibleGithubActivity(
  activity: GithubActivity,
  settings: GithubSettings,
  username: string,
  raw: GithubSkills,
): GithubActivity {
  const hidden = new Set(settings.hiddenRepos.map((name) => name.toLowerCase()));
  const forks = new Set(
    raw.repos.filter((repo) => repo.fork).map((repo) => repo.name.toLowerCase()),
  );
  const visible = (full: string) => {
    const [owner, name] = full.split('/');
    return (
      owner.toLowerCase() !== username.toLowerCase() ||
      (!hidden.has((name || '').toLowerCase()) &&
        (settings.includeForks || !forks.has((name || '').toLowerCase())))
    );
  };
  return {
    ...activity,
    calendar: settings.showCalendar ? activity.calendar : null,
    commits: settings.showCommits ? activity.commits.filter((item) => visible(item.repo)) : [],
    events: settings.showEvents ? activity.events.filter((item) => visible(item.repo)) : [],
  };
}
export function featuredGithubRepos(stats: GithubSkills, settings: GithubSettings) {
  if (settings.featuredMode === 'selected')
    return settings.featuredRepos.flatMap((name) => {
      const repo = stats.repos.find((repo) => repo.name.toLowerCase() === name.toLowerCase());
      return repo ? [repo] : [];
    });
  return [...stats.repos]
    .filter((repo) => !repo.fork)
    .sort((a, b) => b.stars - a.stars || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);
}

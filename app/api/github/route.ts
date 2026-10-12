import { publicGithubSettings } from '../../../lib/schema';
import { visibleGithubStats, visibleGithubActivity } from '../../../lib/github-display';
import { getDatabase } from '../../../lib/database';
import { getGithubSkills } from '../../../lib/github-skills';
import { getGithubActivity } from '../../../lib/github-activity';
import { unstable_cache } from 'next/cache';
// Cache upstream public data across Vercel instances. Apply the current owner's
// visibility rules below on every request, outside this shared cache.
const cachedSkills = unstable_cache(async (username: string) => {
  const stats = await getGithubSkills(username);
  if (stats.status === 'unavailable') throw Error('GitHub unavailable');
  return stats;
}, ['github-public-skills-v1'], {
  revalidate: 3600,
});
const cachedActivity = unstable_cache(getGithubActivity, ['github-public-activity-v1'], {
  revalidate: 60,
});
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('year');
  const year = raw === null ? new Date().getUTCFullYear() : Number(raw);
  if (!Number.isInteger(year) || year < 2008 || year > new Date().getUTCFullYear())
    return Response.json({ error: 'Invalid year' }, { status: 400 });
  const { githubUsername, github } = (await (await getDatabase()).read()).data;
  try {
    const stats = await cachedSkills(githubUsername);
    if (new URL(request.url).searchParams.get('view') === 'skills')
      return Response.json(
        { stats: visibleGithubStats(stats, github) },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    return Response.json(
      {
        stats: visibleGithubStats(stats, github),
        activity: visibleGithubActivity(
          await cachedActivity(githubUsername, year, stats.repos),
          github,
          githubUsername,
          stats,
        ),
        settings: publicGithubSettings(github),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json({ error: 'GitHub temporarily unavailable' }, { status: 503 });
  }
}

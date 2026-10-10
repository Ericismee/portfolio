import { publicGithubSettings } from '../../../lib/schema';
import { visibleGithubStats, visibleGithubActivity } from '../../../lib/github-display';
import { getDatabase } from '../../../lib/database';
import { getGithubSkills } from '../../../lib/github-skills';
import { getGithubActivity } from '../../../lib/github-activity';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('year');
  const year = raw === null ? new Date().getUTCFullYear() : Number(raw);
  if (!Number.isInteger(year) || year < 2008 || year > new Date().getUTCFullYear())
    return Response.json({ error: 'Invalid year' }, { status: 400 });
  const { githubUsername, github } = getDatabase().read().data;
  try {
    const stats = await getGithubSkills(githubUsername);
    return Response.json(
      {
        stats: visibleGithubStats(stats, github),
        activity: visibleGithubActivity(
          await getGithubActivity(githubUsername, year, stats.repos),
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

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
  const { githubUsername } = getDatabase().read().data;
  try {
    const stats = await getGithubSkills(githubUsername);
    return Response.json(
      { stats, activity: await getGithubActivity(githubUsername, year, stats.repos) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json({ error: 'GitHub temporarily unavailable' }, { status: 503 });
  }
}

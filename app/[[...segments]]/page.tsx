import { visibleGithubStats } from '../../lib/github-display';
import { notFound } from 'next/navigation';
import { getDatabase } from '../../lib/database';
import { publicContent } from '../../lib/schema';
import { ProfileSite } from '../../components/profile-site';
import type { Metadata } from 'next';
import { getGithubSkills } from '../../lib/github-skills';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function generateMetadata(): Metadata {
  const { profile } = getDatabase().read().data;
  return {
    title: profile.name + ' · ' + profile.headline,
    description: profile.summary || profile.headline,
  };
}
export default async function PublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { segments = [] } = await params;
  if (
    segments.length > 2 ||
    ![
      '',
      'profile',
      'projects',
      'activity',
      'feed',
      'posts',
      'contact',
      'github',
      'search',
    ].includes(segments[0] || '') ||
    (segments.length === 2 && !['projects', 'posts'].includes(segments[0]))
  )
    notFound();
  const query = await searchParams;
  const source = getDatabase().read().data;
  const content = publicContent(source);
  if (
    segments[1] &&
    !(segments[0] === 'projects' ? content.projects : content.posts).some(
      (entry) => entry.id === segments[1],
    )
  )
    notFound();
  return (
    <ProfileSite
      content={content}
      githubSkills={visibleGithubStats(
        await getGithubSkills(content.githubUsername),
        source.github,
      )}
      page={segments[0] || 'profile'}
      id={segments[1]}
      query={Object.fromEntries(
        Object.entries(query).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || '']),
      )}
    />
  );
}

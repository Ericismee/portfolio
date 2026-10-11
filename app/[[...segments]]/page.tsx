import { visibleGithubStats } from '../../lib/github-display';
import { notFound } from 'next/navigation';
import { readServerContent } from '../../lib/server-content';
import { publicContent } from '../../lib/schema';
import { ProfileSite } from '../../components/profile-site';
import type { Metadata } from 'next';
import { githubSkillsSnapshot } from '../../lib/github-skills';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}): Promise<Metadata> {
  const { segments = [] } = await params;
  const content = publicContent((await readServerContent()).data);
  const { profile } = content;
  const titles: Record<string, string> = {
    '': 'Home',
    profile: 'Home',
    projects: 'Projects',
    activity: 'Activity',
    feed: 'Activity',
    posts: 'Posts',
    contact: 'Contact',
    github: 'GitHub',
    search: 'Search',
  };
  const detail =
    segments[1] &&
    (segments[0] === 'projects'
      ? content.projects.find((entry) => entry.id === segments[1])?.name
      : segments[0] === 'posts'
        ? content.posts.find((entry) => entry.id === segments[1])?.title
        : undefined);
  return {
    title: 'Eric | ' + (detail || titles[segments[0] || ''] || 'Home'),
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
  const source = (await readServerContent()).data;
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
      githubSkills={visibleGithubStats(githubSkillsSnapshot(content.githubUsername), source.github)}
      page={segments[0] || 'profile'}
      id={segments[1]}
      query={Object.fromEntries(
        Object.entries(query).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || '']),
      )}
    />
  );
}

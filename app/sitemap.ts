import type { MetadataRoute } from 'next';
import { readServerContent } from '../lib/server-content';
import { publicContent } from '../lib/schema';
import { siteOrigin } from '../lib/site-origin';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = publicContent((await readServerContent()).data);
  const origin = siteOrigin();
  return [
    ...['', '/projects', '/activity', '/contact', '/github'].map((path) => ({
      url: origin + path,
    })),
    ...data.projects.map((entry) => ({
      url: origin + '/projects/' + encodeURIComponent(entry.id),
    })),
    ...data.posts.map((entry) => ({ url: origin + '/posts/' + encodeURIComponent(entry.id) })),
  ];
}

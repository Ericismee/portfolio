import type { Content, Kind } from './schema.ts';
import { projectSchema, postSchema, itemSchema } from './schema.ts';
export const normalizedName = (value: string) =>
  value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
export function repositoryIdentity(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.toLowerCase() === 'github.com'
      ? url.pathname
          .replace(/\.git\/?$/i, '')
          .replace(/\/$/, '')
          .toLowerCase()
      : '';
  } catch {
    return '';
  }
}
function counts(values: string[]) {
  const result = new Map<string, number>();
  for (const key of values) if (key) result.set(key, (result.get(key) || 0) + 1);
  return result;
}
// Existing duplicates can be edited or reduced; new duplicates cannot be introduced.
export function duplicateContent(next: Content, previous: Content): string | null {
  const increased = (after: string[], before: string[]) => {
    const a = counts(after),
      b = counts(before);
    return [...a].some(([key, count]) => count > Math.max(1, b.get(key) || 0));
  };
  if (
    increased(next.sections.map(normalizedName), previous.sections.map(normalizedName)) ||
    increased(
      next.sections.map((key) => normalizedName(next.sectionTitles[key] || key)),
      previous.sections.map((key) => normalizedName(previous.sectionTitles[key] || key)),
    )
  )
    return 'section';
  if (increased(next.skills.map(normalizedName), previous.skills.map(normalizedName)))
    return 'skill';
  if (
    increased(
      next.projects.map((p) => normalizedName(p.name)),
      previous.projects.map((p) => normalizedName(p.name)),
    ) ||
    increased(
      next.projects.map((p) => repositoryIdentity(p.github)),
      previous.projects.map((p) => repositoryIdentity(p.github)),
    )
  )
    return 'project';
  const postKey = (p: Content['posts'][number]) =>
    JSON.stringify([
      normalizedName(p.title),
      p.bodyFormat === 'markdown' ? p.markdown.trim() : p.text.trim(),
      p.link,
    ]);
  if (increased(next.posts.map(postKey), previous.posts.map(postKey))) return 'post';
  for (const [section, items] of Object.entries(next.items)) {
    const key = (p: Content['items'][string][number]) =>
      JSON.stringify([
        normalizedName(p.title),
        normalizedName(p.organization),
        normalizedName(p.period),
      ]);
    if (increased(items.map(key), (previous.items[section] || []).map(key))) return 'entry';
  }
  return null;
}
export function trashEntry(
  data: Content,
  kind: Kind,
  section: string,
  id: string,
  trashId: string,
  now = new Date().toISOString(),
) {
  const list = kind === 'items' ? data.items[section] || [] : data[kind];
  const value = list.find((item) => item.id === id);
  if (!value) return;
  const record = { id: trashId, section, deletedAt: now };
  if (kind === 'projects') {
    data.trash.unshift({ ...record, kind, value: projectSchema.parse(value) });
    data.projects = data.projects.filter((item) => item.id !== id);
  } else if (kind === 'posts') {
    data.trash.unshift({ ...record, kind, value: postSchema.parse(value) });
    data.posts = data.posts.filter((item) => item.id !== id);
  } else {
    data.trash.unshift({ ...record, kind, value: itemSchema.parse(value) });
    data.items[section] = list
      .filter((item) => item.id !== id)
      .map((item) => itemSchema.parse(item));
  }
  data.trash = data.trash.slice(0, 100);
}

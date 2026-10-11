import type { Content, Kind, Project, Post, Entry } from './schema';
export class RequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export async function request<T>(
  url: string,
  method = 'GET',
  body?: unknown,
  csrf = '',
): Promise<T> {
  const serialized = body === undefined ? undefined : JSON.stringify(body);
  if (
    url === '/api/admin/content' &&
    method === 'PUT' &&
    serialized &&
    new Blob([serialized]).size > 3 * 1024 * 1024
  ) {
    const { saveLargeContent } = await import('./upload-client.ts');
    const input = body as { data: unknown; version: number };
    return saveLargeContent(input.data, input.version, csrf) as Promise<T>;
  }
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
    body: serialized,
    cache: 'no-store',
  });
  const json: unknown = await response.json();
  if (!response.ok)
    throw new RequestError(
      typeof json === 'object' && json && 'error' in json
        ? String(json.error)
        : 'Request failed / Không thể kết nối',
      response.status,
    );
  return json as T;
}
// The legacy mock has no publication flags. Preserve authored content while
// keeping its explicitly marked sample posts out of the public feed.
export function prepareLegacyImport(input: unknown): unknown {
  if (!input || typeof input !== 'object') throw Error('Invalid backup file');
  const value = structuredClone(input) as Record<string, unknown>;
  if (value.data && typeof value.data === 'object') return prepareLegacyImport(value.data);
  for (const key of ['projects', 'posts'])
    if (Array.isArray(value[key]))
      value[key] = value[key].map((entry: unknown) => {
        if (!entry || typeof entry !== 'object') return entry;
        const e = entry as Record<string, unknown>;
        return {
          ...e,
          visibility:
            e.visibility ||
            (e.status === 'Bản nháp' || (key === 'posts' && e.sample) ? 'draft' : 'public'),
        };
      });
  if (value.items && typeof value.items === 'object') {
    value.items = Object.fromEntries(
      Object.entries(value.items).map(([section, entries]) => [
        section,
        Array.isArray(entries)
          ? entries.map((entry) =>
              entry && typeof entry === 'object'
                ? { ...entry, visibility: entry.visibility || 'public' }
                : entry,
            )
          : entries,
      ]),
    );
  }
  return value;
}
export function entries(content: Content, kind: Kind, section = ''): Array<Project | Post | Entry> {
  return kind === 'items' ? content.items[section] || [] : content[kind];
}

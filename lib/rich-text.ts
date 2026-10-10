export type RichNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: RichNode[];
};
export function safeMediaUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  if (/^\/uploads\/[a-f0-9-]+\.(png|jpg|gif|webp)$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password)
      return url.href;
  } catch {
    /* Invalid URLs stay inert. */
  }
}
export function youtubeEmbed(value: unknown): string | undefined {
  const safe = safeMediaUrl(value);
  if (!safe || safe.startsWith('/')) return;
  const url = new URL(safe);
  const host = url.hostname.toLowerCase();
  const id =
    host === 'youtu.be'
      ? url.pathname.slice(1)
      : ['youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com'].includes(host)
        ? url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1]
        : '';
  return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : undefined;
}
export function readRichText(value: string, fallback = ''): RichNode {
  try {
    const doc = JSON.parse(value);
    let count = 0;
    const valid = (node: RichNode, depth: number): boolean =>
      !!node &&
      typeof node === 'object' &&
      typeof node.type === 'string' &&
      ++count <= 10000 &&
      depth <= 40 &&
      (node.text === undefined || typeof node.text === 'string') &&
      (node.attrs === undefined ||
        (!!node.attrs && typeof node.attrs === 'object' && !Array.isArray(node.attrs))) &&
      (node.marks === undefined ||
        (Array.isArray(node.marks) &&
          node.marks.length <= 20 &&
          node.marks.every(
            (mark) =>
              !!mark &&
              typeof mark.type === 'string' &&
              (mark.attrs === undefined ||
                (!!mark.attrs && typeof mark.attrs === 'object' && !Array.isArray(mark.attrs))),
          ))) &&
      (node.content === undefined ||
        (Array.isArray(node.content) && node.content.every((n) => valid(n, depth + 1))));
    if (doc.type === 'doc' && valid(doc, 0)) return doc;
  } catch {
    /* Old posts retain their original plain text. */
  }
  return {
    type: 'doc',
    content: fallback
      .split('\n')
      .map((text) => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] })),
  };
}
export function richPlainText(value: string): string {
  const walk = (node: RichNode): string =>
    node.text ||
    (node.content || [])
      .map(walk)
      .join(['doc', 'bulletList', 'orderedList'].includes(node.type) ? '\n' : '');
  return walk(readRichText(value)).trim();
}

import type { Post } from './schema.ts';
import { readRichText, type RichNode } from './rich-text.ts';

export const postTypes = ['Bài viết', 'Cập nhật dự án', 'Media', 'Liên kết'] as const;
export function postMatches(post: Post, filter: string): boolean {
  if (filter === 'all') return true;
  if (post.type === filter) return true;
  const has = (node: RichNode, kind: string): boolean =>
    node.type === kind || !!node.content?.some((n) => has(n, kind));
  const doc = readRichText(post.richText, post.text);
  if (filter === 'Media')
    return (
      !!post.image ||
      has(doc, 'image') ||
      has(doc, 'youtube') ||
      (post.bodyFormat === 'markdown' && /!\[[^\]]*\]\([^)]+\)/.test(post.markdown))
    );
  if (filter === 'Liên kết') {
    const link = (node: RichNode): boolean =>
      !!node.marks?.some((m) => m.type === 'link') || !!node.content?.some(link);
    return (
      !!post.link ||
      link(doc) ||
      (post.bodyFormat === 'markdown' && /(?:\[[^\]]+\]\([^)]+\)|https?:\/\/)/.test(post.markdown))
    );
  }
  return filter === 'Bài viết' && !postTypes.includes(post.type as (typeof postTypes)[number]);
}

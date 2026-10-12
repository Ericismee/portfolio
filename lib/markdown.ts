// List summaries are plain text; never show imported HTML comments or README syntax.
export function markdownSummary(value: string) {
  return value
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/^\s*\[[^\]]+\]:\s+\S+.*$/gm, '')
    .replace(/!\[[^\]]*\](?:\([^)]*\)|\[[^\]]*\])/g, '')
    .replace(/\[([^\]]+)\](?:\([^)]*\)|\[[^\]]*\])/g, '$1')
    .replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function markdownUrl(value: string, base = '', image = false): string {
  if (/^\/uploads\/[a-f0-9-]+\.(png|jpg|gif|webp|pdf|docx|txt|md|svg)$/.test(value)) return value;
  if (value.startsWith('#') && (image || !base)) return image ? '' : value;
  try {
    const resolved = new URL(value, base || 'https://invalid.local');
    if (
      !['https:', 'http:', 'mailto:'].includes(resolved.protocol) ||
      resolved.username ||
      resolved.password
    )
      return '';
    if (resolved.hostname === 'invalid.local') return value.startsWith('/uploads/') ? value : '';
    if (image && !['https:', 'http:'].includes(resolved.protocol)) return '';
    if (image && resolved.hostname === 'github.com' && resolved.pathname.includes('/blob/')) {
      resolved.hostname = 'raw.githubusercontent.com';
      resolved.pathname = resolved.pathname.replace('/blob/', '/');
    }
    return resolved.href;
  } catch {
    return '';
  }
}
export function projectUsesMarkdown(project: {
  detailsFormat: string;
  details: string;
  source: string;
}) {
  return (
    project.detailsFormat === 'markdown' ||
    (project.detailsFormat === 'auto' &&
      /github\.com\/.+#readme/i.test(project.source) &&
      /(?:^#{1,6} |\*\*|^[-*] |\|.+\|)/m.test(project.details))
  );
}

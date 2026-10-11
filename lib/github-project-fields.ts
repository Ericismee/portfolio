export function applyGithubFields(
  current: Record<string, string | boolean>,
  incoming: Record<string, string>,
  replace = false,
) {
  const next = { ...current };
  for (const [key, value] of Object.entries(incoming))
    if (
      [
        'name',
        'description',
        'tech',
        'technologies',
        'github',
        'source',
        'demo',
        'details',
        'role',
      ].includes(key) &&
      value &&
      (replace || !String(current[key] || '').trim())
    )
      next[key] = value;
  if (
    incoming.details &&
    next.details === incoming.details &&
    (replace || !String(current.details || '').trim())
  ) {
    next.detailsFormat = incoming.detailsFormat || 'markdown';
    next.detailsBase = incoming.detailsBase || '';
  }
  return next;
}

export function applyGithubPostFields(
  current: Record<string, string | boolean>,
  incoming: Record<string, string>,
  replace = false,
) {
  const next = { ...current };
  if (incoming.name && (replace || !String(current.title || '').trim())) next.title = incoming.name;
  if (incoming.github && (replace || !String(current.link || '').trim()))
    next.link = incoming.github;
  const authored =
    String(current.markdown || current.text || '').trim() ||
    /"text"\s*:|"type"\s*:\s*"(?:image|youtube|horizontalRule)"/.test(
      String(current.richText || ''),
    );
  if ((replace || !authored) && (incoming.details || incoming.description)) {
    next.markdown = incoming.details || incoming.description;
    next.markdownBase = incoming.detailsBase || '';
    next.bodyFormat = 'markdown';
  }
  if (replace || !String(current.type || '').trim()) next.type = 'Cập nhật dự án';
  return next;
}

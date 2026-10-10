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
  return next;
}

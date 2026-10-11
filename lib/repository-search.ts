type SearchableRepository = {
  name: string;
  fullName?: string;
  language?: string | null;
  description?: string | null;
  topics?: string[];
  private?: boolean;
};
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function searchRepositories<T extends SearchableRepository>(
  repos: T[],
  query: string,
  visibility: string,
) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return repos
    .filter((repo) => {
      if (visibility !== 'all' && (visibility === 'private') !== !!repo.private) return false;
      const text = normalize(
        [repo.fullName || repo.name, repo.language, repo.description, ...(repo.topics || [])].join(
          ' ',
        ),
      );
      return terms.every((term) => text.includes(term));
    })
    .sort((a, b) => {
      const rank = (repo: T) => (terms.length && normalize(repo.name).startsWith(terms[0]) ? 0 : 1);
      return (
        rank(a) - rank(b) ||
        a.name.localeCompare(b.name) ||
        (a.fullName || a.name).localeCompare(b.fullName || b.name)
      );
    });
}

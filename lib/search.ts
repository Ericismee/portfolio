import { publicContent, type Content, type Project } from './schema.ts';
import { richPlainText } from './rich-text.ts';

export const normalizeSearch = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replaceAll('đ', 'd');
export function matchesSearch(values: unknown, query: string) {
  const terms = normalizeSearch(query.trim()).split(/\s+/).filter(Boolean);
  const strings = (v: unknown): string =>
    typeof v === 'string' ? v : Array.isArray(v) ? v.map(strings).join(' ') : '';
  const haystack = normalizeSearch(strings(values));
  return terms.length > 0 && terms.every((term) => haystack.includes(term));
}

export function projectTechnologies(project: Project) {
  const values = [...project.tech.split(','), ...project.technologies]
    .map((v) => v.trim())
    .filter(Boolean);
  return values.filter(
    (value, index) =>
      values.findIndex((v) => normalizeSearch(v) === normalizeSearch(value)) === index,
  );
}

export function projectMatchesSearch(p: Project, query: string) {
  return matchesSearch(
    [
      p.name,
      p.description,
      p.tech,
      p.technologies,
      p.status,
      p.role,
      p.problem,
      p.contribution,
      p.outcome,
      p.details,
      p.github,
      p.demo,
      p.source,
    ],
    query,
  );
}

export function searchContent(content: Content, query: string) {
  const data = publicContent(content);
  const matches = (values: unknown) => matchesSearch(values, query);
  const projects = data.projects.filter((p) => projectMatchesSearch(p, query));
  const posts = data.posts.filter((p) =>
    matches([p.title, p.text, p.markdown, p.type, p.link, richPlainText(p.richText)]),
  );
  const skills = data.skills.filter((s) => matches(s));
  const profile = matches(Object.values(data.profile));
  const items = data.sections
    .filter((s) => !data.hidden.includes(s))
    .flatMap((section) =>
      (data.items[section] || [])
        .filter((item) =>
          matches([
            section,
            data.sectionTitles[section],
            ...Object.entries(item)
              .filter(([key]) => !['id', 'visible', 'visibility'].includes(key))
              .map(([, value]) => value),
          ]),
        )
        .map((item) => ({ section, item })),
    );
  const links = Object.entries(data.links).filter(
    ([key, value]) =>
      value && matches([key, value, key === 'email' ? 'email mail liên hệ contact' : '']),
  );
  const cv = !!data.cv && matches([data.cv.name, 'cv resume curriculum vitae hồ sơ']);
  return { projects, posts, skills, profile, items, links, cv };
}

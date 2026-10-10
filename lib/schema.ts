import { z } from 'zod';
const text = (max = 10000) => z.string().trim().max(max).default('');
const names = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(100)
      .refine((v) => !['__proto__', 'constructor', 'prototype'].includes(v), 'Invalid name'),
  )
  .max(60);
export const url = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => {
    if (!v || /^\/uploads\/[a-f0-9-]+\.(png|jpg|webp|gif|pdf)$/.test(v)) return true;
    try {
      const u = new URL(v);
      return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password;
    } catch {
      return false;
    }
  }, 'Invalid URL / Liên kết không hợp lệ')
  .default('');
const base = {
  id: z.string().min(1).max(200),
  visible: z.boolean().default(true),
  visibility: z.enum(['public', 'draft']).default('draft'),
};
export const projectSchema = z.object({
  ...base,
  name: z.string().trim().min(1).max(200),
  description: text(30000),
  tech: text(200),
  technologies: names.default([]),
  status: text(200),
  role: text(),
  problem: text(30000),
  contribution: text(30000),
  outcome: text(30000),
  details: text(30000),
  github: url,
  demo: url,
  source: url,
  thumbnail: url,
  pinned: z.boolean().default(false),
  sample: z.boolean().default(false),
});
export const postSchema = z.object({
  ...base,
  title: z.string().trim().min(1).max(200),
  text: text(30000),
  type: text(200),
  link: url,
  image: url,
  createdAt: z.iso.datetime().optional(),
  displayAt: z.iso.datetime().optional(),
  sample: z.boolean().default(false),
});
export const itemSchema = z.object({
  ...base,
  title: z.string().trim().min(1).max(200),
  organization: text(200),
  period: text(200),
  description: text(30000),
});
export const trashSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string(),
    kind: z.literal('projects'),
    section: text(100),
    deletedAt: z.iso.datetime(),
    value: projectSchema,
  }),
  z.object({
    id: z.string(),
    kind: z.literal('posts'),
    section: text(100),
    deletedAt: z.iso.datetime(),
    value: postSchema,
  }),
  z.object({
    id: z.string(),
    kind: z.literal('items'),
    section: text(100),
    deletedAt: z.iso.datetime(),
    value: itemSchema,
  }),
]);
const repoNames = z.array(z.string().regex(/^[a-zA-Z0-9_.-]{1,100}$/)).max(1000);
export const githubSettingsSchema = z.object({
  title: z.string().trim().min(1).max(120).default('Dấu ấn mã nguồn'),
  description: text(300).default('Dự án và đóng góp trên GitHub.'),
  refreshMinutes: z.union([z.literal(5), z.literal(15), z.literal(30), z.literal(60)]).default(60),
  showSidebar: z.boolean().default(true),
  showStatistics: z.boolean().default(true),
  showTechnologies: z.boolean().default(true),
  showCalendar: z.boolean().default(true),
  showFeatured: z.boolean().default(true),
  showRepositories: z.boolean().default(true),
  showCommits: z.boolean().default(true),
  showEvents: z.boolean().default(true),
  includeForks: z.boolean().default(true),
  hiddenRepos: repoNames.default([]),
  featuredMode: z.enum(['auto', 'selected']).default('auto'),
  featuredRepos: repoNames.max(12).default([]),
});
export type GithubSettings = z.infer<typeof githubSettingsSchema>;
export function publicGithubSettings(settings: GithubSettings): GithubSettings {
  const hidden = new Set(settings.hiddenRepos.map((name) => name.toLowerCase()));
  return {
    ...settings,
    hiddenRepos: [],
    featuredRepos: settings.featuredRepos.filter((name) => !hidden.has(name.toLowerCase())),
  };
}
export const contentSchema = z
  .object({
    profile: z.object({
      name: z.string().trim().min(1).max(200),
      headline: text(200),
      summary: text(200),
      location: text(200),
      about: text(20000),
      avatar: url,
      cover: url,
    }),
    theme: z.enum(['light', 'dark']).default('light'),
    accent: z.string().regex(/^#[a-f0-9]{6}$/i),
    density: z.enum(['compact', 'comfortable']).default('comfortable'),
    layout: z.enum(['standard', 'wide']).default('standard'),
    contentVersion: z.number().default(1),
    visualStyle: z.literal('colorful-template').default('colorful-template'),
    sections: names,
    hidden: names.default([]),
    sectionTitles: z.record(z.string().max(100), z.string().trim().min(1).max(100)).default({}),
    items: z.record(z.string().max(100), z.array(itemSchema).max(200)).default({}),
    projects: z.array(projectSchema).max(300),
    posts: z.array(postSchema).max(500),
    skills: names.default([]),
    links: z
      .record(
        z.string().regex(/^(?!__proto__$|constructor$|prototype$)[a-zA-Z0-9_-]{1,40}$/),
        z.string().max(2048),
      )
      .superRefine((links, ctx) => {
        for (const [key, value] of Object.entries(links)) {
          if (!value) continue;
          if (key === 'email' ? !z.email().safeParse(value).success : !url.safeParse(value).success)
            ctx.addIssue({ code: 'custom', message: 'Invalid ' + key, path: [key] });
        }
      })
      .default({}),
    github: githubSettingsSchema.prefault({}),
    githubUsername: z
      .string()
      .max(39)
      .regex(/^[a-zA-Z0-9-]*$/)
      .default(''),
    cv: z.object({ name: text(200), url }).optional(),
    trash: z.array(trashSchema).max(100).default([]),
  })
  .superRefine((d, ctx) => {
    if (new Set(d.sections).size !== d.sections.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate sections' });
    for (const group of [d.projects, d.posts, ...Object.values(d.items)])
      if (new Set(group.map((x) => x.id)).size !== group.length)
        ctx.addIssue({ code: 'custom', message: 'Duplicate IDs' });
    for (const key of Object.keys(d.items))
      if (!d.sections.includes(key))
        ctx.addIssue({ code: 'custom', message: 'Unknown section: ' + key });
  });
export type Content = z.infer<typeof contentSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Post = z.infer<typeof postSchema>;
export type Entry = z.infer<typeof itemSchema>;
export type Trash = z.infer<typeof trashSchema>;
export type ContentState = { version: number; data: Content };
export type Kind = 'projects' | 'posts' | 'items';
export type Language = 'vi' | 'en';
export type InboxMessage = {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  created_at: string;
};
export function publicContent(content: Content, now = Date.now()): Content {
  const d = structuredClone(content);
  d.trash = [];
  d.github = publicGithubSettings(d.github);
  const published = (e: {
    visible: boolean;
    visibility: string;
    displayAt?: string;
    status?: string;
  }) =>
    e.visible &&
    e.visibility === 'public' &&
    e.status !== 'Bản nháp' &&
    (!e.displayAt || new Date(e.displayAt).valueOf() <= now);
  d.projects = d.projects.filter(published);
  d.posts = d.posts.filter(published);
  for (const key of Object.keys(d.items))
    d.items[key] = d.hidden.includes(key) ? [] : d.items[key].filter(published);
  if (d.hidden.includes('Giới thiệu')) d.profile.about = '';
  return d;
}

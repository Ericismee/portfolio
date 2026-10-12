'use client';
import { localizedError } from '../lib/i18n';
import { useBackgroundRefresh } from './use-background-refresh';
import { sectionLabel } from '../lib/i18n';
import { MAX_UPLOAD_BYTES } from '../lib/upload-limits';
import { importContent } from '../lib/upload-client';
import Link from 'next/link';
import { GithubSettingsForm } from './github-settings';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  projectSchema,
  postSchema,
  itemSchema,
  publicationStatus,
  type Content,
  type ContentState,
  type Kind,
  type Project,
  type Post,
  type Entry,
  type InboxMessage,
  type Trash,
} from '../lib/schema';
import { entries, prepareLegacyImport, request, RequestError } from '../lib/client';
import { SkillManager } from './skill-manager';
import { trashEntry } from '../lib/content-management';
import { PostBody } from './post-body';
import { sortPosts } from '../lib/activity';
import { matchesSearch, projectMatchesSearch } from '../lib/search';
import { MarkdownContent } from './markdown-content';
import { projectUsesMarkdown, markdownSummary } from '../lib/markdown';
import { Icon } from './icon';
import { TrafficAdmin } from './traffic';
import { AccountSettings } from './account-settings';
import { AdminSkeleton } from './skeleton';
import { readRichText, richPlainText } from '../lib/rich-text';
import { saveGithubChanges } from '../lib/github-save';
import { applyTheme, readTheme, saveTheme, type Theme } from '../lib/theme';
import { LanguageProvider, useLanguage } from './language';
import { EditorDialog, FieldsForm, type Editor, type Field, type Values } from './admin-form';

type Tab =
  | 'profile'
  | 'projects'
  | 'posts'
  | 'sections'
  | 'skills'
  | 'github'
  | 'settings'
  | 'inbox'
  | 'traffic'
  | 'account'
  | 'trash';
type Revision = { id: number; created_at: string };
export function Admin() {
  return (
    <LanguageProvider>
      <AdminDashboard />
    </LanguageProvider>
  );
}
function AdminDashboard() {
  const { language, t, toggle } = useLanguage(),
    [state, setState] = useState<ContentState | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [tab, setTab] = useState<Tab>('profile'),
    [section, setSection] = useState(''),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [editor, setEditor] = useState<Editor | null>(null),
    [toast, setToast] = useState(''),
    [dirty, setDirty] = useState(false),
    [pending, setPending] = useState(false),
    [messages, setMessages] = useState<InboxMessage[]>([]),
    [csrfToken, setCsrfToken] = useState(''),
    [adminTheme, setAdminTheme] = useState<Theme | null>(null),
    csrf = useRef('');
  const themeLabel =
    adminTheme === 'dark'
      ? t('Chuyển sang chế độ sáng', 'Switch to light mode')
      : t('Chuyển sang chế độ tối', 'Switch to dark mode');
  const languageLabel = t('Chuyển sang tiếng Anh', 'Switch to Vietnamese');
  function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    setAdminTheme(next);
    saveTheme(state?.data.accent || '#4264da', next);
  }
  const api = useCallback(
    <T,>(url: string, method = 'GET', body?: unknown) =>
      request<T>(url, method, body, csrf.current),
    [],
  );
  // Session cookies stay HttpOnly. Only the matching CSRF token reaches React;
  // both are checked by the server for every administrative mutation.
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const session = await api<{ authenticated: boolean; csrf?: string }>('/api/session');
      csrf.current = session.csrf || '';
      setCsrfToken(csrf.current);
      if (session.authenticated) setState(await api<ContentState>('/api/admin/content'));
      else setState(null);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to connect');
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    void reload();
    setAdminTheme(readTheme(document.documentElement.dataset.theme));
  }, [reload]);
  useBackgroundRefresh(
    async (isCurrent) => {
      const next = await api<ContentState>('/api/admin/content');
      if (!isCurrent()) return;
      setState((previous) => (previous?.version === next.version ? previous : next));
      if (tab === 'inbox') {
        const result = await api<{ messages: InboxMessage[] }>('/api/admin/messages');
        if (isCurrent()) setMessages(result.messages);
      }
    },
    !!state && !dirty && !pending && !editor,
  );
  useEffect(() => {
    if (adminTheme) applyTheme(state?.data.accent || '#4264da', adminTheme);
  }, [adminTheme, state?.data.accent]);
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (tab === 'inbox' && state)
      api<{ messages: InboxMessage[] }>('/api/admin/messages')
        .then((result) => setMessages(result.messages))
        .catch((e) => setError(e.message));
  }, [tab, state, api]);
  const labels: Record<Tab, string> = {
    profile: t('Hồ sơ & liên hệ', 'Profile & contact'),
    projects: t('Dự án', 'Projects'),
    posts: t('Bài viết', 'Posts'),
    sections: t('Các mục hồ sơ', 'Profile sections'),
    skills: t('Kỹ năng', 'Skills'),
    github: 'GitHub',
    settings: t('Giao diện & dữ liệu', 'Appearance & data'),
    inbox: t('Hộp thư', 'Inbox'),
    traffic: t('Thống kê truy cập', 'Traffic statistics'),
    account: t('Tài khoản & bảo mật', 'Account & security'),
    trash: t('Thùng rác', 'Trash'),
  };
  useEffect(() => {
    const titles: Record<Tab, string> = {
      profile: 'Profile',
      projects: 'Projects',
      posts: 'Posts',
      sections: 'Sections',
      skills: 'Skills',
      github: 'GitHub',
      settings: 'Settings',
      inbox: 'Inbox',
      traffic: 'Traffic',
      account: 'Account',
      trash: 'Trash',
    };
    document.title = 'Eric | Admin · ' + titles[tab];
  }, [tab]);
  const field = (
    key: string,
    label: string,
    type: Field['type'] = 'text',
    required = false,
  ): Field => ({ key, label, type, required });
  const select = (key: string, label: string, options: [string, string][]): Field => ({
    key,
    label,
    type: 'select',
    options,
  });
  async function save(next: Content) {
    if (!state) throw Error('Please sign in');
    let result: ContentState;
    try {
      result = await api<ContentState>('/api/admin/content', 'PUT', {
        data: next,
        version: state.version,
      });
    } catch (e) {
      if (e instanceof RequestError && [401, 403, 409].includes(e.status)) setError(e.message);
      throw e;
    }
    setState(result);
    setDirty(false);
    setToast(t('Đã lưu trên máy chủ', 'Saved to server'));
  }
  async function mutate(change: (data: Content) => void) {
    if (!state) return;
    // A failed save leaves the last confirmed content intact in the dashboard.
    const next = structuredClone(state.data);
    change(next);
    await save(next);
  }
  async function action(run: () => Promise<unknown>) {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await run();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Không thể thực hiện', 'Action failed'));
    } finally {
      setPending(false);
    }
  }
  function navigate(next: Tab) {
    if (next === tab) return;
    if (dirty && !confirm(t('Bỏ các thay đổi chưa lưu?', 'Discard unsaved changes?'))) return;
    setDirty(false);
    setTab(next);
    setSection('');
    setQuery('');
    setFilter('all');
    setError('');
    window.scrollTo({ top: 0 });
  }
  const status = (p: Project | Post | Entry) =>
    ({
      draft: t('Bản nháp', 'Draft'),
      hidden: t('Đã ẩn', 'Hidden'),
      scheduled: t('Đã hẹn giờ', 'Scheduled'),
      public: t('Công khai', 'Published'),
    })[publicationStatus(p)];
  const confirmAction = (title: string, body: string, submit: () => Promise<void>) =>
    setEditor({
      title,
      body: <p>{body}</p>,
      submit,
      submitLabel:
        title.includes('Xóa') || title.includes('Delete')
          ? t('Xóa', 'Delete')
          : t('Xác nhận', 'Confirm'),
    });
  function localDate(value: string) {
    const d = new Date(value);
    return new Date(d.valueOf() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  function edit(kind: Kind, id?: string, sectionName = section) {
    if (!state) return;
    const p = entries(state.data, kind, sectionName).find((p) => p.id === id),
      values: Values = {
        visible: true,
        visibility: 'draft',
        ...Object.fromEntries(
          Object.entries(p || {}).filter(
            ([, v]) => typeof v === 'string' || typeof v === 'boolean',
          ),
        ),
      },
      fields: Field[] = [];
    if (kind === 'projects') {
      const project = p as Project | undefined;
      values.technologies = project?.technologies.join(', ') || '';
      values.imageFrame = project?.imageFrame || 'original';
      fields.push(
        field('name', t('Tên dự án', 'Project name'), 'text', true),
        field('description', t('Mô tả ngắn', 'Short description'), 'textarea'),
        field('tech', t('Công nghệ chính', 'Primary technology')),
        field(
          'technologies',
          t('Các công nghệ, cách nhau bằng dấu phẩy', 'Technologies, comma separated'),
        ),
        field('status', t('Trạng thái dự án', 'Project status')),
        ...(
          [
            ['role', t('Vai trò của bạn', 'Your role')],
            ['problem', t('Vấn đề', 'Problem')],
            ['contribution', t('Đóng góp', 'Contribution')],
            ['outcome', t('Kết quả', 'Outcome')],
            ['details', t('Chi tiết', 'Details')],
          ] as const
        ).map(([k, label]) => field(k, label, 'textarea')),
        select('detailsFormat', t('Định dạng phần chi tiết', 'Details format'), [
          ['auto', t('Tự nhận diện nội dung GitHub', 'Detect GitHub content')],
          ['plain', t('Văn bản nhập thủ công', 'Plain text')],
          ['markdown', 'Markdown'],
        ]),
        field('github', 'GitHub URL', 'url'),
        field('demo', 'Demo URL', 'url'),
        field('source', t('Nguồn tham khảo', 'Reference URL'), 'url'),
        field('thumbnail', t('Ảnh dự án', 'Project image'), 'image'),
        select('imageFrame', t('Khung ảnh (hiển thị trọn ảnh)', 'Image frame (show full image)'), [
          ['square', t('Vuông 1:1', 'Square 1:1')],
          ['landscape', t('Ngang 16:9', 'Landscape 16:9')],
          ['portrait', t('Dọc 3:4', 'Portrait 3:4')],
          ['original', t('Tỷ lệ gốc', 'Original ratio')],
          ['none', t('Không hiển thị ảnh', 'Hide image')],
        ]),
        field('pinned', t('Ghim trong mục nổi bật', 'Pin in featured section'), 'checkbox'),
      );
    } else if (kind === 'posts') {
      const post = p as Post | undefined;
      values.displayAt = localDate(post?.displayAt || post?.createdAt || new Date().toISOString());
      values.type = post?.type || 'Bài viết';
      values.richText = JSON.stringify(readRichText(post?.richText || '', post?.text || ''));
      fields.push(
        field('title', t('Tiêu đề', 'Title'), 'text', true),
        field('richText', t('Nội dung', 'Content'), 'richtext', true),
        select('type', t('Loại bài', 'Post type'), [
          ['Bài viết', t('Bài viết', 'Article')],
          ['Cập nhật dự án', t('Cập nhật dự án', 'Project update')],
          ['Media', 'Media'],
          ['Liên kết', t('Liên kết', 'Link')],
        ]),
        field('image', t('Ảnh đính kèm', 'Attached image'), 'image'),
        field('link', t('Liên kết', 'Link'), 'url'),
        {
          ...field('displayAt', t('Thời gian hiển thị', 'Display time'), 'datetime-local'),
          help: t(
            'Theo múi giờ trên thiết bị. Bài hẹn giờ chưa hiển thị công khai trước thời điểm này.',
            'Uses your device timezone. Scheduled posts stay private until this time.',
          ),
        },
      );
    } else
      fields.push(
        field('title', t('Tiêu đề / vai trò', 'Title / role'), 'text', true),
        field('organization', t('Tổ chức / đơn vị', 'Organization')),
        field('period', t('Thời gian', 'Period')),
        field('description', t('Nội dung', 'Description'), 'textarea'),
      );
    fields.push(
      select('visibility', t('Trạng thái xuất bản', 'Publishing status'), [
        ['draft', t('Lưu nháp', 'Draft')],
        ['public', t('Xuất bản', 'Publish')],
      ]),
      field('visible', t('Hiển thị trên trang công khai', 'Visible on public site'), 'checkbox'),
    );
    setEditor({
      title: id ? t('Chỉnh sửa nội dung', 'Edit content') : t('Thêm nội dung', 'Add content'),
      knownRepositories: (kind === 'projects' ? state!.data.projects : state!.data.posts)
        .filter((item) => item.id !== id)
        .map((item) => ('github' in item ? item.github : item.link)),
      githubUsername:
        kind === 'projects' || kind === 'posts' ? state.data.githubUsername : undefined,
      fields,
      values,
      submit: async (v) =>
        mutate((d) => {
          const input = { ...p, ...v, id: id || crypto.randomUUID(), sample: false };
          if (kind === 'projects') {
            const next = projectSchema.parse({
              ...input,
              technologies: String(v.technologies || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            });
            d.projects = id
              ? d.projects.map((p) => (p.id === id ? next : p))
              : [...d.projects, next];
          } else if (kind === 'posts') {
            const next = postSchema.parse({
              ...input,
              text:
                v.bodyFormat === 'markdown'
                  ? String(v.markdown || '')
                  : richPlainText(String(v.richText || '')),
              createdAt: (p as Post | undefined)?.createdAt || new Date().toISOString(),
              displayAt: v.displayAt
                ? new Date(String(v.displayAt)).toISOString()
                : new Date().toISOString(),
            });
            d.posts = id ? d.posts.map((p) => (p.id === id ? next : p)) : [...d.posts, next];
          } else {
            const next = itemSchema.parse(input);
            d.items[sectionName] = id
              ? (d.items[sectionName] || []).map((p) => (p.id === id ? next : p))
              : [...(d.items[sectionName] || []), next];
          }
        }),
    });
  }
  function remove(kind: Kind, id: string, sectionName = section) {
    confirmAction(
      t('Xóa nội dung?', 'Delete this entry?'),
      t(
        'Nội dung chuyển vào thùng rác và có thể khôi phục.',
        'The entry moves to trash and can be restored.',
      ),
      () =>
        mutate((d) => {
          trashEntry(d, kind, sectionName, id, crypto.randomUUID());
        }),
    );
  }
  function preview(p: Project | Post | Entry, deleted?: Trash) {
    const image = 'thumbnail' in p ? p.thumbnail : 'image' in p ? p.image : '';
    setEditor({
      title: 'name' in p ? p.name : p.title,
      body: (
        <>
          {deleted ? (
            <div className="trash-preview-notice">
              <Icon name="trash" />
              <div>
                <strong>{t('Nội dung đã xóa', 'Deleted content')}</strong>
                <p>
                  {t('Đã xóa lúc', 'Deleted at')}{' '}
                  {new Date(deleted.deletedAt).toLocaleString(language)}
                </p>
                <p>
                  {t(
                    'Khôi phục từ danh sách để lưu lại dưới dạng nháp.',
                    'Restore from the list to save this entry as a draft.',
                  )}
                </p>
              </div>
            </div>
          ) : (
            <span className="badge">{status(p)}</span>
          )}
          {image && <img className="admin-asset" src={image} alt="" />}
          {'organization' in p && (
            <p className="muted">{[p.organization, p.period].filter(Boolean).join(' · ')}</p>
          )}
          {'createdAt' in p && p.createdAt && (
            <p className="muted">
              {t('Ngày tạo', 'Created at')}: {new Date(p.createdAt).toLocaleString(language)}
            </p>
          )}
          {'text' in p ? (
            <PostBody
              value={p.bodyFormat === 'markdown' ? '' : p.richText}
              text={p.text}
              markdown={p.bodyFormat === 'markdown' ? p.markdown : ''}
              base={p.markdownBase}
              detail
            />
          ) : (
            <p className="preserve">{p.description}</p>
          )}
          {'details' in p &&
            (projectUsesMarkdown(p) ? (
              <MarkdownContent value={p.details} base={p.detailsBase} />
            ) : (
              <p className="preserve">{p.details}</p>
            ))}
          {'tech' in p && (
            <dl className="preview-facts">
              {[
                [
                  t('Công nghệ', 'Technologies'),
                  p.technologies.length ? p.technologies.join(', ') : p.tech,
                ],
                [t('Trạng thái dự án', 'Project status'), p.status],
                [t('Vai trò', 'Role'), p.role],
                [t('Vấn đề', 'Problem'), p.problem],
                [t('Đóng góp', 'Contribution'), p.contribution],
                [t('Kết quả', 'Outcome'), p.outcome],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd className="preserve">{value}</dd>
                  </div>
                ))}
            </dl>
          )}
          <div className="preview-links">
            {('github' in p
              ? [
                  ['GitHub', p.github],
                  [t('Bản chạy thử', 'Demo'), p.demo],
                  [t('Nguồn', 'Source'), p.source],
                ]
              : 'link' in p
                ? [[t('Liên kết', 'Link'), p.link]]
                : []
            )
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <a key={label} href={value} target="_blank" rel="noopener noreferrer">
                  {label} ↗
                </a>
              ))}
          </div>
          <p className="admin-help">
            {deleted
              ? t(
                  'Bản xem chỉ đọc; nội dung này chưa được khôi phục hoặc đăng lại.',
                  'Read-only preview; this entry has not been restored or republished.',
                )
              : t(
                  'Xem trước nội dung. Chỉ bản công khai mới xuất hiện trên website.',
                  'Content preview. Only published entries appear on the website.',
                )}
          </p>
        </>
      ),
    });
  }
  function rows(kind: Kind, sectionName = '') {
    if (!state) return null;
    const group = entries(state.data, kind, sectionName),
      list = (kind === 'posts' ? sortPosts(group as Post[]) : group)
        .filter(
          (p) =>
            !query.trim() ||
            ('name' in p
              ? projectMatchesSearch(p, query)
              : matchesSearch(
                  [
                    p.title,
                    'text' in p
                      ? [p.text, p.markdown, richPlainText(p.richText)]
                      : [p.description, p.organization, p.period],
                  ],
                  query,
                )),
        )
        .filter((p) => filter === 'all' || publicationStatus(p) === filter);
    return (
      <>
        <div className="admin-tools">
          <input
            aria-label={t('Tìm nội dung', 'Search content')}
            placeholder={t('Tìm tiêu đề hoặc nội dung…', 'Search title or content…')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label={t('Lọc nội dung', 'Filter content')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {[
              ['all', t('Tất cả', 'All')],
              ['public', t('Công khai', 'Published')],
              ['draft', t('Bản nháp', 'Draft')],
              ...(kind === 'posts' ? [['scheduled', t('Đã hẹn giờ', 'Scheduled')]] : []),
              ['hidden', t('Đã ẩn', 'Hidden')],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <p className="admin-help">
          {kind === 'posts'
            ? t(
                'Bài mới nhất hiển thị trước, theo thời gian đăng. Sửa thời gian đăng trong biểu mẫu để thay đổi vị trí.',
                'Newest posts appear first by publication time. Edit a post’s publication time to change its position.',
              )
            : t('Dùng ↑ ↓ để đổi thứ tự hiển thị.', 'Use ↑ ↓ to change display order.')}
        </p>
        {list.map((p) => {
          const index = group.indexOf(p),
            move = (delta: number) =>
              action(() =>
                mutate((d) => {
                  const arr = entries(d, kind, sectionName),
                    i = arr.findIndex((x) => x.id === p.id),
                    j = i + delta;
                  if (j >= 0 && j < arr.length) [arr[i], arr[j]] = [arr[j], arr[i]];
                }),
              );
          return (
            <article className="admin-row" data-publication={publicationStatus(p)} key={p.id}>
              <div className="admin-row-content">
                <h3>{'name' in p ? p.name : p.title}</h3>
                <p className="muted">
                  {('text' in p
                    ? p.bodyFormat === 'markdown'
                      ? markdownSummary(p.markdown)
                      : richPlainText(p.richText) || p.text
                    : p.description
                  ).slice(0, 140)}
                </p>
                <span className="badge">{status(p)}</span>
                {'displayAt' in p && p.displayAt && (
                  <time dateTime={p.displayAt} className="muted">
                    {new Date(p.displayAt).toLocaleString(language)}
                  </time>
                )}
              </div>
              <div className="actions">
                {kind !== 'posts' && (
                  <>
                    <button
                      className="btn neutral"
                      aria-label={t('Di chuyển lên', 'Move up')}
                      disabled={pending || index === 0}
                      onClick={() => void move(-1)}
                    >
                      ↑
                    </button>
                    <button
                      className="btn neutral"
                      aria-label={t('Di chuyển xuống', 'Move down')}
                      disabled={pending || index === group.length - 1}
                      onClick={() => void move(1)}
                    >
                      ↓
                    </button>
                  </>
                )}
                <button className="btn neutral" onClick={() => preview(p)}>
                  {t('Xem', 'Preview')}
                </button>
                <button className="btn neutral" onClick={() => edit(kind, p.id, sectionName)}>
                  {t('Sửa', 'Edit')}
                </button>
                <button
                  className="btn neutral"
                  disabled={pending}
                  onClick={() =>
                    void action(() =>
                      mutate((d) => {
                        const item = entries(d, kind, sectionName).find((x) => x.id === p.id)!;
                        item.visible = !item.visible;
                      }),
                    )
                  }
                >
                  {p.visible ? t('Ẩn', 'Hide') : t('Hiện', 'Show')}
                </button>
                <button
                  className="btn neutral danger"
                  onClick={() => remove(kind, p.id, sectionName)}
                >
                  {t('Xóa', 'Delete')}
                </button>
              </div>
            </article>
          );
        })}
        {!list.length && (
          <div className="empty">{t('Chưa có nội dung phù hợp.', 'No matching content.')}</div>
        )}
      </>
    );
  }
  function importData(input: unknown) {
    const prepared = prepareLegacyImport(input);
    confirmAction(
      t('Nhập dữ liệu?', 'Import data?'),
      t(
        'Thay thế nội dung hiện tại. Một phiên bản khôi phục sẽ được giữ lại.',
        'Replace current content. A recovery revision will be retained.',
      ),
      async () => {
        setState(await importContent(prepared, state!.version, csrf.current));
        setDirty(false);
        setToast(t('Đã nhập dữ liệu', 'Data imported'));
      },
    );
  }
  function revisions() {
    void action(async () => {
      const { revisions } = await api<{ revisions: Revision[] }>('/api/admin/revisions');
      setEditor({
        title: t('Lịch sử phiên bản', 'Revision history'),
        body: (
          <>
            {revisions.length ? (
              revisions.map((r) => (
                <div className="admin-row" key={r.id}>
                  <time dateTime={r.created_at}>
                    {new Date(r.created_at).toLocaleString(language)}
                  </time>
                  <button
                    className="btn neutral"
                    onClick={() =>
                      confirmAction(
                        t('Khôi phục phiên bản?', 'Restore revision?'),
                        t(
                          'Khôi phục toàn bộ nội dung và giao diện. Phiên bản hiện tại cũng được giữ lại.',
                          'Restore all content and appearance. The current version will also be retained.',
                        ),
                        async () => {
                          setState(
                            await api<ContentState>('/api/admin/restore', 'POST', {
                              id: r.id,
                              version: state!.version,
                            }),
                          );
                          setToast(t('Đã khôi phục', 'Revision restored'));
                        },
                      )
                    }
                  >
                    {t('Khôi phục', 'Restore')}
                  </button>
                </div>
              ))
            ) : (
              <p>{t('Chưa có phiên bản cũ.', 'No previous revisions.')}</p>
            )}
          </>
        ),
      });
    });
  }
  let body: ReactNode = null;
  if (state) {
    const d = state.data;
    if (tab === 'github')
      body = (
        <GithubSettingsForm
          formId="admin-content-form"
          key={'github:' + state.version}
          initial={d.github}
          initialUsername={d.githubUsername}
          onDirty={setDirty}
          save={async (settings, username, resolve) => {
            const result = await saveGithubChanges(d, settings, username, csrfToken, resolve);
            setState(result);
            setDirty(false);
            setError('');
            setToast(t('Đã lưu trên máy chủ', 'Saved to server'));
          }}
        />
      );
    if (tab === 'profile') {
      const fields: Field[] = [
        field('name', t('Tên hiển thị', 'Display name'), 'text', true),
        field('headline', t('Chuyên môn', 'Headline')),
        field('summary', t('Giới thiệu ngắn', 'Short introduction')),
        field('location', t('Địa điểm', 'Location'), 'location'),
        field('about', t('Giới thiệu', 'About'), 'textarea'),
        field('avatar', t('Ảnh đại diện', 'Avatar'), 'image'),
        field('cover', t('Ảnh bìa', 'Cover image'), 'image'),
        ...['email', 'github', 'linkedin', 'website', 'facebook', 'instagram'].map((key) =>
          field(
            'link_' + key,
            key === 'email' ? 'Email' : key[0].toUpperCase() + key.slice(1),
            key === 'email' ? 'email' : 'url',
          ),
        ),
        field('cv', t('CV tải xuống', 'Downloadable CV'), 'pdf'),
      ];
      const initial: Values = {
        ...d.profile,
        cv: d.cv?.url || '',
        cvName: d.cv?.name || 'CV.pdf',
        ...Object.fromEntries(
          ['email', 'github', 'linkedin', 'website', 'facebook', 'instagram'].map((k) => [
            'link_' + k,
            d.links[k] || '',
          ]),
        ),
      };
      body = (
        <>
          <p className="admin-help">
            {t(
              'Chỉ thêm thông tin bạn muốn công khai. Ảnh có thể bổ sung sau.',
              'Only add information you want to share publicly. You can upload images later.',
            )}
          </p>
          <FieldsForm
            key={tab + ':' + state.version}
            formId="admin-content-form"
            fields={fields}
            initial={initial}
            csrf={csrfToken}
            onDirty={setDirty}
            submit={(v) =>
              mutate((d) => {
                for (const key of [
                  'name',
                  'headline',
                  'summary',
                  'location',
                  'about',
                  'avatar',
                  'cover',
                ] as const)
                  d.profile[key] = String(v[key] || '');
                for (const key of [
                  'email',
                  'github',
                  'linkedin',
                  'website',
                  'facebook',
                  'instagram',
                ])
                  d.links[key] = String(v['link_' + key] || '');
                d.cv = v.cv ? { name: String(v.cvName || 'CV.pdf'), url: String(v.cv) } : undefined;
              })
            }
          />
        </>
      );
    }
    if (tab === 'projects' || tab === 'posts') body = rows(tab);
    if (tab === 'sections')
      body = section ? (
        <>
          <div className="admin-title">
            <button className="btn neutral" onClick={() => setSection('')}>
              ← {t('Các mục hồ sơ', 'Profile sections')}
            </button>
            <button className="btn primary" onClick={() => edit('items')}>
              {t('＋ Thêm nội dung', '＋ Add entry')}
            </button>
          </div>
          <h3>{sectionLabel(section, d.sectionTitles[section], language)}</h3>
          {rows('items', section)}
        </>
      ) : (
        <>
          <p className="admin-help">
            {t(
              'Đổi tên, sắp xếp và ẩn từng mục. Ẩn mục chỉ ảnh hưởng trang hồ sơ; dự án và bài viết vẫn có trang riêng.',
              'Rename, reorder and hide sections. Hiding a section affects the profile; projects and posts keep their own pages.',
            )}
          </p>
          <button
            className="btn primary"
            onClick={() =>
              setEditor({
                title: t('Tạo mục hồ sơ', 'Create profile section'),
                fields: [field('title', t('Tên mục', 'Section name'), 'text', true)],
                submit: async (v) =>
                  mutate((d) => {
                    const name = String(v.title).trim();
                    if (d.sections.includes(name))
                      throw Error(t('Tên mục đã tồn tại', 'Section already exists'));
                    d.sections.push(name);
                    d.sectionTitles[name] = name;
                    d.items[name] = [];
                  }),
              })
            }
          >
            {t('＋ Tạo mục', '＋ Create section')}
          </button>
          {d.sections.map((s, i) => (
            <article
              className="admin-row"
              data-publication={d.hidden.includes(s) ? 'hidden' : 'public'}
              key={s}
            >
              <div>
                <h3>{sectionLabel(s, d.sectionTitles[s], language)}</h3>
                <span className="badge">
                  {d.hidden.includes(s) ? t('Đã ẩn', 'Hidden') : t('Đang hiển thị', 'Visible')}
                </span>
              </div>
              <div className="actions">
                {[-1, 1].map((delta) => (
                  <button
                    className="btn neutral"
                    key={delta}
                    aria-label={
                      delta === -1
                        ? t('Di chuyển lên', 'Move up')
                        : t('Di chuyển xuống', 'Move down')
                    }
                    disabled={pending || i + delta < 0 || i + delta >= d.sections.length}
                    onClick={() =>
                      void action(() =>
                        mutate((d) => {
                          [d.sections[i], d.sections[i + delta]] = [
                            d.sections[i + delta],
                            d.sections[i],
                          ];
                        }),
                      )
                    }
                  >
                    {delta === -1 ? '↑' : '↓'}
                  </button>
                ))}
                <button
                  className="btn neutral"
                  onClick={() =>
                    setEditor({
                      title: t('Đổi tiêu đề mục', 'Rename section'),
                      fields: [
                        field('title', t('Tiêu đề hiển thị', 'Display title'), 'text', true),
                      ],
                      values: { title: d.sectionTitles[s] || s },
                      submit: (v) =>
                        mutate((d) => {
                          d.sectionTitles[s] = String(v.title);
                        }),
                    })
                  }
                >
                  {t('Đổi tên', 'Rename')}
                </button>
                <button
                  className="btn neutral"
                  disabled={pending}
                  onClick={() =>
                    void action(() =>
                      mutate((d) => {
                        d.hidden = d.hidden.includes(s)
                          ? d.hidden.filter((x) => x !== s)
                          : [...d.hidden, s];
                      }),
                    )
                  }
                >
                  {d.hidden.includes(s) ? t('Hiện', 'Show') : t('Ẩn', 'Hide')}
                </button>
                {
                  <>
                    <button
                      className="btn neutral"
                      onClick={() => {
                        if (['Nổi bật', 'Dự án'].includes(s)) setTab('projects');
                        else if (s === 'Hoạt động') setTab('posts');
                        else if (s === 'Kỹ năng') setTab('skills');
                        else if (s === 'Giới thiệu') setTab('profile');
                        else setSection(s);
                        setQuery('');
                        setFilter('all');
                      }}
                    >
                      {t('Nội dung', 'Entries')}
                    </button>
                    <button
                      className="btn neutral danger"
                      onClick={() =>
                        confirmAction(
                          t('Xóa mục?', 'Delete section?'),
                          t(
                            'Xóa mục khỏi hồ sơ. Nội dung của mục tùy chỉnh chuyển vào thùng rác; dự án và bài viết vẫn được quản lý riêng. Có thể khôi phục mục từ lịch sử phiên bản.',
                            'Remove the profile section. Custom entries move to trash; projects and posts remain in their own lists. Restore the section from revision history.',
                          ),
                          () =>
                            mutate((d) => {
                              for (const item of [...(d.items[s] || [])])
                                trashEntry(d, 'items', s, item.id, crypto.randomUUID());
                              d.sections = d.sections.filter((x) => x !== s);
                              d.hidden = d.hidden.filter((x) => x !== s);
                              delete d.items[s];
                              delete d.sectionTitles[s];
                            }),
                        )
                      }
                    >
                      {t('Xóa mục', 'Delete section')}
                    </button>
                  </>
                }
              </div>
            </article>
          ))}
        </>
      );
    if (tab === 'skills')
      body = (
        <SkillManager
          key={tab}
          skills={d.skills}
          hidden={d.hiddenSkills}
          onDirty={setDirty}
          save={async (skills, hiddenSkills) =>
            mutate((d) => {
              d.skills = skills;
              d.hiddenSkills = hiddenSkills;
            })
          }
        />
      );
    if (tab === 'settings')
      body = (
        <>
          <FieldsForm
            key={tab + ':' + state.version}
            formId="admin-content-form"
            csrf={csrfToken}
            onDirty={setDirty}
            fields={[
              field('logo', t('Logo website', 'Website logo'), 'image'),
              field('accent', t('Màu chủ đạo', 'Accent color'), 'color'),
              field(
                'showVisitorCount',
                t('Hiển thị bộ đếm lượt truy cập công khai', 'Show public visitor counter'),
                'checkbox',
              ),
              select('theme', t('Giao diện', 'Theme'), [
                ['light', t('Sáng', 'Light')],
                ['dark', t('Tối', 'Dark')],
              ]),
              select('density', t('Khoảng cách', 'Density'), [
                ['comfortable', t('Thoáng', 'Comfortable')],
                ['compact', t('Gọn', 'Compact')],
              ]),
              select('layout', t('Bố cục', 'Layout'), [
                ['standard', t('Tiêu chuẩn', 'Standard')],
                ['wide', t('Rộng', 'Wide')],
              ]),
            ]}
            initial={{
              logo: d.profile.logo,
              accent: d.accent,
              theme: d.theme,
              showVisitorCount: d.showVisitorCount,
              density: d.density,
              layout: d.layout,
            }}
            submit={(v) =>
              mutate((d) => {
                d.profile.logo = String(v.logo || '');
                d.accent = String(v.accent);
                d.theme = v.theme === 'dark' ? 'dark' : 'light';
                d.showVisitorCount = !!v.showVisitorCount;
                d.density = v.density === 'compact' ? 'compact' : 'comfortable';
                d.layout = v.layout === 'wide' ? 'wide' : 'standard';
              })
            }
          />
          <hr />
          <h3>{t('Dữ liệu & khôi phục', 'Data & recovery')}</h3>
          <p className="admin-help">
            {t(
              'Giữ 30 phiên bản gần nhất. Bản xuất chứa cả nội dung nháp; hãy giữ riêng tư.',
              'Retains the latest 30 revisions. Exports contain drafts; keep them private.',
            )}
          </p>
          <div className="actions">
            <button
              className="btn neutral"
              onClick={() => {
                const url = URL.createObjectURL(
                    new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }),
                  ),
                  a = document.createElement('a');
                a.href = url;
                a.download = 'profile-backup-' + new Date().toISOString().slice(0, 10) + '.json';
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              {t('Xuất JSON', 'Export JSON')}
            </button>
            <button
              className="btn neutral"
              onClick={() => {
                try {
                  const raw = localStorage.getItem('eric-profile-mock');
                  if (!raw)
                    throw Error(
                      t(
                        'Không có dữ liệu demo ở origin này. Nhập file JSON đã xuất.',
                        'No demo data at this origin. Import an exported JSON file.',
                      ),
                    );
                  importData(JSON.parse(raw));
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Invalid file');
                }
              }}
            >
              {t('Nhập bản demo cũ', 'Import previous demo')}
            </button>
            <button className="btn neutral" onClick={revisions}>
              {t('Lịch sử phiên bản', 'Revision history')}
            </button>
          </div>
          <label>
            {t('Nhập dữ liệu JSON', 'Import JSON')}
            <input
              type="file"
              accept="application/json"
              onChange={async (e) => {
                try {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > MAX_UPLOAD_BYTES)
                    throw Error(t('File quá lớn', 'File too large'));
                  importData(JSON.parse(await file.text()));
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Invalid file');
                }
              }}
            />
          </label>
          <p className="admin-help">
            {t(
              'Ảnh và cơ sở dữ liệu nằm trong DATA_DIR. Sao lưu toàn bộ thư mục; JSON không chứa file ảnh đã tải lên.',
              'Images and the database live in DATA_DIR. Back up the entire directory; JSON excludes uploaded image files.',
            )}
          </p>
        </>
      );
    if (tab === 'trash')
      body = (
        <>
          <p className="admin-help">
            {t(
              'Giữ tối đa 100 nội dung đã xóa. Khôi phục về dạng nháp để bạn kiểm tra.',
              'Retains up to 100 deleted entries. Restored entries become drafts for review.',
            )}
          </p>
          {d.trash.length ? (
            d.trash.map((r) => (
              <article className="admin-row" key={r.id}>
                <div>
                  <h3>{'name' in r.value ? r.value.name : r.value.title}</h3>
                  <p className="muted">
                    {r.section
                      ? sectionLabel(r.section, d.sectionTitles[r.section], language)
                      : {
                          projects: t('Dự án', 'Projects'),
                          posts: t('Bài viết', 'Posts'),
                          items: t('Nội dung', 'Content'),
                        }[r.kind]}{' '}
                    · {new Date(r.deletedAt).toLocaleString(language)}
                  </p>
                </div>
                <div className="admin-row-actions">
                  <button type="button" className="btn neutral" onClick={() => preview(r.value, r)}>
                    <Icon name="eye" /> {t('Xem chi tiết', 'View details')}
                  </button>
                  <button
                    className="btn neutral"
                    disabled={pending}
                    onClick={() =>
                      void action(() =>
                        mutate((d) => {
                          if (entries(d, r.kind, r.section).some((e) => e.id === r.value.id))
                            throw Error('Entry ID already exists');
                          if (r.kind === 'projects')
                            d.projects.push({ ...r.value, visibility: 'draft' });
                          else if (r.kind === 'posts')
                            d.posts.push({ ...r.value, visibility: 'draft' });
                          else {
                            if (!d.sections.includes(r.section)) d.sections.push(r.section);
                            (d.items[r.section] ??= []).push({ ...r.value, visibility: 'draft' });
                          }
                          d.trash = d.trash.filter((x) => x.id !== r.id);
                        }),
                      )
                    }
                  >
                    {t('Khôi phục', 'Restore')}
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="empty">{t('Thùng rác trống.', 'Trash is empty.')}</div>
          )}
        </>
      );
    if (tab === 'traffic') body = <TrafficAdmin />;
    if (tab === 'account')
      body = (
        <AccountSettings
          csrf={csrfToken}
          onDirty={setDirty}
          onSessionChange={(value) => {
            csrf.current = value;
            setCsrfToken(value);
          }}
        />
      );
    if (tab === 'inbox')
      body = (
        <>
          <p className="admin-help">
            {t(
              'Lời nhắn được lưu trực tiếp từ biểu mẫu liên hệ. Bấm email để trả lời bằng ứng dụng thư của bạn.',
              'Messages are stored from the contact form. Click an email to reply in your mail app.',
            )}
          </p>
          {messages.length ? (
            messages.map((m) => (
              <article className="admin-row" key={m.id}>
                <div>
                  <h3>{m.subject}</h3>
                  <p>
                    {m.name} · <a href={'mailto:' + m.email}>{m.email}</a> ·{' '}
                    {new Date(m.created_at).toLocaleString(language)}
                  </p>
                  <p className="inbox-message">{m.message}</p>
                </div>
                <button
                  className="btn neutral danger"
                  onClick={() =>
                    confirmAction(
                      t('Xóa lời nhắn?', 'Delete message?'),
                      t(
                        'Lời nhắn sẽ bị xóa vĩnh viễn.',
                        'This message will be permanently deleted.',
                      ),
                      async () => {
                        await api('/api/admin/messages', 'DELETE', { id: m.id });
                        setMessages((prev) => prev.filter((x) => x.id !== m.id));
                      },
                    )
                  }
                >
                  {t('Xóa', 'Delete')}
                </button>
              </article>
            ))
          ) : (
            <div className="empty">{t('Chưa có lời nhắn.', 'No messages yet.')}</div>
          )}
        </>
      );
  }
  return (
    <div className={'admin-page' + (!state && !loading ? ' admin-signin-page' : '')}>
      {loading ? (
        <AdminSkeleton />
      ) : !state ? (
        <main className="card admin-login">
          <div className="signin-brand">
            <span aria-hidden="true">
              <Icon name="lock" />
            </span>
            <div>
              <strong>Eric</strong>
              <small>{t('Không gian quản trị', 'Admin workspace')}</small>
            </div>
          </div>
          <h1>{t('Chào mừng trở lại', 'Welcome back')}</h1>
          <p className="admin-help">
            {t(
              'Đăng nhập để quản lý nội dung và giao diện.',
              'Sign in to manage your content and appearance.',
            )}
          </p>
          <FieldsForm
            csrf=""
            submitLabel={t('Đăng nhập', 'Sign in')}
            fields={[
              field('username', t('Tên đăng nhập', 'Username'), 'text', true),
              field('password', t('Mật khẩu', 'Password'), 'password', true),
              {
                key: 'code',
                label: t('Mã xác thực hai bước', 'Two-factor code'),
                autoComplete: 'one-time-code',
                help: t(
                  'Nhập mã ứng dụng xác thực hoặc mã khôi phục nếu đã bật 2FA.',
                  'Enter an authenticator or recovery code if you enabled 2FA.',
                ),
              },
            ]}
            initial={{ username: '', password: '' }}
            submit={async (v) => {
              const session = await api<{ csrf: string }>('/api/login', 'POST', v);
              csrf.current = session.csrf;
              setCsrfToken(session.csrf);
              setState(await api<ContentState>('/api/admin/content'));
              setError('');
            }}
          />
          <div className="signin-footer">
            <Link href="/">{t('← Xem trang công khai', '← View public site')}</Link>
            <div>
              <button
                type="button"
                className="btn neutral admin-icon-control"
                aria-label={themeLabel}
                title={themeLabel}
                aria-pressed={adminTheme === 'dark'}
                onClick={toggleTheme}
              >
                <Icon name={adminTheme === 'dark' ? 'sun' : 'moon'} />
              </button>
              <button
                className="btn neutral admin-icon-control"
                aria-label={languageLabel}
                title={languageLabel}
                onClick={toggle}
              >
                <Icon name="languages" />
              </button>
            </div>
          </div>
          {error && (
            <>
              <p className="form-error" role="alert">
                {localizedError(error, language)}
              </p>
              <button className="btn neutral" onClick={() => void reload()}>
                {t('Thử lại', 'Retry')}
              </button>
            </>
          )}
        </main>
      ) : (
        <>
          <a className="skip-link" href="#admin-main">
            {t('Đến nội dung', 'Skip to content')}
          </a>
          <div className="admin-header">
            <div className="admin-brand">
              <span className="admin-brand-mark" aria-hidden="true">
                {state.data.profile.logo ? (
                  <img src={state.data.profile.logo} alt="" />
                ) : (
                  <img src="/brand-terminal.svg" alt="" />
                )}
              </span>
              <div>
                <h1>{t('Quản trị hồ sơ', 'Profile admin')}</h1>
                <p>{state.data.profile.name}</p>
              </div>
            </div>
            <div className="actions">
              <Link className="btn neutral" href="/" target="_blank" rel="noopener noreferrer">
                {t('Xem website ↗', 'View website ↗')}
              </Link>
              <button
                className="btn neutral admin-icon-control"
                aria-label={themeLabel}
                title={themeLabel}
                aria-pressed={adminTheme === 'dark'}
                onClick={toggleTheme}
              >
                <Icon name={adminTheme === 'dark' ? 'sun' : 'moon'} />
              </button>
              <button
                className="btn neutral admin-icon-control"
                aria-label={languageLabel}
                title={languageLabel}
                onClick={toggle}
              >
                <Icon name="languages" />
              </button>
              <button
                className="btn neutral"
                onClick={() =>
                  void action(async () => {
                    if (
                      dirty &&
                      !confirm(t('Bỏ các thay đổi chưa lưu?', 'Discard unsaved changes?'))
                    )
                      return;
                    await api('/api/admin/logout', 'POST', {});
                    setState(null);
                    setDirty(false);
                  })
                }
              >
                {t('Đăng xuất', 'Sign out')}
              </button>
            </div>
          </div>
          <div className="admin-shell">
            <label className="admin-mobile-navigation">
              {t('Chọn mục quản trị', 'Choose an admin section')}
              <select value={tab} onChange={(event) => navigate(event.target.value as Tab)}>
                {Object.entries(labels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <nav className="admin-nav" aria-label={t('Quản trị', 'Administration')}>
              <p className="admin-nav-label">{t('Không gian quản trị', 'Workspace')}</p>
              {Object.entries(labels).map(([key, label]) => (
                <button
                  key={key}
                  aria-current={key === tab ? 'page' : undefined}
                  onClick={() => navigate(key as Tab)}
                >
                  <Icon
                    name={
                      (
                        {
                          profile: 'profile',
                          projects: 'projects',
                          posts: 'feed',
                          sections: 'sections',
                          skills: 'skills',
                          github: 'github',
                          settings: 'settings',
                          inbox: 'contact',
                          traffic: 'eye',
                          account: 'lock',
                          trash: 'trash',
                        } as Record<string, string>
                      )[key]
                    }
                  />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
            <main className="admin-content" id="admin-main">
              <div className="admin-title">
                <div>
                  <p className="admin-eyebrow">{t('Quản lý nội dung', 'Content management')}</p>
                  <h2>{labels[tab]}</h2>
                </div>
                {['profile', 'settings', 'github'].includes(tab) && (
                  <button
                    className="btn primary"
                    type="submit"
                    form="admin-content-form"
                    disabled={pending}
                  >
                    {t('Lưu thay đổi', 'Save changes')}
                  </button>
                )}
                {(tab === 'projects' || tab === 'posts') && (
                  <button className="btn primary" onClick={() => edit(tab)}>
                    {t('＋ Thêm mới', '＋ Add new')}
                  </button>
                )}
              </div>
              {error && (
                <div role="alert" className="admin-intro">
                  <p className="form-error">{localizedError(error, language)}</p>
                  <button
                    className="btn neutral"
                    onClick={() => {
                      if (
                        !dirty ||
                        confirm(
                          t(
                            'Tải lại sẽ bỏ thay đổi chưa lưu. Tiếp tục?',
                            'Reloading discards unsaved changes. Continue?',
                          ),
                        )
                      )
                        void reload();
                    }}
                  >
                    {t('Tải lại dữ liệu', 'Reload data')}
                  </button>
                </div>
              )}
              {pending && <p role="status">{t('Đang lưu…', 'Saving…')}</p>}
              <section className="card pad">{body}</section>
            </main>
          </div>
        </>
      )}
      {editor && (
        <EditorDialog
          key={editor.title + JSON.stringify(editor.values)}
          editor={editor}
          close={() => setEditor(null)}
          csrf={csrfToken}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

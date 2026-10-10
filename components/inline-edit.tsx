'use client';
import { GithubSettingsForm } from './github-settings';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { request, entries } from '../lib/client';
import {
  publicContent,
  projectSchema,
  postSchema,
  itemSchema,
  type Content,
  type ContentState,
  type Kind,
  type Project,
  type Post,
} from '../lib/schema';
import { EditorDialog, type Editor, type Field, type Values } from './admin-form';
import { useLanguage } from './language';
import { Icon } from './icon';

// Private content is fetched only after the server confirms an admin session.
// The profile itself still renders the public projection, including after saves.
export function useInlineEdit(publicData: Content) {
  const { t } = useLanguage();
  const router = useRouter();
  const [state, setState] = useState<ContentState | null>(null);
  const [csrf, setCsrf] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    let active = true;
    async function sync() {
      try {
        const session = await request<{ authenticated: boolean; csrf?: string }>('/api/session');
        const next = session.authenticated
          ? await request<ContentState>('/api/admin/content')
          : null;
        if (active) {
          setState(next);
          setCsrf(session.csrf || '');
          if (!next) setEditor(null);
        }
      } catch {
        if (active) {
          setState(null);
          setCsrf('');
          setEditor(null);
        }
      }
    }
    void sync();
    window.addEventListener('focus', sync);
    return () => {
      active = false;
      window.removeEventListener('focus', sync);
    };
  }, []);
  function open(next: Editor) {
    setEditorKey((key) => key + 1);
    setEditor(next);
    setNotice('');
  }
  async function save(change: (data: Content) => void) {
    if (!state) throw Error(t('Vui lòng đăng nhập quản trị.', 'Please sign in as administrator.'));
    const data = structuredClone(state.data);
    change(data);
    // Use the version that the editor was opened with. Concurrent edits cause a
    // conflict rather than overwriting another tab's newer content.
    const next = await request<ContentState>(
      '/api/admin/content',
      'PUT',
      { data, version: state.version },
      csrf,
    );
    setState(next);
    setNotice(t('Đã lưu thay đổi.', 'Changes saved.'));
    router.refresh();
  }
  const field = (
    key: string,
    label: string,
    type: Field['type'] = 'text',
    required = false,
  ): Field => ({ key, label, type, required });
  function profile(part: 'identity' | 'about' | 'links' | 'avatar' | 'cover') {
    if (!state) return;
    const d = state.data;
    const identity: Field[] = [
      field('name', t('Tên hiển thị', 'Display name'), 'text', true),
      field('headline', t('Chuyên môn', 'Headline')),
      field('summary', t('Giới thiệu ngắn', 'Short introduction')),
      field('location', t('Địa điểm', 'Location')),
    ];
    const fields =
      part === 'identity'
        ? identity
        : part === 'about'
          ? [field('about', t('Giới thiệu', 'About'), 'textarea')]
          : part === 'links'
            ? [
                ...['email', 'github', 'linkedin', 'website', 'facebook', 'instagram'].map((key) =>
                  field(
                    'link_' + key,
                    key === 'email' ? 'Email' : key,
                    key === 'email' ? 'email' : 'url',
                  ),
                ),
                field('cv', t('Tải CV lên', 'Upload CV'), 'pdf'),
              ]
            : [
                field(
                  part,
                  part === 'avatar' ? t('Ảnh đại diện', 'Avatar') : t('Ảnh bìa', 'Cover image'),
                  'image',
                ),
              ];
    open({
      title: t('Chỉnh sửa hồ sơ', 'Edit profile'),
      fields,
      values: {
        ...d.profile,
        cv: d.cv?.url || '',
        ...Object.fromEntries(
          Object.entries(d.links).map(([key, value]) => ['link_' + key, value]),
        ),
      },
      submit: (v) =>
        save((d) => {
          if (part === 'links') {
            for (const f of fields.filter((f) => f.key.startsWith('link_')))
              d.links[f.key.slice(5)] = String(v[f.key] || '');
            d.cv = v.cv ? { name: 'CV.pdf', url: String(v.cv) } : undefined;
          } else {
            for (const f of fields)
              d.profile[f.key as keyof Content['profile']] = String(v[f.key] || '');
          }
        }),
    });
  }
  function editItem(kind: Kind, section: string, id?: string) {
    if (!state) return;
    const existing = entries(state.data, kind, section).find((e) => e.id === id);
    const values: Values = {
      visible: true,
      visibility: 'draft',
      ...Object.fromEntries(
        Object.entries(existing || {}).filter(
          ([, value]) => typeof value === 'string' || typeof value === 'boolean',
        ),
      ),
    };
    const fields: Field[] = [];
    if (kind === 'projects') {
      values.technologies = (existing as Project | undefined)?.technologies.join(', ') || '';
      fields.push(
        field('name', t('Tên dự án', 'Project name'), 'text', true),
        field('description', t('Mô tả', 'Description'), 'textarea'),
        field('tech', t('Công nghệ chính', 'Primary technology')),
        field(
          'technologies',
          t('Công nghệ, phân cách bằng dấu phẩy', 'Technologies, comma separated'),
        ),
        field('status', t('Trạng thái', 'Status')),
        ...[
          ['role', t('Vai trò', 'Role')],
          ['problem', t('Vấn đề', 'Problem')],
          ['contribution', t('Đóng góp', 'Contribution')],
          ['outcome', t('Kết quả', 'Outcome')],
          ['details', t('Chi tiết', 'Details')],
        ].map(([key, label]) => field(key, label, 'textarea')),
        field('github', 'GitHub', 'url'),
        field('demo', 'Demo', 'url'),
        field('source', t('Nguồn', 'Source'), 'url'),
        field('thumbnail', t('Ảnh dự án', 'Project image'), 'image'),
        field('pinned', t('Ghim nổi bật', 'Featured'), 'checkbox'),
      );
    } else if (kind === 'posts') {
      const date = new Date((existing as Post | undefined)?.displayAt || new Date());
      values.displayAt = new Date(date.valueOf() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      values.type ||= 'Bài viết';
      fields.push(
        field('title', t('Tiêu đề', 'Title'), 'text', true),
        field('text', t('Nội dung', 'Content'), 'textarea', true),
        {
          ...field('type', t('Loại bài', 'Post type'), 'select'),
          options: [
            ['Bài viết', t('Bài viết', 'Article')],
            ['Cập nhật dự án', t('Cập nhật dự án', 'Project update')],
            ['Media', 'Media'],
            ['Liên kết', t('Liên kết', 'Link')],
          ],
        },
        field('image', t('Ảnh', 'Image'), 'image'),
        field('link', t('Liên kết', 'Link'), 'url'),
        field(
          'displayAt',
          t('Thời gian hiển thị (giờ thiết bị)', 'Display time (device timezone)'),
          'datetime-local',
        ),
      );
    } else
      fields.push(
        field('title', t('Tiêu đề / vai trò', 'Title / role'), 'text', true),
        field('organization', t('Tổ chức', 'Organization')),
        field('period', t('Thời gian', 'Period')),
        field('description', t('Mô tả', 'Description'), 'textarea'),
      );
    fields.push(
      {
        ...field('visibility', t('Xuất bản', 'Publishing'), 'select'),
        options: [
          ['draft', t('Bản nháp', 'Draft')],
          ['public', t('Công khai', 'Published')],
        ],
      },
      field('visible', t('Hiển thị công khai', 'Visible publicly'), 'checkbox'),
    );
    open({
      title: id ? t('Sửa nội dung', 'Edit content') : t('Thêm nội dung', 'Add content'),
      fields,
      values,
      submit: (v) =>
        save((d) => {
          const input = { ...existing, ...v, id: id || crypto.randomUUID(), sample: false };
          if (kind === 'projects') {
            const item = projectSchema.parse({
              ...input,
              technologies: String(v.technologies || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            });
            d.projects = id
              ? d.projects.map((e) => (e.id === id ? item : e))
              : [...d.projects, item];
          } else if (kind === 'posts') {
            const item = postSchema.parse({
              ...input,
              createdAt: (existing as Post | undefined)?.createdAt || new Date().toISOString(),
              displayAt: v.displayAt
                ? new Date(String(v.displayAt)).toISOString()
                : new Date().toISOString(),
            });
            d.posts = id ? d.posts.map((e) => (e.id === id ? item : e)) : [...d.posts, item];
          } else {
            const item = itemSchema.parse(input);
            d.items[section] = id
              ? (d.items[section] || []).map((e) => (e.id === id ? item : e))
              : [...(d.items[section] || []), item];
          }
        }),
    });
  }
  function section(name: string) {
    if (!state) return;
    if (name === 'Giới thiệu') return profile('about');
    if (name === 'Kỹ năng')
      return open({
        title: t('Chỉnh sửa kỹ năng', 'Edit skills'),
        fields: [field('skills', t('Mỗi dòng một kỹ năng', 'One skill per line'), 'textarea')],
        values: { skills: state.data.skills.join('\n') },
        submit: (v) =>
          save((d) => {
            d.skills = [
              ...new Set(
                String(v.skills)
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean),
              ),
            ];
          }),
      });
    const kind: Kind = ['Nổi bật', 'Dự án'].includes(name)
      ? 'projects'
      : name === 'Hoạt động'
        ? 'posts'
        : 'items';
    open({
      title: t('Chỉnh sửa: ', 'Edit: ') + (state.data.sectionTitles[name] || name),
      body: (
        <div className="inline-entry-list">
          <button className="btn primary" onClick={() => editItem(kind, name)}>
            {t('Thêm nội dung', 'Add content')}
          </button>
          {entries(state.data, kind, name).map((item) => (
            <div className="inline-entry-row" key={item.id}>
              <div>
                <strong>{'name' in item ? item.name : item.title}</strong>
                <small>
                  {item.visibility === 'draft'
                    ? t('Bản nháp', 'Draft')
                    : !item.visible
                      ? t('Đã ẩn', 'Hidden')
                      : t('Đã xuất bản', 'Published')}
                </small>
              </div>
              <button className="btn neutral" onClick={() => editItem(kind, name, item.id)}>
                {t('Sửa', 'Edit')}
              </button>
            </div>
          ))}
          {!entries(state.data, kind, name).length && (
            <p className="muted">
              {t('Chưa có nội dung. Thêm ngay tại đây.', 'No content yet. Add it here.')}
            </p>
          )}
        </div>
      ),
    });
  }
  function sectionSettings(name: string) {
    if (!state) return;
    open({
      title: t('Thiết lập mục', 'Section settings'),
      fields: [
        field('title', t('Tên hiển thị', 'Display title'), 'text', true),
        field('visible', t('Hiển thị mục', 'Show section'), 'checkbox'),
        {
          ...field('position', t('Vị trí', 'Position'), 'select'),
          options: state.data.sections.map((s, i) => [
            String(i),
            String(i + 1) + ' · ' + (state.data.sectionTitles[s] || s),
          ]),
        },
      ],
      values: {
        title: state.data.sectionTitles[name] || name,
        visible: !state.data.hidden.includes(name),
        position: String(state.data.sections.indexOf(name)),
      },
      submit: (v) =>
        save((d) => {
          d.sectionTitles[name] = String(v.title);
          d.hidden = d.hidden.filter((s) => s !== name);
          if (!v.visible) d.hidden.push(name);
          d.sections = d.sections.filter((s) => s !== name);
          d.sections.splice(Number(v.position), 0, name);
        }),
    });
  }
  function addSection() {
    if (!state) return;
    open({
      title: t('Các mục hồ sơ', 'Profile sections'),
      body: (
        <div className="inline-entry-list">
          {state.data.sections.map((name) => (
            <div className="inline-entry-row" key={name}>
              <div>
                <strong>{state.data.sectionTitles[name] || name}</strong>
                {state.data.hidden.includes(name) && <small>{t('Đã ẩn', 'Hidden')}</small>}
              </div>
              <div className="inline-section-actions">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t('Sửa ', 'Edit ') + name}
                  onClick={() => section(name)}
                >
                  <Icon name="edit" />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t('Thiết lập ', 'Configure ') + name}
                  onClick={() => sectionSettings(name)}
                >
                  <Icon name="more" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ),
      fields: [field('title', t('Tên mục', 'Section name'), 'text', true)],
      values: {},
      submit: (v) =>
        save((d) => {
          const name = String(v.title).trim();
          if (d.sections.includes(name))
            throw Error(t('Mục này đã tồn tại.', 'This section already exists.'));
          d.sections.push(name);
          d.items[name] = [];
        }),
    });
  }
  function appearance() {
    if (!state) return;
    open({
      title: t('Giao diện hồ sơ', 'Profile appearance'),
      fields: [
        {
          ...field('theme', t('Giao diện', 'Theme'), 'select'),
          options: [
            ['light', t('Sáng', 'Light')],
            ['dark', t('Tối', 'Dark')],
          ],
        },
        field('accent', t('Màu nhấn', 'Accent color'), 'color'),
        {
          ...field('density', t('Khoảng cách', 'Spacing'), 'select'),
          options: [
            ['comfortable', t('Thoáng', 'Comfortable')],
            ['compact', t('Gọn', 'Compact')],
          ],
        },
        {
          ...field('layout', t('Bố cục', 'Layout'), 'select'),
          options: [
            ['standard', t('Tiêu chuẩn', 'Standard')],
            ['wide', t('Rộng', 'Wide')],
          ],
        },
      ],
      values: {
        theme: state.data.theme,
        accent: state.data.accent,
        density: state.data.density,
        layout: state.data.layout,
      },
      submit: (v) =>
        save((d) => {
          d.theme = v.theme as Content['theme'];
          d.accent = String(v.accent);
          d.density = v.density as Content['density'];
          d.layout = v.layout as Content['layout'];
        }),
    });
  }
  function githubSettings() {
    openGithubSettings(false);
  }
  function openGithubSettings(featured: boolean) {
    if (!state) return;
    open({
      title: t('Cấu hình GitHub', 'GitHub settings'),
      renderBody: (onDirty) => (
        <GithubSettingsForm
          initial={state.data.github}
          initialUsername={state.data.githubUsername}
          focusRepositories={featured}
          onDirty={onDirty}
          save={async (settings, username) => {
            await save((d) => {
              d.github = settings;
              d.githubUsername = username;
            });
            setEditor(null);
          }}
        />
      ),
    });
  }
  const button = (label: string, action: () => void, showLabel = false) =>
    state && (
      <button
        className={
          showLabel
            ? 'btn neutral inline-edit-button inline-edit-text'
            : 'inline-edit-button inline-icon-button'
        }
        type="button"
        onClick={action}
        aria-label={label}
        title={label}
      >
        <Icon
          name={
            /ảnh|avatar|cover/i.test(label)
              ? 'camera'
              : /Thiết lập|settings/i.test(label)
                ? 'more'
                : /Thêm|Add|Viết|Write/i.test(label)
                  ? 'plus'
                  : 'edit'
          }
        />
        <span className="edit-label">{label}</span>
      </button>
    );
  return {
    enabled: !!state,
    data: state ? publicContent(state.data) : publicData,
    button,
    profile,
    section,
    sectionSettings,
    addSection,
    githubSettings,
    githubFeatured: () => openGithubSettings(true),
    item: editItem,
    settings: state && (
      <>
        <div className="settings-divider" />
        <button onClick={addSection}>{t('Các mục hồ sơ', 'Profile sections')}</button>
        <button onClick={githubSettings}>{t('Cấu hình GitHub', 'GitHub settings')}</button>
        <button onClick={appearance}>{t('Giao diện hồ sơ', 'Profile appearance')}</button>
        <Link href="/admin">{t('Quản trị nâng cao', 'Advanced administration')}</Link>
        <button
          onClick={async () => {
            try {
              await request('/api/admin/logout', 'POST', {}, csrf);
              setState(null);
              setEditor(null);
              router.refresh();
            } catch {
              setNotice(t('Không thể đăng xuất. Thử lại.', 'Unable to sign out. Try again.'));
            }
          }}
        >
          {t('Đăng xuất', 'Sign out')}
        </button>
      </>
    ),
    dialog: state && editor && (
      <EditorDialog key={editorKey} editor={editor} csrf={csrf} close={() => setEditor(null)} />
    ),
    notice: notice && (
      <div className="site-toast" role="status">
        {notice}
      </div>
    ),
  };
}

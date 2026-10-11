'use client';
import dynamic from 'next/dynamic';
import { trashEntry } from '../lib/content-management';
import { sectionLabel } from '../lib/i18n';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { request, entries } from '../lib/client';
import {
  publicContent,
  publicationStatus,
  projectSchema,
  postSchema,
  itemSchema,
  type Content,
  type ContentState,
  type Kind,
  type Project,
  type Post,
} from '../lib/schema';
import type { Editor, Field, Values } from './admin-form';
import { useLanguage } from './language';
import { Icon } from './icon';
import { readRichText, richPlainText } from '../lib/rich-text';
import { saveGithubChanges } from '../lib/github-save';

const EditorDialog = dynamic(() => import('./admin-form').then((module) => module.EditorDialog), {
  ssr: false,
});
const SkillManager = dynamic(
  () => import('./skill-manager').then((module) => module.SkillManager),
  { ssr: false },
);
const GithubSettingsForm = dynamic(
  () => import('./github-settings').then((module) => module.GithubSettingsForm),
  { ssr: false },
);

// Private content is fetched only after the server confirms an admin session.
// The profile itself still renders the public projection, including after saves.
export function useInlineEdit(publicData: Content) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [state, setState] = useState<ContentState | null>(null);
  const [csrf, setCsrf] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [notice, setNotice] = useState('');
  const [guestPreview, setGuestPreview] = useState(false);
  const enabled = !!state && !guestPreview;
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    let active = true;
    try {
      setGuestPreview(sessionStorage.getItem('profile-guest-preview') === 'true');
    } catch {
      /* Preview still works when optional tab storage is unavailable. */
    }
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
  async function save(change: (data: Content) => void, current = state) {
    if (!current)
      throw Error(t('Vui lòng đăng nhập quản trị.', 'Please sign in as administrator.'));
    const data = structuredClone(current.data);
    change(data);
    // Use the version that the editor was opened with. Concurrent edits cause a
    // conflict rather than overwriting another tab's newer content.
    const next = await request<ContentState>(
      '/api/admin/content',
      'PUT',
      { data, version: current.version },
      csrf,
    );
    setState(next);
    setNotice(t('Đã lưu thay đổi.', 'Changes saved.'));
    router.refresh();
    return next;
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
      field('location', t('Địa điểm', 'Location'), 'location'),
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
        cvName: d.cv?.name || 'CV.pdf',
        ...Object.fromEntries(
          Object.entries(d.links).map(([key, value]) => ['link_' + key, value]),
        ),
      },
      submit: (v) =>
        save((d) => {
          if (part === 'links') {
            for (const f of fields.filter((f) => f.key.startsWith('link_')))
              d.links[f.key.slice(5)] = String(v[f.key] || '');
            d.cv = v.cv ? { name: String(v.cvName || 'CV.pdf'), url: String(v.cv) } : undefined;
          } else {
            for (const f of fields)
              d.profile[f.key as keyof Content['profile']] = String(v[f.key] || '');
          }
        }),
    });
  }
  function editItem(kind: Kind, section: string, id?: string, postType?: string, current = state) {
    if (!current) return;
    const existing = entries(current.data, kind, section).find((e) => e.id === id);
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
      values.imageFrame = (existing as Project | undefined)?.imageFrame || 'original';
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
        {
          ...field('detailsFormat', t('Định dạng phần chi tiết', 'Details format'), 'select'),
          options: [
            ['auto', t('Tự nhận diện nội dung GitHub', 'Detect GitHub content')],
            ['plain', t('Văn bản nhập thủ công', 'Plain text')],
            ['markdown', 'Markdown'],
          ],
        },
        field('github', 'GitHub', 'url'),
        field('demo', 'Demo', 'url'),
        field('source', t('Nguồn', 'Source'), 'url'),
        field('thumbnail', t('Ảnh dự án', 'Project image'), 'image'),
        {
          ...field(
            'imageFrame',
            t('Khung ảnh (hiển thị trọn ảnh)', 'Image frame (show full image)'),
            'select',
          ),
          options: [
            ['square', t('Vuông 1:1', 'Square 1:1')],
            ['landscape', t('Ngang 16:9', 'Landscape 16:9')],
            ['portrait', t('Dọc 3:4', 'Portrait 3:4')],
            ['original', t('Tỷ lệ gốc', 'Original ratio')],
            ['none', t('Không hiển thị ảnh', 'Hide image')],
          ],
        },
        field('pinned', t('Ghim nổi bật', 'Featured'), 'checkbox'),
      );
    } else if (kind === 'posts') {
      const date = new Date((existing as Post | undefined)?.displayAt || new Date());
      values.displayAt = new Date(date.valueOf() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      values.type ||= postType || 'Bài viết';
      values.richText = JSON.stringify(
        readRichText(
          (existing as Post | undefined)?.richText || '',
          (existing as Post | undefined)?.text || '',
        ),
      );
      fields.push(
        field('title', t('Tiêu đề', 'Title'), 'text', true),
        field('richText', t('Nội dung', 'Content'), 'richtext', true),
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
      knownRepositories: (kind === 'projects' ? current.data.projects : current.data.posts)
        .filter((item) => item.id !== id)
        .map((item) => ('github' in item ? item.github : item.link)),
      githubUsername:
        kind === 'projects' || kind === 'posts' ? current.data.githubUsername : undefined,
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
              text:
                v.bodyFormat === 'markdown'
                  ? String(v.markdown || '')
                  : richPlainText(String(v.richText || '')),
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
        }, current).then(() => {}),
    });
  }
  function section(name: string, current = state) {
    if (!current) return;
    if (name === 'Giới thiệu') return profile('about');
    if (name === 'Kỹ năng') {
      let confirmed = current;
      return open({
        title: t('Quản lý kỹ năng', 'Manage skills'),
        renderBody: (onDirty) => (
          <SkillManager
            skills={confirmed.data.skills}
            hidden={confirmed.data.hiddenSkills}
            onDirty={onDirty}
            save={async (skills, hiddenSkills) => {
              confirmed = await save((d) => {
                d.skills = skills;
                d.hiddenSkills = hiddenSkills;
              }, confirmed);
            }}
          />
        ),
      });
    }
    const kind: Kind = ['Nổi bật', 'Dự án'].includes(name)
      ? 'projects'
      : name === 'Hoạt động'
        ? 'posts'
        : 'items';
    open({
      title:
        t('Chỉnh sửa: ', 'Edit: ') + sectionLabel(name, current.data.sectionTitles[name], language),
      body: (
        <div className="inline-entry-list">
          <button
            className="btn primary"
            onClick={() => editItem(kind, name, undefined, undefined, current)}
          >
            {t('Thêm nội dung', 'Add content')}
          </button>
          {entries(current.data, kind, name).map((item) => (
            <div
              className="inline-entry-row"
              data-publication={publicationStatus(item)}
              key={item.id}
            >
              <div>
                <strong>{'name' in item ? item.name : item.title}</strong>
                <small>
                  {
                    {
                      draft: t('Bản nháp', 'Draft'),
                      hidden: t('Đã ẩn', 'Hidden'),
                      scheduled: t('Đã hẹn giờ', 'Scheduled'),
                      public: t('Đã xuất bản', 'Published'),
                    }[publicationStatus(item)]
                  }
                </small>
              </div>
              <div className="inline-section-actions">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t('Sửa ', 'Edit ') + ('name' in item ? item.name : item.title)}
                  title={t('Sửa', 'Edit')}
                  onClick={() => editItem(kind, name, item.id, undefined, current)}
                >
                  <Icon name="edit" />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={
                    item.visible ? t('Ẩn nội dung', 'Hide entry') : t('Hiện nội dung', 'Show entry')
                  }
                  title={item.visible ? t('Ẩn', 'Hide') : t('Hiện', 'Show')}
                  onClick={async () => {
                    try {
                      const next = await save((d) => {
                        const entry = entries(d, kind, name).find((v) => v.id === item.id);
                        if (entry) entry.visible = !entry.visible;
                      }, current);
                      section(name, next);
                    } catch (error) {
                      setNotice(
                        error instanceof Error
                          ? error.message
                          : t('Không lưu được.', 'Unable to save.'),
                      );
                    }
                  }}
                >
                  <Icon name={item.visible ? 'lock' : 'eye'} />
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  aria-label={t('Xóa nội dung', 'Delete entry')}
                  title={t('Xóa', 'Delete')}
                  onClick={() => removeEntry(kind, name, item.id, current)}
                >
                  <Icon name="trash" />
                </button>
              </div>
            </div>
          ))}
          {!entries(current.data, kind, name).length && (
            <p className="muted">
              {t('Chưa có nội dung. Thêm ngay tại đây.', 'No content yet. Add it here.')}
            </p>
          )}
        </div>
      ),
    });
  }
  function removeEntry(kind: Kind, sectionName: string, id: string, current = state) {
    if (!current) return;
    open({
      title: t('Chuyển nội dung vào thùng rác?', 'Move entry to trash?'),
      body: (
        <p>
          {t(
            'Bạn có thể khôi phục trong trang quản trị.',
            'You can restore this entry in administration.',
          )}
        </p>
      ),
      fields: [],
      values: {},
      submitLabel: t('Chuyển vào thùng rác', 'Move to trash'),
      submit: async () => {
        await save((d) => trashEntry(d, kind, sectionName, id, crypto.randomUUID()), current);
      },
    });
  }
  function sectionSettings(name: string, current = state) {
    if (!current) return;
    open({
      title: t('Thiết lập mục', 'Section settings'),
      fields: [
        field('title', t('Tên hiển thị', 'Display title'), 'text', true),
        field('visible', t('Hiển thị mục', 'Show section'), 'checkbox'),
        {
          ...field('position', t('Vị trí', 'Position'), 'select'),
          options: current.data.sections.map((s, i) => [
            String(i),
            String(i + 1) + ' · ' + sectionLabel(s, current.data.sectionTitles[s], language),
          ]),
        },
      ],
      values: {
        title: current.data.sectionTitles[name] || name,
        visible: !current.data.hidden.includes(name),
        position: String(current.data.sections.indexOf(name)),
      },
      submit: (v) =>
        save((d) => {
          d.sectionTitles[name] = String(v.title);
          d.hidden = d.hidden.filter((s) => s !== name);
          if (!v.visible) d.hidden.push(name);
          d.sections = d.sections.filter((s) => s !== name);
          d.sections.splice(Number(v.position), 0, name);
        }, current),
    });
  }
  function addSection(current = state) {
    if (!current) return;
    open({
      title: t('Các mục hồ sơ', 'Profile sections'),
      body: (
        <div className="inline-entry-list">
          {current.data.sections.map((name) => (
            <div
              className="inline-entry-row"
              data-publication={current.data.hidden.includes(name) ? 'hidden' : 'public'}
              key={name}
            >
              <div>
                <strong>{sectionLabel(name, current.data.sectionTitles[name], language)}</strong>
                {current.data.hidden.includes(name) && <small>{t('Đã ẩn', 'Hidden')}</small>}
              </div>
              <div className="inline-section-actions">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={
                    t('Sửa ', 'Edit ') +
                    sectionLabel(name, current.data.sectionTitles[name], language)
                  }
                  onClick={() => section(name, current)}
                >
                  <Icon name="edit" />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={
                    current.data.hidden.includes(name)
                      ? t('Hiện mục', 'Show section')
                      : t('Ẩn mục', 'Hide section')
                  }
                  title={t('Ẩn / Hiện', 'Hide / Show')}
                  onClick={async () => {
                    try {
                      const next = await save((d) => {
                        d.hidden = d.hidden.includes(name)
                          ? d.hidden.filter((v) => v !== name)
                          : [...d.hidden, name];
                      }, current);
                      addSection(next);
                    } catch (error) {
                      setNotice(
                        error instanceof Error
                          ? error.message
                          : t('Không lưu được.', 'Unable to save.'),
                      );
                    }
                  }}
                >
                  <Icon name={current.data.hidden.includes(name) ? 'eye' : 'lock'} />
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  aria-label={t('Xóa mục', 'Delete section')}
                  title={t('Xóa', 'Delete')}
                  onClick={() =>
                    open({
                      title: t('Xóa mục khỏi hồ sơ?', 'Remove profile section?'),
                      body: (
                        <p>
                          {t(
                            'Nội dung tùy chỉnh chuyển vào thùng rác. Dự án và bài viết vẫn có danh sách riêng; khôi phục mục từ lịch sử phiên bản.',
                            'Custom entries move to trash. Projects and posts keep their own lists; restore the section from revision history.',
                          )}
                        </p>
                      ),
                      fields: [],
                      values: {},
                      submitLabel: t('Xóa mục', 'Remove section'),
                      submit: () =>
                        save((d) => {
                          for (const item of [...(d.items[name] || [])])
                            trashEntry(d, 'items', name, item.id, crypto.randomUUID());
                          d.sections = d.sections.filter((v) => v !== name);
                          d.hidden = d.hidden.filter((v) => v !== name);
                          delete d.items[name];
                          delete d.sectionTitles[name];
                        }, current),
                    })
                  }
                >
                  <Icon name="trash" />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={
                    t('Thiết lập ', 'Configure ') +
                    sectionLabel(name, current.data.sectionTitles[name], language)
                  }
                  onClick={() => sectionSettings(name, current)}
                >
                  <Icon name="more" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ),
      submitLabel: t('Thêm mục', 'Add section'),
      fields: [field('title', t('Tên mục', 'Section name'), 'text', true)],
      values: {},
      submit: (v) =>
        save((d) => {
          const name = String(v.title).trim();
          if (d.sections.includes(name))
            throw Error(t('Mục này đã tồn tại.', 'This section already exists.'));
          d.sections.push(name);
          d.items[name] = [];
        }, current),
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
          save={async (settings, username, resolve) => {
            const next = await saveGithubChanges(state.data, settings, username, csrf, resolve);
            setState(next);
            setNotice(t('Đã lưu thay đổi.', 'Changes saved.'));
            router.refresh();
            setEditor(null);
          }}
        />
      ),
    });
  }
  const button = (label: string, action: () => void, showLabel = false) =>
    enabled && (
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
    enabled,
    isAdmin: !!state,
    guestPreview: !!state && guestPreview,
    setGuestPreview: (next: boolean) => {
      setGuestPreview(next);
      try {
        if (next) sessionStorage.setItem('profile-guest-preview', 'true');
        else sessionStorage.removeItem('profile-guest-preview');
      } catch {
        /* The server session is unaffected by this display preference. */
      }
    },
    adminPosts: enabled ? state?.data.posts : undefined,
    data: state ? publicContent(state.data) : publicData,
    button,
    profile,
    section,
    sectionSettings,
    addSection,
    githubSettings,
    githubFeatured: () => openGithubSettings(true),
    item: editItem,
    removePost: (id: string) => removeEntry('posts', '', id),
    settings: enabled && (
      <>
        <div className="settings-divider" />
        <button onClick={() => addSection()}>{t('Các mục hồ sơ', 'Profile sections')}</button>
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
    dialog: enabled && editor && (
      <EditorDialog key={editorKey} editor={editor} csrf={csrf} close={() => setEditor(null)} />
    ),
    notice: notice && (
      <div className="site-toast" role="status">
        {notice}
      </div>
    ),
  };
}

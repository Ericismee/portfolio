'use client';
import { uiLabel, localizedError } from '../lib/i18n';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Content, Project, Post } from '../lib/schema';
import { publicationStatus } from '../lib/schema';
import { applyTheme } from '../lib/theme';
import { Icon } from './icon';
import { SocialLogo, socialLabels } from './social-logo';
import { LanguageProvider, useLanguage } from './language';
import { useInlineEdit } from './inline-edit';
import type { GithubSkills } from '../lib/github-skills';
import { GithubSkillsCard } from './github-skills';
import { GithubProfile } from './github-profile';
import { PostBody } from './post-body';
import { CvDocument } from './cv-document';
import { MarkdownContent } from './markdown-content';
import { projectUsesMarkdown } from '../lib/markdown';
import { postMatches, activityPosts } from '../lib/activity';
import { searchContent } from '../lib/search';

export function ProfileSite(props: {
  content: Content;
  githubSkills: GithubSkills;
  page: string;
  id?: string;
  query: Record<string, string>;
}) {
  return (
    <LanguageProvider>
      <Site {...props} />
    </LanguageProvider>
  );
}
function Site({
  content,
  githubSkills,
  page,
  id,
  query,
}: {
  content: Content;
  githubSkills: GithubSkills;
  page: string;
  id?: string;
  query: Record<string, string>;
}) {
  const editing = useInlineEdit(content),
    data = editing.data;
  const { language, t, toggle } = useLanguage(),
    router = useRouter(),
    [menu, setMenu] = useState(false),
    [toast, setToast] = useState(''),
    [filter, setFilter] = useState('all'),
    [feedStatus, setFeedStatus] = useState('public'),
    menuButton = useRef<HTMLButtonElement>(null),
    menuPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let theme = data.theme;
    try {
      const saved = localStorage.getItem('profile-theme');
      if (saved === 'light' || saved === 'dark') theme = saved;
    } catch {
      /* Storage may be unavailable. */
    }
    applyTheme(data.accent, theme);
    document.body.classList.toggle('compact', data.density === 'compact');
    return () => {
      document.body.classList.remove('compact');
    };
  }, [data.accent, data.theme, data.density]);
  useEffect(() => {
    const legacy = () => {
      const hash = location.hash.slice(1);
      if (!hash || hash.startsWith('section-') || hash === 'view') return;
      const [route, q] = hash.split('?'),
        parts = route.split('/');
      if (
        ['profile', 'projects', 'feed', 'posts', 'contact', 'github', 'search'].includes(parts[0])
      )
        router.replace(
          (route === 'profile' ? '/' : '/' + route.replace(/^feed/, 'activity')) +
            (q ? '?' + q : ''),
        );
    };
    legacy();
    window.addEventListener('hashchange', legacy);
    return () => window.removeEventListener('hashchange', legacy);
  }, [router]);
  useEffect(() => {
    setMenu(false);
  }, [page, id]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menu) {
        setMenu(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    menuPanel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const outside = (event: PointerEvent) => {
      if (
        !menuPanel.current?.contains(event.target as Node) &&
        !menuButton.current?.contains(event.target as Node)
      )
        setMenu(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [menu]);
  const profile = data.profile;
  const names: Record<string, string> = {
    'Giới thiệu': t('Giới thiệu', 'About'),
    'Nổi bật': t('Dự án tiêu biểu', 'Selected work'),
    'Dự án': t('Tất cả dự án', 'All projects'),
    'Kỹ năng': t('Kỹ năng', 'Skills'),
    'Kinh nghiệm': t('Kinh nghiệm', 'Experience'),
    'Học vấn': t('Học vấn', 'Education'),
    'Chứng chỉ': t('Chứng chỉ', 'Certifications'),
    'Hoạt động': t('Hoạt động', 'Activity'),
  };
  const title = (s: string) =>
    data.sectionTitles[s] && data.sectionTitles[s] !== s ? data.sectionTitles[s] : names[s] || s;
  const avatar = (size = 'small') => (
    <div className={'avatar ' + size}>
      {profile.avatar ? (
        <img src={profile.avatar} alt={t('Ảnh đại diện', 'Avatar') + ' ' + profile.name} />
      ) : (
        Array.from(profile.name)[0]
      )}
    </div>
  );
  const card = (heading: string, body: ReactNode) => (
    <section className="card pad">
      <div className="section-heading">
        <h2>{heading}</h2>
        {heading === t('Liên kết', 'Links') &&
          editing.button(t('Sửa liên kết', 'Edit links'), () => editing.profile('links'))}
        {heading === t('Hoạt động', 'Activity') &&
          editing.button(
            t('Viết bài', 'Write post'),
            () => editing.item('posts', '', undefined, filter === 'all' ? 'Bài viết' : filter),
            true,
          )}
      </div>
      {body}
    </section>
  );
  const empty = (message: string) => (
    <div className="empty">
      <strong>{message}</strong>
    </div>
  );
  const shell = (main: ReactNode, side: ReactNode = aside()) => (
    <div className={'layout ' + (data.layout === 'wide' ? 'layout-wide' : '')}>
      <div className="main">{main}</div>
      <aside className="sidebar">{side}</aside>
    </div>
  );
  const links = () =>
    Object.entries(data.links)
      .filter(([, value]) => value)
      .map(([key, value]) => (
        <a
          className="side-link social-link"
          key={key}
          href={
            key === 'email'
              ? 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(value)
              : value
          }
          target="_blank"
          rel="noopener noreferrer"
          title={value}
        >
          <SocialLogo name={key.toLowerCase()} />
          <span>{socialLabels[key.toLowerCase()] || key[0].toUpperCase() + key.slice(1)}</span>
          <span className="social-link-arrow" aria-hidden="true">
            ↗
          </span>
          <span className="social-link-detail">{value}</span>
        </a>
      ));
  function aside() {
    return card(
      t('Về tác giả', 'About the author'),
      <>
        <div className="author-summary">
          {avatar()}
          <strong>{profile.name}</strong>
        </div>
        <p className="muted">{profile.headline}</p>
        <p className="sidebar-purpose">
          {t(
            'Tìm hiểu chuyên môn, dự án và mã nguồn của tôi.',
            'Explore my experience, projects and source code.',
          )}
        </p>
        <Link className="side-link" href="/">
          {t('Xem hồ sơ →', 'View profile →')}
        </Link>
        <Link className="side-link" href="/github">
          GitHub →
        </Link>
      </>,
    );
  }
  const nav = () =>
    [
      ['/', 'profile', t('Hồ sơ', 'Profile')],
      ['/projects', 'projects', t('Dự án', 'Projects')],
      ['/activity', 'feed', t('Hoạt động', 'Activity')],
      ['/contact', 'contact', t('Liên hệ', 'Contact')],
    ].map(([href, icon, label]) => (
      <Link
        className={
          'nav-item ' +
          ((page === 'feed' ? 'activity' : page) === (href === '/' ? 'profile' : href.slice(1))
            ? 'active'
            : '')
        }
        aria-current={
          (page === 'feed' ? 'activity' : page) === (href === '/' ? 'profile' : href.slice(1))
            ? 'page'
            : undefined
        }
        href={href}
        key={href}
      >
        <Icon name={icon} />
        <span>{label}</span>
      </Link>
    ));
  async function share(path?: string) {
    const url = path ? new URL(path, location.origin).href : location.href;
    try {
      await navigator.clipboard.writeText(url);
      setToast(t('Đã sao chép liên kết', 'Link copied'));
    } catch {
      setToast(url);
    }
  }
  function projectCard(p: Project) {
    const index = data.projects.indexOf(p);
    return (
      <article
        className="project"
        key={p.id}
        data-tone={['blue', 'lavender', 'mint', 'peach'][index % 4]}
      >
        {p.imageFrame !== 'none' && (
          <Link
            className="project-art"
            data-frame={p.imageFrame}
            href={'/projects/' + encodeURIComponent(p.id)}
          >
            {p.thumbnail ? (
              <span className="project-image">
                <img src={p.thumbnail} alt={p.name} />
              </span>
            ) : (
              <>
                <span className="project-monogram">{p.name.slice(0, 2).toUpperCase()}</span>
                <span className="project-art-label">{p.tech}</span>
              </>
            )}
          </Link>
        )}
        <div className="project-content">
          <p className="project-category">{p.technologies[0] || p.tech.split(',')[0]}</p>
          <h3>
            <Link href={'/projects/' + encodeURIComponent(p.id)}>{p.name}</Link>
          </h3>
          {editing.button(t('Sửa dự án', 'Edit project'), () => editing.item('projects', '', p.id))}
          <p className="project-description">{p.description}</p>
          <div className="tags project-technologies">
            {(p.technologies.length ? p.technologies : p.tech.split(','))
              .filter(Boolean)
              .map((tech) => (
                <span className="tag" key={tech}>
                  {tech.trim()}
                </span>
              ))}
          </div>
          <div className="project-card-actions">
            <span className="badge">{uiLabel(p.status, language)}</span>
            <Link className="text-action" href={'/projects/' + encodeURIComponent(p.id)}>
              <span>{t('Xem chi tiết', 'View details')}</span>
              <span className="project-open-icon" aria-hidden="true">
                ↗
              </span>
            </Link>
          </div>
        </div>
      </article>
    );
  }
  function tabs() {
    const source =
      page === 'activity' && editing.enabled ? editing.adminPosts || data.posts : data.posts;
    const status = page === 'activity' && editing.enabled ? feedStatus : 'public';
    return (
      <>
        {page === 'activity' && editing.enabled && (
          <div
            className="feed-status-tabs"
            aria-label={t('Trạng thái bài viết', 'Post visibility')}
          >
            {(['public', 'draft', 'scheduled', 'hidden'] as const).map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={status === value}
                className={status === value ? 'active' : ''}
                onClick={() => setFeedStatus(value)}
              >
                {
                  {
                    public: t('Đã đăng', 'Published'),
                    draft: t('Bản nháp', 'Drafts'),
                    scheduled: t('Đã lên lịch', 'Scheduled'),
                    hidden: t('Đã ẩn', 'Hidden'),
                  }[value]
                }{' '}
                <span>{source.filter((p) => publicationStatus(p) === value).length}</span>
              </button>
            ))}
          </div>
        )}
        <div className="tabs" aria-label={t('Loại bài viết', 'Post type')}>
          {[
            ['all', t('Tất cả', 'All')],
            ['Bài viết', t('Bài viết', 'Articles')],
            ['Cập nhật dự án', t('Cập nhật dự án', 'Project updates')],
            ['Media', 'Media'],
            ['Liên kết', t('Liên kết', 'Links')],
          ].map(([value, label]) => (
            <button
              key={value}
              className={filter === value ? 'active' : ''}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}{' '}
              <span className="tab-count">
                {
                  source.filter((p) => publicationStatus(p) === status && postMatches(p, value))
                    .length
                }
              </span>
            </button>
          ))}
        </div>
      </>
    );
  }
  function date(p: Post) {
    return p.displayAt || p.createdAt;
  }
  function post(p: Post, detail = false) {
    const status = publicationStatus(p);
    const published = status === 'public';
    const timestamp = date(p);
    const formatted = timestamp
      ? new Date(timestamp).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Asia/Bangkok',
        })
      : '';
    const postedOn = timestamp
      ? new Date(timestamp).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-GB', {
          day: 'numeric',
          month: 'long',
          year:
            new Date(timestamp).toLocaleDateString('en-GB', {
              year: 'numeric',
              timeZone: 'Asia/Bangkok',
            }) ===
            new Date().toLocaleDateString('en-GB', { year: 'numeric', timeZone: 'Asia/Bangkok' })
              ? undefined
              : 'numeric',
          timeZone: 'Asia/Bangkok',
        })
      : '';
    const postedAt = timestamp
      ? new Date(timestamp).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Asia/Bangkok',
        })
      : '';
    return (
      <article
        className={detail ? 'card post' : 'activity'}
        data-publication={publicationStatus(p)}
        key={p.id}
      >
        {detail && <Link href="/activity">← {t('Hoạt động', 'Activity')}</Link>}
        <div className="row post-heading">
          {avatar()}
          <div className="post-author">
            <strong>
              <Link href="/">{profile.name}</Link>
            </strong>
            <div className="post-meta">
              {date(p) ? (
                <time dateTime={timestamp} title={formatted + ' (UTC+7)'}>
                  {postedOn} {t('lúc', 'at')} {postedAt}
                </time>
              ) : null}
              <span className="post-meta-separator" aria-hidden="true">
                ·
              </span>
              <span
                className={'post-status post-status-' + status}
                title={published ? t('Công khai', 'Public') : undefined}
                aria-label={published ? t('Công khai', 'Public') : undefined}
                role={published ? 'img' : undefined}
              >
                <Icon name={published ? 'globe' : 'eye'} />
                {!published &&
                  {
                    public: t('Công khai', 'Public'),
                    draft: t('Bản nháp · Chỉ admin', 'Draft · Admin only'),
                    scheduled: t('Đã lên lịch · Chỉ admin', 'Scheduled · Admin only'),
                    hidden: t('Đã ẩn · Chỉ admin', 'Hidden · Admin only'),
                  }[status]}
              </span>
            </div>
          </div>
          {editing.enabled && (
            <div className="post-admin-actions">
              <button
                type="button"
                className="inline-icon-button"
                aria-label={t('Sửa bài viết', 'Edit post')}
                title={t('Sửa bài viết', 'Edit post')}
                onClick={() => editing.item('posts', '', p.id)}
              >
                <Icon name="edit" />
              </button>
              <button
                type="button"
                className="inline-icon-button post-delete"
                aria-label={t('Xóa bài viết', 'Delete post')}
                title={t('Xóa bài viết', 'Delete post')}
                onClick={() => editing.removePost(p.id)}
              >
                <Icon name="trash" />
              </button>
            </div>
          )}
        </div>
        {detail ? (
          <h1>{p.title}</h1>
        ) : (
          <h3>
            {published ? (
              <Link href={'/posts/' + encodeURIComponent(p.id)}>{p.title}</Link>
            ) : (
              <button
                type="button"
                className="post-title-edit"
                onClick={() => editing.item('posts', '', p.id)}
              >
                {p.title}
              </button>
            )}
          </h3>
        )}
        <PostBody
          value={p.bodyFormat === 'markdown' ? '' : p.richText}
          text={p.text}
          detail={detail}
          markdown={p.bodyFormat === 'markdown' ? p.markdown : ''}
          base={p.markdownBase}
        />
        {p.image && (
          <img
            className="post-image"
            src={p.image}
            alt={t('Ảnh đính kèm bài viết', 'Post image')}
          />
        )}
        {p.link && (
          <a className="link-preview" href={p.link} target="_blank" rel="noopener noreferrer">
            ↗ {p.link}
          </a>
        )}
        {published && (
          <div className="post-footer">
            <button
              type="button"
              className="post-share-button"
              onClick={() => share('/posts/' + encodeURIComponent(p.id))}
            >
              <Icon name="share" />
              {t('Chia sẻ', 'Share')}
            </button>
          </div>
        )}
      </article>
    );
  }
  function activities() {
    const privateView = page === 'activity' && editing.enabled;
    const entries = activityPosts(
      privateView ? editing.adminPosts || data.posts : data.posts,
      privateView ? feedStatus : 'public',
      filter,
    );
    return entries.length
      ? entries.map((p) => post(p))
      : empty(
          filter === 'all'
            ? t('Chưa có bài viết', 'No posts yet')
            : t('Chưa có nội dung trong mục này.', 'No content in this category yet.'),
        );
  }
  function profilePage() {
    const featured = data.projects.filter((p) => p.pinned).slice(0, 2),
      sections: { name: string; body: ReactNode }[] = [];
    for (const name of data.sections) {
      if (data.hidden.includes(name)) continue;
      let body: ReactNode = null;
      if (name === 'Giới thiệu' && profile.about)
        body = <p className="preserve">{profile.about}</p>;
      else if (name === 'Nổi bật' && featured.length)
        body = (
          <>
            <p className="profile-section-intro">
              {t(
                'Các dự án tiêu biểu — xem mục tiêu, công nghệ và cách tôi xây dựng.',
                'Selected work — explore the goals, technology and how I built it.',
              )}
            </p>
            <div className="project-grid featured-grid">{featured.map(projectCard)}</div>
          </>
        );
      else if (name === 'Dự án' && data.projects.length)
        body = (
          <div className="project-overview">
            <p className="muted">
              {data.projects.length}{' '}
              {t(
                'dự án · Chọn một dự án để xem chi tiết.',
                'projects · Choose a project to explore.',
              )}
            </p>
            {data.projects.map((p) => (
              <Link
                className="project-summary-link"
                key={p.id}
                href={'/projects/' + encodeURIComponent(p.id)}
              >
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.tech}</small>
                  <span className="project-summary-description">{p.description}</span>
                </span>
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
            <Link className="btn neutral all-projects" href="/projects">
              {t('Xem tất cả dự án →', 'View all projects →')}
            </Link>
          </div>
        );
      else if (name === 'Kỹ năng' && data.skills.length)
        body = (
          <div className="tags">
            {data.skills.map((s) => (
              <span className="tag" key={s}>
                {s}
              </span>
            ))}
          </div>
        );
      else if (name === 'Hoạt động' && data.posts.length)
        body = (
          <>
            {tabs()}
            {activities()}
          </>
        );
      else if (data.items[name]?.length)
        body = data.items[name].map((item) => (
          <article className="entry" key={item.id}>
            <div className="entry-icon">
              <Icon name="projects" />
            </div>
            <div className="entry-body">
              <h3>{item.title}</h3>
              <p>{item.organization}</p>
              <p className="muted">{item.period}</p>
              <p className="preserve">{item.description}</p>
              {editing.button(t('Sửa nội dung', 'Edit content'), () =>
                editing.item('items', name, item.id),
              )}
            </div>
          </article>
        ));
      if (body) sections.push({ name, body });
    }
    return shell(
      <>
        <section className="card profile-intro">
          <div
            className="cover"
            data-label={profile.name.toUpperCase() + ' / ' + profile.headline.toUpperCase()}
          >
            {profile.cover && <img src={profile.cover} alt={t('Ảnh bìa', 'Cover image')} />}
            <div className="inline-cover-action">
              {editing.button(t('Sửa ảnh bìa', 'Edit cover'), () => editing.profile('cover'), true)}
            </div>
          </div>
          <div className="profile-body">
            <div className="editable-avatar">
              {avatar('profile-avatar')}
              {editing.button(t('Sửa ảnh đại diện', 'Edit avatar'), () =>
                editing.profile('avatar'),
              )}
            </div>
            <div className="profile-identity">
              <h1>{profile.name}</h1>
              <div className="headline">{profile.headline}</div>
              {profile.summary && <p className="profile-summary">{profile.summary}</p>}
              <div className="muted">
                {profile.location && profile.location + ' · '}
                <Link href="/contact">{t('Thông tin liên hệ', 'Contact information')}</Link>
              </div>
            </div>
            <div className="actions">
              {editing.button(
                t('Chỉnh sửa hồ sơ', 'Edit profile'),
                () => editing.profile('identity'),
                true,
              )}
              <Link className="btn primary" href="/projects">
                {t('Xem dự án', 'View projects')}
              </Link>
              {!editing.enabled && (
                <Link className="btn neutral" href="/contact">
                  {t('Liên hệ', 'Contact')}
                </Link>
              )}
              {data.cv && <CvDocument url={data.cv.url} name={data.cv.name} />}
              {!editing.enabled && (
                <button className="btn neutral" onClick={() => share()}>
                  {t('Chia sẻ', 'Share')}
                </button>
              )}
            </div>
          </div>
        </section>
        {sections.map((s, i) => (
          <section
            className="card pad"
            id={'section-' + i}
            tabIndex={-1}
            aria-label={title(s.name)}
            key={s.name}
          >
            <div className="section-heading">
              <h2>{title(s.name)}</h2>
              {editing.enabled && (
                <div className="inline-section-actions">
                  {data.hidden.includes(s.name) && (
                    <span className="badge">{t('Đã ẩn', 'Hidden')}</span>
                  )}
                  {editing.button(t('Chỉnh sửa', 'Edit'), () => editing.section(s.name))}
                  {editing.button(t('Thiết lập mục', 'Section settings'), () =>
                    editing.sectionSettings(s.name),
                  )}
                </div>
              )}
            </div>
            {s.body}
          </section>
        ))}
      </>,
      <>
        {card(t('Liên kết', 'Links'), links())}
        {data.github.showSidebar && (
          <GithubSkillsCard stats={githubSkills} settings={data.github} avatar={profile.avatar} />
        )}
        {sections.length > 1 &&
          card(
            t('Đi đến nhanh', 'Jump to a section'),
            <>
              <p className="profile-jump-help">
                {t(
                  'Chọn một mục để cuộn đến nội dung trên trang này.',
                  'Choose a section to jump to its content on this page.',
                )}
              </p>
              <nav
                className="profile-jump-nav"
                aria-label={t('Đi đến các phần hồ sơ', 'Jump to profile sections')}
              >
                {sections.map((s, i) => (
                  <a className="toc-link" href={'#section-' + i} key={s.name}>
                    <span>{title(s.name)}</span>
                    <span aria-hidden="true">↓</span>
                  </a>
                ))}
              </nav>
            </>,
          )}
        <div className="footer">
          {t('Thông tin do chủ hồ sơ cung cấp', 'Information provided by the profile owner')}
        </div>
      </>,
    );
  }
  function projectsPage() {
    const { q = '', tech = '', status = '', sort = '', view = '' } = query;
    let list = data.projects.filter(
      (p) =>
        `${p.name} ${p.description} ${p.tech}`
          .toLocaleLowerCase()
          .includes(q.toLocaleLowerCase()) &&
        (!tech || p.tech === tech) &&
        (!status || p.status === status),
    );
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name, language));
    if (sort === 'reverse') list = [...list].reverse();
    const update = (form: HTMLFormElement) => {
      const params = new URLSearchParams();
      for (const [k, v] of new FormData(form)) if (v) params.set(k, String(v));
      if (view) params.set('view', view);
      router.push('/projects?' + params);
    };
    return shell(
      <section className="card pad">
        <div className="section-heading projects-heading">
          <h1>{t('Dự án', 'Projects')}</h1>
          <div className="page-heading-actions">
            {editing.button(
              t('Thêm dự án', 'Add project'),
              () => editing.item('projects', ''),
              true,
            )}
            <button
              className="btn neutral"
              onClick={() => {
                const p = new URLSearchParams(query);
                if (view === 'list') p.delete('view');
                else p.set('view', 'list');
                router.push('/projects?' + p);
              }}
            >
              {view === 'list' ? t('Dạng lưới', 'Grid view') : t('Dạng danh sách', 'List view')}
            </button>
          </div>
        </div>
        <form
          className="filters"
          key={JSON.stringify(query)}
          onSubmit={(e) => {
            e.preventDefault();
            update(e.currentTarget);
          }}
        >
          <input
            name="q"
            defaultValue={q}
            placeholder={t('Tìm dự án…', 'Search projects…')}
            aria-label={t('Tìm dự án', 'Search projects')}
          />
          <select
            name="tech"
            defaultValue={tech}
            aria-label={t('Công nghệ', 'Technology')}
            onChange={(e) => update(e.currentTarget.form!)}
          >
            <option value="">{t('Tất cả công nghệ', 'All technologies')}</option>
            {[...new Set(data.projects.map((p) => p.tech))].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={status}
            aria-label={t('Trạng thái', 'Status')}
            onChange={(e) => update(e.currentTarget.form!)}
          >
            <option value="">{t('Tất cả trạng thái', 'All statuses')}</option>
            {[...new Set(data.projects.map((p) => p.status))].map((v) => (
              <option key={v} value={v}>
                {uiLabel(v, language)}
              </option>
            ))}
          </select>
          <select
            name="sort"
            defaultValue={sort}
            aria-label={t('Sắp xếp', 'Sort')}
            onChange={(e) => update(e.currentTarget.form!)}
          >
            <option value="">{t('Thứ tự đã chọn', 'Curated order')}</option>
            <option value="name">A–Z</option>
            <option value="reverse">{t('Đảo thứ tự', 'Reverse order')}</option>
          </select>
          <button className="btn neutral">{t('Tìm', 'Search')}</button>
        </form>
        <p className="results-line">
          {list.length} {t('dự án hiển thị', 'projects shown')}
        </p>
        <div className={'project-grid ' + (view === 'list' ? 'list' : '')}>
          {list.map(projectCard)}
        </div>
        {!list.length && empty(t('Không tìm thấy dự án', 'No projects found'))}
      </section>,
    );
  }
  function projectDetail() {
    const p = data.projects.find((p) => p.id === id);
    if (!p)
      return shell(
        card(
          t('Không tìm thấy dự án', 'Project not found'),
          <Link href="/projects">{t('Tất cả dự án', 'All projects')}</Link>,
        ),
      );
    return shell(
      <section className="card">
        <div className="project-back">
          <Link href="/projects">← {t('Tất cả dự án', 'All projects')}</Link>
        </div>
        {p.imageFrame !== 'none' && (
          <div className="project-art project-detail-art" data-frame={p.imageFrame}>
            {p.thumbnail ? <img src={p.thumbnail} alt={p.name} /> : p.name}
          </div>
        )}
        <div className="pad">
          <h1>{p.name}</h1>
          {editing.button(t('Sửa dự án', 'Edit project'), () => editing.item('projects', '', p.id))}
          <span className="badge">{uiLabel(p.status, language)}</span>
          <p>{p.description}</p>
          <h3>{t('Công nghệ', 'Technologies')}</h3>
          <div className="tags">
            {(p.technologies.length ? p.technologies : [p.tech]).map((v) => (
              <span className="tag" key={v}>
                {v}
              </span>
            ))}
          </div>
          {(
            [
              ['role', t('Vai trò', 'Role')],
              ['problem', t('Vấn đề', 'Problem')],
              ['contribution', t('Đóng góp', 'Contribution')],
              ['outcome', t('Kết quả', 'Outcome')],
              ['details', t('Chi tiết', 'Details')],
            ] as const
          )
            .filter(([k]) => p[k])
            .map(([k, label]) => (
              <div key={k}>
                <h3>{label}</h3>
                {k === 'details' && projectUsesMarkdown(p) ? (
                  <MarkdownContent
                    value={p[k]}
                    base={p.detailsBase || p.github + '/blob/HEAD/README.md'}
                  />
                ) : (
                  <p className="preserve">{p[k]}</p>
                )}
              </div>
            ))}
          <div className="actions">
            {(
              [
                ['github', 'GitHub ↗'],
                ['demo', t('Xem demo ↗', 'View demo ↗')],
                ['source', t('Nguồn tham khảo ↗', 'Reference ↗')],
              ] as const
            )
              .filter(([k]) => p[k])
              .map(([k, label]) => (
                <a
                  className="btn neutral"
                  href={p[k]}
                  key={k}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {label}
                </a>
              ))}
          </div>
        </div>
      </section>,
    );
  }
  function searchPage() {
    const q = query.q || '';
    const {
      projects,
      posts,
      skills,
      profile: profileMatch,
      items,
      links: channelMatches,
      cv,
    } = searchContent(data, q);
    return shell(
      card(
        t('Kết quả tìm kiếm', 'Search results'),
        q.trim() ? (
          <>
            <p>“{q}”</p>
            {profileMatch && (
              <Link className="side-link" href="/">
                {t('Hồ sơ', 'Profile')} · {profile.name} — {profile.headline}
              </Link>
            )}
            {projects.length > 0 && (
              <>
                <h3>{t('Dự án', 'Projects')}</h3>
                <div className="project-grid">{projects.map(projectCard)}</div>
              </>
            )}
            {posts.length > 0 && <h3>{t('Bài viết', 'Posts')}</h3>}
            {posts.map((p) => (
              <Link className="side-link" href={'/posts/' + encodeURIComponent(p.id)} key={p.id}>
                {p.title}
              </Link>
            ))}
            {skills.length > 0 && <h3>{t('Kỹ năng', 'Skills')}</h3>}
            <div className="tags">
              {skills.map((s) => (
                <span className="tag" key={s}>
                  {s}
                </span>
              ))}
            </div>
            {items.length > 0 && (
              <>
                <h3>{t('Các mục hồ sơ', 'Profile sections')}</h3>
                {items.map(({ section, item }) => (
                  <Link key={section + item.id} className="side-link" href="/">
                    {title(section)} · {item.title}
                    {item.organization && ' — ' + item.organization}
                  </Link>
                ))}
              </>
            )}
            {channelMatches.length > 0 && (
              <>
                <h3>{t('Thông tin liên hệ', 'Contact information')}</h3>
                {channelMatches.map(([key, value]) => (
                  <Link key={key} className="side-link" href="/contact">
                    {socialLabels[key.toLowerCase()] || key} · {value}
                  </Link>
                ))}
              </>
            )}
            {cv && data.cv && <CvDocument url={data.cv.url} name={data.cv.name} />}
            {projects.length +
              posts.length +
              skills.length +
              items.length +
              channelMatches.length +
              Number(profileMatch) +
              Number(cv) ===
              0 && empty(t('Không có kết quả', 'No results found'))}
          </>
        ) : (
          empty(t('Nhập từ khóa để bắt đầu', 'Enter a search term to begin'))
        ),
      ),
    );
  }
  const detailPost = data.posts.find((p) => p.id === id);
  const body =
    page === 'profile' ? (
      profilePage()
    ) : page === 'projects' ? (
      id ? (
        projectDetail()
      ) : (
        projectsPage()
      )
    ) : ['feed', 'activity'].includes(page) ? (
      shell(
        card(
          t('Hoạt động', 'Activity'),
          <>
            <p className="page-description">
              {t(
                'Bài viết, chia sẻ và những cập nhật từ các dự án.',
                'Articles, ideas and updates from my projects.',
              )}
            </p>
            {tabs()}
            {activities()}
          </>,
        ),
      )
    ) : page === 'posts' ? (
      shell(
        detailPost
          ? post(detailPost, true)
          : card(t('Không tìm thấy bài viết', 'Post not found'), null),
      )
    ) : page === 'search' ? (
      searchPage()
    ) : page === 'github' ? (
      <GithubProfile
        key={
          JSON.stringify(data.github) +
          githubSkills.username +
          githubSkills.repos.map((repo) => repo.name).join(',')
        }
        initial={githubSkills}
        owner={profile}
        settings={data.github}
        configure={editing.button(
          t('Cấu hình GitHub', 'GitHub settings'),
          editing.githubSettings,
          true,
        )}
        configureFeatured={editing.button(
          t('Chọn repo nổi bật', 'Choose featured repos'),
          editing.githubFeatured,
          true,
        )}
      />
    ) : (
      shell(
        card(
          t('Liên hệ', 'Contact'),
          <>
            <p>
              {t(
                'Trao đổi về một ý tưởng hoặc cơ hội hợp tác.',
                'Get in touch about an idea or collaboration.',
              )}
            </p>
            <ContactForm />
          </>,
        ),
        card(
          t('Kết nối trực tiếp', 'Connect directly'),
          <>
            <div className="author-summary">
              {avatar()}
              <strong>{profile.name}</strong>
            </div>
            <p className="muted">{profile.headline}</p>
            <p className="sidebar-purpose">
              {t(
                'Chọn kênh phù hợp hoặc gửi lời nhắn qua biểu mẫu.',
                'Choose a channel or send a message using the form.',
              )}
            </p>
            {links()}
            <Link className="side-link" href="/">
              {t('Xem hồ sơ →', 'View profile →')}
            </Link>
          </>,
        ),
      )
    );
  return (
    <>
      <a className="skip-link" href="#view">
        {t('Đến nội dung chính', 'Skip to main content')}
      </a>
      <header>
        <div className="header-inner">
          <Link
            className={'logo' + (profile.logo ? ' has-image' : '')}
            href="/"
            aria-label={profile.name}
          >
            {profile.logo ? (
              <img src={profile.logo} alt={profile.name} />
            ) : (
              Array.from(profile.name)[0]
            )}
          </Link>
          <form
            className="search"
            action="/search"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(
                '/search?q=' +
                  encodeURIComponent(String(new FormData(e.currentTarget).get('q') || '')),
              );
            }}
          >
            <Icon name="search" />
            <input
              name="q"
              id="global-search"
              placeholder={t('Tìm kiếm', 'Search')}
              aria-label={t('Tìm kiếm', 'Search')}
            />
          </form>
          <nav aria-label={t('Điều hướng chính', 'Main navigation')}>{nav()}</nav>
          <button
            className="icon-btn avatar-menu-button"
            aria-label={t('Cài đặt', 'Settings')}
            title={t('Cài đặt', 'Settings')}
            aria-expanded={menu}
            aria-controls="site-menu"
            ref={menuButton}
            onClick={() => setMenu(!menu)}
          >
            {avatar('tiny')}
          </button>
          {menu && (
            <div
              className="site-menu"
              id="site-menu"
              ref={menuPanel}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest('button,a')) setMenu(false);
              }}
            >
              <strong className="settings-title">{t('Cài đặt', 'Settings')}</strong>
              <button
                className="theme-menu-action"
                onClick={() => {
                  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
                  applyTheme(data.accent, next);
                  try {
                    localStorage.setItem('profile-theme', next);
                  } catch {
                    /* Optional local preference. */
                  }
                }}
              >
                <Icon name="moon" />
                {t('Sáng / Tối', 'Dark / Light')}
              </button>
              <span className="settings-label">
                {t('Ngôn ngữ giao diện', 'Interface language')}
              </span>
              <button onClick={toggle}>{language === 'vi' ? 'English' : 'Tiếng Việt'}</button>
              {editing.isAdmin && (
                <button
                  className="theme-menu-action"
                  onClick={() => editing.setGuestPreview(!editing.guestPreview)}
                >
                  <Icon name={editing.guestPreview ? 'edit' : 'eye'} />
                  {editing.guestPreview
                    ? t('Quay lại quản trị', 'Return to admin')
                    : t('Xem như khách', 'View as guest')}
                </button>
              )}
              {editing.settings}
              <div className="settings-divider" />
              <Link href="/github">GitHub ↗</Link>
              <button onClick={() => window.print()}>{t('In hồ sơ', 'Print profile')}</button>
            </div>
          )}
        </div>
      </header>
      <main id="view" tabIndex={-1}>
        {editing.guestPreview && (
          <div className="guest-preview-bar" role="status">
            <span>
              <Icon name="eye" />
              {t('Đang xem như khách', 'Viewing as a guest')}
            </span>
            <button type="button" onClick={() => editing.setGuestPreview(false)}>
              {t('Quay lại quản trị', 'Return to admin')}
            </button>
          </div>
        )}
        {body}
      </main>
      {editing.dialog}
      {editing.notice}
      <nav className="bottom-nav" aria-label={t('Điều hướng trên điện thoại', 'Mobile navigation')}>
        {nav()}
      </nav>
      {toast && (
        <div className="site-toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
function ContactForm() {
  const { t, language } = useLanguage(),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setResult('');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw Error(json.error);
      setResult(t('Đã gửi lời nhắn. Cảm ơn bạn!', 'Message sent. Thank you!'));
      form.reset();
    } catch (e) {
      setResult(
        e instanceof Error
          ? localizedError(e.message, language)
          : t('Không thể gửi lời nhắn', 'Unable to send message'),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="contact-form" onSubmit={submit}>
      <div className="form-grid">
        <label>
          {t('Họ tên', 'Name')} *<input name="name" required maxLength={200} autoComplete="name" />
        </label>
        <label>
          Email *<input name="email" required type="email" maxLength={254} autoComplete="email" />
        </label>
      </div>
      <label>
        {t('Chủ đề', 'Subject')} *
        <input
          name="subject"
          required
          maxLength={200}
          list="contact-subjects"
          placeholder={t('Chọn hoặc nhập chủ đề…', 'Choose or enter a subject…')}
        />
        <datalist id="contact-subjects">
          {[
            t('Trao đổi', 'Discussion'),
            t('Hợp tác', 'Collaboration'),
            t('Cơ hội công việc', 'Job opportunity'),
            t('Góp ý', 'Feedback'),
            t('Hỗ trợ dự án', 'Project support'),
            t('Khác', 'Other'),
          ].map((subject) => (
            <option key={subject} value={subject} />
          ))}
        </datalist>
      </label>
      <label>
        {t('Nội dung', 'Message')} *
        <textarea name="message" required />
      </label>
      <p className="muted">
        {t(
          'Lời nhắn và email được lưu trong hộp thư riêng của chủ hồ sơ để phản hồi.',
          'Your message and email are stored in the profile owner’s private inbox for a reply.',
        )}
      </p>
      <button className="btn primary" disabled={busy}>
        {busy ? t('Đang gửi…', 'Sending…') : t('Gửi lời nhắn', 'Send message')}
      </button>
      <p role="status">{result}</p>
    </form>
  );
}

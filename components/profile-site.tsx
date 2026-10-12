'use client';
import { uiLabel, localizedError } from '../lib/i18n';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Content, Project, Post } from '../lib/schema';
import { publicationStatus } from '../lib/schema';
import { Icon } from './icon';
import { responsiveImage } from '../lib/image-variants';
import { PublicTraffic } from './public-traffic';
import { PublicSkeleton } from './skeleton';
import { SocialLogo, socialLabels } from './social-logo';
import { useLanguage } from './language';
import { usePublicEditing } from './public-shell';
import type { GithubSkills } from '../lib/github-skills';
import { GithubSkillsCard } from './github-skills';
import { PostBody } from './post-body';
import { CvDocument } from './cv-document';
import { MarkdownContent } from './markdown-content';
import { projectUsesMarkdown } from '../lib/markdown';
import { postMatches, activityPosts } from '../lib/activity';
import {
  searchContent,
  projectMatchesSearch,
  projectTechnologies,
  normalizeSearch,
} from '../lib/search';
const GithubProfile = dynamic(
  () => import('./github-profile').then((module) => module.GithubProfile),
  { loading: () => <PublicSkeleton /> },
);

export function ProfileSite(props: {
  content: Content;
  githubSkills: GithubSkills;
  page: string;
  id?: string;
  query: Record<string, string>;
}) {
  return <Site {...props} />;
}
function Site({
  content,
  githubSkills: initialGithubSkills,
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
  const [githubSkills, setGithubSkills] = useState(initialGithubSkills);
  const [githubLoading, setGithubLoading] = useState(
    !initialGithubSkills.updatedAt && !!initialGithubSkills.username,
  );
  useEffect(() => {
    setGithubSkills(initialGithubSkills);
    if (initialGithubSkills.updatedAt || !initialGithubSkills.username || page === 'github') {
      setGithubLoading(false);
      return;
    }
    setGithubLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch('/api/github?view=skills', { signal: controller.signal, cache: 'no-store' })
        .then(async (response) => {
          if (!response.ok) throw Error('Unavailable');
          const result = await response.json();
          if (!controller.signal.aborted) setGithubSkills(result.stats);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!controller.signal.aborted) setGithubLoading(false);
        });
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [initialGithubSkills, page]);
  const editing = usePublicEditing(content),
    data = editing.data;
  const { language, t } = useLanguage(),
    router = useRouter(),
    [toast, setToast] = useState(''),
    [filter, setFilter] = useState('all'),
    [projectSearch, setProjectSearch] = useState(query.q || ''),
    [projectFiltersOpen, setProjectFiltersOpen] = useState(
      !!(query.tech || query.status || query.sort),
    ),
    [feedStatus, setFeedStatus] = useState('public');
  useEffect(() => setProjectSearch(query.q || ''), [page, query.q]);
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
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
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
        <img
          {...responsiveImage(profile.avatar, '120px')}
          alt={t('Ảnh đại diện', 'Avatar') + ' ' + profile.name}
          decoding="async"
        />
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
    <div
      className={
        'layout ' +
        (data.layout === 'wide' ? 'layout-wide ' : '') +
        (page === 'contact' ? 'contact-layout' : '')
      }
    >
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
    const technologies = (p.technologies.length ? p.technologies : p.tech.split(','))
      .map((tech) => tech.trim())
      .filter(Boolean);
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
                <img
                  {...responsiveImage(
                    p.thumbnail,
                    '(max-width: 600px) ' + (query.view === 'list' ? '76px' : '42vw') + ', 320px',
                  )}
                  alt={p.name}
                  loading="lazy"
                  decoding="async"
                />
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
            {technologies.map((tech) => (
              <span className="tag" key={tech}>
                {tech}
              </span>
            ))}
            {technologies.length > 3 && (
              <span
                className="tag project-more-technologies"
                aria-label={
                  t('Công nghệ khác', 'More technologies') + ': ' + technologies.slice(3).join(', ')
                }
                title={technologies.slice(3).join(', ')}
              >
                +{technologies.length - 3}
              </span>
            )}
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
                onClick={() => {
                  setFeedStatus(value);
                  setFilter('all');
                }}
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
              title={label}
              onClick={() => setFilter(value)}
            >
              {value === 'Cập nhật dự án' ? (
                <>
                  <span className="tab-label-full">{label}</span>
                  <span className="tab-label-short">{t('Dự án', 'Projects')}</span>
                </>
              ) : (
                label
              )}{' '}
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
            {...responsiveImage(p.image, '(max-width: 700px) 100vw, 760px')}
            alt={t('Ảnh đính kèm bài viết', 'Post image')}
            loading="lazy"
            decoding="async"
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
            {profile.cover && (
              <img
                {...responsiveImage(profile.cover, '(max-width: 600px) 100vw, 800px')}
                alt={t('Ảnh bìa', 'Cover image')}
                fetchPriority="high"
                decoding="async"
              />
            )}
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
            <div
              className={
                'actions profile-actions' +
                (editing.enabled ? ' profile-actions-editing' : '') +
                (data.showHeaderCv ? ' profile-actions-header-cv' : '')
              }
            >
              {editing.button(
                t('Chỉnh sửa hồ sơ', 'Edit profile'),
                () => editing.profile('identity'),
                true,
              )}
              <Link className="btn primary" href="/projects">
                <span className="profile-action-label-full">{t('Xem dự án', 'View projects')}</span>
                <span className="profile-action-label-short">{t('Dự án', 'Projects')}</span>
              </Link>
              {!editing.enabled && (
                <Link className="btn neutral" href="/contact">
                  {t('Liên hệ', 'Contact')}
                </Link>
              )}
              {data.cv && <CvDocument url={data.cv.url} name={data.cv.name} showDownload={false} />}
              {!editing.enabled && (
                <button
                  className="btn neutral profile-share"
                  onClick={() => share()}
                  aria-label={t('Chia sẻ', 'Share')}
                  title={t('Chia sẻ', 'Share')}
                >
                  <Icon name="share" />
                  <span>{t('Chia sẻ', 'Share')}</span>
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
          <GithubSkillsCard
            stats={githubSkills}
            settings={data.github}
            avatar={profile.avatar}
            loading={githubLoading}
          />
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
    const { tech = '', status = '', sort = '', view = '' } = query;
    const q = projectSearch;
    let list = data.projects.filter(
      (p) =>
        (!q.trim() || projectMatchesSearch(p, q)) &&
        (!tech ||
          projectTechnologies(p).some(
            (value) => normalizeSearch(value) === normalizeSearch(tech),
          )) &&
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
          </div>
        </div>
        <form
          className="filters project-filters"
          key={JSON.stringify(query)}
          onSubmit={(e) => {
            e.preventDefault();
            update(e.currentTarget);
          }}
        >
          <div className="project-search-row">
            <input
              name="q"
              value={q}
              onChange={(event) => setProjectSearch(event.target.value)}
              placeholder={t('Tìm dự án…', 'Search projects…')}
              aria-label={t('Tìm dự án', 'Search projects')}
            />
            <button
              type="button"
              className="btn neutral project-filter-toggle"
              aria-label={t('Bộ lọc', 'Filters')}
              title={t('Bộ lọc', 'Filters')}
              aria-expanded={projectFiltersOpen}
              aria-controls="project-filter-fields"
              onClick={() => setProjectFiltersOpen(!projectFiltersOpen)}
            >
              <Icon name="filters" />
              {!!(tech || status || sort) && (
                <span className="project-filter-count">
                  {[tech, status, sort].filter(Boolean).length}
                </span>
              )}
            </button>
            <div
              className="project-view-switch"
              role="group"
              aria-label={t('Kiểu hiển thị', 'Display view')}
            >
              {(['grid', 'list'] as const).map((mode) => {
                const selected = mode === (view === 'list' ? 'list' : 'grid');
                const label =
                  mode === 'grid' ? t('Dạng lưới', 'Grid view') : t('Dạng danh sách', 'List view');
                return (
                  <button
                    key={mode}
                    type="button"
                    className="btn neutral project-view-button"
                    aria-label={label}
                    title={label}
                    aria-pressed={selected}
                    onClick={() => {
                      if (selected) return;
                      const params = new URLSearchParams(query);
                      if (q) params.set('q', q);
                      else params.delete('q');
                      if (mode === 'grid') params.delete('view');
                      else params.set('view', 'list');
                      router.push('/projects' + (params.size ? '?' + params : ''));
                    }}
                  >
                    <Icon name={mode === 'grid' ? 'sections' : 'feed'} />
                  </button>
                );
              })}
            </div>
          </div>
          <div
            className="project-filter-fields"
            id="project-filter-fields"
            hidden={!projectFiltersOpen}
          >
            <select
              name="tech"
              defaultValue={tech}
              aria-label={t('Công nghệ', 'Technology')}
              onChange={(e) => update(e.currentTarget.form!)}
            >
              <option value="">{t('Tất cả công nghệ', 'All technologies')}</option>
              {[...new Set(data.projects.flatMap(projectTechnologies))]
                .sort((a, b) => a.localeCompare(b, language))
                .map((v) => (
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
          </div>
          {(q || tech || status || sort) && (
            <Link
              className="btn neutral"
              onClick={() => setProjectSearch('')}
              href={view ? '/projects?view=' + encodeURIComponent(view) : '/projects'}
            >
              {t('Xóa bộ lọc', 'Clear filters')}
            </Link>
          )}
        </form>
        <p className="results-line" role="status">
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
            {p.thumbnail ? (
              <img {...responsiveImage(p.thumbnail)} alt={p.name} loading="lazy" decoding="async" />
            ) : (
              p.name
            )}
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
        <PublicTraffic visible={data.showVisitorCount} />
      </main>
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

'use client';
import { PAGE_REFRESH_EVENT, type PageRefreshRequest } from '../lib/page-refresh';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { GithubSkills } from '../lib/github-skills';
import type { GithubActivity, ContributionDay } from '../lib/github-activity';
import { featuredGithubRepos } from '../lib/github-display';
import type { Content, GithubSettings } from '../lib/schema';
import { useLanguage } from './language';
import { TechnologyChips, TechLogo } from './tech-logo';
import { Skeleton } from './skeleton';
import { responsiveImage } from '../lib/image-variants';

type Tab = 'overview' | 'repositories' | 'activity';
export function GithubProfile({
  initial,
  owner,
  settings: initialSettings,
  configure,
  configureFeatured,
}: {
  initial: GithubSkills;
  owner: Content['profile'];
  settings: GithubSettings;
  configure?: ReactNode;
  configureFeatured?: ReactNode;
}) {
  const { t, language } = useLanguage();
  const [settings, setSettings] = useState(initialSettings);
  const [stats, setStats] = useState(initial),
    [activity, setActivity] = useState<GithubActivity | null>(null);
  const [tabValue, setTab] = useState<Tab>('overview'),
    [year, setYear] = useState(new Date().getUTCFullYear());
  const tab =
    (tabValue === 'repositories' && !settings.showRepositories) ||
    (tabValue === 'activity' && !settings.showCommits && !settings.showEvents)
      ? 'overview'
      : tabValue;
  const [query, setQuery] = useState(''),
    [sort, setSort] = useState('updated'),
    [repoFilter, setRepoFilter] = useState('');
  const [checking, setChecking] = useState(false),
    [error, setError] = useState(false),
    [selectedDay, setSelectedDay] = useState<ContributionDay | null>(null);
  const request = useRef<AbortController | null>(null);
  const pollSeconds = useRef(settings.refreshMinutes * 60);
  const url = 'https://github.com/' + encodeURIComponent(stats.username);
  const refresh = useCallback(async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setChecking(true);
    const timeout = setTimeout(() => controller.abort(), 20000);
    // Show profile/repositories as soon as ready; calendar and commits can arrive later.
    let fullReady = false;
    void fetch('/api/github?view=skills', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return;
        const next = (await response.json()) as { stats: GithubSkills };
        if (!controller.signal.aborted && !fullReady) setStats(next.stats);
      })
      .catch(() => undefined);
    try {
      const response = await fetch('/api/github?year=' + year, {
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!response.ok) throw Error('Unavailable');
      const next = (await response.json()) as {
        stats: GithubSkills;
        activity: GithubActivity;
        settings: GithubSettings;
      };
      if (controller.signal.aborted) return;
      fullReady = true;
      setStats(next.stats);
      setSettings(next.settings);
      setActivity(next.activity);
      pollSeconds.current = Math.max(next.settings.refreshMinutes * 60, next.activity.pollSeconds);
      setError(false);
    } catch {
      if (request.current === controller) setError(true);
    } finally {
      controller.abort();
      clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        setChecking(false);
      }
    }
  }, [year]);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (document.visibilityState === 'visible') await refresh();
      if (!stopped) {
        clearTimeout(timer);
        timer = setTimeout(poll, pollSeconds.current * 1000);
      }
    };
    void poll();
    const visible = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timer);
        void poll();
      }
    };
    document.addEventListener('visibilitychange', visible);
    const manual = (event: Event) => {
      (event as CustomEvent<PageRefreshRequest>).detail.tasks.push(refresh());
    };
    window.addEventListener(PAGE_REFRESH_EVENT, manual);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener(PAGE_REFRESH_EVENT, manual);
      request.current?.abort();
      request.current = null;
    };
  }, [refresh]);
  const date = (value: string) =>
    Number.isFinite(Date.parse(value))
      ? new Date(value).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' })
      : '—';
  const number = (value: number) => value.toLocaleString(language);
  const repos = stats.repos.filter((repo) =>
    (
      repo.name +
      ' ' +
      (repo.description || '') +
      ' ' +
      (repo.language || '') +
      ' ' +
      repo.topics.join(' ')
    )
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  if (sort === 'stars') repos.sort((a, b) => b.stars - a.stars);
  if (sort === 'name') repos.sort((a, b) => a.name.localeCompare(b.name));
  const popular = featuredGithubRepos(stats, settings);
  const calendar = activity?.calendar?.year === year ? activity.calendar : null;
  const profile = stats.profile;
  const loadingProfile = !stats.updatedAt && !error;
  const repoCards = (items: GithubSkills['repos']) => (
    <div className="gh-repo-grid">
      {items.map((repo) => (
        <article className="gh-repo-card" key={repo.name}>
          <div className="gh-repo-title">
            <a
              href={url + '/' + encodeURIComponent(repo.name)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {repo.name} ↗
            </a>
            <span className="badge">
              {repo.fork
                ? 'Fork'
                : repo.archived
                  ? t('Lưu trữ', 'Archived')
                  : t('Công khai', 'Public')}
            </span>
          </div>
          <p>{repo.description || t('Chưa có mô tả.', 'No description yet.')}</p>
          {repo.topics.length > 0 && (
            <div className="gh-topics">
              {repo.topics.slice(0, 4).map((topic) => (
                <span key={topic}>{topic}</span>
              ))}
            </div>
          )}
          <div className="gh-repo-meta">
            {repo.language && (
              <span>
                <TechLogo name={repo.language} />
                {repo.language}
              </span>
            )}
            <span aria-label={repo.stars + ' stars'}>★ {number(repo.stars)}</span>
            <span>⑂ {number(repo.forks)}</span>
          </div>
          <small className="muted">
            {t('Cập nhật ', 'Updated ')}
            {date(repo.updatedAt)}
          </small>
        </article>
      ))}
    </div>
  );
  const commits = activity?.commits.filter((item) => !repoFilter || item.repo === repoFilter) || [];
  const events = activity?.events.filter((item) => !repoFilter || item.repo === repoFilter) || [];
  const eventNames: Record<string, string> = {
    PushEvent: t('Đẩy mã nguồn', 'Pushed code'),
    PullRequestEvent: t('Pull request', 'Pull request'),
    IssuesEvent: t('Issue', 'Issue'),
    CreateEvent: t('Tạo mới', 'Created'),
    DeleteEvent: t('Xóa nhánh hoặc tag', 'Deleted branch or tag'),
    WatchEvent: t('Đánh dấu sao', 'Starred'),
    ForkEvent: t('Fork kho mã', 'Forked repository'),
    ReleaseEvent: t('Phát hành', 'Released'),
    IssueCommentEvent: t('Bình luận issue', 'Commented on issue'),
    PullRequestReviewEvent: t('Review mã nguồn', 'Reviewed code'),
  };
  return (
    <div className="gh-profile-layout">
      <aside
        className={'gh-identity card pad' + (loadingProfile ? ' is-loading' : '')}
        aria-busy={loadingProfile}
      >
        {loadingProfile && (
          <div className="gh-identity-placeholder" aria-hidden="true">
            <Skeleton className="skeleton-avatar" />
            <Skeleton className="skeleton-title" />
            <Skeleton className="skeleton-line" />
            <Skeleton className="skeleton-field" />
            <Skeleton className="skeleton-field" />
            <Skeleton className="skeleton-field" />
          </div>
        )}
        <div className="avatar gh-profile-avatar">
          {profile?.avatarUrl || owner.avatar ? (
            <img
              {...responsiveImage(profile?.avatarUrl || owner.avatar, '120px')}
              alt=""
              decoding="async"
            />
          ) : (
            owner.name.slice(0, 1)
          )}
        </div>
        <div className="gh-identity-copy">
          <h1>{profile?.name || owner.name}</h1>
          <a className="gh-username" href={url} target="_blank" rel="noopener noreferrer">
            @{stats.username} <span aria-hidden="true">↗</span>
          </a>
          <p>{profile?.bio || owner.headline}</p>
        </div>
        <a className="btn neutral" href={url} target="_blank" rel="noopener noreferrer">
          {t('Xem trên GitHub ↗', 'View on GitHub ↗')}
        </a>
        <dl className="gh-identity-facts">
          {profile?.location && (
            <div>
              <dt>{t('Địa điểm', 'Location')}</dt>
              <dd>{profile.location}</dd>
            </div>
          )}
          {profile?.company && (
            <div>
              <dt>{t('Tổ chức', 'Company')}</dt>
              <dd>{profile.company}</dd>
            </div>
          )}
          {profile && (
            <>
              <div>
                <dt>{t('Người theo dõi', 'Followers')}</dt>
                <dd>{number(profile.followers)}</dd>
              </div>
              <div>
                <dt>{t('Đang theo dõi', 'Following')}</dt>
                <dd>{number(profile.following)}</dd>
              </div>
              <div>
                <dt>{t('Tham gia', 'Joined')}</dt>
                <dd>{new Date(profile.createdAt).getUTCFullYear()}</dd>
              </div>
            </>
          )}
        </dl>
        {settings.showTechnologies && (
          <details className="gh-stack" open>
            <summary>
              <span>{t('Công nghệ sử dụng', 'Technology stack')}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <TechnologyChips names={stats.languages.map((item) => item.name)} />
          </details>
        )}
        <Link href="/" className="side-link">
          {t('← Về hồ sơ cá nhân', '← Back to profile')}
        </Link>
      </aside>
      <div className="gh-main">
        <div className="gh-content-toolbar">
          <div className="gh-content-actions">
            {configure}
            <button className="btn neutral" disabled={checking} onClick={() => void refresh()}>
              {checking ? t('Đang kiểm tra…', 'Checking…') : t('Làm mới', 'Refresh')}
            </button>
          </div>
          <nav className="gh-tabs" aria-label={t('Nội dung GitHub', 'GitHub content')}>
            {(
              [
                'overview',
                ...(settings.showRepositories ? ['repositories'] : []),
                ...(settings.showCommits || settings.showEvents ? ['activity'] : []),
              ] as Tab[]
            ).map((value) => (
              <button
                key={value}
                className={tab === value ? 'active' : ''}
                aria-pressed={tab === value}
                onClick={() => setTab(value)}
              >
                {value === 'overview'
                  ? t('Tổng quan', 'Overview')
                  : value === 'repositories'
                    ? t('Kho mã', 'Repositories') + ' · ' + stats.repos.length
                    : t('Hoạt động', 'Activity')}
              </button>
            ))}
          </nav>
        </div>
        {error && (
          <p className="notice" role="status">
            {t(
              'Chưa kết nối được. Giữ dữ liệu đã tải.',
              'Connection unavailable. Keeping loaded data.',
            )}
          </p>
        )}
        {stats.partial && (
          <p className="notice">
            {t(
              'Thông tin kho mã hoặc công nghệ hiện chưa đầy đủ.',
              'Repository or technology data is currently incomplete.',
            )}
          </p>
        )}
        {tab === 'overview' && (
          <>
            {settings.showStatistics && (
              <div className="gh-stats">
                <div className="card pad">
                  <strong>{number(stats.repos.length)}</strong>
                  <span>{t('Kho mã hiển thị', 'Displayed repositories')}</span>
                </div>
                <div className="card pad">
                  <strong>{number(stats.repos.reduce((sum, repo) => sum + repo.stars, 0))}</strong>
                  <span>{t('Stars của kho mã hiển thị', 'Displayed repository stars')}</span>
                </div>
                <div className="card pad">
                  <strong>{stats.languages.length}</strong>
                  <span>{t('Ngôn ngữ mã nguồn', 'Code languages')}</span>
                </div>
              </div>
            )}
            {settings.showCalendar && (
              <section className="card pad gh-calendar-card">
                <div className="gh-section-heading">
                  <h2>{t('Lịch đóng góp', 'Contribution calendar')}</h2>
                  <label>
                    {t('Năm', 'Year')}{' '}
                    <select
                      value={year}
                      onChange={(event) => {
                        setSelectedDay(null);
                        setYear(Number(event.target.value));
                      }}
                    >
                      {Array.from(
                        { length: Math.min(6, new Date().getUTCFullYear() - 2022) },
                        (_, index) => new Date().getUTCFullYear() - index,
                      ).map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="gh-calendar-content" aria-busy={!calendar && checking}>
                  {calendar ? (
                    <>
                      <p className="gh-calendar-total">
                        <strong>{number(calendar.total)}</strong>{' '}
                        {t('đóng góp trong năm ', 'contributions in ')}
                        {year}
                      </p>
                      <ContributionCalendar
                        days={calendar.days}
                        year={year}
                        language={language}
                        onSelect={setSelectedDay}
                      />
                      <div className="gh-calendar-footer">
                        <span role="status">
                          {selectedDay
                            ? selectedDay.date +
                              ' · ' +
                              number(selectedDay.count) +
                              ' ' +
                              t('đóng góp', 'contributions')
                            : t(
                                'Chọn một ngày để xem số đóng góp.',
                                'Select a day to see contributions.',
                              )}
                        </span>
                        <span className="gh-legend">
                          {t('Ít', 'Less')}
                          {[0, 1, 2, 3, 4].map((level) => (
                            <i className={'gh-day level-' + level} key={level} />
                          ))}
                          {t('Nhiều', 'More')}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="gh-calendar-placeholder">
                      <Skeleton className="skeleton-field" />
                      <p className="muted" role="status">
                        {checking
                          ? t('Đang tải lịch đóng góp…', 'Loading contribution calendar…')
                          : t(
                              'Chưa lấy được lịch đóng góp từ GitHub.',
                              'Could not load the contribution calendar from GitHub.',
                            )}
                      </p>
                    </div>
                  )}
                </div>
                <p className="github-skills-note">
                  {t(
                    'Nguồn: lịch công khai GitHub. Đóng góp bao gồm nhiều loại hoạt động, không chỉ commit.',
                    'Source: GitHub public calendar. Contributions include multiple activities, not just commits.',
                  )}{' '}
                  {activity?.calendarStatus === 'stale' &&
                    t('Đang hiển thị bản lưu cũ.', 'Showing a stale snapshot.')}
                </p>
              </section>
            )}
            {settings.showFeatured && (
              <section className="card pad">
                <div className="gh-section-heading">
                  <h2>{t('Kho mã nổi bật', 'Featured repositories')}</h2>
                  {configureFeatured}
                  {settings.showRepositories && (
                    <button className="text-action" onClick={() => setTab('repositories')}>
                      {t('Xem tất cả →', 'View all →')}
                    </button>
                  )}
                </div>
                {loadingProfile ? (
                  <div className="gh-repo-grid" aria-busy="true">
                    {Array.from({ length: 6 }, (_, index) => (
                      <div key={index} className="gh-repo-card" aria-hidden="true">
                        <Skeleton className="skeleton-title" />
                        <Skeleton className="skeleton-line" />
                        <Skeleton className="skeleton-field" />
                      </div>
                    ))}
                  </div>
                ) : (
                  repoCards(popular)
                )}
                {!loadingProfile && !popular.length && (
                  <p className="muted">
                    {t('Chưa có kho mã nổi bật.', 'No featured repositories yet.')}
                  </p>
                )}
              </section>
            )}
          </>
        )}
        {settings.showRepositories && tab === 'repositories' && (
          <section className="card pad">
            <div className="gh-repo-filters">
              <label>
                {t('Tìm kho mã', 'Search repositories')}
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('Tên, công nghệ hoặc topic…', 'Name, technology or topic…')}
                />
              </label>
              <label>
                {t('Sắp xếp', 'Sort')}
                <select value={sort} onChange={(event) => setSort(event.target.value)}>
                  <option value="updated">{t('Cập nhật gần đây', 'Recently updated')}</option>
                  <option value="stars">Stars</option>
                  <option value="name">{t('Tên A–Z', 'Name A–Z')}</option>
                </select>
              </label>
            </div>
            <p className="muted" role="status">
              {repos.length} / {stats.repos.length} {t('kho mã', 'repositories')}
            </p>
            {repoCards(repos)}
            {!repos.length && (
              <p className="empty">
                {t('Không tìm thấy kho mã phù hợp.', 'No matching repositories.')}
              </p>
            )}
          </section>
        )}
        {settings.showCommits && (tab === 'overview' || tab === 'activity') && (
          <section className="card pad gh-history">
            <div className="gh-section-heading">
              <h2>{t('Commit gần đây', 'Recent commits')}</h2>
              {tab === 'overview' && (
                <button className="text-action" onClick={() => setTab('activity')}>
                  {t('Xem lịch sử →', 'View history →')}
                </button>
              )}
            </div>
            {tab === 'activity' && (
              <label className="gh-history-filter">
                {t('Lọc kho mã', 'Filter repositories')}
                <select value={repoFilter} onChange={(event) => setRepoFilter(event.target.value)}>
                  <option value="">{t('Tất cả kho mã', 'All repositories')}</option>
                  {[
                    ...new Set([
                      ...(activity?.commits.map((item) => item.repo) || []),
                      ...(activity?.events.map((item) => item.repo) || []),
                    ]),
                  ]
                    .sort()
                    .map((repo) => (
                      <option key={repo}>{repo}</option>
                    ))}
                </select>
              </label>
            )}
            <p className="github-skills-note">
              {t(
                'Những thay đổi gần đây trong các dự án tôi đang xây dựng.',
                'Recent changes to the projects I’m working on.',
              )}{' '}
              {activity?.commitsStatus !== 'ready' &&
                activity &&
                t('Dữ liệu chưa cập nhật được.', 'Data could not be refreshed.')}
            </p>
            <ol className="gh-timeline">
              {commits.slice(0, tab === 'overview' ? 6 : 30).map((item) => (
                <li key={item.repo + item.sha}>
                  <span className="gh-timeline-marker" aria-hidden="true">
                    ⑂
                  </span>
                  <div>
                    <a
                      href={'https://github.com/' + item.repo + '/commit/' + item.sha}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.message || item.sha.slice(0, 7)} ↗
                    </a>
                    <small>
                      {item.repo} · <code>{item.sha.slice(0, 7)}</code> · {date(item.date)}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
            {!commits.length && (
              <p className="muted">
                {checking
                  ? t('Đang tải commit…', 'Loading commits…')
                  : activity?.commitsStatus === 'ready'
                    ? t(
                        'Không có commit phù hợp trong phạm vi đã tải.',
                        'No matching commits in the loaded range.',
                      )
                    : t('Chưa lấy được lịch sử commit.', 'Commit history is unavailable.')}
              </p>
            )}
          </section>
        )}
        {settings.showEvents && tab === 'activity' && (
          <section className="card pad">
            <h2>{t('Hoạt động công khai', 'Public activity')}</h2>
            <p className="github-skills-note">
              {t(
                'Tối đa 100 sự kiện gần đây trong khoảng thời gian GitHub cung cấp.',
                'Up to 100 recent events within GitHub’s available window.',
              )}{' '}
              {activity?.eventsStatus === 'stale' &&
                t('Đang hiển thị bản lưu cũ.', 'Showing a stale snapshot.')}
            </p>
            <ol className="gh-timeline">
              {events.map((item) => (
                <li key={item.id}>
                  <span className="gh-timeline-marker" aria-hidden="true">
                    •
                  </span>
                  <div>
                    <a
                      href={'https://github.com/' + item.repo}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {eventNames[item.type] || item.type} · {item.repo} ↗
                    </a>
                    <small>
                      {item.action && item.action + ' · '}
                      {date(item.date)}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
            {!events.length && (
              <p className="muted">
                {activity?.eventsStatus === 'ready'
                  ? t(
                      'Chưa có sự kiện công khai trong phạm vi đã tải.',
                      'No public events in the loaded range.',
                    )
                  : t('Chưa lấy được luồng hoạt động GitHub.', 'Public activity is unavailable.')}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function ContributionCalendar({
  days,
  year,
  language,
  onSelect,
}: {
  days: ContributionDay[];
  year: number;
  language: string;
  onSelect: (day: ContributionDay) => void;
}) {
  const first = new Date(Date.UTC(year, 0, 1));
  const offset = first.getUTCDay();
  const length = Math.round((Date.UTC(year + 1, 0, 1) - first.getTime()) / 86400000);
  const data = new Map(days.map((day) => [day.date, day]));
  const months = Array.from({ length: 12 }, (_, month) => ({
    name: new Date(Date.UTC(year, month, 1)).toLocaleDateString(language, {
      month: 'short',
      timeZone: 'UTC',
    }),
    column:
      Math.floor(
        (Math.round((Date.UTC(year, month, 1) - first.getTime()) / 86400000) + offset) / 7,
      ) + 1,
  }));
  return (
    <div
      className="gh-calendar-scroll"
      tabIndex={0}
      aria-label={
        language === 'vi'
          ? 'Lịch đóng góp, cuộn ngang để xem cả năm'
          : 'Contribution calendar, scroll horizontally for the full year'
      }
    >
      <div className="gh-calendar-months">
        {months.map((month, index) => (
          <span style={{ gridColumn: month.column }} key={index}>
            {month.name}
          </span>
        ))}
      </div>
      <div className="gh-calendar-grid">
        {Array.from({ length: offset }, (_, index) => (
          <span key={'pad' + index} />
        ))}
        {Array.from({ length }, (_, index) => {
          const date = new Date(first.getTime() + index * 86400000).toISOString().slice(0, 10);
          const day = data.get(date);
          return day ? (
            <button
              key={date}
              type="button"
              data-day={index}
              className={'gh-day level-' + day.level}
              tabIndex={index === days.length - 1 ? 0 : -1}
              title={date + ' · ' + day.count}
              aria-label={
                date + ': ' + day.count + (language === 'vi' ? ' đóng góp' : ' contributions')
              }
              onClick={() => onSelect(day)}
              onFocus={() => onSelect(day)}
              onKeyDown={(event) => {
                const delta = (
                  { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 } as Record<
                    string,
                    number
                  >
                )[event.key];
                if (delta) {
                  event.preventDefault();
                  const next = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
                    '[data-day="' + (index + delta) + '"]',
                  );
                  next?.focus();
                }
              }}
            />
          ) : (
            <span key={date} className="gh-day future" aria-hidden="true" />
          );
        })}
      </div>
    </div>
  );
}

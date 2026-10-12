'use client';
import type { GithubSettings } from '../lib/schema';
import { useId, useState } from 'react';
import type { GithubSkills } from '../lib/github-skills';
import { useLanguage } from './language';
import { TechnologyChips } from './tech-logo';
import Link from 'next/link';
import { Skeleton } from './skeleton';
import { Icon } from './icon';

export function GithubSkillsCard({
  stats,
  settings,
  avatar,
  loading = false,
}: {
  stats: GithubSkills;
  settings: GithubSettings;
  avatar: string;
  loading?: boolean;
}) {
  const { t, language } = useLanguage();
  const [query, setQuery] = useState('');
  const [allTechnologies, setAllTechnologies] = useState(false);
  const searchId = useId();
  const bodyId = useId();
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const url = 'https://github.com/' + encodeURIComponent(stats.username);
  const repos = stats.repos.filter((repo) =>
    (repo.name + ' ' + (repo.language || '') + ' ' + repo.topics.join(' '))
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const stars = stats.repos.reduce((total, repo) => total + repo.stars, 0);
  const forks = stats.repos.reduce((total, repo) => total + repo.forks, 0);
  const number = (value: number) => value.toLocaleString(language);
  const date = (value: string) =>
    Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString(language) : '—';
  return (
    <section
      className={
        'card pad github-skills-card github-deferred' +
        (mobileExpanded ? ' is-mobile-expanded' : '')
      }
      aria-busy={loading || undefined}
      aria-label={t('Thông tin GitHub', 'GitHub information')}
    >
      <div className="section-heading">
        <h2>GitHub</h2>
        {!loading && (stats.status !== 'ready' || stats.partial) && (
          <span className="github-source-state">
            {stats.status === 'ready'
              ? t('Đồng bộ một phần', 'Partially synced')
              : t('Chưa có dữ liệu', 'No data')}
          </span>
        )}
        <button
          type="button"
          className="github-mobile-toggle"
          aria-expanded={mobileExpanded}
          aria-controls={bodyId}
          aria-label={
            mobileExpanded
              ? t('Thu gọn GitHub', 'Collapse GitHub')
              : t('Mở rộng GitHub', 'Expand GitHub')
          }
          onClick={() => setMobileExpanded((expanded) => !expanded)}
        >
          <span>{mobileExpanded ? t('Thu gọn', 'Show less') : t('Xem', 'Show')}</span>
          <Icon name="next" />
        </button>
      </div>
      <div id={bodyId} className="github-card-body">
        {loading ? (
          <>
            <Skeleton className="skeleton-field" />
            <Skeleton className="skeleton-line" />
            <Skeleton className="skeleton-field" />
          </>
        ) : (
          <>
            <Link className="github-account" href="/github">
              <span className="github-account-symbol" aria-hidden="true">
                {stats.profile?.avatarUrl || avatar ? (
                  <img src={stats.profile?.avatarUrl || avatar} alt="" />
                ) : (
                  stats.username.slice(0, 1).toUpperCase()
                )}
              </span>
              <span>
                <strong>{stats.profile?.name || stats.username}</strong>
                <small>@{stats.username} →</small>
              </span>
            </Link>
            {stats.profile?.bio && <p className="github-account-bio">{stats.profile.bio}</p>}
            {stats.status === 'ready' ? (
              <>
                {settings.showStatistics && (
                  <dl className="github-metrics">
                    <div>
                      <dt>{t('Kho mã', 'Repos')}</dt>
                      <dd>{number(stats.repos.length)}</dd>
                    </div>
                    <div>
                      <dt>Stars</dt>
                      <dd>{number(stars)}</dd>
                    </div>
                    <div>
                      <dt>{t('Người theo dõi', 'Followers')}</dt>
                      <dd>{stats.profile ? number(stats.profile.followers) : '—'}</dd>
                    </div>
                  </dl>
                )}
                {settings.showTechnologies && stats.languages.length > 0 && (
                  <div className="github-tech-block">
                    <h3>{t('Công nghệ nổi bật', 'Top technologies')}</h3>
                    <TechnologyChips
                      names={stats.languages
                        .slice(0, allTechnologies ? undefined : 10)
                        .map((item) => item.name)}
                    />
                    {stats.languages.length > 10 && (
                      <button
                        className="text-action github-tech-toggle"
                        aria-expanded={allTechnologies}
                        onClick={() => setAllTechnologies(!allTechnologies)}
                      >
                        {allTechnologies
                          ? t('Thu gọn', 'Show less')
                          : t(
                              'Xem tất cả ' + stats.languages.length + ' công nghệ',
                              'All ' + stats.languages.length + ' technologies',
                            )}
                      </button>
                    )}
                  </div>
                )}
                {settings.showRepositories && (
                  <details className="github-details">
                    <summary>
                      {t('Khám phá GitHub', 'Explore GitHub')} <span aria-hidden="true">⌄</span>
                    </summary>
                    <div className="github-detail-body">
                      {stats.profile?.bio && <p>{stats.profile.bio}</p>}
                      <dl className="github-profile-facts">
                        {stats.profile?.location && (
                          <div>
                            <dt>{t('Địa điểm', 'Location')}</dt>
                            <dd>{stats.profile.location}</dd>
                          </div>
                        )}
                        {stats.profile?.company && (
                          <div>
                            <dt>{t('Tổ chức', 'Company')}</dt>
                            <dd>{stats.profile.company}</dd>
                          </div>
                        )}
                        {stats.profile && (
                          <>
                            <div>
                              <dt>{t('Đang theo dõi', 'Following')}</dt>
                              <dd>{number(stats.profile.following)}</dd>
                            </div>
                            <div>
                              <dt>{t('Tham gia', 'Joined')}</dt>
                              <dd>{date(stats.profile.createdAt)}</dd>
                            </div>
                          </>
                        )}
                        <div>
                          <dt>Forks</dt>
                          <dd>{number(forks)}</dd>
                        </div>
                      </dl>
                      <p className="github-skills-note">
                        {t(
                          'Ngôn ngữ theo lượng mã nguồn, không tính fork; không phải điểm thành thạo.',
                          'Languages by code size, excluding forks; not a proficiency score.',
                        )}
                      </p>
                      <label htmlFor={searchId}>
                        {t('Tìm kho mã, ngôn ngữ', 'Search repos, languages')}
                      </label>
                      <input
                        id={searchId}
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t('Tên kho mã hoặc công nghệ…', 'Repository or technology…')}
                      />
                      <p className="github-skills-note" role="status">
                        {repos.length} / {stats.repos.length}{' '}
                        {t('kho mã công khai', 'public repositories')}
                      </p>
                      <ul className="github-repositories">
                        {repos.map((repo) => (
                          <li key={repo.name}>
                            <a
                              href={url + '/' + encodeURIComponent(repo.name)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {repo.name} ↗
                            </a>
                            {repo.description && <p>{repo.description}</p>}
                            <small>
                              {[
                                repo.language,
                                '★ ' + number(repo.stars),
                                t('Forks ', 'Forks ') + number(repo.forks),
                                repo.fork && 'Fork',
                                repo.archived && t('Lưu trữ', 'Archived'),
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </small>
                            {repo.topics.length > 0 && <small>{repo.topics.join(' · ')}</small>}
                            <small>
                              {t('Cập nhật ', 'Updated ')}
                              {date(repo.updatedAt)}
                            </small>
                          </li>
                        ))}
                      </ul>
                      {!repos.length && (
                        <p className="muted">
                          {t('Không có kho mã phù hợp.', 'No matching repositories.')}
                        </p>
                      )}
                    </div>
                  </details>
                )}
                <small className="github-sync-note">
                  {stats.partial ? t('Dữ liệu một phần · ', 'Partial data · ') : ''}
                  {t('Cập nhật ', 'Updated ')}
                  {date(stats.updatedAt)}
                </small>
              </>
            ) : (
              <p className="muted">
                {stats.status === 'unavailable'
                  ? t(
                      'Tạm thời chưa kết nối được GitHub. Vui lòng thử lại sau.',
                      'GitHub is temporarily unavailable. Please try again later.',
                    )
                  : t('Chưa có dữ liệu GitHub công khai.', 'No public GitHub data yet.')}
              </p>
            )}
            <Link className="side-link" href="/github">
              {t('Hồ sơ & hoạt động GitHub →', 'GitHub profile & activity →')}
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

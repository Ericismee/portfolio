'use client';
import type { GithubSkills } from '../lib/github-skills';
import { useLanguage } from './language';

export function GithubSkillsCard({ stats }: { stats: GithubSkills }) {
  const { t, language } = useLanguage();
  return (
    <section className="card pad github-skills-card">
      <div className="section-heading">
        <h2>{t('Công nghệ nổi bật', 'Top technologies')}</h2>
        <span className="badge">GitHub</span>
      </div>
      {stats.status === 'ready' ? (
        <>
          <ol className="github-language-list">
            {stats.languages.map((item, index) => (
              <li key={item.name}>
                <div className="github-language-heading">
                  <strong>{item.name}</strong>
                  <span>
                    {item.percent.toLocaleString(language, { maximumFractionDigits: 1 })}%
                  </span>
                </div>
                <div className="github-language-track" aria-hidden="true">
                  <span
                    style={{
                      width: item.percent + '%',
                      background: ['#4264da', '#8b5bc2', '#137d69', '#b25c20', '#5c708c'][index],
                    }}
                  />
                </div>
              </li>
            ))}
          </ol>
          <p className="github-skills-note">
            {t(
              'Top 5 ngôn ngữ theo lượng mã nguồn; không phải điểm thành thạo.',
              'Top 5 languages by code size; not a proficiency score.',
            )}
          </p>
          <small className="muted">
            {stats.repositories}{' '}
            {t('kho mã công khai, không tính fork', 'public repositories, excluding forks')}
            {stats.partial && t(' · Dữ liệu một phần', ' · Partial data')}
          </small>
        </>
      ) : (
        <p className="muted">
          {stats.status === 'unavailable'
            ? t('Tạm thời chưa lấy được dữ liệu GitHub.', 'GitHub data is temporarily unavailable.')
            : t('Chưa có thống kê ngôn ngữ công khai.', 'No public language statistics yet.')}
        </p>
      )}
      {stats.username && (
        <a
          className="side-link"
          href={'https://github.com/' + encodeURIComponent(stats.username) + '?tab=repositories'}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('Xem kho mã trên GitHub ↗', 'View repositories on GitHub ↗')}
        </a>
      )}
    </section>
  );
}

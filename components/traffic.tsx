'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from './icon';
import { useLanguage } from './language';
import { request } from '../lib/client';
import type { trafficDetails } from '../lib/traffic';

const pending = new Map<string, Promise<{ views: number }>>();
export function PublicTraffic() {
  const path = usePathname(),
    { t, language } = useLanguage();
  const [views, setViews] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    let task = pending.get(path);
    if (!task) {
      task = request<{ views: number }>('/api/traffic', 'POST', { path });
      pending.set(path, task);
      void task.finally(() => pending.delete(path)).catch(() => undefined);
    }
    void task
      .then((result) => {
        if (active) setViews(result.views);
      })
      .catch(() => {
        void request<{ views: number }>('/api/traffic')
          .then((result) => {
            if (active) setViews(result.views);
          })
          .catch(() => undefined);
      });
    return () => {
      active = false;
    };
  }, [path]);
  return (
    <footer className="site-traffic">
      {views !== null && (
        <span
          className="traffic-counter"
          title={t('Lượt truy cập website', 'Website visits')}
          aria-label={t(`${views} lượt truy cập`, `${views} website visits`)}
        >
          <Icon name="eye" />
          <span>{views.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}</span>
        </span>
      )}
      <details className="traffic-privacy">
        <summary>{t('Quyền riêng tư', 'Privacy')}</summary>
        <p>
          {t(
            'Website ghi nhận lượt truy cập, IP, trình duyệt và loại thiết bị. IP được mã hóa; chỉ chủ hồ sơ xem được thông tin chi tiết trong 30 ngày. Số tổng không chứa thông tin cá nhân.',
            'This site records visits, IP addresses, browsers and device types. IP addresses are encrypted; only the profile owner can see details for 30 days. Public totals contain no personal information.',
          )}
        </p>
      </details>
    </footer>
  );
}
type Report = Awaited<ReturnType<typeof trafficDetails>>;
export function TrafficAdmin() {
  const { t, language } = useLanguage();
  const [report, setReport] = useState<Report | null>(null),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(
      () => {
        setLoading(true);
        void request<Report>(`/api/admin/traffic?page=${page}&q=${encodeURIComponent(query)}`)
          .then((result) => {
            if (active) {
              setReport(result);
              setError('');
            }
          })
          .catch((e) => {
            if (active) setError(e.message);
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      },
      query ? 300 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [page, query, refresh]);
  const format = (value: number) => value.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US');
  return (
    <section className="traffic-admin" aria-busy={loading}>
      <div className="traffic-heading">
        <div>
          <span className="traffic-kicker">{t('TỔNG QUAN', 'OVERVIEW')}</span>
          <h3>{t('Hồ sơ của bạn được khám phá thế nào?', 'How people discover your profile')}</h3>
          <p className="muted">
            {t(
              'Theo dõi lượt xem và tìm hiểu thiết bị khách sử dụng.',
              'Track views and understand the devices your visitors use.',
            )}
          </p>
        </div>
        <button
          className="btn neutral traffic-refresh"
          onClick={() => setRefresh((v) => v + 1)}
          disabled={loading}
        >
          <Icon name="clock" />
          {t('Làm mới', 'Refresh')}
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="traffic-stats">
        {[
          {
            label: t('Lượt xem hồ sơ', 'Profile views'),
            value: report?.profileViews,
            icon: 'profile',
            hint: t('Trang hồ sơ cá nhân', 'Personal profile page'),
          },
          {
            label: t('Phiên truy cập', 'Visits'),
            value: report?.visits,
            icon: 'globe',
            hint: t('Tổng số phiên 30 phút', 'Total 30-minute sessions'),
          },
          {
            label: t('Lượt xem trang', 'Page views'),
            value: report?.pageViews,
            icon: 'eye',
            hint: t('Trên toàn bộ website', 'Across your website'),
          },
          {
            label: t('Trong 24 giờ', 'Last 24 hours'),
            value: report?.last24Hours,
            icon: 'clock',
            hint: t('Lượt xem gần đây', 'Recent page views'),
          },
        ].map(({ label, value, icon, hint }) => (
          <div className="traffic-stat" key={label}>
            <div className="traffic-stat-top">
              <span>{label}</span>
              <span className="traffic-stat-icon">
                <Icon name={icon} />
              </span>
            </div>
            <strong>{typeof value === 'number' ? format(value) : '—'}</strong>
            <small>{hint}</small>
          </div>
        ))}
      </div>
      <div className="traffic-notice">
        <Icon name="lock" />
        <p>
          {t(
            'Chỉ bạn xem được thông tin chi tiết. IP được mã hóa, chi tiết lưu trong 30 ngày. Không tính lượt của admin và bot đã nhận diện.',
            'Only you can view visitor details. IP addresses are encrypted and details are retained for 30 days. Admin visits and recognized bots are excluded.',
          )}
        </p>
      </div>
      <div className="traffic-list-heading">
        <div>
          <h3>{t('Lượt truy cập gần đây', 'Recent visits')}</h3>
          <p className="muted">
            {t(
              'Thời gian, trang đã xem và thông tin thiết bị.',
              'Time, pages viewed and device information.',
            )}
          </p>
        </div>
        <span className="traffic-record-count">
          {report ? format(report.total) : '—'} {t('bản ghi', 'records')}
        </span>
      </div>
      <label className="traffic-search">
        <span className="sr-only">
          {t(
            'Tìm theo trang, trình duyệt, thiết bị hoặc hệ điều hành',
            'Find a page, browser, device or operating system',
          )}
        </span>
        <Icon name="search" />
        <input
          type="search"
          placeholder={t('Tìm trang, trình duyệt, thiết bị…', 'Search pages, browsers, devices…')}
          value={query}
          maxLength={100}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
      </label>
      <div className="traffic-table-wrap">
        <table className="traffic-table">
          <thead>
            <tr>
              {[
                t('Thời gian', 'Time'),
                t('Trang', 'Page'),
                'IP',
                t('Trình duyệt / Thiết bị', 'Browser / Device'),
              ].map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report?.entries.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <time dateTime={new Date(entry.at).toISOString()}>
                    {new Date(entry.at).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-GB')}
                  </time>
                </td>
                <td>
                  <code>{entry.path}</code>
                </td>
                <td>
                  <code>{entry.ip || t('Không xác định', 'Unknown')}</code>
                </td>
                <td>
                  <strong>
                    {entry.browser === 'Unknown' ? t('Không xác định', 'Unknown') : entry.browser} ·{' '}
                    {entry.device === 'Mobile'
                      ? t('Điện thoại', 'Mobile')
                      : entry.device === 'Tablet'
                        ? t('Máy tính bảng', 'Tablet')
                        : t('Máy tính', 'Desktop')}
                  </strong>
                  <span className="muted">
                    {entry.os === 'Unknown' ? t('Không xác định', 'Unknown') : entry.os}
                  </span>
                  <details>
                    <summary>{t('Chi tiết trình duyệt', 'Browser details')}</summary>
                    <p className="traffic-ua">{entry.userAgent || '—'}</p>
                  </details>
                </td>
              </tr>
            ))}
            {(!report || !report.entries.length) && (
              <tr>
                <td colSpan={4} className="traffic-empty">
                  <span className="traffic-empty-icon">
                    <Icon name={query ? 'search' : 'globe'} />
                  </span>
                  <strong>
                    {loading
                      ? t('Đang tải lượt truy cập…', 'Loading visits…')
                      : query
                        ? t('Không có kết quả phù hợp', 'No matching visits')
                        : t('Chờ những lượt ghé thăm đầu tiên', 'Waiting for your first visitors')}
                  </strong>
                  <p>
                    {query
                      ? t(
                          'Thử tìm bằng tên trang hoặc trình duyệt khác.',
                          'Try another page name or browser.',
                        )
                      : t(
                          'Khi có khách ghé website, thông tin sẽ xuất hiện ở đây. Lượt của bạn khi đăng nhập admin không được tính.',
                          'Visitor details will appear here when someone visits your site. Your signed-in admin visits are excluded.',
                        )}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="traffic-pagination">
        <span className="muted">
          {report
            ? t(
                `${format(report.total)} bản ghi · Trang ${page}`,
                `${format(report.total)} records · Page ${page}`,
              )
            : t('Đang tải…', 'Loading…')}
        </span>
        <div className="row">
          <button
            className="btn neutral"
            disabled={loading || page === 1}
            onClick={() => setPage((v) => v - 1)}
          >
            {t('Trước', 'Previous')}
          </button>
          <button
            className="btn neutral"
            disabled={loading || !report || page * 50 >= report.total}
            onClick={() => setPage((v) => v + 1)}
          >
            {t('Sau', 'Next')}
          </button>
        </div>
      </div>
      <p className="traffic-footnote">
        {t(
          'Mỗi trang được tính một lần trong phiên 30 phút. Số phiên không phải số người duy nhất.',
          'Each page counts once per 30-minute session. Sessions are not unique people.',
        )}
      </p>
    </section>
  );
}

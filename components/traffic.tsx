'use client';
import { Fragment, useEffect, useState } from 'react';
import { useBackgroundRefresh } from './use-background-refresh';
import { usePathname } from 'next/navigation';
import { Icon } from './icon';
import { useLanguage } from './language';
import { request } from '../lib/client';
import type { trafficDetails } from '../lib/traffic';
import { countryName } from '../lib/countries';
import { TrafficCharts } from './traffic-charts';
import { visibleTime } from '../lib/visible-time';

type TrafficReceipt = { views: number; trackingToken?: string };
const pending = new Map<string, Promise<TrafficReceipt>>();
function analyticsToday() {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}
export function PublicTraffic() {
  const path = usePathname(),
    { t, language } = useLanguage();
  const [views, setViews] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    let token = '';
    let suspended = false;
    const instance = crypto.randomUUID();
    const elapsed = visibleTime(performance.now(), document.visibilityState === 'visible');
    const flush = (beacon = false) => {
      const durationMs = elapsed(
        performance.now(),
        active && !suspended && document.visibilityState === 'visible',
      );
      if (!token || durationMs < 1) return;
      const body = JSON.stringify({ token, instance, durationMs });
      if (
        beacon &&
        navigator.sendBeacon(
          '/api/traffic/duration',
          new Blob([body], { type: 'application/json' }),
        )
      )
        return;
      void fetch('/api/traffic/duration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => undefined);
    };
    const visibility = () => flush(true);
    const pageHide = () => {
      suspended = true;
      flush(true);
    };
    const pageShow = () => {
      suspended = false;
      elapsed(performance.now(), document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pageHide);
    window.addEventListener('pageshow', pageShow);
    const heartbeat = setInterval(() => flush(), 30000);
    let task = pending.get(path);
    if (!task) {
      task = request<TrafficReceipt>('/api/traffic', 'POST', {
        path,
        durationTracking: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        width: Math.min(20000, window.innerWidth),
        height: Math.min(20000, window.innerHeight),
        screenWidth: Math.min(20000, window.screen.width),
        screenHeight: Math.min(20000, window.screen.height),
        pixelRatio: Math.min(20, window.devicePixelRatio || 1),
        referrer: document.referrer.slice(0, 2048),
      });
      pending.set(path, task);
      void task.finally(() => pending.delete(path)).catch(() => undefined);
    }
    void task
      .then((result) => {
        token = result.trackingToken || '';
        if (active) setViews(result.views);
        else flush(true);
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
      flush(true);
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pageHide);
      window.removeEventListener('pageshow', pageShow);
    };
  }, [path]);
  return (
    <footer className="site-traffic">
      {
        <span
          className="traffic-counter"
          title={t('Lượt truy cập website', 'Website visits')}
          aria-label={
            views === null
              ? t('Đang tải lượt xem', 'Loading views')
              : t(`${views} lượt truy cập`, `${views} website visits`)
          }
        >
          <Icon name="eye" />
          <span>
            {views === null ? '—' : views.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
          </span>
        </span>
      }
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
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    country: '',
    browser: '',
    device: '',
    os: '',
    path: '',
    ip: '',
  });
  const [ipDraft, setIpDraft] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [range, setRange] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  useBackgroundRefresh(async (isCurrent) => {
    const params = new URLSearchParams({
      page: String(page),
      q: query,
      ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
    });
    const next = await request<Report>(`/api/admin/traffic?${params}`);
    if (isCurrent()) {
      setReport(next);
      setError('');
    }
  }, !loading);
  const extraFilters = ['country', 'browser', 'device', 'os', 'path', 'ip'].filter(
    (key) => filters[key as keyof typeof filters],
  ).length;
  const chooseRange = (value: string) => {
    setRange(value);
    const today = analyticsToday();
    const from =
      value === 'all'
        ? ''
        : new Date(Date.parse(today) - (Number(value) - 1) * 86400_000).toISOString().slice(0, 10);
    setFilters((previous) => ({ ...previous, from, to: value === 'all' ? '' : today }));
    setPage(1);
  };
  const hasFilters = Boolean(query || Object.values(filters).some(Boolean));
  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
    if (key === 'from' || key === 'to') setRange('custom');
  };
  const filterLabels = {
    from: t('Từ', 'From'),
    to: t('Đến', 'To'),
    country: t('Quốc gia', 'Country'),
    browser: t('Trình duyệt', 'Browser'),
    device: t('Thiết bị', 'Device'),
    os: t('Hệ điều hành', 'OS'),
    path: t('Trang', 'Page'),
    ip: 'IP',
  };
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        q: query,
        ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
      });
      void request<Report>(`/api/admin/traffic?${params}`)
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
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [page, query, refresh, filters]);
  const format = (value: number) => value.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US');
  return (
    <section className="traffic-admin" aria-busy={loading}>
      <div className="traffic-heading">
        <div>
          <span className="traffic-kicker">{t('PHÂN TÍCH WEBSITE', 'WEBSITE ANALYTICS')}</span>
          <h3>{t('Tổng quan truy cập', 'Traffic overview')}</h3>
          <p className="muted">
            {t(
              'Lượt xem, nguồn truy cập và thiết bị · UTC+07.',
              'Views, visitor origins and devices · UTC+07.',
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
      <div className="analytics-toolbar">
        <div className="analytics-range-tabs" aria-label={t('Khoảng thời gian', 'Date range')}>
          {['7', '30', '90', 'all'].map((value) => (
            <button key={value} aria-pressed={range === value} onClick={() => chooseRange(value)}>
              {value === 'all'
                ? t('Toàn thời gian', 'All time')
                : t(value + ' ngày', value + ' days')}
            </button>
          ))}
        </div>
        <button
          className="btn neutral analytics-filter-toggle"
          aria-expanded={filtersOpen}
          aria-controls="analytics-filters"
          onClick={() => setFiltersOpen((value) => !value)}
        >
          <Icon name="search" />
          {t('Bộ lọc', 'Filters')}
          {extraFilters > 0 && <span>{extraFilters}</span>}
        </button>
      </div>
      <div className="traffic-stats">
        {[
          {
            label: t('Lượt xem trang', 'Page views'),
            value: report?.filtered.pageViews,
            icon: 'eye',
            hint: t('Theo bộ lọc hiện tại', 'Matching current filters'),
          },
          {
            label: t('Phiên truy cập', 'Sessions'),
            value: report?.filtered.visits,
            icon: 'globe',
            hint: t('Mỗi phiên dài 30 phút', '30-minute sessions'),
          },
          {
            label: t('Lượt xem hồ sơ', 'Profile views'),
            value: report?.filtered.profileViews,
            icon: 'profile',
            hint: t('Trang hồ sơ cá nhân', 'Personal profile page'),
          },
          {
            label: t('Quốc gia', 'Countries'),
            value: report?.filtered.countries,
            icon: 'globe',
            hint: t('Quốc gia đã xác định', 'Identified countries'),
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
      {Object.values(filters).some(Boolean) && (
        <div
          className="analytics-active-filters"
          aria-label={t('Bộ lọc đang áp dụng', 'Active filters')}
        >
          {Object.entries(filters)
            .filter(([, value]) => value)
            .map(([key, value]) => (
              <button
                key={key}
                onClick={() => {
                  updateFilter(key as keyof typeof filters, '');
                  if (key === 'ip') setIpDraft('');
                }}
                aria-label={
                  t('Bỏ bộ lọc ', 'Remove filter ') + filterLabels[key as keyof typeof filters]
                }
              >
                <span>
                  {filterLabels[key as keyof typeof filters]}:{' '}
                  <strong>{key === 'country' ? countryName(value, language) : value}</strong>
                </span>
                <span aria-hidden="true">×</span>
              </button>
            ))}
        </div>
      )}
      <div className="traffic-notice">
        <Icon name="lock" />
        <p>
          {t(
            'Chỉ admin xem chi tiết · IP mã hóa · Lưu lịch sử không tự hết hạn · Loại trừ admin và bot đã nhận diện.',
            'Admin-only details · Encrypted IPs · History never expires automatically · Admins and recognized bots excluded.',
          )}
        </p>
      </div>
      <div className="analytics-filter-panel" id="analytics-filters" hidden={!filtersOpen}>
        <div className="traffic-filters">
          <label>
            {t('Từ ngày', 'From date')}
            <input
              type="date"
              value={filters.from}
              onChange={(e) => updateFilter('from', e.target.value)}
            />
          </label>
          <label>
            {t('Đến ngày', 'To date')}
            <input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => updateFilter('to', e.target.value)}
            />
          </label>
          {(['country', 'browser', 'device', 'os', 'path'] as const).map((key) => (
            <label key={key}>
              {
                {
                  country: t('Quốc gia', 'Country'),
                  browser: t('Trình duyệt', 'Browser'),
                  device: t('Thiết bị', 'Device'),
                  os: t('Hệ điều hành', 'Operating system'),
                  path: t('Trang', 'Page'),
                }[key]
              }
              <select value={filters[key]} onChange={(e) => updateFilter(key, e.target.value)}>
                <option value="">{t('Tất cả', 'All')}</option>
                {[
                  ...new Set([
                    ...(report?.options[key] || []),
                    ...(key === 'country' ? ['unknown'] : []),
                    ...(filters[key] ? [filters[key]] : []),
                  ]),
                ].map((value) => (
                  <option key={value} value={value}>
                    {key === 'country' ? countryName(value, language) : value}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label>
            {t('IP chính xác', 'Exact IP')}
            <input
              value={ipDraft}
              maxLength={45}
              placeholder="IPv4 / IPv6"
              onChange={(e) => setIpDraft(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  updateFilter('ip', ipDraft.trim());
                }
              }}
            />
            <button className="btn neutral" onClick={() => updateFilter('ip', ipDraft.trim())}>
              {t('Lọc IP', 'Filter IP')}
            </button>
          </label>
        </div>
        <div className="traffic-filter-footer">
          <p className="muted">
            {t(
              'Tất cả số liệu và biểu đồ dùng bộ lọc hiện tại. Không chọn ngày để xem toàn bộ lịch sử.',
              'Metrics and charts follow the current filters. Leave dates empty to view the full history.',
            )}
          </p>
          <button
            className="btn neutral"
            onClick={() => {
              setFilters({
                from: '',
                to: '',
                country: '',
                browser: '',
                device: '',
                os: '',
                path: '',
                ip: '',
              });
              setRange('all');
              setQuery('');
              setIpDraft('');
              setPage(1);
            }}
          >
            {t('Xóa bộ lọc', 'Clear filters')}
          </button>
        </div>
      </div>
      <TrafficCharts report={report} onFilter={updateFilter} />
      <div className="traffic-list-heading">
        <div>
          <h3>{t('Nhật ký truy cập', 'Visit log')}</h3>
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
                t('Quốc gia', 'Country'),
                t('Thời gian xem', 'View time'),
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
              <Fragment key={entry.id}>
                <tr className="traffic-visit-row">
                  <td data-label={t('Thời gian', 'Time')}>
                    <time dateTime={new Date(entry.at).toISOString()}>
                      {new Date(entry.at).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-GB', {
                        timeZone: 'Asia/Ho_Chi_Minh',
                      })}
                    </time>
                  </td>
                  <td data-label={t('Trang', 'Page')}>
                    <code>{entry.path}</code>
                  </td>
                  <td data-label="IP">
                    <code>{entry.ip || t('Không xác định', 'Unknown')}</code>
                  </td>
                  <td data-label={t('Quốc gia', 'Country')}>
                    {countryName(entry.country, language)}
                    <span className="muted">
                      {[entry.city, entry.region].filter(Boolean).join(' · ')}
                    </span>
                  </td>
                  <td data-label={t('Thời gian xem', 'View time')}>
                    <span
                      title={t(
                        'Thời gian tab hiển thị, ước tính',
                        'Estimated time with the tab visible',
                      )}
                    >
                      {entry.durationMs == null
                        ? '—'
                        : `${Math.floor(entry.durationMs / 60000)}m ${Math.floor(entry.durationMs / 1000) % 60}s`}
                    </span>
                  </td>
                  <td data-label={t('Trình duyệt / Thiết bị', 'Browser / Device')}>
                    <strong>
                      {entry.browser === 'Unknown' ? t('Không xác định', 'Unknown') : entry.browser}{' '}
                      ·{' '}
                      {entry.device === 'Mobile'
                        ? t('Điện thoại', 'Mobile')
                        : entry.device === 'Tablet'
                          ? t('Máy tính bảng', 'Tablet')
                          : t('Máy tính', 'Desktop')}
                    </strong>
                    <span className="muted">
                      {entry.os === 'Unknown' ? t('Không xác định', 'Unknown') : entry.os}
                    </span>
                    <button
                      className="traffic-expand"
                      aria-expanded={expanded === entry.id}
                      aria-controls={'visit-' + entry.id}
                      onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                    >
                      <Icon name="eye" />
                      {t('Xem thông tin', 'Inspect')}
                    </button>
                  </td>
                </tr>
                {expanded === entry.id && (
                  <tr className="traffic-expanded-row">
                    <td colSpan={6} id={'visit-' + entry.id}>
                      <dl className="traffic-detail-fields">
                        {[
                          [t('Mã phiên', 'Session ID'), entry.sessionId],
                          [
                            t('Quốc gia / Thành phố / Vùng', 'Country / City / Region'),
                            [countryName(entry.country, language), entry.city, entry.region]
                              .filter(Boolean)
                              .join(' · '),
                          ],
                          [t('Nguồn giới thiệu (tên miền)', 'Referring origin'), entry.referrer],
                          [t('Ngôn ngữ trình duyệt', 'Browser language'), entry.language],
                          [t('Múi giờ thiết bị', 'Device timezone'), entry.timezone],
                          [t('Châu lục (mã)', 'Continent code'), entry.continent],
                          [t('Mã bưu chính gần đúng', 'Approximate postal code'), entry.postalCode],
                          [t('Múi giờ theo IP', 'IP timezone'), entry.geoTimezone],
                          [
                            t('Tọa độ theo IP (không phải GPS)', 'IP coordinates (not GPS)'),
                            [entry.latitude, entry.longitude].filter(Boolean).join(', '),
                          ],
                          [
                            t('Kích thước cửa sổ', 'Window size'),
                            entry.width && entry.height ? `${entry.width} × ${entry.height}` : '',
                          ],
                          [
                            t('Kích thước màn hình', 'Screen size'),
                            entry.screenWidth && entry.screenHeight
                              ? `${entry.screenWidth} × ${entry.screenHeight}`
                              : '',
                          ],
                          [
                            t('Tỷ lệ điểm ảnh', 'Pixel ratio'),
                            entry.pixelRatio ? String(entry.pixelRatio) : '',
                          ],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value || t('Không xác định', 'Unknown')}</dd>
                          </div>
                        ))}
                      </dl>
                      <p className="traffic-ua">{entry.userAgent || '—'}</p>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {(!report || !report.entries.length) && (
              <tr>
                <td colSpan={6} className="traffic-empty">
                  <span className="traffic-empty-icon">
                    <Icon name={hasFilters ? 'search' : 'globe'} />
                  </span>
                  <strong>
                    {loading
                      ? t('Đang tải lượt truy cập…', 'Loading visits…')
                      : hasFilters
                        ? t('Không có kết quả phù hợp', 'No matching visits')
                        : t('Chờ những lượt ghé thăm đầu tiên', 'Waiting for your first visitors')}
                  </strong>
                  <p>
                    {hasFilters
                      ? t(
                          'Thử điều chỉnh hoặc xóa bộ lọc để xem thêm lượt truy cập.',
                          'Adjust or clear filters to see more visits.',
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
          'Mỗi trang được tính một lần trong phiên 30 phút. Số phiên không phải số người duy nhất. Thời gian xem ước tính khi tab hiển thị, cập nhật mỗi 30 giây và khi rời trang; bản ghi cũ hiện —.',
          'Each page counts once per 30-minute session. Sessions are not unique people. View time estimates visible-tab time, updated every 30 seconds and on exit; older records show —.',
        )}
      </p>
      <details className="traffic-field-inventory">
        <summary>
          {t('Thông tin đang thu thập và giới hạn', 'Collected information and limitations')}
        </summary>
        <p>
          {t(
            'Thời gian; trang; mã phiên; IP; quốc gia, vùng, thành phố, châu lục, mã bưu chính, tọa độ và múi giờ gần đúng theo IP; trình duyệt, hệ điều hành, loại thiết bị và User-Agent; tên miền giới thiệu; ngôn ngữ; múi giờ thiết bị; kích thước cửa sổ/màn hình; tỷ lệ điểm ảnh. Vị trí lấy từ mạng Vercel, các bản ghi cũ và truy cập local có thể không có. Tọa độ là vị trí gần đúng theo IP, không phải GPS. VPN/proxy có thể làm sai vị trí. Thông tin thiết bị do trình duyệt cung cấp có thể bị giả mạo.',
            'Time; page; session ID; IP; approximate IP-based country, region, city, continent, postal code, coordinates and timezone; browser, operating system, device type and User-Agent; referring domain; language; device timezone; window/screen size; pixel ratio. Location comes from the Vercel network; older records and localhost visits may have no location. Coordinates are approximate IP location, not GPS. VPNs/proxies can affect location. Browser-provided device details can be spoofed.',
          )}
        </p>
        <p>
          {t(
            'Thời gian xem được ước tính khi tab hiển thị, không xác định người xem có đang đọc hay không. Không thu thập GPS, địa chỉ nhà, danh tính/tên/email khách, mật khẩu, cookie đăng nhập, lịch sử duyệt web, nội dung form hoặc nhà mạng/ASN. Chưa đủ dữ liệu để tính chính xác người dùng duy nhất, tỷ lệ thoát hay chuyển đổi.',
            'View time estimates visible-tab time, not whether a visitor is reading. Not collected: GPS, street address, visitor identity/name/email, passwords, authentication cookies, browsing history, form contents or ISP/ASN. There is insufficient tracking to measure unique people, bounce rate or conversions accurately.',
          )}
        </p>
      </details>
    </section>
  );
}

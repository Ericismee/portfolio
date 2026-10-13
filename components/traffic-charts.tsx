'use client';
import { useId, useState, useSyncExternalStore } from 'react';
import type { trafficDetails } from '../lib/traffic';
import { trafficSeries } from '../lib/traffic-series';
import { countryName } from '../lib/countries';
import { useLanguage } from './language';
import { Icon } from './icon';

type Report = Awaited<ReturnType<typeof trafficDetails>>;
type Row = { name: string; views: number };
type Filter = 'country' | 'browser' | 'device' | 'os' | 'path';
const colors = ['#4264da', '#20a49b', '#a078dd', '#d99335'];
function subscribeCompact(listener: () => void) {
  const media = window.matchMedia('(max-width: 600px)');
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}
const readCompact = () => window.matchMedia('(max-width: 600px)').matches;
const serverCompact = () => false;

export function TrafficCharts({
  report,
  onFilter,
}: {
  report: Report | null;
  onFilter: (key: Filter, value: string) => void;
}) {
  const { t, language } = useLanguage();
  const [software, setSoftware] = useState<'browser' | 'os'>('browser');
  const [selectedDate, setSelectedDate] = useState('');
  const compact = useSyncExternalStore(subscribeCompact, readCompact, serverCompact);
  const titleId = useId();
  const { grain, points } = trafficSeries(
    report?.daily || [],
    report?.filters.from,
    report?.filters.to,
  );
  const total = report?.total || 0;
  const number = (value: number) => value.toLocaleString(language);
  const percent = (views: number) => (total ? Math.round((views / total) * 100) : 0);
  const empty = (
    <div className="analytics-chart-empty">{t('Chưa có dữ liệu phù hợp', 'No matching data')}</div>
  );
  const max = Math.max(1, ...points.map((point) => Math.max(point.views, point.visits)));
  const ceiling = Math.max(4, Math.ceil(max / 4) * 4);
  const plotEnd = compact ? 338 : 618;
  const x = (index: number) =>
    points.length === 1 ? (48 + plotEnd) / 2 : 48 + (index / (points.length - 1)) * (plotEnd - 48);
  const y = (value: number) => 174 - (value / ceiling) * 146;
  const path = (key: 'views' | 'visits') =>
    points.map((point, index) => `${index ? 'L' : 'M'}${x(index)},${y(point[key])}`).join(' ');
  const devices = report?.breakdowns.device || [];
  const foundIndex = points.findIndex((point) => point.date === selectedDate);
  const selectedIndex = Math.max(0, foundIndex < 0 ? points.length - 1 : foundIndex);
  const selected = points[selectedIndex];
  const dateLabel = (date: string) =>
    grain === 'year'
      ? date
      : new Intl.DateTimeFormat(language, {
          month: 'short',
          ...(grain === 'day' ? { day: 'numeric' as const } : { year: 'numeric' as const }),
          timeZone: 'UTC',
        }).format(new Date(date + (grain === 'month' ? '-01' : '') + 'T00:00:00Z'));
  const deviceName = (value: string) =>
    ({
      Desktop: t('Máy tính', 'Desktop'),
      Mobile: t('Điện thoại', 'Mobile'),
      Tablet: t('Máy tính bảng', 'Tablet'),
      Unknown: t('Không xác định', 'Unknown'),
    })[value] || value;
  const bars = (rows: Row[], key: Filter, label: (name: string) => string = (name) => name) =>
    rows.length ? (
      <div className="analytics-ranking">
        {rows.slice(0, 6).map((row, index) => (
          <button
            key={row.name}
            className="analytics-ranking-row"
            onClick={() => onFilter(key, row.name)}
            title={t('Bấm để lọc', 'Click to filter')}
            aria-label={`${label(row.name)}: ${number(row.views)} ${t('lượt xem', 'views')}, ${percent(row.views)}%. ${t('Bấm để lọc', 'Click to filter')}`}
          >
            <span className="analytics-rank">{index + 1}</span>
            <span className="analytics-rank-main">
              <span>{label(row.name)}</span>
              <span className="analytics-rank-track">
                <i
                  style={{
                    width: `${Math.max(1, (row.views / Math.max(1, rows[0].views)) * 100)}%`,
                  }}
                />
              </span>
            </span>
            <strong>
              {number(row.views)}
              <small>{percent(row.views)}%</small>
            </strong>
          </button>
        ))}
      </div>
    ) : (
      empty
    );
  return (
    <div className="analytics-charts" id="traffic-charts">
      <section className="analytics-panel analytics-trend">
        <div className="analytics-panel-heading">
          <div>
            <h4>{t('Xu hướng truy cập', 'Traffic trend')}</h4>
            <span className="muted">
              {grain === 'day'
                ? t('Theo ngày', 'Daily')
                : grain === 'month'
                  ? t('Theo tháng', 'Monthly')
                  : t('Theo năm', 'Yearly')}{' '}
              · UTC+07
            </span>
          </div>
          <div className="analytics-legend">
            <span>
              <i style={{ background: colors[0] }} />
              {t('Lượt xem', 'Views')}
            </span>
            <span>
              <i style={{ background: colors[1] }} />
              {t('Phiên', 'Sessions')}
            </span>
          </div>
        </div>
        {points.length ? (
          <>
            <div className="analytics-period-controls">
              <button
                type="button"
                aria-label={t('Mốc trước', 'Previous period')}
                disabled={selectedIndex === 0}
                onClick={() => setSelectedDate(points[selectedIndex - 1].date)}
              >
                <Icon name="previous" />
              </button>
              <div className="analytics-point-summary" aria-live="polite">
                <span>{dateLabel(selected.date)}</span>
                <div>
                  <strong>{number(selected.views)}</strong> {t('lượt xem', 'views')}
                  <i />
                  <strong>{number(selected.visits)}</strong> {t('phiên', 'sessions')}
                </div>
              </div>
              <button
                type="button"
                aria-label={t('Mốc sau', 'Next period')}
                disabled={selectedIndex === points.length - 1}
                onClick={() => setSelectedDate(points[selectedIndex + 1].date)}
              >
                <Icon name="next" />
              </button>
            </div>
            <svg
              className="analytics-line-chart"
              viewBox={`0 0 ${compact ? 360 : 640} 210`}
              role="img"
              aria-labelledby={titleId}
            >
              <title id={titleId}>
                {t(
                  'Biểu đồ lượt xem và phiên truy cập theo thời gian',
                  'Page views and sessions over time',
                )}
              </title>
              <defs>
                <linearGradient id={`${titleId}-area`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors[0]} stopOpacity=".20" />
                  <stop offset="100%" stopColor={colors[0]} stopOpacity=".01" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3, 4].map((step) => {
                const value = (ceiling * step) / 4;
                return (
                  <g key={step}>
                    <line
                      x1="48"
                      x2={plotEnd}
                      y1={y(value)}
                      y2={y(value)}
                      className="analytics-gridline"
                    />
                    <text x="38" y={y(value) + 4} textAnchor="end">
                      {number(Math.round(value))}
                    </text>
                  </g>
                );
              })}
              <path
                d={`${path('views')} L${x(points.length - 1)},174 L${x(0)},174 Z`}
                fill={`url(#${titleId}-area)`}
              />
              <line
                x1={x(selectedIndex)}
                x2={x(selectedIndex)}
                y1="28"
                y2="174"
                className="analytics-selection-line"
              />
              <path
                d={path('views')}
                fill="none"
                stroke={colors[0]}
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <path
                d={path('visits')}
                fill="none"
                stroke={colors[1]}
                strokeWidth="2"
                strokeDasharray="5 4"
              />
              {points.map((point, index) => (
                <circle
                  key={point.date}
                  cx={x(index)}
                  cy={y(point.views)}
                  r={points.length > 40 ? 2 : 3.5}
                  fill={colors[0]}
                  onPointerEnter={() => setSelectedDate(point.date)}
                >
                  <title>
                    {point.date}: {number(point.views)} {t('lượt xem', 'views')},{' '}
                    {number(point.visits)} {t('phiên', 'sessions')}
                  </title>
                </circle>
              ))}
              {[
                ...new Set(
                  compact
                    ? [0, points.length - 1]
                    : [
                        0,
                        Math.floor((points.length - 1) / 3),
                        Math.floor(((points.length - 1) * 2) / 3),
                        points.length - 1,
                      ],
                ),
              ].map((index) => (
                <text
                  key={index}
                  x={x(index)}
                  y="200"
                  textAnchor={
                    index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'
                  }
                >
                  {dateLabel(points[index].date)}
                </text>
              ))}
            </svg>
            {points.length > 1 && (
              <input
                className="analytics-scrubber"
                type="range"
                min="0"
                max={points.length - 1}
                value={selectedIndex}
                aria-label={t('Chọn mốc thời gian trên biểu đồ', 'Choose chart period')}
                aria-valuetext={`${selected.date}: ${selected.views} ${t('lượt xem', 'views')}, ${selected.visits} ${t('phiên', 'sessions')}`}
                onChange={(event) => setSelectedDate(points[Number(event.target.value)].date)}
              />
            )}
            <details className="analytics-chart-data">
              <summary>{t('Xem dữ liệu biểu đồ', 'View chart data')}</summary>
              <div>
                <table>
                  <thead>
                    <tr>
                      <th>{t('Thời gian', 'Period')}</th>
                      <th>{t('Lượt xem', 'Views')}</th>
                      <th>{t('Phiên', 'Sessions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((point) => (
                      <tr key={point.date}>
                        <td>{point.date}</td>
                        <td>{number(point.views)}</td>
                        <td>{number(point.visits)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          empty
        )}
      </section>
      <section className="analytics-panel analytics-devices">
        <div className="analytics-panel-heading">
          <h4>{t('Thiết bị', 'Devices')}</h4>
          <span className="muted">{t('Tỷ lệ lượt xem', 'Share of views')}</span>
        </div>
        {devices.length ? (
          <div className="analytics-device-content">
            <div className="analytics-donut-wrap">
              <svg
                viewBox="0 0 160 160"
                className="analytics-donut"
                role="img"
                aria-label={t('Phân bố lượt xem theo thiết bị', 'Page views by device')}
              >
                <circle
                  cx="80"
                  cy="80"
                  r="60"
                  fill="none"
                  className="analytics-donut-track"
                  strokeWidth="20"
                />
                {devices.map((row, index) => {
                  const size = total ? (row.views / total) * 100 : 0;
                  const start = total
                    ? (devices.slice(0, index).reduce((sum, item) => sum + item.views, 0) / total) *
                      100
                    : 0;
                  return (
                    <circle
                      key={row.name}
                      cx="80"
                      cy="80"
                      r="60"
                      pathLength="100"
                      fill="none"
                      stroke={colors[index % colors.length]}
                      strokeWidth="20"
                      strokeDasharray={`${size} ${100 - size}`}
                      strokeDashoffset={-start}
                      transform="rotate(-90 80 80)"
                    >
                      <title>
                        {deviceName(row.name)}: {number(row.views)} ({percent(row.views)}%)
                      </title>
                    </circle>
                  );
                })}
                <text x="80" y="79" textAnchor="middle" className="analytics-donut-total">
                  {number(total)}
                </text>
                <text x="80" y="98" textAnchor="middle">
                  {t('lượt xem', 'views')}
                </text>
              </svg>
            </div>
            <div className="analytics-device-legend">
              {devices.map((row, index) => (
                <button key={row.name} onClick={() => onFilter('device', row.name)}>
                  <i style={{ background: colors[index % colors.length] }} />
                  <span>{deviceName(row.name)}</span>
                  <strong>
                    {number(row.views)} <small>{percent(row.views)}%</small>
                  </strong>
                </button>
              ))}
            </div>
          </div>
        ) : (
          empty
        )}
      </section>
      <section className="analytics-panel">
        <div className="analytics-panel-heading">
          <h4>{t('Quốc gia', 'Countries')}</h4>
          <span className="muted">Top 6</span>
        </div>
        {bars(
          (report?.countries || []).map((row) => ({ name: row.country, views: row.views })),
          'country',
          (name) => countryName(name, language),
        )}
      </section>
      <section className="analytics-panel">
        <div className="analytics-panel-heading">
          <h4>{t('Phần mềm', 'Software')}</h4>
          <div className="analytics-chart-tabs">
            <button aria-pressed={software === 'browser'} onClick={() => setSoftware('browser')}>
              {t('Trình duyệt', 'Browser')}
            </button>
            <button aria-pressed={software === 'os'} onClick={() => setSoftware('os')}>
              {t('Hệ điều hành', 'OS')}
            </button>
          </div>
        </div>
        {bars(report?.breakdowns[software] || [], software)}
      </section>
      <section className="analytics-panel">
        <div className="analytics-panel-heading">
          <h4>{t('Trang được xem', 'Top pages')}</h4>
          <span className="muted">Top 5</span>
        </div>
        {report?.breakdowns.path.length ? (
          <div className="analytics-columns">
            {report.breakdowns.path.slice(0, 5).map((row) => (
              <button
                key={row.name}
                onClick={() => onFilter('path', row.name)}
                title={`${row.name}: ${number(row.views)} ${t('lượt xem', 'views')}`}
              >
                <strong>{number(row.views)}</strong>
                <span className="analytics-column-track">
                  <i
                    style={{
                      height: `${Math.max(2, (row.views / Math.max(1, report.breakdowns.path[0].views)) * 100)}%`,
                    }}
                  />
                </span>
                <span className="analytics-column-name">{row.name}</span>
              </button>
            ))}
          </div>
        ) : (
          empty
        )}
      </section>
    </div>
  );
}

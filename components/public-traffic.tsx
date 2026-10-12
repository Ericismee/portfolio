'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from './icon';
import { useLanguage } from './language';
import { request } from '../lib/client';
import { visibleTime } from '../lib/visible-time';
type TrafficReceipt = { views: number; trackingToken?: string };
const pending = new Map<string, Promise<TrafficReceipt>>();
export function PublicTraffic({ visible = true }: { visible?: boolean }) {
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
  if (!visible) return null;
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

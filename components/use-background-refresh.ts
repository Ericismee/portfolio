'use client';
import { useEffect, useRef } from 'react';
import { PAGE_REFRESH_EVENT, type PageRefreshRequest } from '../lib/page-refresh';

// One request at a time, only while the page is visible and online. Keep the
// latest callback without restarting the timer on every render.
export function useBackgroundRefresh(
  refresh: (isCurrent: () => boolean) => Promise<void>,
  enabled = true,
  interval = 30_000,
) {
  const callback = useRef(refresh);
  useEffect(() => {
    callback.current = refresh;
  });
  useEffect(() => {
    if (!enabled) return;
    let active = true,
      failures = 0;
    let running: Promise<void> | null = null;
    let timer: ReturnType<typeof setTimeout>;
    const visible = () => active && document.visibilityState === 'visible' && navigator.onLine;
    const schedule = () => {
      timer = setTimeout(run, interval * Math.min(4, 2 ** failures));
    };
    function run(manual = false): Promise<void> {
      clearTimeout(timer);
      if (!active || !visible()) return Promise.resolve();
      if (!running) {
        running = (async () => {
          try {
            await callback.current(visible);
            failures = 0;
          } catch {
            failures += 1;
            throw Error('Refresh failed');
          } finally {
            running = null;
            if (active) schedule();
          }
        })();
      }
      return manual ? running : running.catch(() => {});
    }
    const resume = () => {
      if (visible()) void run();
      else clearTimeout(timer);
    };
    const manualRefresh = (event: Event) => {
      (event as CustomEvent<PageRefreshRequest>).detail.tasks.push(run(true));
    };
    schedule();
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    window.addEventListener('offline', resume);
    window.addEventListener(PAGE_REFRESH_EVENT, manualRefresh);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
      window.removeEventListener('online', resume);
      window.removeEventListener('offline', resume);
      window.removeEventListener(PAGE_REFRESH_EVENT, manualRefresh);
    };
  }, [enabled, interval]);
}

'use client';
import { useEffect, useRef } from 'react';

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
      running = false,
      failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    const visible = () => active && document.visibilityState === 'visible' && navigator.onLine;
    const schedule = () => {
      timer = setTimeout(run, interval * Math.min(4, 2 ** failures));
    };
    async function run() {
      clearTimeout(timer);
      if (running || !active) return;
      if (!visible()) return;
      running = true;
      try {
        await callback.current(visible);
        failures = 0;
      } catch {
        failures += 1;
      } finally {
        running = false;
        if (active) schedule();
      }
    }
    const resume = () => {
      if (visible()) void run();
      else clearTimeout(timer);
    };
    schedule();
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    window.addEventListener('offline', resume);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
      window.removeEventListener('online', resume);
      window.removeEventListener('offline', resume);
    };
  }, [enabled, interval]);
}

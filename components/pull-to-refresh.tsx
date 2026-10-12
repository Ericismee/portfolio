'use client';
import { useEffect, useState } from 'react';
import { useLanguage } from './language';

export function PullToRefresh({
  refresh,
  refreshing,
  message,
}: {
  refresh: () => void;
  refreshing: boolean;
  message: string;
}) {
  const { t } = useLanguage();
  const [distance, setDistance] = useState(0);
  useEffect(() => {
    let start: { x: number; y: number } | null = null;
    let pulled = 0;
    const reset = () => {
      start = null;
      pulled = 0;
      setDistance(0);
    };
    const begin = (event: TouchEvent) => {
      if (
        refreshing ||
        window.scrollY > 0 ||
        event.touches.length !== 1 ||
        document.querySelector('dialog[open]')
      )
        return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, button, a, summary, [contenteditable="true"]'))
        return;
      for (let parent = target; parent && parent !== document.body; parent = parent.parentElement!)
        if (parent.scrollTop > 0) return;
      start = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    };
    const move = (event: TouchEvent) => {
      if (!start) return;
      if (event.touches.length !== 1 || window.scrollY > 0) return reset();
      const dy = event.touches[0].clientY - start.y;
      const dx = Math.abs(event.touches[0].clientX - start.x);
      if (dy <= 0 || dx > Math.abs(dy)) return reset();
      if (dy > 0) {
        if (event.cancelable) event.preventDefault();
        pulled = Math.min(96, dy * 0.65);
        setDistance(pulled);
      }
    };
    const end = () => {
      const ready = pulled >= 72;
      reset();
      if (ready) refresh();
    };
    document.addEventListener('touchstart', begin, { passive: true });
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end);
    document.addEventListener('touchcancel', reset);
    return () => {
      document.removeEventListener('touchstart', begin);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end);
      document.removeEventListener('touchcancel', reset);
    };
  }, [refresh, refreshing]);
  return (
    <div
      className={
        'page-refresh-status' + (refreshing || distance > 8 || message ? ' is-visible' : '')
      }
      role="status"
      aria-live="polite"
    >
      <span className={refreshing ? 'refresh-spinner' : ''} aria-hidden="true">
        ↻
      </span>
      {refreshing
        ? t('Đang cập nhật…', 'Refreshing…')
        : distance > 8
          ? distance >= 72
            ? t('Thả để cập nhật', 'Release to refresh')
            : t('Kéo xuống để cập nhật', 'Pull to refresh')
          : message}
    </div>
  );
}

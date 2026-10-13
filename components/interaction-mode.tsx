'use client';

import { useEffect } from 'react';

// Touch should not inherit hover/focus decoration from a previous tap.
// A hardware keyboard immediately restores the normal focus indicators.
export function InteractionMode() {
  useEffect(() => {
    const root = document.documentElement;
    const pointer = (event: PointerEvent) => {
      root.dataset.inputMode = event.pointerType === 'touch' ? 'touch' : 'pointer';
    };
    const keyboard = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey && !event.altKey) root.dataset.inputMode = 'keyboard';
    };
    document.addEventListener('pointerdown', pointer, true);
    document.addEventListener('keydown', keyboard, true);
    return () => {
      document.removeEventListener('pointerdown', pointer, true);
      document.removeEventListener('keydown', keyboard, true);
      delete root.dataset.inputMode;
    };
  }, []);
  return null;
}

// Use a monotonic clock; hidden tabs and suspended timers do not inflate viewing time.
export function visibleTime(start: number, visible: boolean) {
  let previous = start;
  let total = 0;
  let showing = visible;
  return (now: number, nextVisible = showing) => {
    if (showing) total = Math.min(86400_000, total + Math.max(0, Math.min(60000, now - previous)));
    previous = now;
    showing = nextVisible;
    return Math.floor(total);
  };
}

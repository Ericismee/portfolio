export const PAGE_REFRESH_EVENT = 'profile:refresh';
export type PageRefreshRequest = { tasks: Promise<void>[] };
let pending: Promise<void> | null = null;

// All mounted data sources participate without remounting the persistent shell.
export function requestPageRefresh(): Promise<void> {
  if (pending) return pending;
  const detail: PageRefreshRequest = { tasks: [] };
  window.dispatchEvent(new CustomEvent(PAGE_REFRESH_EVENT, { detail }));
  pending = Promise.allSettled(detail.tasks)
    .then((results) => {
      if (results.some((result) => result.status === 'rejected')) throw Error('Refresh failed');
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

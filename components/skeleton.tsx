export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={'skeleton ' + className} />;
}

function CardSkeleton({ cover = false }: { cover?: boolean }) {
  return (
    <section className="card pad skeleton-card" aria-hidden="true">
      {cover && <Skeleton className="skeleton-cover" />}
      <Skeleton className="skeleton-title" />
      <Skeleton className="skeleton-line" />
      <Skeleton className="skeleton-line" />
      <Skeleton className="skeleton-line skeleton-short" />
    </section>
  );
}

export function PublicSkeleton() {
  return (
    <div role="status" aria-label="Loading page" aria-busy="true" className="public-skeleton">
      <div className="layout">
        <div className="main">
          <CardSkeleton cover />
          <CardSkeleton />
        </div>
        <aside className="sidebar">
          <CardSkeleton />
          <CardSkeleton />
        </aside>
      </div>
    </div>
  );
}

export function AdminSkeleton() {
  return (
    <div role="status" aria-label="Loading administration" aria-busy="true">
      <div className="admin-header">
        <Skeleton className="skeleton-search" />
        <Skeleton className="skeleton-menu" />
      </div>
      <div className="admin-shell">
        <aside className="admin-nav skeleton-admin-nav" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="skeleton-nav-row" />
          ))}
        </aside>
        <main className="admin-content">
          <Skeleton className="skeleton-title" />
          <section className="card pad skeleton-form" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i}>
                <Skeleton className="skeleton-label" />
                <Skeleton className="skeleton-field" />
              </div>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
}

export function AccountSkeleton() {
  return (
    <div role="status" aria-label="Loading account" aria-busy="true">
      {Array.from({ length: 3 }, (_, i) => (
        <div className="account-action-row" key={i}>
          <Skeleton className="skeleton-avatar" />
          <div>
            <Skeleton className="skeleton-label" />
            <Skeleton className="skeleton-line" />
          </div>
          <Skeleton className="skeleton-button" />
        </div>
      ))}
    </div>
  );
}

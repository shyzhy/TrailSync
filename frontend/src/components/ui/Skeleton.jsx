// One shimmering placeholder bar; every skeleton below is built from it and shaped like the real content.
export function Skeleton({ className = '', style }) {
  return <div className={`ts-skeleton ${className}`} style={style} aria-hidden="true" />;
}

// Announces a loading region once, instead of every bar.
export function SkeletonGroup({ label = 'Loading', children, className = '' }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      {children}
    </div>
  );
}

// Dashboard stat card.
export function StatCardSkeleton() {
  return (
    <div className="ts-skeleton-card p-5">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="mt-4 h-8 w-14" />
      <Skeleton className="mt-2.5 h-3.5 w-28" />
    </div>
  );
}

// A list row with an avatar or dot, a title line and a meta line.
export function ListRowSkeleton({ avatar = true }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      {avatar && <Skeleton className="h-8 w-8 shrink-0 rounded-full" />}
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-40 max-w-full" />
        <Skeleton className="h-3 w-24 max-w-full" />
      </div>
    </div>
  );
}

// The perforated ticket on Track Requests.
export function TicketSkeleton() {
  return (
    <div className="ts-skeleton-card flex overflow-hidden">
      <Skeleton className="m-3 h-20 w-24 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2.5 p-4">
        <Skeleton className="h-4 w-48 max-w-full" />
        <Skeleton className="h-3 w-32 max-w-full" />
        <Skeleton className="mt-3 h-2 w-full" />
      </div>
    </div>
  );
}

// A Credential Guide catalogue card.
export function GuideCardSkeleton() {
  return (
    <div className="ts-skeleton-card space-y-3 p-5">
      <Skeleton className="h-9 w-9 rounded-xl" />
      <Skeleton className="h-4 w-40 max-w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

// One row of a records table, sized by its column widths in grid units.
export function TableRowSkeleton({ widths = [2, 4, 2, 3, 1] }) {
  const total = widths.reduce((a, b) => a + b, 0);
  return (
    <div className="grid items-center gap-3 px-5 py-4" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
      {widths.map((w, i) => (
        <Skeleton key={i} className="h-4" style={{ gridColumn: `span ${w} / span ${w}` }} />
      ))}
    </div>
  );
}

// The Request Review page's two-column shape.
export function DetailPageSkeleton() {
  return (
    <SkeletonGroup label="Loading this request" className="mt-4">
      <Skeleton className="h-9 w-56 max-w-full" />
      <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="ts-skeleton-card space-y-4 p-6 lg:col-span-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-56 max-w-full" />
          <Skeleton className="h-3 w-44 max-w-full" />
          <div className="grid grid-cols-1 gap-4 pt-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-32 max-w-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="ts-skeleton-card space-y-4 p-6 lg:col-span-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-40 max-w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="mt-6 h-11 w-full rounded-lg" />
        </div>
      </div>
    </SkeletonGroup>
  );
}

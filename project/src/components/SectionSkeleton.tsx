/**
 * Placeholder shaped like the page that is loading (title, filters, rows or
 * cards) instead of a spinner, so the screen does not jump when data arrives.
 */
export function SectionSkeleton({ variant = 'table', rows = 6 }: { variant?: 'table' | 'cards' | 'list' | 'profile'; rows?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="space-y-2">
        <div className="skeleton h-7 w-48 rounded-lg" />
        <div className="skeleton h-4 w-72 max-w-full rounded-lg" />
      </div>

      {variant === 'cards' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <div className="skeleton h-4 w-24 rounded" />
              <div className="skeleton h-8 w-16 rounded" />
            </div>
          ))}
        </div>
      )}

      {variant === 'profile' ? (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="skeleton w-24 h-24 rounded-full" />
            <div className="space-y-2 flex-1">
              <div className="skeleton h-5 w-40 rounded" />
              <div className="skeleton h-4 w-56 max-w-full rounded" />
            </div>
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-11 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
          {variant === 'table' && (
            <div className="flex gap-3 p-4">
              <div className="skeleton h-10 flex-1 rounded-lg" />
              <div className="skeleton h-10 w-28 rounded-lg hidden sm:block" />
            </div>
          )}
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <div className={`skeleton ${variant === 'list' ? 'w-9 h-9 rounded-full' : 'w-12 h-12 rounded-lg'} flex-shrink-0`} />
              <div className="flex-1 space-y-2 min-w-0">
                <div className="skeleton h-4 rounded" style={{ width: `${70 - (i % 3) * 15}%` }} />
                <div className="skeleton h-3 w-1/3 rounded" />
              </div>
              <div className="skeleton h-8 w-20 rounded-lg hidden sm:block" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

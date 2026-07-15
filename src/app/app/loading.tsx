/**
 * Loading skeleton for app routes — gives instant feedback while
 * Server Components fetch data. Uses the Soft Focus design tokens.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8" aria-busy="true" aria-label="Loading">
      {/* Header skeleton */}
      <div className="mb-6 flex items-center gap-3">
        <div className="h-9 w-32 animate-pulse rounded-xl bg-surface-sunken" />
        <div className="h-7 w-24 animate-pulse rounded-xl bg-surface-sunken" />
      </div>
      {/* Timeline skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5"
            style={{ opacity: 1 - i * 0.15 }}
          >
            <div className="size-10 shrink-0 animate-pulse rounded-full bg-surface-sunken" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 animate-pulse rounded-lg bg-surface-sunken" />
              <div className="h-3 w-32 animate-pulse rounded-lg bg-surface-sunken" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

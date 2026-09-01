export function TreinoSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="rounded-lg border border-[--color-border] bg-[--color-bg] p-4 shadow-sm"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="h-12 w-12 animate-pulse rounded-lg bg-[--color-bg-muted]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-[--color-bg-muted]" />
          <div className="h-3 w-32 animate-pulse rounded bg-[--color-bg-muted]" />
        </div>
      </div>

      <div className="space-y-3">
        {[0, 1, 2].map((idx) => (
          <div key={idx} className="flex items-center gap-3">
            <div className="h-[60px] w-[60px] flex-shrink-0 animate-pulse rounded-lg bg-[--color-bg-muted]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-[--color-bg-muted]" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-[--color-bg-muted]" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-[--color-bg-muted]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

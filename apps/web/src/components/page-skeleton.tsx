import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Instant loading UI for route segments (loading.tsx). Mirrors the F-806 workspace
 * layout: MiniStat tile grid → bordered card with a filter/header bar and rows.
 * role="status" + sr-only text keeps screen readers informed.
 */
function TileSkeleton() {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
      <Skeleton className="h-3 w-3/5" />
      <Skeleton className="mt-1.5 h-6 w-1/3" />
      <Skeleton className="mt-1.5 h-2.5 w-4/5" />
    </div>
  );
}

function RowSkeleton({ wide }: { wide?: boolean }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <Skeleton className="size-8 shrink-0 rounded-lg" />
      <Skeleton className={cn('h-3.5', wide ? 'w-44' : 'w-32')} />
      <Skeleton className="h-3.5 flex-1" />
      <Skeleton className="hidden h-3.5 w-24 sm:block" />
      <Skeleton className="hidden h-3.5 w-20 lg:block" />
    </div>
  );
}

function CardSkeleton({ bar = true, rows = 8, className }: { bar?: boolean; rows?: number; className?: string }) {
  return (
    <section className={cn('flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]', className)}>
      {bar ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <Skeleton className="h-9 min-w-44 flex-[2_1_12rem]" />
          <Skeleton className="h-9 min-w-32 flex-[1_1_8rem]" />
          <Skeleton className="h-9 min-w-32 flex-[1_1_8rem]" />
          <Skeleton className="h-9 w-20 flex-none" />
        </div>
      ) : (
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <Skeleton className="size-8 shrink-0 rounded-xl" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 divide-y divide-slate-100">
        {Array.from({ length: rows }, (_, i) => (
          <RowSkeleton key={i} wide={i % 3 === 0} />
        ))}
      </div>
      {bar ? (
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-8 w-40" />
        </div>
      ) : null}
    </section>
  );
}

/** List/workspace pages (default for every role area). */
export function PageSkeleton({ tiles = 6, rows = 9 }: { tiles?: number; rows?: number }) {
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]" role="status" aria-label="Loading">
      <span className="sr-only">Loading…</span>
      {tiles > 0 ? (
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6" aria-hidden="true">
          {Array.from({ length: tiles }, (_, i) => (
            <TileSkeleton key={i} />
          ))}
        </div>
      ) : null}
      <div aria-hidden="true" className="flex min-h-0 flex-1 flex-col">
        <CardSkeleton rows={rows} />
      </div>
    </div>
  );
}

/** Detail pages (`[id]` routes): header block + stat strip + stacked cards. */
export function DetailSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading">
      <span className="sr-only">Loading…</span>
      <div className="flex items-center gap-4" aria-hidden="true">
        <Skeleton className="size-12 shrink-0 rounded-xl" />
        <div className="grid min-w-0 flex-1 gap-2">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-7 w-52 max-w-full" />
          <Skeleton className="h-3 w-72 max-w-full" />
        </div>
      </div>
      {tiles > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-hidden="true">
          {Array.from({ length: tiles }, (_, i) => (
            <TileSkeleton key={i} />
          ))}
        </div>
      ) : null}
      <div aria-hidden="true" className="grid items-start gap-3 lg:grid-cols-2">
        <CardSkeleton bar={false} rows={5} />
        <CardSkeleton bar={false} rows={5} />
      </div>
    </div>
  );
}

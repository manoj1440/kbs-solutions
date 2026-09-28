import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center p-6" role="status" aria-label="Loading">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-64 w-full max-w-md rounded-2xl" />
    </div>
  );
}

import { redirect } from 'next/navigation';

/** F-807: the executive view is the Business overview; old links and filtered drill-downs keep working. */
export default async function ExecutiveDashboardRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === 'string') qs.set(k, v);
  redirect(qs.size ? `/admin?${qs.toString()}` : '/admin');
}

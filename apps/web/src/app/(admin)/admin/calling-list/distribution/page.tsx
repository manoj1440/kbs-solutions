import { redirect } from 'next/navigation';

/** F-808: allocation now lives in Caller performance (load, eligibility) and Calling records (per-record reassignment). */
export default async function AdminDistributionRedirect({ searchParams }: { searchParams: Promise<{ telecallerId?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  if (sp.telecallerId) redirect(`/admin/calling-list?telecallerId=${encodeURIComponent(sp.telecallerId)}`);
  const qs = new URLSearchParams(Object.entries({ from: sp.from, to: sp.to }).filter((e): e is [string, string] => Boolean(e[1])));
  redirect(`/admin/calling-list/performance${qs.size ? `?${qs.toString()}` : ''}`);
}

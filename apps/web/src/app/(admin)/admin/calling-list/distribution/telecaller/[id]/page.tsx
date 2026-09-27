import { redirect } from 'next/navigation';

/** F-808: the caller drill-down moved under Caller performance. */
export default async function AdminTelecallerActivityRedirect({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const qs = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === 'string'));
  redirect(`/admin/calling-list/performance/telecaller/${id}${qs.size ? `?${qs.toString()}` : ''}`);
}

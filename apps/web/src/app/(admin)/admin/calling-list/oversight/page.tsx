import { redirect } from 'next/navigation';

/** F-808: call/delivery evidence was folded out of the Admin UI — deep links land on Caller performance. */
export default async function AdminOversightRedirect({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries({ from: sp.from, to: sp.to }).filter((e): e is [string, string] => Boolean(e[1])));
  redirect(`/admin/calling-list/performance${qs.size ? `?${qs.toString()}` : ''}`);
}

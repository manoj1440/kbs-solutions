import { redirect } from 'next/navigation';

export default async function AccountsRequestsIndex({ searchParams }: { searchParams: Promise<{ queue?: string }> }) {
  const q = (await searchParams).queue;
  redirect(`/accounts${q ? `?queue=${encodeURIComponent(q)}` : ''}`);
}

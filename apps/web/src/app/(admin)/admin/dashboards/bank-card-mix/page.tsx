import { BankCardMix } from '@/components/admin-dashboard-tables';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <BankCardMix sp={await searchParams} />;
}

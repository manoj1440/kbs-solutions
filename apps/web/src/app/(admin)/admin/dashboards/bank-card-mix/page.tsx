import { BankCardMix } from '@/components/admin-dashboard-tables';

export const metadata = { title: 'Bank and card mix' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <BankCardMix sp={await searchParams} />;
}

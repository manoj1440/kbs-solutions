import { EntitlementsLedger } from '@/components/entitlements-ledger';

export const metadata = { title: 'Team payouts' };

export default async function ManagerPayoutsPage({ searchParams }: { searchParams: Promise<{ state?: string; bankId?: string; advisorId?: string; page?: string }> }) {
  return <EntitlementsLedger basePath="/manager/payouts" leadBase="/manager/leads" sp={await searchParams} title="Team payouts" />;
}

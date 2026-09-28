import { EntitlementsLedger } from '@/components/entitlements-ledger';

export default async function ManagerPayoutsPage({ searchParams }: { searchParams: Promise<{ state?: string; bankId?: string; advisorId?: string; page?: string }> }) {
  return <EntitlementsLedger basePath="/manager/payouts" leadHref={(id) => `/manager/leads/${id}`} sp={await searchParams} title="Team payouts" />;
}

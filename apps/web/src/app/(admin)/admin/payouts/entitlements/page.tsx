import { EntitlementsLedger } from '@/components/entitlements-ledger';

export default async function AdminEntitlementsPage({ searchParams }: { searchParams: Promise<{ state?: string; bankId?: string; advisorId?: string; page?: string }> }) {
  return <EntitlementsLedger basePath="/admin/payouts/entitlements" leadHref={(id) => `/admin/leads/${id}`} sp={await searchParams} title="Payout entitlements" description="Every card event the bank MIS has evidenced under an approved rule, across all advisors." />;
}

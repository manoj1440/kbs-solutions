import { EntitlementsLedger } from '@/components/entitlements-ledger';

export const metadata = { title: 'Payout entitlements' };

export default async function AdminEntitlementsPage({ searchParams }: { searchParams: Promise<{ state?: string; bankId?: string; advisorId?: string; page?: string }> }) {
  return <EntitlementsLedger basePath="/admin/payouts/entitlements" leadBase="/admin/leads" sp={await searchParams} title="Payout entitlements" />;
}

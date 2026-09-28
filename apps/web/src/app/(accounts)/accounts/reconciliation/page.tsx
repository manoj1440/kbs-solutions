import { PayoutDashboard } from '@/components/payout-dashboard';

export default async function AccountsReconciliationPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <PayoutDashboard basePath="/accounts/reconciliation" requestBase="/accounts/requests" sp={await searchParams} title="Payout reconciliation" canAcknowledge />;
}

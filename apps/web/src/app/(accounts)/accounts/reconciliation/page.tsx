import { PayoutDashboard } from '@/components/payout-dashboard';

export default async function AccountsReconciliationPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <PayoutDashboard basePath="/accounts/reconciliation" requestHref={(id) => `/accounts/requests/${id}`} sp={await searchParams} title="Payout reconciliation" canAcknowledge />;
}

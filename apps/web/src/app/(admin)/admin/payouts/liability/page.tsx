import { PayoutDashboard } from '@/components/payout-dashboard';

export default async function AdminPayoutLiabilityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <PayoutDashboard basePath="/admin/payouts/liability" requestBase="/admin/payouts/requests" sp={await searchParams} title="Payout liability & reconciliation" canAcknowledge />;
}

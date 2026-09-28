import { PayoutDashboard } from '@/components/payout-dashboard';

export default async function ManagerPayoutLiabilityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <PayoutDashboard basePath="/manager/payouts/liability" requestBase="/manager/payouts/requests" sp={await searchParams} title="Team payout liability" canAcknowledge={false} />;
}

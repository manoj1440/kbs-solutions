import { PayoutRequestsList } from '@/components/payout-requests-list';

export default async function ManagerPayoutRequestsPage({ searchParams }: { searchParams: Promise<{ state?: string; awaitingMe?: string; page?: string }> }) {
  return <PayoutRequestsList basePath="/manager/payouts/requests" sp={await searchParams} title="Payout approvals" />;
}

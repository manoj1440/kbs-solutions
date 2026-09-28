import { PayoutRequestsList } from '@/components/payout-requests-list';

export default async function AdminPayoutRequestsPage({ searchParams }: { searchParams: Promise<{ state?: string; awaitingMe?: string; page?: string }> }) {
  return <PayoutRequestsList basePath="/admin/payouts/requests" sp={await searchParams} title="Payout requests" />;
}

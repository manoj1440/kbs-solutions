import { PayoutRequestDetail } from '@/components/payout-request-detail';

export default async function ManagerPayoutRequestPage({ params }: { params: Promise<{ id: string }> }) {
  return <PayoutRequestDetail id={(await params).id} backHref="/manager/payouts/requests" leadHref={(id) => `/manager/leads/${id}`} />;
}

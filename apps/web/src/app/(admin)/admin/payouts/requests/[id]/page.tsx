import { PayoutRequestDetail } from '@/components/payout-request-detail';

export default async function AdminPayoutRequestPage({ params }: { params: Promise<{ id: string }> }) {
  return <PayoutRequestDetail id={(await params).id} backHref="/admin/payouts/requests" leadHref={(id) => `/admin/leads/${id}`} />;
}

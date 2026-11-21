import { PayoutRequestDetail } from '@/components/payout-request-detail';

export const metadata = { title: 'Payout request' };

export default async function AdminPayoutRequestPage({ params }: { params: Promise<{ id: string }> }) {
  return <PayoutRequestDetail id={(await params).id} backHref="/admin/payouts/requests" leadBase="/admin/leads" />;
}

import { PayoutRequestDetail } from '@/components/payout-request-detail';

export const metadata = { title: 'Payout request' };

export default async function ManagerPayoutRequestPage({ params }: { params: Promise<{ id: string }> }) {
  return <PayoutRequestDetail id={(await params).id} backHref="/manager/payouts/requests" leadBase="/manager/leads" />;
}

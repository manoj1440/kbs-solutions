import { PayoutRequestDetail } from '@/components/payout-request-detail';

export const metadata = { title: 'Payout request' };

export default async function AccountsPayoutRequestPage({ params }: { params: Promise<{ id: string }> }) {
  return <PayoutRequestDetail id={(await params).id} backHref="/accounts" />;
}

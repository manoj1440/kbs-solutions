import { PayoutRequestDetail } from '@/components/payout-request-detail';

export default async function AccountsPayoutRequestPage({ params }: { params: Promise<{ id: string }> }) {
  return <PayoutRequestDetail id={(await params).id} backHref="/accounts" />;
}

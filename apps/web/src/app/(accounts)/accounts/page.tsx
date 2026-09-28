import { PayoutRequestsList } from '@/components/payout-requests-list';

/** F-605 / REQ-18 §18.1 — Accounts queues: Awaiting payment (dual-approved only), Paid, Exceptions. */
export default async function AccountsHome({ searchParams }: { searchParams: Promise<{ queue?: string; page?: string }> }) {
  const sp = await searchParams;
  return <PayoutRequestsList mode="accounts" basePath="/accounts/requests" sp={{ queue: sp.queue, page: sp.page }} title="Payments" />;
}

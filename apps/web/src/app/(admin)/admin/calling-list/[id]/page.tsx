import { apiFetch } from '@/lib/api';

import { BatchWizard, type BatchDetail } from './wizard';

/** F-303 wizard steps (b)–(f) + review queue + allocation status for one batch. */
export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await apiFetch<BatchDetail>(`/calling-list/batches/${id}`);
  return <BatchWizard initial={batch.data} />;
}

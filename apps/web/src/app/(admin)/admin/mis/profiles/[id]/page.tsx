import { apiFetch } from '@/lib/api';

import { MisProfileEditor, type MisProfile } from './editor';

export default async function MisProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await apiFetch<MisProfile>(`/mis/profiles/${id}`);
  return <MisProfileEditor initial={p.data} />;
}

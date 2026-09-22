import { apiFetch } from '@/lib/api';

import { ModuleEditor, type ModuleDetail } from './module-editor';

export default async function ModulePage({ params }: { params: Promise<{ seq: string }> }) {
  const { seq } = await params;
  const mod = await apiFetch<ModuleDetail>(`/training/modules/${seq}`);
  return <ModuleEditor initial={mod.data} />;
}

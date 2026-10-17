import type { MisFreshness } from '@kbs/shared';

import { WorkspaceShell } from '@/components/workspace-shell';
import { apiFetch } from '@/lib/api';
import { requireRole } from '@/lib/require-role';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('ADMIN');
  // F-814 MIS clock; a failure only hides the clock, never the workspace
  const misFreshness = await apiFetch<MisFreshness>('/mis/freshness').then((r) => r.data).catch(() => null);
  return (
    <WorkspaceShell session={session} area="admin" misFreshness={misFreshness}>
      {children}
    </WorkspaceShell>
  );
}

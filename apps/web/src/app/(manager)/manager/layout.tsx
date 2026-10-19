import { cookies } from 'next/headers';

import { WorkspaceShell } from '@/components/workspace-shell';
import { requireRole } from '@/lib/require-role';

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('MANAGER', 'ADMIN');
  const navExpanded = (await cookies()).get('kbs_nav')?.value === '1';
  return (
    <WorkspaceShell session={session} area="manager" navExpanded={navExpanded}>
      {children}
    </WorkspaceShell>
  );
}

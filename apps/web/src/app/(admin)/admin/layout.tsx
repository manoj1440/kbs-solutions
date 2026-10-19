import { cookies } from 'next/headers';

import { WorkspaceShell } from '@/components/workspace-shell';
import { requireRole } from '@/lib/require-role';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('ADMIN');
  const navExpanded = (await cookies()).get('kbs_nav')?.value === '1';
  return (
    <WorkspaceShell session={session} area="admin" navExpanded={navExpanded}>
      {children}
    </WorkspaceShell>
  );
}

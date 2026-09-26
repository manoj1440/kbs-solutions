import { WorkspaceShell } from '@/components/workspace-shell';
import { requireRole } from '@/lib/require-role';

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('MANAGER', 'ADMIN');
  return (
    <WorkspaceShell session={session} area="manager">
      {children}
    </WorkspaceShell>
  );
}

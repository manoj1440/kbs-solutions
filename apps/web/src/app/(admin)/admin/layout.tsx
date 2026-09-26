import { WorkspaceShell } from '@/components/workspace-shell';
import { requireRole } from '@/lib/require-role';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('ADMIN');
  return (
    <WorkspaceShell session={session} area="admin">
      {children}
    </WorkspaceShell>
  );
}

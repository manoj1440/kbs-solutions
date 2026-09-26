import { WorkspaceShell } from '@/components/workspace-shell';
import { requireRole } from '@/lib/require-role';

export default async function AccountsLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('ACCOUNTS', 'ADMIN');
  return (
    <WorkspaceShell session={session} area="accounts">
      {children}
    </WorkspaceShell>
  );
}

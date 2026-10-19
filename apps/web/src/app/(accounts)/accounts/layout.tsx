import { cookies } from 'next/headers';

import { WorkspaceShell } from '@/components/workspace-shell';
import { requireRole } from '@/lib/require-role';

export default async function AccountsLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('ACCOUNTS', 'ADMIN');
  const navExpanded = (await cookies()).get('kbs_nav')?.value === '1';
  return (
    <WorkspaceShell session={session} area="accounts" navExpanded={navExpanded}>
      {children}
    </WorkspaceShell>
  );
}

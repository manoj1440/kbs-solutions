import { cookies } from 'next/headers';

import { WorkspaceShell } from '@/components/workspace-shell';
import { requireRole } from '@/lib/require-role';

export default async function AccountsLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('ACCOUNTS', 'ADMIN');
  const jar = await cookies();
  const navExpanded = jar.get('kbs_nav')?.value === '1';
  const t = jar.get('kbs_theme')?.value;
  const theme = t === 'light' || t === 'dark' ? t : 'system';
  return (
    <WorkspaceShell session={session} area="accounts" navExpanded={navExpanded} theme={theme}>
      {children}
    </WorkspaceShell>
  );
}

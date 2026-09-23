import { AppShell } from '@/components/app-shell';
import { requireRole } from '@/lib/require-role';

const NAV = [
  { href: '/accounts?queue=awaiting', label: 'Awaiting payment' },
  { href: '/accounts?queue=paid', label: 'Paid' },
  { href: '/accounts?queue=exceptions', label: 'Exceptions' },
];

export default async function AccountsLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('ACCOUNTS', 'ADMIN');
  return (
    <AppShell session={session} nav={NAV} title="Accounts workspace">
      {children}
    </AppShell>
  );
}

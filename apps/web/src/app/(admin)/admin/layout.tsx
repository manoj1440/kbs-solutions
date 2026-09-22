import { AppShell } from '@/components/app-shell';
import { requireRole } from '@/lib/require-role';

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users & teams' },
  { href: '/admin/training', label: 'Training content' },
  { href: '/admin/training/team', label: 'Training progress' },
  { href: '/admin/calling-list', label: 'Calling lists' },
  { href: '/admin/calling-list/distribution', label: 'Allocation' },
  { href: '/admin/compliance', label: 'Compliance & reference data' },
  { href: '/admin/config', label: 'Configuration' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('ADMIN');
  return (
    <AppShell session={session} nav={NAV} title="Admin workspace">
      {children}
    </AppShell>
  );
}

import { AppShell } from '@/components/app-shell';
import { requireRole } from '@/lib/require-role';

const NAV = [
  { href: '/manager', label: 'Team' },
  { href: '/manager/calling', label: 'Team calling' },
  { href: '/manager/leads', label: 'Team leads' },
  { href: '/manager/pending-actions', label: 'Pending actions' },
  { href: '/manager/payouts', label: 'Team payouts' },
  { href: '/manager/payouts/requests', label: 'Payout approvals' },
  { href: '/manager/payouts/liability', label: 'Payout liability' },
  { href: '/manager/telecallers/new', label: 'Create Telecaller' },
];

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('MANAGER', 'ADMIN');
  return (
    <AppShell session={session} nav={NAV} title="Manager workspace">
      {children}
    </AppShell>
  );
}

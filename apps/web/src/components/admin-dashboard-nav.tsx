import { CreditCard, LayoutDashboard, PhoneCall, ScanSearch, ShieldCheck, UserCog, UserRound, Wallet } from 'lucide-react';

import { PillNav } from '@/components/ui/kit';

const LINKS = [
  { href: '/admin/dashboards', label: 'Executive', icon: LayoutDashboard },
  { href: '/admin/dashboards/telecallers', label: 'Telecallers', icon: PhoneCall },
  { href: '/admin/dashboards/managers', label: 'Managers', icon: UserCog },
  { href: '/admin/dashboards/advisors', label: 'Advisors', icon: UserRound },
  { href: '/admin/dashboards/bank-card-mix', label: 'Bank / card mix', icon: CreditCard },
  { href: '/admin/payouts/liability', label: 'Payout liability', icon: Wallet },
  { href: '/admin/mis/integrity', label: 'MIS integrity', icon: ScanSearch },
  { href: '/admin/audit', label: 'Audit', icon: ShieldCheck },
];

/** F-703: the eight Admin dashboards (REQ-16 §16.2) as one tab row. */
export function AdminDashboardNav({ active }: { active: string }) {
  return <PillNav label="Dashboards" items={LINKS} active={active} />;
}

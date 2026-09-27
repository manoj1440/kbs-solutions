import { CreditCard, PhoneCall, UserCog, UserRound } from 'lucide-react';

import { PillNav } from '@/components/ui/kit';

const LINKS = [
  { href: '/admin/dashboards/telecallers', label: 'Telecallers', icon: PhoneCall },
  { href: '/admin/dashboards/managers', label: 'Managers', icon: UserCog },
  { href: '/admin/dashboards/advisors', label: 'Advisors', icon: UserRound },
  { href: '/admin/dashboards/bank-card-mix', label: 'Bank / card mix', icon: CreditCard },
];

/** F-703 / F-807: the Admin report tabs. The executive view is the Business overview (`/admin`); liability, MIS integrity and audit live in their own sections. */
export function AdminDashboardNav({ active }: { active: string }) {
  return <PillNav label="Reports" items={LINKS} active={active} />;
}

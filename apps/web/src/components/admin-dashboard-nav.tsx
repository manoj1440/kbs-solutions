import Link from 'next/link';

const LINKS = [
  { href: '/admin/dashboards', label: 'Executive' },
  { href: '/admin/dashboards/telecallers', label: 'Telecallers' },
  { href: '/admin/dashboards/managers', label: 'Managers' },
  { href: '/admin/dashboards/advisors', label: 'Advisors' },
  { href: '/admin/dashboards/bank-card-mix', label: 'Bank / card mix' },
  { href: '/admin/payouts/liability', label: 'Payout liability' },
  { href: '/admin/mis/integrity', label: 'MIS integrity' },
  { href: '/admin/audit', label: 'Audit' },
];

/** F-703: the eight Admin dashboards (REQ-16 §16.2) as one tab row. */
export function AdminDashboardNav({ active }: { active: string }) {
  return (
    <nav aria-label="Dashboards" className="flex flex-wrap gap-1">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={active === l.href ? 'page' : undefined} className={`rounded-md border px-3 py-1.5 text-sm ${active === l.href ? 'border-teal-700 bg-teal-700 text-white' : 'bg-white hover:bg-slate-50'}`}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

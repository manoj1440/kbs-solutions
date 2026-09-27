import { PhoneCall, Users } from 'lucide-react';

import { PillNav } from '@/components/ui/kit';

/** F-808: the two views of Admin caller performance — per-caller evidence and org-wide calls & delivery. */
export function CallerPerformanceNav({ active }: { active: 'callers' | 'calls' }) {
  const items = [
    { href: '/admin/calling-list/performance', label: 'Callers', icon: Users },
    { href: '/admin/calling-list/oversight', label: 'Calls & delivery', icon: PhoneCall },
  ];
  return <PillNav label="Caller performance views" items={items} active={items[active === 'callers' ? 0 : 1].href} />;
}

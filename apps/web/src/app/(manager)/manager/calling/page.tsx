import { PhoneCall } from 'lucide-react';

import { CallingDistribution } from '@/components/calling-distribution';
import { TeamOverview } from '@/components/team-ops';
import { PageHeader } from '@/components/ui/kit';

/** F-305/F-307 Manager: team calling distribution + records (scoped server-side). */
export default async function ManagerCallingPage({ searchParams }: { searchParams: Promise<{ telecallerId?: string; tab?: 'active' | 'followups' | 'hidden'; from?: string; to?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={PhoneCall}
        tone="sky"
        eyebrow="Team"
        title="Team calling"
        description="Who holds which customers, follow-ups due, and reassignment within your team (cross-team moves need the Admin)."
      />
      <TeamOverview base="/manager/calling" sp={{ from: sp.from, to: sp.to }} />
      <CallingDistribution scope="manager" telecallerId={sp.telecallerId} tab={sp.tab ?? 'active'} />
    </div>
  );
}

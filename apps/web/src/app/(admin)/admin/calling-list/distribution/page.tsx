import { Phone, PhoneCall, Users } from 'lucide-react';
import Link from 'next/link';

import { CallingDistribution } from '@/components/calling-distribution';
import { TeamOverview } from '@/components/team-ops';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/kit';

/** F-305 Admin: org-wide distribution + any-team reassignment. */
export default async function AdminDistributionPage({ searchParams }: { searchParams: Promise<{ telecallerId?: string; tab?: 'active' | 'followups' | 'hidden'; from?: string; to?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={Users}
        tone="violet"
        eyebrow="Calling"
        title="Allocation & distribution"
        description="Organisation totals per Telecaller; reassign across teams with a reason (logged as an allocation event)."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/admin/calling-list">
                <Phone />
                Calling lists
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/calling-list/oversight">
                <PhoneCall />
                Calls & delivery
              </Link>
            </Button>
          </>
        }
      />
      <TeamOverview base="/admin/calling-list/distribution" sp={{ from: sp.from, to: sp.to }} />
      <CallingDistribution scope="admin" telecallerId={sp.telecallerId} tab={sp.tab ?? 'active'} />
    </div>
  );
}

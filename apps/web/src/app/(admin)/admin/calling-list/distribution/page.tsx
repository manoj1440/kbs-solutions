import { CallingDistribution } from '@/components/calling-distribution';
import { TeamOverview } from '@/components/team-ops';

/** F-305 Admin: org-wide distribution + any-team reassignment. */
export default async function AdminDistributionPage({ searchParams }: { searchParams: Promise<{ telecallerId?: string; tab?: 'active' | 'followups' | 'hidden'; from?: string; to?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Allocation & distribution</h1>
        <p className="text-muted-foreground text-sm">Organisation totals per Telecaller; reassign across teams with a reason (logged as an allocation event).</p>
      </div>
      <TeamOverview base="/admin/calling-list/distribution" sp={{ from: sp.from, to: sp.to }} />
      <CallingDistribution scope="admin" telecallerId={sp.telecallerId} tab={sp.tab ?? 'active'} />
    </div>
  );
}

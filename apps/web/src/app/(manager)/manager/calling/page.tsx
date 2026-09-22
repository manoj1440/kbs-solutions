import { CallingDistribution } from '@/components/calling-distribution';
import { TeamOverview } from '@/components/team-ops';

/** F-305/F-307 Manager: team calling distribution + records (scoped server-side). */
export default async function ManagerCallingPage({ searchParams }: { searchParams: Promise<{ telecallerId?: string; tab?: 'active' | 'followups' | 'hidden'; from?: string; to?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Team calling</h1>
        <p className="text-muted-foreground text-sm">Who holds which customers, follow-ups due, and reassignment within your team (cross-team moves need the Admin).</p>
      </div>
      <TeamOverview base="/manager/calling" sp={{ from: sp.from, to: sp.to }} />
      <CallingDistribution scope="manager" telecallerId={sp.telecallerId} tab={sp.tab ?? 'active'} />
    </div>
  );
}

import { CallingDistribution } from '@/components/calling-distribution';
import { TeamOverview } from '@/components/team-ops';

export const metadata = { title: 'Team calling · KBS Solutions' };

/** F-305/F-307 → F-811 Manager: team calling distribution + records (scoped server-side). */
export default async function ManagerCallingPage({ searchParams }: { searchParams: Promise<{ telecallerId?: string; tab?: 'active' | 'followups' | 'hidden'; from?: string; to?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="flex flex-col gap-3 overflow-y-auto lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">Team calling</h1>
      <TeamOverview base="/manager/calling" sp={{ from: sp.from, to: sp.to }} />
      <CallingDistribution scope="manager" telecallerId={sp.telecallerId} tab={sp.tab ?? 'active'} />
    </div>
  );
}

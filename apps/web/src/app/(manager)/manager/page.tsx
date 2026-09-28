import { UserPlus } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { MiniStat } from '@/components/ui/kit';
import { TrainingTeamTable } from '@/components/training-team-table';
import { apiFetch } from '@/lib/api';
import type { TrainingTeamRow } from '@/lib/training-types';

import { type TeamAdvisorRow, TeamAdvisorsTable } from './team-advisors-table';

export const metadata = { title: 'My team · KBS Solutions' };

interface TeamUser extends TeamAdvisorRow {
  employeeCode: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

/** F-201/F-105 → F-811: Manager team list. Training columns arrive with F-205. */
export default async function ManagerTeam() {
  const [users, team] = await Promise.all([apiFetch<TeamUser[]>('/users?pageSize=200'), apiFetch<TrainingTeamRow[]>('/training/team')]);
  const telecallers = users.data.filter((u) => u.role === 'TELECALLER');
  const advisors = users.data.filter((u) => u.role === 'ADVISOR');
  const passed = team.data.filter((r) => r.status === 'PASSED').length;
  const expired = team.data.filter((r) => r.status === 'EXPIRED_DEACTIVATED').length;
  const activeAdvisors = advisors.filter((u) => u.status === 'ACTIVE').length;
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-6rem)]">
      <h1 className="sr-only">My team</h1>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniStat label="Telecallers" value={telecallers.length} hint="Reporting to you" tone="violet" />
          <MiniStat label="Training passed" value={passed} hint={`of ${team.data.length} enrolled`} tone="emerald" />
          <MiniStat label="Deadline passed" value={expired} hint="72h window ended" tone={expired ? 'rose' : 'slate'} />
          <MiniStat label="Advisors" value={advisors.length} hint={`${activeAdvisors} active`} tone="sky" href="/manager/advisors" />
        </div>
        <Button asChild size="sm" className="h-9">
          <Link href="/manager/telecallers/new">
            <UserPlus />
            Create Telecaller
          </Link>
        </Button>
      </div>
      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:overflow-visible">
        <section aria-label="Telecallers" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
          <div className="border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">Telecallers · training status, deadline and best score per module</div>
          <div className="min-h-0 flex-1">
            <TrainingTeamTable rows={team.data} linkBase="/manager/telecallers" />
          </div>
        </section>
        <section aria-label="Advisors" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
          <div className="border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">Advisors · who applied one of your Agent Codes</div>
          <div className="min-h-0 flex-1">
            <TeamAdvisorsTable rows={advisors} />
          </div>
        </section>
      </div>
    </div>
  );
}

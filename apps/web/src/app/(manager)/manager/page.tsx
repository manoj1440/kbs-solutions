import { CheckCircle2, GraduationCap, TriangleAlert, UserPlus, UserRound, Users } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Avatar, EmptyState, humanize, PageHeader, SectionCard, StatCard, StatGrid, StatusDot, type Tone } from '@/components/ui/kit';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrainingTeamTable } from '@/components/training-team-table';
import { apiFetch } from '@/lib/api';
import type { TrainingTeamRow } from '@/lib/training-types';

interface TeamUser {
  id: string;
  fullName: string;
  role: string;
  status: string;
  mobileMasked: string;
  employeeCode: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

/** F-806: dot tone per KBS user status (the humanised text carries the meaning). */
const userStatusTone = (s: string): Tone => (s === 'ACTIVE' ? 'emerald' : s === 'PENDING_ONBOARDING' ? 'amber' : s === 'BLOCKED' ? 'rose' : 'slate');

/** F-201/F-105: Manager team list. Training columns arrive with F-205. */
export default async function ManagerTeam() {
  const [users, team] = await Promise.all([apiFetch<TeamUser[]>('/users?pageSize=200'), apiFetch<TrainingTeamRow[]>('/training/team')]);
  const telecallers = users.data.filter((u) => u.role === 'TELECALLER');
  const advisors = users.data.filter((u) => u.role === 'ADVISOR');
  const passed = team.data.filter((r) => r.status === 'PASSED').length;
  const expired = team.data.filter((r) => r.status === 'EXPIRED_DEACTIVATED').length;
  const activeAdvisors = advisors.filter((u) => u.status === 'ACTIVE').length;
  return (
    <div className="grid gap-6">
      <PageHeader
        icon={Users}
        tone="violet"
        eyebrow="Team"
        title="My team"
        description={`${telecallers.length} Telecallers · ${advisors.length} Advisors reporting to you.`}
        actions={
          <Button asChild>
            <Link href="/manager/telecallers/new">
              <UserPlus />
              Create Telecaller
            </Link>
          </Button>
        }
      >
        <StatGrid>
          <StatCard label="Telecallers" value={telecallers.length} hint="Reporting to you" icon={Users} emphasis />
          <StatCard label="Training passed" value={passed} hint={`All three modules passed, of ${team.data.length} enrolled`} icon={CheckCircle2} tone="emerald" />
          <StatCard label="Deadline passed" value={expired} hint="72-hour window ended before passing" icon={TriangleAlert} tone={expired ? 'rose' : 'slate'} />
          <StatCard label="Advisors" value={advisors.length} hint={`${activeAdvisors} active`} icon={UserRound} tone="sky" href="/manager/advisors" source="Advisor results" />
        </StatGrid>
      </PageHeader>

      <SectionCard icon={GraduationCap} tone="violet" title="Telecallers" description="Training status, deadline and best score per module. Open a Telecaller for details." flush={team.data.length > 0}>
        <TrainingTeamTable rows={team.data} linkBase="/manager/telecallers" />
      </SectionCard>

      <SectionCard icon={UserRound} tone="sky" title="Advisors" description="Advisors who applied one of your Agent Codes." flush={advisors.length > 0}>
        {advisors.length === 0 ? (
          <EmptyState icon={UserRound} title="No Advisors yet" description="Advisors join your team when they apply one of your Agent Codes." />
        ) : (
          <Table responsive>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mobile</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {advisors.map((u) => (
                <TableRow key={u.id}>
                  <TableCell data-label="Name">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.fullName || '?'} size="sm" />
                      <Link href={`/manager/advisors/${u.id}`} className="font-medium">
                        {u.fullName || '(onboarding)'}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell data-label="Status">
                    <StatusDot tone={userStatusTone(u.status)}>{humanize(u.status)}</StatusDot>
                  </TableCell>
                  <TableCell data-label="Mobile" className="font-mono text-xs">
                    {u.mobileMasked}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}

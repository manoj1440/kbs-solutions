import { formatDateTime } from '@kbs/shared';
import { GraduationCap } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Avatar, EmptyState, Meter } from '@/components/ui/kit';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { remaining, STATUS_LABEL, statusTone, type TrainingTeamRow } from '@/lib/training-types';

/** F-205: shared team-progress table for Manager and Admin. */
export function TrainingTeamTable({ rows, linkBase }: { rows: TrainingTeamRow[]; linkBase: string }) {
  if (rows.length === 0) return <EmptyState icon={GraduationCap} title="No Telecallers enrolled yet." />;
  return (
    <Table responsive="compact">
      <TableHeader>
        <TableRow>
          <TableHead>Telecaller</TableHead>
          <TableHead>Training</TableHead>
          <TableHead>Deadline</TableHead>
          <TableHead>Remaining</TableHead>
          <TableHead>M1</TableHead>
          <TableHead>M2</TableHead>
          <TableHead>M3</TableHead>
          <TableHead className="text-right">Reactivations</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const passed = r.modules.filter((m) => m.status === 'PASSED').length;
          return (
            <TableRow key={r.telecaller.id}>
              <TableCell data-label="Telecaller">
                <div className="flex items-center gap-2.5">
                  <Avatar name={r.telecaller.fullName} size="sm" />
                  <div className="min-w-0">
                    <Link href={`${linkBase}/${r.telecaller.id}`} className="font-medium">
                      {r.telecaller.fullName}
                    </Link>
                    <div className="font-mono text-[11px] text-slate-500">{r.telecaller.employeeCode}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell data-label="Training">
                <div className="grid min-w-28 gap-1.5">
                  <Badge variant={statusTone(r.status)}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                  {r.modules.length ? (
                    <div className="flex items-center gap-2">
                      <Meter value={passed} max={3} tone={passed === 3 ? 'emerald' : r.status === 'EXPIRED_DEACTIVATED' ? 'rose' : 'sky'} className="h-1.5 w-16" label={`${passed} of 3 modules passed`} />
                      <span className="text-[11px] text-slate-500 tabular-nums">{passed}/3</span>
                    </div>
                  ) : null}
                </div>
              </TableCell>
              <TableCell data-label="Deadline" className="text-xs">
                {r.deadlineAt ? formatDateTime(r.deadlineAt) : 'starts at first login'}
              </TableCell>
              <TableCell data-label="Remaining" className="text-xs tabular-nums">
                {remaining(r.remainingMs)}
              </TableCell>
              {[1, 2, 3].map((seq) => {
                const m = r.modules.find((x) => x.sequence === seq);
                return (
                  <TableCell key={seq} data-label={`M${seq}`} className="text-xs">
                    {m ? (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        <Badge variant={m.status === 'PASSED' ? 'success' : m.status === 'LOCKED' ? 'unknown' : 'info'}>{m.status === 'PASSED' ? 'Passed' : m.status === 'LOCKED' ? 'Locked' : 'Open'}</Badge>
                        {m.bestScorePct !== null ? <span className="text-slate-500 tabular-nums">{m.bestScorePct}%</span> : null}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                );
              })}
              <TableCell data-label="Reactivations" className="text-xs tabular-nums sm:text-right">
                {r.reactivations}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

import { formatDateTime } from '@kbs/shared';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { remaining, STATUS_LABEL, statusTone, type TrainingTeamRow } from '@/lib/training-types';

/** F-205: shared team-progress table for Manager and Admin. */
export function TrainingTeamTable({ rows, linkBase }: { rows: TrainingTeamRow[]; linkBase: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Telecaller</TableHead>
          <TableHead>Training</TableHead>
          <TableHead>Deadline</TableHead>
          <TableHead>Remaining</TableHead>
          <TableHead>M1</TableHead>
          <TableHead>M2</TableHead>
          <TableHead>M3</TableHead>
          <TableHead>Reactivations</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-muted-foreground">
              No Telecallers enrolled yet.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((r) => (
            <TableRow key={r.telecaller.id}>
              <TableCell>
                <Link href={`${linkBase}/${r.telecaller.id}`} className="underline-offset-4 hover:underline">
                  {r.telecaller.fullName}
                </Link>
                <div className="text-muted-foreground font-mono text-xs">{r.telecaller.employeeCode}</div>
              </TableCell>
              <TableCell>
                <Badge variant={statusTone(r.status)}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
              </TableCell>
              <TableCell className="text-xs">{r.deadlineAt ? formatDateTime(r.deadlineAt) : 'starts at first login'}</TableCell>
              <TableCell className="text-xs">{remaining(r.remainingMs)}</TableCell>
              {[1, 2, 3].map((seq) => {
                const m = r.modules.find((x) => x.sequence === seq);
                return (
                  <TableCell key={seq} className="text-xs">
                    {m ? (
                      <span>
                        <Badge variant={m.status === 'PASSED' ? 'success' : m.status === 'LOCKED' ? 'unknown' : 'info'}>{m.status === 'PASSED' ? 'Passed' : m.status === 'LOCKED' ? 'Locked' : 'Open'}</Badge>
                        {m.bestScorePct !== null ? <span className="text-muted-foreground ml-1">{m.bestScorePct}%</span> : null}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                );
              })}
              <TableCell className="text-xs">{r.reactivations}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

'use client';

import { formatDateTime } from '@kbs/shared';
import { GraduationCap } from 'lucide-react';
import Link from 'next/link';

import { columnHelper, DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Avatar, EmptyState, Meter } from '@/components/ui/kit';
import { remaining, STATUS_LABEL, statusTone, type TrainingTeamRow } from '@/lib/training-types';

const c = columnHelper<TrainingTeamRow>();

/** F-205 → F-813: shared team-progress table for Manager and Admin. */
export function TrainingTeamTable({ rows, linkBase }: { rows: TrainingTeamRow[]; linkBase: string }) {
  const columns = c.columns([
    c.accessor((r) => r.telecaller.fullName, {
      id: 'telecaller',
      header: 'Telecaller',
      cell: ({ row }) => {
        const t = row.original.telecaller;
        return (
          <div className="flex items-center gap-2.5">
            <Avatar name={t.fullName} size="sm" />
            <div className="min-w-0">
              <Link href={`${linkBase}/${t.id}`} className="font-medium">
                {t.fullName}
              </Link>
              <div className="font-mono text-[11px] text-slate-500">{t.employeeCode}</div>
            </div>
          </div>
        );
      },
    }),
    c.accessor('status', {
      header: 'Training',
      cell: ({ row }) => {
        const r = row.original;
        const passed = r.modules.filter((m) => m.status === 'PASSED').length;
        return (
          <div className="grid min-w-28 gap-1.5">
            <Badge variant={statusTone(r.status)}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
            {r.modules.length ? (
              <div className="flex items-center gap-2">
                <Meter value={passed} max={3} tone={passed === 3 ? 'emerald' : r.status === 'EXPIRED_DEACTIVATED' ? 'rose' : 'sky'} className="h-1.5 w-16" label={`${passed} of 3 modules passed`} />
                <span className="text-[11px] text-slate-500 tabular-nums">{passed}/3</span>
              </div>
            ) : null}
          </div>
        );
      },
    }),
    c.accessor('deadlineAt', {
      header: 'Deadline',
      sortFn: 'datetime',
      meta: { cellClassName: 'text-xs' },
      cell: ({ getValue }) => (getValue() ? formatDateTime(getValue()) : 'starts at first login'),
    }),
    c.accessor('remainingMs', {
      header: 'Remaining',
      meta: { cellClassName: 'text-xs tabular-nums' },
      cell: ({ getValue }) => remaining(getValue()),
    }),
    ...[1, 2, 3].map((seq) =>
      c.display({
        id: `m${seq}`,
        header: `M${seq}`,
        meta: { cellClassName: 'text-xs' },
        cell: ({ row }) => {
          const m = row.original.modules.find((x) => x.sequence === seq);
          return m ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Badge variant={m.status === 'PASSED' ? 'success' : m.status === 'LOCKED' ? 'unknown' : 'info'}>{m.status === 'PASSED' ? 'Passed' : m.status === 'LOCKED' ? 'Locked' : 'Open'}</Badge>
              {m.bestScorePct !== null ? <span className="text-slate-500 tabular-nums">{m.bestScorePct}%</span> : null}
            </span>
          ) : (
            '—'
          );
        },
      }),
    ),
    c.accessor('reactivations', {
      header: 'Reactivations',
      meta: { align: 'right' },
      cell: ({ getValue }) => <span className="text-xs">{getValue()}</span>,
    }),
  ]);
  return (
    <DataTable
      variant="panel"
      responsive="compact"
      columns={columns}
      data={rows}
      getRowId={(r) => r.telecaller.id}
      empty={<EmptyState icon={GraduationCap} title="No Telecallers enrolled yet." />}
    />
  );
}

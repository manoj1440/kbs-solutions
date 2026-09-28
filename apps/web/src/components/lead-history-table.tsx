'use client';

import { formatDateTime, type MisHistoryGroup } from '@kbs/shared';

import { columnHelper, DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';

type Change = MisHistoryGroup['changes'][number];

const CHANGE_LABEL: Record<string, string> = { SET: 'set', CHANGED: 'changed', CONFIRMED_SAME: 'confirmed unchanged', REPORTED_BLANK: 'reported blank', ABSENT_FROM_BATCH: 'absent from this batch' };

const c = columnHelper<Change>();

const columns = c.columns([
  c.accessor((x) => (x.field === '*' ? '(whole row)' : x.field), {
    id: 'field',
    header: 'Field',
    meta: { cellClassName: 'font-mono text-xs' },
  }),
  c.accessor((x) => x.oldValue ?? '', {
    id: 'oldValue',
    header: 'Old value',
    meta: { cellClassName: 'text-xs' },
    cell: ({ row }) => row.original.oldValue ?? <em className="text-muted-foreground">blank</em>,
  }),
  c.accessor((x) => x.newValue ?? '', {
    id: 'newValue',
    header: 'New value',
    meta: { cellClassName: 'text-xs font-medium' },
    cell: ({ row }) => row.original.newValue ?? <em className="text-muted-foreground">blank</em>,
  }),
  c.accessor('changeKind', {
    header: 'Change',
    cell: ({ getValue }) => (
      <Badge variant={getValue() === 'CHANGED' || getValue() === 'SET' ? 'info' : getValue() === 'ABSENT_FROM_BATCH' ? 'warning' : 'secondary'}>
        {CHANGE_LABEL[getValue()] ?? getValue().toLowerCase()}
      </Badge>
    ),
  }),
  c.accessor((x) => x.reportedEventDate ?? '', {
    id: 'reportedEventDate',
    header: 'Reported bank event date',
    meta: { cellClassName: 'text-xs tabular-nums' },
    cell: ({ row }) => (row.original.reportedEventDate ? formatDateTime(row.original.reportedEventDate) : '—'),
  }),
]);

/** F-408 MIS change rows for one batch — exact old → new bank value (verbatim). */
export function LeadHistoryTable({ batchId, changes }: { batchId: string; changes: Change[] }) {
  return <DataTable columns={columns} data={changes} getRowId={(x) => `${batchId}-${x.field}`} />;
}

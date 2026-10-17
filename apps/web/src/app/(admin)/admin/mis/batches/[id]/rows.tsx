'use client';

import { ApiClientError } from '@kbs/shared';
import { Rows3 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { columnHelper, DataTable } from '@/components/data-table';
import { EmptyState, SectionCard } from '@/components/ui/kit';
import { clientApi } from '@/lib/client-api';

interface Row {
  id: string;
  sourceRowNumber: number;
  matchedLead: { publicRef: string } | null;
  referenceValues: { kind: string; value: string }[];
  mapped: Record<string, string>;
}

/** F-816: the rows of one upload as the bank sent them, and the KBS lead each one updated. */
export function BatchRows({ batchId, stage }: { batchId: string; stage: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // (re)load after mount and whenever the batch stage moves; scheduling this during render raced React's mount
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        setRows((await clientApi.get<Row[]>(`/mis/batches/${batchId}/rows?pageSize=200`)).data);
      } catch (e) {
        setMsg(e instanceof ApiClientError ? e.message : 'Could not load rows.');
      }
    }, 0);
    return () => clearTimeout(t);
  }, [batchId, stage]);
  return (
    <SectionCard icon={Rows3} tone="indigo" title="Rows in this file" description="First 200 rows, values exactly as the bank sent them." flush={Boolean(rows && rows.length)}>
      {msg ? <p className="text-destructive text-sm">{msg}</p> : null}
      {rows && rows.length === 0 ? <EmptyState icon={Rows3} title="No rows." /> : null}
      {rows && rows.length ? <BatchRowsTable rows={rows} /> : null}
    </SectionCard>
  );
}

const c = columnHelper<Row>();
const BLANK = <em className="text-fg-3">blank</em>;

function BatchRowsTable({ rows }: { rows: Row[] }) {
  const columns = c.columns([
    c.accessor('sourceRowNumber', { header: 'Row', meta: { cellClassName: 'text-xs text-muted-foreground' } }),
    c.accessor((r) => r.referenceValues[0]?.value ?? '', { id: 'application', header: 'Application', meta: { cellClassName: 'font-mono text-2xs break-all text-fg-2' }, cell: ({ getValue }) => getValue() || '—' }),
    c.accessor((r) => r.mapped.currentStage, { id: 'stage', header: 'Stage', meta: { cellClassName: 'text-xs text-foreground' }, cell: ({ row }) => row.original.mapped.currentStage || BLANK }),
    c.accessor((r) => r.mapped.finalDecision, { id: 'decision', header: 'Decision', meta: { cellClassName: 'text-xs text-foreground' }, cell: ({ row }) => row.original.mapped.finalDecision || BLANK }),
    c.accessor((r) => r.mapped.cardActivationStatus, { id: 'activation', header: 'Activation', meta: { cellClassName: 'text-xs text-foreground' }, cell: ({ row }) => row.original.mapped.cardActivationStatus || BLANK }),
    c.accessor((r) => r.matchedLead?.publicRef ?? '', {
      id: 'lead',
      header: 'KBS lead',
      cell: ({ row }) => (row.original.matchedLead ? <span className="font-mono text-2xs whitespace-nowrap text-foreground">{row.original.matchedLead.publicRef}</span> : <span className="text-xs text-muted-foreground">No KBS lead</span>),
    }),
  ]);
  return <DataTable columns={columns} data={rows} getRowId={(r) => r.id} />;
}

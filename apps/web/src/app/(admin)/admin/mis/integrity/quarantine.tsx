'use client';

import { ApiClientError, formatDateTime } from '@kbs/shared';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Resolve } from '@/components/mis-resolve';
import { Badge } from '@/components/ui/badge';
import { BankMark, EmptyState, humanize, SectionCard } from '@/components/ui/kit';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { clientApi } from '@/lib/client-api';
import { cn } from '@/lib/utils';

interface QRow {
  id: string;
  batch: { id: string; publicRef: string; uploadedAt: string; stage: string; bank: { code: string; displayName: string } };
  sourceRowNumber: number;
  matchState: string;
  matchExplanation: string | null;
  referenceValues: { kind: string; value: string }[];
  customer: string;
  currentStage: string | null;
  finalDecision: string | null;
  cardActivationStatus: string | null;
}

/** F-507 / F-504: cross-batch quarantine (UNMATCHED / CONFLICT rows) with inline resolution. */
export function Quarantine({ bankId }: { bankId?: string }) {
  const [rows, setRows] = useState<QRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const load = async (st = state) => {
    try {
      const r = await clientApi.get<QRow[]>(`/dashboards/mis-integrity/quarantine?pageSize=100${bankId ? `&bankId=${bankId}` : ''}${st ? `&state=${st}` : ''}`);
      setRows(r.data);
      setTotal(Number(r.meta.total ?? r.data.length));
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : 'Could not load quarantine.');
    }
  };
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first load only; filters reload explicitly
  }, []);
  return (
    <SectionCard
      icon={ShieldAlert}
      tone="amber"
      title={`Quarantine · ${total} row(s)`}
      description="Rows no lead carries a reference for, or whose references disagree. Resolve by KBS reference only; customer names are masked."
      flush={Boolean(rows && rows.length)}
      actions={
        <div role="group" aria-label="Quarantine state" className="inline-flex gap-1 rounded-xl border border-slate-200/80 bg-white p-1 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
          {['', 'UNMATCHED', 'CONFLICT'].map((s) => (
            <button
              key={s || 'all'}
              type="button"
              aria-pressed={state === s}
              onClick={() => { setState(s); void load(s); }}
              className={cn(
                'inline-flex h-8 items-center rounded-lg px-3 text-[12.5px] font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-teal-700',
                state === s ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      }
    >
      {err ? <p className={cn('text-destructive pb-3 text-sm', rows && rows.length ? 'px-5 sm:px-6' : '')}>{err}</p> : null}
      {rows === null ? (
        err ? null : <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Nothing in quarantine." />
      ) : (
        <Table responsive>
          <TableHeader>
            <TableRow>
              <TableHead>Batch</TableHead>
              <TableHead className="text-right">Row</TableHead>
              <TableHead>State</TableHead>
              <TableHead>References</TableHead>
              <TableHead>Stage / decision / activation</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Explanation</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell data-label="Batch">
                  <div className="flex items-center gap-2.5">
                    <BankMark code={r.batch.bank.code} size="sm" />
                    <div className="min-w-0">
                      <Link className="font-mono text-xs" href={`/admin/mis/batches/${r.batch.id}`}>
                        {r.batch.publicRef}
                      </Link>
                      <div className="text-[11px] text-slate-500">
                        {r.batch.bank.code} · {formatDateTime(r.batch.uploadedAt)}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell data-label="Row" className="tabular-nums sm:text-right">
                  {r.sourceRowNumber}
                </TableCell>
                <TableCell data-label="State">
                  <Badge variant={r.matchState === 'CONFLICT' ? 'destructive' : 'warning'}>{humanize(r.matchState)}</Badge>
                </TableCell>
                <TableCell data-label="References">
                  <div className="grid gap-0.5">
                    {r.referenceValues.map((x) => (
                      <span key={`${x.kind}-${x.value}`} className="min-w-0 font-mono text-[11px] text-slate-700">
                        <span className="block text-[10px] text-slate-400">{x.kind}=</span>
                        <span className="break-all">{x.value}</span>
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell data-label="Stage / decision / activation" className="text-xs">
                  <dl className="grid gap-0.5">
                    {(
                      [
                        ['Stage', r.currentStage],
                        ['Decision', r.finalDecision],
                        ['Activation', r.cardActivationStatus],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k} className="flex gap-1.5">
                        <dt className="text-slate-500">{k}:</dt>
                        <dd className="text-slate-800">{v || <em className="text-slate-400">blank</em>}</dd>
                      </div>
                    ))}
                  </dl>
                </TableCell>
                <TableCell data-label="Customer">{r.customer}</TableCell>
                <TableCell data-label="Explanation" className="text-xs text-slate-500">
                  {r.matchExplanation}
                </TableCell>
                <TableCell data-label="Action" className="sm:text-right">
                  <Resolve rowId={r.id} refs={r.referenceValues} onDone={() => void load()} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  );
}

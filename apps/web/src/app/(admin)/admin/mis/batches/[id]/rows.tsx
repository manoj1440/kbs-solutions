'use client';

import { ApiClientError } from '@kbs/shared';
import { Ban, Eye, EyeOff, Rows3 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, humanize, SectionCard, selectClass } from '@/components/ui/kit';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { clientApi } from '@/lib/client-api';
import { cn } from '@/lib/utils';

import { Resolve } from '@/components/mis-resolve';

interface Row {
  id: string;
  sourceRowNumber: number;
  matchState: string;
  matchExplanation: string | null;
  matchedLead: { publicRef: string } | null;
  referenceValues: { kind: string; value: string }[];
  mapped: Record<string, string>;
  raw: Record<string, string>;
}

const STATE: Record<string, 'info' | 'success' | 'warning' | 'destructive' | 'unknown'> = { PENDING: 'info', MATCHED: 'success', UNMATCHED: 'warning', CONFLICT: 'destructive', INVALID: 'destructive', DUPLICATE_IN_BATCH: 'unknown', IGNORED: 'unknown' };

export function BatchRows({ batchId, stage }: { batchId: string; stage: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [reveal, setReveal] = useState(false);
  const [state, setState] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const load = async (rv = reveal, st = state) => {
    try {
      const r = await clientApi.get<Row[]>(`/mis/batches/${batchId}/rows?pageSize=200${rv ? '&reveal=true' : ''}${st ? `&matchState=${st}` : ''}`);
      setRows(r.data);
    } catch (e) {
      setMsg(e instanceof ApiClientError ? e.message : 'Could not load rows.');
    }
  };
  // (re)load after mount and whenever the batch stage moves; scheduling this during render raced React's mount
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keep the current reveal/filter; only the stage triggers a reload
  }, [stage]);
  const blank = <em className="text-slate-400">blank</em>;
  return (
    <SectionCard
      icon={Rows3}
      tone="indigo"
      title="Rows"
      description="Customer name, company and capture link are masked by default; revealing is logged as a sensitive access."
      flush={Boolean(rows && rows.length)}
    >
      <div className={cn('grid gap-3', rows && rows.length ? 'px-5 pb-4 sm:px-6' : '')}>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="match state" className={cn(selectClass, 'h-9 w-auto min-w-40')} value={state} onChange={(e) => { setState(e.target.value); void load(reveal, e.target.value); }}>
            <option value="">all states</option>
            {['PENDING', 'MATCHED', 'UNMATCHED', 'CONFLICT', 'INVALID', 'IGNORED'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" className="h-9" onClick={() => { setReveal(!reveal); void load(!reveal, state); }}>
            {reveal ? <EyeOff /> : <Eye />}
            {reveal ? 'Mask PII' : 'Reveal PII (logged)'}
          </Button>
          {stage !== 'APPLIED' && stage !== 'REJECTED' ? (
            <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
              <Input className="h-9 min-w-0 flex-1 text-[13px] sm:w-56 sm:flex-none" placeholder="reject reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button
                size="sm"
                variant="destructive"
                className="h-9"
                disabled={reason.trim().length < 3}
                onClick={async () => {
                  try {
                    await clientApi.post(`/mis/batches/${batchId}/reject`, { reason });
                    router.refresh();
                  } catch (e) {
                    setMsg(e instanceof ApiClientError ? e.message : 'Could not reject.');
                  }
                }}
              >
                <Ban />
                Reject batch
              </Button>
            </div>
          ) : null}
        </div>
        {msg ? <p className="text-destructive text-sm">{msg}</p> : null}
        {rows && rows.length === 0 ? <EmptyState icon={Rows3} title="No rows." description={state ? 'No row in this batch has that match state.' : undefined} /> : null}
      </div>
      {rows && rows.length ? (
        <Table responsive>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">Row</TableHead>
              <TableHead>State</TableHead>
              <TableHead>References</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>Activation</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Explanation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell data-label="Row" className="text-xs text-slate-500 tabular-nums sm:text-right">
                  {r.sourceRowNumber}
                </TableCell>
                <TableCell data-label="State">
                  <Badge variant={STATE[r.matchState] ?? 'unknown'}>{humanize(r.matchState)}</Badge>
                  {r.matchedLead ? <div className="mt-1 font-mono text-[11px] whitespace-nowrap text-slate-600">{r.matchedLead.publicRef}</div> : null}
                </TableCell>
                <TableCell data-label="References">
                  {r.referenceValues.length ? (
                    <div className="grid gap-1">
                      {r.referenceValues.map((x) => (
                        <span key={`${x.kind}-${x.value}`} className="min-w-0 font-mono text-[11px] text-slate-700">
                          <span className="block text-[10px] text-slate-400">{x.kind.replace('APPLICATION_', 'APP ').replace('_', ' ')}:</span>
                          <span className="break-all">{x.value}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell data-label="Stage" className="text-xs text-slate-800">{r.mapped.currentStage || blank}</TableCell>
                <TableCell data-label="Decision" className="text-xs text-slate-800">{r.mapped.finalDecision || blank}</TableCell>
                <TableCell data-label="Activation" className="text-xs text-slate-800">{r.mapped.cardActivationStatus || blank}</TableCell>
                <TableCell data-label="Customer" className="text-xs">{r.mapped.customerName}</TableCell>
                <TableCell data-label="Explanation" className="text-xs text-slate-500">
                  {r.matchExplanation}
                  {r.matchState === 'UNMATCHED' || r.matchState === 'CONFLICT' ? (
                    <div className="mt-1.5">
                      <Resolve rowId={r.id} refs={r.referenceValues} onDone={() => void load()} />
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </SectionCard>
  );
}

/** F-504 §4: resolve a quarantined row — link by KBS lead reference (never by customer name), ignore, or prefer another row. */

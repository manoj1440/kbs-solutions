'use client';

import { ApiClientError } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { clientApi } from '@/lib/client-api';

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
  const [loadedStage, setLoadedStage] = useState<string | null>(null);
  if (loadedStage !== stage) {
    setLoadedStage(stage);
    setTimeout(() => void load(), 0);
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rows</CardTitle>
        <CardDescription>Customer name, company and capture link are masked by default; revealing is logged as a sensitive access.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="match state" className="border-input bg-background h-8 rounded-md border px-2 text-xs" value={state} onChange={(e) => { setState(e.target.value); void load(reveal, e.target.value); }}>
            <option value="">all states</option>
            {['PENDING', 'MATCHED', 'UNMATCHED', 'CONFLICT', 'INVALID', 'IGNORED'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={() => { setReveal(!reveal); void load(!reveal, state); }}>
            {reveal ? 'Mask PII' : 'Reveal PII (logged)'}
          </Button>
          {stage !== 'APPLIED' && stage !== 'REJECTED' ? (
            <>
              <Input className="h-8 max-w-xs text-xs" placeholder="reject reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button
                size="sm"
                variant="destructive"
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
                Reject batch
              </Button>
            </>
          ) : null}
        </div>
        {msg ? <p className="text-destructive text-sm">{msg}</p> : null}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Row</TableHead>
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
              {(rows ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.sourceRowNumber}</TableCell>
                  <TableCell>
                    <Badge variant={STATE[r.matchState] ?? 'unknown'}>{r.matchState}</Badge>
                    {r.matchedLead ? <div className="font-mono text-xs">{r.matchedLead.publicRef}</div> : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.referenceValues.map((x) => `${x.kind.replace('APPLICATION_', 'APP ').replace('_', ' ')}: ${x.value}`).join(' · ') || '—'}</TableCell>
                  <TableCell className="text-xs">{r.mapped.currentStage || <em className="text-muted-foreground">blank</em>}</TableCell>
                  <TableCell className="text-xs">{r.mapped.finalDecision || <em className="text-muted-foreground">blank</em>}</TableCell>
                  <TableCell className="text-xs">{r.mapped.cardActivationStatus || <em className="text-muted-foreground">blank</em>}</TableCell>
                  <TableCell className="text-xs">{r.mapped.customerName}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {r.matchExplanation}
                    {r.matchState === 'UNMATCHED' || r.matchState === 'CONFLICT' ? <Resolve rowId={r.id} refs={r.referenceValues} onDone={() => void load()} /> : null}
                  </TableCell>
                </TableRow>
              ))}
              {rows && rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground text-center">
                    No rows.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/** F-504 §4: resolve a quarantined row — link by KBS lead reference (never by customer name), ignore, or prefer another row. */
function Resolve({ rowId, refs, onDone }: { rowId: string; refs: { kind: string; value: string }[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [leadRef, setLeadRef] = useState('');
  const [kind, setKind] = useState(refs[0]?.kind ?? 'APPLICATION_NO');
  const [reason, setReason] = useState('');
  const [preferRow, setPreferRow] = useState('');
  const [err, setErr] = useState<string | null>(null);
  if (!open)
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Resolve
      </Button>
    );
  const act = async (body: Record<string, unknown>) => {
    setErr(null);
    try {
      if (body.action === 'LINK_TO_LEAD') {
        const found = await clientApi.get<{ id: string }[]>(`/leads?q=${encodeURIComponent(leadRef.trim())}&pageSize=2`);
        if (found.data.length !== 1) throw new Error('Enter the exact KBS lead reference (one match required).');
        body.leadId = found.data[0].id;
      }
      await clientApi.post(`/mis/rows/${rowId}/resolve`, body);
      setOpen(false);
      onDone();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : 'Could not resolve.');
    }
  };
  return (
    <div className="mt-1 grid min-w-72 gap-1">
      <Input aria-label="reason" className="h-8 text-xs" placeholder="reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-1">
        <Input aria-label="kbs lead ref" className="h-8 text-xs" placeholder="KBS-L-…" value={leadRef} onChange={(e) => setLeadRef(e.target.value.toUpperCase())} />
        <select aria-label="reference kind" className="border-input bg-background h-8 rounded-md border px-1 text-xs" value={kind} onChange={(e) => setKind(e.target.value)}>
          {refs.map((r) => (
            <option key={r.kind} value={r.kind}>
              {r.kind}
            </option>
          ))}
        </select>
        <Button size="sm" disabled={reason.trim().length < 3 || !leadRef.trim()} onClick={() => void act({ action: 'LINK_TO_LEAD', referenceKind: kind, reason })}>
          Link
        </Button>
      </div>
      <div className="flex gap-1">
        <Input aria-label="prefer row id" className="h-8 text-xs" placeholder="prefer row id" value={preferRow} onChange={(e) => setPreferRow(e.target.value)} />
        <Button size="sm" variant="outline" disabled={reason.trim().length < 3 || !preferRow} onClick={() => void act({ action: 'PREFER_ROW', rowId: preferRow, reason })}>
          Prefer
        </Button>
        <Button size="sm" variant="destructive" disabled={reason.trim().length < 3} onClick={() => void act({ action: 'IGNORE', reason })}>
          Ignore
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {err ? <span className="text-destructive text-xs">{err}</span> : null}
    </div>
  );
}

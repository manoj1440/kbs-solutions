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
  if (rows === null) setTimeout(() => void load(), 0);
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
                  <TableCell className="text-muted-foreground text-xs">{r.matchExplanation}</TableCell>
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

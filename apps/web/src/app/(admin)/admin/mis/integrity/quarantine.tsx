'use client';

import { ApiClientError, formatDateTime } from '@kbs/shared';
import Link from 'next/link';
import { useState } from 'react';

import { Resolve } from '@/components/mis-resolve';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { clientApi } from '@/lib/client-api';

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
  if (rows === null) setTimeout(() => void load(), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quarantine · {total} row(s)</CardTitle>
        <CardDescription>Rows no lead carries a reference for, or whose references disagree. Resolve by KBS reference only; customer names are masked.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <div className="flex gap-2">
          {['', 'UNMATCHED', 'CONFLICT'].map((s) => (
            <Button key={s || 'all'} size="sm" variant={state === s ? 'default' : 'outline'} onClick={() => { setState(s); void load(s); }}>
              {s || 'All'}
            </Button>
          ))}
        </div>
        {err ? <p className="text-destructive text-sm">{err}</p> : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Batch</TableHead>
              <TableHead>Row</TableHead>
              <TableHead>State</TableHead>
              <TableHead>References</TableHead>
              <TableHead>Stage / decision / activation</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Explanation</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link className="underline" href={`/admin/mis/batches/${r.batch.id}`}>
                    {r.batch.publicRef}
                  </Link>
                  <div className="text-muted-foreground text-xs">
                    {r.batch.bank.code} · {formatDateTime(r.batch.uploadedAt)}
                  </div>
                </TableCell>
                <TableCell>{r.sourceRowNumber}</TableCell>
                <TableCell>
                  <Badge variant={r.matchState === 'CONFLICT' ? 'destructive' : 'warning'}>{r.matchState}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.referenceValues.map((x) => `${x.kind}=${x.value}`).join(' · ')}</TableCell>
                <TableCell className="text-xs">
                  {r.currentStage ?? 'blank'} / {r.finalDecision ?? 'blank'} / {r.cardActivationStatus ?? 'blank'}
                </TableCell>
                <TableCell>{r.customer}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{r.matchExplanation}</TableCell>
                <TableCell>
                  <Resolve rowId={r.id} refs={r.referenceValues} onDone={() => void load()} />
                </TableCell>
              </TableRow>
            ))}
            {rows && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground text-center">
                  Nothing in quarantine.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

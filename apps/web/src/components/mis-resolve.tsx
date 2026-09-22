'use client';

import { ApiClientError } from '@kbs/shared';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clientApi } from '@/lib/client-api';

/** F-504 — resolve an UNMATCHED / CONFLICT MIS row: link by KBS reference only, prefer a row, or ignore with reason. */
export function Resolve({ rowId, refs, onDone }: { rowId: string; refs: { kind: string; value: string }[]; onDone: () => void }) {
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

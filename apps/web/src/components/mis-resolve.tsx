'use client';

import { ApiClientError } from '@kbs/shared';
import { Ban, Link2, ListChecks, Wrench, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { selectClass } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
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
      <Button size="sm" variant="soft" onClick={() => setOpen(true)}>
        <Wrench />
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
    <div className="grid w-full min-w-0 gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-left sm:min-w-72">
      <Input aria-label="reason" className="h-8 bg-white text-xs" placeholder="reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex flex-wrap gap-1.5">
        <Input aria-label="kbs lead ref" className="h-8 min-w-0 flex-1 basis-28 bg-white font-mono text-xs" placeholder="KBS-L-…" value={leadRef} onChange={(e) => setLeadRef(e.target.value.toUpperCase())} />
        <select aria-label="reference kind" className={cn(selectClass, 'h-8 w-auto min-w-0 flex-1 basis-24 px-2 text-xs')} value={kind} onChange={(e) => setKind(e.target.value)}>
          {refs.map((r) => (
            <option key={r.kind} value={r.kind}>
              {r.kind}
            </option>
          ))}
        </select>
        <Button size="sm" disabled={reason.trim().length < 3 || !leadRef.trim()} onClick={() => void act({ action: 'LINK_TO_LEAD', referenceKind: kind, reason })}>
          <Link2 />
          Link
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Input aria-label="prefer row id" className="h-8 min-w-0 flex-1 basis-28 bg-white text-xs" placeholder="prefer row id" value={preferRow} onChange={(e) => setPreferRow(e.target.value)} />
        <Button size="sm" variant="outline" disabled={reason.trim().length < 3 || !preferRow} onClick={() => void act({ action: 'PREFER_ROW', rowId: preferRow, reason })}>
          <ListChecks />
          Prefer
        </Button>
      </div>
      <div className="flex flex-wrap justify-end gap-1.5 border-t border-slate-200 pt-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          <X />
          Cancel
        </Button>
        <Button size="sm" variant="destructive" disabled={reason.trim().length < 3} onClick={() => void act({ action: 'IGNORE', reason })}>
          <Ban />
          Ignore
        </Button>
      </div>
      {err ? <span className="text-destructive text-xs">{err}</span> : null}
    </div>
  );
}

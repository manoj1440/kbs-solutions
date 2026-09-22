'use client';

import { ApiClientError } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clientApi } from '@/lib/client-api';

/** F-305 §4: manual reassignment with mandatory reason (Manager within team, Admin any). */
export function ReassignForm({ recordId, currentId, options }: { recordId: string; currentId: string | null; options: { id: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const targets = options.filter((o) => o.id !== currentId);
  if (!open)
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Reassign
      </Button>
    );
  return (
    <div className="grid min-w-56 gap-1">
      <select aria-label="reassign to" className="border-input bg-background h-8 rounded-md border px-2 text-xs" value={to} onChange={(e) => setTo(e.target.value)}>
        <option value="">— Telecaller —</option>
        {targets.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <Input aria-label="reassign reason" className="h-8 text-xs" placeholder="reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-1">
        <Button
          size="sm"
          disabled={!to || reason.trim().length < 3}
          onClick={async () => {
            try {
              await clientApi.post(`/calling/records/${recordId}/reassign`, { toTelecallerUserId: to, reason });
              setOpen(false);
              setMsg(null);
              router.refresh();
            } catch (e) {
              setMsg(e instanceof ApiClientError ? e.message : 'Could not reassign.');
            }
          }}
        >
          Move
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {msg ? (
        <span role="alert" className="text-destructive text-xs">
          {msg}
        </span>
      ) : null}
    </div>
  );
}

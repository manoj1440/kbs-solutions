'use client';

import { ApiClientError } from '@kbs/shared';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { humanize, selectClass } from '@/components/ui/kit';
import { Label } from '@/components/ui/label';
import { clientApi } from '@/lib/client-api';

export interface OwnerOption {
  id: string;
  fullName: string;
  role: string;
  employeeCode?: string | null;
}

function useSubmit() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      after?.();
      router.refresh();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  };
  return { busy, err, run };
}

/** Admin: create an Agent Code for an active Manager or the Admin. The server generates the code when none is typed. */
export function CreateAgentCodeForm({ owners }: { owners: OwnerOption[] }) {
  const [owner, setOwner] = useState('');
  const [code, setCode] = useState('');
  const [created, setCreated] = useState<string | null>(null);
  const { busy, err, run } = useSubmit();
  const typed = code.trim();
  const codeOk = !typed || (typed.length >= 4 && typed.length <= 12);
  return (
    <form
      className="grid gap-3 rounded-xl border border-border bg-surface-muted p-3 sm:p-4 md:grid-cols-[1.5fr_1fr_auto] md:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        setCreated(null);
        void run(async () => {
          const { data } = await clientApi.post<{ code: string }>('/agent-codes', {
            ownerUserId: owner,
            ...(typed ? { code: typed } : {}),
          });
          setCreated(data.code);
          setCode('');
        });
      }}
    >
      <div className="grid gap-1">
        <Label htmlFor="ac-owner">Owner</Label>
        <select
          id="ac-owner"
          className={selectClass}
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          disabled={!owners.length}
        >
          <option value="">{owners.length ? 'Choose…' : 'No active Manager'}</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.fullName} ({humanize(o.role)}){o.employeeCode ? ` · ${o.employeeCode}` : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="ac-code">Code (optional)</Label>
        <Input
          id="ac-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Generated when empty"
          maxLength={12}
          autoComplete="off"
          aria-invalid={!codeOk}
          aria-describedby="ac-code-hint"
          className="font-mono"
        />
      </div>
      <Button type="submit" disabled={busy || !owner || !codeOk}>
        <Plus />
        Create code
      </Button>
      <p
        id="ac-code-hint"
        className={`text-xs md:col-span-3 ${codeOk ? 'text-muted-foreground' : 'text-destructive'}`}
      >
        4 to 12 letters or digits. Leave empty and an 8-character code is generated.
      </p>
      {err ? (
        <p role="alert" className="text-destructive text-sm md:col-span-3">
          {err}
        </p>
      ) : null}
      {created && !err ? (
        <p role="status" className="text-success text-sm md:col-span-3">
          Code <span className="font-mono font-semibold">{created}</span> created.
        </p>
      ) : null}
    </form>
  );
}

/** Inline reason input (min 3 characters) with Confirm / Cancel; the caller posts `{ reason }`. */
function ReasonForm({
  label,
  busy,
  err,
  destructive,
  onConfirm,
  onCancel,
}: {
  label: string;
  busy: boolean;
  err: string | null;
  destructive?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="grid min-w-48 gap-1">
      <Input
        aria-label={`Reason to ${label.toLowerCase()}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required)"
        maxLength={500}
        autoFocus
      />
      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant={destructive ? 'destructive' : 'default'}
          disabled={busy || reason.trim().length < 3}
          onClick={() => onConfirm(reason.trim())}
        >
          Confirm {label.toLowerCase()}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {err ? (
        <span role="alert" className="text-destructive text-xs">
          {err}
        </span>
      ) : null}
    </div>
  );
}

export function RevokeAgentCodeButton({ id, code }: { id: string; code: string }) {
  const [open, setOpen] = useState(false);
  const { busy, err, run } = useSubmit();
  if (!open)
    return (
      <Button
        size="sm"
        variant="outline"
        aria-label={`Revoke ${code}`}
        onClick={() => setOpen(true)}
      >
        Revoke
      </Button>
    );
  return (
    <ReasonForm
      label="Revoke"
      destructive
      busy={busy}
      err={err}
      onCancel={() => setOpen(false)}
      onConfirm={(reason) =>
        run(
          () => clientApi.post(`/agent-codes/${id}/revoke`, { reason }),
          () => setOpen(false),
        )
      }
    />
  );
}

export function PendingDecisionButtons({ id, advisor }: { id: string; advisor: string }) {
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null);
  const { busy, err, run } = useSubmit();
  if (!mode)
    return (
      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          aria-label={`Approve change for ${advisor}`}
          onClick={() => setMode('approve')}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-label={`Reject change for ${advisor}`}
          onClick={() => setMode('reject')}
        >
          Reject
        </Button>
      </div>
    );
  return (
    <ReasonForm
      label={mode === 'approve' ? 'Approve' : 'Reject'}
      destructive={mode === 'reject'}
      busy={busy}
      err={err}
      onCancel={() => setMode(null)}
      onConfirm={(reason) =>
        run(
          () => clientApi.post(`/hierarchy/pending/${id}/${mode}`, { reason }),
          () => setMode(null),
        )
      }
    />
  );
}

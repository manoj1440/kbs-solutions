'use client';

import { ApiClientError, formatDateTime } from '@kbs/shared';
import { House, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { selectClass } from '@/components/ui/kit';
import { Label } from '@/components/ui/label';
import { clientApi } from '@/lib/client-api';
import { type WfhRow, wfhActive, wfhOpen } from '@/lib/wfh';

export type { WfhRow };

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

/** Admin: add an office egress CIDR (REQ-09 §9.1 — server-side IP check, never SSID). */
export function AddNetworkForm() {
  const [label, setLabel] = useState('');
  const [cidr, setCidr] = useState('');
  const [reason, setReason] = useState('');
  const { busy, err, run } = useSubmit();
  return (
    <form
      className="grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 sm:p-4 md:grid-cols-[1fr_1fr_1.5fr_auto] md:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        void run(
          () =>
            clientApi.post('/access-policy/networks', {
              label: label.trim(),
              cidr: cidr.trim(),
              reason: reason.trim(),
            }),
          () => {
            setLabel('');
            setCidr('');
            setReason('');
          },
        );
      }}
    >
      <div className="grid gap-1">
        <Label htmlFor="net-label">Label</Label>
        <Input
          id="net-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Jaipur office"
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="net-cidr">Egress CIDR</Label>
        <Input
          id="net-cidr"
          value={cidr}
          onChange={(e) => setCidr(e.target.value)}
          placeholder="203.0.113.0/24"
          className="font-mono"
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="net-reason">Reason</Label>
        <Input
          id="net-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why this network is trusted"
        />
      </div>
      <Button
        type="submit"
        disabled={
          busy || label.trim().length < 2 || cidr.trim().length < 7 || reason.trim().length < 3
        }
      >
        <Plus />
        Add network
      </Button>
      {err ? <p className="text-destructive text-sm md:col-span-4">{err}</p> : null}
    </form>
  );
}

export function NetworkActiveToggle({ id, active }: { id: string; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const { busy, err, run } = useSubmit();
  if (!open)
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {active ? 'Deactivate' : 'Activate'}
      </Button>
    );
  return (
    <div className="grid min-w-48 gap-1">
      <Input
        aria-label="Reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required)"
      />
      <div className="flex gap-1">
        <Button
          size="sm"
          disabled={busy || reason.trim().length < 3}
          onClick={() =>
            run(
              () =>
                clientApi.post(`/access-policy/networks/${id}/active`, {
                  active: !active,
                  reason: reason.trim(),
                }),
              () => setOpen(false),
            )
          }
        >
          Confirm
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {err ? <span className="text-destructive text-xs">{err}</span> : null}
    </div>
  );
}

export function RevokeWfhButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const { busy, err, run } = useSubmit();
  if (!open)
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Revoke
      </Button>
    );
  return (
    <div className="grid min-w-48 gap-1">
      <Input
        aria-label="Revocation reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required)"
      />
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="destructive"
          disabled={busy || reason.trim().length < 3}
          onClick={() =>
            run(
              () => clientApi.post(`/access-policy/wfh/${id}/revoke`, { reason: reason.trim() }),
              () => setOpen(false),
            )
          }
        >
          Revoke now
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {err ? <span className="text-destructive text-xs">{err}</span> : null}
    </div>
  );
}

/** Grant a WFH exception. With `telecallers`, shows a picker (Admin); otherwise for the fixed `telecallerId` (Manager). */
export function GrantWfhForm({
  telecallerId,
  telecallers,
}: {
  telecallerId?: string;
  telecallers?: { id: string; fullName: string; employeeCode: string | null }[];
}) {
  const [target, setTarget] = useState(telecallerId ?? '');
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState('');
  const { busy, err, run } = useSubmit();
  return (
    <form
      className="grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 sm:p-4 md:grid-cols-[repeat(3,minmax(0,1fr))_auto] md:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        void run(
          () =>
            clientApi.post('/access-policy/wfh', {
              telecallerUserId: target,
              reason: reason.trim(),
              endsAt: endsAt ? new Date(endsAt).toISOString() : null,
            }),
          () => {
            setReason('');
            setEndsAt('');
          },
        );
      }}
    >
      {telecallers ? (
        <div className="grid gap-1">
          <Label htmlFor="wfh-tc">Telecaller</Label>
          <select
            id="wfh-tc"
            className={selectClass}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">Choose…</option>
            {telecallers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName} {t.employeeCode ? `(${t.employeeCode})` : ''}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="grid gap-1">
        <Label htmlFor="wfh-end">Ends (optional)</Label>
        <Input
          id="wfh-end"
          type="datetime-local"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
        />
      </div>
      <div className={`grid gap-1 ${telecallers ? '' : 'md:col-span-2'}`}>
        <Label htmlFor="wfh-reason">Reason</Label>
        <Input
          id="wfh-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why calling is allowed outside the office"
        />
      </div>
      <Button type="submit" disabled={busy || !target || reason.trim().length < 3}>
        <House />
        Grant WFH
      </Button>
      {err ? <p className="text-destructive text-sm md:col-span-4">{err}</p> : null}
    </form>
  );
}

/** Manager / Admin: the Telecaller's WFH state with grant / revoke and recent history. */
export function WfhPanel({ telecallerId, rows }: { telecallerId: string; rows: WfhRow[] }) {
  const mine = rows.filter((r) => r.telecallerUserId === telecallerId);
  const active = mine.find((r) => wfhActive(r)) ?? mine.find((r) => wfhOpen(r));
  return (
    <div className="grid gap-3">
      {active ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50/60 p-3">
          <div className="text-sm">
            <Badge variant="info">WFH {wfhActive(active) ? 'active' : 'scheduled'}</Badge> from{' '}
            {formatDateTime(active.startsAt)}{' '}
            {active.endsAt ? `until ${formatDateTime(active.endsAt)}` : 'until revoked'} ·{' '}
            {active.reason}
          </div>
          <RevokeWfhButton id={active.id} />
        </div>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            No exception — calling is allowed only from an office network.
          </p>
          <GrantWfhForm telecallerId={telecallerId} />
        </>
      )}
      {mine.length ? (
        <ul className="text-muted-foreground grid gap-1 text-xs">
          {mine.slice(0, 5).map((r) => (
            <li key={r.id}>
              {formatDateTime(r.startsAt)} →{' '}
              {r.revokedAt
                ? `revoked ${formatDateTime(r.revokedAt)}`
                : r.endsAt
                  ? formatDateTime(r.endsAt)
                  : 'open'}{' '}
              · {r.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

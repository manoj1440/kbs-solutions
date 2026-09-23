'use client';

import { ApiClientError } from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clientApi } from '@/lib/client-api';

const sel = 'border-input bg-background h-9 rounded-md border px-2 text-sm';

/** F-105: Admin creates Manager / Accounts users (Telecallers are created by Managers, Advisors self-register). */
export function CreateUserDialog() {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [role, setRole] = useState<'MANAGER' | 'ACCOUNTS'>('MANAGER');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { data } = await clientApi.post<{ id: string }>('/users', {
        role,
        fullName: fullName.trim(),
        mobile: mobile.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      ref.current?.close();
      setFullName('');
      setMobile('');
      setEmail('');
      router.push(`/admin/users/${data.id}`);
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : 'Could not create the user.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button onClick={() => ref.current?.showModal()}>Create user</Button>
      <dialog
        ref={ref}
        aria-label="Create user"
        className="m-auto w-full max-w-md rounded-lg bg-white p-0 shadow-2xl backdrop:bg-slate-900/40"
      >
        <form
          className="grid gap-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <h2 className="text-lg font-semibold">Create user</h2>
          <p className="text-muted-foreground text-xs">
            Managers create Telecallers from their team screen; Advisors register themselves. There
            is only one Admin.
          </p>
          <div className="grid gap-1">
            <Label htmlFor="cu-role">Role</Label>
            <select
              id="cu-role"
              className={sel}
              value={role}
              onChange={(e) => setRole(e.target.value as 'MANAGER' | 'ACCOUNTS')}
            >
              <option value="MANAGER">Manager</option>
              <option value="ACCOUNTS">Accounts</option>
            </select>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="cu-name">Full name</Label>
            <Input
              id="cu-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              minLength={2}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="cu-mobile">Mobile</Label>
            <Input
              id="cu-mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              inputMode="tel"
              placeholder="10-digit mobile"
              required
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="cu-email">E-mail (optional)</Label>
            <Input
              id="cu-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {err ? <p className="text-destructive text-sm">{err}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => ref.current?.close()}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy || fullName.trim().length < 2 || mobile.trim().length < 10}
            >
              Create
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}

/** One reason-gated lifecycle action (deactivate / reactivate / revoke sessions / change mobile). */
export function LifecycleAction({
  userId,
  action,
  label,
  variant = 'outline',
  withMobile = false,
  disabledReason,
}: {
  userId: string;
  action: 'deactivate' | 'reactivate' | 'sessions/revoke' | 'change-mobile';
  label: string;
  variant?: 'outline' | 'destructive';
  withMobile?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [mobile, setMobile] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const minReason = withMobile ? 10 : 3;
  if (!open)
    return (
      <div className="grid gap-1">
        <Button
          size="sm"
          variant={variant}
          disabled={Boolean(disabledReason)}
          title={disabledReason}
          onClick={() => setOpen(true)}
        >
          {label}
        </Button>
        {disabledReason ? (
          <span className="text-muted-foreground text-xs">{disabledReason}</span>
        ) : null}
        {msg ? (
          <span className={`text-xs ${msg.ok ? 'text-success' : 'text-destructive'}`}>
            {msg.text}
          </span>
        ) : null}
      </div>
    );
  return (
    <div className="grid min-w-56 gap-1 rounded-md border p-2">
      {withMobile ? (
        <Input
          aria-label="New mobile"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          placeholder="New 10-digit mobile"
          inputMode="tel"
        />
      ) : null}
      <Input
        aria-label={`Reason to ${label.toLowerCase()}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required)"
      />
      <div className="flex gap-1">
        <Button
          size="sm"
          variant={variant}
          disabled={
            busy || reason.trim().length < minReason || (withMobile && mobile.trim().length < 10)
          }
          onClick={async () => {
            setBusy(true);
            try {
              await clientApi.post(
                `/users/${userId}/${action}`,
                withMobile
                  ? { mobile: mobile.trim(), reason: reason.trim() }
                  : { reason: reason.trim() },
              );
              setMsg({ ok: true, text: 'Done.' });
              setOpen(false);
              setReason('');
              router.refresh();
            } catch (e) {
              setMsg({
                ok: false,
                text: e instanceof ApiClientError ? e.message : 'Request failed.',
              });
            } finally {
              setBusy(false);
            }
          }}
        >
          Confirm
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {msg && !msg.ok ? <span className="text-destructive text-xs">{msg.text}</span> : null}
    </div>
  );
}

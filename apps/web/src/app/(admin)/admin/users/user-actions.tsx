'use client';

import { ApiClientError } from '@kbs/shared';
import { UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Callout, Field, IconTile, selectClass } from '@/components/ui/kit';
import { clientApi } from '@/lib/client-api';

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
      <Button onClick={() => ref.current?.showModal()}>
        <UserPlus />
        Create user
      </Button>
      <dialog
        ref={ref}
        aria-label="Create user"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-slate-900/40"
      >
        <form
          className="grid gap-4 p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="flex items-start gap-3">
            <IconTile icon={UserPlus} tone="violet" size="sm" />
            <div className="min-w-0">
              <h2 className="text-[15px] leading-6 font-semibold text-slate-900">Create user</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Managers create Telecallers from their team screen; Advisors register themselves.
                There is only one Admin.
              </p>
            </div>
          </div>
          <Field label="Role" htmlFor="cu-role">
            <select
              id="cu-role"
              className={selectClass}
              value={role}
              onChange={(e) => setRole(e.target.value as 'MANAGER' | 'ACCOUNTS')}
            >
              <option value="MANAGER">Manager</option>
              <option value="ACCOUNTS">Accounts</option>
            </select>
          </Field>
          <Field label="Full name" htmlFor="cu-name">
            <Input
              id="cu-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              minLength={2}
            />
          </Field>
          <Field label="Mobile" htmlFor="cu-mobile">
            <Input
              id="cu-mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              inputMode="tel"
              placeholder="10-digit mobile"
              required
            />
          </Field>
          <Field label="E-mail (optional)" htmlFor="cu-email">
            <Input
              id="cu-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {err ? (
            <Callout tone="danger" role="alert">
              {err}
            </Callout>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
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
          className="w-full"
          disabled={Boolean(disabledReason)}
          title={disabledReason}
          onClick={() => setOpen(true)}
        >
          {label}
        </Button>
        {disabledReason ? (
          <span className="text-[11.5px] leading-relaxed text-slate-500">{disabledReason}</span>
        ) : null}
        {msg ? (
          <span className={`text-xs ${msg.ok ? 'text-success' : 'text-destructive'}`}>
            {msg.text}
          </span>
        ) : null}
      </div>
    );
  return (
    <div className="grid min-w-0 gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <p className="text-[12px] font-semibold text-slate-700">{label}</p>
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
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant={variant === 'outline' ? 'default' : variant}
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

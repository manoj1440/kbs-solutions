'use client';

import {
  ApiClientError,
  type AuthSessionResponse,
  type OtpRequestResponse,
  isValidE164India,
} from '@kbs/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clientApi } from '@/lib/client-api';
import { homeFor } from '@/lib/roles';

type Step =
  | { kind: 'mobile' }
  | { kind: 'otp'; mobile: string; challengeId: string; resendAt: number; expiresAt: number };

const OTP_LEN = 6;

/** F-801: OTP-only login (REQ-04 §4.1). Same UI whether or not the number exists (REQ-23 §23.1). */
function otpStep(mobile: string, r: OtpRequestResponse): Step {
  return {
    kind: 'otp',
    mobile,
    challengeId: r.challengeId,
    resendAt: Date.now() + r.resendAfterSec * 1000,
    expiresAt: Date.now() + r.expiresInSec * 1000,
  };
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: 'mobile' });
  const [mobile, setMobile] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(OTP_LEN).fill(''));
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Countdown for "resend": seconds remaining, driven by an interval (state, so render stays pure).
  const [secondsLeft, setSecondsLeft] = useState(0);
  const resendAt = step.kind === 'otp' ? step.resendAt : 0;
  useEffect(() => {
    if (!resendAt) return;
    const compute = () => Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
    const t = setInterval(() => setSecondsLeft(compute()), 1000);
    return () => clearInterval(t);
  }, [resendAt]);

  const code = digits.join('');

  async function requestOtp(m: string) {
    setError(null);
    if (!isValidE164India(m)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setBusy(true);
    try {
      const r = await clientApi.post<OtpRequestResponse>('/auth/otp/request', {
        mobile: m,
        purpose: 'LOGIN',
      });
      setStep(otpStep(m, r.data));
      setSecondsLeft(r.data.resendAfterSec);
      setDigits(Array(OTP_LEN).fill(''));
      requestAnimationFrame(() => digitRefs.current[0]?.focus());
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not send the code. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (step.kind !== 'otp') return;
    setError(null);
    setBusy(true);
    try {
      const r = await clientApi.post<AuthSessionResponse>('/auth/otp/verify', {
        challengeId: step.challengeId,
        code,
        platform: 'WEB',
      });
      const home = homeFor(r.data.user.role);
      router.replace(next && next.startsWith('/') ? next : home);
      router.refresh();
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Could not verify the code.';
      setError(msg);
      if (
        e instanceof ApiClientError &&
        (e.error.code === 'AUTH_OTP_EXPIRED' || e.error.code === 'AUTH_PLATFORM_NOT_ALLOWED')
      )
        setStep({ kind: 'mobile' });
    } finally {
      setBusy(false);
    }
  }

  function setDigit(i: number, v: string) {
    const d = v.replace(/\D/g, '');
    setDigits((prev) => {
      const nextDigits = [...prev];
      if (d.length > 1) {
        // Paste: spread digits across the boxes.
        d.slice(0, OTP_LEN - i)
          .split('')
          .forEach((ch, j) => {
            nextDigits[i + j] = ch;
          });
        requestAnimationFrame(() =>
          digitRefs.current[Math.min(i + d.length, OTP_LEN - 1)]?.focus(),
        );
        return nextDigits;
      }
      nextDigits[i] = d;
      if (d) requestAnimationFrame(() => digitRefs.current[i + 1]?.focus());
      return nextDigits;
    });
  }

  function onDigitKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i]) digitRefs.current[i - 1]?.focus();
  }

  const masked = step.kind === 'otp' ? `+91 •••••• ${step.mobile.slice(-4)}` : '';
  const canResend = step.kind === 'otp' && secondsLeft === 0;

  return (
    <Card className="relative w-full max-w-md rounded-2xl border-slate-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">
          {step.kind === 'mobile' ? 'Sign in' : 'Verify your number'}
        </CardTitle>
        <CardDescription>
          {step.kind === 'mobile'
            ? 'Sign in with your registered mobile number.'
            : `Enter the 6-digit code sent to ${masked}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {step.kind === 'mobile' ? (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void requestOtp(mobile);
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="mobile">Mobile number</Label>
              <Input
                id="mobile"
                inputMode="tel"
                autoComplete="tel"
                placeholder="98765 43210"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Sending…' : 'Send code'}
            </Button>
          </form>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void verify();
            }}
          >
            <div className="grid gap-2">
              <Label id="otp-label">One-time code</Label>
              <div
                role="group"
                aria-labelledby="otp-label"
                className="flex justify-between gap-2"
                onPaste={(e) => {
                  e.preventDefault();
                  const text = e.clipboardData.getData('text').replace(/\D/g, '');
                  if (text) {
                    const first = digits.findIndex((d) => !d);
                    setDigit(first === -1 ? 0 : first, text);
                  }
                }}
              >
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      digitRefs.current[i] = el;
                    }}
                    aria-label={`Digit ${i + 1}`}
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    maxLength={OTP_LEN}
                    value={d}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => onDigitKeyDown(i, e)}
                    className="h-12 w-full min-w-0 rounded-lg border border-input bg-white text-center font-mono text-lg font-semibold transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30 focus:outline-none"
                  />
                ))}
              </div>
            </div>
            <Button type="submit" disabled={busy || code.length !== OTP_LEN} className="w-full">
              {busy ? 'Verifying…' : 'Sign in'}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                className="text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => setStep({ kind: 'mobile' })}
              >
                Change number
              </button>
              <button
                type="button"
                disabled={!canResend || busy}
                className="text-primary disabled:text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => void requestOtp(step.mobile)}
              >
                {canResend ? 'Resend code' : `Resend in ${secondsLeft}s`}
              </button>
            </div>
          </form>
        )}
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <p className="text-muted-foreground text-xs">
          Passwords are never used. Codes expire in a few minutes and are rate-limited.
        </p>
      </CardContent>
    </Card>
  );
}

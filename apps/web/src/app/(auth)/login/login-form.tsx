'use client';

import {
  ApiClientError,
  type AuthSessionResponse,
  type OtpRequestResponse,
  isValidE164India,
  mobileInput,
} from '@kbs/shared';
import { AlertCircle, ArrowRight, CheckCircle2, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clientApi } from '@/lib/client-api';
import { nextForRole } from '@/lib/session-paths';

type Step =
  | { kind: 'mobile' }
  | { kind: 'otp'; mobile: string; challengeId: string; resendAt: number; expiresAt: number };

const OTP_LEN = 6;

function otpStep(mobile: string, r: OtpRequestResponse): Step {
  return {
    kind: 'otp',
    mobile,
    challengeId: r.challengeId,
    resendAt: Date.now() + r.resendAfterSec * 1000,
    expiresAt: Date.now() + r.expiresInSec * 1000,
  };
}

/** The resend wait for one number: until when, and out of how many seconds (for the progress bar). */
const waitFor = (mobile: string, seconds: number, totalSec: number) => ({ mobile, until: Date.now() + seconds * 1000, totalSec });

/** F-801: OTP-only login (REQ-04 §4.1). Same UI whether or not the number exists (REQ-23 §23.1). */
export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: 'mobile' });
  const [mobile, setMobile] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(OTP_LEN).fill(''));
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Resend wait: the server allows one code per number per cooldown. `wait` remembers which number is waiting and until
  // when, so the countdown is live on both steps (also after "Change number" and back) and the button re-enables itself.
  const [wait, setWait] = useState<{ mobile: string; until: number; totalSec: number } | null>(null);
  const [tick, setTick] = useState(0); // seconds left for `wait`, refreshed by the interval (render stays pure)
  useEffect(() => {
    if (!wait) return;
    const compute = () => Math.max(0, Math.ceil((wait.until - Date.now()) / 1000));
    const t = setInterval(() => setTick(compute()), 250);
    return () => clearInterval(t);
  }, [wait]);
  const activeMobile = step.kind === 'otp' ? step.mobile : mobile;
  const secondsLeft = wait && wait.mobile === activeMobile ? tick : 0;
  const waitPct = wait && secondsLeft > 0 ? Math.min(100, (secondsLeft / Math.max(1, wait.totalSec)) * 100) : 0;
  const clock = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;

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
      setWait(waitFor(m, r.data.resendAfterSec, r.data.resendAfterSec));
      setTick(r.data.resendAfterSec);
      setDigits(Array(OTP_LEN).fill(''));
      requestAnimationFrame(() => digitRefs.current[0]?.focus());
    } catch (e) {
      // a code was sent to this number moments ago: show the live wait instead of an error
      const d = e instanceof ApiClientError && e.error.code === 'AUTH_OTP_RESEND_TOO_SOON' ? (e.error.details as { retryAfterSec?: number; cooldownSec?: number } | undefined) : undefined;
      if (d?.retryAfterSec) {
        setWait(waitFor(m, d.retryAfterSec, d.cooldownSec ?? d.retryAfterSec));
        setTick(d.retryAfterSec);
      } else setError(e instanceof ApiClientError ? e.message : 'Could not send the code. Try again.');
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
      // F-804: return to the page the session ended on, but only inside the user's own area (no open redirect)
      router.replace(nextForRole(next, r.data.user.role));
      router.refresh();
    } catch (e) {
      // F-801: Telecaller / Advisor accounts use the Android app — show the role-aware access screen, not a form error
      if (e instanceof ApiClientError && e.error.code === 'AUTH_PLATFORM_NOT_ALLOWED') {
        router.replace('/access-denied?reason=mobile-app');
        return;
      }
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
  const mobileValid = isValidE164India(mobile);

  return (
    <Card className="relative w-full max-w-md gap-0 overflow-hidden rounded-2xl border border-border-subtle bg-card py-0 shadow-pop">
      <CardHeader className="px-8 pt-8 pb-5">
        <CardTitle className="text-[28px] leading-9 font-medium text-foreground">
          {step.kind === 'mobile' ? 'Sign in' : 'Check your phone'}
        </CardTitle>
        <CardDescription className="text-sm leading-5">
          {step.kind === 'mobile'
            ? 'We send a one-time code to the mobile number registered with KBS'
            : `Enter the 6-digit code sent to ${masked}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 px-8 pb-8">
        {step.kind === 'mobile' ? (
          <form
            className="grid gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              void requestOtp(mobile);
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="mobile" className="text-ui font-medium text-fg-2">
                Mobile number
              </Label>
              <div className="relative">
                <Phone className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-fg-3" strokeWidth={1.5} aria-hidden="true" />
                <Input
                  id="mobile"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="98765 43210"
                  value={mobile}
                  onChange={(e) => setMobile(mobileInput(e.target.value))}
                  autoFocus
                  className="h-12 rounded-md border-border bg-surface-muted pr-11 pl-10 text-[15px] tabular-nums transition-colors focus:border-ring focus:bg-card"
                />
                {mobileValid ? (
                  <CheckCircle2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-success" strokeWidth={1.5} aria-hidden="true" />
                ) : null}
              </div>
              <p className="text-xs text-fg-3">Enter your registered mobile number</p>
            </div>
            <Button type="submit" size="lg" disabled={busy || !mobileValid || secondsLeft > 0} className="h-12 w-full tabular-nums">
              {busy ? 'Sending…' : secondsLeft > 0 ? `Send OTP in ${clock}` : 'Send OTP'}
              <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
            </Button>
            {secondsLeft > 0 ? (
              <div className="grid gap-2" role="status" aria-live="polite">
                <div className="h-1 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-linear" style={{ width: `${waitPct}%` }} />
                </div>
                <p className="text-xs text-fg-3">A code was just sent to this number. You can request a new one when the timer ends.</p>
              </div>
            ) : null}
          </form>
        ) : (
          <form
            className="grid gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              void verify();
            }}
          >
            <div className="grid gap-2">
              <Label id="otp-label" className="text-ui font-medium text-fg-2">
                One-time code
              </Label>
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
                    className={`h-12 w-full min-w-0 rounded-md border bg-surface-muted text-center font-mono text-lg font-medium text-foreground transition-colors focus:border-ring focus:bg-card focus:ring-[3px] focus:ring-ring/20 focus:outline-none ${
                      d ? 'border-border-strong' : 'border-border'
                    }`}
                  />
                ))}
              </div>
            </div>
            <Button type="submit" size="lg" disabled={busy || code.length !== OTP_LEN} className="h-12 w-full">
              {busy ? 'Verifying…' : 'Verify and sign in'}
              <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
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
                className="font-medium text-foreground tabular-nums underline-offset-4 hover:underline disabled:text-fg-3"
                onClick={() => void requestOtp(step.mobile)}
              >
                {canResend ? 'Resend code' : `Resend in ${clock}`}
              </button>
            </div>
            {canResend ? null : (
              <div className="h-1 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-linear" style={{ width: `${waitPct}%` }} />
              </div>
            )}
          </form>
        )}
        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            {error}
          </p>
        ) : null}
        <p className="border-t border-border-subtle pt-5 text-xs text-muted-foreground">
          Need access? Ask your <span className="font-medium text-foreground">KBS administrator</span> to add your number
        </p>
      </CardContent>
    </Card>
  );
}

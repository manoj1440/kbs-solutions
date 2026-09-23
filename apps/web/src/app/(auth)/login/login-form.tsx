'use client';

import {
  ApiClientError,
  type AuthSessionResponse,
  type OtpRequestResponse,
  isValidE164India,
  mobileInput,
} from '@kbs/shared';
import { AlertCircle, ArrowRight, CheckCircle2, Lock, Phone } from 'lucide-react';
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

function otpStep(mobile: string, r: OtpRequestResponse): Step {
  return {
    kind: 'otp',
    mobile,
    challengeId: r.challengeId,
    resendAt: Date.now() + r.resendAfterSec * 1000,
    expiresAt: Date.now() + r.expiresInSec * 1000,
  };
}

/** F-801: OTP-only login (REQ-04 §4.1). Same UI whether or not the number exists (REQ-23 §23.1). */
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
    <Card className="relative w-full max-w-md gap-0 overflow-hidden rounded-[28px] border-0 bg-white py-0 shadow-[0_30px_80px_-30px_rgba(13,60,70,0.35)]">
      <CardHeader className="px-8 pt-8 pb-5">
        <CardTitle className="text-[28px] font-bold tracking-tight text-slate-900">
          {step.kind === 'mobile' ? 'Welcome back!' : 'Check your phone'}
        </CardTitle>
        <CardDescription className="text-[15px] leading-6">
          {step.kind === 'mobile'
            ? 'Sign in to your KBS workspace and continue making opportunities happen.'
            : `Enter the 6-digit code sent to ${masked}.`}
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
              <Label htmlFor="mobile" className="text-[13px] font-medium text-slate-700">
                Mobile number
              </Label>
              <div className="relative">
                <Phone className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-400" />
                <Input
                  id="mobile"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="98765 43210"
                  value={mobile}
                  onChange={(e) => setMobile(mobileInput(e.target.value))}
                  autoFocus
                  className="h-14 rounded-2xl border-slate-200 bg-slate-50/50 pr-12 pl-12 text-[15px] tracking-wide transition-colors focus:border-teal-600 focus:bg-white"
                />
                {mobileValid ? (
                  <CheckCircle2 className="absolute top-1/2 right-4 size-5 -translate-y-1/2 text-emerald-500" />
                ) : null}
              </div>
              <p className="text-xs text-slate-400">Enter your registered mobile number</p>
            </div>
            <Button
              type="submit"
              disabled={busy || !mobileValid}
              className="relative h-14 w-full rounded-full bg-gradient-to-r from-teal-700 to-teal-500 text-base font-semibold text-white shadow-lg shadow-teal-600/30 transition-all hover:from-teal-600 hover:to-teal-400 hover:shadow-teal-500/40 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
            >
              {busy ? 'Sending…' : 'Send OTP'}
              <span className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20">
                <ArrowRight className="size-5" />
              </span>
            </Button>
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
              <Label id="otp-label" className="text-[13px] font-medium text-slate-700">
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
                    className={`h-14 w-full min-w-0 rounded-xl border-2 bg-slate-50/50 text-center font-mono text-xl font-bold transition-all focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-600/15 focus:outline-none ${
                      d ? 'border-teal-600/60 text-teal-900' : 'border-slate-200 text-slate-900'
                    }`}
                  />
                ))}
              </div>
            </div>
            <Button
              type="submit"
              disabled={busy || code.length !== OTP_LEN}
              className="relative h-14 w-full rounded-full bg-gradient-to-r from-teal-700 to-teal-500 text-base font-semibold text-white shadow-lg shadow-teal-600/30 transition-all hover:from-teal-600 hover:to-teal-400 hover:shadow-teal-500/40 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
            >
              {busy ? 'Verifying…' : 'Verify & Sign in'}
              <span className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20">
                <ArrowRight className="size-5" />
              </span>
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
                className="font-medium text-teal-700 underline-offset-4 hover:underline disabled:text-slate-400"
                onClick={() => void requestOtp(step.mobile)}
              >
                {canResend ? 'Resend code' : `Resend in ${secondsLeft}s`}
              </button>
            </div>
          </form>
        )}
        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        ) : null}
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-[11px] font-medium tracking-widest text-slate-400">OR</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="flex items-center gap-3.5 rounded-2xl border border-teal-100 bg-teal-50/80 p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-600/10">
            <Lock className="size-5 text-teal-700" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-800">Secure & Private</span>
            <span className="block text-xs text-slate-500">
              Your data is encrypted and never shared.
            </span>
          </span>
        </div>
        <p className="text-center text-xs text-slate-500">
          Need access? Contact your <span className="font-semibold text-teal-800">KBS administrator</span>.
        </p>
      </CardContent>
    </Card>
  );
}

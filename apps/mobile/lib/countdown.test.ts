import { describe, expect, it } from 'vitest';

import { clock, resendWait } from './countdown';

describe('OTP resend wait', () => {
  it('formats the countdown as m:ss', () => {
    expect(clock(60)).toBe('1:00');
    expect(clock(42)).toBe('0:42');
    expect(clock(5)).toBe('0:05');
    expect(clock(0)).toBe('0:00');
  });
  it('reads the wait from AUTH_OTP_RESEND_TOO_SOON and ignores every other error', () => {
    expect(resendWait({ error: { code: 'AUTH_OTP_RESEND_TOO_SOON', details: { retryAfterSec: 37, cooldownSec: 60 } } })).toEqual({ seconds: 37, total: 60 });
    expect(resendWait({ error: { code: 'AUTH_OTP_RESEND_TOO_SOON', details: { retryAfterSec: 12 } } })).toEqual({ seconds: 12, total: 12 });
    expect(resendWait({ error: { code: 'AUTH_OTP_RESEND_TOO_SOON' } })).toBeNull(); // older API without the details
    expect(resendWait({ error: { code: 'AUTH_OTP_RATE_LIMITED', details: { retryAfterSec: 9 } } })).toBeNull();
    expect(resendWait(new Error('network'))).toBeNull();
  });
});

import { maskMobile } from '@kbs/shared';
import { Logger } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import type { OtpProvider } from '../ports';

export interface Msg91Config {
  /** API host only (no scheme, no path). */
  host: string;
  authKey: string;
  /** MSG91 SMS template id (the DLT template id and the sender id are registered against it inside MSG91). */
  templateId: string;
  /** DLT-registered header (sender id) the template was approved under. */
  senderId: string;
  /** Name of the template variable that carries the code — `##VAR1##` in the MSG91 template. Case-sensitive. */
  otpVariable: string;
  timeoutMs?: number;
}

export const MSG91_TIMEOUT_MS = 10_000;

/** What the client sees for every send failure: nothing about the provider, the template or the reason. */
const sendFailed = () => new AppError('INTERNAL', 'We could not send the code. Please try again in a moment.', undefined, 'RETRY_LATER');

/** Provider text is only ever logged, and never with anything that could be a mobile number or a code. */
const scrub = (s: string) => s.replace(/\d{4,}/g, '••••').slice(0, 160);

/**
 * MSG91 transactional SMS ("Send SMS", `POST /api/v5/flow`). KBS generates the code and passes it as a template variable;
 * MSG91 only delivers the text. MSG91's own SendOTP / Verify OTP product is deliberately not used: the hashed challenge,
 * expiry, attempt limit and lock in the auth module stay the single source of truth.
 *
 * One attempt per call, no retry — the user has a Resend button with a cooldown. Never logs the code, the full mobile
 * number or the auth key. `accepted` means MSG91 queued the message, not that the handset received it (INV-10).
 */
export class Msg91OtpAdapter implements OtpProvider {
  readonly name = 'msg91';
  private readonly logger = new Logger('OTP');
  constructor(private readonly cfg: Msg91Config) {}

  async send(mobileE164: string, code: string) {
    const masked = maskMobile(mobileE164);
    const digits = mobileE164.replace(/\D/g, '');
    const mobiles = digits.length === 10 ? `91${digits}` : digits; // MSG91 wants country code + number, no "+"
    if (!/^91[6-9]\d{9}$/.test(mobiles)) {
      this.logger.warn(`[msg91] not sent to ${masked}: not an Indian mobile number`);
      throw sendFailed();
    }

    const timeoutMs = this.cfg.timeoutMs ?? MSG91_TIMEOUT_MS;
    const signal = AbortSignal.timeout(timeoutMs);
    let res: Response;
    let text: string;
    try {
      res = await fetch(`https://${this.cfg.host}/api/v5/flow`, {
        method: 'POST',
        headers: { authkey: this.cfg.authKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ template_id: this.cfg.templateId, sender: this.cfg.senderId, short_url: '0', recipients: [{ mobiles, [this.cfg.otpVariable]: code }] }),
        signal,
      });
      text = await res.text();
    } catch (e) {
      const name = e instanceof Error ? e.name : 'Error';
      // never log the error message itself: fetch errors can echo the request
      this.logger.error(`[msg91] not sent to ${masked}: ${signal.aborted ? `no answer within ${timeoutMs} ms` : `network error (${name})`}`);
      throw sendFailed();
    }

    let type: string | undefined;
    let message: string | undefined;
    try {
      const j = JSON.parse(text) as { type?: unknown; message?: unknown };
      type = typeof j.type === 'string' ? j.type : undefined;
      message = typeof j.message === 'string' ? j.message : undefined;
    } catch {
      /* not JSON — treated as a failure below */
    }
    // MSG91 answers some failures with HTTP 200 and `type: "error"`, so both the status and the body must say success
    if (!res.ok || type !== 'success' || !message) {
      const hint = res.status === 401 ? ' (check MSG91_AUTH_KEY)' : '';
      this.logger.error(`[msg91] not sent to ${masked}: HTTP ${res.status}${message ? ` — ${scrub(message)}` : ''}${hint}`);
      throw sendFailed();
    }
    // the success `message` is MSG91's request id (hex); anything else is not logged
    this.logger.log(`[msg91] accepted for ${masked} (request ${/^[a-f0-9]{16,64}$/i.test(message) ? message : 'id not recognised'})`);
    return { accepted: true, providerRef: message };
  }
}

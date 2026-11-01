import { timingSafeEqual } from 'node:crypto';

import type { TelephonyEvent, TelephonyProvider } from '../ports';

export interface ExotelConfig {
  host: string;
  accountSid: string;
  apiKey: string;
  apiToken: string;
  callerId: string;
  webhookToken: string;
}

/** Exotel status-callback body (StatusCallbackContentType=application/json, events `answered` + `terminal`). */
interface ExotelCallback {
  CallSid?: string;
  Status?: string;
  EventType?: string;
  DateUpdated?: string;
  StartTime?: string;
  EndTime?: string;
  ConversationDuration?: number | string;
  RecordingUrl?: string | null;
  Legs?: Array<{ Status?: string | null; OnCallDuration?: number | string }>;
}

const parseDate = (v?: string) => {
  const d = v ? new Date(v.includes('T') ? v : `${v.replace(' ', 'T')}+05:30`) : null; // Exotel sends IST "YYYY-MM-DD HH:mm:ss"
  return d && !Number.isNaN(d.getTime()) ? d : new Date();
};

/**
 * Exotel "Connect Two Numbers" (`POST /v1/Accounts/{sid}/Calls/connect`): rings the Telecaller's own phone first, then the
 * customer, with Exotel recording the bridged call. Status callbacks carry `answered` and `terminal` events; the callback URL
 * holds a secret token because Exotel does not sign callbacks. Recordings are downloaded into KBS storage by the calls service.
 */
export class ExotelTelephonyAdapter implements TelephonyProvider {
  readonly name = 'exotel';
  constructor(private readonly cfg: ExotelConfig) {}

  private get auth() {
    return `Basic ${Buffer.from(`${this.cfg.apiKey}:${this.cfg.apiToken}`).toString('base64')}`;
  }

  async initiateCall(input: { fromUserId: string; fromMobileE164: string; toMobileE164: string; callbackUrl: string }) {
    const form = new URLSearchParams({
      From: input.fromMobileE164,
      To: input.toMobileE164,
      CallerId: this.cfg.callerId,
      Record: 'true',
      StatusCallback: `${input.callbackUrl}?token=${encodeURIComponent(this.cfg.webhookToken)}`,
      StatusCallbackContentType: 'application/json',
    });
    form.append('StatusCallbackEvents[0]', 'answered');
    form.append('StatusCallbackEvents[1]', 'terminal');
    const res = await fetch(`https://${this.cfg.host}/v1/Accounts/${this.cfg.accountSid}/Calls/connect.json`, {
      method: 'POST',
      headers: { authorization: this.auth, 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: form,
    });
    const text = await res.text();
    let sid: string | undefined;
    let message: string | undefined;
    try {
      const j = JSON.parse(text) as { Call?: { Sid?: string }; RestException?: { Message?: string } };
      sid = j.Call?.Sid;
      message = j.RestException?.Message;
    } catch {
      sid = /<Sid>([^<]+)<\/Sid>/.exec(text)?.[1]; // XML when the account ignores the .json suffix
      message = /<Message>([^<]+)<\/Message>/.exec(text)?.[1];
    }
    // 401 almost always means the account lives on the other region's host (api.exotel.com vs api.in.exotel.com)
    const hint = res.status === 401 ? ` (check EXOTEL_HOST — this account may be on the other region than ${this.cfg.host})` : '';
    if (!res.ok || !sid) return { providerCallId: sid ?? '', state: 'FAILED' as const, reason: `EXOTEL_${res.status}${message ? `: ${message.slice(0, 160)}` : ''}${hint}` };
    return { providerCallId: sid, state: 'REQUESTED' as const };
  }

  parseWebhook(_headers: Record<string, string | string[] | undefined>, body: unknown, query?: Record<string, unknown>): TelephonyEvent[] {
    const token = String(query?.token ?? '');
    const a = Buffer.from(token);
    const b = Buffer.from(this.cfg.webhookToken);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('EXOTEL_WEBHOOK_UNAUTHENTICATED');
    const cb = (body ?? {}) as ExotelCallback;
    if (!cb.CallSid) return [];
    const id = cb.CallSid;
    if (cb.EventType === 'answered') return [{ providerCallId: id, type: 'CONNECTED', at: parseDate(cb.StartTime ?? cb.DateUpdated) }];
    // terminal (or a plain status callback without EventType)
    const at = parseDate(cb.EndTime ?? cb.DateUpdated);
    const talk = Number(cb.ConversationDuration ?? 0) || 0;
    const status = (cb.Status ?? '').toLowerCase();
    // the customer leg answered → the conversation happened, whatever the overall status says
    const customerLeg = cb.Legs?.[1];
    if (talk > 0 || (status === 'completed' && customerLeg?.Status === 'completed')) {
      const events: TelephonyEvent[] = [
        { providerCallId: id, type: 'CONNECTED', at: parseDate(cb.StartTime ?? cb.DateUpdated) }, // idempotent if `answered` already came
        { providerCallId: id, type: 'ENDED', at, durationSec: talk },
      ];
      events.push(cb.RecordingUrl ? { providerCallId: id, type: 'RECORDING_AVAILABLE', at, recordingRef: cb.RecordingUrl, durationSec: talk } : { providerCallId: id, type: 'RECORDING_FAILED', at, reason: 'EXOTEL_NO_RECORDING_URL' });
      return events;
    }
    if (status === 'failed') return [{ providerCallId: id, type: 'FAILED', at, reason: 'EXOTEL_FAILED' }];
    // busy / no-answer / canceled, or the Telecaller's own phone was not answered
    const who = cb.Legs?.[0]?.Status && cb.Legs[0].Status !== 'completed' ? 'agent phone' : 'customer';
    return [{ providerCallId: id, type: 'NO_ANSWER', at, reason: `EXOTEL_${(status || 'no-answer').toUpperCase()} (${who})` }];
  }

  async fetchRecording(recordingRef: string) {
    const url = new URL(recordingRef);
    // Exotel-hosted links need the account credentials; pre-signed S3 links must not get them
    const headers: Record<string, string> = url.hostname.endsWith('exotel.com') || url.hostname.endsWith('exotel.in') ? { authorization: this.auth } : {};
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`EXOTEL_RECORDING_${res.status}`);
    return { body: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') ?? 'audio/mpeg' };
  }
}

import { ExotelTelephonyAdapter } from './exotel-telephony.adapter';

const cfg = { host: 'api.exotel.com', accountSid: 'kbs1', apiKey: 'key', apiToken: 'tok', callerId: '08012345678', webhookToken: 'secret-123' };
const ok = { token: 'secret-123' };

describe('ExotelTelephonyAdapter', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('click-to-call: Telecaller phone first, customer second, recording + answered/terminal callbacks with the secret token', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    global.fetch = jest.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ Call: { Sid: 'abc123', Status: 'in-progress' } }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await new ExotelTelephonyAdapter(cfg).initiateCall({ fromUserId: 'u', fromMobileE164: '+919800000001', toMobileE164: '+919800000002', callbackUrl: 'https://api.kbs/api/v1/webhooks/telephony/exotel' });
    expect(r).toEqual({ providerCallId: 'abc123', state: 'REQUESTED' });
    expect(calls[0]?.url).toBe('https://api.exotel.com/v1/Accounts/kbs1/Calls/connect.json');
    expect((calls[0]?.init.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from('key:tok').toString('base64')}`);
    const form = new URLSearchParams(String(calls[0]?.init.body));
    expect(Object.fromEntries(form)).toMatchObject({ From: '+919800000001', To: '+919800000002', CallerId: '08012345678', Record: 'true', StatusCallbackContentType: 'application/json', 'StatusCallbackEvents[0]': 'answered', 'StatusCallbackEvents[1]': 'terminal' });
    expect(form.get('StatusCallback')).toBe('https://api.kbs/api/v1/webhooks/telephony/exotel?token=secret-123');
  });

  it('provider error → FAILED with the message (no call id)', async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ RestException: { Status: 400, Message: 'To number is not whitelisted' } }), { status: 400 })) as unknown as typeof fetch;
    const r = await new ExotelTelephonyAdapter(cfg).initiateCall({ fromUserId: 'u', fromMobileE164: '+91a', toMobileE164: '+91b', callbackUrl: 'x' });
    expect(r.state).toBe('FAILED');
    expect(r.reason).toContain('not whitelisted');
  });

  it('refuses callbacks without the secret token', () => {
    const a = new ExotelTelephonyAdapter(cfg);
    expect(() => a.parseWebhook({}, { CallSid: 'c', Status: 'completed' }, {})).toThrow('UNAUTHENTICATED');
    expect(() => a.parseWebhook({}, { CallSid: 'c', Status: 'completed' }, { token: 'secret-12X' })).toThrow('UNAUTHENTICATED');
  });

  it('answered → CONNECTED; completed with talk time → CONNECTED, ENDED(duration), RECORDING_AVAILABLE', () => {
    const a = new ExotelTelephonyAdapter(cfg);
    expect(a.parseWebhook({}, { CallSid: 'c', EventType: 'answered', StartTime: '2026-11-01 10:00:00' }, ok)).toEqual([{ providerCallId: 'c', type: 'CONNECTED', at: new Date('2026-11-01T04:30:00Z') }]);
    const ev = a.parseWebhook({}, { CallSid: 'c', EventType: 'terminal', Status: 'completed', StartTime: '2026-11-01 10:00:00', EndTime: '2026-11-01 10:01:30', ConversationDuration: 75, RecordingUrl: 'https://s3.example/rec.mp3', Legs: [{ Status: 'completed' }, { Status: 'completed' }] }, ok);
    expect(ev.map((e) => e.type)).toEqual(['CONNECTED', 'ENDED', 'RECORDING_AVAILABLE']);
    expect(ev[1]).toMatchObject({ durationSec: 75 });
    expect(ev[2]).toMatchObject({ recordingRef: 'https://s3.example/rec.mp3' });
  });

  it('customer did not pick up / agent phone not answered / failed', () => {
    const a = new ExotelTelephonyAdapter(cfg);
    expect(a.parseWebhook({}, { CallSid: 'c', Status: 'no-answer', ConversationDuration: 0, Legs: [{ Status: 'completed' }, { Status: 'no-answer' }] }, ok)).toEqual([expect.objectContaining({ type: 'NO_ANSWER', reason: 'EXOTEL_NO-ANSWER (customer)' })]);
    expect(a.parseWebhook({}, { CallSid: 'c', Status: 'busy', Legs: [{ Status: 'busy' }, { Status: null }] }, ok)).toEqual([expect.objectContaining({ type: 'NO_ANSWER', reason: 'EXOTEL_BUSY (agent phone)' })]);
    expect(a.parseWebhook({}, { CallSid: 'c', Status: 'failed' }, ok)).toEqual([expect.objectContaining({ type: 'FAILED' })]);
  });

  it('recording download: credentials only for Exotel-hosted links', async () => {
    const seen: Array<Record<string, string>> = [];
    global.fetch = jest.fn(async (_u: URL, init: RequestInit) => {
      seen.push((init.headers ?? {}) as Record<string, string>);
      return new Response(Buffer.from('ID3audio'), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
    }) as unknown as typeof fetch;
    const a = new ExotelTelephonyAdapter(cfg);
    const r = await a.fetchRecording('https://recordings.exotel.com/kbs1/abc.mp3');
    await a.fetchRecording('https://bucket.s3.amazonaws.com/abc.mp3?X-Amz-Signature=x');
    expect(r.body.toString()).toBe('ID3audio');
    expect(seen[0]?.authorization).toMatch(/^Basic /);
    expect(seen[1]?.authorization).toBeUndefined();
  });
});

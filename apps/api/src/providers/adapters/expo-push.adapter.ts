import type { PushProvider } from '../ports';

/**
 * F-701 Expo push adapter (https://docs.expo.dev/push-notifications/sending-notifications/). Sends title/body plus a
 * deep-link data payload; bodies are scrubbed of PAN/account/mobile before they reach here (NotificationsService).
 * REQ-19 §19.2: the push provider is OPEN — this adapter is selected only with PUSH_PROVIDER=expo.
 */
export class ExpoPushAdapter implements PushProvider {
  readonly name = 'expo';
  constructor(
    private readonly accessToken?: string,
    private readonly endpoint = 'https://exp.host/--/api/v2/push/send',
  ) {}

  async send(input: { token: string; title: string; body: string; data?: Record<string, string> }) {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', ...(this.accessToken ? { authorization: `Bearer ${this.accessToken}` } : {}) },
      body: JSON.stringify({ to: input.token, title: input.title, body: input.body, data: input.data ?? {}, sound: 'default' }),
    });
    if (!res.ok) return { accepted: false };
    const json = (await res.json().catch(() => null)) as { data?: { status?: string } } | null;
    return { accepted: json?.data?.status === 'ok' };
  }
}

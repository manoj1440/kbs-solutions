import type { PushProvider } from '../ports';

export class MockPushAdapter implements PushProvider {
  readonly name = 'mock';
  readonly sent: Array<{ token: string; title: string }> = [];
  async send(input: { token: string; title: string; body: string }) {
    this.sent.push({ token: input.token, title: input.title });
    return { accepted: true };
  }
}

import { PAN_REGEX } from '@kbs/shared';

import type { PanVerificationProvider } from '../ports';

export class MockPanAdapter implements PanVerificationProvider {
  readonly name = 'mock';
  async verify(input: { pan: string; name?: string }) {
    if (!PAN_REGEX.test(input.pan)) return { status: 'FAILED' as const, providerRef: null };
    if (input.pan.startsWith('ZZZZZ')) return { status: 'UNAVAILABLE' as const, providerRef: null };
    if (input.pan.startsWith('MMMMM')) return { status: 'MISMATCH' as const, providerRef: `mock-pan-${input.pan.slice(-4)}` };
    return { status: 'VERIFIED' as const, providerRef: `mock-pan-${input.pan.slice(-4)}` };
  }
}

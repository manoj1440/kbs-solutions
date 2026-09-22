import type { WhatsAppProvider } from '../ports';

/** Opens the WhatsApp compose sheet via wa.me. Delivery can never be confirmed (REQ-08 §8.5). */
export class HandoffWhatsAppAdapter implements WhatsAppProvider {
  readonly name = 'handoff';
  readonly mode = 'HANDOFF' as const;
  async prepare(input: { toMobileE164: string; text: string; mediaUrl?: string }) {
    const text = input.mediaUrl ? `${input.text}\n${input.mediaUrl}` : input.text;
    const digits = input.toMobileE164.replace(/\D/g, '');
    return { handoffUrl: `https://wa.me/${digits}?text=${encodeURIComponent(text)}`, confirmedSent: false };
  }
}

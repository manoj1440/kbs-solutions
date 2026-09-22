/** Crockford base32 alphabet (no I, L, O, U) for unambiguous human-readable references (ADR-012). */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const RefPrefix = {
  USER: 'KBS-U-',
  TELECALLER_CODE: 'KBS-TC-',
  LEAD: 'KBS-L-',
  PAYOUT_REQUEST: 'KBS-PR-',
  IMPORT_BATCH: 'KBS-B-',
} as const;
export type RefPrefix = (typeof RefPrefix)[keyof typeof RefPrefix];

function randomBytes(length: number): Uint8Array {
  // Web Crypto is available in Node 22, browsers and Hermes (React Native); no node:crypto import so the
  // package stays portable across API, web and mobile.
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (!c?.getRandomValues) throw new Error('crypto.getRandomValues is not available');
  return c.getRandomValues(new Uint8Array(length));
}

export function makePublicRef(prefix: RefPrefix, length = 8): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[(bytes[i] as number) % 32];
  return `${prefix}${out}`;
}

export function isPublicRef(value: string, prefix?: RefPrefix): boolean {
  const re = new RegExp(`^${(prefix ?? 'KBS-[A-Z]{1,3}-').replace(/-/g, '\\-')}[0-9A-HJKMNP-TV-Z]{8}$`);
  return re.test(value);
}

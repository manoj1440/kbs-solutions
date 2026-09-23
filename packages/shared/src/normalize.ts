export class NormalizationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
    this.name = 'NormalizationError';
  }
}

/** Indian mobile → E.164 (+91XXXXXXXXXX). Accepts 10 digits, 0-prefixed, 91-prefixed, +91. */
export function toE164India(input: string | number): string {
  if (typeof input !== 'string') throw new NormalizationError('mobile', 'mobile must be text');
  let d = input.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('0') && d.length === 11) d = d.slice(1);
  if (d.startsWith('91') && d.length === 12) d = d.slice(2);
  if (!/^[6-9]\d{9}$/.test(d)) throw new NormalizationError('mobile', 'invalid Indian mobile number');
  return `+91${d}`;
}

export function isValidE164India(input: string): boolean {
  try {
    toE164India(input);
    return true;
  } catch {
    return false;
  }
}

/** Pincode is ALWAYS a 6-character string; leading zeros preserved (REQ-07 §7.3). Numbers are rejected. */
export function normalizePincode(input: unknown, opts: { padNumeric?: boolean } = {}): string {
  if (typeof input === 'number') {
    if (!opts.padNumeric) throw new NormalizationError('pincode', 'pincode must be text, not a number');
    if (!Number.isInteger(input) || input < 0 || input > 999999) {
      throw new NormalizationError('pincode', 'numeric pincode out of range');
    }
    return String(input).padStart(6, '0');
  }
  if (typeof input !== 'string') throw new NormalizationError('pincode', 'pincode must be text');
  const t = input.trim();
  if (!/^\d{6}$/.test(t)) throw new NormalizationError('pincode', 'pincode must be exactly 6 digits');
  return t;
}

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function normalizePan(input: string): string {
  const p = input.replace(/\s/g, '').toUpperCase();
  if (!PAN_REGEX.test(p)) throw new NormalizationError('pan', 'invalid PAN format');
  return p;
}

export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function normalizeIfsc(input: string): string {
  const i = input.replace(/\s/g, '').toUpperCase();
  if (!IFSC_REGEX.test(i)) throw new NormalizationError('ifsc', 'invalid IFSC format');
  return i;
}

/** Bank references are stored exactly; only leading/trailing whitespace is removed (REQ-13 §13.5). */
export function normalizeBankReference(input: string): string {
  const t = input.trim();
  if (!t) throw new NormalizationError('reference', 'reference is empty');
  return t;
}

// ── Typing-time input masks ─────────────────────────────────────────────
// Invalid characters never reach field state; the Zod schemas still validate on submit.

/** Digits only, optionally capped. */
export const digitsOnly = (v: string, max?: number): string => {
  const d = v.replace(/\D/g, '');
  return max ? d.slice(0, max) : d;
};

/** Mobile field: ≤12 digits so a pasted 91- or 0-prefix still normalises via toE164India. */
export const mobileInput = (v: string): string => digitsOnly(v, 12);

/** PAN field: uppercase alphanumerics, ≤10 (ABCDE1234F). */
export const panInput = (v: string): string => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

/** IFSC field: uppercase alphanumerics, ≤11. */
export const ifscInput = (v: string): string => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);

/** Agent code field: uppercase alphanumerics, ≤12. */
export const agentCodeInput = (v: string): string => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

/** Amount field: digits with at most one decimal point. */
export const amountInput = (v: string): string => {
  const d = v.replace(/[^\d.]/g, '');
  const dot = d.indexOf('.');
  return dot === -1 ? d : `${d.slice(0, dot + 1)}${d.slice(dot + 1).replace(/\./g, '')}`;
};

/** Tolerant header comparison for import mapping (raw header itself is always stored as seen). */
export function headerKey(header: string): string {
  return header.replace(/\s+/g, ' ').trim().toLowerCase();
}

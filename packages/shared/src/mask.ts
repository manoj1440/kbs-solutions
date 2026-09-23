/** Masking helpers. Defaults for every DTO; full values only via audited reveal endpoints. */
export function maskMobile(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const digits = e164.replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  const last = digits.slice(-4);
  if (e164.startsWith('+91') && digits.length === 12) return `+91••••••${last}`;
  return `${'•'.repeat(Math.max(2, digits.length - 4))}${last}`;
}

export function maskPan(pan: string | null | undefined): string | null {
  if (!pan) return null;
  const p = pan.trim().toUpperCase();
  if (p.length !== 10) return '•'.repeat(Math.max(0, p.length - 1)) + p.slice(-1);
  return `•••••${p.slice(5, 9)}${p.slice(9)}`;
}

export function maskAccount(account: string | null | undefined): string | null {
  if (!account) return null;
  const a = account.replace(/\s/g, '');
  return `${'•'.repeat(Math.max(0, a.length - 4))}${a.slice(-4)}`;
}

export function last4(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.replace(/\s/g, '');
  return v.slice(-4);
}

/** Customer name for previews where full PII must not be exposed (REQ-13 §13.4 step 3). */
export function maskName(name: string | null | undefined): string | null {
  if (!name) return null;
  const t = name.trim();
  if (!t) return null;
  return `${t[0]}${'•'.repeat(Math.min(6, Math.max(2, t.length - 1)))}`;
}

/**
 * F-701 / REQ-21 §21.1: strip PAN, long digit runs (account/Aadhaar-like) and Indian mobiles from free text that
 * leaves the system (notification titles/bodies, push). Keeps the last 4 digits so a human can still correlate.
 */
export function scrubSensitiveText(text: string): string {
  return text
    .replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi, (m) => maskPan(m) ?? '••••••••••')
    .replace(/(?:\+?91[\s-]?)?\b[6-9]\d{9}\b/g, (m) => `+91••••••${m.replace(/\D/g, '').slice(-4)}`)
    .replace(/\b\d[\d\s-]{7,}\d\b/g, (m) => {
      const d = m.replace(/\D/g, '');
      return d.length >= 9 ? `${'•'.repeat(Math.min(8, d.length - 4))}${d.slice(-4)}` : m;
    });
}

/** True when text still carries something that looks like PAN, a 9+ digit number or a full mobile (NOTIF-02 guard). */
export function containsSensitive(text: string): boolean {
  return /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i.test(text) || /(?<![\d•])[6-9]\d{9}(?!\d)/.test(text) || /(?<![\d•])\d{9,}(?!\d)/.test(text.replace(/[\s-]/g, ''));
}

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

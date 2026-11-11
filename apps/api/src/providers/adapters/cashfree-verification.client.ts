import { constants, publicEncrypt } from 'node:crypto';

/**
 * Shared HTTP plumbing for Cashfree Secure ID ("Verification APIs") — used by the PAN and DigiLocker adapters.
 * Documented at https://www.cashfree.com/docs/api-reference/vrs/getting-started (runbook 09 lists every page relied on).
 *
 * One attempt per call, no retry, 10 s timeout. Nothing here logs: callers log, and only ever the HTTP status and
 * Cashfree's machine-readable `code` — never a response `message` (it can echo the caller's IP or the input), a request
 * body, the client secret or the signature.
 */
export const CASHFREE_VERIFICATION_BASE_URL = {
  sandbox: 'https://sandbox.cashfree.com/verification',
  production: 'https://api.cashfree.com/verification',
} as const;
export type CashfreeVerificationEnv = keyof typeof CASHFREE_VERIFICATION_BASE_URL;

export const CASHFREE_TIMEOUT_MS = 10_000;

export interface CashfreeVerificationConfig {
  env: CashfreeVerificationEnv;
  clientId: string;
  clientSecret: string;
  /**
   * PEM public key downloaded from the Secure ID dashboard when the account's 2FA method is "Public Key". When set, every
   * request carries `x-cf-signature`. Leave unset when the 2FA method is "IP Whitelist" (Cashfree: do not send it then).
   */
  publicKeyPem?: string;
  timeoutMs?: number;
  /** Test seam: unix seconds used in the signature. */
  nowSec?: () => number;
}

export type CashfreeResult =
  | { kind: 'response'; status: number; body: Record<string, unknown> | null }
  | { kind: 'timeout'; timeoutMs: number }
  | { kind: 'network'; errorName: string };

/** Env values often carry the PEM on one line with literal `\n`. */
export const normalizePem = (pem: string) => pem.replace(/\\n/g, '\n').trim();

/**
 * 2FA signature, exactly as documented: `<clientId>.<current unix timestamp>` encrypted with the account's public key
 * using RSA-OAEP with SHA-1, then Base64. Valid for 5 minutes, so a fresh one is made for every request.
 */
export function cashfreeSignature(clientId: string, publicKeyPem: string, nowSec: number): string {
  return publicEncrypt(
    {
      key: normalizePem(publicKeyPem),
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha1',
    },
    Buffer.from(`${clientId}.${nowSec}`, 'utf8'),
  ).toString('base64');
}

export async function cashfreeRequest(
  cfg: CashfreeVerificationConfig,
  req: {
    method: 'GET' | 'POST';
    path: string;
    query?: Record<string, string>;
    body?: Record<string, unknown>;
    apiVersion?: string;
  },
): Promise<CashfreeResult> {
  const timeoutMs = cfg.timeoutMs ?? CASHFREE_TIMEOUT_MS;
  const signal = AbortSignal.timeout(timeoutMs);
  const qs = req.query ? `?${new URLSearchParams(req.query).toString()}` : '';
  const headers: Record<string, string> = {
    'x-client-id': cfg.clientId,
    'x-client-secret': cfg.clientSecret,
    accept: 'application/json',
  };
  if (req.body) headers['content-type'] = 'application/json';
  if (req.apiVersion) headers['x-api-version'] = req.apiVersion;
  try {
    if (cfg.publicKeyPem)
      headers['x-cf-signature'] = cashfreeSignature(
        cfg.clientId,
        cfg.publicKeyPem,
        cfg.nowSec?.() ?? Math.floor(Date.now() / 1000),
      );
    const res = await fetch(`${CASHFREE_VERIFICATION_BASE_URL[cfg.env]}${req.path}${qs}`, {
      method: req.method,
      headers,
      ...(req.body ? { body: JSON.stringify(req.body) } : {}),
      signal,
    });
    const text = await res.text();
    let body: Record<string, unknown> | null = null;
    try {
      const j: unknown = JSON.parse(text);
      if (j && typeof j === 'object' && !Array.isArray(j)) body = j as Record<string, unknown>;
    } catch {
      /* not JSON — the caller treats a missing body as a provider failure */
    }
    return { kind: 'response', status: res.status, body };
  } catch (e) {
    if (signal.aborted) return { kind: 'timeout', timeoutMs };
    // never surface the error message itself: fetch / crypto errors can echo the request or the key
    return { kind: 'network', errorName: e instanceof Error ? e.name : 'Error' };
  }
}

/** Cashfree's machine-readable error code (`ip_validation_failed`, `insufficient_balance`…). Anything else is not a code. */
export function cashfreeCode(body: Record<string, unknown> | null): string | null {
  const c = body?.code;
  return typeof c === 'string' && /^[A-Za-z][A-Za-z0-9_.-]{0,59}$/.test(c) ? c : null;
}

/** Cashfree's own reference id (int64). Only ever digits, so it can never carry a PAN or a name. */
export function cashfreeReferenceId(body: Record<string, unknown> | null): string | null {
  const r = body?.reference_id;
  if (typeof r === 'number' && Number.isSafeInteger(r) && r >= 0) return String(r);
  if (typeof r === 'string' && /^\d{1,20}$/.test(r)) return r;
  return null;
}

/** One log-safe phrase for a call that did not produce a usable answer. */
export function describeFailure(r: CashfreeResult): string {
  if (r.kind === 'timeout') return `no answer within ${r.timeoutMs} ms`;
  if (r.kind === 'network') return `network error (${r.errorName})`;
  const code = cashfreeCode(r.body);
  let hint = '';
  if (r.status === 401)
    hint = ' (check CASHFREE_VERIFICATION_CLIENT_ID / CASHFREE_VERIFICATION_CLIENT_SECRET)';
  else if (r.status === 403)
    hint =
      code === 'ip_validation_failed'
        ? ' (this host is not on the Secure ID IP whitelist — whitelist it or switch 2FA to Public Key and set CASHFREE_VERIFICATION_PUBLIC_KEY)'
        : ' (2FA: check the IP whitelist or CASHFREE_VERIFICATION_PUBLIC_KEY)';
  else if (r.status === 404 && !code)
    hint = ' (is this product activated on the Cashfree account?)';
  else if (code === 'insufficient_balance') hint = ' (recharge the Secure ID wallet)';
  else if (code === 'x-client-secret_value_invalid')
    hint = ' (keys and CASHFREE_VERIFICATION_ENV belong to different environments)';
  return `HTTP ${r.status}${code ? ` ${code}` : ''}${hint}`;
}

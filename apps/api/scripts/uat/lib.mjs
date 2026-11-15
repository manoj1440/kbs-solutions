/**
 * UAT driver helpers (DOCS/qa/uat-01-end-to-end-plan.md). Drives the real HTTP API of a locally running stack —
 * nothing in the API is stubbed. Local provider adapters (OTP console + dev master code, mock telephony / KYC / PAN)
 * are the ones configured in apps/api/.env.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ExcelJS from 'exceljs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const OUT = process.env.UAT_OUT ?? join(HERE, '.out');
mkdirSync(OUT, { recursive: true });
export const BASE = process.env.UAT_API_URL ?? 'http://localhost:4000/api/v1';
const PG = process.env.UAT_PG_CONTAINER ?? 'kbs-postgres-1';
const DB = process.env.UAT_DB ?? 'kbs_uat';
if (!/uat|e2e/.test(DB)) throw new Error(`refusing to run against database "${DB}" — UAT needs its own database`);
const OTP = process.env.UAT_OTP ?? '000000';
export const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082', 'hex');

// ── state shared between stages ──
const STATE_FILE = join(OUT, 'state.json');
export const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { users: {}, ids: {} };
export const save = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

// ── read-only SQL for cross-checks, and the one test-only write: clearing OTP cooldown rows ──
export function sql(q) {
  try {
    return execSync(`docker exec -i ${PG} psql -U kbs -d ${DB} -At -F '|' -v ON_ERROR_STOP=1`, { input: q, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
  } catch (e) {
    throw new Error(`SQL failed: ${String(e.stderr ?? e.message).trim().split('\n').slice(0, 2).join(' ')}`);
  }
}
export const rows = (q) => { const t = sql(q); return t ? t.split('\n').map((l) => l.split('|')) : []; };

export class ApiError extends Error {
  constructor(method, path, status, body) {
    super(`${method} ${path} → ${status}: ${JSON.stringify(body?.error ?? body).slice(0, 400)}`);
    this.status = status; this.code = body?.error?.code; this.body = body;
  }
}

/** One API call. `as` is a user key from state.users (or a raw token). Returns `data`; throws ApiError on >= 400. */
export async function call(method, path, { as, body, file, filename, type, raw } = {}) {
  const headers = {};
  const token = as ? (state.users[as]?.token ?? as) : undefined;
  if (token) headers.authorization = `Bearer ${token}`;
  let payload;
  if (file) {
    payload = new FormData();
    payload.append('file', new Blob([file], { type: type ?? (filename.endsWith('.csv') ? 'text/csv' : filename.endsWith('.png') ? 'image/png' : filename.endsWith('.mp4') ? 'video/mp4' : filename.endsWith('.pdf') ? 'application/pdf' : XLSX) }), filename);
  } else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (method !== 'GET') headers['idempotency-key'] = crypto.randomUUID();
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const json = await res.json().catch(() => ({}));
  if (res.status >= 400) throw new ApiError(method, path, res.status, json);
  return raw ? json : json.data;
}
export const get = (path, as) => call('GET', path, { as });
export const post = (path, as, body = {}) => call('POST', path, { as, body });
export const put = (path, as, body = {}) => call('PUT', path, { as, body });
export const patch = (path, as, body = {}) => call('PATCH', path, { as, body });
export const upload = (purpose, as, file, filename, type) => call('POST', `/files/${purpose}`, { as, file, filename, type });

/** Expects the call to be refused; returns { status, code } (or null when it unexpectedly succeeded). */
export async function refused(fn) {
  try { await fn(); return null; } catch (e) { if (e instanceof ApiError) return { status: e.status, code: e.code, message: e.body?.error?.message }; throw e; }
}

/** Real OTP login (dev master code). Stores the token under `key`. */
export async function login(key, mobile, { purpose = 'LOGIN', platform = 'ANDROID' } = {}) {
  sql(`DELETE FROM "OtpChallenge" WHERE mobile = '+91${mobile}'`); // test-only: resend cooldown
  const req = await call('POST', '/auth/otp/request', { body: { mobile, purpose } });
  const v = await call('POST', '/auth/otp/verify', { body: { challengeId: req.challengeId, code: OTP, platform } });
  state.users[key] = { ...(state.users[key] ?? {}), key, mobile, id: v.user.id, role: v.user.role, token: v.accessToken, gates: v.gates };
  save();
  return v;
}
/** Fresh token for an existing user key. */
export const relogin = (key) => login(key, state.users[key].mobile);

export async function xlsx(headers, data, sheet = 'Sheet1') {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheet);
  ws.addRow(headers);
  for (const r of data) ws.addRow(headers.map((h) => r[h] ?? ''));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ── results ──
const RESULTS_FILE = join(OUT, 'results.json');
const results = existsSync(RESULTS_FILE) ? JSON.parse(readFileSync(RESULTS_FILE, 'utf8')) : [];
let stage = '';
export function beginStage(name) {
  stage = name;
  for (let i = results.length - 1; i >= 0; i--) if (results[i].stage === name) results.splice(i, 1); // re-run replaces
  console.log(`\n━━ ${name}`);
}
/** Records one check. `ok` truthy = pass. */
export function check(id, title, ok, detail = '') {
  const pass = !!ok;
  results.push({ stage, id, title, pass, detail: typeof detail === 'string' ? detail : JSON.stringify(detail) });
  writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log(`${pass ? '  ✓' : '  ✗ FAIL'} ${id} ${title}${detail && !pass ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
  return pass;
}
/** JSON with object keys sorted, so two objects with the same content compare equal whatever their key order. */
const canon = (x) => JSON.stringify(x, (k, val) => (val && typeof val === 'object' && !Array.isArray(val) ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : val));
export const eq = (id, title, actual, expected) => check(id, title, canon(actual) === canon(expected), `expected ${canon(expected)}, got ${canon(actual)}`);
/** Check that a call is refused with the given HTTP status (one or a list) and optionally the error code. */
export async function denied(id, title, fn, status = 403, code) {
  const r = await refused(fn);
  const okStatus = r && [].concat(status).includes(r.status);
  return check(id, title, okStatus && (!code || r.code === code), r ? `got ${r.status} ${r.code ?? ''} ${r.message ?? ''}` : 'call was allowed');
}
export const inr = (n) => Math.round(Number(n) * 100) / 100;
export const sum = (a) => inr(a.reduce((s, x) => s + Number(x), 0));

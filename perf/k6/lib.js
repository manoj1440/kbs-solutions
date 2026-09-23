// F-905 shared k6 helpers. Targets a NON-PRODUCTION API with the dev OTP master code enabled.
import { check, fail } from 'k6';
import http from 'k6/http';

export const BASE = __ENV.API_URL || 'http://localhost:4200/api/v1';
export const OTP = __ENV.OTP_CODE || '000000';
export const ADMIN = __ENV.ADMIN_MOBILE || '9999999999';

const json = { 'content-type': 'application/json' };
export const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => ((c === 'x' ? Math.random() * 16 : (Math.random() * 4) | 8) | 0).toString(16));
export const authz = (token) => ({ headers: { ...json, authorization: `Bearer ${token}`, 'idempotency-key': uuid() } });

export function login(mobile, tags = {}) {
  const r = http.post(`${BASE}/auth/otp/request`, JSON.stringify({ mobile, purpose: 'LOGIN' }), { headers: json, tags: { step: 'otp_request', ...tags } });
  if (!check(r, { 'otp requested': (x) => x.status === 201 })) fail(`otp request ${mobile}: ${r.status} ${r.body}`);
  const v = http.post(`${BASE}/auth/otp/verify`, JSON.stringify({ challengeId: r.json('data.challengeId'), code: OTP, platform: 'ANDROID' }), { headers: json, tags: { step: 'otp_verify', ...tags } });
  if (!check(v, { 'otp verified': (x) => x.status === 201 })) fail(`otp verify ${mobile}: ${v.status} ${v.body}`);
  return v.json('data.accessToken');
}

export function setConfig(token, key, value) {
  const r = http.put(`${BASE}/config/${key}`, JSON.stringify({ value, reason: 'F-905 perf run (non-production)' }), authz(token));
  check(r, { [`config ${key}`]: (x) => x.status === 200 });
}

const OTP_KEYS = { 'auth.otp.resendCooldownSec': 0, 'auth.otp.maxSendsPerMobilePerHour': 100000, 'auth.otp.maxSendsPerIpPerHour': 100000 };

/** Perf runs repeat logins; lift OTP throttles on the perf database only. Returns the previous values for teardown. */
export function relaxOtp(token) {
  const list = http.get(`${BASE}/config`, { headers: { authorization: `Bearer ${token}` } }).json('data') || [];
  const prev = {};
  for (const k of Object.keys(OTP_KEYS)) {
    const row = list.find((r) => r.key === k);
    prev[k] = row ? row.value : null;
    setConfig(token, k, OTP_KEYS[k]);
  }
  return prev;
}
export function restoreOtp(token, prev) {
  for (const [k, v] of Object.entries(prev || {})) setConfig(token, k, v);
}

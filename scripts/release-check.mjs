#!/usr/bin/env node
/**
 * F-906 release gate (REQ-28 §28.2). Fails (exit 1) unless the target environment and the Android build config are
 * launch-ready. Run from the repo root before promoting a build:
 *
 *   API_URL=https://api.kbs.example/api/v1 ADMIN_TOKEN=<admin access token> API_ENV_FILE=/secure/api.env \
 *     node scripts/release-check.mjs [--profile=production|preview]
 *
 * Nothing is changed; it only reads /health, /config/launch-gates, the API env file and apps/mobile/eas.json.
 */
import { existsSync, readFileSync } from 'node:fs';

const profile = (process.argv.find((a) => a.startsWith('--profile=')) ?? '--profile=production').slice(10);
const results = [];
const check = (area, name, ok, detail = '') => results.push({ area, name, ok: Boolean(ok), detail });

// 1. Android build profile
const eas = JSON.parse(readFileSync(new URL('../apps/mobile/eas.json', import.meta.url), 'utf8'));
const app = JSON.parse(readFileSync(new URL('../apps/mobile/app.json', import.meta.url), 'utf8')).expo;
const prof = eas.build?.[profile];
check('android', `eas.json has a "${profile}" profile`, prof);
const apiUrl = prof?.env?.EXPO_PUBLIC_API_URL ?? '';
check('android', 'EXPO_PUBLIC_API_URL is a real https URL', /^https:\/\//.test(apiUrl) && !/\.invalid|example|localhost|10\.0\.2\.2/.test(apiUrl), apiUrl);
check('android', 'build numbers auto-increment from EAS', eas.cli?.appVersionSource === 'remote' && prof?.autoIncrement === true);
check('android', 'EAS projectId configured (needed for push tokens)', app.extra?.eas?.projectId, app.extra?.eas?.projectId ?? 'run `eas init`');
check('android', 'no dev client in release profile', !prof?.developmentClient);

// 2. API environment file (secrets are only tested for shape, never printed)
const envFile = process.env.API_ENV_FILE;
const env = {};
if (envFile && existsSync(envFile)) for (const line of readFileSync(envFile, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(#.*)?$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
check('api-env', 'API env file provided', envFile && existsSync(envFile), envFile ?? 'set API_ENV_FILE');
check('api-env', 'NODE_ENV=production', env.NODE_ENV === 'production', env.NODE_ENV);
check('api-env', 'OTP dev master code disabled', !env.OTP_DEV_MASTER_CODE);
check('api-env', 'real OTP provider (not console)', env.OTP_PROVIDER && env.OTP_PROVIDER !== 'console', env.OTP_PROVIDER);
check('api-env', 'malware scanning on (SCAN_PROVIDER=clamav)', env.SCAN_PROVIDER === 'clamav', env.SCAN_PROVIDER);
check('api-env', 'object storage (STORAGE_PROVIDER=s3)', env.STORAGE_PROVIDER === 's3', env.STORAGE_PROVIDER);
for (const k of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'OTP_PEPPER']) check('api-env', `${k} is set and not a placeholder`, env[k] && env[k].length >= 32 && !/change-me|ci-|test-/.test(env[k]));
check('api-env', 'DATA_ENCRYPTION_KEY is not the dev/test key', env.DATA_ENCRYPTION_KEY && env.DATA_ENCRYPTION_KEY !== 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=');
check('api-env', 'API connects as the non-owner kbs_app role (F-903)', /\/\/kbs_app[:@]/.test(env.DATABASE_URL ?? ''), 'see DOCS/runbooks/03-production-database.md');
check('api-env', 'long jobs go to the worker queue (JOBS_DISPATCH unset or queue, F-508)', !env.JOBS_DISPATCH || env.JOBS_DISPATCH === 'queue', env.JOBS_DISPATCH);
check('api-env', 'default request budget (THROTTLE_LIMIT_PER_MIN unset or ≤ 300)', !env.THROTTLE_LIMIT_PER_MIN || Number(env.THROTTLE_LIMIT_PER_MIN) <= 300, env.THROTTLE_LIMIT_PER_MIN);

// 3. Live API: health + launch gates (REQ-28 §28.2 — every ★ OPEN value decided by KBS)
const base = process.env.API_URL;
const token = process.env.ADMIN_TOKEN;
if (base && token) {
  try {
    const h = await fetch(`${base}/health`).then((r) => r.json());
    check('live', 'health: db + redis', h?.data?.db && h?.data?.redis);
    check('live', 'no dead-lettered outbox events (F-110)', (h?.data?.outbox?.deadLettered ?? 0) === 0, String(h?.data?.outbox?.deadLettered ?? ''));
    const g = await fetch(`${base}/config/launch-gates`, { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json());
    const gates = g?.data ?? [];
    check('live', 'launch-gate list readable', Array.isArray(gates) && gates.length > 0);
    for (const gate of gates) check('launch-gate', gate.key, gate.isSet, gate.isSet ? '' : gate.description);
  } catch (e) {
    check('live', 'API reachable', false, e.message);
  }
} else check('live', 'API_URL and ADMIN_TOKEN provided (launch gates)', false, 'set API_URL and ADMIN_TOKEN');

// 4. Manual evidence the script cannot see
const manual = ['A worker process runs with WORKER_MODE=1 (outbox relay, MIS background jobs — F-110 / F-508)', 'Maestro flows pass on the release APK (apps/mobile/.maestro)', 'SEC-02 protected screens verified on Android 12+ (F-302)', 'k6 thresholds approved by KBS recorded (DOCS/perf/01-baseline-results.md)', 'DPDP/compliance sign-offs recorded (launch gates above)'];

const w = Math.max(...results.map((r) => r.name.length));
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.area.padEnd(11)} ${r.name.padEnd(w)}  ${r.ok ? '' : r.detail}`);
console.log('\nManual evidence to attach to the release:');
for (const m of manual) console.log(`  [ ] ${m}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${failed ? `${failed} check(s) failed — not releasable.` : 'All automated release checks passed.'}`);
process.exit(failed ? 1 : 0);

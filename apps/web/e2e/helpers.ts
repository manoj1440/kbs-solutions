import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { type APIRequestContext, expect, type Page } from '@playwright/test';

/**
 * Dev/test only: clears OTP history for a mobile so repeated logins are not blocked by the resend cooldown.
 * `E2E_DB_URL` uses a host `psql`; without one, `E2E_PG_CONTAINER` (+ optional `E2E_PG_DB`, default kbs_dev) runs it
 * inside the Postgres container.
 */
export function clearOtp(mobile: string) {
  runSql(`DELETE FROM "OtpChallenge" WHERE mobile = '+91${mobile}'`);
}

/** Runs SQL on the e2e database (`E2E_DB_URL` via host psql, else `E2E_PG_CONTAINER`/`E2E_PG_DB`); false when neither is set. */
export function runSql(sql: string) {
  const db = process.env.E2E_DB_URL;
  const container = process.env.E2E_PG_CONTAINER;
  if (db) execSync(`psql "${db}" -q -v ON_ERROR_STOP=1`, { input: sql });
  else if (container) execSync(`docker exec -i ${container} psql -U kbs -d ${process.env.E2E_PG_DB ?? 'kbs_dev'} -q -v ON_ERROR_STOP=1`, { input: sql });
  else return false;
  return true;
}

export async function login(page: Page, mobile: string) {
  clearOtp(mobile);
  await page.goto('/login');
  await page.locator('input').first().fill(mobile);
  await page.getByRole('button', { name: /otp/i }).click();
  await page.getByLabel('Digit 1').waitFor();
  for (let i = 1; i <= 6; i++) await page.getByLabel(`Digit ${i}`).fill('0');
  await page.getByRole('button', { name: /verify|log in|continue/i }).click().catch(() => undefined); // form may auto-submit
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
}

/** No page-level horizontal scroll, and no framework error overlay. */
export async function assertHealthyPage(page: Page) {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('body')).not.toContainText(/Application error|Unhandled Runtime Error/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const API = process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1';

/** OTP login straight against the API (dev master code); returns the access token. */
export async function apiToken(request: APIRequestContext, mobile: string) {
  clearOtp(mobile);
  const ch = await (await request.post(`${API}/auth/otp/request`, { data: { mobile, purpose: 'LOGIN' } })).json();
  const v = await (await request.post(`${API}/auth/otp/verify`, { data: { challengeId: ch.data.challengeId, code: '000000', platform: 'ANDROID' } })).json();
  return v.data.accessToken as string;
}

/**
 * Fixture for specs that need a caller (a baseline-seeded e2e database has none): when no Telecaller exists, the Admin
 * creates a Manager who creates one — the same path the product uses. No-op on a database that already has callers.
 */
export async function ensureTelecaller(request: APIRequestContext, adminMobile: string) {
  const admin = await apiToken(request, adminMobile);
  const auth = (t: string) => ({ authorization: `Bearer ${t}`, 'idempotency-key': randomUUID() });
  const existing = await (await request.get(`${API}/users?role=TELECALLER&pageSize=1`, { headers: auth(admin) })).json();
  if (existing.data?.length) return;
  const n = `${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
  const m = await request.post(`${API}/users`, { headers: auth(admin), data: { role: 'MANAGER', fullName: 'E2E Calling Manager', mobile: `96${n}` } });
  expect(m.ok(), await m.text()).toBeTruthy();
  const t = await request.post(`${API}/telecallers`, { headers: auth(await apiToken(request, `96${n}`)), data: { fullName: 'E2E Telecaller', mobile: `95${n}` } });
  expect(t.ok(), await t.text()).toBeTruthy();
  // one assigned customer record, so the caller drill-down has a table (customer import has no shortcut via the API)
  runSql(`WITH adm AS (SELECT id FROM "User" WHERE role = 'ADMIN' LIMIT 1),
    tc AS (SELECT id FROM "User" WHERE mobile = '+9195${n}'),
    f AS (INSERT INTO "StoredFile" (id, bucket, key, "originalName", "contentType", "sizeBytes", sha256, "uploadedByUserId", purpose)
      SELECT gen_random_uuid()::text, 'e2e', 'e2e/${n}', 'e2e.xlsx', 'application/octet-stream', 1, 'e2e', adm.id, 'CUSTOMER_LIST' FROM adm RETURNING id),
    b AS (INSERT INTO "CustomerImportBatch" (id, "publicRef", "fileId", "uploaderUserId", checksum)
      SELECT gen_random_uuid()::text, 'KBS-B-E2E${n}', f.id, adm.id, 'e2e-${n}' FROM f, adm RETURNING id)
    INSERT INTO "CallingRecord" (id, "batchId", "sourceRowNumber", "fullName", mobile, pincode, "assignedTelecallerUserId", "assignedAt", "updatedAt")
      SELECT gen_random_uuid()::text, b.id, 1, 'E2E Customer', '+9194${n}', '302001', tc.id, now(), now() FROM b, tc;`);
}

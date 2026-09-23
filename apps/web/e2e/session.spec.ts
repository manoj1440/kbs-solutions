import { randomUUID } from 'node:crypto';

import { expect, type APIRequestContext, test } from '@playwright/test';

import { clearOtp, login } from './helpers';

const ADMIN = process.env.E2E_ADMIN_MOBILE ?? '9999999999';
const DB = process.env.E2E_DB_URL;
const API = process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1';

/** A throw-away Manager, so "sign out everywhere" never ends the shared Admin's sessions in parallel tests. */
async function freshManager(request: APIRequestContext) {
  clearOtp(ADMIN);
  const ch = await (await request.post(`${API}/auth/otp/request`, { data: { mobile: ADMIN, purpose: 'LOGIN' } })).json();
  const v = await (await request.post(`${API}/auth/otp/verify`, { data: { challengeId: ch.data.challengeId, code: '000000', platform: 'ANDROID' } })).json();
  const mobile = `98${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
  const r = await request.post(`${API}/users`, { headers: { authorization: `Bearer ${v.data.accessToken}`, 'idempotency-key': randomUUID() }, data: { role: 'MANAGER', fullName: 'E2E Session Manager', mobile } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return mobile;
}

/** F-804 AUTH-01: the web keeps a signed-in user signed in past the access-token lifetime and explains when it ends. */
test.describe('web session continuity', () => {
  test('a lapsed access cookie is renewed silently; the user stays on the page they asked for', async ({ page, context }) => {
    await login(page, ADMIN);
    await context.clearCookies({ name: 'kbs_access' }); // what the browser does when the 15-minute cookie expires
    await page.goto('/admin/leads?page=1');
    await expect(page).toHaveURL(/\/admin\/leads\?page=1$/);
    expect((await context.cookies()).some((c) => c.name === 'kbs_access')).toBe(true);
  });

  test('a session that really ended goes to login with an explanation, then back to the page', async ({ page, context, request }) => {
    test.skip(!DB, 'needs E2E_DB_URL to clear OTP cooldowns');
    const mobile = await freshManager(request);
    await login(page, mobile);
    await page.goto('/manager/account');
    await page.getByRole('button', { name: 'Sign out of all devices' }).click();
    await page.getByRole('button', { name: 'Yes, sign out everywhere' }).click();
    await expect(page).toHaveURL(/reason=signed-out/);
    await expect(page.getByRole('status').first()).toContainText('signed out');
    await context.clearCookies();
    await page.goto('/manager/leads');
    await expect(page).toHaveURL(/\/login\?reason=required&next=%2Fmanager%2Fleads/);
    clearOtp(mobile);
    await page.locator('input').first().fill(mobile);
    await page.getByRole('button', { name: /otp/i }).click();
    await page.getByLabel('Digit 1').waitFor();
    for (let i = 1; i <= 6; i++) await page.getByLabel(`Digit ${i}`).fill('0');
    await page.getByRole('button', { name: /verify|log in|continue/i }).click().catch(() => undefined);
    await expect(page).toHaveURL(/\/manager\/leads$/);
  });

  test('next cannot leave the site', async ({ page }) => {
    clearOtp(ADMIN);
    await page.goto('/login?next=//evil.example/x');
    await page.locator('input').first().fill(ADMIN);
    await page.getByRole('button', { name: /otp/i }).click();
    await page.getByLabel('Digit 1').waitFor();
    for (let i = 1; i <= 6; i++) await page.getByLabel(`Digit ${i}`).fill('0');
    await page.getByRole('button', { name: /verify|log in|continue/i }).click().catch(() => undefined);
    await expect(page).toHaveURL(/localhost:\d+\/admin$/);
  });
});

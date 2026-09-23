import { expect, test } from '@playwright/test';

import { login } from './helpers';

const API = process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1';
const ADMIN = process.env.E2E_ADMIN_MOBILE ?? '9999999999';

/** F-801 / AUTH-01: role routing on the web. Web is for Admin, Manager and Accounts (REQ-02 §2.3). */
test.describe('role routing', () => {
  test('AUTH-01: Admin signs in on the web and lands on /admin', async ({ page }) => {
    await login(page, ADMIN);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('AUTH-01: an Advisor signing in on the web gets the access-denied screen pointing to the Android app', async ({ page, request }) => {
    // self-register an Advisor the way the Android app does (dev master OTP)
    const mobile = `95${String(Date.now()).slice(-8)}`;
    const ch = await (await request.post(`${API}/auth/otp/request`, { data: { mobile, purpose: 'ADVISOR_SIGNUP' } })).json();
    const v = await request.post(`${API}/auth/otp/verify`, { data: { challengeId: ch.data.challengeId, code: '000000', platform: 'ANDROID' } });
    expect(v.ok()).toBeTruthy();

    await page.goto('/login');
    await login(page, mobile);
    await expect(page).toHaveURL(/\/access-denied/);
    await expect(page.getByText(/Android app/)).toBeVisible();
  });
});

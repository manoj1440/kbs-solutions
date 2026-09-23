import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { assertHealthyPage, clearOtp, login } from './helpers';

const API = process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1';
const ADMIN = process.env.E2E_ADMIN_MOBILE ?? '9999999999';

/** F-315: a Manager reaches the Advisors list from the nav; the page renders (empty or populated) without overflow. */
test('F-315 Manager Advisors page renders and is reachable from the navigation', async ({ page, request }, info) => {
  clearOtp(ADMIN);
  const ch = await (await request.post(`${API}/auth/otp/request`, { data: { mobile: ADMIN, purpose: 'LOGIN' } })).json();
  const v = await (await request.post(`${API}/auth/otp/verify`, { data: { challengeId: ch.data.challengeId, code: '000000', platform: 'ANDROID' } })).json();
  const mobile = `98${String(Date.now()).slice(-8)}`;
  const created = await request.post(`${API}/users`, {
    headers: { authorization: `Bearer ${v.data.accessToken}`, 'idempotency-key': randomUUID() },
    data: { role: 'MANAGER', fullName: 'E2E Advisors Manager', mobile },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  await login(page, mobile);
  const nav = page.getByRole('link', { name: 'Advisors', exact: true }).first();
  if (info.project.name === 'desktop') await nav.click();
  else await page.goto('/manager/advisors');
  await expect(page).toHaveURL(/\/manager\/advisors/);
  await expect(page.getByRole('heading', { name: 'Advisors' })).toBeVisible();
  await expect(page.getByText(/No Advisors report to you yet/)).toBeVisible();
  await assertHealthyPage(page);
});

import { execSync } from 'node:child_process';

import { expect, type Page } from '@playwright/test';

/** Dev/test only: clears OTP history for a mobile so repeated logins are not blocked by the resend cooldown. */
function clearOtp(mobile: string) {
  const db = process.env.E2E_DB_URL;
  if (db) execSync(`psql "${db}" -qc "DELETE FROM \\"OtpChallenge\\" WHERE mobile = '+91${mobile}'"`);
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

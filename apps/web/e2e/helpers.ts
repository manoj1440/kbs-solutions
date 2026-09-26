import { execSync } from 'node:child_process';

import { expect, type Page } from '@playwright/test';

/**
 * Dev/test only: clears OTP history for a mobile so repeated logins are not blocked by the resend cooldown.
 * `E2E_DB_URL` uses a host `psql`; without one, `E2E_PG_CONTAINER` (+ optional `E2E_PG_DB`, default kbs_dev) runs it
 * inside the Postgres container.
 */
export function clearOtp(mobile: string) {
  const sql = `DELETE FROM \\"OtpChallenge\\" WHERE mobile = '+91${mobile}'`;
  const db = process.env.E2E_DB_URL;
  const container = process.env.E2E_PG_CONTAINER;
  if (db) execSync(`psql "${db}" -qc "${sql}"`);
  else if (container) execSync(`docker exec ${container} psql -U kbs -d ${process.env.E2E_PG_DB ?? 'kbs_dev'} -qc "${sql}"`);
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

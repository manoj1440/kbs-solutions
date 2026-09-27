import { type BrowserContext, expect, type Page, test } from '@playwright/test';

import { assertHealthyPage, login } from './helpers';

const ADMIN = process.env.E2E_ADMIN_MOBILE ?? '9999999999';

/** F-901: every Admin workspace page renders without errors or page overflow at desktop and phone widths. */
const PAGES = [
  '/admin',
  '/admin/leads',
  '/admin/onboarding',
  '/admin/users',
  '/admin/calling-list',
  '/admin/calling-list/oversight',
  '/admin/calling-list/oversight?tab=shares',
  '/admin/calling-list/oversight?attention=RECORDING_FAILED',
  '/admin/catalogue',
  '/admin/mis',
  '/admin/mis/integrity',
  '/admin/payouts/liability',
  '/admin/payouts/requests',
  '/admin/payouts/requests?queue=exceptions',
  '/admin/payouts/entitlements',
  '/admin/payouts/rules',
  '/admin/dashboards',
  '/admin/dashboards/telecallers',
  '/admin/dashboards/managers',
  '/admin/dashboards/advisors',
  '/admin/dashboards/bank-card-mix',
  '/admin/audit',
  '/admin/audit?tab=sensitive',
  '/admin/config',
  '/admin/retention',
  '/admin/network',
  '/admin/account',
  '/admin/notifications',
];

test.describe('Admin workspace smoke', () => {
  test.describe.configure({ mode: 'serial' });
  let ctx: BrowserContext;
  let page: Page;
  // one OTP login per project; every page check reuses the session cookie
  test.beforeAll(async ({ browser }, info) => {
    ctx = await browser.newContext({ viewport: info.project.use.viewport ?? { width: 1280, height: 900 }, baseURL: info.project.use.baseURL });
    page = await ctx.newPage();
    await login(page, ADMIN);
  });
  test.afterAll(async () => ctx.close());

  for (const path of PAGES) {
    test(`renders ${path}`, async () => {
      await page.goto(path);
      await expect(page.locator('h1').first()).toBeVisible();
      await assertHealthyPage(page);
    });
  }

  test('F-807: executive dashboard URL lands on the Business overview with its filters', async () => {
    await page.goto('/admin/dashboards?from=2026-01-01&to=2026-01-31');
    await expect(page).toHaveURL(/\/admin\?from=2026-01-01&to=2026-01-31$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Business overview' })).toBeVisible();
    await page.getByRole('navigation', { name: 'Period' }).getByRole('link', { name: '7 days' }).click();
    await expect(page).toHaveURL(/\/admin\?period=7d$/);
    await expect(page.getByRole('link', { name: '7 days' })).toHaveAttribute('aria-current', 'page');
  });

  test('F-807: sidebar lists each page once, grouped by responsibility', async () => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'desktop sidebar');
    await page.goto('/admin');
    const nav = page.getByRole('navigation', { name: 'Admin navigation' });
    const hrefs = await nav.getByRole('link').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).not.toContain('/admin/dashboards');
    expect(hrefs).not.toContain('/admin/account');
    for (const group of ['Overview', 'Sales', 'Calling', 'People', 'Products', 'Bank MIS', 'Payouts', 'Reports', 'Settings'])
      await expect(nav.getByText(group, { exact: true })).toBeVisible();
  });

  test('notification drawer opens and closes', async () => {
    await page.goto('/admin');
    await page.getByRole('button', { name: /^Notifications/ }).click();
    const dlg = page.getByRole('dialog', { name: 'Notifications' });
    await expect(dlg).toBeVisible();
    await dlg.getByRole('button', { name: 'Close notifications' }).click();
    await expect(dlg).toBeHidden();
  });

  test('authorisation: a signed-out visitor is sent to login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto('/admin/audit');
    await expect(p).toHaveURL(/\/login/);
    await ctx.close();
  });
});

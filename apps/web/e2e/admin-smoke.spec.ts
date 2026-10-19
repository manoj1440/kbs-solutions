import { type BrowserContext, expect, type Page, test } from '@playwright/test';

import { assertHealthyPage, ensureTelecaller, login } from './helpers';

const ADMIN = process.env.E2E_ADMIN_MOBILE ?? '9999999999';

/** F-901: every Admin workspace page renders without errors or page overflow at desktop and phone widths. */
const PAGES = [
  '/admin',
  '/admin/leads',
  '/admin/onboarding',
  '/admin/users',
  '/admin/calling-list',
  '/admin/calling-list?status=UNTOUCHED&pincode=3',
  '/admin/calling-list/performance',

  '/admin/catalogue',
  '/admin/mis',
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

  test('F-807: executive dashboard URL lands on the Business overview', async () => {
    await page.goto('/admin/dashboards');
    await expect(page).toHaveURL(/\/admin$/);
    // F-814: the home's h1 is the greeting; F-817: the rail names the page (desktop) — phones use the drawer
    await expect(page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
    if ((page.viewportSize()?.width ?? 0) >= 768) await expect(page.getByRole('navigation', { name: 'Admin navigation' }).getByText('Business overview')).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Today' })).toBeVisible();
    await expect(page.getByText('Recent leads')).toBeVisible();
    await expect(page.getByText('Calling performance')).toBeVisible();
    await expect(page.getByText('Records held')).toHaveCount(0);
    await page.locator('summary[aria-label="Period"]').click();
    await page.getByRole('menuitem', { name: 'Last 30 days' }).click();
    await expect(page).toHaveURL(/\/admin\?period=30d$/);
    await expect(page.locator('summary[aria-label="Period"]')).toContainText('Last 30 days');
  });

  test('F-807/F-817: every page is listed once, grouped by responsibility; sections in the top bar, pages in the rail', async () => {
    test.skip((page.viewportSize()?.width ?? 0) < 1280, 'desktop top bar');
    await page.goto('/admin');
    const sections = page.getByRole('navigation', { name: 'Admin sections' });
    for (const group of ['Overview', 'Sales', 'Calling', 'People', 'Products', 'Payouts', 'Reports', 'Settings'])
      await expect(sections.getByRole('link', { name: group, exact: true })).toBeVisible();
    // the drawer lists every page of every section exactly once
    const all = await page.locator('nav[aria-label="Mobile admin navigation"] a').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(all.length).toBeGreaterThan(20);
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain('/admin/dashboards');
    expect(all).not.toContain('/admin/account');
    // a section opens its first page and the rail shows that section's pages
    await sections.getByRole('link', { name: 'Calling', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/calling-list$/);
    const rail = page.getByRole('navigation', { name: 'Admin navigation' });
    await expect(rail.getByRole('link', { name: 'Calling records' })).toHaveAttribute('aria-current', 'page');
    await expect(rail.getByRole('link', { name: 'Caller performance' })).toBeVisible();
  });

  test('F-808: calling records filters by status, upload opens a dialog, old allocation URL lands on caller performance', async () => {
    await ensureTelecaller(ctx.request, ADMIN);
    await page.goto('/admin/calling-list');
    await page.getByRole('button', { name: 'Upload customer list' }).click();
    const upload = page.getByRole('dialog', { name: 'Upload customer list' });
    await expect(upload).toBeVisible();
    await upload.getByRole('button', { name: 'Cancel' }).click();
    await expect(upload).toBeHidden();
    const total = Number((await page.getByLabel('Current status', { exact: true }).locator('option').first().textContent())?.match(/\((\d+)\)/)?.[1]);
    await page.getByLabel('Current status', { exact: true }).selectOption('UNTOUCHED');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page).toHaveURL(/status=UNTOUCHED/);
    const statuses = await page.locator('td[data-label="Current status"]').allTextContents();
    for (const badge of statuses) expect(badge.trim()).toBe('Not yet called');
    expect(statuses.length).toBeLessThanOrEqual(Math.min(total, 100));
    await page.goto('/admin/calling-list/distribution');
    await expect(page).toHaveURL(/\/admin\/calling-list\/performance$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Caller performance' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Success %' })).toBeVisible();
    await page.locator('td[data-label="Caller"] a').first().click();
    await expect(page).toHaveURL(/\/performance\/telecaller\//);
    await expect(page.getByRole('columnheader', { name: 'Last call' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Recording' })).toBeVisible();
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

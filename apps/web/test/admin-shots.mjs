// Dev-only visual sweep: logs in as the demo Admin and screenshots admin pages.
// Usage: node test/admin-shots.mjs <outDir> [width] [pathFilter]
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const out = process.argv[2] ?? 'shots';
const width = Number(process.argv[3] ?? 1440);
const filter = process.argv[4];
const BASE = process.env.BASE ?? 'http://localhost:3200';
const API = process.env.API ?? 'http://localhost:4200/api/v1';
const ADMIN = process.env.ADMIN_MOBILE ?? '9999999999';
mkdirSync(out, { recursive: true });
try { execSync(`docker exec kbs-test-pg psql -U kbs -d kbs_dev -qc "DELETE FROM \\"OtpChallenge\\""`); } catch {}

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`);
await page.locator('input').first().fill(ADMIN);
await page.getByRole('button', { name: /otp/i }).click();
await page.getByLabel('Digit 1').waitFor();
for (let i = 1; i <= 6; i++) await page.getByLabel(`Digit ${i}`).fill('0');
await page.getByRole('button', { name: /verify|log in|continue/i }).click().catch(() => undefined);
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

// resolve dynamic ids through the API with the page's cookies
const token = (await ctx.cookies()).find((c) => /access/i.test(c.name))?.value;
async function first(path, pick = (d) => d?.[0]?.id) {
  try {
    const r = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } });
    return pick((await r.json()).data);
  } catch { return undefined; }
}
const ids = {
  lead: await first('/leads?pageSize=1', (d) => d?.[0]?.leadId ?? d?.[0]?.id),
  batch: await first('/mis/batches?pageSize=1'),
  profile: await first('/mis/profiles'),
  card: await first('/catalogue/cards'),
  user: await first('/users?pageSize=1'),
  rule: await first('/payouts/rules'),
  req: await first('/payouts/requests?pageSize=1'),
  pin: await first('/pincode-profiles'),
  list: await first('/calling-list/batches?pageSize=1'),
};
const pages = [
  '/admin', '/admin/leads', ids.lead && `/admin/leads/${ids.lead}`, '/admin/onboarding', '/admin/users',
  ids.user && `/admin/users/${ids.user}`, '/admin/calling-list', ids.list && `/admin/calling-list/${ids.list}`,
  '/admin/calling-list/distribution', '/admin/calling-list/oversight', '/admin/catalogue',
  ids.card && `/admin/catalogue/${ids.card}`, '/admin/pincode-profiles', ids.pin && `/admin/pincode-profiles/${ids.pin}`,
  '/admin/training', '/admin/training/1', '/admin/training/team', '/admin/dashboards', '/admin/dashboards/telecallers',
  '/admin/dashboards/managers', '/admin/dashboards/advisors', '/admin/dashboards/bank-card-mix', '/admin/audit',
  '/admin/mis', ids.batch && `/admin/mis/batches/${ids.batch}`, ids.profile && `/admin/mis/profiles/${ids.profile}`,
  '/admin/mis/integrity', '/admin/payouts/liability', '/admin/payouts/requests', ids.req && `/admin/payouts/requests/${ids.req}`,
  '/admin/payouts/entitlements', '/admin/payouts/rules', ids.rule && `/admin/payouts/rules/${ids.rule}`,
  '/admin/compliance', '/admin/network', '/admin/config', '/admin/retention', '/admin/notifications', '/admin/account',
].filter(Boolean).filter((p) => !filter || p.includes(filter));
for (const p of pages) {
  await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle' }).catch(() => undefined);
  const name = p.replace(/^\/admin\/?/, '').replace(/\//g, '_') || 'overview';
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const err = await page.locator('body').innerText().then((t) => /Application error|Unhandled Runtime Error|Something went wrong/i.test(t));
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log(`${p}\toverflow=${overflow}${err ? '\tERROR' : ''}`);
}
await browser.close();

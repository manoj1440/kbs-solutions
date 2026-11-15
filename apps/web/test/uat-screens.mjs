// UAT-01 S13 — the web screens show the same figures as the API (DOCS/qa/uat-01-end-to-end-plan.md §3.2).
// Usage (web on :3000, API on :4000 against kbs_uat, after the driver's stages S01–S11):
//   node test/uat-screens.mjs [screenshotDir]
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '../../api/scripts/uat/.out');
const shots = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? join(OUT, 'screens');
mkdirSync(shots, { recursive: true });
const BASE = process.env.UAT_WEB_URL ?? 'http://localhost:3000';
const state = JSON.parse(readFileSync(join(OUT, 'state.json'), 'utf8'));
const L = state.ids.leads;
const R = state.ids.requests;
const SELLS = process.argv.includes('--sells'); // the pages that need stage S15 (a Manager who sells, F-823)
const STAGE = SELLS ? 'S16 Web screens — Manager sells' : 'S13 Web screens';
const file = join(OUT, 'results.json');
const results = (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []).filter((r) => r.stage !== STAGE);
console.log(`\n━━ ${STAGE}`);
function check(id, title, ok, detail = '') {
  results.push({ stage: STAGE, id, title, pass: !!ok, detail });
  writeFileSync(file, JSON.stringify(results, null, 2));
  console.log(`${ok ? '  ✓' : '  ✗ FAIL'} ${id} ${title}${ok ? '' : ` — ${detail}`}`);
}
const browser = await chromium.launch({ channel: 'chrome' });

async function as(mobile) {
  execSync(`docker exec kbs-postgres-1 psql -U kbs -d kbs_uat -qc "DELETE FROM \\"OtpChallenge\\""`);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: 'kbs_theme', value: 'light', url: BASE }]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.locator('input').first().fill(mobile);
  await page.getByRole('button', { name: /otp/i }).click();
  await page.getByLabel('Digit 1').waitFor();
  for (let i = 1; i <= 6; i++) await page.getByLabel(`Digit ${i}`).fill('0');
  await page.getByRole('button', { name: /verify|log in|continue/i }).click().catch(() => undefined);
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
  return { ctx, page };
}
/** Opens a page and checks its visible text. `has` / `not` are strings or regexes. Row checks: ['Row name', 'value in the same row']. */
async function screen(page, id, title, path, { has = [], not = [], rows = [] } = {}) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' }).catch(() => undefined);
  await page.waitForTimeout(700);
  const text = (await page.locator('main').innerText().catch(() => page.locator('body').innerText())).replace(/ /g, ' ');
  const test = (t, s) => (t instanceof RegExp ? t.test(s) : s.includes(t));
  const missing = has.filter((t) => !test(t, text)).map(String);
  const leaked = not.filter((t) => test(t, text)).map(String);
  const rowFail = [];
  for (const [name, ...vals] of rows) {
    const row = await page.locator('tr, li, article, [data-slot="card"]', { hasText: name }).last().innerText().catch(() => '');
    for (const val of vals) if (!test(val, row.replace(/ /g, ' '))) rowFail.push(`${name} → ${val}`);
  }
  const broken = /Application error|Unhandled Runtime Error|Something went wrong/i.test(text);
  await page.screenshot({ path: join(shots, `${id}.png`), fullPage: true });
  check(id, title, !missing.length && !leaked.length && !rowFail.length && !broken, [missing.length ? `missing: ${missing.join(' | ')}` : '', leaked.length ? `should not show: ${leaked.join(' | ')}` : '', rowFail.length ? `row: ${rowFail.join(' | ')}` : '', broken ? 'error screen' : ''].filter(Boolean).join(' · '));
  return text;
}

// ── Admin ──
if (!SELLS) {
  const { ctx, page } = await as('9999999999');
  await screen(page, 'S13-A01', 'Admin home: ₹6,500.50 earned, 12 leads, 9 bank approved, 7 cards activated, team 3 / 2 / 5', '/admin', { has: ['₹6,500.50', 'Leads created', 'Bank approved', 'Cards activated', 'Calls connected'] });
  await screen(page, 'S13-A02', 'Admin → Managers: North ₹5,500.50 paid, South ₹1,500.00 approved-unpaid', '/admin/dashboards/managers', { has: ['Meera Manager North', 'Mohan Manager South'], rows: [['Meera Manager North', '5,500.50'], ['Mohan Manager South', '1,500']] });
  await screen(page, 'S13-A03', 'Admin → Advisors: Arjun ₹3,000, Anita ₹2,500.50, Alok ₹1,000, Aman ₹1,500 approved-unpaid', '/admin/dashboards/advisors', { rows: [['Arjun Advisor', '3,000'], ['Anita Advisor', '2,500.50'], ['Alok Advisor', '1,000'], ['Aman Advisor', '1,500']] });
  await screen(page, 'S13-A04', 'Admin → Telecallers: all three callers listed with their calls', '/admin/dashboards/telecallers', { has: ['Tara Telecaller', 'Tarun Telecaller', 'Tina Telecaller'] });
  await screen(page, 'S13-A05', 'Admin → Leads: 12 leads; bank wordings exactly as in the files', '/admin/leads', { has: ['V + ACTIVE', 'ACTIVATION PENDING', 'TXN ACTIVE - Rs 100', 'INACTIVE', 'Lead Four Customer'], not: [/9600000\d{3}/, /ABCPA\d{4}[A-Z]/] });
  await screen(page, 'S13-A06', 'Lead L2 detail: Card Issued / Approved / TXN ACTIVE - Rs 100, with the earlier INACTIVE in its history', `/admin/leads/${L.L2}`, { has: ['Card Issued', 'Approved', 'TXN ACTIVE - Rs 100', 'INACTIVE', 'UATA1002'], not: ['9600000002', 'ABCPA1002B'] });
  await screen(page, 'S13-A07', 'Lead L4 detail (no bank file yet): reads awaiting a bank update, not a made-up status', `/admin/leads/${L.L4}`, { has: [/Awaiting bank update/i], not: ['Under Processing', 'Application Submitted'] });
  await screen(page, 'S13-A08', 'Admin → Payout requests: three Paid, one Approved, one Rejected, one Cancelled', '/admin/payouts/requests', { has: ['Paid', 'Rejected', 'Cancelled', '3,000', '2,500.50', '1,000', '1,500'] });
  await screen(page, 'S13-A09', 'Payout request PR1: both approvals, the corrected payment of ₹3,000.00 and the superseded ₹2,999.00 entry', `/admin/payouts/requests/${R.PR1}`, { has: ['Meera Manager North', 'KBS Owner', '3,000', '2,999', /superseded/i], not: ['111122223331'] });
  await screen(page, 'S13-A10', 'Admin → Bank MIS: applications with the bank values; nothing typed by hand', '/admin/mis', { has: ['UATA1001', 'UATA4002', 'V + ACTIVE'] });
  await screen(page, 'S13-A11', 'Admin → Users: all people with role and reporting person; mobiles masked', '/admin/users', { has: ['Meera Manager North', 'Tina Telecaller', 'Alok Advisor', 'Asha Accounts'], not: [/98000000\d\d/] });
  await screen(page, 'S13-A12', 'Admin → Entitlement ledger: paid, reserved, available and under-review cards', '/admin/payouts/entitlements', { has: [/paid/i, /under review/i] });
  await screen(page, 'S13-A13', 'Admin → Calling records: customers with caller and status; mobiles masked', '/admin/calling-list', { has: ['Tara Telecaller', 'Tina Telecaller'], not: [/97000000\d\d/] });
  await screen(page, 'S13-A14', 'Admin → Audit: actions with the acting person', '/admin/audit', { has: [/payment/i, 'KBS Owner'] });
  await ctx.close();
}
// ── Manager North ──
if (!SELLS) {
  const { ctx, page } = await as('9800000011');
  await screen(page, 'S13-M01', 'Manager North → Advisors: Arjun ₹3,000 and Anita ₹2,500.50 only — no other team\'s Advisor', '/manager/advisors', { rows: [['Arjun Advisor', '3,000'], ['Anita Advisor', '2,500.50']], not: ['Aman Advisor', 'Alok Advisor'] });
  await screen(page, 'S13-M02', 'Manager North → Dashboard: team totals (7 leads, 6 calls, ₹5,500.50 paid)', '/manager/dashboard', { has: ['5,500.50'] });
  await screen(page, 'S13-M03', 'Manager North → Team calling: Tara and Tarun only', '/manager/calling', { has: ['Tara Telecaller', 'Tarun Telecaller'], not: ['Tina Telecaller'] });
  await screen(page, 'S13-M04', 'Manager North → Team leads: 7 leads, none from another team', '/manager/leads', { has: ['Lead One Customer', 'Lead Seven Customer'], not: ['Lead Eight Customer', 'Lead Eleven Customer'] });
  await screen(page, 'S13-M07', 'Manager North → Team leads has an Advisor column and an Advisor filter', '/manager/leads', { has: ['All advisors'], rows: [['Lead One Customer', 'Arjun Advisor'], ['Lead Five Customer', 'Anita Advisor']] });
  await screen(page, 'S13-M08', "Manager North → one Advisor's leads: Arjun's 4 leads and his own figures in the tiles", `/manager/leads?advisorId=${state.users.a1.id}`, { has: ['Lead One Customer', 'Lead Four Customer', '1–4 of 4'], not: ['Lead Five Customer'] });
  await screen(page, 'S13-M09', "Manager North → Advisor page lists the Advisor's leads with a link to all of them", `/manager/advisors/${state.users.a1.id}`, { has: ['Leads · 4', 'All 4 leads', 'Lead Two Customer', 'TXN ACTIVE - Rs 100'] });
  await screen(page, 'S13-M10', 'Manager North → lead page: Advisor named, customer details (masked mobile and PAN, place, employment, income), bank fields, history, payout', `/manager/leads/${L.L2}`, { has: ['Arjun Advisor', 'Lead Two Customer', '110001', 'Salaried', '6,00,000', 'UATA1002', 'TXN ACTIVE - Rs 100', 'Bank status history', 'Paid'], not: ['9600000002', 'ABCPA1002B'] });
  await screen(page, 'S13-M05', 'Manager North → Payout approvals: their team\'s requests and the one approved as designated approver', '/manager/payouts/requests', { has: ['Arjun Advisor', 'Anita Advisor', 'Alok Advisor'], not: ['Aman Advisor'] });
  await screen(page, 'S13-M06', 'A Manager is kept out of the Admin area', '/admin/config', { not: ['Launch gates'] });
  await ctx.close();
}
// ── Accounts ──
if (!SELLS) {
  const { ctx, page } = await as('9800000001');
  await screen(page, 'S13-C01', 'Accounts: 1 awaiting payment (₹1,500.00), 3 paid (₹6,500.50)', '/accounts', { has: ['Awaiting payment', '1,500', '6,500.50', 'Aman Advisor'] });
  await screen(page, 'S13-C02', 'Accounts → Paid queue: the three paid requests', '/accounts?queue=paid', { has: ['Arjun Advisor', 'Anita Advisor', 'Alok Advisor'] });
  await screen(page, 'S13-C03', 'Accounts → request PR4: payee, approvals and amount; the account number is masked until revealed', `/accounts/requests/${R.PR4}`, { has: ['Aman Advisor', '1,500', 'Mohan Manager South'], not: ['111122223333'] });
  await screen(page, 'S13-C04', 'Accounts is kept out of leads and the Admin area', '/admin/leads', { not: ['Lead One Customer'] });
  await ctx.close();
}
// ── F-823: a Manager who sells (after stage S15) ──
if (SELLS) {
  const M = state.ids.mleads;
  {
    const { ctx, page } = await as('9999999999');
    await screen(page, 'S16-A01', "Admin → Leads lists the Manager's own leads, named with the Manager as owner", '/admin/leads', { rows: [['Manager Lead One', 'Mohan Manager South'], ['Lead Eight Customer', 'Aman Advisor']] });
    await screen(page, 'S16-A02', "Admin → the Manager's lead page names the Manager as its owner; bank fields as in the file", `/admin/leads/${M.ML1}`, { has: ['Mohan Manager South', 'Manager Lead One', 'UATM2001', 'V + ACTIVE'], not: ['9600000021', 'ABCPM2001A'] });
    await screen(page, 'S16-A03', "Admin → the Manager's payout request: no Manager step, approved by the Admin, ₹2,000.00 paid", `/admin/payouts/requests/${R.PRM}`, { has: ["a Manager's own request", 'there is no Manager step', 'KBS Owner', '2,000', 'Paid'], not: ['Manager approval', '222233334441'] });
    await screen(page, 'S16-A04', 'Admin → Advisors report includes the selling Manager with ₹2,000.00 paid', '/admin/dashboards/advisors', { rows: [['Mohan Manager South', '2,000']] });
    await screen(page, 'S16-A05', 'Admin → Payout requests lists the request with the others', '/admin/payouts/requests', { has: ['Mohan Manager South', '2,000'] });
    await ctx.close();
  }
  {
    const { ctx, page } = await as('9800000012');
    await screen(page, 'S16-M01', "Manager South → Team leads shows their team's leads and their own, each with its owner", '/manager/leads', { rows: [['Manager Lead One', 'Mohan Manager South'], ['Lead Eight Customer', 'Aman Advisor']], not: ['Lead One Customer'] });
    await screen(page, 'S16-M02', 'Manager South → Advisors table has a row for the Manager\'s own sales (2 leads, ₹2,000.00 paid)', '/manager/advisors', { rows: [['Mohan Manager South', '2,000.00']] });
    await screen(page, 'S16-M03', "Manager South → their own request is visible to them but offers no approve button", `/manager/payouts/requests/${R.PRM}`, { has: ['2,000', "a Manager's own request"], not: [/^Approve$/m] });
    await ctx.close();
  }
  {
    const { ctx, page } = await as('9800000001');
    await screen(page, 'S16-C01', "Accounts → Paid queue includes the Manager's request", '/accounts?queue=paid', { has: ['Mohan Manager South'] });
    await ctx.close();
  }
}
await browser.close();
const mine = results.filter((r) => r.stage === STAGE);
console.log(`\n${mine.length} screen checks: ${mine.filter((r) => r.pass).length} passed, ${mine.filter((r) => !r.pass).length} failed · screenshots in ${shots}`);

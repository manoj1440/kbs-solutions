// S10 — Who performed how, and who earned what, at every level of the hierarchy. Every figure is compared with the
// plan's oracle (DOCS/qa/uat-01-end-to-end-plan.md §3.2) and with the level above / below it.
import { beginStage, check, eq, denied, get, login, call, state, sql, inr, sum } from './lib.mjs';

beginStage('S10 Roll-up');
await login('admin', '9999999999');
for (const k of ['m1', 'm2', 'acc', 't1', 't2', 't3', 'a1', 'a2', 'a3', 'a4']) await login(k, state.users[k].mobile);
const A = 'admin';
const U = state.users;
const v = (x) => (x && typeof x === 'object' && 'value' in x ? x.value : x); // dashboard cells are { value, source, dateBasis, amountInr? }
const amt = (x) => inr(x?.amountInr ?? 0);
const cnt = (x) => x?.count ?? v(x);

// ─────────── 1. EARNINGS — Advisor level ───────────
const ORACLE = {
  a1: { paid: 3000, paidCards: 2, approvedUnpaid: 0, available: 0, underReview: 0 },
  a2: { paid: 2500.5, paidCards: 2, approvedUnpaid: 0, available: 0, underReview: 0 },
  a3: { paid: 0, paidCards: 0, approvedUnpaid: 1, available: 1, underReview: 1 },
  a4: { paid: 1000, paidCards: 1, approvedUnpaid: 0, available: 0, underReview: 0 },
};
const ledgers = {};
for (const k of Object.keys(ORACLE)) ledgers[k] = await get('/payouts/me/ledger', k);
for (const [k, o] of Object.entries(ORACLE)) {
  const t = ledgers[k].totals;
  eq(`S10-E-${k}`, `${U[k].fullName}: earned ₹${o.paid.toFixed(2)} on ${o.paidCards} card(s); ${o.approvedUnpaid} approved-unpaid, ${o.available} claimable, ${o.underReview} under review`,
    { paid: inr(t.paid.amountInr), paidCards: t.paid.count, approvedUnpaid: t.approvedUnpaid.count, available: t.available.count, underReview: t.underReview.count }, o);
}
check('S10-E-01', 'An Advisor\'s "total earnings" equals the sum of their Paid requests (not the approved or claimable amounts)',
  Object.keys(ORACLE).every((k) => inr(ledgers[k].earnings.totalPaidInr) === inr(Number(sql(`select coalesce(sum("totalAmountInr"),0) from "PayoutRequest" where "advisorUserId"='${U[k].id}' and state='PAID'`)))), '');
check('S10-E-02', 'An Advisor never sees a per-card rate in the ledger', Object.values(ledgers).every((l) => l.rows.every((r) => !r.amountInr)), '');
const reqList = async (k, qs = '') => { const r = await call('GET', `/payouts/requests?pageSize=50${qs}`, { as: k, raw: true }); return r.data.items ?? r.data; };
eq('S10-E-03', 'Each Advisor lists only their own requests (a1: 1, a2: 2, a3: 2, a4: 1)', [(await reqList('a1')).length, (await reqList('a2')).length, (await reqList('a3')).length, (await reqList('a4')).length], [1, 2, 2, 1]);

// ─────────── 2. EARNINGS — Manager level (team roll-up) ───────────
const teamRows = async (k) => (await get('/dashboards/manager/advisors', k)).rows;
const m1rows = await teamRows('m1'), m2rows = await teamRows('m2');
const byName = (rs) => Object.fromEntries(rs.map((r) => [r.user.fullName, r]));
eq('S10-M-01', "Manager North's team table lists exactly their two Advisors", m1rows.map((r) => r.user.fullName).sort(), ['Anita Advisor', 'Arjun Advisor']);
const m1 = byName(m1rows), m2 = byName(m2rows);
eq('S10-M-02', 'Per Advisor the Manager sees the same paid amount the Advisor sees (Arjun ₹3,000.00, Anita ₹2,500.50)', [amt(m1['Arjun Advisor'].payouts.paid), amt(m1['Anita Advisor'].payouts.paid)], [3000, 2500.5]);
const m1dash = await get('/dashboards/manager', 'm1'), m2dash = await get('/dashboards/manager', 'm2');
eq('S10-M-03', 'Manager North team total paid = ₹5,500.50 on 4 cards = Arjun + Anita', { paid: amt(m1dash.advisors.payouts.paid), cards: v(m1dash.advisors.payouts.paid), sum: sum(m1rows.map((r) => amt(r.payouts.paid))) }, { paid: 5500.5, cards: 4, sum: 5500.5 });
eq('S10-M-04', 'Manager South team: nothing paid, ₹1,500.00 approved and unpaid (1 card), 1 card claimable', { paid: amt(m2dash.advisors.payouts.paid), unpaid: amt(m2dash.advisors.payouts.approvedUnpaid), unpaidCards: v(m2dash.advisors.payouts.approvedUnpaid), available: v(m2dash.advisors.payouts.available) }, { paid: 0, unpaid: 1500, unpaidCards: 1, available: 1 });
check('S10-M-05', 'The Admin-direct Advisor (Alok) is in no Manager\'s team totals — being the designated approver does not make him Manager North\'s Advisor', !('Alok Advisor' in m1) && !('Alok Advisor' in m2), '');
const mgrLedger = await get(`/payouts/ledger/${U.a1.id}`, 'm1');
check('S10-M-06', "A Manager can open the card ledger of their own Advisor", inr(mgrLedger.totals.paid.amountInr) === 3000, '');
await denied('S10-M-07', "…but not of another Manager's Advisor", () => get(`/payouts/ledger/${U.a3.id}`, 'm1'), [403, 404]);
await denied('S10-M-08', '…and not of the Admin-direct Advisor', () => get(`/payouts/ledger/${U.a4.id}`, 'm1'), [403, 404]);
eq('S10-M-09', "Manager North's request list holds their team's requests plus the one they approve as designated approver (PR1, PR2, PR3, PR5); Manager South's holds a3's two", [(await reqList('m1')).length, (await reqList('m2')).length], [4, 2]);

// ─────────── 3. EARNINGS — Admin level (organisation) ───────────
const home = await get('/dashboards/admin/home', A);
const P = home.business.payouts;
eq('S10-A-01', 'Organisation: ₹6,500.50 paid on 5 cards; ₹1,500.00 approved-unpaid on 1; 1 claimable; 7 activated cards counted for payout', { paid: amt(P.paid), paidCards: v(P.paid), unpaid: amt(P.approvedUnpaid), unpaidCards: v(P.approvedUnpaid), available: v(P.available), eligible: v(P.eligible) }, { paid: 6500.5, paidCards: 5, unpaid: 1500, unpaidCards: 1, available: 1, eligible: 7 });
const mgrs = byName((await get('/dashboards/admin/managers', A)).rows);
eq('S10-A-02', 'Admin → Managers: North ₹5,500.50 paid (4 cards), South ₹0 paid and ₹1,500.00 approved-unpaid', { n: amt(mgrs['Meera Manager North'].payouts.paid), nc: v(mgrs['Meera Manager North'].payouts.paid), s: amt(mgrs['Mohan Manager South'].payouts.paid), su: amt(mgrs['Mohan Manager South'].payouts.approvedUnpaid) }, { n: 5500.5, nc: 4, s: 0, su: 1500 });
const advs = byName((await get('/dashboards/admin/advisors', A)).rows);
eq('S10-A-03', 'Admin → Advisors: each row shows that Advisor\'s paid amount', Object.fromEntries(['Arjun Advisor', 'Anita Advisor', 'Aman Advisor', 'Alok Advisor'].map((n) => [n, amt(advs[n].payouts.paid)])), { 'Arjun Advisor': 3000, 'Anita Advisor': 2500.5, 'Aman Advisor': 0, 'Alok Advisor': 1000 });
eq('S10-A-04', 'Organisation paid = Manager North team + Manager South team + Admin-direct Advisor (5,500.50 + 0 + 1,000.00)', inr(amt(mgrs['Meera Manager North'].payouts.paid) + amt(mgrs['Mohan Manager South'].payouts.paid) + amt(advs['Alok Advisor'].payouts.paid)), amt(P.paid));
eq('S10-A-05', 'Organisation paid = sum of the four Advisors\' own "total earnings"', sum(Object.values(ledgers).map((l) => l.earnings.totalPaidInr)), amt(P.paid));
const pd = await get('/dashboards/payouts', A);
eq('S10-A-06', 'Payout dashboard totals agree with the home page (paid, approved-unpaid, under review, transfers)', { paid: inr(pd.totals.paid.amountInr), unpaid: inr(pd.totals.approvedUnpaid.amountInr), review: pd.totals.underReview.count, transfers: pd.confirmedTransfers.count, transferred: inr(pd.confirmedTransfers.amountInr) }, { paid: 6500.5, unpaid: 1500, review: 1, transfers: 3, transferred: 6500.5 });
const pdM1 = await get(`/dashboards/payouts?managerId=${U.m1.id}`, A), pdM2 = await get(`/dashboards/payouts?managerId=${U.m2.id}`, A);
eq('S10-A-07', 'Filtered by Manager the payout dashboard gives the same team figures', [inr(pdM1.totals.paid.amountInr), pdM1.confirmedTransfers.count, inr(pdM2.totals.approvedUnpaid.amountInr)], [5500.5, 2, 1500]);
eq('S10-A-08', 'The home page "all time" figures agree: 7 cards counted (₹8,000.50 approved so far), 5 paid (₹6,500.50)', { e: home.cumulative.payouts.eligible.count, ea: inr(home.cumulative.payouts.eligible.amountInr), p: home.cumulative.payouts.paid.count, pa: inr(home.cumulative.payouts.paid.amountInr) }, { e: 7, ea: 8000.5, p: 5, pa: 6500.5 });

// ─────────── 4. EARNINGS — Accounts ───────────
const q = await get('/payouts/payments/queues', 'acc');
eq('S10-C-01', 'Accounts queues: 1 awaiting payment (₹1,500.00), 3 paid (₹6,500.50 transferred), 0 exceptions left', { aw: q.awaiting.count, awa: inr(q.awaiting.amountInr), pd: q.paid.count, pda: inr(q.paid.amountInr), tr: inr(q.paid.confirmedTransferInr), ex: q.exceptions.count }, { aw: 1, awa: 1500, pd: 3, pda: 6500.5, tr: 6500.5, ex: 0 });
eq('S10-C-02', 'Accounts sees only approved / paid requests — never the rejected, cancelled or pending ones', (await reqList('acc')).map((r) => r.state).sort(), ['APPROVED', 'PAID', 'PAID', 'PAID']);
eq('S10-C-03', 'Money actually transferred (payment records) = money shown as paid everywhere', inr(Number(sql(`select coalesce(sum(p."amountInr"),0) from "ExternalPayment" p join "PayoutRequest" r on r.id = p."requestId" where p.state='VERIFIED' and r.state='PAID'`))), 6500.5);

// ─────────── 5. WHO DOES NOT EARN ───────────
eq('S10-N-01', 'Every claimable / paid card belongs to an Advisor — none to a Telecaller or a Manager (INV-05)', sql(`select distinct u.role from "PayoutEntitlement" e join "User" u on u.id = e."advisorUserId"`), 'ADVISOR');
await denied('S10-N-02', 'A Telecaller has no earnings ledger (salaried, REQ-03)', () => get('/payouts/me/ledger', 't1'), 403);
await denied('S10-N-03', 'A Manager has no earnings ledger of their own — the product pays Advisors only (finding F-1: no Manager share exists)', () => get('/payouts/me/ledger', 'm1'), 403);
const t1perf = await get('/calling/me/performance', 't1');
check('S10-N-04', "The Telecaller's interested customer got an activated card: counted in their performance (1 application, 1 activated), with no money attached", t1perf.applications.total === 1 && t1perf.applications.activated === 1 && !/amount|inr|payout/i.test(JSON.stringify(t1perf)), JSON.stringify(t1perf.applications));

// ─────────── 6. PERFORMANCE — calling (Telecaller → Manager → Admin) ───────────
const CALLS = { t1: { attempts: 3, connected: 2, talk: 135 }, t2: { attempts: 3, connected: 3, talk: 170 }, t3: { attempts: 2, connected: 2, talk: 90 } };
for (const [k, o] of Object.entries(CALLS)) {
  const p = await get('/calling/me/performance', k);
  eq(`S10-P-${k}`, `${U[k].fullName}: ${o.attempts} calls, ${o.connected} connected, ${o.talk}s talk time (own "My stats")`, { attempts: p.period.attempts, connected: p.period.connected, talk: p.period.talkTimeSec }, o);
}
const team1 = (await get('/calling/team/overview', 'm1')).telecallers, team2 = (await get('/calling/team/overview', 'm2')).telecallers;
eq('S10-P-01', 'Manager North sees the same numbers per Telecaller (Tara 3/2, Tarun 3/3)', team1.map((t) => `${t.fullName}:${t.attempts}/${t.connected}`).sort(), ['Tara Telecaller:3/2', 'Tarun Telecaller:3/3']);
eq('S10-P-02', 'Manager South sees only Tina (2/2)', team2.map((t) => `${t.fullName}:${t.attempts}/${t.connected}`), ['Tina Telecaller:2/2']);
eq('S10-P-03', 'Manager North team total = Tara + Tarun (6 calls, 5 connected, 3 shares)', { a: v(m1dash.calling.calls.attempts), c: v(m1dash.calling.calls.connected), s: v(m1dash.calling.shares.total) }, { a: 6, c: 5, s: 3 });
const tcs = byName((await get('/dashboards/admin/telecallers', A)).rows);
eq('S10-P-04', 'Admin → Telecallers lists all three with the same numbers', Object.fromEntries(Object.entries(tcs).map(([n, r]) => [n, `${v(r.calls.attempts)}/${v(r.calls.connected)}`])), { 'Tara Telecaller': '3/2', 'Tarun Telecaller': '3/3', 'Tina Telecaller': '2/2' });
eq('S10-P-05', 'Admin → Managers: North 6 calls / 5 connected / 2 Telecallers; South 2 / 2 / 1', [[v(mgrs['Meera Manager North'].calls.attempts), v(mgrs['Meera Manager North'].calls.connected), mgrs['Meera Manager North'].telecallers], [v(mgrs['Mohan Manager South'].calls.attempts), v(mgrs['Mohan Manager South'].calls.connected), mgrs['Mohan Manager South'].telecallers]], [[6, 5, 2], [2, 2, 1]]);
eq('S10-P-06', 'Organisation calling total = North + South (8 calls, 7 connected, 1 not answered, 7 recordings)', { a: v(home.calling.calls.attempts), c: v(home.calling.calls.connected), n: v(home.calling.calls.notAnswered), r: v(home.calling.calls.recordingsAvailable) }, { a: 8, c: 7, n: 1, r: 7 });
eq('S10-P-07', 'Outcomes add up to the 8 recorded (2 interested, 2 follow-up, 1 link/PDF, 1 declined, 1 completed, 1 no answer)', Object.fromEntries(Object.entries(home.calling.outcomes).map(([k, x]) => [k, v(x)])), { COMPLETED_NO_FURTHER: 1, CONNECTED_INTERESTED: 2, CONNECTED_LINK_OR_PDF_SHARED: 1, DECLINED: 1, FOLLOW_UP: 2, NO_ANSWER_OR_FAILED: 1 });
eq('S10-P-08', 'Customer list: 15 uploaded, 10 allocated, 8 still active, 6 hidden (4 excluded at import + 1 declined + 1 completed) — none deleted', { u: v(home.calling.records.uploaded), a: v(home.calling.records.assigned), act: v(home.calling.records.active), h: v(home.calling.records.hidden), rows: Number(sql(`select count(*) from "CallingRecord"`)) }, { u: 15, a: 10, act: 8, h: 6, rows: 15 });
check('S10-P-09', 'A share is never counted as delivered (hand-off only)', v(home.calling.shares.delivered) === 0 && v(home.calling.shares.total) === 3, JSON.stringify(home.calling.shares));

// ─────────── 7. PERFORMANCE — leads (Advisor → Manager → Admin) ───────────
const LEADS = { a1: { total: 4, matched: 3, approved: 2, declined: 1, cardsActive: 2 }, a2: { total: 3, matched: 3, approved: 3, declined: 0, cardsActive: 2 }, a3: { total: 3, matched: 3, approved: 3, declined: 0, cardsActive: 2 }, a4: { total: 2, matched: 2, approved: 1, declined: 1, cardsActive: 1 } };
for (const [k, o] of Object.entries(LEADS)) {
  const s = await get('/leads/summary', k);
  eq(`S10-L-${k}`, `${U[k].fullName}: ${o.total} leads, ${o.matched} with a bank result, ${o.approved} approved, ${o.declined} declined, ${o.cardsActive} cards active`, { total: s.total, matched: s.matched, approved: s.approved, declined: s.declined, cardsActive: s.cardsActive }, o);
}
eq('S10-L-01', 'Manager North team: 7 leads, 6 with a bank result = Arjun + Anita', { created: v(m1dash.advisors.leads.created), matched: v(m1dash.advisors.leads.misMatched), sum: v(m1['Arjun Advisor'].leads.created) + v(m1['Anita Advisor'].leads.created) }, { created: 7, matched: 6, sum: 7 });
eq('S10-L-02', 'Admin → Managers: North 7 leads (6 matched), South 3 (3 matched)', [[v(mgrs['Meera Manager North'].leads.created), v(mgrs['Meera Manager North'].leads.misMatched)], [v(mgrs['Mohan Manager South'].leads.created), v(mgrs['Mohan Manager South'].leads.misMatched)]], [[7, 6], [3, 3]]);
eq('S10-L-03', 'Organisation: 12 leads, 11 with a bank result, 9 approved, 2 declined, 7 cards active = 7 + 3 + 2 (Admin-direct)', { t: v(home.business.leads.created), m: v(home.business.leads.misMatched), ap: home.business.approved, de: home.business.declined, ac: home.business.activated }, { t: 12, m: 11, ap: 9, de: 2, ac: 7 });
check('S10-L-04', 'Bank wordings are counted as written — "ACTIVATION PENDING" and "INACTIVE" are separate buckets and neither counts as active', home.business.activation.buckets.some((b) => b.value === 'ACTIVATION PENDING' && b.count === 1) && home.business.activation.buckets.some((b) => b.value === 'INACTIVE' && b.count === 1), JSON.stringify(home.business.activation.buckets));
eq('S10-L-05', 'People: 3 Telecallers, 2 Managers, 5 Advisors (4 active — one rejected at onboarding), 1 Accounts', home.people, { TELECALLER: { total: 3, active: 3 }, MANAGER: { total: 2, active: 2 }, ADVISOR: { total: 5, active: 4 }, ACCOUNTS: { total: 1, active: 1 } });

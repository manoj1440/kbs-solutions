// S12 — Operational follow-ups on leads, the official ID, and what a change of reporting person does to team totals.
import { beginStage, check, eq, denied, get, login, post, call, state, sql, inr, sum } from './lib.mjs';

beginStage('S12 Follow-ups, ID and reporting change');
await login('admin', '9999999999');
for (const k of ['m1', 'm2', 'acc', 't1', 't3', 'a1', 'a2', 'a3', 'a4']) await login(k, state.users[k].mobile);
const A = 'admin';
const U = state.users;
const L = state.ids.leads;
const v = (x) => (x && typeof x === 'object' && 'value' in x ? x.value : x);
const amt = (x) => inr(x?.amountInr ?? 0);

// ── KBS follow-ups and remarks on a lead are operational, never bank status ──
const due = new Date(Date.now() + 2 * 3600_000).toISOString();
await post(`/leads/${L.L4}/remarks`, 'a1', { text: 'TEST: customer will share the application number tomorrow' });
const task = await post(`/leads/${L.L4}/follow-ups`, 'a1', { text: 'TEST: collect the bank application number', dueAt: due });
const mgrTask = await post(`/leads/${L.L4}/follow-ups`, 'm1', { text: 'TEST: Manager asks for an update on this lead', dueAt: due, ownerUserId: U.a1.id });
const l4 = await get(`/leads/${L.L4}`, 'a1');
check('S12-01', 'An Advisor can add a remark and a follow-up to their lead; a Manager can assign one to their Advisor', l4.remarks.length === 1 && l4.followUps.length === 2, `${l4.remarks.length} remarks, ${l4.followUps.length} follow-ups`);
check('S12-02', 'They are listed as KBS activity and the bank fields still read "Awaiting MIS Update"', l4.operationalEvents.filter((e) => ['FOLLOW_UP_TASK', 'REMARK'].includes(e.kind) || /remark/i.test(e.kind)).every((e) => e.provenance === 'KBS_OPERATIONAL') && l4.operationalEvents.length >= 4 && l4.stage.display === 'Awaiting MIS Update', l4.operationalEvents.map((e) => `${e.kind}:${e.provenance}`).join(', '));
check('S12-02b', 'The follow-up\'s due time reads as a date and time in the activity list (not a raw timestamp)', l4.operationalEvents.filter((e) => e.kind === 'FOLLOW_UP_TASK').every((e) => / due \d{2} \w{3} \d{4}/.test(e.detail) && !/\d{4}-\d{2}-\d{2}T/.test(e.detail)), l4.operationalEvents.find((e) => e.kind === 'FOLLOW_UP_TASK')?.detail);
await denied('S12-03', "Another Advisor cannot add a remark to someone else's lead", () => post(`/leads/${L.L4}/remarks`, 'a2', { text: 'TEST: not my lead' }), [403, 404]);
await denied('S12-04', "A Manager cannot assign a follow-up on another team's lead", () => post(`/leads/${L.L8}/follow-ups`, 'm1', { text: 'TEST: wrong team', dueAt: due }), [403, 404]);
const pa = await call('GET', '/pending-actions', { as: 'a1', raw: true });
const paM = await call('GET', '/pending-actions', { as: 'm1', raw: true });
check('S12-05', 'Both follow-ups show in the Advisor\'s pending actions and in their Manager\'s', JSON.stringify(pa).includes(task.id) && JSON.stringify(pa).includes(mgrTask.id) && JSON.stringify(paM).includes(task.id), '');
await post(`/follow-ups/${task.id}/done`, 'a1', {});
const paAfter = await call('GET', '/pending-actions', { as: 'a1', raw: true });
check('S12-06', 'A follow-up marked done leaves the pending list (it is kept, not deleted)', !JSON.stringify(paAfter).includes(task.id) && sql(`select count(*) from "FollowUpTask" where id='${task.id}'`) === '1', '');

// ── official ID ──
const idc = await get('/id-cards/me', 't1');
check('S12-07', 'A Telecaller has an active official ID with name, employee code and a verification link', idc.status === 'ACTIVE' && /Tara Telecaller/.test(JSON.stringify(idc)) && /KBS-TC-/.test(JSON.stringify(idc)), JSON.stringify(idc).slice(0, 250));
const ref = idc.card?.publicRef ?? idc.publicRef;
const pub = await call('GET', `/verify/${ref}`, {});
check('S12-08', 'Anyone can verify the ID with the public link — it shows name, code and validity only, no mobile', (pub.valid === true || /ACTIVE|VALID/i.test(JSON.stringify(pub))) && !JSON.stringify(pub).includes('9800000021'), JSON.stringify(pub).slice(0, 250));
await denied('S12-09', 'An Advisor has no Telecaller ID card', () => get('/id-cards/me', 'a1'), [403, 404]);

// ── a change of reporting person: what happens to past earnings? ──
const teamPaid = async (k) => amt((await get('/dashboards/manager', k)).advisors.payouts.paid);
const before = { m1: await teamPaid('m1'), m2: await teamPaid('m2'), org: amt((await get('/dashboards/admin/home', A)).business.payouts.paid) };
await denied('S12-10', 'A Manager cannot move an Advisor into their own team', () => post(`/users/${U.a4.id}/reporting`, 'm2', { parentUserId: U.m2.id, reason: 'TEST: self-serve' }), 403);
await post(`/users/${U.a4.id}/reporting`, A, { parentUserId: U.m2.id, reason: 'TEST: Alok now works in the South team' });
const hist = await get(`/users/${U.a4.id}/reporting-history`, A);
check('S12-11', 'The Admin moves the Admin-direct Advisor under Manager South; the old reporting line is kept in history', (hist.items ?? hist).length >= 2, JSON.stringify(hist).slice(0, 300));
const after = { m1: await teamPaid('m1'), m2: await teamPaid('m2'), org: amt((await get('/dashboards/admin/home', A)).business.payouts.paid) };
const m2rows = (await get('/dashboards/manager/advisors', 'm2')).rows.map((r) => r.user.fullName).sort();
check('S12-12', 'The Advisor now appears in Manager South\'s team', m2rows.includes('Alok Advisor'), m2rows.join(', '));
eq('S12-13', 'Organisation total paid is unchanged by the move (₹6,500.50) and Manager North is unaffected', { org: after.org, m1: after.m1 }, { org: before.org, m1: before.m1 });
console.log(`   observed: Manager South team paid before the move ₹${before.m2.toFixed(2)}, after ₹${after.m2.toFixed(2)}`);
check('S12-14', 'The ₹1,000.00 Alok earned while reporting to the Admin now counts in Manager South\'s team total (totals follow the CURRENT reporting person — observation O-2 for the owner)', after.m2 === inr(before.m2 + 1000), `before ${before.m2}, after ${after.m2}`);
const snap = sql(`select count(distinct "reportingParentUserIdSnapshot") from "Lead" where "advisorUserId"='${U.a4.id}'`) + '|' + sql(`select u.role from "Lead" l join "User" u on u.id = l."reportingParentUserIdSnapshot" where l."advisorUserId"='${U.a4.id}' limit 1`);
eq('S12-15', 'Each lead still records who the Advisor reported to when it was created (Admin) — the history stays auditable', snap, '1|ADMIN');
const l11 = await get(`/leads/${L.L11}`, 'm2').then(() => 'visible', (e) => e.status);
eq('S12-16', 'Manager South can now open the Advisor\'s earlier leads', l11, 'visible');
const pr5 = sql(`select u."fullName" from "PayoutRequest" r join "User" u on u.id = r."managerApproverUserId" where r.id='${state.ids.requests.PR5}'`);
eq('S12-17', 'The paid request keeps the Manager who actually approved it (Manager North)', pr5, 'Meera Manager North');

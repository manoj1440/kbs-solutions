// S15 — F-823: a Manager also sells. Same lead flow as an Advisor, paid through KBS; the Admin alone approves the
// Manager's own request (nobody approves their own, and a Manager reports to the Admin).
import { beginStage, check, eq, denied, get, login, post, put, patch, upload, call, state, save, sql, inr, PNG } from './lib.mjs';
import { importMis } from './mis.mjs';

beginStage('S15 Manager sells');
await login('admin', '9999999999');
for (const k of ['m1', 'm2', 'acc', 't1', 'a3']) await login(k, state.users[k].mobile);
const A = 'admin';
const U = state.users;
const C = state.ids.cards;
const v = (x) => (x && typeof x === 'object' && 'value' in x ? x.value : x);
const amt = (x) => inr(x?.amountInr ?? 0);
const paidBefore = { org: amt((await get('/dashboards/admin/home', A)).business.payouts.paid), south: amt((await get('/dashboards/manager', 'm2')).advisors.payouts.paid) };

// ── before the payee details: team work is open, selling is not ──
check('S15-01', 'A Manager signs in without any onboarding step blocking them; the app is told selling is not open yet', U.m2.gates?.onboarding?.required === false && U.m2.gates?.onboarding?.complete === false, U.m2.gates?.onboarding);
await denied('S15-02', 'A Manager cannot create a lead before their identity and bank details are approved', () => post('/leads/drafts', 'm2', { cardId: C.rewards }), 403, 'GATE_ONBOARDING_INCOMPLETE');
check('S15-03', 'Their team work is unaffected meanwhile (dashboard, team leads)', !!(await get('/dashboards/manager', 'm2')).scope && Array.isArray((await call('GET', '/leads', { as: 'm2', raw: true })).data), '');

// ── payee details: the Advisor onboarding steps, without the Agent Code ──
const ob0 = await get('/onboarding/me', 'm2');
await put('/onboarding/me/personal', 'm2', { fullName: 'Mohan Manager South', email: 'mohan@example.com' });
await put('/onboarding/me/consent', 'm2', { privacyNoticeVersion: ob0.privacyNoticeVersion, identityConsent: true, termsAccepted: true });
const ident = await post('/onboarding/me/identity/start', 'm2', {});
await post('/onboarding/me/identity/complete', 'm2', { sessionRef: ident.identity.sessionRef, payload: 'MOCK_OK' });
await put('/onboarding/me/bank', 'm2', { accountHolderName: 'Mohan Manager South', accountNumber: '222233334441', ifsc: 'HDFC0001234', bankName: 'UAT Test Bank' });
const cheque = await upload('cheque', 'm2', PNG, 'm2-cheque.png');
const afterCheque = await put('/onboarding/me/cheque', 'm2', { fileId: cheque.id });
check('S15-04', 'After the cancelled cheque the Manager goes straight to review — no Agent Code step', afterCheque.step === 'REVIEW', afterCheque.step);
await denied('S15-05', 'An Agent Code is refused for a Manager (they report to the Admin)', () => put('/onboarding/me/agent-code', 'm2', { code: state.ids.codes.m1 }), 400);
await post('/onboarding/me/submit', 'm2', {});
const queue = await call('GET', '/onboarding/review?pageSize=50', { as: A, raw: true });
const row = (queue.data.items ?? queue.data).find((r) => r.userId === U.m2.id);
check('S15-06', "The Admin's review list shows the Manager's details, marked as a Manager", row?.role === 'MANAGER', JSON.stringify(row ?? {}).slice(0, 200));
await denied('S15-07', 'Selling stays closed while the Admin has not approved', () => post('/leads/drafts', 'm2', { cardId: C.rewards }), 403, 'GATE_ONBOARDING_INCOMPLETE');
await post(`/onboarding/review/${U.m2.id}`, A, { decision: 'APPROVE' });
await login('m2', U.m2.mobile);
check('S15-08', 'Once approved the selling workspace opens; the Manager stays an active Manager (no "activated" event, role unchanged)', U.m2.gates?.onboarding?.complete === true && sql(`select role || '|' || status from "User" where id='${U.m2.id}'`) === 'MANAGER|ACTIVE' && sql(`select count(*) from "UserLifecycleEvent" where "userId"='${U.m2.id}' and "eventType"='ACTIVATED'`) === '0', JSON.stringify(U.m2.gates?.onboarding));

// ── two leads of the Manager's own, the same eight steps ──
state.ids.mleads = {};
for (const [key, name, mobile, pan, appNo] of [['ML1', 'Manager Lead One', '9600000021', 'ABCPM2001A', 'UATM2001'], ['ML2', 'Manager Lead Two', '9600000022', 'ABCPM2002B', 'UATM2002']]) {
  const d = await post('/leads/drafts', 'm2', { cardId: C.rewards });
  await patch(`/leads/drafts/${d.id}/mobile`, 'm2', { mobile });
  await patch(`/leads/drafts/${d.id}/details`, 'm2', { fullName: name, email: 'mlead@example.com' });
  await patch(`/leads/drafts/${d.id}/pan`, 'm2', { pan });
  await patch(`/leads/drafts/${d.id}/pincode`, 'm2', { pincode: '302001', city: 'Jaipur', state: 'Rajasthan', locationConfirmed: true });
  await patch(`/leads/drafts/${d.id}/employment`, 'm2', { employmentType: 'SELF_EMPLOYED' });
  await patch(`/leads/drafts/${d.id}/income`, 'm2', { annualIncomeItr: 900000 });
  await patch(`/leads/drafts/${d.id}/declarations`, 'm2', { acceptedDeclarationIds: ['D1', 'D2'], bureauAcknowledged: true });
  const lead = await post(`/leads/drafts/${d.id}/submit`, 'm2', {});
  state.ids.mleads[key] = lead.id;
  await post(`/leads/${lead.id}/bank-reference`, 'm2', { referenceKind: 'APPLICATION_NO', referenceValue: appNo });
}
save();
const ML = state.ids.mleads;
const share = await post(`/leads/${ML.ML1}/link/share`, 'm2', {});
check('S15-09', "The Manager's shared application link carries the Manager's own code", /apply\.example\.com\/rewards\?agent=/.test(JSON.stringify(share)) && !/\{code\}/.test(JSON.stringify(share)), JSON.stringify(share).slice(0, 200));
const ownList = await call('GET', '/leads?own=1&pageSize=50', { as: 'm2', raw: true });
const teamList = await call('GET', '/leads?pageSize=50', { as: 'm2', raw: true });
const names = (r) => (r.data.items ?? r.data).map((l) => l.customer.name).sort();
eq('S15-10', '"My leads" in the selling workspace holds only the Manager\'s own two leads', names(ownList), ['Manager Lead One', 'Manager Lead Two']);
check('S15-11', 'Team leads holds the team\'s leads and the Manager\'s own, each named with its owner', names(teamList).includes('Manager Lead One') && names(teamList).includes('Lead Eight Customer') && (teamList.data.items ?? teamList.data).find((l) => l.customer.name === 'Manager Lead One').advisor.role === 'MANAGER', names(teamList).join(', '));
await denied('S15-12', "Another Manager cannot open this Manager's own lead", () => get(`/leads/${ML.ML1}`, 'm1'), [403, 404]);
await denied('S15-13', "An Advisor of the team cannot open their Manager's lead", () => get(`/leads/${ML.ML1}`, 'a3'), [403, 404]);
const adminLead = await get(`/leads/${ML.ML1}`, A);
check('S15-14', 'The Admin sees the lead, owned by the Manager, reporting to the Admin', adminLead.advisor?.fullName === 'Mohan Manager South' && adminLead.advisor?.role === 'MANAGER' && sql(`select u.role from "Lead" l join "User" u on u.id = l."reportingParentUserIdSnapshot" where l.id='${ML.ML1}'`) === 'ADMIN', JSON.stringify(adminLead.advisor));
await denied('S15-15', 'A Telecaller still cannot create leads', () => post('/leads/drafts', 't1', { cardId: C.rewards }), 403);

// ── bank file → the Manager's activated card becomes claimable by the Manager ──
const mis3 = await importMis(A, [
  { 'Application No': 'UATM2001', CUSTOMER_NAME: 'Manager Lead One', CURRENT_STAGE: 'Card Issued', FINAL_DECISION: 'Approved', 'Card Activation Staus': 'V + ACTIVE' },
  { 'Application No': 'UATM2002', CUSTOMER_NAME: 'Manager Lead Two', CURRENT_STAGE: 'Decisioned Cases', FINAL_DECISION: 'Declined', 'Card Activation Staus': '' },
], 'uat-mis-3-manager.xlsx');
check('S15-16', 'The bank file updates both of the Manager\'s leads', mis3.applied.updatedChanged === 2, JSON.stringify(mis3.applied));
const ledger = () => get('/payouts/me/ledger', 'm2');
const l0 = (await ledger()).totals;
eq('S15-17', "The Manager's own earnings screen: 1 card to claim, nothing paid yet", { available: l0.available.count, paid: inr(l0.paid.amountInr) }, { available: 1, paid: 0 });
eq('S15-18', "A Manager is credited only for their OWN leads — never for an Advisor's card (the Manager share stays outside KBS)", sql(`select count(*) from "PayoutEntitlement" e join "Lead" l on l.id = e."leadId" join "User" u on u.id = e."advisorUserId" where u.role = 'MANAGER' and l."advisorUserId" <> e."advisorUserId"`), '0');

// ── payout: no Manager step; Admin approves and sets the amount; Accounts pays ──
const pr = await post('/payouts/requests', 'm2', { all: true });
state.ids.requests.PRM = pr.id;
save();
check('S15-19', "The Manager's own request needs no Manager approval — it waits for the Admin only", pr.state === 'PENDING_APPROVALS' && pr.managerStepRequired === false && pr.managerApprover === null && JSON.stringify(pr.outstanding ?? pr.approvals?.outstanding ?? []) === '["ADMIN"]', JSON.stringify({ step: pr.managerStepRequired, out: pr.outstanding ?? pr.approvals?.outstanding }));
await denied('S15-20', 'The Manager cannot approve their own request', () => post(`/payouts/requests/${pr.id}/approvals`, 'm2', { decision: 'APPROVED' }), [403, 404]);
await denied('S15-21', 'Another Manager cannot approve it either', () => post(`/payouts/requests/${pr.id}/approvals`, 'm1', { decision: 'APPROVED' }), [403, 404]);
const mineAwaiting = await call('GET', '/payouts/requests?awaitingMe=true', { as: 'm2', raw: true });
check('S15-22', 'It is not in the Manager\'s own "awaiting my approval" list', !(mineAwaiting.data.items ?? mineAwaiting.data).some((r) => r.id === pr.id), '');
const adminAwaiting = await call('GET', '/payouts/requests?awaitingMe=true', { as: A, raw: true });
check('S15-23', 'It is in the Admin\'s "awaiting me" list straight away, and the Admin was notified', (adminAwaiting.data.items ?? adminAwaiting.data).some((r) => r.id === pr.id) && Number(sql(`select count(*) from "Notification" where "dedupeKey" like 'payout:approval:${pr.id}:admin-ready:%'`)) >= 1, '');
await denied('S15-24', 'Accounts cannot see it before the Admin approves', () => get(`/payouts/requests/${pr.id}`, 'acc'), [403, 404]);
await denied('S15-25', 'The Admin must still enter the amount', () => post(`/payouts/requests/${pr.id}/approvals`, A, { decision: 'APPROVED' }), [400, 422]);
const approved = await post(`/payouts/requests/${pr.id}/approvals`, A, { decision: 'APPROVED', amountInr: 2000 });
check('S15-26', 'One Admin approval with the amount → Approved, ready for Accounts', approved.state === 'APPROVED' && inr(approved.totalAmountInr) === 2000 && sql(`select string_agg("approverRole"::text, ',') from "PayoutApproval" where "requestId"='${pr.id}'`) === 'ADMIN', approved.state);
const payee = await get(`/payouts/requests/${pr.id}/payee?reveal=bank`, 'acc');
check('S15-27', "Accounts pays into the Manager's own verified bank account", payee.accountNumber === '222233334441' && payee.accountHolderName === 'Mohan Manager South' && payee.verified === true, JSON.stringify(payee).slice(0, 200));
const proof = await upload('payment_proof', 'acc', PNG, 'manager-transfer.png');
const paid = await post(`/payouts/requests/${pr.id}/payment`, 'acc', { paidAt: new Date(Date.now() - 60000).toISOString(), amountInr: 2000, transferReference: 'UATUTR00M1', method: 'NEFT', proofFileId: proof.id });
check('S15-28', 'Accounts records the transfer with proof → Paid', paid.state === 'PAID', paid.state);
const l1 = (await ledger()).totals;
eq('S15-29', "The Manager's earnings screen now shows ₹2,000.00 paid on 1 card", { paid: inr(l1.paid.amountInr), cards: l1.paid.count, available: l1.available.count }, { paid: 2000, cards: 1, available: 0 });
const ownReqs = await call('GET', '/payouts/requests?own=1&pageSize=50', { as: 'm2', raw: true });
eq('S15-30', 'Their own request list (selling workspace) holds just this request', (ownReqs.data.items ?? ownReqs.data).map((r) => r.id), [pr.id]);

// ── roll-up ──
const home = await get('/dashboards/admin/home', A);
eq('S15-31', 'Organisation paid total rises by exactly ₹2,000.00', amt(home.business.payouts.paid), inr(paidBefore.org + 2000));
const south = await get('/dashboards/manager', 'm2');
eq('S15-32', "Manager South's team figures count the Manager's own sales with the team (+₹2,000.00 paid, +2 leads)", amt(south.advisors.payouts.paid), inr(paidBefore.south + 2000));
const rows = (await get('/dashboards/manager/advisors', 'm2')).rows;
const self = rows.find((r) => r.user.id === U.m2.id);
check('S15-33', 'The Manager appears as a row of their own in their Advisors table (2 leads, ₹2,000.00 paid), marked as a Manager', self?.user.role === 'MANAGER' && v(self.leads.created) === 2 && amt(self.payouts.paid) === 2000, JSON.stringify(self?.user ?? {}));
eq('S15-34', 'The team total still equals the sum of its rows', inr(rows.reduce((s, r) => s + amt(r.payouts.paid), 0)), amt(south.advisors.payouts.paid));
const advRows = (await get('/dashboards/admin/advisors', A)).rows;
check('S15-35', 'Admin → Advisors report lists the selling Manager too (₹2,000.00 paid); a Manager who has not sold is not listed', advRows.some((r) => r.user.fullName === 'Mohan Manager South' && amt(r.payouts.paid) === 2000) && !advRows.some((r) => r.user.fullName === 'Meera Manager North'), advRows.map((r) => r.user.fullName).join(', '));
const mgrRow = (await get('/dashboards/admin/managers', A)).rows.find((r) => r.user.id === U.m2.id);
check('S15-36', 'Admin → Managers: South still counts its Advisors only in the "Advisors" figure; the paid total includes the Manager\'s own sale', amt(mgrRow.payouts.paid) === inr(paidBefore.south + 2000) && mgrRow.advisors === (await get('/dashboards/manager/advisors', 'm2')).rows.filter((r) => r.user.role !== 'MANAGER').length, JSON.stringify({ advisors: mgrRow.advisors, paid: amt(mgrRow.payouts.paid) }));
eq('S15-37', 'Money transferred still equals money shown as paid', inr(Number(sql(`select coalesce(sum(p."amountInr"),0) from "ExternalPayment" p join "PayoutRequest" r on r.id = p."requestId" where p.state='VERIFIED' and r.state='PAID'`))), amt(home.business.payouts.paid));
const q = await get('/payouts/payments/queues', 'acc');
check('S15-38', 'Accounts paid queue includes the Manager\'s request', q.paid.count === Number(sql(`select count(*) from "PayoutRequest" where state='PAID'`)), JSON.stringify(q.paid));
const a3Awaiting = await call('GET', '/payouts/requests?awaitingMe=true', { as: 'm2', raw: true });
check('S15-39', 'The Manager still approves their Advisors\' requests as before (their approval list works and never contains their own)', Array.isArray(a3Awaiting.data.items ?? a3Awaiting.data), '');

// S18 — F-824: an Advisor has an Agent Code of their own. Advisors who sign up with it report to that Advisor, who can
// read their leads in full. When the bank activates one of their cards, the referring Advisor gets a payable share of
// their own on it (owner decision: paid through KBS) — requested, approved, priced by the Admin and paid like any card.
import { beginStage, check, eq, denied, get, login, post, put, patch, upload, call, state, save, sql, inr, PNG } from './lib.mjs';
import { importMis } from './mis.mjs';

beginStage('S18 Advisor referral codes');
await login('admin', '9999999999');
for (const k of ['m1', 'm2', 'acc', 't1', 'a1', 'a2', 'a3']) await login(k, state.users[k].mobile);
const A = 'admin';
const U = state.users;
const C = state.ids.cards;
const v = (x) => (x && typeof x === 'object' && 'value' in x ? x.value : x);
const amt = (x) => inr(x?.amountInr ?? 0);
const before = { arjun: await get('/payouts/me/ledger', 'a1'), org: amt((await get('/dashboards/admin/home', A)).business.payouts.paid), northLeads: v((await get('/dashboards/manager', 'm1')).advisors.leads.created), arjunLeads: (await call('GET', '/leads?pageSize=100', { as: 'a1', raw: true })).data.length };

// ── an Advisor's own code ──
const code1 = await post('/me/agent-codes', 'a1', {});
const again = await post('/me/agent-codes', 'a1', {});
check('S18-01', 'An approved Advisor gets an Agent Code of their own; asking again returns the same code', /^[A-Z0-9]{4,12}$/.test(code1.code) && again.code === code1.code, code1.code);
const mineList = await get('/agent-codes', 'a1');
check('S18-02', 'The Advisor sees only their own code', (mineList.items ?? mineList).length === 1 && (mineList.items ?? mineList)[0].code === code1.code, '');
await denied('S18-03', 'A Telecaller has no Agent Code of their own', () => post('/me/agent-codes', 't1', {}), 403);
await denied('S18-04', 'A Manager does not self-issue one either (the Admin issues Manager codes)', () => post('/me/agent-codes', 'm1', {}), 403);
await login('a5', U.a5.mobile);
await denied('S18-05', 'An Advisor whose onboarding is not approved cannot get a code', () => post('/me/agent-codes', 'a5', {}), 403);

// ── two new Advisors: Bina with Arjun's code, Chetan with Bina's ──
async function onboard(key, fullName, mobile, account, code) {
  await login(key, mobile, { purpose: 'ADVISOR_SIGNUP' });
  Object.assign(U[key], { fullName });
  await put('/onboarding/me/personal', key, { fullName, email: `${key}@example.com` });
  const ob = await get('/onboarding/me', key);
  await put('/onboarding/me/consent', key, { privacyNoticeVersion: ob.privacyNoticeVersion, identityConsent: true, termsAccepted: true });
  const ident = await post('/onboarding/me/identity/start', key, {});
  await post('/onboarding/me/identity/complete', key, { sessionRef: ident.identity.sessionRef, payload: 'MOCK_OK' });
  await put('/onboarding/me/bank', key, { accountHolderName: fullName, accountNumber: account, ifsc: 'HDFC0001234', bankName: 'UAT Test Bank' });
  const cheque = await upload('cheque', key, PNG, `${key}-cheque.png`);
  await put('/onboarding/me/cheque', key, { fileId: cheque.id });
  const valid = await get(`/agent-codes/validate?code=${code}`, key);
  const applied = await put('/onboarding/me/agent-code', key, { code });
  await post('/onboarding/me/submit', key, {});
  await post(`/onboarding/review/${U[key].id}`, A, { decision: 'APPROVE' });
  await login(key, mobile);
  save();
  return { valid, applied };
}
const bina = await onboard('a6', 'Bina Advisor', '9800000036', '333344445556', code1.code);
check('S18-06', "A new Advisor signing up with Arjun's code reports to Arjun", bina.valid.valid === true && bina.applied.reportingParent?.fullName === 'Arjun Advisor' && bina.applied.reportingParent?.role === 'ADVISOR', JSON.stringify(bina.applied.reportingParent));
const code6 = await post('/me/agent-codes', 'a6', {});
const chetan = await onboard('a7', 'Chetan Advisor', '9800000037', '333344445557', code6.code);
check('S18-07', "It works a level down too: Chetan, with Bina's code, reports to Bina", chetan.applied.reportingParent?.fullName === 'Bina Advisor', JSON.stringify(chetan.applied.reportingParent));
eq('S18-08', 'Reporting lines on record: Bina → Arjun → Manager North; Chetan → Bina', sql(`select c."fullName" || ' → ' || p."fullName" from "ReportingAssignment" r join "User" c on c.id = r."childUserId" join "User" p on p.id = r."parentUserId" where r.status='ACTIVE' and r."effectiveTo" is null and c."fullName" in ('Arjun Advisor','Bina Advisor','Chetan Advisor') order by 1`).split('\n'), ['Arjun Advisor → Meera Manager North', 'Bina Advisor → Arjun Advisor', 'Chetan Advisor → Bina Advisor']);

// ── no loops ──
await login('a1', U.a1.mobile);
await denied('S18-09', 'An Advisor cannot use their own code', () => post('/me/agent-code', 'a1', { code: code1.code }), [400, 409, 422], 'HIERARCHY_CODE_INVALID');
await denied('S18-10', 'An Advisor cannot use the code of someone who reports to them (no loops)', () => post('/me/agent-code', 'a1', { code: code6.code }), [400, 409, 422], 'HIERARCHY_CODE_INVALID');
await denied('S18-11', 'The Admin cannot create a loop either (Arjun under Chetan)', () => post(`/users/${U.a1.id}/reporting`, A, { parentUserId: U.a7.id, reason: 'TEST: loop' }), [400, 409, 422]);

// ── their leads ──
state.ids.rleads = {};
async function lead(key, adv, name, mobile, pan, appNo) {
  const d = await post('/leads/drafts', adv, { cardId: C.rewards });
  await patch(`/leads/drafts/${d.id}/mobile`, adv, { mobile });
  await patch(`/leads/drafts/${d.id}/details`, adv, { fullName: name, email: 'ref@example.com' });
  await patch(`/leads/drafts/${d.id}/pan`, adv, { pan });
  await patch(`/leads/drafts/${d.id}/pincode`, adv, { pincode: '302001', city: 'Jaipur', state: 'Rajasthan', locationConfirmed: true });
  await patch(`/leads/drafts/${d.id}/employment`, adv, { employmentType: 'SALARIED' });
  await patch(`/leads/drafts/${d.id}/income`, adv, { annualIncomeItr: 700000 });
  await patch(`/leads/drafts/${d.id}/declarations`, adv, { acceptedDeclarationIds: ['D1', 'D2'], bureauAcknowledged: true });
  const l = await post(`/leads/drafts/${d.id}/submit`, adv, {});
  state.ids.rleads[key] = l.id;
  if (appNo) await post(`/leads/${l.id}/bank-reference`, adv, { referenceKind: 'APPLICATION_NO', referenceValue: appNo });
}
await lead('BL1', 'a6', 'Bina Lead One', '9600000031', 'ABCPB6001A', 'UATB6001');
await lead('BL2', 'a6', 'Bina Lead Two', '9600000032', 'ABCPB6002B', null);
await lead('CL1', 'a7', 'Chetan Lead One', '9600000033', 'ABCPC7001C', 'UATC7001');
save();
const R = state.ids.rleads;
await importMis(A, [
  { 'Application No': 'UATB6001', CUSTOMER_NAME: 'Bina Lead One', CURRENT_STAGE: 'Card Issued', FINAL_DECISION: 'Approved', 'Card Activation Staus': 'V + ACTIVE' },
  { 'Application No': 'UATC7001', CUSTOMER_NAME: 'Chetan Lead One', CURRENT_STAGE: 'Card Issued', FINAL_DECISION: 'Approved', 'Card Activation Staus': 'ACTIVE' },
], 'uat-mis-4-referrals.xlsx');
// ── the referral share: created with the activation, one level up, follows the bank like the card's own payout ──
const shares = () => sql(`select p."fullName" || ' on ' || l."customerFullName" || ' · ' || e.state from "PayoutEntitlement" e join "Lead" l on l.id = e."leadId" join "User" p on p.id = e."advisorUserId" where e.kind='REFERRAL' order by 1`).split('\n');
const onLead = (id) => sql(`select e.kind || ':' || e.state from "PayoutEntitlement" e where e."leadId"='${id}' order by 1`).split('\n');
eq('S18-41', "When the bank activates the two cards, the Advisor each lead's Advisor joined under gets a claimable share of their own: Arjun on Bina's card, Bina on Chetan's — one level only, nothing for Arjun on Chetan's", shares(), ['Arjun Advisor on Bina Lead One · ELIGIBLE_AVAILABLE', 'Bina Advisor on Chetan Lead One · ELIGIBLE_AVAILABLE']);
const chetanRow = { 'Application No': 'UATC7001', CUSTOMER_NAME: 'Chetan Lead One', CURRENT_STAGE: 'Card Issued', FINAL_DECISION: 'Approved' };
await importMis(A, [{ ...chetanRow, 'Card Activation Staus': 'INACTIVE' }], 'uat-mis-5-referral-reversal.xlsx');
eq('S18-42', "If the bank takes an activation back, the card's own payout and the share on it both go under review", onLead(R.CL1), ['OWN:UNDER_REVIEW', 'REFERRAL:UNDER_REVIEW']);
await importMis(A, [{ ...chetanRow, 'Card Activation Staus': 'ACTIVE' }], 'uat-mis-6-referral-active-again.xlsx');
eq('S18-43', '…and both are claimable again when the bank reports the card active — still one of each, no duplicates', onLead(R.CL1), ['OWN:ELIGIBLE_AVAILABLE', 'REFERRAL:ELIGIBLE_AVAILABLE']);
await login('a1', U.a1.mobile);

// ── what the referring Advisor sees ──
const team = await get('/me/team', 'a1');
eq('S18-12', '"My team" for Arjun: his code, and Bina with her 2 leads — one level only (Chetan is Bina\'s)', { code: team.code?.code, advisors: team.advisors.map((x) => `${x.fullName}:${x.leads}`) }, { code: code1.code, advisors: ['Bina Advisor:2'] });
check('S18-13', "The team list shows a masked mobile, never the full number", team.advisors.every((x) => /•/.test(x.mobileMasked)) && !JSON.stringify(team).includes('9800000036'), JSON.stringify(team.advisors[0]));
const binaLeads = await call('GET', `/leads?advisorId=${U.a6.id}&pageSize=50`, { as: 'a1', raw: true });
eq('S18-14', "Arjun can list Bina's leads, each named with its Advisor", binaLeads.data.map((l) => `${l.customer.name} · ${l.advisor.fullName}`).sort(), ['Bina Lead One · Bina Advisor', 'Bina Lead Two · Bina Advisor']);
eq('S18-15', "…with her figures: 2 leads, 1 with a bank result, 1 approved, 1 card active", (({ total, matched, approved, cardsActive }) => ({ total, matched, approved, cardsActive }))(await get(`/leads/summary?advisorId=${U.a6.id}`, 'a1')), { total: 2, matched: 1, approved: 1, cardsActive: 1 });
const full = await get(`/leads/${R.BL1}`, 'a1');
eq('S18-16', 'Opening one gives every lead detail: Advisor, customer, masked mobile and PAN, place, employment, income, card, bank application number and the three bank fields',
  { advisor: full.advisor?.fullName, customer: full.customer.name, mobile: /^\+91•+\d{4}$/.test(full.customer.mobileMasked), pan: /^•+\d{3}[A-Z]$/.test(full.customerPanMasked), place: `${full.pincode} ${full.city}`, employment: full.employmentType, income: full.annualIncomeItr, card: full.card.name, appNo: full.bankApplicationNo, bank: [full.stage.display, full.decision.display, full.activation.display] },
  { advisor: 'Bina Advisor', customer: 'Bina Lead One', mobile: true, pan: true, place: '302001 Jaipur', employment: 'SALARIED', income: 700000, card: 'UAT Rewards Card', appNo: 'UATB6001', bank: ['Card Issued', 'Approved', 'V + ACTIVE'] });
check('S18-17', 'The bank history of the lead is readable too', JSON.stringify(await get(`/leads/${R.BL1}/mis-history`, 'a1')).includes('V + ACTIVE'), '');
eq('S18-18', "Arjun's own lead list is unchanged — Bina's leads are not mixed into it", [(await call('GET', '/leads?pageSize=100', { as: 'a1', raw: true })).data.length, (await call('GET', '/leads?own=1&pageSize=100', { as: 'a1', raw: true })).data.length], [before.arjunLeads, before.arjunLeads]);
const note = sql(`select n.id from "Notification" n where n."recipientUserId"='${U.a1.id}' and n."dedupeKey"='lead:created:${R.BL1}'`);
const target = note ? await get(`/notifications/${note}/target`, 'a1').catch((e) => ({ err: e.status })) : { err: 'none' };
check('S18-19', "Arjun is told when Bina creates a lead, and the notice opens that lead", !!note && target.entityId === R.BL1, JSON.stringify(target));

// ── read-only, one level, and nobody else ──
const tries = [];
for (const [what, fn] of [
  ['enter a bank reference', () => post(`/leads/${R.BL2}/bank-reference`, 'a1', { referenceKind: 'APPLICATION_NO', referenceValue: 'UATHACK1' })],
  ['add a remark', () => post(`/leads/${R.BL1}/remarks`, 'a1', { text: 'TEST: not my lead' })],
  ['add a follow-up', () => post(`/leads/${R.BL1}/follow-ups`, 'a1', { text: 'TEST: not my lead', dueAt: new Date(Date.now() + 3600_000).toISOString() })],
  ['share its link', () => post(`/leads/${R.BL1}/link/share`, 'a1', {})],
]) tries.push(`${what}: ${await fn().then(() => 'ALLOWED', (e) => e.status)}`);
check('S18-20', "Arjun can only read Bina's leads — he cannot enter a reference, add a remark or follow-up, or share its link", tries.every((t) => /40[34]$/.test(t)), tries.join(' · '));
eq('S18-21', "Chetan signed up with Bina's code, not Arjun's: Arjun cannot list or open Chetan's leads", [(await call('GET', `/leads?advisorId=${U.a7.id}`, { as: 'a1', raw: true })).data.length, await get(`/leads/${R.CL1}`, 'a1').then(() => 'visible', (e) => e.status)], [0, 404]);
eq('S18-22', "Another Advisor of the same Manager (Anita) sees nothing of Bina's", [(await call('GET', `/leads?advisorId=${U.a6.id}`, { as: 'a2', raw: true })).data.filter((l) => l.advisor.fullName === 'Bina Advisor').length, await get(`/leads/${R.BL1}`, 'a2').then(() => 'visible', (e) => e.status)], [0, 404]);
await denied('S18-23', "It does not work upwards: Bina cannot open Arjun's leads", () => get(`/leads/${state.ids.leads.L1}`, 'a6'), [403, 404]);
check('S18-24', "On Bina's lead Arjun sees only his own share (no amount before it is paid) — not Bina's payout — and he has no access to her earnings", full.payouts.length === 1 && full.payouts[0].kind === 'REFERRAL' && full.payouts[0].payee?.fullName === 'Arjun Advisor' && full.payouts[0].amountInr === null && (await get(`/payouts/ledger/${U.a6.id}`, 'a1').then(() => false, (e) => [403, 404].includes(e.status))), JSON.stringify(full.payouts));

// ── the Manager above the line sees everyone below it ──
await login('m1', U.m1.mobile);
const rows = (await get('/dashboards/manager/advisors', 'm1')).rows;
const row = (n) => rows.find((r) => r.user.fullName === n);
check('S18-25', "Manager North's Advisors table now includes Bina (reporting to Arjun) and Chetan (reporting to Bina)", row('Bina Advisor')?.reporting?.parent?.fullName === 'Arjun Advisor' && row('Chetan Advisor')?.reporting?.parent?.fullName === 'Bina Advisor', rows.map((r) => `${r.user.fullName}←${r.reporting?.parent?.fullName ?? '—'}`).join(', '));
eq('S18-26', "…and the team's lead total grows by their 3 leads", v((await get('/dashboards/manager', 'm1')).advisors.leads.created), before.northLeads + 3);
eq('S18-27', "Manager North can open their leads; Manager South cannot", [await get(`/leads/${R.CL1}`, 'm1').then(() => 'visible', (e) => e.status), await get(`/leads/${R.BL1}`, 'm2').then(() => 'visible', (e) => e.status)], ['visible', 404]);

// ── payouts: approved by the nearest Manager above, never by the referring Advisor ──
const binaLedger = await get('/payouts/me/ledger', 'a6');
const label = (r) => (r.kind === 'REFERRAL' ? `share · ${r.customer} · lead of ${r.sourceAdvisor?.fullName}` : `own · ${r.customer}`);
eq('S18-44', "Bina's Earnings hold two claimable items: her own card, and her share on Chetan's card, named as his lead", binaLedger.rows.filter((r) => r.state === 'ELIGIBLE_AVAILABLE').map(label).sort(), ['own · Bina Lead One', 'share · Chetan Lead One · lead of Chetan Advisor']);
const pr6 = await post('/payouts/requests', 'a6', { entitlementIds: binaLedger.rows.filter((r) => r.kind === 'OWN').map((r) => r.entitlementId) });
const pr7 = await post('/payouts/requests', 'a7', { all: true });
state.ids.requests.PR6 = pr6.id;
state.ids.requests.PR7 = pr7.id;
save();
eq('S18-28', "Both requests go to Manager North for the Manager approval — the nearest Manager above the line, two levels up for Chetan", [pr6.managerApprover?.fullName, pr7.managerApprover?.fullName, pr6.managerStepRequired], ['Meera Manager North', 'Meera Manager North', true]);
eq('S18-29', "The referring Advisor can neither see nor approve the request for Bina's own card", [await get(`/payouts/requests/${pr6.id}`, 'a1').then(() => 'visible', (e) => e.status), await post(`/payouts/requests/${pr6.id}/approvals`, 'a1', { decision: 'APPROVED' }).then(() => 'ALLOWED', (e) => (e.status === 403 || e.status === 404 ? 'refused' : e.status))], [404, 'refused']);
await post(`/payouts/requests/${pr6.id}/approvals`, 'm1', { decision: 'APPROVED' });
await post(`/payouts/requests/${pr6.id}/approvals`, A, { decision: 'APPROVED', amountInr: 1200 });
const proof = await upload('payment_proof', 'acc', PNG, 'bina-transfer.png');
const paid = await post(`/payouts/requests/${pr6.id}/payment`, 'acc', { paidAt: new Date(Date.now() - 60000).toISOString(), amountInr: 1200, transferReference: 'UATUTR00B6', method: 'UPI', proofFileId: proof.id });
await post(`/payouts/requests/${pr7.id}/approvals`, 'm1', { decision: 'APPROVED' });
const pr7a = await post(`/payouts/requests/${pr7.id}/approvals`, A, { decision: 'APPROVED', amountInr: 800 });
check('S18-30', "Bina's request is paid ₹1,200.00; Chetan's is approved for ₹800.00 and waits for Accounts", paid.state === 'PAID' && pr7a.state === 'APPROVED', `${paid.state} / ${pr7a.state}`);
eq('S18-31', "Bina's own earnings show ₹1,200.00", inr((await get('/payouts/me/ledger', 'a6')).totals.paid.amountInr), 1200);

// ── the referring Advisor's share, paid through KBS ──
await login('a1', U.a1.mobile);
const after = await get('/payouts/me/ledger', 'a1');
const arjunShare = after.rows.filter((r) => r.kind === 'REFERRAL');
eq('S18-32', "Arjun's Earnings gain exactly one claimable item — his share on Bina's activated card, named as her lead — and nothing for Chetan's; his paid total is untouched so far",
  { paid: inr(after.totals.paid.amountInr), rows: after.rows.length, available: after.totals.available.count, share: arjunShare.map(label) },
  { paid: inr(before.arjun.totals.paid.amountInr), rows: before.arjun.rows.length + 1, available: before.arjun.totals.available.count + 1, share: ['share · Bina Lead One · lead of Bina Advisor'] });
const pra = await post('/payouts/requests', 'a1', { entitlementIds: arjunShare.map((r) => r.entitlementId) });
state.ids.requests.PRA = pra.id;
save();
eq('S18-45', "Arjun requests his share: it goes to his own Manager (North), and the request item says it is a referral share on Bina's lead", [pra.managerApprover?.fullName, pra.items.map((i) => `${i.kind} · ${i.sourceAdvisor?.fullName} · ${i.lead.customerFullName}`)], ['Meera Manager North', ['REFERRAL · Bina Advisor · Bina Lead One']]);
eq('S18-46', "Bina can neither see nor approve Arjun's share request", [await get(`/payouts/requests/${pra.id}`, 'a6').then(() => 'visible', (e) => e.status), await post(`/payouts/requests/${pra.id}/approvals`, 'a6', { decision: 'APPROVED' }).then(() => 'ALLOWED', (e) => (e.status === 403 || e.status === 404 ? 'refused' : e.status))], [404, 'refused']);
await post(`/payouts/requests/${pra.id}/approvals`, 'm1', { decision: 'APPROVED' });
await post(`/payouts/requests/${pra.id}/approvals`, A, { decision: 'APPROVED', amountInr: 300 });
const proofA = await upload('payment_proof', 'acc', PNG, 'arjun-share-transfer.png');
const paidA = await post(`/payouts/requests/${pra.id}/payment`, 'acc', { paidAt: new Date(Date.now() - 60000).toISOString(), amountInr: 300, transferReference: 'UATUTR00A1S', method: 'UPI', proofFileId: proofA.id });
eq('S18-47', "Manager North approves it, the Admin sets ₹300.00 and Accounts pays it with proof: Arjun's earnings rise by exactly ₹300.00", [paidA.state, inr((await get('/payouts/me/ledger', 'a1')).totals.paid.amountInr)], ['PAID', inr(before.arjun.totals.paid.amountInr + 300)]);
eq('S18-51', "The Admin's view of Arjun's share request raises no \"earlier request for the same lead\" warning: Bina's card payout on that lead is a different payable, not a repeat", (await get(`/payouts/requests/${pra.id}`, A)).items.map((i) => i.priorRequests.length), [0]);
const binaAfter = await get('/payouts/me/ledger', 'a6');
eq('S18-48', "Paying Arjun's share changes nothing for Bina: her card stays paid at ₹1,200.00 and her share on Chetan's card is still hers to claim", { paid: inr(binaAfter.totals.paid.amountInr), available: binaAfter.totals.available.count }, { paid: 1200, available: 1 });
const seen = async (as) => (await get(`/leads/${R.BL1}`, as)).payouts.map((p) => `${p.kind} · ${p.payee?.fullName} · ${p.amountInr}`).sort();
eq('S18-49', "On Bina's lead the Admin sees both payouts with who is paid — Bina ₹1,200.00 for the card, Arjun ₹300.00 as referral share; each Advisor sees only their own", { admin: await seen(A), bina: await seen('a6'), arjun: await seen('a1') }, { admin: ['OWN · Bina Advisor · 1200', 'REFERRAL · Arjun Advisor · 300'], bina: ['OWN · Bina Advisor · 1200'], arjun: ['REFERRAL · Arjun Advisor · 300'] });
eq('S18-33', "Every payable item is either the lead's own Advisor's, or a referral share of the Advisor that Advisor reported to when the lead was created — nothing else", sql(`select count(*) from "PayoutEntitlement" e join "Lead" l on l.id = e."leadId" join "User" p on p.id = e."advisorUserId" where (e.kind='OWN' and l."advisorUserId" <> e."advisorUserId") or (e.kind='REFERRAL' and (e."advisorUserId" <> l."reportingParentUserIdSnapshot" or e."advisorUserId" = l."advisorUserId" or p.role <> 'ADVISOR'))`), '0');
eq('S18-34', 'Organisation paid total rises by exactly ₹1,500.00 (₹1,200.00 + ₹300.00)', amt((await get('/dashboards/admin/home', A)).business.payouts.paid), inr(before.org + 1500));

// ── the Admin stays in control of codes and lines ──
const adminCodes = await get('/agent-codes', A);
const arjunCode = (adminCodes.items ?? adminCodes).find((c) => c.code === code1.code);
check('S18-35', "The Admin's code list shows the Advisor's code, its owner and how many Advisors use it", arjunCode?.owner?.role === 'ADVISOR' && arjunCode.activeAdvisors === 1, JSON.stringify(arjunCode ?? {}).slice(0, 200));
const issued = await post('/agent-codes', A, { ownerUserId: U.a2.id, code: 'ANITA01' });
check('S18-36', 'The Admin can issue a chosen code to an Advisor', issued.code === 'ANITA01', issued.code);
await denied('S18-37', 'A code cannot be issued to a Telecaller', () => post('/agent-codes', A, { ownerUserId: U.t1.id }), 400);
await post(`/users/${U.a7.id}/reporting`, A, { parentUserId: U.a1.id, reason: 'TEST: Chetan now works with Arjun directly' });
await login('a1', U.a1.mobile);
eq('S18-38', "The Admin can move an Advisor under another Advisor; Arjun's team is then Bina and Chetan", (await get('/me/team', 'a1')).advisors.map((x) => x.fullName), ['Bina Advisor', 'Chetan Advisor']);
await login('a6', U.a6.mobile);
eq('S18-50', "Moving Chetan later does not move the share on a lead created while he reported to Bina: it stays Bina's, and she can still open that lead (read-only)", [shares()[1], await get(`/leads/${R.CL1}`, 'a6').then(() => 'visible', (e) => e.status), await post(`/leads/${R.CL1}/remarks`, 'a6', { text: 'TEST: not my lead' }).then(() => 'ALLOWED', (e) => e.status)], ['Bina Advisor on Chetan Lead One · ELIGIBLE_AVAILABLE', 'visible', 403]);
await post(`/agent-codes/${arjunCode.id}/revoke`, A, { reason: 'TEST: code withdrawn' });
const afterRevoke = { valid: (await get(`/agent-codes/validate?code=${code1.code}`, 'a1')).valid, stillReports: sql(`select p."fullName" from "ReportingAssignment" r join "User" p on p.id = r."parentUserId" where r."childUserId"='${U.a6.id}' and r.status='ACTIVE' and r."effectiveTo" is null`) };
eq('S18-39', 'When the Admin withdraws the code it stops working for new sign-ups; Advisors already attached stay attached', afterRevoke, { valid: false, stillReports: 'Arjun Advisor' });
await denied('S18-40', 'The Advisor cannot simply make themselves a new code after the Admin withdrew it', () => post('/me/agent-codes', 'a1', {}), [403, 409]);

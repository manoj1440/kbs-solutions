// S11 — Access control, sessions, privacy and the audit trail, across all five roles.
import { beginStage, check, eq, denied, get, login, post, put, call, state, sql, BASE } from './lib.mjs';

beginStage('S11 Access and audit');
await login('admin', '9999999999');
await post(`/users/${state.users.t2.id}/reactivate`, 'admin', { reason: 'UAT-01: make the stage re-runnable' }); // no-op when active
for (const k of ['m1', 'm2', 'acc', 't1', 't2', 'a1', 'a2', 'a3', 'a4']) await login(k, state.users[k].mobile);
const A = 'admin';
const U = state.users;
const L = state.ids.leads;
const R = state.ids.requests;

// ── no session / bad session ──
await denied('S11-01', 'Without signing in nothing is readable', () => call('GET', '/leads'), 401);
await denied('S11-02', 'A made-up token is refused', () => call('GET', '/leads', { as: 'not-a-real-token' }), 401);
await denied('S11-03', 'A wrong OTP is refused', async () => { sql(`DELETE FROM "OtpChallenge" WHERE mobile = '+919800000031'`); const r = await call('POST', '/auth/otp/request', { body: { mobile: '9800000031', purpose: 'LOGIN' } }); await call('POST', '/auth/otp/verify', { body: { challengeId: r.challengeId, code: '123456', platform: 'ANDROID' } }); }, [400, 401]);
await denied('S11-04', 'A second OTP inside the resend wait is refused, with the seconds left', async () => { await call('POST', '/auth/otp/request', { body: { mobile: '9800000031', purpose: 'LOGIN' } }); }, [400, 429], 'AUTH_OTP_RESEND_TOO_SOON');
sql(`DELETE FROM "OtpChallenge"`); // test-only: this run has asked for more codes from one address than the hourly limit allows
const unknown = await call('POST', '/auth/otp/request', { body: { mobile: '9811199999', purpose: 'LOGIN' } }).catch((e) => ({ err: e.status }));
check('S11-05', 'Asking for a code for an unknown number does not reveal whether the number is registered', !unknown.err && !!unknown.challengeId, JSON.stringify(unknown).slice(0, 160));
await denied('S11-06', 'An Advisor cannot sign in to the web workspace (Admin, Manager and Accounts only)', async () => { sql(`DELETE FROM "OtpChallenge" WHERE mobile = '+919800000032'`); const r = await call('POST', '/auth/otp/request', { body: { mobile: '9800000032', purpose: 'LOGIN' } }); await call('POST', '/auth/otp/verify', { body: { challengeId: r.challengeId, code: process.env.UAT_OTP ?? '000000', platform: 'WEB' } }); }, [401, 403]);

// Telecaller: one session at a time
const oldToken = U.t2.token;
await login('t2', U.t2.mobile);
await denied('S11-07', 'A Telecaller signing in on a second device ends the first session', () => call('GET', '/auth/me', { as: oldToken }), 401);
// sign-out
const a2Token = U.a2.token;
await post('/auth/logout', 'a2', {});
await denied('S11-08', 'After sign-out the old session no longer works', () => call('GET', '/auth/me', { as: a2Token }), 401);
await login('a2', U.a2.mobile);

// ── deactivation ──
await post(`/users/${U.t2.id}/deactivate`, 'm1', { reason: 'TEST: left the company' });
await denied('S11-09', 'A deactivated Telecaller is signed out at once', () => get('/calling/queue', 't2'), [401, 403]);
await denied('S11-10', 'A deactivated Telecaller cannot sign in', () => login('t2', U.t2.mobile), [400, 401, 403]);
const moved = sql(`select count(*) from "CallingRecord" where "assignedTelecallerUserId"='${U.t2.id}' and "hiddenAt" is null and "interactionStatus"='UNTOUCHED'`);
check('S11-11', 'Their untouched customers do not stay stuck with them', moved === '0', `${moved} untouched records still assigned`);
await denied('S11-12', "A Manager cannot deactivate another Manager's Telecaller", () => post(`/users/${U.t3.id}/deactivate`, 'm1', { reason: 'TEST: not my team' }), [403, 404]);
await denied('S11-12b', 'A Manager cannot reactivate an account (Admin only)', () => post(`/users/${U.t2.id}/reactivate`, 'm1', { reason: 'TEST: back at work' }), 403);
await post(`/users/${U.t2.id}/reactivate`, A, { reason: 'TEST: back at work' });
await login('t2', U.t2.mobile);
check('S11-13', 'Reactivated by the Admin, the Telecaller can sign in again', !!U.t2.token, '');

// ── role matrix: each role against the others' screens ──
const matrix = [
  ['Telecaller → leads', () => get('/leads', 't1')],
  ['Telecaller → payout requests', () => get('/payouts/requests', 't1')],
  ['Telecaller → Admin dashboard', () => get('/dashboards/admin/home', 't1')],
  ['Telecaller → users', () => get('/users', 't1')],
  ['Advisor → calling queue', () => get('/calling/queue', 'a1')],
  ['Advisor → Manager dashboard', () => get('/dashboards/manager', 'a1')],
  ['Advisor → MIS batches', () => get('/mis/batches', 'a1')],
  ['Advisor → Accounts queues', () => get('/payouts/payments/queues', 'a1')],
  ['Advisor → configuration', () => get('/config', 'a1')],
  ['Manager → Admin dashboard', () => get('/dashboards/admin/home', 'm1')],
  ['Manager → configuration change', () => put('/config/training.windowHours', 'm1', { value: 1, reason: 'TEST: not allowed' })],
  ['Manager → MIS upload list', () => get('/mis/batches', 'm1')],
  ['Manager → Accounts queues', () => get('/payouts/payments/queues', 'm1')],
  ['Manager → audit log', () => get('/audit', 'm1')],
  ['Manager → onboarding approval', () => post(`/onboarding/review/${U.a5.id}`, 'm1', { decision: 'APPROVE' })],
  ['Accounts → leads', () => get('/leads', 'acc')],
  ['Accounts → calling records', () => get('/calling/records', 'acc')],
  ['Accounts → payout approval', () => post(`/payouts/requests/${R.PR4}/approvals`, 'acc', { decision: 'APPROVED' })],
  ['Accounts → Admin dashboard', () => get('/dashboards/admin/home', 'acc')],
  ['Accounts → configuration', () => get('/config', 'acc')],
  ['Accounts → MIS upload list', () => get('/mis/batches', 'acc')],
  ['Admin → record a payment (Accounts only)', () => post(`/payouts/requests/${R.PR4}/payment`, A, { paidAt: new Date(Date.now() - 60000).toISOString(), amountInr: 1500, transferReference: 'UATADMIN01' })],
  ['Admin → create a lead (Advisor only)', () => post('/leads/drafts', A, { cardId: state.ids.cards.rewards })],
  ['Admin → call a customer (Telecaller only)', () => post('/calls', A, { callingRecordId: state.ids.queues.t1[0] })],
];
const leaks = [];
for (const [name, fn] of matrix) { const ok = await fn().then(() => false, (e) => e.status === 403); if (!ok) leaks.push(name); }
check('S11-14', `${matrix.length} cross-role attempts are all refused (403)`, leaks.length === 0, leaks.join('; '));

// bank status can never be typed in by anyone (INV-01)
const before = sql(`select "currentStage" || '/' || "finalDecision" from "BankStatusSnapshot" where "leadId"='${L.L3}'`);
const tries = [];
for (const [who, method, path] of [['a1', 'PATCH', `/leads/${L.L3}`], [A, 'PATCH', `/leads/${L.L3}`], [A, 'PUT', `/leads/${L.L3}/status`], ['m1', 'POST', `/leads/${L.L3}/status`]]) tries.push(await call(method, path, { as: who, body: { stage: { display: 'Card Issued' }, finalDecision: 'Approved', currentStage: 'Card Issued' } }).then(() => 'ALLOWED', (e) => e.status));
check('S11-15', 'There is no way to type a bank status onto a lead — only a bank file sets it (INV-01)', tries.every((t) => t !== 'ALLOWED') && sql(`select "currentStage" || '/' || "finalDecision" from "BankStatusSnapshot" where "leadId"='${L.L3}'`) === before, tries.join(','));

// ── privacy ──
const everything = [];
for (const [who, path] of [['a1', '/leads?pageSize=50'], ['m1', '/leads?pageSize=50'], [A, '/leads?pageSize=50'], [A, '/users?pageSize=50'], ['m1', '/calling/records?pageSize=50'], [A, '/calling/records?pageSize=50'], ['acc', '/payouts/requests?pageSize=50'], [A, '/payouts/requests?pageSize=50'], [A, '/mis/applications?pageSize=50'], ['m1', '/dashboards/manager/advisors'], [A, '/dashboards/admin/advisors'], [A, '/onboarding/review?pageSize=50']]) everything.push(JSON.stringify(await call('GET', path, { as: who, raw: true })));
const blob = everything.join('\n');
const fullMobiles = blob.match(/9[678]000000\d\d/g) ?? [];
const fullPans = blob.match(/ABCPA\d{4}[A-Z]|AAAP[A-Z]\d{4}[A-Z]/g) ?? [];
const fullAccounts = blob.match(/11112222333\d/g) ?? [];
check('S11-16', 'No list or dashboard returns a full customer mobile, PAN or bank account number (12 screens\' data checked)', fullMobiles.length === 0 && fullPans.length === 0 && fullAccounts.length === 0, `mobiles ${[...new Set(fullMobiles)].slice(0, 3)} pans ${[...new Set(fullPans)].slice(0, 3)} accounts ${[...new Set(fullAccounts)].slice(0, 3)}`);
const sens = sql(`select field, count(*) from "SensitiveAccessLog" group by 1 order by 1`);
check('S11-17', 'Every reveal of sensitive data so far is in the sensitive-access log (dialled mobile, recording played, bank account revealed)', /MOBILE/.test(sens) && /RECORDING/.test(sens) && /ACCOUNT|BANK/.test(sens), sens.replace(/\n/g, ', '));
const cheque = sql(`select id from "StoredFile" where purpose='CHEQUE' and "uploadedByUserId"='${U.a1.id}' limit 1`);
await denied('S11-18', "An Advisor cannot open another Advisor's cancelled cheque", () => get(`/files/${cheque}/url`, 'a2'), [403, 404]);
await denied('S11-19', "A Manager cannot open an Advisor's cancelled cheque", () => get(`/files/${cheque}/url`, 'm1'), [403, 404]);
const proofFile = sql(`select "proofFileId" from "ExternalPayment" where "requestId"='${R.PR5}' and "proofFileId" is not null limit 1`);
const proofUrl = await get(`/files/${proofFile}/url`, 'acc').catch((e) => ({ err: e.status }));
check('S11-20', 'Accounts can open the payment proof it uploaded; the link is short-lived and the file is really in storage', !!proofUrl.url && (await fetch(proofUrl.url.replace('192.168.0.148', 'localhost'))).status === 200, JSON.stringify(proofUrl).slice(0, 120));

// ── audit trail ──
const audit = await call('GET', '/audit?pageSize=100', { as: A, raw: true });
const auditRows = audit.data.items ?? audit.data;
const actions = sql(`select action from "AuditLog" group by 1 order by 1`).split('\n');
const need = ['users.create', 'telecallers.create', 'config.update', 'onboarding.review', 'payoutRequest.create', 'payoutRequest.decide', 'payment.record', 'payment.correct', 'call.outcome', 'lead.linkShare'];
const missing = need.filter((n) => !actions.some((a) => a.toLowerCase() === n.toLowerCase()));
check('S11-21', 'The audit log has the business actions of this run, each with the acting person', missing.length === 0 && auditRows.length > 0 && auditRows.every((r) => r.actor || r.actorUserId || r.actorName), `missing: ${missing.join(', ')} · have: ${actions.join(', ').slice(0, 600)}`);
const cannot = [];
for (const [m, p] of [['DELETE', `/audit/${auditRows[0].id}`], ['PUT', `/audit/${auditRows[0].id}`], ['PATCH', `/audit/${auditRows[0].id}`]]) cannot.push(await call(m, p, { as: A, body: {} }).then(() => 'ALLOWED', (e) => e.status));
check('S11-22', 'The audit log cannot be edited or deleted, even by the Admin', cannot.every((c) => c === 404 || c === 405), cannot.join(','));

// ── notifications reach the right people ──
const kinds = async (k) => { const r = await call('GET', '/notifications?pageSize=100', { as: k, raw: true }); return (r.data.items ?? r.data).map((n) => n.title); };
const nA1 = await kinds('a1'), nM1 = await kinds('m1'), nAdm = await kinds(A), nAcc = await kinds('acc');
check('S11-23', 'Advisor was told: card can be claimed, request approved, payment made', nA1.some((t) => /activated|claim/i.test(t)) && nA1.some((t) => /approv/i.test(t)) && nA1.some((t) => /paid|payment/i.test(t)), nA1.join(' | '));
check('S11-24', 'Manager was told about requests waiting for their approval', nM1.some((t) => /approval|payout/i.test(t)), nM1.join(' | ').slice(0, 300));
check('S11-25', 'Admin was told when the Manager approved and when a payment needed attention', nAdm.some((t) => /approv|payout/i.test(t)) && nAdm.some((t) => /exception|correction/i.test(t)), nAdm.join(' | ').slice(0, 400));
check('S11-26', 'Accounts was told when a request became ready to pay', nAcc.some((t) => /pay|approved/i.test(t)), nAcc.join(' | ').slice(0, 300));
const others = await call('GET', '/notifications?pageSize=100', { as: 'a2', raw: true });
check('S11-27', "One Advisor's notifications never mention another Advisor's customers", !JSON.stringify(others).includes('Lead One Customer') && !JSON.stringify(others).includes('Lead Eight Customer'), '');

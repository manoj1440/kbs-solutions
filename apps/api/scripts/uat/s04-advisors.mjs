// S04 — Advisors (FOS) register themselves, complete onboarding, and the Admin reviews them.
import { beginStage, check, eq, denied, get, login, post, put, upload, call, state, save, sql, PNG } from './lib.mjs';

beginStage('S04 Advisor onboarding');
await login('admin', '9999999999');
for (const k of ['m1', 'm2', 'acc']) await login(k, state.users[k].mobile);
const A = 'admin';

const PEOPLE = [
  ['a1', 'Arjun Advisor', '9800000031', 'm1', '111122223331'],
  ['a2', 'Anita Advisor', '9800000032', 'm1', '111122223332'],
  ['a3', 'Aman Advisor', '9800000033', 'm2', '111122223333'],
  ['a4', 'Alok Advisor', '9800000034', null, '111122223334'],
  ['a5', 'Rita Rejected', '9800000035', 'm2', '111122223335'],
];

async function onboard(key, fullName, mobile, mgr, account) {
  const v = state.users[key]?.token ? null : await login(key, mobile, { purpose: 'ADVISOR_SIGNUP' }); // a1 signed up above
  Object.assign(state.users[key], { fullName, manager: mgr });
  await put('/onboarding/me/personal', key, { fullName, email: `${key}@example.com` });
  const ob = await get('/onboarding/me', key);
  await put('/onboarding/me/consent', key, { privacyNoticeVersion: ob.privacyNoticeVersion, identityConsent: true, termsAccepted: true });
  const ident = await post('/onboarding/me/identity/start', key, {});
  await post('/onboarding/me/identity/complete', key, { sessionRef: ident.identity.sessionRef, payload: 'MOCK_OK' });
  await put('/onboarding/me/bank', key, { accountHolderName: fullName, accountNumber: account, ifsc: 'HDFC0001234', bankName: 'UAT Test Bank' });
  const cheque = await upload('cheque', key, PNG, `${key}-cheque.png`);
  await put('/onboarding/me/cheque', key, { fileId: cheque.id });
  await put('/onboarding/me/agent-code', key, mgr ? { code: state.ids.codes[mgr] } : {});
  save();
  return v;
}

// a1 first, step by step, to check the gates on the way
const first = state.users.a1?.token ? await login('a1', '9800000031') : await login('a1', '9800000031', { purpose: 'ADVISOR_SIGNUP' });
check('S04-01', 'Self sign-up creates an Advisor who must complete onboarding', first.user.role === 'ADVISOR' && first.gates?.onboarding?.required === true && first.gates?.onboarding?.complete === false, first.gates?.onboarding);
await denied('S04-02', 'No leads before onboarding is approved', () => post('/leads/drafts', 'a1', { cardId: state.ids.cards.rewards }), 403);
await denied('S04-03', 'A 12-digit identity number is never accepted by KBS', async () => {
  await put('/onboarding/me/personal', 'a1', { fullName: 'Arjun Advisor', email: 'a1@example.com' });
  const ob = await get('/onboarding/me', 'a1');
  await put('/onboarding/me/consent', 'a1', { privacyNoticeVersion: ob.privacyNoticeVersion, identityConsent: true, termsAccepted: true });
  const ident = await post('/onboarding/me/identity/start', 'a1', {});
  await post('/onboarding/me/identity/complete', 'a1', { sessionRef: ident.identity.sessionRef, payload: '123412341234' });
}, 400);
const okCode = await get(`/agent-codes/validate?code=${state.ids.codes.m1}`, 'a1');
check('S04-03b', 'The sign-up screen confirms a valid Agent Code (without naming anyone)', okCode.valid === true, JSON.stringify(okCode).slice(0, 200));
const badCode = await get('/agent-codes/validate?code=NOPE99', 'a1').catch((e) => ({ err: e.status }));
check('S04-03c', 'An unknown Agent Code is reported as not valid', badCode.err >= 400 || badCode.valid === false, JSON.stringify(badCode).slice(0, 160));
await denied('S04-04', 'Submitting with steps missing is refused', () => post('/onboarding/me/submit', 'a1', {}), [400, 409]);

for (const p of PEOPLE) await onboard(...p);
for (const [k] of PEOPLE) await post('/onboarding/me/submit', k, {});
const a1ob = await get('/onboarding/me', 'a1');
check('S04-05', 'After submit the Advisor is waiting for Admin review and already shows the reporting person', !!a1ob.submittedAt && !a1ob.review?.outcome && a1ob.reportingParent?.fullName === 'Meera Manager North', { submittedAt: a1ob.submittedAt, review: a1ob.review, parent: a1ob.reportingParent });
check('S04-06', "The Advisor's own onboarding view masks the bank account number", !JSON.stringify(a1ob).includes('111122223331'), JSON.stringify(a1ob.bank ?? {}).slice(0, 200));

// Admin review queue
const queue = await call('GET', '/onboarding/review?pageSize=50', { as: A, raw: true });
const waiting = queue.data.items ?? queue.data;
check('S04-07', 'Admin review queue lists the five submitted Advisors', waiting.length === 5, waiting.map((w) => w.fullName).join(', '));
await denied('S04-08', 'A Manager cannot approve onboarding', () => post(`/onboarding/review/${state.users.a1.id}`, 'm1', { decision: 'APPROVE' }), 403);
await denied('S04-09', 'Rejecting without a reason is refused', () => post(`/onboarding/review/${state.users.a5.id}`, A, { decision: 'REJECT' }), 400);
for (const k of ['a1', 'a2', 'a3', 'a4']) await post(`/onboarding/review/${state.users[k].id}`, A, { decision: 'APPROVE' });
await post(`/onboarding/review/${state.users.a5.id}`, A, { decision: 'REJECT', reason: 'TEST: cheque image unreadable' });

for (const [k, , mobile] of PEOPLE) await login(k, mobile);
check('S04-10', 'Approved Advisors pass the onboarding gate on next sign-in', ['a1', 'a2', 'a3', 'a4'].every((k) => state.users[k].gates?.onboarding?.complete === true), ['a1', 'a2', 'a3', 'a4'].map((k) => JSON.stringify(state.users[k].gates?.onboarding)).join(' '));
const a5 = await get('/onboarding/me', 'a5');
check('S04-11', 'The rejected Advisor stays blocked and sees the reason', state.users.a5.gates?.onboarding?.complete === false && /unreadable/.test(JSON.stringify(a5)), JSON.stringify(state.users.a5.gates?.onboarding));
await denied('S04-12', 'The rejected Advisor cannot create leads', () => post('/leads/drafts', 'a5', { cardId: state.ids.cards.rewards }), 403);

// reporting lines
const rep = sql(`select u."fullName", p."fullName", p.role from "User" u join "ReportingAssignment" r on r."childUserId"=u.id and r.status='ACTIVE' and r."effectiveTo" is null join "User" p on p.id=r."parentUserId" where u.role='ADVISOR' order by u."fullName"`).split('\n');
eq('S04-13', 'Reporting person follows the Agent Code; no code → Admin', rep.filter((r) => !r.startsWith('Rita')), ['Alok Advisor|KBS Owner|ADMIN', 'Aman Advisor|Mohan Manager South|MANAGER', 'Anita Advisor|Meera Manager North|MANAGER', 'Arjun Advisor|Meera Manager North|MANAGER']);

// who sees whom
const m1adv = await call('GET', '/users?role=ADVISOR&pageSize=50', { as: 'm1', raw: true });
eq('S04-14', 'Manager North sees exactly their two Advisors', (m1adv.data.items ?? m1adv.data).map((u) => u.fullName).sort(), ['Anita Advisor', 'Arjun Advisor']);
const detail = await get(`/onboarding/review/${state.users.a1.id}`, A);
check('S04-15', 'Admin review detail shows identity verified and a masked account (never the full number)', /VERIFIED/i.test(JSON.stringify(detail)) && !JSON.stringify(detail).includes('111122223331'), JSON.stringify(detail).slice(0, 300));
await denied('S04-16', 'Accounts cannot open onboarding reviews', () => get('/onboarding/review', 'acc'), 403);
await denied('S04-17', 'An Advisor cannot use web-only areas: user list', () => get('/users', 'a1'), 403);

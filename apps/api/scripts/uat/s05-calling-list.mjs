// S05 — Admin uploads the calling list; it is validated, allocated equally, and rebalanced when a Telecaller passes training.
import { beginStage, check, eq, denied, get, login, post, put, upload, call, state, save, sql, xlsx } from './lib.mjs';

beginStage('S05 Calling list');
await login('admin', '9999999999');
for (const k of ['m1', 'm2', 't1', 't2', 't3', 'a1']) await login(k, state.users[k].mobile);
const A = 'admin';

// a number on the do-not-contact list before the upload
await post('/suppressions', A, { mobile: '9700000013', reason: 'COMPLIANCE' });

const CUSTOMERS = [
  ['Kiran Customer', '9700000001', '302001', 'AAAPK1111A'],
  ['Lata Customer', '9700000002', '302001', 'AAAPL2222B'],
  ['Mahesh Customer', '9700000003', '110001', 'AAAPM3333C'],
  ['Neha Customer', '9700000004', '110001', 'AAAPN4444D'],
  ['Om Customer', '9700000005', '400001', 'AAAPO5555E'],
  ['Pooja Customer', '9700000006', '400001', 'AAAPP6666F'],
  ['Qasim Customer', '9700000007', '560001', 'AAAPQ7777G'],
  ['Rekha Customer', '9700000008', '560001', 'AAAPR8888H'],
  ['Suresh Customer', '9700000009', '302001', 'AAAPS9999J'],
  ['Tanvi Customer', '9700000010', '110001', 'AAAPT1010K'],
  ['Kiran Duplicate', '9700000001', '302001', 'AAAPK1111A'], // same mobile as row 1
  ['Bad Mobile', '97000', '302001', ''], // not a mobile number
  ['Bad Pincode', '9700000012', '12', ''], // not a pincode
  ['Do Not Contact', '9700000013', '302001', ''], // on the do-not-contact list
];
const sheet = await xlsx(['NAME', 'MOBILE', 'Pincode', 'PAN NO'], CUSTOMERS.map(([NAME, MOBILE, Pincode, pan]) => ({ NAME, MOBILE, Pincode, 'PAN NO': pan })));
await denied('S05-01', 'A Manager cannot upload a calling list', () => upload('customer_list', 'm1', sheet, 'customers.xlsx'), 403);
const file = await upload('customer_list', A, sheet, 'uat-customers.xlsx');
const batch = await post('/calling-list/batches', A, { fileId: file.id });
state.ids.callingBatch = batch.id;
save();
await put(`/calling-list/batches/${batch.id}/mapping`, A, { name: 'NAME', mobile: 'MOBILE', pincode: 'Pincode', pan: 'PAN NO' });
const validated = await get(`/calling-list/batches/${batch.id}`, A);
const v = validated.totals?.validation ?? validated.validation ?? {};
check('S05-02', 'Validation report before import: 14 rows = 10 accepted, 2 to review, 2 excluded', validated.totals?.rows === 14 && v.accepted === 10 && v.needsReview === 2 && v.excluded === 2, JSON.stringify(validated.totals ?? validated).slice(0, 400));
await post(`/calling-list/batches/${batch.id}/confirm`, A, { consentRepresentationConfirmed: true, sourceVendor: 'UAT vendor', permittedUseBasis: 'TEST data for UAT-01' });

// a second, one-row list imported WITHOUT the consent confirmation: it may be stored but never allocated (REQ-06 / REQ-21)
const file2 = await upload('customer_list', A, await xlsx(['NAME', 'MOBILE', 'Pincode', 'PAN NO'], [{ NAME: 'No Consent Customer', MOBILE: '9700000020', Pincode: '302001' }]), 'uat-no-consent.xlsx');
const batch2 = await post('/calling-list/batches', A, { fileId: file2.id });
await put(`/calling-list/batches/${batch2.id}/mapping`, A, { name: 'NAME', mobile: 'MOBILE', pincode: 'Pincode', pan: 'PAN NO' });
await post(`/calling-list/batches/${batch2.id}/confirm`, A, { consentRepresentationConfirmed: false, sourceVendor: 'UAT vendor', permittedUseBasis: 'TEST data, consent not confirmed' });
await denied('S05-03', 'A list imported without the consent confirmation cannot be allocated to callers', () => post(`/calling-list/batches/${batch2.id}/allocate`, A, {}), [400, 403, 409, 422]);

const rowsOf = async (status) => {
  const r = await call('GET', `/calling-list/batches/${batch.id}/rows?reviewStatus=${status}&pageSize=50`, { as: A, raw: true });
  return r.data.items ?? r.data;
};
const review = await rowsOf('NEEDS_REVIEW');
const excluded = await rowsOf('EXCLUDED');
eq('S05-04', 'Bad mobile and bad pincode wait for Admin review with the reason', review.map((r) => `${r.fullName}:${r.reviewReason}`).sort(), ['Bad Mobile:INVALID_MOBILE', 'Bad Pincode:INVALID_PINCODE']);
eq('S05-05', 'Duplicate and do-not-contact rows are excluded with the reason', excluded.map((r) => `${r.fullName}:${r.reviewReason}`).sort(), ['Do Not Contact:SUPPRESSED', 'Kiran Duplicate:DUPLICATE_IN_BATCH']);
for (const r of review) await post(`/calling-list/records/${r.id}/review`, A, { action: 'EXCLUDE', reason: 'TEST: not a usable row' });
check('S05-06', 'A customer mobile is masked in the Admin row list', review.concat(excluded, await rowsOf('ACCEPTED')).every((r) => !/^\+?91?97000000\d\d$/.test(r.mobile ?? r.mobileMasked ?? '')), JSON.stringify((await rowsOf('ACCEPTED'))[0]).slice(0, 200));

// allocation: t1 and t2 are trained, t3 is not yet
const alloc = await post(`/calling-list/batches/${batch.id}/allocate`, A, {});
const split = () => Object.fromEntries(sql(`select u."fullName", count(*) from "CallingRecord" c join "User" u on u.id = c."assignedTelecallerUserId" where c."reviewStatus"='ACCEPTED' group by 1 order by 1`).split('\n').filter(Boolean).map((l) => l.split('|')).map(([n, c]) => [n, Number(c)]));
eq('S05-07', 'Ten accepted customers are split equally between the two trained Telecallers', split(), { 'Tara Telecaller': 5, 'Tarun Telecaller': 5 });
check('S05-08', 'Nothing was given to the Telecaller who has not passed training', !('Tina Telecaller' in split()), JSON.stringify(alloc).slice(0, 200));

// t3 finishes training → gets a share of untouched customers
for (const n of [2, 3]) {
  await post(`/training/modules/${n}/video-progress`, 't3', { positionSec: 60, durationSec: 60, completed: true });
  const a = await post(`/training/modules/${n}/attempts`, 't3', {});
  await post(`/training/attempts/${a.attemptId ?? a.id}/submit`, 't3', { answers: Object.fromEntries(a.questions.map((q) => [q.id, 'A'])) });
}
await login('t3', state.users.t3.mobile);
const after = split();
const counts = Object.values(after);
check('S05-09', 'When the third Telecaller passes training the untouched customers are rebalanced (4 / 3 / 3)', counts.length === 3 && counts.reduce((a, b) => a + b, 0) === 10 && Math.max(...counts) - Math.min(...counts) <= 1, JSON.stringify(after));
const events = sql(`select count(*) from "AllocationEvent"`);
check('S05-10', 'Every allocation and move is kept as an allocation event', Number(events) >= 10, `${events} events`);
state.ids.split = after;
save();

// who sees which customers
const queueOf = async (k) => { const r = await call('GET', '/calling/queue?pageSize=50', { as: k, raw: true }); return r.data.items ?? r.data; };
const q1 = await queueOf('t1'), q2 = await queueOf('t2'), q3 = await queueOf('t3');
check('S05-11', 'Each Telecaller sees exactly their own customers', q1.length === after['Tara Telecaller'] && q2.length === after['Tarun Telecaller'] && q3.length === after['Tina Telecaller'], `${q1.length}/${q2.length}/${q3.length}`);
const ids = (q) => q.map((r) => r.id);
check('S05-12', 'No customer is in two queues', new Set([...ids(q1), ...ids(q2), ...ids(q3)]).size === 10, '');
check('S05-13', 'The queue shows a masked mobile, never the full number', q1.every((r) => /•|\*|x/i.test(r.mobileMasked ?? r.mobile ?? '') ), JSON.stringify(q1[0]).slice(0, 300));
await denied('S05-14', "A Telecaller cannot open another Telecaller's customer", () => get(`/calling/records/${q2[0].id}`, 't1'), [403, 404]);
const recs = async (k) => { const r = await call('GET', '/calling/records?pageSize=50', { as: k, raw: true }); return r.data.items ?? r.data; };
const m1recs = await recs('m1'), m2recs = await recs('m2'), allrecs = await recs(A);
check('S05-15', 'Manager North sees their team\'s customers; Manager South theirs; Admin all ten', m1recs.length === after['Tara Telecaller'] + after['Tarun Telecaller'] && m2recs.length === after['Tina Telecaller'] && allrecs.length >= 10, `${m1recs.length}/${m2recs.length}/${allrecs.length}`);
await denied('S05-16', 'An Advisor has no access to calling records', () => get('/calling/queue', 'a1'), 403);
state.ids.queues = { t1: ids(q1), t2: ids(q2), t3: ids(q3) };
state.ids.queueInfo = Object.fromEntries([...q1, ...q2, ...q3].map((r) => [r.id, { name: r.fullName, pincode: r.pincode }]));
save();

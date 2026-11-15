// S06 — Telecallers work their customers: call through the provider, record every kind of outcome, share material.
import { beginStage, check, eq, denied, get, login, post, call, state, save, sql, BASE } from './lib.mjs';

beginStage('S06 Calling desk');
await login('admin', '9999999999');
for (const k of ['m1', 'm2', 't1', 't2', 't3', 'a1']) await login(k, state.users[k].mobile);
const A = 'admin';
const Q = state.ids.queues;
const cards = state.ids.cards;

/** The provider's side of a call: KBS asked for the call (POST /calls); the provider reports back on the webhook. */
const provider = (events) => fetch(`${BASE}/webhooks/telephony/mock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ events }) }).then((r) => r.json());
let clock = Date.now() - 3600_000;
async function dial(tc, recordId, { answer = true, seconds = 60, recording = true } = {}) {
  const c = await post('/calls', tc, { callingRecordId: recordId });
  const at = (ms) => new Date((clock += ms)).toISOString();
  await provider([{ providerCallId: c.providerCallId, type: 'RINGING', at: at(1000) }]);
  if (!answer) { await provider([{ providerCallId: c.providerCallId, type: 'NO_ANSWER', at: at(30000) }]); return c; }
  await provider([{ providerCallId: c.providerCallId, type: 'CONNECTED', at: at(5000) }]);
  await provider([{ providerCallId: c.providerCallId, type: 'ENDED', at: at(seconds * 1000) }]);
  if (recording) await provider([{ providerCallId: c.providerCallId, type: 'RECORDING_AVAILABLE', recordingRef: `uat-rec-${c.id}`, durationSec: seconds }]);
  return c;
}
const outcome = (tc, recordId, body) => post(`/calling/records/${recordId}/outcomes`, tc, body);
const tomorrow = new Date(Date.now() + 24 * 3600_000).toISOString();

// ── t1 ──
const [r10, r11, r12] = Q.t1;
const pinCards = await get(`/calling/records/${r10}/cards`, 't1');
const info = state.ids.queueInfo[r10];
const offered = (pinCards.cards ?? pinCards).map((c) => c.name).sort();
const expected = ['302001', '110001'].includes(info.pincode) ? ['UAT Rewards Card', 'UAT Travel Card'] : ['UAT Rewards Card'];
eq('S06-01', `The calling desk lists the cards offered at the customer's pincode (${info.pincode})`, offered, expected);

const c1 = await dial('t1', r10, { seconds: 90 });
const c1d = await get(`/calls/${c1.id}`, 't1');
check('S06-02', 'A call goes Requested → Ringing → Connected → Ended; duration comes from the provider (90 s); recording available', c1d.providerState === 'ENDED' && c1d.durationSec === 90 && c1d.recording?.status === 'AVAILABLE', { state: c1d.providerState, dur: c1d.durationSec, rec: c1d.recording?.status });
const o1 = await outcome('t1', r10, { callAttemptId: c1.id, outcome: 'CONNECTED_INTERESTED', remarks: 'TEST: wants the rewards card', selectedCardId: cards.rewards });
const share1 = await post('/share', 't1', { targetType: 'CALLING_RECORD', targetId: r10, kind: 'APPLICATION_LINK', cardId: cards.rewards });
check('S06-03', "The shared application link carries the Telecaller's own code (not a placeholder)", JSON.stringify(share1).includes('apply.example.com/rewards') && !/\{code\}/.test(JSON.stringify(share1)), JSON.stringify(share1).slice(0, 300));
check('S06-04', 'A share is a WhatsApp hand-off: recorded as opened, never as delivered', share1.channel === 'WHATSAPP_HANDOFF' && share1.handoffResult === 'OPENED' && share1.deliveryStatus !== 'DELIVERED', { ch: share1.channel, h: share1.handoffResult, d: share1.deliveryStatus });

const c2 = await dial('t1', r11, { answer: false });
const c2d = await get(`/calls/${c2.id}`, 't1');
check('S06-05', 'An unanswered call is No answer with no talk time and no recording claimed', c2d.providerState === 'NO_ANSWER' && !c2d.connectedAt && c2d.recording?.status !== 'AVAILABLE', { state: c2d.providerState, rec: c2d.recording?.status });
await outcome('t1', r11, { callAttemptId: c2.id, outcome: 'NO_ANSWER_OR_FAILED' });

const c3 = await dial('t1', r12, { seconds: 45 });
await denied('S06-06', 'A follow-up needs a time', () => outcome('t1', r12, { callAttemptId: c3.id, outcome: 'FOLLOW_UP', remarks: 'TEST: call back' }), [400, 422]);
await denied('S06-07', 'A follow-up needs a reason', () => outcome('t1', r12, { callAttemptId: c3.id, outcome: 'FOLLOW_UP', followUpAt: tomorrow }), [400, 422]);
await outcome('t1', r12, { callAttemptId: c3.id, outcome: 'FOLLOW_UP', followUpAt: tomorrow, remarks: 'TEST: asked to call back tomorrow' });

// interested customer: the Telecaller enters the bank application number
const interests = await call('GET', '/calling/interests?pageSize=50', { as: 't1', raw: true });
const mine = interests.data.items ?? interests.data;
check('S06-08', 'The interested customer appears in "My applications" with the chosen card, awaiting a bank update', mine.length === 1 && /Rewards/.test(JSON.stringify(mine[0])), JSON.stringify(mine[0] ?? {}).slice(0, 400));
await post(`/calling/interests/${mine[0].id}/bank-reference`, 't1', { referenceKind: 'APPLICATION_NO', referenceValue: 'UATT1001' });
state.ids.t1Interest = mine[0].id;

// ── t2 ──
const [r20, r21, r22, r23] = Q.t2;
const c4 = await dial('t2', r20, { seconds: 120 });
await outcome('t2', r20, { callAttemptId: c4.id, outcome: 'CONNECTED_LINK_OR_PDF_SHARED', remarks: 'TEST: sent the benefits PDF and my ID' });
const pdf = await post('/share', 't2', { targetType: 'CALLING_RECORD', targetId: r20, kind: 'BENEFIT_PDF', cardId: cards.rewards });
const idc = await post('/share', 't2', { targetType: 'CALLING_RECORD', targetId: r20, kind: 'OFFICE_ID' });
check('S06-09', 'Benefit PDF and official ID can be shared; each share is logged against the customer', !!pdf.shareActionId && !!idc.shareActionId, { pdf: pdf.kind, id: idc.kind });
const log = await get(`/calling/records/${r20}/shares`, 't2');
check('S06-10', 'The customer record shows both shares', (log.items ?? log).length === 2, JSON.stringify(log).slice(0, 200));

const c5 = await dial('t2', r21, { seconds: 30 });
await denied('S06-11', 'A decline needs a reason', () => outcome('t2', r21, { callAttemptId: c5.id, outcome: 'DECLINED' }), [400, 422]);
await outcome('t2', r21, { callAttemptId: c5.id, outcome: 'DECLINED', remarks: 'TEST: not interested, do not call again', doNotContact: true });
const afterDecline = await call('GET', '/calling/queue?pageSize=50', { as: 't2', raw: true });
const stillThere = (afterDecline.data.items ?? afterDecline.data).some((r) => r.id === r21);
const kept = sql(`select count(*), bool_or("hiddenAt" is not null), bool_or(suppressed) from "CallingRecord" where id='${r21}'`);
check('S06-12', 'A declined, do-not-contact customer leaves the active queue but is kept (hidden, not deleted)', !stillThere && kept === '1|t|t', kept);
await denied('S06-13', 'A do-not-contact customer cannot be called again', () => post('/calls', 't2', { callingRecordId: r21 }), [400, 403, 409, 422]);
const supp = sql(`select count(*) from "ContactSuppression" where "liftedAt" is null`);
check('S06-14', 'The number is on the do-not-contact list (2 active entries now)', supp === '2', supp);

const c6 = await dial('t2', r22, { seconds: 20 });
await outcome('t2', r22, { callAttemptId: c6.id, outcome: 'COMPLETED_NO_FURTHER', remarks: 'TEST: already has the card' });

// reassignment by the Manager keeps the history. The 4 / 3 / 3 rebalance leaves the spare, untouched customer with either
// Telecaller of Manager North, so move whichever has it — and end with the same split (Tara 4, Tarun 3) both ways.
const spare = r23 ? { id: r23, from: 't2', to: 't1' } : Q.t1[3] ? { id: Q.t1[3], from: 't1', to: 't2' } : null;
if (!spare) {
  check('S06-15', "A Manager cannot move a customer to another Manager's Telecaller", false, 'no spare customer to reassign in this allocation');
  check('S06-16', 'After a reassignment the new Telecaller can open the customer and the old one cannot', false, 'no spare customer to reassign in this allocation');
} else {
  await denied('S06-15', 'A Manager cannot move a customer to another Manager\'s Telecaller', () => post(`/calling/records/${spare.id}/reassign`, 'm1', { toTelecallerUserId: state.users.t3.id, reason: 'TEST: wrong team' }), [400, 403, 404, 409]);
  await post(`/calling/records/${spare.id}/reassign`, 'm1', { toTelecallerUserId: state.users[spare.to].id, reason: 'TEST: balance workload' });
  const moved = await get(`/calling/records/${spare.id}`, spare.to);
  check('S06-16', 'After a reassignment the new Telecaller can open the customer and the old one cannot', !!moved.id && (await call('GET', `/calling/records/${spare.id}`, { as: spare.from }).then(() => false, (e) => [403, 404].includes(e.status))), `${spare.from} → ${spare.to}`);
  if (spare.from === 't1') await post(`/calling/records/${spare.id}/reassign`, 'm1', { toTelecallerUserId: state.users.t1.id, reason: 'TEST: back to the first caller' });
}

// ── t3: office network off → blocked; Manager grants work-from-home → allowed ──
const nets = await get('/access-policy/networks', A);
const netIds = (nets.items ?? nets).map((n) => n.id);
for (const id of netIds) await post(`/access-policy/networks/${id}/active`, A, { active: false, reason: 'TEST: simulate a Telecaller outside the office' });
const [r30, r31] = Q.t3;
await denied('S06-17', 'Outside the office network a Telecaller cannot open the queue or call', () => get('/calling/queue', 't3'), 403);
await denied('S06-18', "A Manager cannot grant work-from-home to another Manager's Telecaller", () => post('/access-policy/wfh', 'm1', { telecallerUserId: state.users.t3.id, reason: 'TEST: not my team' }), [403, 404]);
await post('/access-policy/wfh', 'm2', { telecallerUserId: state.users.t3.id, reason: 'TEST: working from home this week' });
const c7 = await dial('t3', r30, { seconds: 75 });
check('S06-19', 'With a work-from-home exception from their Manager the Telecaller can call', !!c7.id, '');
await denied('S06-20', 'Telecallers without the exception are still blocked', () => get('/calling/queue', 't1'), 403);
for (const id of netIds) await post(`/access-policy/networks/${id}/active`, A, { active: true, reason: 'TEST: office network back' });
await outcome('t3', r30, { callAttemptId: c7.id, outcome: 'CONNECTED_INTERESTED', remarks: 'TEST: interested, will apply later', selectedCardId: cards.rewards });
const c8 = await dial('t3', r31, { seconds: 15 });
await outcome('t3', r31, { callAttemptId: c8.id, outcome: 'FOLLOW_UP', followUpAt: tomorrow, remarks: 'TEST: busy now' });
const ev = sql(`select outcome, count(*) from "NetworkAccessEvent" group by 1 order by 1`);
check('S06-21', 'Network decisions are logged (office, work-from-home and denied)', /ALLOWED_OFFICE/.test(ev) && /ALLOWED_WFH/.test(ev) && /DENIED/.test(ev), ev.replace(/\n/g, ', '));

// ── oversight ──
await denied('S06-22', 'A Telecaller cannot play a recording', () => get(`/calls/${c1.id}/recording-url`, 't1'), 403);
const play = await get(`/calls/${c1.id}/recording-url`, 'm1');
check('S06-23', 'Their Manager can play it; the play is logged as sensitive access', !!play.url && Number(sql(`select count(*) from "SensitiveAccessLog" where "entityId"='${c1.id}' and field='RECORDING'`)) === 1, '');
await denied('S06-24', "Another Manager cannot open the team's call", () => get(`/calls/${c1.id}`, 'm2'), [403, 404]);
await denied('S06-25', 'An outcome cannot be recorded for someone else\'s customer', () => outcome('t1', r20, { outcome: 'COMPLETED_NO_FURTHER', remarks: 'TEST: not mine' }), [403, 404]);
const ent = sql(`select count(*) from "PayoutEntitlement"`);
eq('S06-26', 'No calling activity has created any payout (INV-05)', ent, '0');
state.ids.calls = { t1: 3, t2: 3, t3: 2 };
state.ids.connected = { t1: 2, t2: 3, t3: 2 };
save();

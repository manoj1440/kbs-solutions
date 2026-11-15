// S07 — Advisors create leads through all eight steps, add the bank application number, share the link.
import { beginStage, check, eq, denied, get, login, post, patch, call, state, save, sql } from './lib.mjs';

beginStage('S07 Leads');
await login('admin', '9999999999');
for (const k of ['m1', 'm2', 'acc', 't1', 'a1', 'a2', 'a3', 'a4']) await login(k, state.users[k].mobile);
const A = 'admin';
const C = state.ids.cards;

// lead | advisor | customer | mobile | PAN | pincode | card | bank application no.
export const LEADS = [
  ['L1', 'a1', 'Lead One Customer', '9600000001', 'ABCPA1001A', '302001', 'rewards', 'UATA1001'],
  ['L2', 'a1', 'Lead Two Customer', '9600000002', 'ABCPA1002B', '110001', 'travel', 'UATA1002'],
  ['L3', 'a1', 'Lead Three Customer', '9600000003', 'ABCPA1003C', '400001', 'rewards', 'UATA1003'],
  ['L4', 'a1', 'Lead Four Customer', '9600000004', 'ABCPA1004D', '302001', 'rewards', null],
  ['L5', 'a2', 'Lead Five Customer', '9600000005', 'ABCPA2001E', '302001', 'rewards', 'UATA2001'],
  ['L6', 'a2', 'Lead Six Customer', '9600000006', 'ABCPA2002F', '560001', 'rewards', 'UATA2002'],
  ['L7', 'a2', 'Lead Seven Customer', '9600000007', 'ABCPA2003G', '110001', 'travel', 'UATA2003'],
  ['L8', 'a3', 'Lead Eight Customer', '9600000008', 'ABCPA3001H', '302001', 'rewards', 'UATA3001'],
  ['L9', 'a3', 'Lead Nine Customer', '9600000009', 'ABCPA3002J', '400001', 'rewards', 'UATA3002'],
  ['L10', 'a3', 'Lead Ten Customer', '9600000010', 'ABCPA3003K', '560001', 'rewards', 'UATA3003'],
  ['L11', 'a4', 'Lead Eleven Customer', '9600000011', 'ABCPA4001L', '302001', 'travel', 'UATA4001'],
  ['L12', 'a4', 'Lead Twelve Customer', '9600000012', 'ABCPA4002M', '110001', 'rewards', 'UATA4002'],
];
const CITY = { 302001: ['Jaipur', 'Rajasthan'], 110001: ['New Delhi', 'Delhi'], 400001: ['Mumbai', 'Maharashtra'], 560001: ['Bengaluru', 'Karnataka'] };
state.ids.leads = state.ids.leads ?? {};

async function fill(adv, id, name, mobile, pan, pincode, extra = {}) {
  await patch(`/leads/drafts/${id}/mobile`, adv, { mobile, ...extra });
  await patch(`/leads/drafts/${id}/details`, adv, { fullName: name, email: `${name.split(' ')[1].toLowerCase()}@example.com` });
  await patch(`/leads/drafts/${id}/pan`, adv, { pan });
  await patch(`/leads/drafts/${id}/pincode`, adv, { pincode, city: CITY[pincode][0], state: CITY[pincode][1], locationConfirmed: true });
  await patch(`/leads/drafts/${id}/employment`, adv, { employmentType: 'SALARIED' });
  await patch(`/leads/drafts/${id}/income`, adv, { annualIncomeItr: 600000 });
  await patch(`/leads/drafts/${id}/declarations`, adv, { acceptedDeclarationIds: ['D1', 'D2'], bureauAcknowledged: true });
}

// ── the first lead step by step ──
const [, , n1, mob1, pan1, pin1] = LEADS[0];
const d1 = await post('/leads/drafts', 'a1', { cardId: C.rewards });
await denied('S07-01', 'A lead cannot be submitted with steps missing', () => post(`/leads/drafts/${d1.id}/submit`, 'a1', {}), [400, 409, 422]);
await denied('S07-02', 'A wrong-format PAN is refused', async () => { await patch(`/leads/drafts/${d1.id}/mobile`, 'a1', { mobile: mob1 }); await patch(`/leads/drafts/${d1.id}/details`, 'a1', { fullName: n1 }); await patch(`/leads/drafts/${d1.id}/pan`, 'a1', { pan: '1234567890' }); }, [400, 422]);
const drafts = await call('GET', '/leads/drafts', { as: 'a1', raw: true });
check('S07-03', 'An unfinished lead is kept as a draft and can be resumed', (drafts.data.items ?? drafts.data).some((d) => d.id === d1.id), '');
await fill('a1', d1.id, n1, mob1, pan1, pin1);
await denied('S07-04', 'Declarations must all be accepted', () => patch(`/leads/drafts/${d1.id}/declarations`, 'a1', { acceptedDeclarationIds: ['D1'], bureauAcknowledged: true }).then(() => post(`/leads/drafts/${d1.id}/submit`, 'a1', {})), [400, 409, 422]);
await patch(`/leads/drafts/${d1.id}/declarations`, 'a1', { acceptedDeclarationIds: ['D1', 'D2'], bureauAcknowledged: true });
const lead1 = await post(`/leads/drafts/${d1.id}/submit`, 'a1', {});
state.ids.leads.L1 = lead1.id;
save();
const l1 = await get(`/leads/${lead1.id}`, 'a1');
check('S07-05', 'A submitted lead gets a KBS reference', /^KBS-L-/.test(l1.kbsRef ?? ''), l1.kbsRef);
const txt = JSON.stringify(l1);
check('S07-06', 'The Advisor sees the customer mobile and PAN masked, PAN marked verified', !txt.includes(mob1) && !txt.includes(pan1) && /verified/i.test(txt), txt.slice(0, 300));
check('S07-07', 'Before any bank file the three bank fields read "Awaiting MIS Update" — not Submitted / Processing', (txt.match(/Awaiting MIS Update/g) ?? []).length >= 3 && !/Under Processing|Application Submitted/.test(txt), (txt.match(/"display":"[^"]+"/g) ?? []).slice(0, 4).join(' '));
check('S07-08', 'No bank reference yet: shown as "not yet available"', l1.bankApplicationNo === null && /not yet available/i.test(l1.bankReference?.label ?? ''), l1.bankReference);
const share = await post(`/leads/${lead1.id}/link/share`, 'a1', {});
const open = await post(`/leads/${lead1.id}/link/open`, 'a1', {});
check('S07-09', "Sharing / opening the bank link is recorded and the link carries the Advisor's own code", /apply\.example\.com\/rewards\?agent=/.test(JSON.stringify(share)) && !/\{code\}/.test(JSON.stringify(share)) && !!open, JSON.stringify(share).slice(0, 250));
await post(`/leads/${lead1.id}/bank-reference`, 'a1', { referenceKind: 'APPLICATION_NO', referenceValue: 'UATA1001' });

// ── refusals ──
const dDup = await post('/leads/drafts', 'a1', { cardId: C.rewards });
await denied('S07-10', 'A second lead for the same customer mobile needs a stated reason', () => patch(`/leads/drafts/${dDup.id}/mobile`, 'a1', { mobile: mob1 }), [400, 409, 422]);
const dPin = await post('/leads/drafts', 'a1', { cardId: C.travel });
await patch(`/leads/drafts/${dPin.id}/mobile`, 'a1', { mobile: '9600000090' });
await patch(`/leads/drafts/${dPin.id}/details`, 'a1', { fullName: 'Pincode Test Customer' });
await patch(`/leads/drafts/${dPin.id}/pan`, 'a1', { pan: 'ABCPA9090Z' });
await denied('S07-11', 'A card that is not offered at the customer\'s pincode is refused (Travel at 400001)', () => patch(`/leads/drafts/${dPin.id}/pincode`, 'a1', { pincode: '400001', city: 'Mumbai', state: 'Maharashtra', locationConfirmed: true }), [400, 409, 422]);
await denied('S07-12', 'A Telecaller cannot create leads', () => post('/leads/drafts', 't1', { cardId: C.rewards }), 403);
await denied('S07-13', 'A Manager cannot create leads until their own identity and bank details are approved (F-823, stage S15)', () => post('/leads/drafts', 'm1', { cardId: C.rewards }), 403, 'GATE_ONBOARDING_INCOMPLETE');
await denied('S07-14', 'A draft (unpublished) card cannot be used for a lead', async () => { const d = await post('/leads/drafts', 'a1', { cardId: C.draft }); await fill('a1', d.id, 'Draft Card Customer', '9600000091', 'ABCPA9091Y', '302001'); await post(`/leads/drafts/${d.id}/submit`, 'a1', {}); }, [400, 404, 409, 422]);

// ── the other eleven ──
for (const [key, adv, name, mobile, pan, pincode, card, appNo] of LEADS.slice(1)) {
  const d = await post('/leads/drafts', adv, { cardId: C[card] });
  await fill(adv, d.id, name, mobile, pan, pincode);
  const lead = await post(`/leads/drafts/${d.id}/submit`, adv, {});
  state.ids.leads[key] = lead.id;
  if (appNo) await post(`/leads/${lead.id}/bank-reference`, adv, { referenceKind: 'APPLICATION_NO', referenceValue: appNo });
}
save();
eq('S07-15', 'Twelve leads exist', sql(`select count(*) from "Lead"`), '12');
await denied('S07-16', 'A bank application number already on another lead is refused', () => post(`/leads/${state.ids.leads.L4}/bank-reference`, 'a1', { referenceKind: 'APPLICATION_NO', referenceValue: 'UATA2001' }), [400, 409, 422]);

// ── who sees which leads ──
const total = async (k, qs = '') => (await call('GET', `/leads?pageSize=100${qs}`, { as: k, raw: true })).meta?.total ?? (await call('GET', `/leads?pageSize=100${qs}`, { as: k, raw: true })).data.length;
eq('S07-17', 'Each Advisor lists only their own leads (4 / 3 / 3 / 2)', [await total('a1'), await total('a2'), await total('a3'), await total('a4')], [4, 3, 3, 2]);
eq('S07-18', "Manager North lists their team's 7 leads, Manager South 3, Admin all 12", [await total('m1'), await total('m2'), await total(A)], [7, 3, 12]);
await denied('S07-19', "An Advisor cannot open another Advisor's lead", () => get(`/leads/${state.ids.leads.L5}`, 'a1'), [403, 404]);
await denied('S07-20', "A Manager cannot open a lead of another Manager's Advisor", () => get(`/leads/${state.ids.leads.L8}`, 'm1'), [403, 404]);
await denied('S07-21', 'Manager North cannot open the Admin-direct Advisor\'s lead', () => get(`/leads/${state.ids.leads.L11}`, 'm1'), [403, 404]);
await denied('S07-22', 'Accounts cannot list leads', () => get('/leads', 'acc'), 403);
const adminLead = JSON.stringify(await get(`/leads/${state.ids.leads.L1}`, A));
check('S07-23', 'Even the Admin sees mobile and PAN masked in the lead', !adminLead.includes(mob1) && !adminLead.includes(pan1), '');
eq('S07-24', 'Creating leads has not created any payout', sql(`select count(*) from "PayoutEntitlement"`), '0');

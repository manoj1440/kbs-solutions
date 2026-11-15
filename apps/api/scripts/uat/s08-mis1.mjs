// S08 — Admin uploads the first bank MIS file. Bank values land on the matching leads; activated cards become claimable.
import { beginStage, check, eq, denied, get, login, post, upload, call, state, save, sql, xlsx } from './lib.mjs';
import { HEADERS, importMis, MIS1 } from './mis.mjs';

beginStage('S08 Bank MIS 1');
await login('admin', '9999999999');
for (const k of ['m1', 'm2', 'acc', 't1', 'a1', 'a2', 'a3', 'a4']) await login(k, state.users[k].mobile);
const A = 'admin';
const L = state.ids.leads;

await denied('S08-01', 'Only the Admin can upload a bank MIS file (Manager refused)', async () => upload('mis', 'm1', await xlsx(HEADERS, MIS1), 'mis1.xlsx'), 403);
await denied('S08-02', 'Accounts cannot upload a bank MIS file', async () => upload('mis', 'acc', await xlsx(HEADERS, MIS1), 'mis1.xlsx'), 403);
const bad = await upload('mis', A, await xlsx(['Application No', 'Something Else'], [{ 'Application No': 'X1' }]), 'wrong-format.xlsx');
await denied('S08-03', 'A file in the wrong format (missing the bank columns) is refused before anything is applied', async () => { const b = await post('/mis/batches', A, { fileId: bad.id }); await post(`/mis/batches/${b.id}/preview`, A, {}); await post(`/mis/batches/${b.id}/apply`, A, {}); }, [400, 409, 422]);

const before = sql(`select count(*) from "BankStatusSnapshot"`);
const { batch, preview, applied, detail } = await importMis(A, MIS1, 'uat-mis-1.xlsx');
state.ids.mis1 = batch.id;
save();
check('S08-04', 'Preview before applying: 13 rows, 12 matched, 1 unmatched, the new bank wordings listed', preview.totals?.rows === 13 && preview.totals?.MATCHED === 12 && preview.totals?.UNMATCHED === 1 && (preview.newValues?.cardActivationStatus ?? []).includes('ACTIVATION PENDING'), JSON.stringify(preview.totals) + ' ' + JSON.stringify(preview.newValues));
check('S08-05', 'Applied: 12 rows updated (11 leads + 1 Telecaller application), 1 row left for review', applied.updatedChanged === 12 && applied.callingInterestsApplied === 1 && applied.unmatched === 1 && detail.stage === 'APPLIED', JSON.stringify(applied));
eq('S08-06', 'Nothing was applied before "apply" (snapshots written only then)', before, '0');

// the three bank fields, verbatim and separate
const lead = async (key, as = A) => get(`/leads/${L[key]}`, as);
const trio = (l) => [l.stage.display, l.decision.display, l.activation.display];
eq('S08-07', 'L1 shows Stage / Decision / Activation exactly as the bank wrote them', trio(await lead('L1', 'a1')), ['Card Issued', 'Approved', 'V + ACTIVE']);
eq('S08-08', 'L2: approved but INACTIVE — approval is not activation', trio(await lead('L2', 'a1')), ['Card Issued', 'Approved', 'INACTIVE']);
const l3 = await lead('L3', 'a1');
check('S08-09', 'L3: declined; blank activation reads "Not reported", the bank\'s decline reason is shown verbatim', l3.decision.display === 'Declined' && l3.activation.display === 'Not reported' && /bureau score below policy/.test(JSON.stringify(l3)), trio(l3).join(' / '));
eq('S08-10', 'L4 (no application number, not in the file) still reads Awaiting MIS Update', trio(await lead('L4', 'a1')), ['Awaiting MIS Update', 'Awaiting MIS Update', 'Awaiting MIS Update']);
eq('S08-11', 'L6: the unknown wording "ACTIVATION PENDING" is shown as written, not translated', trio(await lead('L6', 'a2')), ['Card Issued', 'Approved', 'ACTIVATION PENDING']);
eq('S08-12', 'L7: in process, decision as the bank wrote it', trio(await lead('L7', 'a2')), ['Document Curing', 'Inprocess', 'Not reported']);
eq('S08-13', 'L12: "#N/A" in the bank file counts as not reported', trio(await lead('L12', 'a4')), ['Decisioned Cases', 'Declined', 'Not reported']);
const l1 = await lead('L1', 'a1');
check('S08-14', 'Bank values carry their source and time ("Bank MIS", batch reference)', l1.stage.provenance === 'BANK_MIS' && !!l1.stage.asOf && l1.stage.batchRef === batch.publicRef, { p: l1.stage.provenance, ref: l1.stage.batchRef });
const hist = await get(`/leads/${L.L1}/mis-history`, 'a1');
check('S08-15', 'The lead has a bank status history entry for this file', JSON.stringify(hist).includes(batch.publicRef), JSON.stringify(hist).slice(0, 200));

// claimable cards — exactly the activated ones
const ents = sql(`select l."publicRef" from "PayoutEntitlement" e join "Lead" l on l.id = e."leadId" where e.state='ELIGIBLE_AVAILABLE' order by 1`).split('\n').filter(Boolean);
const refOf = (k) => sql(`select "publicRef" from "Lead" where id='${L[k]}'`);
eq('S08-16', 'Claimable cards after MIS-1 are exactly L1, L5, L8, L9, L10, L11 (activated) — not INACTIVE, pending, declined or in-process ones', ents, ['L1', 'L5', 'L8', 'L9', 'L10', 'L11'].map(refOf).sort());
const ledger = async (k) => (await get('/payouts/me/ledger', k)).totals;
const avail = [];
for (const k of ['a1', 'a2', 'a3', 'a4']) avail.push((await ledger(k)).available.count);
eq('S08-17', 'Each Advisor\'s earnings screen shows their claimable cards: 1 / 1 / 3 / 1', avail, [1, 1, 3, 1]);
const paidNow = [];
for (const k of ['a1', 'a2', 'a3', 'a4']) paidNow.push((await ledger(k)).paid.amountInr);
eq('S08-18', 'Nobody has earned anything yet (claimable is not paid)', paidNow, [0, 0, 0, 0]);

// the Telecaller's interested customer: bank result shown, no payout (INV-05)
const ints = await call('GET', '/calling/interests?pageSize=50', { as: 't1', raw: true });
const it = (ints.data.items ?? ints.data)[0];
check('S08-19', 'The Telecaller sees the bank result of their interested customer (Card Issued / Approved / V + ACTIVE)', /Card Issued/.test(JSON.stringify(it)) && /V \+ ACTIVE/.test(JSON.stringify(it)), JSON.stringify(it).slice(0, 400));
eq('S08-20', 'An activated card from a Telecaller\'s customer creates NO payout for anyone (INV-05)', sql(`select count(*) from "PayoutEntitlement" e where not exists (select 1 from "Lead" l where l.id = e."leadId")`) + '/' + sql(`select count(*) from "PayoutEntitlement"`), '0/6');
await denied('S08-21', 'A Telecaller has no payout ledger', () => get('/payouts/me/ledger', 't1'), 403);

// unmatched row
const unmatched = await call('GET', `/mis/batches/${batch.id}/rows?matchState=UNMATCHED`, { as: A, raw: true });
const um = unmatched.data.items ?? unmatched.data;
check('S08-22', 'The row that matches nothing (UATX9999) is kept for Admin review, with the reason', um.length === 1 && /UATX9999/.test(JSON.stringify(um[0])), JSON.stringify(um[0] ?? {}).slice(0, 300));
check('S08-23', 'The customer name in a bank row is masked in the list', !/Nobody Known/.test(JSON.stringify(um[0])), '');
const integ = await get('/dashboards/mis-integrity', A);
check('S08-24', 'The MIS integrity page counts it as unmatched', /unmatched/.test(JSON.stringify(integ)), JSON.stringify(integ).slice(0, 300));

// notifications
const notes = async (k) => { const r = await call('GET', '/notifications?pageSize=50', { as: k, raw: true }); return r.data.items ?? r.data; };
const a1n = await notes('a1');
check('S08-25', 'The Advisor is told about the bank update / the card that can be claimed', a1n.some((n) => /claim|payout|bank/i.test(`${n.title} ${n.body}`)), a1n.map((n) => n.title).join(' | '));
const freshness = await get('/mis/freshness', 'm1');
check('S08-26', 'Managers can see how fresh the bank data is', !!JSON.stringify(freshness).match(/20\d\d-/), JSON.stringify(freshness).slice(0, 200));

// the same file again: nothing changes, nothing is created twice
const again = await importMis(A, MIS1, 'uat-mis-1-again.xlsx');
check('S08-27', 'Uploading the same file again changes nothing and creates no second claimable card', again.applied.updatedChanged === 0 && sql(`select count(*) from "PayoutEntitlement"`) === '6', JSON.stringify(again.applied));

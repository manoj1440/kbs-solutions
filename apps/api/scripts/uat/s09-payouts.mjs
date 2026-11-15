// S09 — Payout requests end to end: reservation, Manager then Admin approval (Admin sets the amount), Accounts payment + proof.
import { beginStage, check, eq, denied, get, login, post, put, upload, call, state, save, sql, inr, PNG } from './lib.mjs';
import { importMis, MIS2 } from './mis.mjs';

beginStage('S09 Payouts');
await login('admin', '9999999999');
for (const k of ['m1', 'm2', 'acc', 't1', 'a1', 'a2', 'a3', 'a4']) await login(k, state.users[k].mobile);
const A = 'admin';
const L = state.ids.leads;
state.ids.requests = state.ids.requests ?? {};

const ent = (leadKey) => sql(`select id from "PayoutEntitlement" where "leadId"='${L[leadKey]}'`);
const entState = (leadKey) => sql(`select state from "PayoutEntitlement" where "leadId"='${L[leadKey]}'`);
const request = (adv, leadKeys) => post('/payouts/requests', adv, leadKeys === 'all' ? { all: true } : { entitlementIds: leadKeys.map(ent) });
const approve = (who, id, body = {}) => post(`/payouts/requests/${id}/approvals`, who, { decision: 'APPROVED', ...body });
const reject = (who, id, reason) => post(`/payouts/requests/${id}/approvals`, who, { decision: 'REJECTED', ...(reason ? { reason } : {}) });
const req = (id, as = A) => get(`/payouts/requests/${id}`, as);
const now = () => new Date(Date.now() - 60_000).toISOString();
const proof = async () => (await upload('payment_proof', 'acc', PNG, 'transfer-receipt.png')).id;
const ledger = async (k) => (await get('/payouts/me/ledger', k)).totals;

// ── Advisor under the Admin: no designated Manager approver yet → the request cannot even be created ──
await denied('S09-01', 'An Admin-direct Advisor cannot request a payout until a Manager approver is designated (the Manager step is never skipped)', () => request('a4', 'all'), [400, 409, 422, 503], 'CONFIG_MISSING');
await put('/config/payouts.designatedApproverManagerUserId', A, { value: state.users.m1.id, reason: 'UAT-01: Manager North approves for Admin-direct Advisors' });
await denied('S09-02', 'A Telecaller cannot request a payout', () => post('/payouts/requests', 't1', { all: true }), 403);
await denied('S09-03', 'A Manager cannot request a payout', () => post('/payouts/requests', 'm1', { all: true }), 403);

// ── PR4 first: a3 claims L8 only (before the second bank file) ──
const pr4 = await request('a3', ['L8']);
state.ids.requests.PR4 = pr4.id;
check('S09-04', 'A request reserves exactly the chosen card; the other claimable cards stay available', pr4.state === 'PENDING_APPROVALS' && entState('L8') === 'RESERVED' && entState('L9') === 'ELIGIBLE_AVAILABLE' && entState('L10') === 'ELIGIBLE_AVAILABLE', `${pr4.state} ${entState('L8')} ${entState('L9')} ${entState('L10')}`);

// ── second bank file ──
const mis2 = await importMis(A, MIS2, 'uat-mis-2.xlsx');
state.ids.mis2 = mis2.batch.id;
check('S09-05', 'MIS-2 applied: 3 leads changed', mis2.applied.updatedChanged === 3, JSON.stringify(mis2.applied));
check('S09-06', 'L2 "TXN ACTIVE - Rs 100" and L7 "ACTIVE" became claimable', entState('L2') === 'ELIGIBLE_AVAILABLE' && entState('L7') === 'ELIGIBLE_AVAILABLE', `${entState('L2')} ${entState('L7')}`);
check('S09-07', 'L10 was claimable and the bank now says INACTIVE → the card goes Under review, it is not silently removed', entState('L10') === 'UNDER_REVIEW', entState('L10'));
const l2 = await get(`/leads/${L.L2}`, 'a1');
const h2 = JSON.stringify(await get(`/leads/${L.L2}/mis-history`, 'a1'));
check('S09-08', 'L2 shows the new activation and keeps the old value in its history (INACTIVE → TXN ACTIVE - Rs 100)', l2.activation.display === 'TXN ACTIVE - Rs 100' && /INACTIVE/.test(h2) && /TXN ACTIVE - Rs 100/.test(h2), l2.activation.display);
const yesterday = new Date(Date.now() - 2 * 24 * 3600_000).toISOString().slice(0, 10);
const stale = await importMis(A, [{ 'Application No': 'UATA1001', CUSTOMER_NAME: 'Lead One Customer', CURRENT_STAGE: 'Card Issued', FINAL_DECISION: 'Approved', 'Card Activation Staus': 'INACTIVE' }], 'uat-older-report.xlsx', yesterday);
check('S09-09', 'An older-dated bank report uploaded later changes nothing (L1 stays V + ACTIVE and claimable)', stale.applied.staleSkipped === 1 && stale.applied.updatedChanged === 0 && (await get(`/leads/${L.L1}`, 'a1')).activation.display === 'V + ACTIVE' && entState('L1') === 'ELIGIBLE_AVAILABLE', JSON.stringify(stale.applied));
await denied('S09-10', 'A card under review cannot be claimed', () => request('a3', ['L10']), [400, 409, 422]);

// ── PR1: a1 claims both cards → Manager North → Admin sets ₹3,000 → Accounts pays with proof ──
const pr1 = await request('a1', 'all');
state.ids.requests.PR1 = pr1.id;
save();
check('S09-11', 'PR1 holds both of a1\'s cards and waits for approvals', pr1.state === 'PENDING_APPROVALS' && pr1.itemCount === 2, { state: pr1.state, items: pr1.itemCount });
await denied('S09-12', 'The same cards cannot be claimed twice (nothing left to claim)', () => request('a1', 'all'), [400, 409, 422]);
await denied('S09-13', 'A reserved card cannot be put in a second request', () => request('a1', ['L1']), [400, 409, 422]);
await denied('S09-14', "Another Advisor cannot open a1's request", () => req(pr1.id, 'a2'), [403, 404]);
await denied('S09-15', 'The other Manager cannot approve it', () => approve('m2', pr1.id), [403, 404]);
await denied('S09-16', 'The Advisor cannot approve their own request', () => approve('a1', pr1.id), [403, 404]);
await denied('S09-17', 'The Admin cannot approve before the Manager (the Manager step is not skipped)', () => approve(A, pr1.id, { amountInr: 3000 }), [400, 409, 422]);
await denied('S09-18', 'Accounts cannot see a request before both approvals', () => req(pr1.id, 'acc'), [403, 404]);
const m1Awaiting = await call('GET', '/payouts/requests?awaitingMe=true', { as: 'm1', raw: true });
check('S09-19', 'The request is in Manager North\'s "awaiting me" list', (m1Awaiting.data.items ?? m1Awaiting.data).some((r) => r.id === pr1.id), '');
const adminAwaitingBefore = await call('GET', '/payouts/requests?awaitingMe=true', { as: A, raw: true });
check('S09-20', 'It is not in the Admin\'s "awaiting me" list until the Manager has approved', !(adminAwaitingBefore.data.items ?? adminAwaitingBefore.data).some((r) => r.id === pr1.id), '');
const afterMgr = await approve('m1', pr1.id);
check('S09-21', 'After the Manager approves, the request still waits (one approval is not two)', afterMgr.state === 'PENDING_APPROVALS', afterMgr.state);
await denied('S09-22', 'The Manager cannot approve twice', () => approve('m1', pr1.id), [400, 409, 422]);
await denied('S09-23', 'The Admin must enter the amount to approve', () => approve(A, pr1.id), [400, 422]);
const afterAdmin = await approve(A, pr1.id, { amountInr: 3000 });
check('S09-24', 'Admin approves with ₹3,000 → Approved, awaiting payment', afterAdmin.state === 'APPROVED' && inr(afterAdmin.totalAmountInr) === 3000, { state: afterAdmin.state, amt: afterAdmin.totalAmountInr });
eq('S09-25', 'The amount is split across the two cards (₹1,500 each) in the books', sql(`select string_agg("amountInr"::text, ',' order by "amountInr") from "PayoutEntitlement" where "leadId" in ('${L.L1}','${L.L2}')`), '1500.00,1500.00');
const a1View = await req(pr1.id, 'a1');
check('S09-26', 'The Advisor sees the request as approved but no per-card rate', a1View.state === 'APPROVED' && (a1View.items ?? []).every((i) => !i.amountInr && !i.amountSnapshotInr), JSON.stringify(a1View.items ?? []).slice(0, 200));
const l1after = await get(`/leads/${L.L1}`, 'a1');
check('S09-27', 'Approving a payout does not change any bank field on the lead', l1after.activation.display === 'V + ACTIVE' && l1after.stage.display === 'Card Issued', '');

// Accounts
const accView = await req(pr1.id, 'acc');
check('S09-28', 'Accounts now sees the approved request with both approvals (who, when) and the amount', accView.state === 'APPROVED' && accView.approvals?.manager?.decision === 'APPROVED' && accView.approvals?.manager?.by?.fullName === 'Meera Manager North' && accView.approvals?.admin?.decision === 'APPROVED' && inr(accView.totalAmountInr) === 3000, JSON.stringify(accView.approvals ?? []).slice(0, 300));
check('S09-29', 'The payee bank account is masked in the request', !JSON.stringify(accView).includes('111122223331'), '');
const payeeMasked = await get(`/payouts/requests/${pr1.id}/payee`, 'acc');
const logsBefore = Number(sql(`select count(*) from "SensitiveAccessLog"`));
const payee = await get(`/payouts/requests/${pr1.id}/payee?reveal=bank`, 'acc');
check('S09-30', 'Payee details are masked by default; Accounts can reveal the full account to pay, and the reveal is logged', payeeMasked.accountNumber === null && payee.accountNumber === '111122223331' && payee.verified === true && Number(sql(`select count(*) from "SensitiveAccessLog"`)) === logsBefore + 1, JSON.stringify(payee).slice(0, 200));
await denied('S09-31', 'A Manager cannot reveal the payee account', () => get(`/payouts/requests/${pr1.id}/payee?reveal=bank`, 'm1'), 403);
await denied('S09-32', 'A Manager cannot record a payment', () => post(`/payouts/requests/${pr1.id}/payment`, 'm1', { paidAt: now(), amountInr: 3000, transferReference: 'UATUTR0001' }), 403);
// a wrong amount is not silently accepted and not silently refused: it is held as an exception (REQ-17 §17.7)
const wrong = await post(`/payouts/requests/${pr1.id}/payment`, 'acc', { paidAt: now(), amountInr: 2999, transferReference: 'UATUTR0001', method: 'NEFT', proofFileId: await proof() });
check('S09-33', 'A transfer of ₹2,999 against an approved ₹3,000 is held as a payment exception — the request is On hold, not Paid', wrong.state === 'ON_HOLD' && entState('L1') !== 'PAID' && (await ledger('a1')).paid.amountInr === 0, wrong.state);
const exq = await call('GET', '/payouts/requests?queue=exceptions', { as: 'acc', raw: true });
check('S09-34', 'It shows in the Accounts "Exceptions" queue and the Admin is notified', (exq.data.items ?? exq.data).some((r) => r.id === pr1.id) && Number(sql(`select count(*) from "Notification" n join "User" u on u.id = n."recipientUserId" where u.role='ADMIN' and n.kind='PAYOUT_EXCEPTION'`)) >= 1, '');
await denied('S09-34b', 'A second payment cannot simply be added on top', async () => post(`/payouts/requests/${pr1.id}/payment`, 'acc', { paidAt: now(), amountInr: 3000, transferReference: 'UATUTR0001B', proofFileId: await proof() }), [400, 409, 422]);
await denied('S09-34c', 'A payment dated in the future is refused', async () => post(`/payouts/requests/${pr1.id}/payment/correct`, 'acc', { paidAt: new Date(Date.now() + 86400_000).toISOString(), amountInr: 3000, transferReference: 'UATUTR0001C', proofFileId: await proof(), reason: 'TEST: future date' }), [400, 422]);
await denied('S09-34d', 'Only Accounts proposes a correction (Admin refused)', async () => post(`/payouts/requests/${pr1.id}/payment/correct`, A, { paidAt: now(), amountInr: 3000, transferReference: 'UATUTR0001C', reason: 'TEST: admin tries to correct' }), 403);
await post(`/payouts/requests/${pr1.id}/payment/correct`, 'acc', { paidAt: now(), amountInr: 3000, transferReference: 'UATUTR0001C', method: 'NEFT', proofFileId: await proof(), reason: 'TEST: balance ₹1 sent, full ₹3,000 now transferred' });
await denied('S09-34e', 'Accounts cannot approve their own correction', () => post(`/payouts/requests/${pr1.id}/payment/correction-decision`, 'acc', { decision: 'APPROVED', reason: 'TEST: self approval' }), 403);
const paid1 = await post(`/payouts/requests/${pr1.id}/payment/correction-decision`, A, { decision: 'APPROVED', reason: 'TEST: checked against the bank statement' });
check('S09-35', 'Accounts proposes the corrected entry, the Admin approves it → Paid; the first entry is kept as superseded', paid1.state === 'PAID' && sql(`select string_agg(state::text, ',' order by "createdAt") from "ExternalPayment" where "requestId"='${pr1.id}'`) === 'SUPERSEDED,VERIFIED', paid1.state + ' ' + sql(`select string_agg(state::text, ',' order by "createdAt") from "ExternalPayment" where "requestId"='${pr1.id}'`));
await denied('S09-36', 'A paid request cannot be paid again', async () => post(`/payouts/requests/${pr1.id}/payment`, 'acc', { paidAt: now(), amountInr: 3000, transferReference: 'UATUTR0001D', proofFileId: await proof() }), [400, 409, 422]);
eq('S09-37', 'Both cards are now "Paid"; the bank activation on the leads is untouched', [entState('L1'), entState('L2'), (await get(`/leads/${L.L2}`, 'a1')).activation.display], ['PAID', 'PAID', 'TXN ACTIVE - Rs 100']);
const a1Paid = await req(pr1.id, 'a1');
check('S09-38', 'The Advisor sees the payment receipt (amount, date, reference) once Paid', a1Paid.state === 'PAID' && inr(a1Paid.receipt?.amountInr ?? a1Paid.totalAmountInr) === 3000 && /0001C|001C/.test(JSON.stringify(a1Paid.receipt ?? {})), JSON.stringify(a1Paid.receipt ?? {}).slice(0, 200));

// ── PR2: a2 claims L5, Manager rejects → card is released ──
const pr2 = await request('a2', ['L5']);
state.ids.requests.PR2 = pr2.id;
await denied('S09-39', 'A rejection needs a reason', () => reject('m1', pr2.id), [400, 422]);
const rej = await reject('m1', pr2.id, 'TEST: please claim both cards together');
check('S09-40', 'Manager rejects → Rejected; the card is claimable again; the Advisor sees the reason', rej.state === 'REJECTED' && entState('L5') === 'ELIGIBLE_AVAILABLE' && /claim both cards together/.test(JSON.stringify(await req(pr2.id, 'a2'))), `${rej.state} ${entState('L5')}`);
await denied('S09-41', 'A rejected request cannot be approved by the Admin afterwards', () => approve(A, pr2.id, { amountInr: 100 }), [400, 409, 422]);

// ── PR3: a2 claims both → ₹2,500.50 → payment first, proof later ──
const pr3 = await request('a2', 'all');
state.ids.requests.PR3 = pr3.id;
await approve('m1', pr3.id);
await approve(A, pr3.id, { amountInr: 2500.5 });
eq('S09-42', '₹2,500.50 over two cards splits to the paisa (₹1,250.25 each)', sql(`select string_agg("amountInr"::text, ',' order by "amountInr") from "PayoutEntitlement" where "leadId" in ('${L.L5}','${L.L7}')`), '1250.25,1250.25');
await denied('S09-43', 'A bank transfer reference already used on another payment is refused', async () => post(`/payouts/requests/${pr3.id}/payment`, 'acc', { paidAt: now(), amountInr: 2500.5, transferReference: 'UATUTR0001C', proofFileId: await proof() }), [400, 409, 422]);
const noProof = await post(`/payouts/requests/${pr3.id}/payment`, 'acc', { paidAt: now(), amountInr: 2500.5, transferReference: 'UATUTR0003', method: 'IMPS' });
check('S09-44', 'Payment recorded without proof is NOT Paid yet ("payment recorded, proof pending")', noProof.state === 'PAYMENT_RECORDED_PENDING_PROOF', noProof.state);
eq('S09-45', 'Until the proof is attached the Advisor\'s paid total stays 0', (await ledger('a2')).paid.amountInr, 0);
const withProof = await post(`/payouts/requests/${pr3.id}/payment/proof`, 'acc', { proofFileId: await proof() });
check('S09-46', 'Attaching the proof completes it → Paid', withProof.state === 'PAID', withProof.state);

// ── PR4: Manager South → Admin ₹1,500 → left unpaid ──
await denied('S09-47', "Manager North cannot approve Manager South's Advisor", () => approve('m1', pr4.id), [403, 404]);
await approve('m2', pr4.id);
const pr4a = await approve(A, pr4.id, { amountInr: 1500 });
check('S09-48', 'PR4 is approved and waits in the Accounts queue (not paid)', pr4a.state === 'APPROVED', pr4a.state);

// ── a3: request for L9 then cancel → released ──
const tmp = await request('a3', ['L9']);
const cancelled = await post(`/payouts/requests/${tmp.id}/cancel`, 'a3', { reason: 'TEST: raised by mistake' }).catch((e) => ({ err: e.message }));
check('S09-49', 'An Advisor can cancel a request before any approval; the card is claimable again', cancelled.state === 'CANCELLED' && entState('L9') === 'ELIGIBLE_AVAILABLE', JSON.stringify(cancelled).slice(0, 200));
await denied('S09-50', 'An approved request cannot be cancelled by the Advisor', () => post(`/payouts/requests/${pr4.id}/cancel`, 'a3', { reason: 'TEST: too late' }), [400, 403, 409, 422]);

// ── PR5: Admin-direct Advisor → designated Manager approver → Admin ₹1,000 → paid ──
const pr5 = await request('a4', 'all');
state.ids.requests.PR5 = pr5.id;
save();
await denied('S09-51', 'For the Admin-direct Advisor only the designated Manager (North) can give the Manager approval — South is refused', () => approve('m2', pr5.id), [403, 404]);
await denied('S09-52', 'The Admin still cannot approve first', () => approve(A, pr5.id, { amountInr: 1000 }), [400, 409, 422]);
await approve('m1', pr5.id);
await approve(A, pr5.id, { amountInr: 1000 });
const paid5 = await post(`/payouts/requests/${pr5.id}/payment`, 'acc', { paidAt: now(), amountInr: 1000, transferReference: 'UATUTR0005', method: 'UPI', proofFileId: await proof() });
check('S09-53', 'PR5 is paid', paid5.state === 'PAID', paid5.state);

// ── end states ──
const states = Object.fromEntries(Object.entries(state.ids.requests).map(([k, id]) => [k, sql(`select state from "PayoutRequest" where id='${id}'`)]));
eq('S09-54', 'Request end states are as planned', states, { PR4: 'APPROVED', PR1: 'PAID', PR2: 'REJECTED', PR3: 'PAID', PR5: 'PAID' });
const cardStates = Object.fromEntries(['L1', 'L2', 'L5', 'L7', 'L8', 'L9', 'L10', 'L11'].map((k) => [k, entState(k)]));
eq('S09-55', 'Card end states are as planned', cardStates, { L1: 'PAID', L2: 'PAID', L5: 'PAID', L7: 'PAID', L8: 'RESERVED', L9: 'ELIGIBLE_AVAILABLE', L10: 'UNDER_REVIEW', L11: 'PAID' });
eq('S09-56', 'No card is in two live requests and none was paid twice (INV-06)', sql(`select count(*) from (select "entitlementId" from "PayoutRequestItem" i join "PayoutRequest" r on r.id = i."requestId" where r.state in ('PENDING_APPROVALS','APPROVED','PAYMENT_RECORDED_PENDING_PROOF','PAID','ON_HOLD') group by 1 having count(*) > 1) x`), '0');
const audit = sql(`select action, count(*) from "AuditLog" where action like 'payout%' or action like 'payment%' group by 1 order by 1`);
check('S09-57', 'Every money action is in the audit trail with its actor (request, approval, payment, proof, cancel)', /payoutRequest\.decide/.test(audit) && /payment\.record/.test(audit) && /payment\.proof/.test(audit) && /payoutRequest\.cancel/.test(audit), audit.replace(/\n/g, ', '));

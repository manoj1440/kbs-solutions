import { misApplyTransaction } from '@kbs/db';
import { makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

/**
 * F-702 / F-703 (DASH-01, DASH-02). Fixture: two teams, each with a Telecaller (calls, outcomes, shares, callbacks)
 * and an Advisor (leads with MIS values incl. blank and unmatched). Figures are checked against raw table counts.
 */
describe('F-702 Manager dashboard / F-703 Admin dashboards (DASH-01, DASH-02)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let admin: string;
  const team: { managerToken: string; managerId: string; telecallerId: string; advisorId: string }[] = [];
  let hdfcId: string;
  let cardId: string;
  let misBatchId: string;
  let seq = 0;
  const api = () => request(app.getHttpServer());
  const get = async (path: string, token: string, status = 200) => (await api().get(`/api/v1${path}`).set(auth(token)).expect(status)).body.data;

  async function callingFixture(tcId: string, n: { connected: number; noAnswer: number; failedBefore: number; recorded: number }) {
    const adm = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    const file = await prisma.storedFile.create({ data: { bucket: 'b', key: `k${++seq}`, sha256: 'x', originalName: 'c.xlsx', contentType: 'application/octet-stream', sizeBytes: 1, purpose: 'CUSTOMER_LIST', uploadedByUserId: adm.id } });
    const batch = await prisma.customerImportBatch.create({ data: { publicRef: makePublicRef(RefPrefix.IMPORT_BATCH), fileId: file.id, uploaderUserId: adm.id, checksum: `cb-${seq}` } });
    const recs: { id: string }[] = [];
    for (let i = 0; i < 4; i++) recs.push(await prisma.callingRecord.create({ data: { batchId: batch.id, sourceRowNumber: i + 1, fullName: `C ${seq}-${i}`, mobile: `+9196${String(++seq).padStart(8, '0')}`, pincode: '302001', resolvedState: 'Rajasthan', assignedTelecallerUserId: tcId, assignedAt: new Date(), ...(i === 3 ? { hiddenAt: new Date(), hiddenReason: 'closed' } : {}) } }));
    let k = 0;
    const attempt = async (data: object) => prisma.callAttempt.create({ data: { callingRecordId: recs[k++ % 3].id, telecallerUserId: tcId, providerKey: 'mock', targetMobileMasked: '+91••••••0000', idempotencyKey: idem(), ...data } });
    for (let i = 0; i < n.connected; i++) {
      const a = await attempt({ providerCallId: `pc-${idem()}`, providerState: 'ENDED', connectedAt: new Date(), endedAt: new Date(), durationSec: 60 });
      if (i < n.recorded) await prisma.callRecording.create({ data: { callAttemptId: a.id, status: 'AVAILABLE' } });
      await prisma.callOutcome.create({ data: { callAttemptId: a.id, callingRecordId: a.callingRecordId, telecallerUserId: tcId, outcome: 'CONNECTED_INTERESTED' } });
    }
    for (let i = 0; i < n.noAnswer; i++) {
      const a = await attempt({ providerCallId: `pc-${idem()}`, providerState: 'NO_ANSWER' });
      await prisma.callOutcome.create({ data: { callAttemptId: a.id, callingRecordId: a.callingRecordId, telecallerUserId: tcId, outcome: 'NO_ANSWER_OR_FAILED' } });
    }
    for (let i = 0; i < n.failedBefore; i++) await attempt({ providerState: 'FAILED', failureReason: 'network' });
    await prisma.shareAction.create({ data: { actorUserId: tcId, callingRecordId: recs[0].id, kind: 'APPLICATION_LINK', targetMobileMasked: '+91••••••0000', channel: 'WHATSAPP_HANDOFF', handoffResult: 'OPENED' } });
    await prisma.shareAction.create({ data: { actorUserId: tcId, callingRecordId: recs[0].id, kind: 'BENEFIT_PDF', targetMobileMasked: '+91••••••0000', channel: 'WHATSAPP_HANDOFF', handoffResult: 'OPENED' } });
    await prisma.followUpTask.create({ data: { callingRecordId: recs[1].id, ownerUserId: tcId, text: 'call back', dueAt: new Date(Date.now() - 3_600_000) } });
    await prisma.followUpTask.create({ data: { callingRecordId: recs[2].id, ownerUserId: tcId, text: 'done one', dueAt: new Date(Date.now() - 7_200_000), doneAt: new Date() } });
  }

  async function lead(advisorId: string, snap: { currentStage?: string | null; finalDecision?: string | null; cardActivationStatus?: string | null; declineDescription?: string | null } | null) {
    const l = await prisma.lead.create({ data: { publicRef: makePublicRef(RefPrefix.LEAD), advisorUserId: advisorId, reportingParentUserIdSnapshot: advisorId, bankId: hdfcId, cardId, customerFullName: `L ${++seq}`, customerMobile: `+9195${String(seq).padStart(8, '0')}`, pincode: '302001', state: 'Rajasthan', employmentType: 'SALARIED', annualIncomeItr: 500000, declarations: {}, bureauAckAt: new Date(), idempotencyKey: idem() } });
    // fixture only: bank-status rows can be written solely inside the MIS apply context (INV-01)
    if (snap) await misApplyTransaction(prisma, misBatchId, (tx) => tx.bankStatusSnapshot.create({ data: { leadId: l.id, bankId: hdfcId, ...snap, rawLatest: {}, lastMatchedBatchId: misBatchId, lastMatchedAt: new Date(), firstMatchedAt: new Date() } }));
    return l;
  }

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    admin = (await loginAs(app, prisma, ADMIN_MOBILE)).accessToken;
    hdfcId = (await prisma.bank.findUniqueOrThrow({ where: { code: 'HDFC' } })).id;
    cardId = (await prisma.creditCard.create({ data: { bankId: hdfcId, name: 'HDFC D', status: 'PUBLISHED' } })).id;
    const adm = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    const profile = await prisma.misImportProfile.findFirstOrThrow({ where: { bankId: hdfcId } });
    const f = await prisma.storedFile.create({ data: { bucket: 'b', key: 'mis', sha256: 'x', originalName: 'm.xlsx', contentType: 'application/octet-stream', sizeBytes: 1, purpose: 'MIS', uploadedByUserId: adm.id } });
    misBatchId = (await prisma.misImportBatch.create({ data: { publicRef: makePublicRef(RefPrefix.MIS_BATCH), bankId: hdfcId, profileId: profile.id, fileId: f.id, uploaderUserId: adm.id, checksum: 'dash', stage: 'APPLIED', appliedAt: new Date() } })).id;
    for (const [i, sfx] of ['94001', '94002'].entries()) {
      const m = await setupManagerAndTelecaller(app, prisma, sfx);
      const a = await prisma.user.create({ data: { publicRef: makePublicRef(RefPrefix.USER), mobile: `+91955599990${i}`, role: 'ADVISOR', status: 'ACTIVE', fullName: `Dash Advisor ${i}` } });
      await prisma.reportingAssignment.create({ data: { childUserId: a.id, parentUserId: m.managerId, source: 'AGENT_CODE', status: 'ACTIVE' } });
      team.push({ managerToken: m.manager.accessToken, managerId: m.managerId, telecallerId: m.telecallerId, advisorId: a.id });
    }
    await callingFixture(team[0].telecallerId, { connected: 3, noAnswer: 2, failedBefore: 1, recorded: 2 });
    await callingFixture(team[1].telecallerId, { connected: 1, noAnswer: 1, failedBefore: 0, recorded: 0 });
    await lead(team[0].advisorId, { currentStage: 'Decisioned Cases', finalDecision: 'Approve', cardActivationStatus: 'V + ACTIVE' });
    await lead(team[0].advisorId, { currentStage: 'Decisioned Cases', finalDecision: 'Decline', cardActivationStatus: null, declineDescription: 'Low bureau score' });
    await lead(team[0].advisorId, { currentStage: 'Decisioned Cases', finalDecision: 'Approve', cardActivationStatus: '#N/A' });
    await lead(team[0].advisorId, null);
    await lead(team[1].advisorId, { currentStage: 'IPA', finalDecision: null, cardActivationStatus: 'TXN ACTIVE - Rs 100' });
  });
  afterAll(async () => app.close());

  it('DASH-01: attempts, connections, shares, leads, decisions and activations are separate metrics with source and date basis', async () => {
    const d = await get('/dashboards/manager', team[0].managerToken);
    expect(d.scope).toBe('My team');
    expect(d.calling.calls).toMatchObject({
      attempts: { value: 5, source: 'TELEPHONY_PROVIDER', dateBasis: 'Call initiated date' },
      failedBeforeProvider: { value: 1, source: 'KBS_CALLING' },
      connected: { value: 3, denominator: { label: 'provider-confirmed attempts', value: 5 } },
      notAnswered: { value: 2 },
      recordingsAvailable: { value: 2, denominator: { label: 'connected calls', value: 3 } },
      uniqueCustomersContacted: { value: 3 },
    });
    expect(d.calling.records).toMatchObject({ uploaded: { value: 4 }, assigned: { value: 4 }, active: { value: 3 }, hidden: { value: 1 } });
    expect(d.calling.outcomes).toMatchObject({ CONNECTED_INTERESTED: { value: 3 }, NO_ANSWER_OR_FAILED: { value: 2 } });
    expect(d.calling.shares).toMatchObject({ total: { value: 2, source: 'KBS_SHARING' }, delivered: { value: 0 }, byKind: { APPLICATION_LINK: { value: 1 }, BENEFIT_PDF: { value: 1 } } });
    expect(d.calling.callbacks).toMatchObject({ due: { value: 1 }, completed: { value: 1 } });
    // leads + bank values: raw verbatim, blank → Not reported, unmatched → Awaiting MIS; distinct activation values never merged
    expect(d.advisors.leads).toMatchObject({ created: { value: 4, source: 'KBS_LEADS' }, misMatched: { value: 3, source: 'BANK_MIS', denominator: { value: 4 } }, awaitingMis: { value: 1 } });
    const b = (x: { buckets: { value: string; count: number }[] }) => Object.fromEntries(x.buckets.map((y) => [y.value, y.count]));
    expect(b(d.advisors.decision)).toEqual({ Approve: 2, Decline: 1, 'Awaiting MIS': 1 });
    expect(b(d.advisors.activation)).toEqual({ 'V + ACTIVE': 1, 'Not reported': 2, 'Awaiting MIS': 1 });
    expect(d.advisors.bankReasons).toMatchObject({ leadsWithReason: { value: 1, denominator: { value: 3 } }, top: [{ value: 'Low bureau score', count: 1 }] });
    // same numbers from raw tables (fixture equality)
    expect(d.calling.calls.connected.value).toBe(await prisma.callAttempt.count({ where: { telecallerUserId: team[0].telecallerId, connectedAt: { not: null } } }));
    expect(d.advisors.leads.created.value).toBe(await prisma.lead.count({ where: { advisorUserId: team[0].advisorId } }));
    expect(d.meta.misFreshness.find((f: { bank: { code: string } }) => f.bank.code === 'HDFC').lastAppliedAt).not.toBeNull();
    expect(d.meta.note).toContain('never live bank status');
  });

  it('DASH-02: Manager totals equal Admin totals filtered to that team; team sums equal the organisation', async () => {
    const strip = (x: { calling: unknown; advisors: unknown }) => JSON.parse(JSON.stringify({ calling: x.calling, advisors: x.advisors }));
    for (const t of team) {
      const mine = strip(await get('/dashboards/manager', t.managerToken));
      expect(strip(await get(`/dashboards/manager?managerId=${t.managerId}`, admin))).toEqual(mine);
    }
    const org = await get('/dashboards/manager', admin); // Admin without a team filter = whole organisation
    const a = await get('/dashboards/manager', team[0].managerToken);
    const c = await get('/dashboards/manager', team[1].managerToken);
    expect(org.calling.calls.attempts.value).toBe(a.calling.calls.attempts.value + c.calling.calls.attempts.value);
    expect(org.advisors.leads.created.value).toBe(a.advisors.leads.created.value + c.advisors.leads.created.value);
    expect(org.scope).toBe('All teams');
    // filters narrow, and scoping blocks other teams
    expect((await get(`/dashboards/manager?telecallerId=${team[0].telecallerId}`, team[0].managerToken)).calling.calls.attempts.value).toBe(5);
    await get(`/dashboards/manager?telecallerId=${team[1].telecallerId}`, team[0].managerToken, 404);
    await get(`/dashboards/manager?managerId=${team[1].managerId}`, team[0].managerToken, 404);
    expect((await get('/dashboards/manager?misRecency=never', team[0].managerToken)).advisors.leads.created.value).toBe(1);
    expect((await get(`/dashboards/manager?bankId=${hdfcId}&state=rajasthan`, team[0].managerToken)).advisors.leads.created.value).toBe(4);
  });

  it('F-703 (DASH-02 across dashboards): per-telecaller / per-manager / per-advisor rows and bank-card mix reconcile with the executive totals; conflicts are never hidden', async () => {
    const org = await get('/dashboards/admin/executive', admin);
    const tcs = await get('/dashboards/admin/telecallers', admin);
    expect(tcs.rows.reduce((s: number, r: { calls: { attempts: { value: number } } }) => s + r.calls.attempts.value, 0)).toBe(org.calling.calls.attempts.value);
    const mgrs = await get('/dashboards/admin/managers', admin);
    expect(mgrs.rows).toHaveLength(2);
    expect(mgrs.rows.reduce((s: number, r: { leads: { created: { value: number } } }) => s + r.leads.created.value, 0)).toBe(org.advisors.leads.created.value);
    const advs = await get('/dashboards/admin/advisors', admin);
    expect(advs.rows.find((r: { user: { id: string } }) => r.user.id === team[0].advisorId).leads).toMatchObject({ created: { value: 4 }, misMatched: { value: 3 } });
    const mix = await get('/dashboards/admin/bank-card-mix', admin);
    expect(mix.rows).toEqual([expect.objectContaining({ bank: expect.objectContaining({ code: 'HDFC' }), card: expect.objectContaining({ id: cardId }), leads: 5, misMatched: 4, awaitingMis: 1 })]);
    expect(org.alerts.map((x: { kind: string }) => x.kind)).not.toContain('MIS_UNMATCHED');
    expect(org.alerts.map((x: { kind: string }) => x.kind)).toContain('LAUNCH_GATES_OPEN'); // baseline gates are open
    // an unmatched MIS row must raise the executive banner (REQ-20 §20.4)
    await prisma.misRow.create({ data: { batchId: misBatchId, sourceRowNumber: 99, rowHash: 'h99', raw: {}, matchState: 'UNMATCHED' } });
    const again = await get('/dashboards/admin/executive', admin);
    expect(again.alerts).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'MIS_UNMATCHED', count: 1 })]));
    await get('/dashboards/admin/telecallers', team[0].managerToken, 403);
  });

  it('F-811: admin home returns team, calling, MIS, leads, payout and catalogue totals plus the newest leads (RBAC-01)', async () => {
    const d = await get('/dashboards/admin/home', admin);
    expect(d.people.MANAGER.total).toBe(2);
    expect(d.people.TELECALLER.total).toBe(2);
    expect(d.people.ADVISOR.total).toBe(2);
    expect(d.calling.total).toBe(await prisma.callingRecord.count());
    expect(d.mis.total).toBe(await prisma.bankStatusSnapshot.count());
    expect(d.leads.total).toBe(5);
    expect(d.catalogue.banks.total).toBe(await prisma.bank.count());
    expect(d.recentLeads).toHaveLength(5);
    expect(Date.parse(d.recentLeads[0].leadCreatedAt)).toBeGreaterThanOrEqual(Date.parse(d.recentLeads.at(-1).leadCreatedAt));
    expect(d.note).toContain('never live bank status');
    await get('/dashboards/admin/home', team[0].managerToken, 403);
  });

  it('F-703 executive = Manager dashboard filtered to that team (same engine)', async () => {
    const strip = (x: { calling: unknown; advisors: unknown }) => JSON.parse(JSON.stringify({ calling: x.calling, advisors: x.advisors }));
    for (const t of team) expect(strip(await get(`/dashboards/admin/executive?managerId=${t.managerId}`, admin))).toEqual(strip(await get('/dashboards/manager', t.managerToken)));
    await get('/dashboards/admin/executive', team[0].managerToken, 403);
  });
  it('F-315: Manager Advisor drill-down = F-702 engine per Advisor, own team only, three separate distributions, no ranking (DASH-02, RBAC-01)', async () => {
    const [a, b] = team;
    const mine = await get('/dashboards/manager/advisors', a.managerToken);
    expect(mine.rows).toHaveLength(1);
    const row = mine.rows[0];
    expect(row.user).toMatchObject({ id: a.advisorId, fullName: 'Dash Advisor 0', status: 'ACTIVE' });
    expect(row.user.mobileMasked).not.toContain('9555999900');
    expect(row.reporting).toMatchObject({ source: 'AGENT_CODE', parent: { id: a.managerId } });
    // same numbers as the Manager dashboard filtered to that Advisor
    const one = await get(`/dashboards/manager?advisorId=${a.advisorId}`, a.managerToken);
    expect(JSON.parse(JSON.stringify({ leads: row.leads, decision: row.decision, activation: row.activation, payouts: row.payouts }))).toEqual(JSON.parse(JSON.stringify({ leads: one.advisors.leads, decision: one.advisors.decision, activation: one.advisors.activation, payouts: one.advisors.payouts })));
    expect(row.leads).toMatchObject({ created: { value: 4 }, misMatched: { value: 3, denominator: { value: 4 } }, awaitingMis: { value: 1 } });
    const buckets = (d: { buckets: { value: string; count: number }[] }) => Object.fromEntries(d.buckets.map((x) => [x.value, x.count]));
    expect(buckets(row.decision)).toEqual({ Approve: 2, Decline: 1, 'Awaiting MIS': 1 });
    expect(buckets(row.activation)).toEqual({ 'V + ACTIVE': 1, 'Not reported': 2, 'Awaiting MIS': 1 });
    expect(buckets(row.stage)).toEqual({ 'Decisioned Cases': 3, 'Awaiting MIS': 1 });
    expect(row.awaitingManagerApproval).toBe(0);
    expect(Object.keys(row).filter((k) => /rank|score/i.test(k))).toEqual([]);
    // scope: another team's Advisor is invisible; Admin sees any team; Telecaller is refused
    await get(`/dashboards/manager/advisors?advisorId=${b.advisorId}`, a.managerToken, 404);
    await get(`/dashboards/manager/advisors?managerId=${b.managerId}`, a.managerToken, 404);
    const adminView = await get(`/dashboards/manager/advisors?managerId=${b.managerId}`, admin);
    expect(adminView.rows.map((r: { user: { id: string } }) => r.user.id)).toEqual([b.advisorId]);
    expect((await get('/dashboards/manager/advisors', admin)).rows).toHaveLength(2);
    const tc = await prisma.user.findUniqueOrThrow({ where: { id: a.telecallerId } });
    const tcToken = (await loginAs(app, prisma, tc.mobile.replace('+91', ''))).accessToken;
    await get('/dashboards/manager/advisors', tcToken, 403);
  });
});

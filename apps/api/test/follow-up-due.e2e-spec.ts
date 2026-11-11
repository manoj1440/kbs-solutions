import { containsSensitive, makePublicRef, RefPrefix } from '@kbs/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';
import { FOLLOW_UP_DUE_JOB, FollowUpDueService } from '../src/modules/maintenance/follow-up-due.service';
import { MaintenanceProcessor } from '../src/modules/maintenance/maintenance.processor';

import { auth, bootTestApp, idem, loginAs, resetDatabase, setupManagerAndTelecaller } from './helpers';

describe('Follow-up due notifications (REQ-19 §19.1)', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  let svc: FollowUpDueService;
  let team: Awaited<ReturnType<typeof setupManagerAndTelecaller>>;
  let batchId: string;
  let row = 1;
  const api = () => request(app.getHttpServer());

  const record = (name: string, mobile: string, data: Record<string, unknown> = {}) =>
    prisma.callingRecord.create({
      data: { batchId, sourceRowNumber: ++row, fullName: name, mobile, pincode: '302001', assignedTelecallerUserId: team.telecallerId, assignedAt: new Date(), interactionStatus: 'FOLLOW_UP', nextFollowUpAt: new Date(Date.now() - 60_000), ...data },
    });
  const due = (where: { recipientUserId?: string; callingRecordId?: string }) =>
    prisma.notification.findMany({ where: { kind: 'FOLLOW_UP_DUE', recipientUserId: where.recipientUserId, ...(where.callingRecordId ? { sourceRef: { path: ['callingRecordId'], equals: where.callingRecordId } } : {}) }, orderBy: { createdAt: 'asc' } });

  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    svc = app.get(FollowUpDueService);
    team = await setupManagerAndTelecaller(app, prisma, '94001');
    const file = await prisma.storedFile.create({ data: { purpose: 'CUSTOMER_LIST', bucket: 'test', key: 'test/fu.csv', originalName: 'fu.csv', contentType: 'text/csv', sizeBytes: 10, sha256: 'f'.repeat(64), uploadedByUserId: team.admin.user.id } });
    batchId = (await prisma.customerImportBatch.create({ data: { publicRef: makePublicRef(RefPrefix.IMPORT_BATCH), fileId: file.id, uploaderUserId: team.admin.user.id, checksum: 'f'.repeat(64), status: 'IMPORTED', totals: {} } })).id;
  });
  afterAll(async () => app.close());

  it('NOTIF: follow-up due notifies the Telecaller and Manager once (REQ-19 §19.1)', async () => {
    const rec = await record('Asha Due', '+919555694001');
    const future = await record('Not Yet Due', '+919555694002', { nextFollowUpAt: new Date(Date.now() + 3600_000) });

    // the job is registered with the maintenance scheduler under its name and runs through it
    await app.get(MaintenanceProcessor).runMaintenance(FOLLOW_UP_DUE_JOB);
    const tc = await due({ recipientUserId: team.telecallerId });
    const mgr = await due({ recipientUserId: team.managerId });
    expect(tc).toHaveLength(1);
    expect(mgr).toHaveLength(1);
    expect(tc[0]).toMatchObject({ title: 'Follow-up due: Asha Due', deepLink: { entityType: 'CallingRecord', entityId: rec.id } });
    expect(mgr[0]).toMatchObject({ title: 'Follow-up due: Asha Due', deepLink: { entityType: 'User', entityId: team.telecallerId } });
    // name only — the customer mobile never appears (REQ-21 §21.1)
    for (const n of [...tc, ...mgr]) {
      expect(containsSensitive(`${n.title} ${n.body}`)).toBe(false);
      expect(`${n.title} ${n.body}`).not.toContain('9555694001');
    }
    expect(await due({ callingRecordId: future.id })).toHaveLength(0);

    // both recipients can follow their deep link
    const tcToken = (await loginAs(app, prisma, team.telecallerMobile)).accessToken;
    const t1 = await api().get(`/api/v1/notifications/${tc[0].id}/target`).set(auth(tcToken)).expect(200);
    expect(t1.body.data).toMatchObject({ entityType: 'CallingRecord', entityId: rec.id });
    const t2 = await api().get(`/api/v1/notifications/${mgr[0].id}/target`).set(auth(team.manager.accessToken)).expect(200);
    expect(t2.body.data).toMatchObject({ entityType: 'User', entityId: team.telecallerId, targetRole: 'TELECALLER' });

    // run again → still one each
    await svc.run();
    await svc.run();
    expect(await due({ recipientUserId: team.telecallerId })).toHaveLength(1);
    expect(await due({ recipientUserId: team.managerId })).toHaveLength(1);

    await prisma.callingRecord.update({ where: { id: future.id }, data: { interactionStatus: 'INTERESTED', nextFollowUpAt: null } });

    // rescheduled to the future → nothing until it falls due, then a new one each
    const next = new Date(Date.now() + 3600_000);
    await prisma.callingRecord.update({ where: { id: rec.id }, data: { nextFollowUpAt: next } });
    await svc.run();
    expect(await due({ callingRecordId: rec.id })).toHaveLength(2);
    await svc.run(new Date(next.getTime() + 1000));
    expect(await due({ recipientUserId: team.telecallerId })).toHaveLength(2);
    expect(await due({ recipientUserId: team.managerId })).toHaveLength(2);
    await svc.run(new Date(next.getTime() + 300_000));
    expect(await due({ callingRecordId: rec.id })).toHaveLength(4);
  });

  it('NOTIF: no follow-up due notice for do-not-contact, hidden, declined/completed records or deactivated users (REQ-19 §19.1)', async () => {
    const suppressed = await record('Flagged Suppressed', '+919555694011', { suppressed: true });
    const dnc = await record('On Dnc List', '+919555694012');
    await prisma.contactSuppression.create({ data: { mobile: '+919555694012', reason: 'CUSTOMER_REQUEST' } });
    const hidden = await record('Hidden Record', '+919555694013', { hiddenAt: new Date(), hiddenReason: 'DECLINED' });
    const declined = await record('Declined Record', '+919555694014', { interactionStatus: 'DECLINED' });
    const completed = await record('Completed Record', '+919555694015', { interactionStatus: 'COMPLETED' });
    const unassigned = await record('Unassigned Record', '+919555694016', { assignedTelecallerUserId: null });
    const quiet = [suppressed, dnc, hidden, declined, completed, unassigned];

    await svc.run();
    for (const r of quiet) expect(await due({ callingRecordId: r.id })).toHaveLength(0);

    // deactivated Telecaller: neither they nor their Manager are notified
    const other = await setupManagerAndTelecaller(app, prisma, '94002');
    const theirs = await record('Deactivated Owner', '+919555694017', { assignedTelecallerUserId: other.telecallerId });
    await prisma.user.update({ where: { id: other.telecallerId }, data: { status: 'DEACTIVATED' } });
    await svc.run();
    expect(await due({ callingRecordId: theirs.id })).toHaveLength(0);

    // Telecaller active but Manager deactivated → Telecaller only; no reporting parent → Telecaller only
    await prisma.user.update({ where: { id: other.telecallerId }, data: { status: 'ACTIVE' } });
    await prisma.user.update({ where: { id: other.managerId }, data: { status: 'DEACTIVATED' } });
    await svc.run();
    expect((await due({ callingRecordId: theirs.id })).map((n) => n.recipientUserId)).toEqual([other.telecallerId]);
    await prisma.user.update({ where: { id: other.managerId }, data: { status: 'ACTIVE' } });
    await prisma.reportingAssignment.updateMany({ where: { childUserId: other.telecallerId }, data: { effectiveTo: new Date() } });
    const orphan = await record('No Manager', '+919555694018', { assignedTelecallerUserId: other.telecallerId });
    await svc.run();
    expect((await due({ callingRecordId: orphan.id })).map((n) => n.recipientUserId)).toEqual([other.telecallerId]);
    expect(await due({ recipientUserId: other.managerId })).toHaveLength(0);
  });

  it('NOTIF: lead follow-up task due notifies the Advisor once per due time (REQ-19 §19.1)', async () => {
    const adv = await prisma.user.create({ data: { publicRef: makePublicRef(RefPrefix.USER), mobile: '+919555994003', role: 'ADVISOR', status: 'ACTIVE', fullName: 'Adv Followup' } });
    const hdfcId = (await prisma.bank.findUniqueOrThrow({ where: { code: 'HDFC' } })).id;
    const card = await prisma.creditCard.create({ data: { bankId: hdfcId, name: 'HDFC Follow-up Test', status: 'PUBLISHED' } });
    const lead = (name: string, mobile: string) =>
      prisma.lead.create({ data: { publicRef: makePublicRef(RefPrefix.LEAD), advisorUserId: adv.id, reportingParentUserIdSnapshot: adv.id, bankId: hdfcId, cardId: card.id, customerFullName: name, customerMobile: mobile, pincode: '302001', employmentType: 'SALARIED', annualIncomeItr: 500000, declarations: {}, bureauAckAt: new Date(), idempotencyKey: idem() } });
    const l = await lead('Lead Customer', '+919555694021');
    const blocked = await lead('Dnc Lead Customer', '+919555694022');
    await prisma.contactSuppression.create({ data: { mobile: '+919555694022', reason: 'CUSTOMER_REQUEST' } });
    const past = new Date(Date.now() - 60_000);
    const task = await prisma.followUpTask.create({ data: { leadId: l.id, ownerUserId: adv.id, text: 'Collect address proof', dueAt: past } });
    await prisma.followUpTask.create({ data: { leadId: l.id, ownerUserId: adv.id, text: 'Later task', dueAt: new Date(Date.now() + 3600_000) } });
    await prisma.followUpTask.create({ data: { leadId: l.id, ownerUserId: adv.id, text: 'Already done', dueAt: past, doneAt: new Date() } });
    await prisma.followUpTask.create({ data: { leadId: blocked.id, ownerUserId: adv.id, text: 'Do not contact', dueAt: past } });

    await svc.run();
    await svc.run();
    const mine = await due({ recipientUserId: adv.id });
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ title: 'Follow-up due: Lead Customer', body: `Collect address proof · lead ${l.publicRef}`, deepLink: { entityType: 'Lead', entityId: l.id }, dedupeKey: `followup-due:task:${task.id}:${past.getTime()}` });
    expect(`${mine[0].title} ${mine[0].body}`).not.toContain('9555694021');

    // deactivated owner → nothing new, even for a new due time
    await prisma.user.update({ where: { id: adv.id }, data: { status: 'DEACTIVATED' } });
    await prisma.followUpTask.update({ where: { id: task.id }, data: { dueAt: new Date(past.getTime() + 1000) } });
    await svc.run();
    expect(await due({ recipientUserId: adv.id })).toHaveLength(1);
    // reactivated → the re-timed task notifies again
    await prisma.user.update({ where: { id: adv.id }, data: { status: 'ACTIVE' } });
    await svc.run();
    expect(await due({ recipientUserId: adv.id })).toHaveLength(2);
  });
});

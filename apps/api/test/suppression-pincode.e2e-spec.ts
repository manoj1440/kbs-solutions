import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/infra/prisma/prisma.service';

import { ADMIN_MOBILE, auth, bootTestApp, idem, loginAs, resetDatabase } from './helpers';

describe('F-306 suppression / F-304 pincode master', () => {
  let app: INestApplication;
  let prisma: PrismaService['client'];
  beforeAll(async () => {
    await resetDatabase(process.env.DATABASE_URL as string);
    ({ app, prisma } = await bootTestApp());
    await prisma.contactSuppression.deleteMany({});
    await prisma.pincodeMaster.deleteMany({});
  });
  afterAll(async () => app.close());

  it('suppresses by mobile, imports a DND list, lists masked, lifts with reason (INV-07: nothing deleted)', async () => {
    const admin = await loginAs(app, prisma, ADMIN_MOBILE);
    const add = await request(app.getHttpServer()).post('/api/v1/suppressions').set(auth(admin.accessToken)).set('idempotency-key', idem()).send({ mobile: '9123456789', reason: 'CUSTOMER_REQUEST' }).expect(201);
    expect(add.body.data.mobileLast4).toBe('6789');
    const csv = Buffer.from('mobile\n9111100001\n09111100002\nnot-a-number\n');
    const up = await request(app.getHttpServer()).post('/api/v1/files/dnd_list').set(auth(admin.accessToken)).attach('file', csv, { filename: 'dnd.csv', contentType: 'text/csv' }).expect(201);
    const imp = await request(app.getHttpServer()).post('/api/v1/suppressions/import').set(auth(admin.accessToken)).set('idempotency-key', idem()).send({ fileId: up.body.data.id }).expect(201);
    expect(imp.body.data).toMatchObject({ added: 2, invalid: 1 });
    const list = await request(app.getHttpServer()).get('/api/v1/suppressions').set(auth(admin.accessToken)).expect(200);
    expect(list.body.meta.total).toBe(3);
    expect(list.body.data[0].mobile).toMatch(/^\+91••••••\d{4}$/);
    await request(app.getHttpServer()).post(`/api/v1/suppressions/${add.body.data.id}/lift`).set(auth(admin.accessToken)).send({ reason: 'customer opted back in' }).expect(201);
    expect(await prisma.contactSuppression.count()).toBe(3);
    const lifted = await prisma.contactSuppression.findUniqueOrThrow({ where: { id: add.body.data.id } });
    expect(lifted.liftedAt).toBeTruthy();
    const active = await request(app.getHttpServer()).get('/api/v1/suppressions').set(auth(admin.accessToken)).expect(200);
    expect(active.body.meta.total).toBe(2);
  });

  it('pincode master import resolves city/state; unknown pincode → resolved=false (Location unavailable)', async () => {
    const admin = await loginAs(app, prisma, ADMIN_MOBILE);
    const csv = Buffer.from('CircleName,OfficeName,Pincode,District,StateName\nRajasthan,Jaipur GPO,302001,Jaipur,Rajasthan\nRajasthan,MI Road,302001,Jaipur,Rajasthan\nDelhi,Connaught Place,110001,Central Delhi,Delhi\nX,Bad,ABC,Bad,Bad\n');
    const up = await request(app.getHttpServer()).post('/api/v1/files/pincode_master').set(auth(admin.accessToken)).attach('file', csv, { filename: 'pincodes.csv', contentType: 'text/csv' }).expect(201);
    const imp = await request(app.getHttpServer()).post('/api/v1/pincodes/import').set(auth(admin.accessToken)).set('idempotency-key', idem()).send({ fileId: up.body.data.id }).expect(201);
    expect(imp.body.data).toMatchObject({ upserted: 3, invalid: 1 });
    const hit = await request(app.getHttpServer()).get('/api/v1/pincodes/302001').set(auth(admin.accessToken)).expect(200);
    expect(hit.body.data).toMatchObject({ resolved: true, district: 'Jaipur', state: 'Rajasthan', offices: ['Jaipur GPO', 'MI Road'] });
    const miss = await request(app.getHttpServer()).get('/api/v1/pincodes/999999').set(auth(admin.accessToken)).expect(200);
    expect(miss.body.data.resolved).toBe(false);
    // re-import is idempotent
    const imp2 = await request(app.getHttpServer()).post('/api/v1/pincodes/import').set(auth(admin.accessToken)).set('idempotency-key', idem()).send({ fileId: up.body.data.id }).expect(201);
    expect(imp2.body.data.upserted).toBe(3);
    expect(await prisma.pincodeMaster.count()).toBe(3);
  });
});

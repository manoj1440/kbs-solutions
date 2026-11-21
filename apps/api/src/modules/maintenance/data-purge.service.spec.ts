import { DataPurgeService, PURGE_AFTER, purgeWhere } from './data-purge.service';

const NOW = new Date('2026-11-21T00:00:00.000Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60_000);

describe('F-908 D7 nightly purge of expired operational records', () => {
  it('builds the delete conditions from the fixed windows', () => {
    const w = purgeWhere(NOW);
    expect(w.otpChallenge).toEqual({ expiresAt: { lt: daysAgo(PURGE_AFTER.otpChallengeDaysPastExpiry) } });
    expect(w.leadDraft).toEqual({ expiresAt: { lt: NOW } });
    expect(w.idempotencyRecord).toEqual({ createdAt: { lt: daysAgo(7) } });
    expect(w.refreshToken).toEqual({ expiresAt: { lt: daysAgo(30) } });
    expect(w.session).toEqual({
      createdAt: { lt: daysAgo(30) },
      OR: [{ revokedAt: { lt: daysAgo(30) } }, { revokedAt: null, refreshTokens: { none: { expiresAt: { gte: daysAgo(30) } } } }],
    });
  });

  it('deletes only the five operational models, sessions with their tokens, and audits the counts', async () => {
    const deleted: string[] = [];
    const del = (model: string, count: number) => jest.fn(async () => (deleted.push(model), { count }));
    const tx = {
      session: { findMany: jest.fn(async () => [{ id: 's1' }, { id: 's2' }]), deleteMany: del('session', 2) },
      refreshToken: { deleteMany: del('refreshToken', 5) },
    };
    const client = {
      otpChallenge: { deleteMany: del('otpChallenge', 3) },
      leadDraft: { deleteMany: del('leadDraft', 1) },
      idempotencyRecord: { deleteMany: del('idempotencyRecord', 0) },
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const audit = { record: jest.fn(async () => undefined) };
    const maintenance = { schedule: jest.fn() };
    const svc = new DataPurgeService({ client } as never, audit as never, maintenance as never);

    svc.onModuleInit();
    expect(maintenance.schedule).toHaveBeenCalledWith('privacy.purgeOperational', { pattern: '0 3 * * *', tz: 'Asia/Kolkata' }, expect.any(Function));

    const res = await svc.run(NOW);
    expect(res).toEqual({ otpChallenges: 3, leadDrafts: 1, idempotencyRecords: 0, refreshTokens: 5, sessions: 2 });
    expect(deleted).toEqual(['otpChallenge', 'leadDraft', 'idempotencyRecord', 'refreshToken', 'session']);
    // tokens of the ended sessions go with them (FK), plus long-expired tokens anywhere
    expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { OR: [purgeWhere(NOW).refreshToken, { sessionId: { in: ['s1', 's2'] } }] } });
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['s1', 's2'] } } });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'maintenance.purge', actor: { userId: null, role: null } }));
  });

  it('writes no audit row when nothing was due', async () => {
    const zero = { deleteMany: jest.fn(async () => ({ count: 0 })) };
    const tx = { session: { findMany: jest.fn(async () => []), deleteMany: jest.fn() }, refreshToken: zero };
    const client = { otpChallenge: zero, leadDraft: zero, idempotencyRecord: zero, $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
    const audit = { record: jest.fn() };
    const svc = new DataPurgeService({ client } as never, audit as never, { schedule: jest.fn() } as never);
    expect(await svc.run(NOW)).toEqual({ otpChallenges: 0, leadDrafts: 0, idempotencyRecords: 0, refreshTokens: 0, sessions: 0 });
    expect(tx.session.deleteMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});

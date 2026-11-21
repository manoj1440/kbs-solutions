import type { Prisma } from '@kbs/db';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import { MaintenanceProcessor } from './maintenance.processor';

export const DATA_PURGE_JOB = 'privacy.purgeOperational';

const DAY_MS = 24 * 60 * 60_000;
/** Bounds one run's session transaction; the rest go the next night. */
const SESSION_BATCH = 5_000;

/**
 * How long each short-lived operational record is kept after it stops being useful (F-908 D7).
 * - OTP challenges: rate limits look back one hour and the lock window is minutes, so a day past expiry is plenty.
 * - Lead drafts hold the customer's encrypted PAN; an expired draft cannot be resumed (`LeadsService.draft`), so it goes.
 * - Idempotency records are replayed for 24 h (F-107); a week covers slow client retries.
 * - Sessions and refresh tokens: 30 days after revocation or expiry, kept that long for incident investigation.
 */
export const PURGE_AFTER = {
  otpChallengeDaysPastExpiry: 1,
  leadDraftDaysPastExpiry: 0,
  idempotencyRecordDays: 7,
  sessionDaysAfterEnd: 30,
} as const;

export interface PurgeWhere {
  otpChallenge: Prisma.OtpChallengeWhereInput;
  leadDraft: Prisma.LeadDraftWhereInput;
  idempotencyRecord: Prisma.IdempotencyRecordWhereInput;
  /** Refresh tokens that expired long ago, in any session (live sessions keep their recent tokens for reuse detection). */
  refreshToken: Prisma.RefreshTokenWhereInput;
  /** Sessions revoked long ago, or never revoked but with no refresh token still valid in the window. */
  session: Prisma.SessionWhereInput;
}

/** Pure: the delete conditions for a run at `now`. Exported for the unit test. */
export function purgeWhere(now: Date): PurgeWhere {
  const ago = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const sessionCutoff = ago(PURGE_AFTER.sessionDaysAfterEnd);
  return {
    otpChallenge: { expiresAt: { lt: ago(PURGE_AFTER.otpChallengeDaysPastExpiry) } },
    leadDraft: { expiresAt: { lt: ago(PURGE_AFTER.leadDraftDaysPastExpiry) } },
    idempotencyRecord: { createdAt: { lt: ago(PURGE_AFTER.idempotencyRecordDays) } },
    refreshToken: { expiresAt: { lt: sessionCutoff } },
    session: {
      createdAt: { lt: sessionCutoff },
      OR: [{ revokedAt: { lt: sessionCutoff } }, { revokedAt: null, refreshTokens: { none: { expiresAt: { gte: sessionCutoff } } } }],
    },
  };
}

export interface PurgeResult {
  otpChallenges: number;
  leadDrafts: number;
  idempotencyRecords: number;
  refreshTokens: number;
  sessions: number;
}

/**
 * F-908 D7: nightly delete of expired operational records (03:00 IST, worker mode / JOBS_INLINE via MaintenanceProcessor).
 * These are technical records, not the business records F-904 governs (recordings, documents, MIS files, calling records),
 * so they are not blocked on KBS's retention periods. Never touches leads, payouts, MIS, audit, sensitive-access or
 * calling data. One audit row per run with the counts (no personal data).
 */
@Injectable()
export class DataPurgeService implements OnModuleInit {
  private readonly logger = new Logger(DataPurgeService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly maintenance: MaintenanceProcessor,
  ) {}

  onModuleInit() {
    this.maintenance.schedule(DATA_PURGE_JOB, { pattern: '0 3 * * *', tz: 'Asia/Kolkata' }, () => this.run());
  }

  async run(now = new Date()): Promise<PurgeResult> {
    const w = purgeWhere(now);
    const db = this.prisma.client;
    const otpChallenges = (await db.otpChallenge.deleteMany({ where: w.otpChallenge })).count;
    const leadDrafts = (await db.leadDraft.deleteMany({ where: w.leadDraft })).count;
    const idempotencyRecords = (await db.idempotencyRecord.deleteMany({ where: w.idempotencyRecord })).count;
    // a session's tokens go before the session (FK); both in one transaction so a session is never left half-deleted
    const { refreshTokens, sessions } = await db.$transaction(async (tx) => {
      const ended = await tx.session.findMany({ where: w.session, select: { id: true }, take: SESSION_BATCH });
      const ids = ended.map((s) => s.id);
      const tokens = await tx.refreshToken.deleteMany({ where: { OR: [w.refreshToken, ...(ids.length ? [{ sessionId: { in: ids } }] : [])] } });
      const gone = ids.length ? await tx.session.deleteMany({ where: { id: { in: ids } } }) : { count: 0 };
      return { refreshTokens: tokens.count, sessions: gone.count };
    });
    const result: PurgeResult = { otpChallenges, leadDrafts, idempotencyRecords, refreshTokens, sessions };
    if (Object.values(result).some((n) => n > 0)) {
      await this.audit.record({ action: 'maintenance.purge', entityType: 'Maintenance', entityId: DATA_PURGE_JOB, actor: { userId: null, role: null }, after: { ...result, rules: PURGE_AFTER }, reason: 'F-908 nightly purge of expired operational records' });
      this.logger.log(result, 'expired operational records purged');
    }
    return result;
  }
}

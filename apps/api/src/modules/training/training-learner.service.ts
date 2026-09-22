import { randomInt } from 'node:crypto';

import type { SubmitAttemptBody, VideoProgressBody } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { NotificationsService } from '../notifications/notifications.service';
import { HierarchyService } from '../users/hierarchy.service';

import { TrainingContentService } from './training-content.service';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/** F-203: Telecaller training flow — sequential modules, attempts, scoring, pass rule (REQ-05 §5.2–5.3). */
@Injectable()
export class TrainingLearnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly content: TrainingContentService,
    private readonly notifications: NotificationsService,
    private readonly hierarchy: HierarchyService,
  ) {}

  /** Enrollment + one result row per module (M1 in progress, M2/M3 locked) — idempotent. */
  private async loadEnrollment(userId: string) {
    await this.content.ensureModules();
    const enrollment = await this.prisma.client.trainingEnrollment.findUnique({ where: { telecallerUserId: userId } });
    if (!enrollment) throw AppError.notFound('Training enrollment');
    const modules = await this.prisma.client.trainingModule.findMany({ orderBy: { sequence: 'asc' } });
    for (const m of modules) {
      await this.prisma.client.trainingModuleResult.upsert({
        where: { enrollmentId_moduleId: { enrollmentId: enrollment.id, moduleId: m.id } },
        update: {},
        create: { enrollmentId: enrollment.id, moduleId: m.id, status: m.sequence === 1 ? 'IN_PROGRESS' : 'LOCKED' },
      });
    }
    const results = await this.prisma.client.trainingModuleResult.findMany({ where: { enrollmentId: enrollment.id }, include: { module: true }, orderBy: { module: { sequence: 'asc' } } });
    return { enrollment, results };
  }

  private deadlinePassed(e: { deadlineAt: Date | null; status: string }) {
    return e.status === 'EXPIRED_DEACTIVATED' || (e.deadlineAt !== null && e.deadlineAt.getTime() < Date.now());
  }

  async me(actor: Actor) {
    const { enrollment, results } = await this.loadEnrollment(actor.userId);
    const attemptLimit = this.config.getInt('training.attemptLimit');
    const videoRequired = this.config.getBool('training.videoCompletionRequired');
    const blocked = this.deadlinePassed(enrollment);
    return {
      status: enrollment.status,
      firstLoginAt: enrollment.firstLoginAt?.toISOString() ?? null,
      deadlineAt: enrollment.deadlineAt?.toISOString() ?? null,
      deadlinePassed: blocked,
      currentModuleSequence: enrollment.currentModuleSequence,
      passRule: this.config.getString('training.passRule'),
      attemptLimit,
      modules: results.map((r) => ({
        sequence: r.module.sequence,
        title: r.module.title,
        published: r.module.status === 'PUBLISHED',
        version: r.module.version,
        passThresholdPct: r.module.passThresholdPct,
        videoFileId: r.module.videoFileId,
        materialText: r.module.materialText,
        status: r.status,
        bestScorePct: r.bestScorePct,
        attemptCount: r.attemptCount,
        attemptsRemaining: attemptLimit === null ? null : Math.max(0, attemptLimit - r.attemptCount),
        videoCompletedAt: r.videoCompletedAt?.toISOString() ?? null,
        assessmentAvailable: !blocked && r.status === 'IN_PROGRESS' && r.module.status === 'PUBLISHED' && (!videoRequired || r.videoCompletedAt !== null || !r.module.videoFileId) && (attemptLimit === null || r.attemptCount < attemptLimit),
        passedAt: r.passedAt?.toISOString() ?? null,
      })),
    };
  }

  async videoProgress(actor: Actor, sequence: number, body: VideoProgressBody) {
    const { enrollment, results } = await this.loadEnrollment(actor.userId);
    const r = results.find((x) => x.module.sequence === sequence);
    if (!r) throw AppError.notFound('Module');
    if (r.status === 'LOCKED') throw new AppError('TRAINING_MODULE_LOCKED', 'Finish the previous module first.');
    const completeEnough = body.completed && (!body.durationSec || body.positionSec >= body.durationSec * 0.95);
    if (completeEnough && !r.videoCompletedAt) {
      await this.prisma.client.trainingModuleResult.update({ where: { id: r.id }, data: { videoCompletedAt: new Date() } });
    }
    return { sequence, videoCompleted: Boolean(r.videoCompletedAt) || completeEnough, enrollmentStatus: enrollment.status };
  }

  async startAttempt(actor: Actor, sequence: number) {
    const { enrollment, results } = await this.loadEnrollment(actor.userId);
    if (this.deadlinePassed(enrollment)) throw new AppError('GATE_TRAINING_BLOCKED', 'Your training window has ended. Ask your Manager to reactivate your training.', { reason: 'DEADLINE_PASSED' }, 'CONTACT_MANAGER');
    const r = results.find((x) => x.module.sequence === sequence);
    if (!r) throw AppError.notFound('Module');
    if (r.status === 'LOCKED') throw new AppError('TRAINING_MODULE_LOCKED', `Pass Module ${sequence - 1} before starting Module ${sequence}.`);
    if (r.status === 'PASSED') throw new AppError('CONFLICT', 'This module is already passed.');
    if (r.module.status !== 'PUBLISHED') throw new AppError('CONFLICT', 'This module is not published yet. Contact the Admin.');
    const attemptLimit = this.config.getInt('training.attemptLimit');
    if (attemptLimit !== null && r.attemptCount >= attemptLimit) throw new AppError('TRAINING_ATTEMPT_LIMIT', 'You have used all attempts for this module. Contact your Manager.');
    if (this.config.getBool('training.videoCompletionRequired') && r.module.videoFileId && !r.videoCompletedAt) {
      throw new AppError('VALIDATION_FAILED', 'Watch the module video before starting the assessment.');
    }
    const open = await this.prisma.client.trainingAttempt.findFirst({ where: { moduleResultId: r.id, submittedAt: null }, orderBy: { startedAt: 'desc' } });
    const questions = await this.prisma.client.trainingQuestion.findMany({ where: { moduleId: r.moduleId, active: true, version: r.module.version }, orderBy: { sequence: 'asc' } });
    if (questions.length === 0) throw new AppError('CONFLICT', 'This module has no questions yet.');
    const shuffleOn = this.config.getBool('training.shuffleQuestions');
    let attempt = open;
    let ordered = questions;
    if (attempt) {
      const ids = attempt.questionIds as string[];
      ordered = ids.map((id) => questions.find((q) => q.id === id)).filter((q): q is (typeof questions)[number] => Boolean(q));
    } else {
      ordered = shuffleOn ? shuffle(questions) : questions;
      attempt = await this.prisma.client.trainingAttempt.create({ data: { moduleResultId: r.id, moduleVersion: r.module.version, questionIds: ordered.map((q) => q.id) } });
      await this.prisma.client.trainingModuleResult.update({ where: { id: r.id }, data: { attemptCount: { increment: 1 } } });
    }
    return {
      attemptId: attempt.id,
      moduleSequence: sequence,
      moduleVersion: attempt.moduleVersion,
      passThresholdPct: r.module.passThresholdPct,
      questions: ordered.map((q) => ({ id: q.id, text: q.text, options: shuffleOn ? shuffle(q.options as Array<{ key: string; text: string }>) : (q.options as Array<{ key: string; text: string }>) })),
    };
  }

  async submitAttempt(actor: Actor, attemptId: string, body: SubmitAttemptBody) {
    const attempt = await this.prisma.client.trainingAttempt.findUnique({ where: { id: attemptId }, include: { moduleResult: { include: { module: true, enrollment: true } } } });
    if (!attempt || attempt.moduleResult.enrollment.telecallerUserId !== actor.userId) throw AppError.notFound('Attempt');
    if (attempt.submittedAt) throw new AppError('CONFLICT', 'This attempt was already submitted.');
    const ids = attempt.questionIds as string[];
    const questions = await this.prisma.client.trainingQuestion.findMany({ where: { id: { in: ids } } });
    const correct = questions.filter((q) => body.answers[q.id] === q.correctKey).length;
    const scorePct = Math.round((correct / ids.length) * 100);
    const threshold = attempt.moduleResult.module.passThresholdPct;
    const passedModule = scorePct >= threshold;
    const r = attempt.moduleResult;
    const enrollment = r.enrollment;

    const outcome = await this.prisma.client.$transaction(async (tx) => {
      await tx.trainingAttempt.update({ where: { id: attemptId }, data: { submittedAt: new Date(), answers: body.answers, scorePct, passed: passedModule } });
      const best = Math.max(r.bestScorePct ?? 0, scorePct);
      const nowPassed = r.status === 'PASSED' || passedModule; // a passed module never regresses (REQ-05 §5.3)
      await tx.trainingModuleResult.update({ where: { id: r.id }, data: { bestScorePct: best, status: nowPassed ? 'PASSED' : 'IN_PROGRESS', passedAt: r.passedAt ?? (passedModule ? new Date() : null) } });
      let allPassed = false;
      let nextSequence = enrollment.currentModuleSequence;
      if (passedModule && r.status !== 'PASSED') {
        const next = await tx.trainingModuleResult.findFirst({ where: { enrollmentId: enrollment.id, module: { sequence: r.module.sequence + 1 } }, include: { module: true } });
        if (next) {
          if (next.status === 'LOCKED') await tx.trainingModuleResult.update({ where: { id: next.id }, data: { status: 'IN_PROGRESS' } });
          nextSequence = next.module.sequence;
        }
        const results = await tx.trainingModuleResult.findMany({ where: { enrollmentId: enrollment.id } });
        const everyPassed = results.every((x) => x.status === 'PASSED' || x.id === r.id);
        if (everyPassed) {
          const rule = this.config.getString('training.passRule');
          if (rule === 'AVERAGE_ACROSS_MODULES') {
            const avg = results.reduce((s, x) => s + (x.id === r.id ? best : (x.bestScorePct ?? 0)), 0) / results.length;
            allPassed = avg >= (this.config.getInt('training.defaultPassThresholdPct') ?? 70);
          } else allPassed = true;
        }
        await tx.trainingEnrollment.update({ where: { id: enrollment.id }, data: { currentModuleSequence: nextSequence, ...(allPassed ? { status: 'PASSED', passedAt: new Date() } : {}) } });
      }
      return { allPassed, nextSequence };
    });

    const deadlinePassed = this.deadlinePassed(enrollment);
    RequestContextStore.audit({ entityType: 'TrainingAttempt', entityId: attemptId, after: { module: r.module.sequence, scorePct, passed: passedModule, allPassed: outcome.allPassed } });
    if (outcome.allPassed) {
      const managerId = await this.hierarchy.currentParentId(actor.userId);
      await this.notifications.notify({ recipientUserId: actor.userId, kind: 'TRAINING_PASSED', title: 'Training complete', body: 'You passed all three modules. Your calling queue is now available.', dedupeKey: `training.passed:${enrollment.id}` });
      if (managerId) await this.notifications.notify({ recipientUserId: managerId, kind: 'TRAINING_PASSED', title: 'Telecaller completed training', body: 'A Telecaller on your team passed all three modules.', deepLink: { entityType: 'User', entityId: actor.userId }, dedupeKey: `training.passed.mgr:${enrollment.id}` });
    }
    return {
      attemptId,
      moduleSequence: r.module.sequence,
      scorePct,
      passThresholdPct: threshold,
      passed: passedModule,
      correct,
      total: ids.length,
      allModulesPassed: outcome.allPassed,
      nextModuleSequence: passedModule && !outcome.allPassed ? outcome.nextSequence : null,
      deadlinePassed,
      retryAvailable: !passedModule && !deadlinePassed && (this.config.getInt('training.attemptLimit') === null || r.attemptCount < (this.config.getInt('training.attemptLimit') as number)),
    };
  }
}

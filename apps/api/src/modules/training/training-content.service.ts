import type { ReplaceQuestionsBody, UpdateModuleBody } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConfigService } from '../config/config.service';

/**
 * F-202: Admin maintains exactly three modules (video + MCQ). Editing creates a draft question set
 * (version = published + 1); publishing makes that version live. Attempts always use the published version.
 */
@Injectable()
export class TrainingContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Ensures the three module rows exist (idempotent). */
  async ensureModules() {
    const threshold = this.config.getInt('training.defaultPassThresholdPct') ?? 70;
    for (const sequence of [1, 2, 3]) {
      await this.prisma.client.trainingModule.upsert({ where: { sequence }, update: {}, create: { sequence, title: `Module ${sequence}`, passThresholdPct: threshold, status: 'DRAFT', version: 0 } });
    }
  }

  /** Creates one result row per module for an enrollment (M1 in progress, others locked). Idempotent. */
  async ensureResults(enrollmentId: string) {
    await this.ensureModules();
    const modules = await this.prisma.client.trainingModule.findMany({ orderBy: { sequence: 'asc' } });
    for (const m of modules) {
      await this.prisma.client.trainingModuleResult.upsert({
        where: { enrollmentId_moduleId: { enrollmentId, moduleId: m.id } },
        update: {},
        create: { enrollmentId, moduleId: m.id, status: m.sequence === 1 ? 'IN_PROGRESS' : 'LOCKED' },
      });
    }
  }

  async list(actor: Actor) {
    await this.ensureModules();
    const mods = await this.prisma.client.trainingModule.findMany({ orderBy: { sequence: 'asc' }, include: { questions: { where: { active: true }, select: { version: true } } } });
    return mods.map((m) => this.view(m, actor.role === 'ADMIN'));
  }

  async get(actor: Actor, sequence: number, opts: { includeAnswers: boolean }) {
    await this.ensureModules();
    const m = await this.prisma.client.trainingModule.findUnique({ where: { sequence }, include: { questions: { where: { active: true }, orderBy: { sequence: 'asc' } } } });
    if (!m) throw AppError.notFound('Module');
    const draftVersion = this.draftVersion(m);
    const targetVersion = actor.role === 'ADMIN' ? (draftVersion ?? m.version) : m.version;
    const questions = m.questions
      .filter((q) => q.version === targetVersion)
      .map((q) => ({ id: q.id, sequence: q.sequence, text: q.text, options: q.options as Array<{ key: string; text: string }>, ...(opts.includeAnswers ? { correctKey: q.correctKey } : {}) }));
    return { ...this.view(m, actor.role === 'ADMIN'), questions, questionsVersion: targetVersion };
  }

  async update(sequence: number, body: UpdateModuleBody) {
    await this.ensureModules();
    const before = await this.prisma.client.trainingModule.findUniqueOrThrow({ where: { sequence } });
    if (body.videoFileId) {
      const f = await this.prisma.client.storedFile.findUnique({ where: { id: body.videoFileId } });
      if (!f || f.purpose !== 'TRAINING_VIDEO') throw new AppError('VALIDATION_FAILED', 'videoFileId must reference an uploaded training video.');
    }
    const m = await this.prisma.client.trainingModule.update({
      where: { sequence },
      data: { title: body.title, materialText: body.materialText === undefined ? undefined : body.materialText, passThresholdPct: body.passThresholdPct, videoFileId: body.videoFileId === undefined ? undefined : body.videoFileId },
    });
    RequestContextStore.audit({ entityId: m.id, before: { title: before.title, passThresholdPct: before.passThresholdPct, videoFileId: before.videoFileId }, after: { title: m.title, passThresholdPct: m.passThresholdPct, videoFileId: m.videoFileId } });
    return this.view({ ...m, questions: [] }, true);
  }

  /** Replace the draft question set. Published questions stay untouched until publish. */
  async replaceQuestions(sequence: number, body: ReplaceQuestionsBody) {
    await this.ensureModules();
    const m = await this.prisma.client.trainingModule.findUniqueOrThrow({ where: { sequence }, include: { questions: { where: { active: true } } } });
    const draft = m.version + 1;
    await this.prisma.client.$transaction(async (tx) => {
      await tx.trainingQuestion.updateMany({ where: { moduleId: m.id, version: draft, active: true }, data: { active: false } });
      await tx.trainingQuestion.createMany({
        data: body.questions.map((q, i) => ({ moduleId: m.id, sequence: i + 1, text: q.text, options: q.options, correctKey: q.correctKey, version: draft, active: true })),
      });
    });
    RequestContextStore.audit({ entityId: m.id, after: { draftVersion: draft, questionCount: body.questions.length } });
    return { moduleId: m.id, draftVersion: draft, questionCount: body.questions.length };
  }

  /** Publish: the draft question set (or current when no draft) becomes the live version. */
  async publish(actor: Actor, sequence: number) {
    await this.ensureModules();
    const m = await this.prisma.client.trainingModule.findUniqueOrThrow({ where: { sequence }, include: { questions: { where: { active: true } } } });
    const draftVersion = this.draftVersion(m);
    const newVersion = draftVersion ?? m.version;
    const liveQuestions = m.questions.filter((q) => q.version === newVersion);
    if (liveQuestions.length === 0) throw new AppError('VALIDATION_FAILED', 'Add at least one question before publishing.');
    for (const q of liveQuestions) {
      const opts = q.options as Array<{ key: string }>;
      if (!opts.some((o) => o.key === q.correctKey)) throw new AppError('VALIDATION_FAILED', `Question ${q.sequence} has no correct option.`);
    }
    if (!m.videoFileId && this.config.getBool('training.videoCompletionRequired')) {
      throw new AppError('VALIDATION_FAILED', 'Upload the module video before publishing (training.videoCompletionRequired is on).');
    }
    const updated = await this.prisma.client.$transaction(async (tx) => {
      if (draftVersion) await tx.trainingQuestion.updateMany({ where: { moduleId: m.id, version: { lt: newVersion }, active: true }, data: { active: false } });
      return tx.trainingModule.update({ where: { id: m.id }, data: { status: 'PUBLISHED', version: newVersion, publishedAt: new Date(), publishedByUserId: actor.userId } });
    });
    RequestContextStore.audit({ entityId: m.id, before: { version: m.version, status: m.status }, after: { version: newVersion, status: 'PUBLISHED', questionCount: liveQuestions.length } });
    return this.view({ ...updated, questions: liveQuestions.map((q) => ({ version: q.version })) }, true);
  }

  private draftVersion(m: { version: number; questions: Array<{ version: number }> }): number | null {
    return m.questions.some((q) => q.version === m.version + 1) ? m.version + 1 : null;
  }

  private view(m: { id: string; sequence: number; title: string; status: 'DRAFT' | 'PUBLISHED'; version: number; passThresholdPct: number; materialText: string | null; videoFileId: string | null; publishedAt: Date | null; questions: Array<{ version: number }> }, admin: boolean) {
    const draftVersion = this.draftVersion(m);
    return {
      id: m.id,
      sequence: m.sequence,
      title: m.title,
      status: m.status,
      version: m.version,
      draftVersion: admin ? draftVersion : null,
      passThresholdPct: m.passThresholdPct,
      materialText: m.materialText,
      videoFileId: m.videoFileId,
      questionCount: m.questions.filter((q) => q.version === m.version).length,
      draftQuestionCount: admin && draftVersion ? m.questions.filter((q) => q.version === draftVersion).length : undefined,
      publishedAt: m.publishedAt?.toISOString() ?? null,
    };
  }
}

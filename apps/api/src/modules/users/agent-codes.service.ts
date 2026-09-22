import { randomInt } from 'node:crypto';

import { type ApplyAgentCodeBody, type CreateAgentCodeBody, type ReassignReportingBody } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConfigService } from '../config/config.service';

import { HierarchyService } from './hierarchy.service';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

/** F-106: Agent Codes and effective-dated reporting changes (REQ-10 §10.4, REQ-03 §3.2). */
@Injectable()
export class AgentCodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly hierarchy: HierarchyService,
  ) {}

  private normalise(code: string): string {
    const c = code.trim().toUpperCase();
    const format = new RegExp(this.config.getString('hierarchy.agentCodeFormat') ?? '^[A-Z0-9]{4,12}$');
    if (!format.test(c)) throw new AppError('HIERARCHY_CODE_INVALID', 'This Agent Code is not valid.');
    return c;
  }

  private generate(): string {
    let s = '';
    for (let i = 0; i < 8; i++) s += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
    return s;
  }

  async list(actor: Actor) {
    const where = actor.role === 'ADMIN' ? {} : { ownerUserId: actor.userId };
    const codes = await this.prisma.client.agentCode.findMany({ where, orderBy: { createdAt: 'desc' }, include: { owner: { select: { id: true, fullName: true, role: true } } } });
    const counts = await this.prisma.client.reportingAssignment.groupBy({ by: ['agentCodeId'], where: { agentCodeId: { in: codes.map((c) => c.id) }, status: 'ACTIVE', effectiveTo: null }, _count: { _all: true } });
    const countMap = new Map(counts.map((c) => [c.agentCodeId, c._count._all]));
    return codes.map((c) => ({ ...c, activeAdvisors: countMap.get(c.id) ?? 0 }));
  }

  async create(actor: Actor, body: CreateAgentCodeBody) {
    const owner = await this.prisma.client.user.findUnique({ where: { id: body.ownerUserId }, select: { id: true, role: true, status: true } });
    // Codes may only point at a Manager or the Admin (REQ-10 §10.4 OPEN → restricted, see feature file).
    if (!owner || (owner.role !== 'MANAGER' && owner.role !== 'ADMIN') || owner.status !== 'ACTIVE') {
      throw new AppError('VALIDATION_FAILED', 'An Agent Code must belong to an active Manager or the Admin.');
    }
    const code = body.code ? this.normalise(body.code) : this.generate();
    const existing = await this.prisma.client.agentCode.findUnique({ where: { code } });
    if (existing) throw new AppError('CONFLICT', 'This Agent Code already exists.');
    const created = await this.prisma.client.agentCode.create({ data: { code, ownerUserId: owner.id, expiresAt: body.expiresAt ?? null, createdByUserId: actor.userId } });
    RequestContextStore.audit({ entityId: created.id, after: { code: created.code, ownerUserId: owner.id, expiresAt: created.expiresAt } });
    return created;
  }

  async revoke(id: string, reason: string) {
    const c = await this.prisma.client.agentCode.findUnique({ where: { id } });
    if (!c) throw AppError.notFound('Agent Code');
    if (c.status === 'REVOKED') return c;
    const updated = await this.prisma.client.agentCode.update({ where: { id }, data: { status: 'REVOKED', revokedAt: new Date() } });
    RequestContextStore.audit({ entityId: id, before: { status: c.status }, after: { status: 'REVOKED' }, reason });
    return updated;
  }

  /** Advisor-facing validation: tells only whether the code can be used, never who owns it (until applied). */
  async validate(raw: string): Promise<{ valid: boolean }> {
    try {
      const code = this.normalise(raw);
      const c = await this.prisma.client.agentCode.findUnique({ where: { code } });
      return { valid: Boolean(c && c.status === 'ACTIVE' && (!c.expiresAt || c.expiresAt.getTime() > Date.now())) };
    } catch {
      return { valid: false };
    }
  }

  /** Apply a code to the acting Advisor (signup or later from Profile). */
  async apply(actor: Actor, body: ApplyAgentCodeBody) {
    if (actor.role !== 'ADVISOR') throw new AppError('RBAC_FORBIDDEN', 'Only Advisors use Agent Codes.');
    const code = this.normalise(body.code);
    const c = await this.prisma.client.agentCode.findUnique({ where: { code }, include: { owner: { select: { id: true, fullName: true, role: true, status: true } } } });
    if (!c || c.status !== 'ACTIVE' || (c.expiresAt && c.expiresAt.getTime() < Date.now()) || c.owner.status !== 'ACTIVE') {
      throw new AppError('HIERARCHY_CODE_INVALID', 'This Agent Code is not valid or has been revoked. Your reporting person is unchanged.');
    }
    const currentParentId = await this.hierarchy.currentParentId(actor.userId);
    if (currentParentId === c.ownerUserId) {
      return { status: 'APPLIED' as const, reportingParent: { id: c.owner.id, fullName: c.owner.fullName, role: c.owner.role } };
    }
    const pendingExisting = await this.prisma.client.reportingAssignment.findFirst({ where: { childUserId: actor.userId, status: 'PENDING_APPROVAL' } });
    if (pendingExisting) throw new AppError('CONFLICT', 'A reporting change is already awaiting Admin approval.');

    const leadCount = await this.prisma.client.lead.count({ where: { advisorUserId: actor.userId } });
    const needsApproval = this.config.getBool('hierarchy.agentCodeChangeRequiresAdminApproval') && leadCount > 0;

    if (needsApproval) {
      const pending = await this.prisma.client.reportingAssignment.create({
        data: { childUserId: actor.userId, parentUserId: c.ownerUserId, source: 'AGENT_CODE', status: 'PENDING_APPROVAL', agentCodeId: c.id, reason: `Advisor applied code ${code}` },
      });
      RequestContextStore.audit({ entityType: 'ReportingAssignment', entityId: pending.id, after: { status: 'PENDING_APPROVAL', parentUserId: c.ownerUserId, code } });
      return { status: 'PENDING_APPROVAL' as const, reportingParent: { id: c.owner.id, fullName: c.owner.fullName, role: c.owner.role } };
    }
    const row = await this.switchParent(actor.userId, c.ownerUserId, 'AGENT_CODE', c.id, `Advisor applied code ${code}`, null);
    RequestContextStore.audit({ entityType: 'ReportingAssignment', entityId: row.id, before: { parentUserId: currentParentId }, after: { parentUserId: c.ownerUserId, code } });
    return { status: 'APPLIED' as const, reportingParent: { id: c.owner.id, fullName: c.owner.fullName, role: c.owner.role } };
  }

  async listPending() {
    return this.prisma.client.reportingAssignment.findMany({
      where: { status: 'PENDING_APPROVAL' },
      orderBy: { createdAt: 'asc' },
      include: { child: { select: { id: true, fullName: true, publicRef: true, role: true } }, parent: { select: { id: true, fullName: true, role: true } }, agentCode: { select: { code: true } } },
    });
  }

  async decidePending(actor: Actor, id: string, decision: 'APPROVED' | 'REJECTED', reason: string) {
    const pending = await this.prisma.client.reportingAssignment.findUnique({ where: { id } });
    if (!pending || pending.status !== 'PENDING_APPROVAL') throw AppError.notFound('Pending reporting change');
    if (decision === 'REJECTED') {
      const r = await this.prisma.client.reportingAssignment.update({ where: { id }, data: { status: 'REJECTED', effectiveTo: new Date(), approvedByUserId: actor.userId, reason: `${pending.reason ?? ''} | rejected: ${reason}` } });
      RequestContextStore.audit({ entityType: 'ReportingAssignment', entityId: id, after: { status: 'REJECTED' }, reason });
      return r;
    }
    const before = await this.hierarchy.currentParentId(pending.childUserId);
    const r = await this.prisma.client.$transaction(async (tx) => {
      await tx.reportingAssignment.updateMany({ where: { childUserId: pending.childUserId, status: 'ACTIVE', effectiveTo: null }, data: { effectiveTo: new Date(), status: 'CLOSED' } });
      return tx.reportingAssignment.update({ where: { id }, data: { status: 'ACTIVE', effectiveFrom: new Date(), approvedByUserId: actor.userId, reason: `${pending.reason ?? ''} | approved: ${reason}` } });
    });
    RequestContextStore.audit({ entityType: 'ReportingAssignment', entityId: id, before: { parentUserId: before }, after: { parentUserId: pending.parentUserId, status: 'ACTIVE' }, reason });
    return r;
  }

  /** Admin reassigns a Telecaller or Advisor to another Manager (or the Admin). Historical attribution untouched. */
  async reassign(actor: Actor, childUserId: string, body: ReassignReportingBody) {
    const [child, parent] = await Promise.all([
      this.prisma.client.user.findUnique({ where: { id: childUserId }, select: { id: true, role: true } }),
      this.prisma.client.user.findUnique({ where: { id: body.parentUserId }, select: { id: true, role: true, status: true } }),
    ]);
    if (!child || (child.role !== 'TELECALLER' && child.role !== 'ADVISOR')) throw AppError.notFound('User');
    if (!parent || (parent.role !== 'MANAGER' && parent.role !== 'ADMIN') || parent.status !== 'ACTIVE') throw new AppError('VALIDATION_FAILED', 'Reporting parent must be an active Manager or the Admin.');
    const before = await this.hierarchy.currentParentId(childUserId);
    if (before === parent.id) throw new AppError('CONFLICT', 'Already reporting to this person.');
    const row = await this.switchParent(childUserId, parent.id, 'ADMIN_REASSIGNED', null, body.reason, actor.userId);
    RequestContextStore.audit({ before: { parentUserId: before }, after: { parentUserId: parent.id, assignmentId: row.id }, reason: body.reason });
    return row;
  }

  async history(actor: Actor, childUserId: string) {
    if (actor.role !== 'ADMIN' && actor.userId !== childUserId && !actor.teamUserIds.includes(childUserId)) throw AppError.notFound('User');
    return this.prisma.client.reportingAssignment.findMany({
      where: { childUserId },
      orderBy: { effectiveFrom: 'desc' },
      include: { parent: { select: { id: true, fullName: true, role: true } }, agentCode: { select: { code: true } } },
    });
  }

  private switchParent(childUserId: string, parentUserId: string, source: 'AGENT_CODE' | 'ADMIN_REASSIGNED', agentCodeId: string | null, reason: string, approvedByUserId: string | null) {
    return this.prisma.client.$transaction(async (tx) => {
      await tx.reportingAssignment.updateMany({ where: { childUserId, status: 'ACTIVE', effectiveTo: null }, data: { effectiveTo: new Date(), status: 'CLOSED' } });
      return tx.reportingAssignment.create({ data: { childUserId, parentUserId, source, status: 'ACTIVE', agentCodeId, reason, approvedByUserId } });
    });
  }
}

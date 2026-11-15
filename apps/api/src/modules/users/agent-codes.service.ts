import { randomInt } from 'node:crypto';

import { type ApplyAgentCodeBody, type CreateAgentCodeBody, maskMobile, type ReassignReportingBody } from '@kbs/shared';
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
    // A code points at a Manager, the Admin, or — F-824, owner decision — an approved Advisor who brings in other Advisors.
    if (!owner || (owner.role !== 'MANAGER' && owner.role !== 'ADMIN' && owner.role !== 'ADVISOR') || owner.status !== 'ACTIVE') {
      throw new AppError('VALIDATION_FAILED', 'An Agent Code must belong to an active Manager, an approved Advisor or the Admin.');
    }
    const code = body.code ? this.normalise(body.code) : this.generate();
    const existing = await this.prisma.client.agentCode.findUnique({ where: { code } });
    if (existing) throw new AppError('CONFLICT', 'This Agent Code already exists.');
    const created = await this.prisma.client.agentCode.create({ data: { code, ownerUserId: owner.id, expiresAt: body.expiresAt ?? null, createdByUserId: actor.userId } });
    RequestContextStore.audit({ entityId: created.id, after: { code: created.code, ownerUserId: owner.id, expiresAt: created.expiresAt } });
    return created;
  }

  /**
   * F-824: an approved Advisor's own code, to give to other Advisors. One active code per Advisor — asking again
   * returns it. The Admin can still issue or revoke codes for anyone (People → Agent codes).
   */
  async createOwn(actor: Actor) {
    if (actor.role !== 'ADVISOR' || actor.status !== 'ACTIVE') throw new AppError('RBAC_FORBIDDEN', 'Only an approved Advisor has an Agent Code of their own.');
    const existing = await this.prisma.client.agentCode.findFirst({ where: { ownerUserId: actor.userId, status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { createdAt: 'desc' } });
    if (existing) return existing;
    // a code the Admin withdrew is not replaced by the Advisor themselves
    if (await this.prisma.client.agentCode.count({ where: { ownerUserId: actor.userId, status: 'REVOKED' } })) throw new AppError('CONFLICT', 'Your Agent Code was withdrawn by KBS. Ask the Admin for a new one.', undefined, 'CONTACT_ADMIN');
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = this.generate();
      if (await this.prisma.client.agentCode.findUnique({ where: { code } })) continue;
      const created = await this.prisma.client.agentCode.create({ data: { code, ownerUserId: actor.userId, createdByUserId: actor.userId } });
      RequestContextStore.audit({ entityId: created.id, after: { code: created.code, ownerUserId: actor.userId, self: true } });
      return created;
    }
    throw new AppError('CONFLICT', 'Could not generate a code. Please try again.');
  }

  /** F-824: the Advisors who signed up with the caller's code — who they are and how many leads each has. Read-only. */
  async myTeam(actor: Actor) {
    const [codes, people] = await Promise.all([
      this.prisma.client.agentCode.findMany({ where: { ownerUserId: actor.userId }, orderBy: { createdAt: 'desc' }, select: { id: true, code: true, status: true, createdAt: true, revokedAt: true } }),
      this.prisma.client.user.findMany({
        where: { id: { in: actor.referralUserIds }, role: 'ADVISOR' },
        select: { id: true, fullName: true, publicRef: true, status: true, mobile: true, createdAt: true, _count: { select: { leads: true } }, reportingAsChild: { where: { effectiveTo: null, status: 'ACTIVE' }, take: 1, select: { effectiveFrom: true } } },
        orderBy: { fullName: 'asc' },
      }),
    ]);
    return {
      code: codes.find((c) => c.status === 'ACTIVE') ?? null,
      advisors: people.map((u) => ({ id: u.id, fullName: u.fullName, publicRef: u.publicRef, status: u.status, mobileMasked: maskMobile(u.mobile), since: (u.reportingAsChild[0]?.effectiveFrom ?? u.createdAt).toISOString(), leads: u._count.leads })),
    };
  }

  /** A reporting line must stay a line: nobody reports to themselves or to someone below them. */
  private async assertNoLoop(childUserId: string, parentUserId: string) {
    if (childUserId === parentUserId) throw new AppError('HIERARCHY_CODE_INVALID', 'You cannot use your own Agent Code.');
    if ((await this.hierarchy.ancestorIds(parentUserId)).includes(childUserId)) throw new AppError('HIERARCHY_CODE_INVALID', 'This code belongs to someone who reports to you; it cannot be used. Your reporting person is unchanged.');
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
    await this.assertNoLoop(actor.userId, c.ownerUserId);
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
    await this.assertNoLoop(pending.childUserId, pending.parentUserId); // the line may have changed since it was asked for
    const before = await this.hierarchy.currentParentId(pending.childUserId);
    const r = await this.prisma.client.$transaction(async (tx) => {
      await tx.reportingAssignment.updateMany({ where: { childUserId: pending.childUserId, status: 'ACTIVE', effectiveTo: null }, data: { effectiveTo: new Date(), status: 'CLOSED' } });
      return tx.reportingAssignment.update({ where: { id }, data: { status: 'ACTIVE', effectiveFrom: new Date(), approvedByUserId: actor.userId, reason: `${pending.reason ?? ''} | approved: ${reason}` } });
    });
    RequestContextStore.audit({ entityType: 'ReportingAssignment', entityId: id, before: { parentUserId: before }, after: { parentUserId: pending.parentUserId, status: 'ACTIVE' }, reason });
    return r;
  }

  /**
   * Admin reassigns a Telecaller to another Manager, or an Advisor to another Manager or the Admin. Historical attribution untouched.
   * A Telecaller always belongs to a Manager (REQ-15, REQ-26 §26.1).
   */
  async reassign(actor: Actor, childUserId: string, body: ReassignReportingBody) {
    const [child, parent] = await Promise.all([
      this.prisma.client.user.findUnique({ where: { id: childUserId }, select: { id: true, role: true } }),
      this.prisma.client.user.findUnique({ where: { id: body.parentUserId }, select: { id: true, role: true, status: true } }),
    ]);
    if (!child || (child.role !== 'TELECALLER' && child.role !== 'ADVISOR')) throw AppError.notFound('User');
    if (child.role === 'TELECALLER' && (!parent || parent.role !== 'MANAGER' || parent.status !== 'ACTIVE')) throw new AppError('VALIDATION_FAILED', 'A Telecaller must report to an active Manager.', { field: 'parentUserId' });
    // F-824: an Advisor may report to another Advisor (the one whose code they used)
    if (!parent || (parent.role !== 'MANAGER' && parent.role !== 'ADMIN' && parent.role !== 'ADVISOR') || parent.status !== 'ACTIVE') throw new AppError('VALIDATION_FAILED', 'Reporting parent must be an active Manager, Advisor or the Admin.');
    await this.assertNoLoop(childUserId, parent.id);
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

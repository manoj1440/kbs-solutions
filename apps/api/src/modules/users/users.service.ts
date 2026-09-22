import { type CreateTelecallerBody, type CreateUserBody, makePublicRef, maskMobile, RefPrefix, toE164India, type UserListQuery } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { Paginated } from '../../common/interceptors/response-envelope.interceptor';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { reissueIdCard } from '../id-cards/reissue';

import { HierarchyService } from './hierarchy.service';

type UserRow = {
  id: string;
  publicRef: string;
  role: 'ADMIN' | 'MANAGER' | 'TELECALLER' | 'ADVISOR' | 'ACCOUNTS';
  status: 'PENDING_ONBOARDING' | 'ACTIVE' | 'DEACTIVATED' | 'BLOCKED';
  fullName: string;
  mobile: string;
  email: string | null;
  employeeCode: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
};

/** F-105 / F-201: user administration. All creation paths live here (ADR-006). */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hierarchy: HierarchyService,
  ) {}

  async toSummary(u: UserRow) {
    const parentId = await this.hierarchy.currentParentId(u.id);
    const parent = parentId ? await this.prisma.client.user.findUnique({ where: { id: parentId }, select: { id: true, fullName: true, role: true } }) : null;
    return {
      id: u.id,
      publicRef: u.publicRef,
      role: u.role,
      status: u.status,
      fullName: u.fullName,
      mobileMasked: maskMobile(u.mobile) as string,
      email: u.email,
      employeeCode: u.employeeCode,
      reportingParent: parent,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    };
  }

  /** Admin creates Manager / Accounts users. */
  async createByAdmin(actor: Actor, body: CreateUserBody) {
    const mobile = toE164India(body.mobile);
    await this.assertMobileFree(mobile);
    const user = await this.prisma.client.user.create({
      data: {
        publicRef: makePublicRef(RefPrefix.USER),
        mobile,
        role: body.role,
        status: 'ACTIVE',
        fullName: body.fullName,
        email: body.email,
        createdByUserId: actor.userId,
        lifecycleEvents: { create: { eventType: 'CREATED', actorUserId: actor.userId, reason: 'created by Admin' } },
      },
    });
    RequestContextStore.audit({ entityId: user.id, after: { role: user.role, publicRef: user.publicRef } });
    return this.toSummary(user);
  }

  /** Manager creates a Telecaller (REQ-05 §5.1) — assigned to the creating Manager, employee code generated, enrollment placeholder. */
  async createTelecaller(actor: Actor, body: CreateTelecallerBody) {
    if (actor.role !== 'MANAGER') throw new AppError('RBAC_FORBIDDEN', 'Only a Manager can create Telecallers.');
    const mobile = toE164India(body.mobile);
    await this.assertMobileFree(mobile);
    const user = await this.prisma.client.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          publicRef: makePublicRef(RefPrefix.USER),
          mobile,
          role: 'TELECALLER',
          status: 'ACTIVE',
          fullName: body.fullName,
          employeeCode: makePublicRef(RefPrefix.TELECALLER_CODE),
          createdByUserId: actor.userId,
          lifecycleEvents: { create: { eventType: 'CREATED', actorUserId: actor.userId, reason: 'created by Manager' } },
        },
      });
      await tx.reportingAssignment.create({ data: { childUserId: u.id, parentUserId: actor.userId, source: 'MANAGER_CREATED_TELECALLER', status: 'ACTIVE' } });
      await tx.trainingEnrollment.create({ data: { telecallerUserId: u.id, status: 'NOT_STARTED' } });
      await tx.officialIdCard.create({
        data: { userId: u.id, version: 1, fields: { fullName: u.fullName, employeeCode: u.employeeCode, role: 'Telecaller', issuedAt: new Date().toISOString() } },
      });
      return u;
    });
    RequestContextStore.audit({ entityId: user.id, after: { employeeCode: user.employeeCode, managerId: actor.userId } });
    return this.toSummary(user);
  }

  async list(actor: Actor, q: UserListQuery) {
    const where: Record<string, unknown> = { role: q.role, status: q.status };
    if (actor.role === 'MANAGER') where.id = { in: actor.teamUserIds };
    else if (actor.role !== 'ADMIN') throw new AppError('RBAC_FORBIDDEN', 'Not allowed.');
    if (q.managerId && actor.role === 'ADMIN') where.id = { in: await this.hierarchy.teamUserIds(q.managerId) };
    if (q.q) where.OR = [{ fullName: { contains: q.q, mode: 'insensitive' } }, { employeeCode: { contains: q.q.toUpperCase() } }, { publicRef: { contains: q.q.toUpperCase() } }];
    const [rows, total] = await Promise.all([
      this.prisma.client.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      this.prisma.client.user.count({ where }),
    ]);
    return new Paginated(await Promise.all(rows.map((r) => this.toSummary(r))), q.page, q.pageSize, total);
  }

  async getForActor(actor: Actor, id: string) {
    const u = await this.prisma.client.user.findUnique({ where: { id } });
    if (!u || !this.canSee(actor, u.id)) throw AppError.notFound('User');
    const [summary, lifecycle, sessions] = await Promise.all([
      this.toSummary(u),
      this.prisma.client.userLifecycleEvent.findMany({ where: { userId: id }, orderBy: { at: 'desc' }, take: 50 }),
      this.prisma.client.session.findMany({ where: { userId: id, revokedAt: null }, select: { id: true, platform: true, createdAt: true, lastSeenAt: true } }),
    ]);
    return { ...summary, lifecycle, sessions };
  }

  async deactivate(actor: Actor, id: string, reason: string) {
    const u = await this.prisma.client.user.findUnique({ where: { id } });
    if (!u || !this.canSee(actor, u.id)) throw AppError.notFound('User');
    if (u.role === 'ADMIN') throw new AppError('RBAC_FORBIDDEN', 'The Admin account cannot be deactivated.');
    if (actor.role === 'MANAGER' && u.role !== 'TELECALLER') throw new AppError('RBAC_FORBIDDEN', 'Managers can only deactivate their own Telecallers.');
    if (u.status === 'DEACTIVATED') return this.toSummary(u);
    const updated = await this.prisma.client.$transaction(async (tx) => {
      const r = await tx.user.update({ where: { id }, data: { status: 'DEACTIVATED' } });
      await tx.userLifecycleEvent.create({ data: { userId: id, eventType: 'DEACTIVATED', actorUserId: actor.userId, reason } });
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'USER_DEACTIVATED' } });
      await tx.officialIdCard.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }); // F-312: ID verifies as revoked
      return r;
    });
    RequestContextStore.audit({ entityId: id, before: { status: u.status }, after: { status: 'DEACTIVATED' }, reason });
    return this.toSummary(updated);
  }

  /** Admin-only reactivation of an Admin-deactivated user. Training-expired Telecallers go through F-204 (Manager). */
  async reactivate(actor: Actor, id: string, reason: string) {
    if (actor.role !== 'ADMIN') throw new AppError('RBAC_FORBIDDEN', 'Only the Admin can reactivate accounts here.');
    const u = await this.prisma.client.user.findUnique({ where: { id }, include: { trainingEnrollment: true } });
    if (!u) throw AppError.notFound('User');
    if (u.role === 'TELECALLER' && u.trainingEnrollment?.status === 'EXPIRED_DEACTIVATED') {
      throw new AppError('CONFLICT', 'This Telecaller was deactivated by the training deadline; the assigned Manager must reactivate training (F-204).');
    }
    const updated = await this.prisma.client.$transaction(async (tx) => {
      const r = await tx.user.update({ where: { id }, data: { status: 'ACTIVE' } });
      await tx.userLifecycleEvent.create({ data: { userId: id, eventType: 'REACTIVATED', actorUserId: actor.userId, reason } });
      if (r.role === 'TELECALLER') await reissueIdCard(tx, id); // F-312
      return r;
    });
    RequestContextStore.audit({ entityId: id, before: { status: u.status }, after: { status: 'ACTIVE' }, reason });
    return this.toSummary(updated);
  }

  async revokeSessions(actor: Actor, id: string, reason: string) {
    const u = await this.prisma.client.user.findUnique({ where: { id } });
    if (!u) throw AppError.notFound('User');
    const r = await this.prisma.client.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: `ADMIN:${reason}` } });
    RequestContextStore.audit({ entityId: id, metadata: { revoked: r.count, by: actor.userId }, reason });
    return { revoked: r.count };
  }

  private canSee(actor: Actor, userId: string): boolean {
    if (actor.role === 'ADMIN') return true;
    if (actor.role === 'MANAGER') return actor.teamUserIds.includes(userId) || actor.userId === userId;
    return actor.userId === userId;
  }

  private async assertMobileFree(mobile: string) {
    const existing = await this.prisma.client.user.findUnique({ where: { mobile }, select: { id: true } });
    // Do not reveal which account owns the number (REQ-23 §23.1).
    if (existing) throw new AppError('USER_MOBILE_TAKEN', 'This mobile number cannot be used.');
  }
}

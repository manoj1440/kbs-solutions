import { formatDateTime } from '@kbs/shared';
import { Injectable } from '@nestjs/common';
import ipaddr from 'ipaddr.js';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { Paginated } from '../../common/interceptors/response-envelope.interceptor';
import { RequestContextStore } from '../../common/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface NetworkEvaluation {
  required: boolean;
  allowed: boolean;
  reason: 'NOT_REQUIRED' | 'WFH_ACTIVE' | 'OFFICE_MATCH' | 'OUTSIDE_OFFICE_NETWORK' | 'ALLOWLIST_EMPTY';
  matchedNetworkId?: string;
  exceptionId?: string;
}

/** F-301: office-network allowlist + WFH exceptions, evaluated server-side from the client IP (never SSID). */
@Injectable()
export class AccessPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async evaluate(actor: Pick<Actor, 'userId' | 'role'>, ip: string): Promise<NetworkEvaluation> {
    if (actor.role !== 'TELECALLER' || !this.config.getBool('network.enforceForTelecallers')) {
      return { required: false, allowed: true, reason: 'NOT_REQUIRED' };
    }
    const now = new Date();
    const exception = await this.prisma.client.wfhException.findFirst({
      where: { telecallerUserId: actor.userId, revokedAt: null, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      select: { id: true },
    });
    if (exception) return { required: true, allowed: true, reason: 'WFH_ACTIVE', exceptionId: exception.id };

    const networks = await this.prisma.client.officeNetwork.findMany({ where: { active: true }, select: { id: true, cidr: true } });
    if (networks.length === 0) {
      return this.config.getBool('network.allowEmptyAllowlist')
        ? { required: true, allowed: true, reason: 'OFFICE_MATCH' }
        : { required: true, allowed: false, reason: 'ALLOWLIST_EMPTY' };
    }
    const match = networks.find((n) => ipInCidr(ip, n.cidr));
    if (match) return { required: true, allowed: true, reason: 'OFFICE_MATCH', matchedNetworkId: match.id };
    return { required: true, allowed: false, reason: 'OUTSIDE_OFFICE_NETWORK' };
  }

  /** Records the evaluation; denials always, allowed at most once per user per 5 minutes. */
  async recordEvent(userId: string, ip: string, ev: NetworkEvaluation, route: string, ssidHint?: string) {
    if (!ev.required) return;
    const outcome = !ev.allowed ? 'DENIED' : ev.reason === 'WFH_ACTIVE' ? 'ALLOWED_WFH' : 'ALLOWED_OFFICE';
    if (outcome !== 'DENIED') {
      const recent = await this.prisma.client.networkAccessEvent.findFirst({
        where: { userId, outcome, at: { gte: new Date(Date.now() - 5 * 60_000) } },
        select: { id: true },
      });
      if (recent) return;
    }
    await this.prisma.client.networkAccessEvent.create({
      data: { userId, ip, ssidHint: ssidHint?.slice(0, 64), outcome, matchedNetworkId: ev.matchedNetworkId, exceptionId: ev.exceptionId, route },
    });
  }

  // ── Admin: office networks ──
  listNetworks() {
    return this.prisma.client.officeNetwork.findMany({ orderBy: { createdAt: 'desc' } });
  }
  async addNetwork(actor: Actor, input: { label: string; cidr: string }) {
    if (!isValidCidr(input.cidr)) throw new AppError('VALIDATION_FAILED', 'cidr must be a valid IPv4/IPv6 CIDR (e.g. 203.0.113.0/24).');
    const n = await this.prisma.client.officeNetwork.create({ data: { label: input.label, cidr: input.cidr, createdByUserId: actor.userId } });
    RequestContextStore.audit({ entityId: n.id, after: { label: n.label, cidr: n.cidr } });
    return n;
  }
  async setNetworkActive(id: string, active: boolean) {
    const before = await this.prisma.client.officeNetwork.findUnique({ where: { id } });
    if (!before) throw AppError.notFound('Office network');
    const n = await this.prisma.client.officeNetwork.update({ where: { id }, data: { active } });
    RequestContextStore.audit({ entityId: id, before: { active: before.active }, after: { active } });
    return n;
  }

  // ── Manager/Admin: WFH exceptions ──
  async grantWfh(actor: Actor, input: { telecallerUserId: string; startsAt: Date; endsAt: Date | null; reason: string }) {
    const target = await this.prisma.client.user.findUnique({ where: { id: input.telecallerUserId } });
    if (!target || target.role !== 'TELECALLER') throw AppError.notFound('Telecaller');
    if (actor.role === 'MANAGER' && !actor.teamUserIds.includes(target.id)) throw AppError.notFound('Telecaller');
    const overlapping = await this.prisma.client.wfhException.findFirst({
      where: { telecallerUserId: target.id, revokedAt: null, OR: [{ endsAt: null }, { endsAt: { gte: input.startsAt } }] },
    });
    if (overlapping) throw new AppError('CONFLICT', 'An active WFH exception already exists for this Telecaller; revoke it first.');
    const ex = await this.prisma.client.wfhException.create({
      data: { telecallerUserId: target.id, grantedByUserId: actor.userId, startsAt: input.startsAt, endsAt: input.endsAt, reason: input.reason },
    });
    RequestContextStore.audit({ entityId: ex.id, after: { telecallerUserId: target.id, startsAt: ex.startsAt, endsAt: ex.endsAt } });
    // F-701: Telecaller + their Manager (REQ-19 §19.1)
    const until = ex.endsAt ? ` until ${formatDateTime(ex.endsAt)}` : ' until revoked';
    const { managerUserId } = await this.notifications.chainOf(target.id);
    await this.notifications.notifyMany([target.id, managerUserId], { kind: 'WFH_GRANTED', title: 'Work-from-home exception granted', body: `${target.fullName}: calling allowed outside the office network from ${formatDateTime(ex.startsAt)}${until}.`, deepLink: { entityType: 'User', entityId: target.id }, dedupeKey: `wfh:granted:${ex.id}` });
    return ex;
  }
  async revokeWfh(actor: Actor, id: string, reason: string) {
    const ex = await this.prisma.client.wfhException.findUnique({ where: { id } });
    if (!ex || (actor.role === 'MANAGER' && !actor.teamUserIds.includes(ex.telecallerUserId))) throw AppError.notFound('WFH exception');
    if (ex.revokedAt) return ex;
    const updated = await this.prisma.client.wfhException.update({ where: { id }, data: { revokedAt: new Date(), revokedByUserId: actor.userId } });
    RequestContextStore.audit({ entityId: id, reason, after: { revokedAt: updated.revokedAt } });
    const tc = await this.prisma.client.user.findUnique({ where: { id: ex.telecallerUserId }, select: { fullName: true } });
    const { managerUserId } = await this.notifications.chainOf(ex.telecallerUserId);
    await this.notifications.notifyMany([ex.telecallerUserId, managerUserId], { kind: 'WFH_REVOKED', title: 'Work-from-home exception revoked', body: `${tc?.fullName ?? 'Telecaller'}: calling is again limited to the office network. ${reason}`, deepLink: { entityType: 'User', entityId: ex.telecallerUserId }, dedupeKey: `wfh:revoked:${id}` });
    return updated;
  }
  listWfh(actor: Actor) {
    const where = actor.role === 'MANAGER' ? { telecallerUserId: { in: actor.teamUserIds } } : {};
    return this.prisma.client.wfhException.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200, include: { telecaller: { select: { id: true, fullName: true, employeeCode: true } }, grantedBy: { select: { id: true, fullName: true, role: true } } } });
  }

  async listEvents(actor: Actor, q: { page: number; pageSize: number; userId?: string; outcome?: 'DENIED' | 'ALLOWED_OFFICE' | 'ALLOWED_WFH' }) {
    const scope = actor.role === 'MANAGER' ? actor.teamUserIds : null;
    const userId = q.userId ? (scope && !scope.includes(q.userId) ? '__none__' : q.userId) : scope ? { in: scope } : undefined;
    const where = { userId, outcome: q.outcome };
    const [rows, total] = await Promise.all([
      this.prisma.client.networkAccessEvent.findMany({ where, orderBy: { at: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { user: { select: { id: true, fullName: true, employeeCode: true } }, matchedNetwork: { select: { label: true, cidr: true } } } }),
      this.prisma.client.networkAccessEvent.count({ where }),
    ]);
    return new Paginated(rows, q.page, q.pageSize, total);
  }
}

export function isValidCidr(cidr: string): boolean {
  try {
    ipaddr.parseCIDR(cidr);
    return true;
  } catch {
    return false;
  }
}

export function ipInCidr(ip: string, cidr: string): boolean {
  try {
    const addr = ipaddr.process(ip);
    const [range, bits] = ipaddr.parseCIDR(cidr);
    const rangeNorm = range.kind() === 'ipv6' && (range as ipaddr.IPv6).isIPv4MappedAddress() ? (range as ipaddr.IPv6).toIPv4Address() : range;
    if (addr.kind() !== rangeNorm.kind()) return false;
    const adjustedBits = range.kind() === 'ipv6' && rangeNorm.kind() === 'ipv4' ? bits - 96 : bits;
    return addr.match(rangeNorm as never, adjustedBits);
  } catch {
    return false;
  }
}

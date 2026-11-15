import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma/prisma.service';

/** F-106: effective-dated reporting hierarchy helpers used by Actor building and scope builders. */
@Injectable()
export class HierarchyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Current parent (Manager or Admin) of a user, or null. */
  async currentParentId(childUserId: string): Promise<string | null> {
    const row = await this.prisma.client.reportingAssignment.findFirst({
      where: { childUserId, effectiveTo: null, status: 'ACTIVE' },
      select: { parentUserId: true },
    });
    return row?.parentUserId ?? null;
  }

  /** Users currently reporting directly to a parent (one level). */
  async directReportIds(parentUserId: string): Promise<string[]> {
    const rows = await this.prisma.client.reportingAssignment.findMany({
      where: { parentUserId, effectiveTo: null, status: 'ACTIVE' },
      select: { childUserId: true },
    });
    return rows.map((r) => r.childUserId);
  }

  /**
   * A Manager's team: their Telecallers and Advisors, and — F-824 — every Advisor further down who signed up with the
   * Agent Code of one of those Advisors. A cycle cannot be created (see `ancestorIds`), the depth guard is belt and braces.
   */
  async teamUserIds(parentUserId: string): Promise<string[]> {
    const seen = new Set<string>();
    let frontier = [parentUserId];
    for (let depth = 0; depth < 12 && frontier.length; depth++) {
      const rows = await this.prisma.client.reportingAssignment.findMany({
        where: { parentUserId: { in: frontier }, effectiveTo: null, status: 'ACTIVE' },
        select: { childUserId: true, child: { select: { role: true } } },
      });
      frontier = [];
      for (const r of rows) {
        if (seen.has(r.childUserId) || r.childUserId === parentUserId) continue;
        seen.add(r.childUserId);
        if (r.child.role === 'ADVISOR') frontier.push(r.childUserId); // only an Advisor can have Advisors below
      }
    }
    return [...seen];
  }

  /** Everyone above a user, nearest first (Advisor → Advisor → Manager → Admin). Used to refuse reporting loops. */
  async ancestorIds(userId: string): Promise<string[]> {
    const out: string[] = [];
    let cur: string | null = userId;
    for (let depth = 0; depth < 12 && cur; depth++) {
      cur = await this.currentParentId(cur);
      if (!cur || out.includes(cur) || cur === userId) break;
      out.push(cur);
    }
    return out;
  }

  /** The nearest active Manager above a user, or null when the line ends at the Admin (F-824: payout approver). */
  async nearestManagerId(userId: string): Promise<string | null> {
    const ancestors = await this.ancestorIds(userId);
    if (!ancestors.length) return null;
    const users = await this.prisma.client.user.findMany({ where: { id: { in: ancestors } }, select: { id: true, role: true, status: true } });
    const byId = new Map(users.map((u) => [u.id, u]));
    for (const id of ancestors) {
      const u = byId.get(id);
      if (u?.role === 'MANAGER' && u.status === 'ACTIVE') return id;
    }
    return null;
  }

  async adminUserId(): Promise<string> {
    const admin = await this.prisma.client.user.findFirstOrThrow({ where: { role: 'ADMIN' }, select: { id: true } });
    return admin.id;
  }
}

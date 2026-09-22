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

  /** All users currently reporting to a parent (one level — Telecallers and Advisors under a Manager). */
  async teamUserIds(parentUserId: string): Promise<string[]> {
    const rows = await this.prisma.client.reportingAssignment.findMany({
      where: { parentUserId, effectiveTo: null, status: 'ACTIVE' },
      select: { childUserId: true },
    });
    return rows.map((r) => r.childUserId);
  }

  async adminUserId(): Promise<string> {
    const admin = await this.prisma.client.user.findFirstOrThrow({ where: { role: 'ADMIN' }, select: { id: true } });
    return admin.id;
  }
}

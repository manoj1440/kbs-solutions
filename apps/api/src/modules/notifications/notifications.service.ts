import type { NotificationKind } from '@kbs/shared';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../common/actor';
import { AppError } from '../../common/errors/app-error';
import { Paginated } from '../../common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface NotifyInput {
  recipientUserId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  deepLink?: { entityType: string; entityId: string };
  sourceRef?: Record<string, unknown>;
  /** Unique per logical event so repeated processing never duplicates (REQ-19 §19.2). */
  dedupeKey: string;
}

/** Minimal in-app notification centre (F-701 adds push fan-out and role resolvers). Bodies must never carry PAN/account numbers. */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(input: NotifyInput): Promise<void> {
    await this.prisma.client.notification.createMany({
      data: [{ recipientUserId: input.recipientUserId, kind: input.kind, title: input.title, body: input.body, deepLink: input.deepLink, sourceRef: input.sourceRef as object | undefined, dedupeKey: input.dedupeKey }],
      skipDuplicates: true,
    });
  }

  async list(actor: Actor, page: number, pageSize: number) {
    const where = { recipientUserId: actor.userId };
    const [rows, total, unread] = await Promise.all([
      this.prisma.client.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.client.notification.count({ where }),
      this.prisma.client.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return new Paginated(rows, page, pageSize, total, { unread });
  }

  async markRead(actor: Actor, id: string) {
    const n = await this.prisma.client.notification.findUnique({ where: { id } });
    if (!n || n.recipientUserId !== actor.userId) throw AppError.notFound('Notification');
    if (!n.readAt) await this.prisma.client.notification.update({ where: { id }, data: { readAt: new Date() } });
    return { id, readAt: n.readAt ?? new Date() };
  }
}

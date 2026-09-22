import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma/prisma.service';

import { JobsService } from './jobs.service';
import type { QUEUES } from './queues';

/**
 * F-110: transactional outbox. Services append events inside their DB transaction; the relay moves
 * them to BullMQ. Deterministic job ids collapse duplicates.
 */
@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
  ) {}

  /** Route event types to queues. Unknown types are marked processed with an error (never lost silently). */
  private routeFor(type: string): { queue: keyof typeof QUEUES; name: string } | null {
    if (type.startsWith('mis.')) return { queue: 'misImport', name: type };
    if (type.startsWith('training.')) return { queue: 'training', name: type };
    if (type.startsWith('payouts.')) return { queue: 'payouts', name: type };
    if (type.startsWith('notify.')) return { queue: 'notifications', name: type };
    if (type.startsWith('files.')) return { queue: 'files', name: type };
    return null;
  }

  async relay(limit = 100): Promise<number> {
    const events = await this.prisma.client.outboxEvent.findMany({ where: { processedAt: null, attempts: { lt: 5 } }, orderBy: { createdAt: 'asc' }, take: limit });
    let moved = 0;
    for (const ev of events) {
      const route = this.routeFor(ev.type);
      try {
        if (!route) throw new Error(`no route for ${ev.type}`);
        const payload = ev.payload as Record<string, unknown>;
        const jobId = typeof payload.jobId === 'string' ? payload.jobId : `${ev.type}:${ev.id}`;
        await this.jobs.enqueue(route.queue, route.name, { ...payload, outboxId: ev.id }, { jobId });
        await this.prisma.client.outboxEvent.update({ where: { id: ev.id }, data: { processedAt: new Date() } });
        moved++;
      } catch (e) {
        await this.prisma.client.outboxEvent.update({ where: { id: ev.id }, data: { attempts: { increment: 1 }, lastError: (e as Error).message.slice(0, 500) } });
        this.logger.warn({ outboxId: ev.id, type: ev.type }, 'outbox relay failed');
      }
    }
    return moved;
  }
}

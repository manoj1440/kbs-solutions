import { Controller, Get } from '@nestjs/common';

import { Public } from '../../common/decorators';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';

/**
 * Liveness for Render, the keep-warm job and the CI deploy check (which waits for `commit`). F-908 S10: public and
 * cheap — no counts, no queue depths. Queue depths and the outbox backlog are on `GET /ops/jobs` (Admin).
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  async health() {
    const [db, redis] = await Promise.all([this.prisma.client.$queryRaw`SELECT 1`.then(() => true).catch(() => false), this.redis.ping()]);
    return { status: db ? 'ok' : 'degraded', db, redis, commit: process.env.RENDER_GIT_COMMIT ?? null };
  }
}

import { Controller, Get } from '@nestjs/common';

import { Public } from '../../common/decorators';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  async health() {
    const db = await this.prisma.client.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    const redis = await this.redis.ping();
    return { status: db ? 'ok' : 'degraded', db, redis, time: new Date().toISOString() };
  }
}

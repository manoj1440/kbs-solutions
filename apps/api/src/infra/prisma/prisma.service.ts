import { createPrismaClient, type KbsPrismaClient } from '@kbs/db';
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { ENV, type Env } from '../../config/env';

/** Single Prisma client (guarded, see @kbs/db) exposed to modules. */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client: KbsPrismaClient;
  constructor(@Inject(ENV) env: Env) {
    this.client = createPrismaClient({ connectionString: env.DATABASE_URL, log: env.NODE_ENV === 'test' ? ['error'] : ['warn', 'error'] });
  }
  async onModuleInit() {
    await this.client.$connect();
  }
  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}

import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

import { ENV, type Env } from '../../config/env';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;
  readonly subscriber: Redis;
  constructor(@Inject(ENV) env: Env) {
    this.client = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: true, enableOfflineQueue: true });
    this.subscriber = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: true });
    this.client.on('error', () => undefined);
    this.subscriber.on('error', () => undefined);
  }
  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
  async onModuleDestroy() {
    await Promise.allSettled([this.client.quit(), this.subscriber.quit()]);
  }
}

import type { ThrottlerStorage } from '@nestjs/throttler';
import type Redis from 'ioredis';

type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/**
 * One round trip per request: count the hit in the current window and, once over the limit, start a block that
 * outlives the window. Returns [hits, msToWindowEnd, msToBlockEnd (0 = not blocked)].
 */
const INCREMENT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end
local blocked = redis.call('PTTL', KEYS[2])
if blocked < 0 and hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  blocked = tonumber(ARGV[3])
end
if blocked < 0 then blocked = 0 end
return {hits, ttl, blocked}
`;

/**
 * F-908 S3: throttler counters shared by every API instance (Render may run several, and restarts must not reset the
 * budget). A Redis fault falls back to the in-process counter so an outage degrades to per-instance limits, never to
 * refusing all traffic.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(
    private readonly redis: Redis,
    private readonly fallback: ThrottlerStorage,
    private readonly prefix = 'throttle',
  ) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<ThrottlerStorageRecord> {
    const base = `${this.prefix}:${throttlerName}:${key}`;
    try {
      const [hits, ttlMs, blockMs] = (await this.redis.eval(INCREMENT, 2, `${base}:hits`, `${base}:block`, String(ttl), String(limit), String(blockDuration > 0 ? blockDuration : ttl))) as [number, number, number];
      return { totalHits: hits, timeToExpire: Math.ceil(ttlMs / 1000), isBlocked: blockMs > 0, timeToBlockExpire: Math.ceil(blockMs / 1000) };
    } catch {
      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    }
  }
}

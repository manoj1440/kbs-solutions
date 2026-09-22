import { CONFIG_KEY_MAP, CONFIG_KEYS } from '@kbs/shared';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import { AuditService } from '../audit/audit.service';

const CHANNEL = 'kbs:config:invalidate';

/**
 * F-104: typed access to SystemConfig with an in-memory cache invalidated across instances via Redis pub/sub.
 * Every change records history + audit and requires a reason.
 */
@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly logger = new Logger(ConfigService.name);
  private cache = new Map<string, unknown>();
  private loaded = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    await this.reload();
    try {
      await this.redis.subscriber.subscribe(CHANNEL);
      this.redis.subscriber.on('message', (ch) => {
        if (ch === CHANNEL) void this.reload();
      });
    } catch {
      this.logger.warn('Redis unavailable — config cache will not invalidate across instances');
    }
  }

  async reload(): Promise<void> {
    const rows = await this.prisma.client.systemConfig.findMany();
    const next = new Map<string, unknown>();
    for (const def of CONFIG_KEYS) next.set(def.key, def.defaultValue);
    for (const r of rows) next.set(r.key, r.value === null ? (CONFIG_KEY_MAP.get(r.key)?.defaultValue ?? null) : r.value);
    this.cache = next;
    this.loaded = true;
  }

  get<T = unknown>(key: string): T {
    if (!this.loaded) throw new Error('ConfigService used before load');
    if (!CONFIG_KEY_MAP.has(key)) throw new Error(`Unknown config key ${key}`);
    return this.cache.get(key) as T;
  }

  getInt(key: string): number | null {
    const v = this.get<number | null>(key);
    return v === null || v === undefined ? null : Number(v);
  }
  getBool(key: string): boolean {
    return Boolean(this.get(key));
  }
  getString(key: string): string | null {
    const v = this.get<string | null>(key);
    return v === null || v === undefined ? null : String(v);
  }
  getJson<T>(key: string): T {
    return this.get<T>(key);
  }

  /** Throws CONFIG_MISSING when a launch-gate value is unset (fail closed). */
  require<T>(key: string, what: string): T {
    const v = this.get<T | null>(key);
    if (v === null || v === undefined) throw new AppError('CONFIG_MISSING', `${what} is not configured. Ask the Admin to set '${key}'.`, { key }, 'CONTACT_ADMIN');
    return v;
  }

  async list() {
    const rows = await this.prisma.client.systemConfig.findMany({ orderBy: { key: 'asc' } });
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return CONFIG_KEYS.map((def) => {
      const r = byKey.get(def.key);
      return {
        key: def.key,
        valueType: def.valueType,
        value: r ? (r.value ?? null) : def.defaultValue,
        defaultValue: def.defaultValue,
        description: def.description,
        requiresValueBeforeProd: def.requiresValueBeforeProd,
        updatedAt: r?.updatedAt?.toISOString() ?? null,
        updatedBy: r?.updatedByUserId ?? null,
      };
    });
  }

  async update(key: string, value: unknown, reason: string, actorUserId: string) {
    const def = CONFIG_KEY_MAP.get(key);
    if (!def) throw AppError.notFound('Config key');
    this.validateType(def.valueType, value);
    const before = await this.prisma.client.systemConfig.findUnique({ where: { key } });
    await this.prisma.client.$transaction([
      this.prisma.client.systemConfig.upsert({
        where: { key },
        update: { value: value === null ? undefined : (value as object), updatedByUserId: actorUserId, updatedAt: new Date() },
        create: {
          key,
          valueType: def.valueType,
          value: value === null ? undefined : (value as object),
          defaultValue: def.defaultValue === null ? undefined : (def.defaultValue as object),
          description: def.description,
          requiresValueBeforeProd: def.requiresValueBeforeProd,
          updatedByUserId: actorUserId,
        },
      }),
      this.prisma.client.systemConfigHistory.create({
        data: { key, oldValue: before?.value ?? undefined, newValue: value === null ? undefined : (value as object), reason, changedByUserId: actorUserId },
      }),
    ]);
    await this.audit.record({ action: 'config.update', entityType: 'SystemConfig', entityId: key, before: before?.value ?? null, after: value, reason });
    await this.reload();
    await this.redis.client.publish(CHANNEL, key).catch(() => undefined);
  }

  async history(key: string) {
    return this.prisma.client.systemConfigHistory.findMany({ where: { key }, orderBy: { at: 'desc' }, take: 100 });
  }

  /** REQ-28 §28.2 launch-gate checklist: keys that must hold a value before production. */
  async launchGates() {
    const rows = await this.prisma.client.systemConfig.findMany({ where: { requiresValueBeforeProd: true } });
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return CONFIG_KEYS.filter((d) => d.requiresValueBeforeProd).map((d) => {
      const r = byKey.get(d.key);
      const value = r ? r.value : d.defaultValue;
      const isSet = value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0) && value !== false;
      return { key: d.key, description: d.description, isSet };
    });
  }

  private validateType(type: string, value: unknown) {
    if (value === null) return;
    const ok =
      type === 'INT' || type === 'DURATION' ? Number.isInteger(value) : type === 'BOOL' ? typeof value === 'boolean' : type === 'STRING' || type === 'USER_ID' ? typeof value === 'string' : true;
    if (!ok) throw new AppError('VALIDATION_FAILED', `Value must be of type ${type}.`);
  }
}

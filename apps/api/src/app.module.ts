import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, ThrottlerStorageService } from '@nestjs/throttler';
import type { Request } from 'express';
import { LoggerModule } from 'nestjs-pino';

import { AppExceptionFilter } from './common/errors/app-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PolicyGuard } from './common/guards/policy.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { loggableQuery, loggableUrl } from './common/log-url';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { RedisThrottlerStorage } from './common/throttle/redis-throttler.storage';
import { throttleTracker } from './common/throttle/throttle-tracker';
import { CoreModule } from './config/core.module';
import { ENV, type Env } from './config/env';
import { loadEnv } from './config/env';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { RedisService } from './infra/redis/redis.service';
import { AccessPolicyModule } from './modules/access-policy/access-policy.module';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { TokenService } from './modules/auth/token.service';
import { CallingListModule } from './modules/calling-list/calling-list.module';
import { CallsModule } from './modules/calls/calls.module';
import { CatalogueModule } from './modules/catalogue/catalogue.module';
import { ConfigModule } from './modules/config/config.module';
import { DashboardsModule } from './modules/dashboards/dashboards.module';
import { FilesModule } from './modules/files/files.module';
import { GatesModule } from './modules/gates/gates.module';
import { HealthController } from './modules/health/health.controller';
import { IdCardsModule } from './modules/id-cards/id-cards.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { LeadsModule } from './modules/leads/leads.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { MisModule } from './modules/mis/mis.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { RetentionModule } from './modules/retention/retention.module';
import { SharingModule } from './modules/sharing/sharing.module';
import { TrainingModule } from './modules/training/training.module';
import { UsersModule } from './modules/users/users.module';
import { ProvidersModule } from './providers/providers.module';

/** Paths / keys that must never reach logs (REQ-24 §24.3, F-103). */
export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["idempotency-key"]',
  'req.headers["x-kbs-proxy-secret"]',
  'req.headers["x-kbs-webhook-token"]',
  'res.headers["set-cookie"]',
  '*.mobile',
  '*.pan',
  '*.panEncrypted',
  '*.aadhaar',
  '*.accountNumber',
  '*.bankAccountEncrypted',
  '*.otp',
  '*.code',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.codeHash',
];

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        redact: { paths: LOG_REDACT_PATHS, censor: '[redacted]' },
        transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
        autoLogging: process.env.NODE_ENV !== 'test',
        customProps: (req) => ({ requestId: (req.headers['x-request-id'] as string | undefined) ?? undefined }),
        // F-908 S6: pino-http logs `url` and `query`; webhook secrets travel in the query string
        serializers: {
          req: (req: { url?: string; query?: Record<string, unknown> }) => {
            req.url = loggableUrl(req.url);
            req.query = loggableQuery(req.query);
            return req;
          },
        },
      },
    }),
    // F-908 S3: request budget per signed-in user (else per client IP), counted in Redis so every instance and restart
    // shares it; perf/acceptance environments may raise it (F-905), production keeps the default. Tests keep the
    // in-process store so parallel suites never share counters.
    ThrottlerModule.forRootAsync({
      inject: [ENV, RedisService, TokenService],
      useFactory: (env: Env, redis: RedisService, tokens: TokenService) => ({
        throttlers: [{ name: 'global', ttl: 60_000, limit: env.THROTTLE_LIMIT_PER_MIN }],
        storage: env.NODE_ENV === 'test' ? new ThrottlerStorageService() : new RedisThrottlerStorage(redis.client, new ThrottlerStorageService()),
        getTracker: (req: Record<string, unknown>) => throttleTracker(req as unknown as Request, { hops: env.TRUST_PROXY_HOPS, proxySecret: env.TRUSTED_PROXY_SECRET || undefined }, tokens),
      }),
    }),
    CoreModule,
    PrismaModule,
    RedisModule,
    ProvidersModule,
    AuditModule,
    ConfigModule,
    UsersModule,
    AccessPolicyModule,
    GatesModule,
    AuthModule,
    JobsModule,
    FilesModule,
    NotificationsModule,
    TrainingModule,
    CallingListModule,
    CatalogueModule,
    CallsModule,
    PrivacyModule,
    IdCardsModule,
    SharingModule,
    OnboardingModule,
    LeadsModule,
    PayoutsModule,
    DashboardsModule,
    RetentionModule,
    MaintenanceModule,
    MisModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AppExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PolicyGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    const env = loadEnv();
    const mw = new RequestIdMiddleware({ hops: env.TRUST_PROXY_HOPS, proxySecret: env.TRUSTED_PROXY_SECRET || undefined });
    consumer.apply(mw.use.bind(mw)).forRoutes('*path');
  }
}

import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AppExceptionFilter } from './common/errors/app-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PolicyGuard } from './common/guards/policy.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { CoreModule } from './config/core.module';
import { ENV, type Env } from './config/env';
import { loadEnv } from './config/env';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { AccessPolicyModule } from './modules/access-policy/access-policy.module';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
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
import { MisModule } from './modules/mis/mis.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { SharingModule } from './modules/sharing/sharing.module';
import { TrainingModule } from './modules/training/training.module';
import { UsersModule } from './modules/users/users.module';
import { ProvidersModule } from './providers/providers.module';

/** Paths / keys that must never reach logs (REQ-24 §24.3, F-103). */
export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["idempotency-key"]',
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
      },
    }),
    // per-IP request budget; perf/acceptance environments may raise it (F-905), production keeps the default
    ThrottlerModule.forRootAsync({ inject: [ENV], useFactory: (env: Env) => [{ name: 'global', ttl: 60_000, limit: env.THROTTLE_LIMIT_PER_MIN }] }),
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
    IdCardsModule,
    SharingModule,
    OnboardingModule,
    LeadsModule,
    PayoutsModule,
    DashboardsModule,
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
    consumer.apply(new RequestIdMiddleware(env.TRUST_PROXY_HOPS).use.bind(new RequestIdMiddleware(env.TRUST_PROXY_HOPS))).forRoutes('*path');
  }
}

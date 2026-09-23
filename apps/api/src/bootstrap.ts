import { type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { loadEnv } from './config/env';

/** Shared bootstrap for main.ts and e2e tests. */
export async function createApp(): Promise<INestApplication> {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: env.WEB_ORIGIN.split(','), credentials: true, exposedHeaders: ['X-Request-Id'] });
  app.enableShutdownHooks();
  if (env.NODE_ENV !== 'production') {
    const doc = new DocumentBuilder().setTitle('KBS Solutions API').setVersion('0.1').addBearerAuth().build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc));
  }
  return app;
}

/**
 * F-110: `WORKER_MODE=1` initialises the app (processors, repeatable jobs) without an HTTP listener; otherwise HTTP only
 * (processors also run with `JOBS_INLINE=1` in dev).
 */
export async function startApp(env: { WORKER_MODE: boolean; API_PORT: number; NODE_ENV: string }): Promise<INestApplication> {
  const app = await createApp();
  if (env.WORKER_MODE) {
    await app.init();
    console.warn('[api] worker mode started (no HTTP)');
    return app;
  }
  await app.listen(env.API_PORT);
  console.warn(`[api] listening on :${env.API_PORT} (${env.NODE_ENV})`);
  return app;
}

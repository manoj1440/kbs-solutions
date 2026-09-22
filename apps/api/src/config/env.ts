import 'dotenv/config';

import { z } from 'zod';

const bool = z
  .union([z.literal('1'), z.literal('0'), z.literal('true'), z.literal('false'), z.literal('')])
  .optional()
  .transform((v) => v === '1' || v === 'true');

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(4000),
  WORKER_MODE: bool,
  JOBS_INLINE: bool,
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.string().default('info'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  DATA_ENCRYPTION_KEY: z.string().min(40), // base64 of 32 bytes
  OTP_PEPPER: z.string().min(8).default('dev-pepper-change-me'),
  OTP_PROVIDER: z.enum(['console']).default('console'),
  OTP_DEV_MASTER_CODE: z.string().regex(/^\d{6}$/).optional().or(z.literal('')),
  TELEPHONY_PROVIDER: z.enum(['mock']).default('mock'),
  WHATSAPP_PROVIDER: z.enum(['handoff', 'mock-business']).default('handoff'),
  KYC_PROVIDER: z.enum(['mock']).default('mock'),
  PAN_PROVIDER: z.enum(['mock']).default('mock'),
  PUSH_PROVIDER: z.enum(['mock']).default('mock'),
  SCAN_PROVIDER: z.enum(['noop']).default('noop'),
  STORAGE_PROVIDER: z.enum(['s3', 'memory']).default('memory'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('ap-south-1'),
  S3_BUCKET: z.string().default('kbs-private'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: bool,
});
export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
    throw new Error(`Invalid environment:\n  ${issues}`);
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.OTP_DEV_MASTER_CODE) {
    throw new Error('OTP_DEV_MASTER_CODE must be empty in production');
  }
  cached = parsed.data;
  return cached;
}

export const ENV = Symbol('ENV');

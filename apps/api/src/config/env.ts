import 'dotenv/config';

import { z } from 'zod';

const bool = z
  .union([z.literal('1'), z.literal('0'), z.literal('true'), z.literal('false'), z.literal('')])
  .optional()
  .transform((v) => v === '1' || v === 'true');

export const EnvSchema = z.object({
  /** F-907: `staging` = deployed (secure cookies, no error details, no Swagger) but OTP via the secret master code — there is no SMS provider yet. */
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(4000),
  WORKER_MODE: bool,
  JOBS_INLINE: bool,
  /** F-508: where long jobs run — BullMQ queue (worker mode) or detached in this process. Default: queue in production. */
  JOBS_DISPATCH: z.enum(['queue', 'local']).optional(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  /** Externally reachable API base (provider webhooks / redirect links). */
  API_PUBLIC_URL: z.string().default('http://localhost:4000'),
  LOG_LEVEL: z.string().default('info'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  DATA_ENCRYPTION_KEY: z.string().min(40), // base64 of 32 bytes
  OTP_PEPPER: z.string().min(8).default('dev-pepper-change-me'),
  /** `console` prints the code to the log (dev only). `msg91` sends a real SMS — runbook 07. */
  OTP_PROVIDER: z.enum(['console', 'msg91']).default('console'),
  /** MSG91 transactional SMS (Send SMS / flow API). Host only — no scheme, no path. */
  MSG91_HOST: z.string().regex(/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i, 'host name only, e.g. control.msg91.com').default('control.msg91.com'),
  MSG91_AUTH_KEY: z.string().optional(),
  /** MSG91's id of the SMS template (the DLT template id is entered against it inside MSG91). */
  MSG91_TEMPLATE_ID: z.string().optional(),
  /** DLT-registered header (sender id) of that template. */
  MSG91_SENDER_ID: z.string().optional(),
  /** Variable name used in the MSG91 template for the code (`##VAR1##`). Case-sensitive. */
  MSG91_OTP_VARIABLE: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).default('VAR1'),
  OTP_DEV_MASTER_CODE: z.string().regex(/^\d{6}$/).optional().or(z.literal('')),
  TELEPHONY_PROVIDER: z.enum(['mock', 'exotel']).default('mock'),
  /** Exotel click-to-call (Connect Two Numbers). Host: api.exotel.com (Singapore) or api.in.exotel.com (Mumbai). */
  EXOTEL_HOST: z.string().default('api.exotel.com'),
  EXOTEL_ACCOUNT_SID: z.string().optional(),
  EXOTEL_API_KEY: z.string().optional(),
  EXOTEL_API_TOKEN: z.string().optional(),
  /** The ExoPhone shown to both sides. */
  EXOTEL_CALLER_ID: z.string().optional(),
  /** Random secret added to the status-callback URL; callbacks without it are refused. */
  EXOTEL_WEBHOOK_TOKEN: z.string().optional(),
  WHATSAPP_PROVIDER: z.enum(['handoff', 'mock-business']).default('handoff'),
  KYC_PROVIDER: z.enum(['mock']).default('mock'),
  PAN_PROVIDER: z.enum(['mock']).default('mock'),
  PUSH_PROVIDER: z.enum(['mock', 'expo']).default('mock'),
  EXPO_ACCESS_TOKEN: z.string().optional(),
  THROTTLE_LIMIT_PER_MIN: z.coerce.number().int().min(10).default(300),
  SCAN_PROVIDER: z.enum(['noop', 'clamav']).default('noop'),
  CLAMAV_HOST: z.string().default('localhost'),
  CLAMAV_PORT: z.coerce.number().int().min(1).max(65535).default(3310),
  CLAMAV_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
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
  assertMasterCodeAllowed(parsed.data);
  assertOtpProviderConfigured(parsed.data);
  if (parsed.data.TELEPHONY_PROVIDER === 'exotel') {
    const missing = (['EXOTEL_ACCOUNT_SID', 'EXOTEL_API_KEY', 'EXOTEL_API_TOKEN', 'EXOTEL_CALLER_ID', 'EXOTEL_WEBHOOK_TOKEN'] as const).filter((k) => !parsed.data[k]);
    if (missing.length) throw new Error(`TELEPHONY_PROVIDER=exotel needs ${missing.join(', ')}`);
  }
  cached = parsed.data;
  return cached;
}

/** Production never accepts a master OTP; staging only a non-guessable one (F-907). */
export function assertMasterCodeAllowed(env: Pick<Env, 'NODE_ENV' | 'OTP_DEV_MASTER_CODE'>): void {
  const code = env.OTP_DEV_MASTER_CODE ?? '';
  if (env.NODE_ENV === 'production' && code) throw new Error('OTP_DEV_MASTER_CODE must be empty in production');
  if (env.NODE_ENV === 'staging' && /^(\d)\1{5}$|^123456$/.test(code)) {
    throw new Error('OTP_DEV_MASTER_CODE in staging must be a secret code, not a guessable one');
  }
}

/** A real SMS provider without its keys must stop the boot in every environment — never a login screen that cannot send. */
export function assertOtpProviderConfigured(env: Pick<Env, 'OTP_PROVIDER' | 'MSG91_AUTH_KEY' | 'MSG91_TEMPLATE_ID' | 'MSG91_SENDER_ID'>): void {
  if (env.OTP_PROVIDER !== 'msg91') return;
  const missing = (['MSG91_AUTH_KEY', 'MSG91_TEMPLATE_ID', 'MSG91_SENDER_ID'] as const).filter((k) => !env[k]?.trim());
  if (missing.length) throw new Error(`OTP_PROVIDER=msg91 needs ${missing.join(', ')} (see DOCS/runbooks/07-sms-otp-provider.md)`);
}

export const ENV = Symbol('ENV');

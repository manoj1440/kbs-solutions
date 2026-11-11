import { Global, Module } from '@nestjs/common';

import { ENV, type Env } from '../config/env';

import { CashfreeDigilockerKycAdapter } from './adapters/cashfree-digilocker-kyc.adapter';
import { CashfreePanAdapter } from './adapters/cashfree-pan.adapter';
import type { CashfreeVerificationConfig } from './adapters/cashfree-verification.client';
import { ClamdScanAdapter } from './adapters/clamd-scan.adapter';
import { ConsoleOtpAdapter } from './adapters/console-otp.adapter';
import { ExotelTelephonyAdapter } from './adapters/exotel-telephony.adapter';
import { ExpoPushAdapter } from './adapters/expo-push.adapter';
import { HandoffWhatsAppAdapter } from './adapters/handoff-whatsapp.adapter';
import { MemoryStorageAdapter } from './adapters/memory-storage.adapter';
import { MockKycAdapter } from './adapters/mock-kyc.adapter';
import { MockPanAdapter } from './adapters/mock-pan.adapter';
import { MockPushAdapter } from './adapters/mock-push.adapter';
import { MockTelephonyAdapter } from './adapters/mock-telephony.adapter';
import { Msg91OtpAdapter } from './adapters/msg91-otp.adapter';
import { NoopScanAdapter } from './adapters/noop-scan.adapter';
import { S3StorageAdapter } from './adapters/s3-storage.adapter';
import { KYC_PROVIDER, OTP_PROVIDER, PAN_PROVIDER, PUSH_PROVIDER, SCAN_PROVIDER, STORAGE_PROVIDER, TELEPHONY_PROVIDER, WHATSAPP_PROVIDER } from './ports';

/** Boot validation (config/env.ts) guarantees these are present whenever a cashfree provider is selected. */
const cashfreeConfig = (env: Env): CashfreeVerificationConfig => ({
  env: env.CASHFREE_VERIFICATION_ENV as 'sandbox' | 'production',
  clientId: (env.CASHFREE_VERIFICATION_CLIENT_ID as string).trim(),
  clientSecret: (env.CASHFREE_VERIFICATION_CLIENT_SECRET as string).trim(),
  publicKeyPem: env.CASHFREE_VERIFICATION_PUBLIC_KEY?.trim() || undefined,
});

/** Selects adapters by env. Real vendor adapters are added per feature once contracts exist (REQ-28 §28.1). */
@Global()
@Module({
  providers: [
    {
      provide: OTP_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.OTP_PROVIDER === 'msg91'
          ? new Msg91OtpAdapter({ host: env.MSG91_HOST, authKey: (env.MSG91_AUTH_KEY as string).trim(), templateId: (env.MSG91_TEMPLATE_ID as string).trim(), senderId: (env.MSG91_SENDER_ID as string).trim(), otpVariable: env.MSG91_OTP_VARIABLE })
          : new ConsoleOtpAdapter(env.NODE_ENV === 'production'),
    },
    {
      provide: TELEPHONY_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.TELEPHONY_PROVIDER === 'exotel'
          ? new ExotelTelephonyAdapter({ host: env.EXOTEL_HOST, accountSid: env.EXOTEL_ACCOUNT_SID as string, apiKey: env.EXOTEL_API_KEY as string, apiToken: env.EXOTEL_API_TOKEN as string, callerId: env.EXOTEL_CALLER_ID as string, webhookToken: env.EXOTEL_WEBHOOK_TOKEN as string })
          : new MockTelephonyAdapter(),
    },
    { provide: WHATSAPP_PROVIDER, useFactory: () => new HandoffWhatsAppAdapter() },
    {
      provide: KYC_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) => (env.KYC_PROVIDER === 'cashfree' ? new CashfreeDigilockerKycAdapter({ ...cashfreeConfig(env), apiPublicUrl: env.API_PUBLIC_URL }) : new MockKycAdapter()),
    },
    {
      provide: PAN_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) => (env.PAN_PROVIDER === 'cashfree' ? new CashfreePanAdapter({ ...cashfreeConfig(env), apiVersion: env.CASHFREE_VERIFICATION_API_VERSION }) : new MockPanAdapter()),
    },
    { provide: PUSH_PROVIDER, inject: [ENV], useFactory: (env: Env) => (env.PUSH_PROVIDER === 'expo' ? new ExpoPushAdapter(env.EXPO_ACCESS_TOKEN) : new MockPushAdapter()) },
    { provide: SCAN_PROVIDER, inject: [ENV], useFactory: (env: Env) => (env.SCAN_PROVIDER === 'clamav' ? new ClamdScanAdapter(env.CLAMAV_HOST, env.CLAMAV_PORT, env.CLAMAV_TIMEOUT_MS) : new NoopScanAdapter()) },
    {
      provide: STORAGE_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) => {
        if (env.STORAGE_PROVIDER === 's3') {
          return new S3StorageAdapter({ endpoint: env.S3_ENDPOINT, region: env.S3_REGION, accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY, forcePathStyle: env.S3_FORCE_PATH_STYLE });
        }
        return new MemoryStorageAdapter();
      },
    },
  ],
  exports: [OTP_PROVIDER, TELEPHONY_PROVIDER, WHATSAPP_PROVIDER, KYC_PROVIDER, PAN_PROVIDER, PUSH_PROVIDER, SCAN_PROVIDER, STORAGE_PROVIDER],
})
export class ProvidersModule {}

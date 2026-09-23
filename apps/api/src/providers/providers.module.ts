import { Global, Module } from '@nestjs/common';

import { ENV, type Env } from '../config/env';

import { ClamdScanAdapter } from './adapters/clamd-scan.adapter';
import { ConsoleOtpAdapter } from './adapters/console-otp.adapter';
import { ExpoPushAdapter } from './adapters/expo-push.adapter';
import { HandoffWhatsAppAdapter } from './adapters/handoff-whatsapp.adapter';
import { MemoryStorageAdapter } from './adapters/memory-storage.adapter';
import { MockKycAdapter } from './adapters/mock-kyc.adapter';
import { MockPanAdapter } from './adapters/mock-pan.adapter';
import { MockPushAdapter } from './adapters/mock-push.adapter';
import { MockTelephonyAdapter } from './adapters/mock-telephony.adapter';
import { NoopScanAdapter } from './adapters/noop-scan.adapter';
import { S3StorageAdapter } from './adapters/s3-storage.adapter';
import { KYC_PROVIDER, OTP_PROVIDER, PAN_PROVIDER, PUSH_PROVIDER, SCAN_PROVIDER, STORAGE_PROVIDER, TELEPHONY_PROVIDER, WHATSAPP_PROVIDER } from './ports';

/** Selects adapters by env. Real vendor adapters are added per feature once contracts exist (REQ-28 §28.1). */
@Global()
@Module({
  providers: [
    { provide: OTP_PROVIDER, inject: [ENV], useFactory: (env: Env) => new ConsoleOtpAdapter(env.NODE_ENV === 'production') },
    { provide: TELEPHONY_PROVIDER, useFactory: () => new MockTelephonyAdapter() },
    { provide: WHATSAPP_PROVIDER, useFactory: () => new HandoffWhatsAppAdapter() },
    { provide: KYC_PROVIDER, useFactory: () => new MockKycAdapter() },
    { provide: PAN_PROVIDER, useFactory: () => new MockPanAdapter() },
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

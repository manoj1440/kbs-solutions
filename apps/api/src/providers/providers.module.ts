import { Global, Module } from '@nestjs/common';

import { ENV, type Env } from '../config/env';

import { ConsoleOtpAdapter } from './adapters/console-otp.adapter';
import { HandoffWhatsAppAdapter } from './adapters/handoff-whatsapp.adapter';
import { MemoryStorageAdapter } from './adapters/memory-storage.adapter';
import { MockKycAdapter } from './adapters/mock-kyc.adapter';
import { MockPanAdapter } from './adapters/mock-pan.adapter';
import { MockPushAdapter } from './adapters/mock-push.adapter';
import { MockTelephonyAdapter } from './adapters/mock-telephony.adapter';
import { NoopScanAdapter } from './adapters/noop-scan.adapter';
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
    { provide: PUSH_PROVIDER, useFactory: () => new MockPushAdapter() },
    { provide: SCAN_PROVIDER, useFactory: () => new NoopScanAdapter() },
    {
      provide: STORAGE_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) => {
        // S3 adapter lands with F-108 (files module); memory adapter keeps the core bootable everywhere.
        if (env.STORAGE_PROVIDER === 's3') {
           
          console.warn('[providers] STORAGE_PROVIDER=s3 requested but the S3 adapter arrives in F-108; using memory storage');
        }
        return new MemoryStorageAdapter();
      },
    },
  ],
  exports: [OTP_PROVIDER, TELEPHONY_PROVIDER, WHATSAPP_PROVIDER, KYC_PROVIDER, PAN_PROVIDER, PUSH_PROVIDER, SCAN_PROVIDER, STORAGE_PROVIDER],
})
export class ProvidersModule {}

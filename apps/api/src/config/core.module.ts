import { Global, Module } from '@nestjs/common';

import { CryptoService } from '../common/crypto/crypto.service';

import { ENV, type Env, loadEnv } from './env';

/** Global providers every module needs: validated env + field crypto. */
@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: () => loadEnv() },
    { provide: CryptoService, inject: [ENV], useFactory: (env: Env) => new CryptoService(env.DATA_ENCRYPTION_KEY, env.OTP_PEPPER) },
  ],
  exports: [ENV, CryptoService],
})
export class CoreModule {}

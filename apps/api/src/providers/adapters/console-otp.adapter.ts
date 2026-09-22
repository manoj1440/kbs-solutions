import { maskMobile } from '@kbs/shared';
import { Logger } from '@nestjs/common';

import type { OtpProvider } from '../ports';

/** Dev/test OTP transport: prints the code. Never enabled in production (env validation). */
export class ConsoleOtpAdapter implements OtpProvider {
  readonly name = 'console';
  private readonly logger = new Logger('OTP');
  constructor(private readonly isProduction: boolean) {}
  async send(mobileE164: string, code: string) {
    if (this.isProduction) throw new Error('Console OTP provider is not allowed in production');
    this.logger.warn(`[dev-otp] ${maskMobile(mobileE164)} -> ${code}`);
    return { accepted: true, providerRef: null };
  }
}

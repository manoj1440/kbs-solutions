import { Module } from '@nestjs/common';

import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';

/** F-908 data-principal request queue and self-service data download. */
@Module({ controllers: [PrivacyController], providers: [PrivacyService], exports: [PrivacyService] })
export class PrivacyModule {}

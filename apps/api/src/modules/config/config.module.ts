import { Global, Module } from '@nestjs/common';

import { AppVersionController } from './app-version.controller';
import { ConfigController } from './config.controller';
import { ConfigService } from './config.service';

@Global()
@Module({ controllers: [ConfigController, AppVersionController], providers: [ConfigService], exports: [ConfigService] })
export class ConfigModule {}

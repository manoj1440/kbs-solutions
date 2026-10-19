import type { AppPlatform, AppVersionResponse } from '@kbs/shared';
import { Controller, Get } from '@nestjs/common';

import { Public } from '../../common/decorators';

import { ConfigService } from './config.service';

/** F-819: the mobile app asks this before sign-in, so it is public — versions and a download link only. */
@Controller('app')
export class AppVersionController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get('version')
  version(): AppVersionResponse {
    const policy = (p: AppPlatform) => ({
      minVersion: this.config.getString(`app.${p}.minVersion`),
      latestVersion: this.config.getString(`app.${p}.latestVersion`),
      downloadUrl: this.config.getString(`app.${p}.downloadUrl`),
    });
    return { android: policy('android'), ios: policy('ios') };
  }
}

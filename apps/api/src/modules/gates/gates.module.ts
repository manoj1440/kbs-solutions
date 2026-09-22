import { Global, Module } from '@nestjs/common';

import { GatesService } from './gates.service';

@Global()
@Module({ providers: [GatesService], exports: [GatesService] })
export class GatesModule {}

import { Global, Module } from '@nestjs/common';

import { JobsService } from './jobs.service';
import { OutboxService } from './outbox.service';

@Global()
@Module({ providers: [JobsService, OutboxService], exports: [JobsService, OutboxService] })
export class JobsModule {}

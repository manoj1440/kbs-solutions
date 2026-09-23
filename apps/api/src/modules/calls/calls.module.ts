import { Module } from '@nestjs/common';

import { CallingListModule } from '../calling-list/calling-list.module';

import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { OutcomesService } from './outcomes.service';
import { OversightController } from './oversight.controller';
import { OversightService } from './oversight.service';

@Module({
  imports: [CallingListModule],
  controllers: [CallsController, OversightController],
  providers: [CallsService, OutcomesService, OversightService],
  exports: [CallsService, OutcomesService],
})
export class CallsModule {}

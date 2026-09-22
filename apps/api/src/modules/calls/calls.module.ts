import { Module } from '@nestjs/common';

import { CallingListModule } from '../calling-list/calling-list.module';

import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { OutcomesService } from './outcomes.service';

@Module({
  imports: [CallingListModule],
  controllers: [CallsController],
  providers: [CallsService, OutcomesService],
  exports: [CallsService, OutcomesService],
})
export class CallsModule {}

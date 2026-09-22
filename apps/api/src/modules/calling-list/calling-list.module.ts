import { Module } from '@nestjs/common';

import { PincodeMasterController } from './pincode-master.controller';
import { PincodeMasterService } from './pincode-master.service';
import { SuppressionController } from './suppression.controller';
import { SuppressionService } from './suppression.service';

@Module({
  controllers: [SuppressionController, PincodeMasterController],
  providers: [SuppressionService, PincodeMasterService],
  exports: [SuppressionService, PincodeMasterService],
})
export class CallingListModule {}

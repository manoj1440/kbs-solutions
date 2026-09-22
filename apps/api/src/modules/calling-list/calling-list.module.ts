import { Module } from '@nestjs/common';

import { AllocationService } from './allocation.service';
import { CustomerImportController } from './customer-import.controller';
import { CustomerImportService } from './customer-import.service';
import { PincodeMasterController } from './pincode-master.controller';
import { PincodeMasterService } from './pincode-master.service';
import { SuppressionController } from './suppression.controller';
import { SuppressionService } from './suppression.service';

@Module({
  controllers: [SuppressionController, PincodeMasterController, CustomerImportController],
  providers: [SuppressionService, PincodeMasterService, CustomerImportService, AllocationService],
  exports: [SuppressionService, PincodeMasterService, AllocationService],
})
export class CallingListModule {}

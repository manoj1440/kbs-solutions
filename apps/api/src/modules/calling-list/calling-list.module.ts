import { Module } from '@nestjs/common';

import { AllocationService } from './allocation.service';
import { CallingQueueController } from './calling-queue.controller';
import { CallingQueueService } from './calling-queue.service';
import { CustomerImportController } from './customer-import.controller';
import { CustomerImportService } from './customer-import.service';
import { PincodeMasterController } from './pincode-master.controller';
import { PincodeMasterService } from './pincode-master.service';
import { SuppressionController } from './suppression.controller';
import { SuppressionService } from './suppression.service';

@Module({
  controllers: [SuppressionController, PincodeMasterController, CustomerImportController, CallingQueueController],
  providers: [SuppressionService, PincodeMasterService, CustomerImportService, AllocationService, CallingQueueService],
  exports: [SuppressionService, PincodeMasterService, AllocationService, CallingQueueService],
})
export class CallingListModule {}

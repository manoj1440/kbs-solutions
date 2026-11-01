import { Module } from '@nestjs/common';

import { AllocationService } from './allocation.service';
import { CallingQueueController } from './calling-queue.controller';
import { CallingQueueService } from './calling-queue.service';
import { CustomerImportController } from './customer-import.controller';
import { CustomerImportService } from './customer-import.service';
import { InterestsController } from './interests.controller';
import { InterestsService } from './interests.service';
import { PincodeMasterController } from './pincode-master.controller';
import { PincodeMasterService } from './pincode-master.service';
import { SuppressionController } from './suppression.controller';
import { SuppressionService } from './suppression.service';
import { TeamOpsController } from './team-ops.controller';
import { TeamOpsService } from './team-ops.service';

@Module({
  controllers: [SuppressionController, PincodeMasterController, CustomerImportController, CallingQueueController, TeamOpsController, InterestsController],
  providers: [SuppressionService, PincodeMasterService, CustomerImportService, AllocationService, CallingQueueService, TeamOpsService, InterestsService],
  exports: [SuppressionService, PincodeMasterService, AllocationService, CallingQueueService, TeamOpsService, InterestsService],
})
export class CallingListModule {}

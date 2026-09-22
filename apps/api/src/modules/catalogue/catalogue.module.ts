import { Module } from '@nestjs/common';

import { CallingListModule } from '../calling-list/calling-list.module';

import { CardAvailabilityController } from './card-availability.controller';
import { CardAvailabilityService } from './card-availability.service';
import { CatalogueController } from './catalogue.controller';
import { CatalogueService } from './catalogue.service';
import { PincodeProfileController } from './pincode-profile.controller';
import { PincodeProfileService } from './pincode-profile.service';

@Module({
  imports: [CallingListModule],
  controllers: [CatalogueController, PincodeProfileController, CardAvailabilityController],
  providers: [CatalogueService, PincodeProfileService, CardAvailabilityService],
  exports: [CatalogueService, PincodeProfileService, CardAvailabilityService],
})
export class CatalogueModule {}

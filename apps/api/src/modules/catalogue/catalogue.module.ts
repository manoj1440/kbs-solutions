import { Module } from '@nestjs/common';

import { CatalogueController } from './catalogue.controller';
import { CatalogueService } from './catalogue.service';
import { PincodeProfileController } from './pincode-profile.controller';
import { PincodeProfileService } from './pincode-profile.service';

@Module({
  controllers: [CatalogueController, PincodeProfileController],
  providers: [CatalogueService, PincodeProfileService],
  exports: [CatalogueService, PincodeProfileService],
})
export class CatalogueModule {}

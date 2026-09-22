import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';

import { Audited, Idempotent, RequirePermission } from '../../common/decorators';

import { PincodeMasterService } from './pincode-master.service';

const ImportBody = z.object({ fileId: z.string().uuid() });

@Controller('pincodes')
export class PincodeMasterController {
  constructor(private readonly svc: PincodeMasterService) {}

  @Get(':pincode')
  @RequirePermission('CATALOGUE_READ', 'CUSTOMER_LIST_IMPORT')
  lookup(@Param('pincode') pincode: string) {
    return this.svc.lookup(pincode);
  }

  @Post('import')
  @RequirePermission('PINCODE_MASTER_IMPORT')
  @Idempotent()
  @Audited({ action: 'pincodeMaster.import', entityType: 'StoredFile' })
  import(@Body() raw: unknown) {
    return this.svc.import(ImportBody.parse(raw).fileId);
  }
}

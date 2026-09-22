import { ConfirmCustomerBatchBody, CreateCustomerBatchBody, CustomerHeaderMapping, PaginationQuery, ReviewRecordBody } from '@kbs/shared';
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, RequirePermission } from '../../common/decorators';

import { AllocationService } from './allocation.service';
import { CustomerImportService } from './customer-import.service';

const RowsQuery = PaginationQuery.extend({ reviewStatus: z.enum(['ACCEPTED', 'NEEDS_REVIEW', 'EXCLUDED']).optional() });

/** F-303 import wizard + review queue; F-305 explicit allocation run. */
@Controller('calling-list')
export class CustomerImportController {
  constructor(
    private readonly svc: CustomerImportService,
    private readonly allocation: AllocationService,
  ) {}

  @Get('batches')
  @RequirePermission('CUSTOMER_LIST_IMPORT')
  list(@Query() raw: unknown) {
    const q = PaginationQuery.parse(raw);
    return this.svc.list(q.page, q.pageSize);
  }

  @Post('batches')
  @RequirePermission('CUSTOMER_LIST_IMPORT')
  @Idempotent()
  @Audited({ action: 'customerBatch.create', entityType: 'CustomerImportBatch', entityIdFrom: 'id' })
  create(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.svc.create(actor, CreateCustomerBatchBody.parse(raw));
  }

  @Get('batches/:id')
  @RequirePermission('CUSTOMER_LIST_IMPORT')
  async get(@Param('id') id: string) {
    const batch = await this.svc.get(id);
    return { ...batch, allocation: batch.status === 'IMPORTED' ? await this.allocation.batchTotals(id) : null };
  }

  @Put('batches/:id/mapping')
  @RequirePermission('CUSTOMER_LIST_IMPORT')
  @Audited({ action: 'customerBatch.mapping', entityType: 'CustomerImportBatch', entityIdFrom: 'id' })
  setMapping(@Param('id') id: string, @Body() raw: unknown) {
    return this.svc.setMapping(id, CustomerHeaderMapping.parse(raw));
  }

  @Post('batches/:id/confirm')
  @RequirePermission('CUSTOMER_LIST_IMPORT')
  @Idempotent()
  @Audited({ action: 'customerBatch.confirm', entityType: 'CustomerImportBatch', entityIdFrom: 'id' })
  confirm(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.confirm(actor, id, ConfirmCustomerBatchBody.parse(raw ?? {}));
  }

  @Get('batches/:id/rows')
  @RequirePermission('CUSTOMER_REVIEW_QUEUE')
  rows(@Param('id') id: string, @Query() raw: unknown) {
    const q = RowsQuery.parse(raw);
    return this.svc.rows(id, q.reviewStatus, q.page, q.pageSize);
  }

  @Post('batches/:id/allocate')
  @RequirePermission('ALLOCATION_RUN')
  @Idempotent()
  @Audited({ action: 'allocation.run', entityType: 'CustomerImportBatch', entityIdFrom: 'batchId' })
  allocate(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.allocation.run(actor, id);
  }

  @Post('records/:id/review')
  @RequirePermission('CUSTOMER_REVIEW_QUEUE')
  @Idempotent()
  @Audited({ action: 'customerRecord.review', entityType: 'CallingRecord', entityIdFrom: 'id' })
  review(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.svc.review(actor, id, ReviewRecordBody.parse(raw));
  }
}

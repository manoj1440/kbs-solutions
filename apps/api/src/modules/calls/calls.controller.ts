import { InitiateCallBody, RecordOutcomeBody, RemarkBody } from '@kbs/shared';
import { Body, Controller, Get, Headers, HttpCode, Param, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Idempotent, Public, RequireGates, RequirePermission } from '../../common/decorators';

import { CallsService } from './calls.service';
import { OutcomesService } from './outcomes.service';

/** F-309 calls + F-310 outcomes/remarks. */
@Controller()
export class CallsController {
  constructor(
    private readonly calls: CallsService,
    private readonly outcomes: OutcomesService,
  ) {}

  @Post('calls')
  @RequirePermission('CALL_INITIATE')
  @RequireGates('training', 'network')
  @Idempotent()
  @Audited({ action: 'call.initiate', entityType: 'CallAttempt', entityIdFrom: 'id' })
  initiate(@CurrentActor() actor: Actor, @Body() raw: unknown, @Req() req: Request) {
    return this.calls.initiate(actor, InitiateCallBody.parse(raw).callingRecordId, req.header('idempotency-key') as string);
  }

  @Get('calls/:id')
  @RequirePermission('CALL_INITIATE', 'CALLING_RECORDS_READ_TEAM', 'CALLING_RECORDS_READ_ALL')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.calls.get(actor, id);
  }

  @Get('calls/:id/recording-url')
  @RequirePermission('RECORDING_PLAY')
  @Audited({ action: 'recording.play', entityType: 'CallAttempt' })
  recordingUrl(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.calls.recordingUrl(actor, id);
  }

  @Get('calling/records/:id/calls')
  @RequirePermission('CALLING_QUEUE_OWN', 'CALLING_RECORDS_READ_TEAM', 'CALLING_RECORDS_READ_ALL')
  callsForRecord(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.calls.listForRecord(actor, id);
  }

  /** Provider callback. Signature verification lives in the adapter's parseWebhook. */
  @Public()
  @Post('webhooks/telephony/:provider')
  @HttpCode(200)
  webhook(@Param('provider') provider: string, @Headers() headers: Record<string, string | string[] | undefined>, @Body() body: unknown) {
    return this.calls.applyWebhook(provider, headers, body);
  }

  @Post('calling/records/:id/outcomes')
  @RequirePermission('CALL_OUTCOME_RECORD')
  @RequireGates('training', 'network')
  @Idempotent()
  @Audited({ action: 'call.outcome', entityType: 'CallOutcome', entityIdFrom: 'id' })
  outcome(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.outcomes.record(actor, id, RecordOutcomeBody.parse(raw));
  }

  @Get('calling/records/:id/remarks')
  @RequirePermission('CALLING_QUEUE_OWN', 'CALLING_RECORDS_READ_TEAM', 'CALLING_RECORDS_READ_ALL')
  remarks(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.outcomes.listRemarks(actor, id);
  }

  @Post('calling/records/:id/remarks')
  @RequirePermission('CALL_OUTCOME_RECORD', 'CALLING_RECORDS_READ_TEAM', 'CALLING_RECORDS_READ_ALL')
  @Idempotent()
  @Audited({ action: 'remark.add', entityType: 'OperationalRemark', entityIdFrom: 'id' })
  addRemark(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.outcomes.addRemark(actor, id, RemarkBody.parse(raw));
  }

  @Put('remarks/:id')
  @RequirePermission('CALL_OUTCOME_RECORD', 'CALLING_RECORDS_READ_TEAM', 'CALLING_RECORDS_READ_ALL')
  @Audited({ action: 'remark.edit', entityType: 'OperationalRemark', entityIdFrom: 'id' })
  editRemark(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() raw: unknown) {
    return this.outcomes.editRemark(actor, id, RemarkBody.parse(raw));
  }
}

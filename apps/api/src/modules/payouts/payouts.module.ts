import { Module } from '@nestjs/common';

import { PayoutRulesController } from './payout-rules.controller';
import { PayoutRulesService } from './payout-rules.service';

/** Slice 5: payout rules (F-601), entitlement evaluation (F-602), ledger/requests (F-603+). */
@Module({ controllers: [PayoutRulesController], providers: [PayoutRulesService], exports: [PayoutRulesService] })
export class PayoutsModule {}

import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';

import { PayoutEligibilityService } from './eligibility.service';
import { EntitlementsController } from './entitlements.controller';
import { PayoutRulesController } from './payout-rules.controller';
import { PayoutRulesService } from './payout-rules.service';

/** Slice 5: payout rules (F-601), entitlement evaluation (F-602), ledger/requests (F-603+). */
@Module({ imports: [UsersModule], controllers: [PayoutRulesController, EntitlementsController], providers: [PayoutRulesService, PayoutEligibilityService], exports: [PayoutRulesService, PayoutEligibilityService] })
export class PayoutsModule {}

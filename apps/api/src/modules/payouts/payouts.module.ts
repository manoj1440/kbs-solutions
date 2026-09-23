import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';

import { PayoutEligibilityService } from './eligibility.service';
import { EntitlementsController } from './entitlements.controller';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PayoutRequestsController } from './payout-requests.controller';
import { PayoutRequestsService } from './payout-requests.service';
import { PayoutRulesController } from './payout-rules.controller';
import { PayoutRulesService } from './payout-rules.service';

/** Slice 5: payout rules (F-601), entitlement evaluation (F-602), ledger/requests (F-603/F-604), Accounts payments (F-605). */
@Module({ imports: [UsersModule], controllers: [PayoutRulesController, EntitlementsController, PayoutRequestsController, PaymentsController], providers: [PayoutRulesService, PayoutEligibilityService, PayoutRequestsService, PaymentsService], exports: [PayoutRulesService, PayoutEligibilityService, PayoutRequestsService, PaymentsService] })
export class PayoutsModule {}

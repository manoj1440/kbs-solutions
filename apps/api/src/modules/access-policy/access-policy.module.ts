import { Global, Module } from '@nestjs/common';

import { AccessPolicyController } from './access-policy.controller';
import { AccessPolicyService } from './access-policy.service';

@Global()
@Module({ controllers: [AccessPolicyController], providers: [AccessPolicyService], exports: [AccessPolicyService] })
export class AccessPolicyModule {}

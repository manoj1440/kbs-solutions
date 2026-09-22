import { Module } from '@nestjs/common';

import { CallingListModule } from '../calling-list/calling-list.module';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { UsersModule } from '../users/users.module';

import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { PendingActionsController } from './pending-actions.controller';
import { PendingActionsService } from './pending-actions.service';

@Module({ imports: [CallingListModule, CatalogueModule, UsersModule], controllers: [LeadsController, PendingActionsController], providers: [LeadsService, PendingActionsService], exports: [LeadsService, PendingActionsService] })
export class LeadsModule {}

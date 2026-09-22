import { Module } from '@nestjs/common';

import { CallingListModule } from '../calling-list/calling-list.module';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { UsersModule } from '../users/users.module';

import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({ imports: [CallingListModule, CatalogueModule, UsersModule], controllers: [LeadsController], providers: [LeadsService], exports: [LeadsService] })
export class LeadsModule {}

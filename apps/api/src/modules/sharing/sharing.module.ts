import { Module } from '@nestjs/common';

import { CallingListModule } from '../calling-list/calling-list.module';
import { CatalogueModule } from '../catalogue/catalogue.module';

import { SharingController } from './sharing.controller';
import { SharingService } from './sharing.service';

@Module({ imports: [CallingListModule, CatalogueModule], controllers: [SharingController], providers: [SharingService], exports: [SharingService] })
export class SharingModule {}

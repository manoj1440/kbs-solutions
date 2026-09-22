import { Global, Module } from '@nestjs/common';

import { IdCardsController } from './id-cards.controller';
import { IdCardsService } from './id-cards.service';

@Global()
@Module({ controllers: [IdCardsController], providers: [IdCardsService], exports: [IdCardsService] })
export class IdCardsModule {}

import { Global, Module } from '@nestjs/common';

import { HierarchyService } from './hierarchy.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Global()
@Module({ controllers: [UsersController], providers: [UsersService, HierarchyService], exports: [UsersService, HierarchyService] })
export class UsersModule {}

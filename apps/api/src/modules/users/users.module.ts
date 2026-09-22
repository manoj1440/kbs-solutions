import { Global, Module } from '@nestjs/common';

import { AgentCodesController } from './agent-codes.controller';
import { AgentCodesService } from './agent-codes.service';
import { HierarchyService } from './hierarchy.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Global()
@Module({ controllers: [UsersController, AgentCodesController], providers: [UsersService, HierarchyService, AgentCodesService], exports: [UsersService, HierarchyService, AgentCodesService] })
export class UsersModule {}

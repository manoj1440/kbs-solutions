import type { Permission } from '@kbs/shared';
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { Actor } from '../actor';
import { IS_PUBLIC, PERMISSION_KEY } from '../decorators';
import { AppError } from '../errors/app-error';

/**
 * F-102: a route must declare permissions (or be @Public); the actor needs at least one of them.
 * Undecorated protected routes are refused — the "every route declares a permission" rule.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSION_KEY, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest<{ actor?: Actor; route?: { path?: string } }>();
    const actor = req.actor;
    if (!actor) throw new AppError('AUTH_REQUIRED', 'Please log in.');
    // Routes on the auth controller (me/logout) are self-service and need no permission.
    const selfService = ctx.getClass().name === 'AuthController';
    if (!required || required.length === 0) {
      if (selfService) return true;
      throw new AppError('RBAC_FORBIDDEN', 'This route has no permission declared.');
    }
    if (!required.some((p) => actor.permissions.includes(p))) throw new AppError('RBAC_FORBIDDEN', 'You do not have access to this action.');
    return true;
  }
}

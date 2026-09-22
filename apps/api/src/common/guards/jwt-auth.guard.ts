import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ACCESS_COOKIE } from '../../modules/auth/auth.controller';
import { AuthService } from '../../modules/auth/auth.service';
import { TokenService } from '../../modules/auth/token.service';
import type { Actor } from '../actor';
import { IS_PUBLIC } from '../decorators';
import { AppError } from '../errors/app-error';
import { RequestContextStore } from '../request-context';

/** Authenticates via Bearer token (mobile) or httpOnly cookie (web) and attaches `req.actor`. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest<Request & { actor?: Actor }>();
    const header = req.header('authorization');
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const cookie = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
    const token = bearer ?? cookie;
    if (!token) throw new AppError('AUTH_REQUIRED', 'Please log in.', undefined, 'LOGIN_AGAIN');
    let claims;
    try {
      claims = this.tokens.verifyAccess(token);
    } catch {
      throw new AppError('AUTH_INVALID_TOKEN', 'Your session has expired.', undefined, 'LOGIN_AGAIN');
    }
    const actor = await this.auth.buildActor(claims.sub, claims.sid);
    if (actor.status === 'DEACTIVATED' || actor.status === 'BLOCKED') {
      throw new AppError('AUTH_ACCOUNT_DEACTIVATED', 'This account is not active.', undefined, actor.role === 'TELECALLER' ? 'CONTACT_MANAGER' : 'CONTACT_ADMIN');
    }
    req.actor = actor;
    RequestContextStore.setActor(actor);
    return true;
  }
}

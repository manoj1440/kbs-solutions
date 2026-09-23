import { DeviceIntegrityBody, OtpRequestBody, OtpVerifyBody, RefreshBody } from '@kbs/shared';
import { Body, Controller, Get, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

import type { Actor } from '../../common/actor';
import { Audited, CurrentActor, Public } from '../../common/decorators';
import { AppError } from '../../common/errors/app-error';
import { RequestContextStore } from '../../common/request-context';
import { ENV, type Env } from '../../config/env';

import { AuthService } from './auth.service';

export const ACCESS_COOKIE = 'kbs_access';
export const REFRESH_COOKIE = 'kbs_refresh';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Post('otp/request')
  requestOtp(@Body() raw: unknown) {
    return this.auth.requestOtp(OtpRequestBody.parse(raw), RequestContextStore.get()?.ip ?? '0.0.0.0');
  }

  @Public()
  @Post('otp/verify')
  async verify(@Body() raw: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const body = OtpVerifyBody.parse(raw);
    const result = await this.auth.verifyOtp(body, RequestContextStore.get()?.ip ?? '0.0.0.0', req.header('user-agent'));
    if (body.platform === 'WEB') {
      this.setCookies(res, result.accessToken, result.refreshToken, result.accessExpiresInSec);
      const { accessToken: _a, refreshToken: _r, ...rest } = result;
      return rest;
    }
    return result;
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() raw: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const body = RefreshBody.parse(raw ?? {});
    const cookieToken = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    const token = body.refreshToken ?? cookieToken;
    if (!token) throw new AppError('AUTH_INVALID_TOKEN', 'No refresh token.', undefined, 'LOGIN_AGAIN');
    const result = await this.auth.refresh(token, RequestContextStore.get()?.ip ?? '0.0.0.0');
    if (cookieToken && !body.refreshToken) {
      this.setCookies(res, result.accessToken, result.refreshToken, result.accessExpiresInSec);
      const { accessToken: _a, refreshToken: _r, ...rest } = result;
      return rest;
    }
    return result;
  }

  @Post('logout')
  async logout(@CurrentActor() actor: Actor, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(actor.sessionId, false, actor.userId);
    this.clearCookies(res);
    return { ok: true };
  }

  @Post('logout-all')
  async logoutAll(@CurrentActor() actor: Actor, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(actor.sessionId, true, actor.userId);
    this.clearCookies(res);
    return { ok: true };
  }

  /** F-302: the app reports root / compromised-device detection once per session; audited, Admin alerted if rooted. */
  @Post('device-integrity')
  @Audited({ action: 'security.deviceIntegrity', entityType: 'Session' })
  deviceIntegrity(@CurrentActor() actor: Actor, @Body() raw: unknown) {
    return this.auth.reportDeviceIntegrity(actor, DeviceIntegrityBody.parse(raw));
  }

  @Get('me')
  me(@CurrentActor() actor: Actor) {
    return this.auth.me(actor, RequestContextStore.get()?.ip ?? '0.0.0.0');
  }

  private setCookies(res: Response, access: string, refresh: string, accessSec: number) {
    const secure = this.env.NODE_ENV === 'production';
    const days = 30;
    res.cookie(ACCESS_COOKIE, access, { httpOnly: true, secure, sameSite: 'lax', maxAge: accessSec * 1000, path: '/' });
    res.cookie(REFRESH_COOKIE, refresh, { httpOnly: true, secure, sameSite: 'lax', maxAge: days * 86_400_000, path: '/api/v1/auth' });
  }
  private clearCookies(res: Response) {
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
  }
}

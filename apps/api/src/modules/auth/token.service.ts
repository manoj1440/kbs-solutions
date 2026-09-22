import type { Role } from '@kbs/shared';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { ENV, type Env } from '../../config/env';

export interface AccessClaims {
  sub: string;
  sid: string;
  role: Role;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  signAccess(claims: AccessClaims, minutes: number): string {
    return this.jwt.sign(claims, { secret: this.env.JWT_ACCESS_SECRET, expiresIn: `${minutes}m`, issuer: 'kbs-api', audience: 'kbs' });
  }

  verifyAccess(token: string): AccessClaims {
    return this.jwt.verify<AccessClaims>(token, { secret: this.env.JWT_ACCESS_SECRET, issuer: 'kbs-api', audience: 'kbs' });
  }
}

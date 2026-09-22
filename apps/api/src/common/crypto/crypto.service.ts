import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';

/** AES-256-GCM field encryption for PAN / bank account numbers; SHA-256 helpers for OTP/token hashing. */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;
  constructor(base64Key: string, private readonly pepper: string) {
    this.key = Buffer.from(base64Key, 'base64');
    if (this.key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must decode to 32 bytes');
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1.${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
  }

  decrypt(payload: string): string {
    const [v, ivB, tagB, encB] = payload.split('.');
    if (v !== 'v1' || !ivB || !tagB || !encB) throw new Error('bad ciphertext');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivB, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(encB, 'base64')), decipher.final()]).toString('utf8');
  }

  /** Peppered SHA-256 for OTP codes (never stored in plaintext, REQ-04 §4.1). */
  hashOtp(code: string, challengeId: string): string {
    return createHmac('sha256', this.pepper).update(`${challengeId}:${code}`).digest('hex');
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  }

  randomOtp(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  randomToken(bytes = 48): string {
    return randomBytes(bytes).toString('base64url');
  }
}

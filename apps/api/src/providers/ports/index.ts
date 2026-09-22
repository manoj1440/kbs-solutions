/**
 * ADR-009: every external capability is a port with explicit "confirmed" semantics (INV-10).
 * There is deliberately NO bank-status port; see REQ-28 §28.1.
 */

export const OTP_PROVIDER = Symbol('OTP_PROVIDER');
export interface OtpProvider {
  readonly name: string;
  send(mobileE164: string, code: string): Promise<{ accepted: boolean; providerRef: string | null }>;
}

export const TELEPHONY_PROVIDER = Symbol('TELEPHONY_PROVIDER');
export type TelephonyEventType = 'RINGING' | 'CONNECTED' | 'ENDED' | 'FAILED' | 'NO_ANSWER' | 'RECORDING_AVAILABLE' | 'RECORDING_FAILED';
export interface TelephonyEvent {
  providerCallId: string;
  type: TelephonyEventType;
  at: Date;
  durationSec?: number;
  recordingRef?: string;
  reason?: string;
}
export interface TelephonyProvider {
  readonly name: string;
  initiateCall(input: { fromUserId: string; toMobileE164: string; callbackUrl: string }): Promise<{ providerCallId: string; state: 'REQUESTED' | 'FAILED'; reason?: string }>;
  parseWebhook(headers: Record<string, string | string[] | undefined>, body: unknown): TelephonyEvent[];
}

export const WHATSAPP_PROVIDER = Symbol('WHATSAPP_PROVIDER');
export interface WhatsAppProvider {
  readonly name: string;
  readonly mode: 'HANDOFF' | 'BUSINESS_API';
  /** HANDOFF: returns a deep link the client opens; delivery is unknown. BUSINESS_API: sends and returns a message id. */
  prepare(input: { toMobileE164: string; text: string; mediaUrl?: string }): Promise<{ handoffUrl?: string; providerMessageId?: string; confirmedSent: boolean }>;
}

export const KYC_PROVIDER = Symbol('KYC_PROVIDER');
export interface KycProvider {
  readonly name: string;
  readonly method: string; // e.g. 'UIDAI_OFFLINE_EKYC' — documented lawful route
  start(input: { userId: string; consentAt: Date }): Promise<{ sessionRef: string; instructions: string }>;
  /** Returns only a verification outcome; implementations must never surface an Aadhaar number. */
  complete(input: { sessionRef: string; payload: unknown }): Promise<{ status: 'VERIFIED' | 'FAILED' | 'UNAVAILABLE'; providerRef: string; evidenceSummary: Record<string, unknown> }>;
}

export const PAN_PROVIDER = Symbol('PAN_PROVIDER');
export interface PanVerificationProvider {
  readonly name: string;
  verify(input: { pan: string; name?: string }): Promise<{ status: 'VERIFIED' | 'MISMATCH' | 'FAILED' | 'UNAVAILABLE'; providerRef: string | null }>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
export interface StorageProvider {
  readonly name: string;
  put(input: { bucket: string; key: string; body: Buffer; contentType: string }): Promise<void>;
  get(input: { bucket: string; key: string }): Promise<Buffer>;
  presignGet(input: { bucket: string; key: string; expiresInSec: number; fileName?: string }): Promise<string>;
}

export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');
export interface PushProvider {
  readonly name: string;
  send(input: { token: string; title: string; body: string; data?: Record<string, string> }): Promise<{ accepted: boolean }>;
}

export const SCAN_PROVIDER = Symbol('SCAN_PROVIDER');
export interface ScanProvider {
  readonly name: string;
  scan(input: { body: Buffer }): Promise<{ status: 'CLEAN' | 'INFECTED' | 'SKIPPED'; detail?: string }>;
}

import { DEFAULT_BLANK_TOKENS, isBlankBankValue, misStatusField, type StatusField } from './display';
import { Provenance } from './enums';
import { maskMobile } from './mask';

/**
 * F-506 — status display DTO shaping (REQ-14 §14.2–§14.5, REQ-20 §20.2–20.4).
 * Pure functions so the same rules serve the API, web and mobile and can be snapshot-tested.
 * There is deliberately no "progress"/"timeline" concept here (REQ-14 §14.1, VIEW-02).
 */

/** Bank reason / remark fields in display order, with the bank's own column names (HDFC) as labels (REQ-14 §14.5). */
export const BANK_REMARK_FIELDS = [
  { field: 'dropoffReason', label: 'DROPOFF_REASON' },
  { field: 'declineCode', label: 'DECLINE_CODE' },
  { field: 'declineDescription', label: 'DECLINE_DESCRIPTION' },
  { field: 'declineDescription2', label: 'Decline Descreption' },
  { field: 'declineType', label: 'Decline Type' },
  { field: 'reason', label: 'Reason' },
] as const;

/** Bank / KYC information fields (REQ-14 §14.5) shown in the detailed section, never editable. */
export const BANK_KYC_FIELDS = [
  { field: 'curableFlag', label: 'CURABLE_FLAG' },
  { field: 'kycStatus', label: 'KYC Status' },
  { field: 'vkycStatus', label: 'VKYC_STATUS' },
  { field: 'bkycStatus', label: 'BKYC Status' },
  { field: 'kycSuccessNr', label: 'KYC Success/NR' },
  { field: 'idcomStatus', label: 'IDCOM_STATUS' },
  { field: 'ipaStatus', label: 'IPA_STATUS' },
  { field: 'dapFinalFlag', label: 'DAP_FINAL_FLAG' },
  { field: 'vkycConsentDate', label: 'VKYC_CONSENT_DATE' },
  { field: 'vkycExpiryDate', label: 'VKYC_EXPIRY_DATE' },
] as const;

export const REMARKS_PREVIEW_MAX = 60;

export type BankCreationDateSource = 'CREATION_DATE_TIME' | 'Creation Date';

/** Minimal snapshot shape the shaping functions need (a subset of BankStatusSnapshot). */
export interface SnapshotLike {
  applicationNo?: string | null;
  applicationReferenceNumber?: string | null;
  currentStage?: string | null;
  finalDecision?: string | null;
  cardActivationStatus?: string | null;
  productCode?: string | null;
  bankCreationDateTime?: Date | string | null;
  bankCreationDate?: Date | string | null;
  lastMatchedAt?: Date | string | null;
  lastMatchedBatchRef?: string | null;
  [remarkField: string]: unknown;
}

export interface LeadStatusRowInput {
  id: string;
  publicRef: string;
  customerFullName: string;
  customerMobile: string | null;
  bank: { id: string; displayName: string };
  card: { id: string; name: string };
  createdAt: Date | string;
  snapshot: SnapshotLike | null;
  /** Reviewed product-code crosswalk for this bank, when the snapshot carries a product code (REQ-14 §14.2 row 2). */
  crosswalkedCard?: { id: string; name: string } | null;
  bankReference: { kind: string; value: string; status: string } | null;
  possibleCollision?: boolean;
  blankTokens?: readonly string[];
}

/** Authorised next actions for a row — real actions only, never "move to next stage" (REQ-14 §14.2 row 13). */
export type LeadAction = 'OPEN_DETAILS' | 'ENTER_BANK_REFERENCE' | 'SHARE_APPLICATION_LINK';

export interface LeadStatusRow {
  id: string;
  kbsRef: string;
  customer: { name: string; mobileMasked: string | null };
  bank: { id: string; displayName: string };
  card: { id: string; name: string; crosswalked: { id: string; name: string; productCode: string } | null };
  bankApplicationNo: string | null;
  bankApplicationReference: string | null;
  leadCreatedAt: string;
  bankCreationDate: { value: string | null; source: BankCreationDateSource | null; provenance: Provenance };
  stage: StatusField;
  decision: StatusField;
  activation: StatusField;
  remarksPreview: string | null;
  lastMatchedAt: string | null;
  matched: boolean;
  bankReference: { kind: string; value: string; status: string } | null;
  possibleCollision: boolean;
  actions: LeadAction[];
}

const iso = (d: Date | string | null | undefined): string | null => (d == null ? null : typeof d === 'string' ? d : d.toISOString());

/** First non-blank grouped reason field, truncated (REQ-14 §14.2 row 10). Returns null when nothing is reported. */
export function remarksPreview(snapshot: SnapshotLike | null, blankTokens: readonly string[] = DEFAULT_BLANK_TOKENS, max = REMARKS_PREVIEW_MAX): string | null {
  if (!snapshot) return null;
  for (const { field, label } of BANK_REMARK_FIELDS) {
    const v = snapshot[field];
    if (typeof v === 'string' && !isBlankBankValue(v, blankTokens)) {
      const t = v.trim();
      return `${label}: ${t.length > max ? `${t.slice(0, max - 1)}…` : t}`;
    }
  }
  return null;
}

/** All grouped remark and KYC fields with their verbatim values (blank → null), for the detail view (REQ-14 §14.5). */
export function bankRemarkFields(snapshot: SnapshotLike | null, blankTokens: readonly string[] = DEFAULT_BLANK_TOKENS) {
  const pick = (defs: readonly { field: string; label: string }[]) =>
    defs.map(({ field, label }) => {
      const v = snapshot?.[field];
      const raw = v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : null;
      return { field, label, raw, display: snapshot ? (raw !== null && !isBlankBankValue(raw, blankTokens) ? raw.trim() : 'Not reported') : 'Awaiting MIS Update' };
    });
  return { remarks: pick(BANK_REMARK_FIELDS), kyc: pick(BANK_KYC_FIELDS) };
}

/** Shapes one lead into the §14.2 row. Stage, decision and activation are independent fields (REQ-14 §14.1, §14.4). */
export function buildLeadStatusRow(i: LeadStatusRowInput): LeadStatusRow {
  const s = i.snapshot;
  const matched = s !== null && s !== undefined;
  const tokens = i.blankTokens ?? DEFAULT_BLANK_TOKENS;
  const asOf = matched ? iso(s.lastMatchedAt) : null;
  const batchRef = matched ? (s.lastMatchedBatchRef ?? null) : null;
  const creationDateTime = matched ? iso(s.bankCreationDateTime) : null;
  const creationDate = matched ? iso(s.bankCreationDate) : null;
  const productCode = matched && typeof s.productCode === 'string' && !isBlankBankValue(s.productCode, tokens) ? s.productCode.trim() : null;
  const actions: LeadAction[] = ['OPEN_DETAILS'];
  if (!i.bankReference || i.bankReference.status !== 'VERIFIED_BY_MIS_MATCH') actions.push('ENTER_BANK_REFERENCE');
  actions.push('SHARE_APPLICATION_LINK');
  return {
    id: i.id,
    kbsRef: i.publicRef,
    customer: { name: i.customerFullName, mobileMasked: i.customerMobile ? maskMobile(i.customerMobile) : null },
    bank: i.bank,
    card: { id: i.card.id, name: i.card.name, crosswalked: productCode && i.crosswalkedCard ? { ...i.crosswalkedCard, productCode } : null },
    bankApplicationNo: matched && typeof s.applicationNo === 'string' && !isBlankBankValue(s.applicationNo, tokens) ? s.applicationNo : null,
    bankApplicationReference: matched && typeof s.applicationReferenceNumber === 'string' && !isBlankBankValue(s.applicationReferenceNumber, tokens) ? s.applicationReferenceNumber : null,
    leadCreatedAt: iso(i.createdAt) as string,
    bankCreationDate: { value: creationDateTime ?? creationDate, source: creationDateTime ? 'CREATION_DATE_TIME' : creationDate ? 'Creation Date' : null, provenance: Provenance.BANK_MIS },
    stage: misStatusField(matched ? s.currentStage : null, matched, asOf, batchRef, tokens),
    decision: misStatusField(matched ? s.finalDecision : null, matched, asOf, batchRef, tokens),
    activation: misStatusField(matched ? s.cardActivationStatus : null, matched, asOf, batchRef, tokens),
    remarksPreview: remarksPreview(s ?? null, tokens),
    lastMatchedAt: asOf,
    matched,
    bankReference: i.bankReference,
    possibleCollision: i.possibleCollision ?? false,
    actions,
  };
}

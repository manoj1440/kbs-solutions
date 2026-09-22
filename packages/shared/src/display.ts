import { Provenance } from './enums';

/** Tokens a bank may put in a cell that mean "no value" (REQ-13 §13.6; configurable via mis.blankValueTokens). */
export const DEFAULT_BLANK_TOKENS = ['', '#N/A', 'N/A', 'NA', '-', '#REF!', 'NULL'] as const;

export const AWAITING_MIS_UPDATE = 'Awaiting MIS Update';
export const NOT_REPORTED = 'Not reported';

export function isBlankBankValue(
  raw: string | null | undefined,
  blankTokens: readonly string[] = DEFAULT_BLANK_TOKENS,
): boolean {
  if (raw === null || raw === undefined) return true;
  const t = raw.trim();
  return blankTokens.some((b) => b.toUpperCase() === t.toUpperCase());
}

/**
 * The single display rule for bank-reported values (INV-02, REQ-13 §13.6, REQ-14).
 * - never matched to any accepted MIS row → 'Awaiting MIS Update'
 * - matched but the cell is blank / #N/A → 'Not reported'
 * - otherwise the exact raw text
 */
export function bankValueDisplay(
  raw: string | null | undefined,
  matched: boolean,
  blankTokens: readonly string[] = DEFAULT_BLANK_TOKENS,
): string {
  if (!matched) return AWAITING_MIS_UPDATE;
  if (isBlankBankValue(raw, blankTokens)) return NOT_REPORTED;
  return (raw as string).trim();
}

/** A status-bearing field with provenance; every API DTO that shows a status uses this shape. */
export interface StatusField {
  /** Normalised value (raw trimmed) or null when unknown. */
  value: string | null;
  /** Exact source text, untouched. */
  raw: string | null;
  provenance: Provenance;
  /** ISO timestamp of the fact this value reflects (e.g. lastMatchedAt for MIS). */
  asOf: string | null;
  /** Public reference of the source batch when provenance is BANK_MIS. */
  batchRef: string | null;
  /** Human display string computed by bankValueDisplay / operational label. */
  display: string;
}

export function misStatusField(
  raw: string | null | undefined,
  matched: boolean,
  asOf: string | null,
  batchRef: string | null,
  blankTokens: readonly string[] = DEFAULT_BLANK_TOKENS,
): StatusField {
  const blank = isBlankBankValue(raw, blankTokens);
  return {
    value: matched && !blank ? (raw as string).trim() : null,
    raw: raw ?? null,
    provenance: Provenance.BANK_MIS,
    asOf: matched ? asOf : null,
    batchRef: matched ? batchRef : null,
    display: bankValueDisplay(raw, matched, blankTokens),
  };
}

export function operationalStatusField(label: string, asOf: string | null): StatusField {
  return {
    value: label,
    raw: label,
    provenance: Provenance.KBS_OPERATIONAL,
    asOf,
    batchRef: null,
    display: label,
  };
}

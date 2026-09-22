/** Minimal magic-byte content sniffing (REQ-24 §24.4) — extension/declared type is never trusted alone. */
export type SniffedType = 'image/png' | 'image/jpeg' | 'application/pdf' | 'video/mp4' | 'video/webm' | 'application/zip' | 'text/plain' | 'unknown';

export function sniff(buf: Buffer): SniffedType {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buf.length >= 12 && buf.subarray(4, 8).toString('latin1') === 'ftyp') return 'video/mp4';
  if (buf.length >= 4 && buf.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'video/webm';
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)) return 'application/zip'; // xlsx/docx are zips
  const sample = buf.subarray(0, Math.min(buf.length, 4096));
  let printable = 0;
  for (const b of sample) if (b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127) || b >= 128) printable++;
  if (sample.length > 0 && printable / sample.length > 0.95) return 'text/plain';
  return 'unknown';
}

/** Allowed sniffed types per purpose. */
export const ALLOWED_BY_PURPOSE: Record<string, SniffedType[]> = {
  CUSTOMER_LIST: ['application/zip', 'text/plain'],
  BANK_PINCODE: ['application/zip', 'text/plain'],
  PINCODE_MASTER: ['text/plain', 'application/zip'],
  MIS: ['application/zip', 'text/plain'],
  DND_LIST: ['text/plain', 'application/zip'],
  TRAINING_VIDEO: ['video/mp4', 'video/webm'],
  CARD_IMAGE: ['image/png', 'image/jpeg'],
  BENEFIT_PDF: ['application/pdf'],
  CHEQUE: ['image/png', 'image/jpeg', 'application/pdf'],
  PAYMENT_PROOF: ['image/png', 'image/jpeg', 'application/pdf'],
  ID_CARD: ['image/png', 'application/pdf'],
  RECORDING: ['unknown', 'video/mp4', 'video/webm'],
};

/** Canonical content type stored for a purpose + sniffed type (spreadsheets keep the declared xlsx/csv type when consistent). */
export function canonicalContentType(sniffed: SniffedType, declared: string): string {
  if (sniffed === 'application/zip' && /spreadsheetml|xlsx/.test(declared)) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (sniffed === 'text/plain' && /csv/.test(declared)) return 'text/csv';
  if (sniffed === 'unknown') return declared || 'application/octet-stream';
  return sniffed;
}

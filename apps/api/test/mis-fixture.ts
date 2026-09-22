import ExcelJS from 'exceljs';

/** The 36 HDFC MIS headers exactly as written in the PRD sample (incl. misspellings). */
export const HDFC_HEADERS = ['Application No', 'LC2_CODE', 'CURRENT_STAGE', 'APPLICATION_REFERENCE_NUMBER', 'CREATION_DATE_TIME', 'CUSTOMER_TYPE', 'CUSTOMER_NAME', 'CHANNEL', 'IPA_STATUS', 'DAP_FINAL_FLAG', 'DROPOFF_REASON', 'IDCOM_STATUS', 'VKYC_STATUS', 'VKYC_CONSENT_DATE', 'VKYC_EXPIRY_DATE', 'CAPTURE_LINK', 'PROMO_CODE', 'PRODUCT_CODE', 'FINAL_DECISION', 'FINAL_DECISION_DATE', 'DECLINE_CODE', 'DECLINE_DESCRIPTION', 'CURABLE_FLAG', 'COMPANY_NAME', 'BKYC Status', 'Reason', 'KYC Status', 'Decision Month', 'Decline Descreption', 'Decline Type', 'Product Des', 'Secured/Unsecured', 'KYC Success/NR', 'Card Type', 'Creation Date', 'Card Activation Staus'];

export type MisRowInput = Partial<Record<(typeof HDFC_HEADERS)[number], string | number>>;

/** Builds an HDFC-shaped workbook; missing cells are blank. `extraHeaders` are appended (unmapped columns). */
export async function hdfcWorkbook(rows: MisRowInput[], opts: { extraHeaders?: string[]; sheetName?: string } = {}) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(opts.sheetName ?? 'Sheet1');
  const headers = [...HDFC_HEADERS, ...(opts.extraHeaders ?? [])];
  ws.addRow(headers);
  for (const r of rows) ws.addRow(headers.map((h) => (r as Record<string, string | number>)[h] ?? ''));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

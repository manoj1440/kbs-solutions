#!/usr/bin/env node
// F-905: generate a synthetic HDFC MIS workbook (exact 36 headers) for the MIS apply perf run.
//   node apps/api/scripts/perf-gen-mis.mjs [rows=100000] [out=perf/k6/mis-100k.xlsx]
// Synthetic application numbers (PERF-…) and names only — never real customer data.
import ExcelJS from 'exceljs';

const rows = Number(process.argv[2] ?? 100_000);
const out = process.argv[3] ?? new URL('../../../perf/k6/mis-100k.xlsx', import.meta.url).pathname;
const H = ['Application No', 'LC2_CODE', 'CURRENT_STAGE', 'APPLICATION_REFERENCE_NUMBER', 'CREATION_DATE_TIME', 'CUSTOMER_TYPE', 'CUSTOMER_NAME', 'CHANNEL', 'IPA_STATUS', 'DAP_FINAL_FLAG', 'DROPOFF_REASON', 'IDCOM_STATUS', 'VKYC_STATUS', 'VKYC_CONSENT_DATE', 'VKYC_EXPIRY_DATE', 'CAPTURE_LINK', 'PROMO_CODE', 'PRODUCT_CODE', 'FINAL_DECISION', 'FINAL_DECISION_DATE', 'DECLINE_CODE', 'DECLINE_DESCRIPTION', 'CURABLE_FLAG', 'COMPANY_NAME', 'BKYC Status', 'Reason', 'KYC Status', 'Decision Month', 'Decline Descreption', 'Decline Type', 'Product Des', 'Secured/Unsecured', 'KYC Success/NR', 'Card Type', 'Creation Date', 'Card Activation Staus'];
const STAGES = ['Decisioned Cases', 'Document Curing', 'IPA', 'Decisioned Cases and Card setup completed'];
const DEC = ['Approve', 'Decline', '#N/A'];
const ACT = ['V + ACTIVE', 'TXN ACTIVE - Rs 100', 'INACTIVE', '#N/A'];
const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: out });
const ws = wb.addWorksheet('Sheet1');
ws.addRow(H).commit();
for (let i = 0; i < rows; i++) {
  const r = { 'Application No': `PERF${String(i).padStart(9, '0')}`, CURRENT_STAGE: STAGES[i % 4], CUSTOMER_NAME: `Perf Customer ${i}`, FINAL_DECISION: DEC[i % 3], FINAL_DECISION_DATE: '10-09-2026 09:00:00', 'Card Activation Staus': ACT[i % 4], 'Creation Date': '01-09-2026', PRODUCT_CODE: 'MILL' };
  ws.addRow(H.map((h) => r[h] ?? '')).commit();
}
await ws.commit();
await wb.commit();
console.log(`wrote ${rows} rows → ${out}`);

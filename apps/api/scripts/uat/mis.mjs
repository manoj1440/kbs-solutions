// The two bank MIS files of UAT-01 (plan §3.1) and the upload helper. Values are written exactly as a bank would.
import { get, post, upload, xlsx } from './lib.mjs';

export const HEADERS = ['Application No', 'LC2_CODE', 'CURRENT_STAGE', 'APPLICATION_REFERENCE_NUMBER', 'CREATION_DATE_TIME', 'CUSTOMER_TYPE', 'CUSTOMER_NAME', 'CHANNEL', 'IPA_STATUS', 'DAP_FINAL_FLAG', 'DROPOFF_REASON', 'IDCOM_STATUS', 'VKYC_STATUS', 'VKYC_CONSENT_DATE', 'VKYC_EXPIRY_DATE', 'CAPTURE_LINK', 'PROMO_CODE', 'PRODUCT_CODE', 'FINAL_DECISION', 'FINAL_DECISION_DATE', 'DECLINE_CODE', 'DECLINE_DESCRIPTION', 'CURABLE_FLAG', 'COMPANY_NAME', 'BKYC Status', 'Reason', 'KYC Status', 'Decision Month', 'Decline Descreption', 'Decline Type', 'Product Des', 'Secured/Unsecured', 'KYC Success/NR', 'Card Type', 'Creation Date', 'Card Activation Staus'];
const row = (app, name, stage, decision, activation, extra = {}) => ({ 'Application No': app, CUSTOMER_NAME: name, CURRENT_STAGE: stage, FINAL_DECISION: decision, 'Card Activation Staus': activation, ...extra });

export const MIS1 = [
  row('UATA1001', 'Lead One Customer', 'Card Issued', 'Approved', 'V + ACTIVE'),
  row('UATA1002', 'Lead Two Customer', 'Card Issued', 'Approved', 'INACTIVE'),
  row('UATA1003', 'Lead Three Customer', 'Decisioned Cases', 'Declined', '', { DECLINE_CODE: 'D07', DECLINE_DESCRIPTION: 'TEST: bureau score below policy' }),
  row('UATA2001', 'Lead Five Customer', 'Card Issued', 'Approved', 'V + ACTIVE'),
  row('UATA2002', 'Lead Six Customer', 'Card Issued', 'Approved', 'ACTIVATION PENDING'),
  row('UATA2003', 'Lead Seven Customer', 'Document Curing', 'Inprocess', ''),
  row('UATA3001', 'Lead Eight Customer', 'Card Issued', 'Approved', 'V + ACTIVE'),
  row('UATA3002', 'Lead Nine Customer', 'Card Issued', 'Approved', 'V + ACTIVE'),
  row('UATA3003', 'Lead Ten Customer', 'Card Issued', 'Approved', 'V + ACTIVE'),
  row('UATA4001', 'Lead Eleven Customer', 'Card Issued', 'Approved', 'ACTIVE'),
  row('UATA4002', 'Lead Twelve Customer', 'Decisioned Cases', 'Declined', '#N/A'),
  row('UATT1001', 'Kiran Customer', 'Card Issued', 'Approved', 'V + ACTIVE'), // the Telecaller's interested customer
  row('UATX9999', 'Nobody Known', 'Card Issued', 'Approved', 'V + ACTIVE'), // matches nothing
];
export const MIS2 = [
  row('UATA1002', 'Lead Two Customer', 'Card Issued', 'Approved', 'TXN ACTIVE - Rs 100'),
  row('UATA2003', 'Lead Seven Customer', 'Card Issued', 'Approved', 'ACTIVE'),
  row('UATA3003', 'Lead Ten Customer', 'Card Issued', 'Approved', 'INACTIVE'),
];

/** Upload → preview → apply, as the Admin does on the Bank MIS upload page. */
export async function importMis(as, rows, filename, reportDate) {
  const file = await upload('mis', as, await xlsx(HEADERS, rows), filename);
  const batch = await post('/mis/batches', as, { fileId: file.id, ...(reportDate ? { reportDate } : {}) });
  const preview = await post(`/mis/batches/${batch.id}/preview`, as, {});
  const applied = await post(`/mis/batches/${batch.id}/apply`, as, {});
  const detail = await get(`/mis/batches/${batch.id}`, as);
  return { batch, preview, applied, detail };
}

/**
 * Demo-data seeder — drives the real HTTP API (run with: node scripts/demo-seed.mjs).
 * Creates: manager + telecaller + approved advisor, published cards, payout rule,
 * submitted leads with bank references, an applied HDFC MIS batch, a calling list
 * allocation, and pincode master rows. Idempotent-ish: safe to re-run on a fresh DB.
 */
import { execSync } from 'node:child_process';

import ExcelJS from 'exceljs';

// Reset mutable tables + re-run the base seed so this script is re-runnable (dev only).
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://kbs:kbs@localhost:55432/kbs_dev';
try {
  execSync(
    `docker exec kbs-test-pg psql -U kbs -d kbs_dev -c "TRUNCATE TABLE \\"PushDevice\\",\\"PayoutExceptionResolution\\",\\"ExternalPayment\\",\\"PayoutApproval\\",\\"PayoutRequestItem\\",\\"PayoutRequest\\",\\"PayoutEntitlementEvent\\",\\"PayoutEntitlement\\",\\"PayoutRate\\",\\"PayoutRule\\",\\"AuditLog\\",\\"SensitiveAccessLog\\",\\"IdempotencyRecord\\",\\"OtpChallenge\\",\\"RefreshToken\\",\\"Session\\",\\"NetworkAccessEvent\\",\\"WfhException\\",\\"OfficeNetwork\\",\\"TrainingReactivation\\",\\"TrainingAttempt\\",\\"TrainingModuleResult\\",\\"TrainingEnrollment\\",\\"AllocationEvent\\",\\"ShareAction\\",\\"FollowUpTask\\",\\"CallOutcome\\",\\"CallingInterest\\",\\"CallRecording\\",\\"CallAttempt\\",\\"OperationalRemark\\",\\"CallingRecord\\",\\"CustomerImportBatch\\",\\"ContactSuppression\\",\\"PincodeMaster\\",\\"Notification\\",\\"StoredFile\\",\\"BankPincodeRow\\",\\"BankPincodeBatch\\",\\"BankPincodeProfile\\",\\"ApplicationLink\\",\\"ProductCodeCrosswalk\\",\\"CreditCardCategory\\",\\"CardPincodePublication\\",\\"OfficialIdCard\\",\\"ReportingAssignment\\",\\"AgentCode\\",\\"UserLifecycleEvent\\",\\"SystemConfigHistory\\",\\"SystemConfig\\",\\"OutboxEvent\\",\\"BankStatusHistory\\",\\"BankStatusSnapshot\\",\\"MisRow\\",\\"MisImportBatch\\",\\"MisImportProfile\\",\\"BankApplicationLinkage\\",\\"LeadLinkInitiation\\",\\"Lead\\",\\"LeadDraft\\",\\"AdvisorProfile\\",\\"CreditCard\\",\\"User\\" CASCADE"`,
    { stdio: 'ignore' },
  );
  const { seed } = await import('@kbs/db/seed');
  await seed(DB_URL, { ...process.env, BOOTSTRAP_ADMIN_MOBILE: '9999999999', BOOTSTRAP_ADMIN_NAME: 'KBS Owner' });
  console.log('db reset + base seed done');
} catch (e) {
  console.warn('reset failed — continuing anyway:', e.message);
}

const BASE = process.env.API_URL ?? 'http://localhost:4200/api/v1';
const OTP = '000000';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const HDFC_HEADERS = ['Application No', 'LC2_CODE', 'CURRENT_STAGE', 'APPLICATION_REFERENCE_NUMBER', 'CREATION_DATE_TIME', 'CUSTOMER_TYPE', 'CUSTOMER_NAME', 'CHANNEL', 'IPA_STATUS', 'DAP_FINAL_FLAG', 'DROPOFF_REASON', 'IDCOM_STATUS', 'VKYC_STATUS', 'VKYC_CONSENT_DATE', 'VKYC_EXPIRY_DATE', 'CAPTURE_LINK', 'PROMO_CODE', 'PRODUCT_CODE', 'FINAL_DECISION', 'FINAL_DECISION_DATE', 'DECLINE_CODE', 'DECLINE_DESCRIPTION', 'CURABLE_FLAG', 'COMPANY_NAME', 'BKYC Status', 'Reason', 'KYC Status', 'Decision Month', 'Decline Descreption', 'Decline Type', 'Product Des', 'Secured/Unsecured', 'KYC Success/NR', 'Card Type', 'Creation Date', 'Card Activation Staus'];

async function call(method, path, { token, body, file, filename } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  let payload;
  if (file) {
    payload = new FormData();
    payload.append('file', new Blob([file], { type: filename.endsWith('.csv') ? 'text/csv' : XLSX }), filename);
  } else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (method === 'POST' || method === 'PUT') headers['idempotency-key'] = crypto.randomUUID();
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const json = await res.json().catch(() => ({}));
  if (res.status >= 400) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json.error ?? json)}`);
  return json.data;
}

// WEB logins get tokens via httpOnly cookies only; ANDROID returns them in the body — this script uses Bearer.
async function login(mobile, purpose = 'LOGIN', platform = 'ANDROID') {
  const req = await call('POST', '/auth/otp/request', { body: { mobile, purpose } });
  const v = await call('POST', '/auth/otp/verify', { body: { challengeId: req.challengeId, code: OTP, platform } });
  return v;
}

async function xlsx(headers, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow(headers);
  for (const r of rows) ws.addRow(headers.map((h) => r[h] ?? ''));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
const misSheet = (rows) => xlsx(HDFC_HEADERS, rows);

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082', 'hex');

const admin = await login('9999999999');
console.log('admin', admin.user.id, admin.user.role);
const T = admin.accessToken;

// ── lead declarations config (required before lead submit) ──
await call('PUT', '/config/leads.declarations', {
  token: T,
  body: { value: [{ id: 'D1', version: '1', text: 'I confirm the details are accurate.' }, { id: 'D2', version: '1', text: 'I authorise a credit bureau check.' }], reason: 'demo seed' },
});

// ── org: manager + telecaller ──
const mgr = await call('POST', '/users', { token: T, body: { role: 'MANAGER', fullName: 'Demo Manager', mobile: '9876500001' } });
const manager = await login('9876500001');
console.log('manager', mgr.id);

const tc = await call('POST', '/telecallers', { token: manager.accessToken, body: { fullName: 'Demo Telecaller', mobile: '9776500001' } });
console.log('telecaller', tc.id);
const agentCode = (await call('POST', '/agent-codes', { token: T, body: { ownerUserId: mgr.id } })).code;
console.log('agent code', agentCode);

// ── catalogue: two published HDFC cards ──
const banks = await call('GET', '/catalogue/banks', { token: T });
const hdfc = banks.find((b) => b.code === 'HDFC' || /hdfc/i.test(b.displayName ?? b.name ?? '')) ?? banks[0];
const mkCard = async (name, desc, benefits) => {
  const c = await call('POST', '/catalogue/cards', { token: T, body: { bankId: hdfc.id, name, description: desc, benefits, joiningFee: 1000, annualFee: 1000, categoryKeys: ['SHOPPING'] } });
  await call('POST', `/catalogue/cards/${c.id}/links`, { token: T, body: { channel: 'BOTH', url: `https://apply.example.com/${c.id}` } });
  await call('POST', `/catalogue/cards/${c.id}/publish`, { token: T, body: {} });
  return c;
};
const millennia = await mkCard('HDFC Millennia', 'Cashback on everyday spends. Subject to bank approval.', ['5% cashback online']);
const regalia = await mkCard('HDFC Regalia', 'Premium travel card. Subject to bank approval.', ['Lounge access', 'Reward points']);
await call('POST', '/catalogue/crosswalks', { token: T, body: { bankId: hdfc.id, misProductCode: 'MILLENNIA-CC', cardId: millennia.id } });
await call('POST', '/catalogue/crosswalks', { token: T, body: { bankId: hdfc.id, misProductCode: 'REGALIA-CC', cardId: regalia.id } });
console.log('cards published', millennia.id, regalia.id);

// ── payout rule: activation pays ₹1500 ──
const rule = await call('POST', '/payouts/rules', { token: T, body: { bankId: hdfc.id, name: 'HDFC activation payout', triggerValues: ['V + ACTIVE'], holdDays: 0, effectiveFrom: '2026-01-01T00:00:00.000Z', notes: 'demo: activated card' } });
const withRate = await call('POST', `/payouts/rules/${rule.id}/rates`, { token: T, body: { amountInr: 1500, effectiveFrom: '2026-01-01T00:00:00.000Z' } });
const rateId = withRate.rates.find((r) => r.status === 'DRAFT')?.id ?? withRate.rates[0].id;
await call('POST', `/payouts/rates/${rateId}/approve`, { token: T, body: { reason: 'demo agreed' } });
await call('POST', `/payouts/rules/${rule.id}/approve`, { token: T, body: { reason: 'demo signed' } });
console.log('payout rule approved', rule.id);

// ── advisor: full onboarding → admin approval ──
const advSignup = await login('9555999001', 'ADVISOR_SIGNUP', 'ANDROID');
const A = advSignup.accessToken;
await call('PUT', '/onboarding/me/personal', { token: A, body: { fullName: 'Asha Advisor', email: 'asha@example.com' } });
const ob = await call('GET', '/onboarding/me', { token: A });
await call('PUT', '/onboarding/me/consent', { token: A, body: { privacyNoticeVersion: ob.privacyNoticeVersion, identityConsent: true, termsAccepted: true } });
const ident = await call('POST', '/onboarding/me/identity/start', { token: A });
await call('POST', '/onboarding/me/identity/complete', { token: A, body: { sessionRef: ident.identity.sessionRef, payload: 'MOCK_OK' } });
await call('PUT', '/onboarding/me/bank', { token: A, body: { accountHolderName: 'Asha Advisor', accountNumber: '123456789012', ifsc: 'HDFC0001234', bankName: 'HDFC Bank' } });
const cheque = await call('POST', '/files/cheque', { token: A, file: PNG, filename: 'cheque.png' });
await call('PUT', '/onboarding/me/cheque', { token: A, body: { fileId: cheque.id } });
await call('PUT', '/onboarding/me/agent-code', { token: A, body: { code: agentCode } });
await call('POST', '/onboarding/me/submit', { token: A });
await call('POST', `/onboarding/review/${advSignup.user.id}`, { token: T, body: { decision: 'APPROVE' } });
console.log('advisor approved', advSignup.user.id);

// ── leads: three submitted, each carrying a bank application reference ──
const mkLead = async (name, mobile, pan, appNo, arn, cardId) => {
  const d = await call('POST', '/leads/drafts', { token: A, body: { cardId } });
  const id = d.id;
  await call('PATCH', `/leads/drafts/${id}/mobile`, { token: A, body: { mobile } });
  await call('PATCH', `/leads/drafts/${id}/details`, { token: A, body: { fullName: name, email: `${name.split(' ')[0].toLowerCase()}@example.com` } });
  await call('PATCH', `/leads/drafts/${id}/pan`, { token: A, body: { pan } });
  await call('PATCH', `/leads/drafts/${id}/pincode`, { token: A, body: { pincode: '302001', locationConfirmed: true } });
  await call('PATCH', `/leads/drafts/${id}/employment`, { token: A, body: { employmentType: 'SALARIED' } });
  await call('PATCH', `/leads/drafts/${id}/income`, { token: A, body: { annualIncomeItr: 850000 } });
  await call('PATCH', `/leads/drafts/${id}/declarations`, { token: A, body: { acceptedDeclarationIds: ['D1', 'D2'], bureauAcknowledged: true } });
  const lead = await call('POST', `/leads/drafts/${id}/submit`, { token: A });
  if (appNo) await call('POST', `/leads/${lead.id}/bank-reference`, { token: A, body: { referenceKind: 'APPLICATION_NO', referenceValue: appNo } });
  if (arn) await call('POST', `/leads/${lead.id}/bank-reference`, { token: A, body: { referenceKind: 'APPLICATION_REFERENCE_NUMBER', referenceValue: arn } });
  return lead;
};
const l1 = await mkLead('Ramesh Customer', '9811122233', 'ABCPR1234K', 'APP-1001', 'ARN-9001', millennia.id);
const l2 = await mkLead('Sita Prospect', '9811144455', 'BCDPS2345L', 'APP-1002', null, regalia.id);
const l3 = await mkLead('Vikram Singh', '9811155566', 'CDEPV3456M', null, 'ARN-9003', millennia.id);
console.log('leads', l1.id, l2.id, l3.id);

// ── MIS: approve profile, upload workbook, preview, apply ──
const profiles = await call('GET', '/mis/profiles', { token: T });
const profile = profiles.find((p) => p.bankId === hdfc.id || p.bank?.id === hdfc.id) ?? profiles[0];
await call('POST', `/mis/profiles/${profile.id}/approve`, { token: T, body: { reason: 'demo reviewed' } });

const misRows = [
  { 'Application No': 'APP-1001', 'CUSTOMER_NAME': 'Ramesh Customer', 'CURRENT_STAGE': 'Decisioned Cases and Card setup completed', 'FINAL_DECISION': 'Approved', 'FINAL_DECISION_DATE': '2026-09-15', 'PRODUCT_CODE': 'MILLENNIA-CC', 'Card Activation Staus': 'V + ACTIVE', 'KYC Status': 'COMPLETE', 'APPLICATION_REFERENCE_NUMBER': 'ARN-9001' },
  { 'Application No': 'APP-1002', 'CUSTOMER_NAME': 'Sita Prospect', 'CURRENT_STAGE': 'Decisioned Cases', 'FINAL_DECISION': 'Approved', 'FINAL_DECISION_DATE': '2026-09-16', 'PRODUCT_CODE': 'REGALIA-CC', 'Card Activation Staus': '', 'KYC Status': 'COMPLETE' },
  { 'Application No': '', 'CUSTOMER_NAME': 'Vikram Singh', 'CURRENT_STAGE': 'Document Curing', 'FINAL_DECISION': '', 'PRODUCT_CODE': 'MILLENNIA-CC', 'KYC Status': 'PENDING', 'APPLICATION_REFERENCE_NUMBER': 'ARN-9003' },
  { 'Application No': 'APP-9999', 'CUSTOMER_NAME': 'Unknown Person', 'CURRENT_STAGE': 'Decisioned Cases', 'FINAL_DECISION': 'Declined', 'PRODUCT_CODE': 'MILLENNIA-CC', 'DECLINE_CODE': 'D1' },
];
const misFile = await call('POST', '/files/mis', { token: T, file: await misSheet(misRows), filename: 'hdfc-sept-mis.xlsx' });
const batch = await call('POST', '/mis/batches', { token: T, body: { bankId: hdfc.id, profileId: profile.id, fileId: misFile.id } });
const preview = await call('POST', `/mis/batches/${batch.id}/preview`, { token: T });
const applied = await call('POST', `/mis/batches/${batch.id}/apply`, { token: T });
console.log('mis batch applied', batch.id, JSON.stringify({ preview: preview.summary ?? preview, apply: applied.summary ?? applied }).slice(0, 300));

// ── calling list: pincode master + customer import → allocate to telecaller ──
const pinCsv = Buffer.from('Pincode,District,State\n302001,Jaipur,Rajasthan\n110001,Delhi,Delhi\n400001,Mumbai,Maharashtra\n');
const pinFile = await call('POST', '/files/pincode_master', { token: T, file: pinCsv, filename: 'pincodes.csv' });
await call('POST', '/pincodes/import', { token: T, body: { fileId: pinFile.id } });

const custRows = [
  { NAME: 'Ravi Kumar', MOBILE: '9611111111', Pincode: '302001', 'PAN NO': 'AAAPA1111A' },
  { NAME: 'Meena Sharma', MOBILE: '9622222222', Pincode: '110001', 'PAN NO': 'BBBPS2222B' },
  { NAME: 'Arun Verma', MOBILE: '9633333333', Pincode: '400001', 'PAN NO': 'CCCPV3333C' },
  { NAME: 'Priya Nair', MOBILE: '9644444444', Pincode: '302001', 'PAN NO': 'DDDPN4444D' },
];
const custFile = await call('POST', '/files/customer_list', { token: T, file: await xlsx(['NAME', 'MOBILE', 'Pincode', 'PAN NO'], custRows), filename: 'customers.xlsx' });
const cBatch = await call('POST', '/calling-list/batches', { token: T, body: { fileId: custFile.id } });
await call('PUT', `/calling-list/batches/${cBatch.id}/mapping`, { token: T, body: { name: 'NAME', mobile: 'MOBILE', pincode: 'Pincode', pan: 'PAN NO' } });
await call('POST', `/calling-list/batches/${cBatch.id}/confirm`, { token: T, body: { consentRepresentationConfirmed: true, sourceVendor: 'Demo Vendor', permittedUseBasis: 'consented list' } });
// Telecallers only join the allocation pool once ACTIVE with PASSED training (F-305).
execSync(
  `docker exec kbs-test-pg psql -U kbs -d kbs_dev -c "UPDATE \\"TrainingEnrollment\\" SET status='PASSED', \\"passedAt\\"=now(), \\"firstLoginAt\\"=now() WHERE \\"telecallerUserId\\"='${tc.id}'"`,
  { stdio: 'inherit' },
);
// …and give that PASSED enrollment its three passed module results, so progress views are consistent (not 0/0).
execSync(
  `docker exec kbs-test-pg psql -U kbs -d kbs_dev -c "INSERT INTO \\"TrainingModuleResult\\" (id, \\"enrollmentId\\", \\"moduleId\\", status, \\"passedAt\\", \\"bestScorePct\\", \\"videoCompletedAt\\", \\"attemptCount\\", \\"updatedAt\\") SELECT gen_random_uuid()::text, e.id, m.id, 'PASSED', now(), 100, now(), 1, now() FROM \\"TrainingEnrollment\\" e CROSS JOIN \\"TrainingModule\\" m WHERE e.\\"telecallerUserId\\"='${tc.id}' ON CONFLICT (\\"enrollmentId\\", \\"moduleId\\") DO UPDATE SET status='PASSED', \\"passedAt\\"=now(), \\"bestScorePct\\"=100, \\"updatedAt\\"=now()"`,
  { stdio: 'inherit' },
);
const alloc = await call('POST', `/calling-list/batches/${cBatch.id}/allocate`, { token: T });
console.log('calling list allocated', JSON.stringify(alloc).slice(0, 200));

console.log('\nDEMO SEED COMPLETE');
console.log('admin web login: 9999999999 / OTP 000000 → http://localhost:3200');
console.log('advisor mobile login: 9555999001 / OTP 000000');
console.log('manager: 9876500001 · telecaller: 9776500001');

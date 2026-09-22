/**
 * Idempotent seed (F-005). Creates:
 *  - the single Admin from BOOTSTRAP_ADMIN_MOBILE / BOOTSTRAP_ADMIN_NAME (ADR-006)
 *  - SystemConfig defaults (F-104) — never overwrites values an Admin has changed
 *  - card categories (REQ-07 §7.4), banks (REQ-07 §7.2 + HDFC)
 *  - HDFC MIS import profile v1 with all 36 headers (REQ-13 §13.2), DRAFT until Admin approves
 *  - nine bank pincode profiles as DRAFT (REQ-07 §7.2)
 *  - example application links from REQ-07 §7.5 as DRAFT cards (never published by seed)
 *  - NO payout rules (fails closed, REQ-28 §28.2)
 */
import 'dotenv/config';

import { CONFIG_KEYS, makePublicRef, RefPrefix, toE164India } from '@kbs/shared';

import { createPrismaClient } from './client';

const HDFC_FIELD_MAP: Record<string, string> = {
  applicationNo: 'Application No',
  lc2Code: 'LC2_CODE',
  currentStage: 'CURRENT_STAGE',
  applicationReferenceNumber: 'APPLICATION_REFERENCE_NUMBER',
  creationDateTime: 'CREATION_DATE_TIME',
  customerType: 'CUSTOMER_TYPE',
  customerName: 'CUSTOMER_NAME',
  channel: 'CHANNEL',
  ipaStatus: 'IPA_STATUS',
  dapFinalFlag: 'DAP_FINAL_FLAG',
  dropoffReason: 'DROPOFF_REASON',
  idcomStatus: 'IDCOM_STATUS',
  vkycStatus: 'VKYC_STATUS',
  vkycConsentDate: 'VKYC_CONSENT_DATE',
  vkycExpiryDate: 'VKYC_EXPIRY_DATE',
  captureLink: 'CAPTURE_LINK',
  promoCode: 'PROMO_CODE',
  productCode: 'PRODUCT_CODE',
  finalDecision: 'FINAL_DECISION',
  finalDecisionDate: 'FINAL_DECISION_DATE',
  declineCode: 'DECLINE_CODE',
  declineDescription: 'DECLINE_DESCRIPTION',
  curableFlag: 'CURABLE_FLAG',
  companyName: 'COMPANY_NAME',
  bkycStatus: 'BKYC Status',
  reason: 'Reason',
  kycStatus: 'KYC Status',
  decisionMonth: 'Decision Month',
  declineDescription2: 'Decline Descreption', // original misspelling preserved (REQ-13 §13.2 #29)
  declineType: 'Decline Type',
  productDescription: 'Product Des',
  securedUnsecured: 'Secured/Unsecured',
  kycSuccessNr: 'KYC Success/NR',
  cardType: 'Card Type',
  creationDate: 'Creation Date',
  cardActivationStatus: 'Card Activation Staus', // original misspelling preserved (REQ-13 §13.2 #36)
};

const HDFC_KNOWN_VALUES = {
  currentStage: [
    'Decisioned Cases',
    'Decisioned Cases and Card setup completed',
    'Document Curing',
    'In-Complete Application',
    'Pending for Biokyc',
    'System Queue',
  ],
  finalDecision: ['Approve', 'Decline', 'Inprocess'],
  cardActivationStatus: ['INACTIVE', 'V + ACTIVE', 'TXN ACTIVE - Rs 100', '#N/A'],
  kycStatus: ['Expired', 'NR', 'Not Eligible', 'Success'],
  vkycStatus: ['VKYC InComplete', 'vKYC Success'],
  bkycStatus: ['Closed', 'Completed', '#N/A'],
};

const BANKS = [
  ['HDFC', 'HDFC Bank'],
  ['EQUITAS', 'Equitas Small Finance Bank'],
  ['IDFC', 'IDFC FIRST Bank'],
  ['HSBC', 'HSBC Bank'],
  ['INDUSIND', 'IndusInd Bank'],
  ['RBL', 'RBL Bank'],
  ['AU', 'AU Small Finance Bank'],
  ['YES', 'YES Bank'],
  ['AXIS', 'Axis Bank'],
  ['SBI', 'SBI Card'],
] as const;

/** Bank pincode sheet profiles from REQ-07 §7.2 — DRAFT until Admin reviews semantics. */
const PINCODE_PROFILES: Array<{
  bank: string;
  name: string;
  sheetName: string;
  pincodeColumn: string;
  headers: string[];
  semantics: Record<string, unknown>;
}> = [
  {
    bank: 'EQUITAS', name: 'EQUITAS sourcing pincodes v1', sheetName: 'EQUITAS', pincodeColumn: 'SOURCING PINCODE',
    headers: ['CITY', 'DISTRICT', 'STATE', 'REGION', 'SOURCING PINCODE', 'BANK', 'Asset _Branch_Code', 'LIABILITY_BRANCH CODE', 'Remarks'],
    semantics: { rule: 'PRESENT_PINCODE_IS_SOURCEABLE', preserve: ['Asset _Branch_Code', 'LIABILITY_BRANCH CODE', 'Remarks'], note: 'Non-blank Remarks never implies success (REQ-07 §7.2).' },
  },
  {
    bank: 'IDFC', name: 'IDFC pincodes v1', sheetName: 'IDFC BANK', pincodeColumn: 'MASTER_PINCODES_NAME',
    headers: ['EXTERNAL_CODE', 'MASTER_PINCODES_NAME', 'CITY', 'STATE', 'COUNTRY', 'NTB'],
    semantics: { rule: 'REQUIRES_BANK_MAPPING', note: 'Validate that MASTER_PINCODES_NAME is the pincode column before activation.' },
  },
  {
    bank: 'HSBC', name: 'HSBC pincodes v1', sheetName: 'HSBC BANK', pincodeColumn: 'PINCODE',
    headers: ['CARDDELIVERYFLAG', 'CITY', 'COUNTRY', 'DISTRICT', 'FLAG', 'PINCODE', 'PINCODEFLAG', 'STATE', 'STATUS', 'STDCODE'],
    semantics: { rule: 'REQUIRES_BANK_MAPPING', preserve: ['CARDDELIVERYFLAG', 'FLAG', 'PINCODEFLAG', 'STATUS'], note: 'Define bank-specific inclusion rules for delivery/flag/status before any row is sourceable.' },
  },
  {
    bank: 'INDUSIND', name: 'IndusInd pincodes v1', sheetName: 'Indusind bank', pincodeColumn: 'Pincode',
    headers: ['Pincode', 'City', 'State/UT', 'Branch SOL ID', 'Added on'],
    semantics: { rule: 'PRESENT_PINCODE_IS_SOURCEABLE', preserve: ['Branch SOL ID', 'Added on'] },
  },
  {
    bank: 'RBL', name: 'RBL pincodes v1', sheetName: 'rbl bank', pincodeColumn: 'Pincode',
    headers: ['Pincode', 'City', 'City Code', 'City_Unique_Code', 'State', 'State Code', 'State_Unique_Code', 'Region Code', 'Country: Country Name', 'Sourceable', 'Is Online City'],
    semantics: { rule: 'FLAG_EQUALS', column: 'Sourceable', trueValues: ['Y', 'YES', 'TRUE', '1'], preserve: ['Is Online City'], note: 'Sourceable and Is Online City are never equated (REQ-07 §7.2).' },
  },
  {
    bank: 'AU', name: 'AU pincodes v1', sheetName: 'au bank', pincodeColumn: 'CUST_PINCODE',
    headers: ['CUST_PINCODE', 'CUST_STATE'],
    semantics: { rule: 'PRESENT_PINCODE_IS_SOURCEABLE' },
  },
  {
    bank: 'YES', name: 'YES pincodes v1', sheetName: 'yes bank', pincodeColumn: 'PINCODE',
    headers: ['PINCODE', 'District', 'STATE NAME', 'CITY NAME', 'city_code', 'REGION CODE', 'state_short', 'std_code', 'hub_location', 'branch_code', 'ICL/OCL', 'Policy', 'REGION'],
    semantics: { rule: 'REQUIRES_BANK_MAPPING', preserve: ['Policy', 'ICL/OCL'], ignoreEmptyAutoHeaders: true },
  },
  {
    bank: 'AXIS', name: 'Axis pincodes v1', sheetName: 'AXIS BANK', pincodeColumn: 'pincode',
    headers: ['lender_id', 'pincode', 'city', 'state', 'address_type', 'lenderApiVersion', 'pincode_type'],
    semantics: { rule: 'REQUIRES_BANK_MAPPING', preserve: ['pincode_type', 'address_type'] },
  },
  {
    bank: 'SBI', name: 'SBI pincodes v1', sheetName: 'SBI BANK', pincodeColumn: 'pincode',
    headers: ['lender_id', 'pincode', 'city', 'state', 'address_type', 'std', 'source_code', 'lenderApiVersion'],
    semantics: { rule: 'REQUIRES_BANK_MAPPING', preserve: ['source_code'], note: 'source_code meaning must be confirmed before use as a filter.' },
  },
];

const EXAMPLE_LINKS = [
  {
    bank: 'HDFC',
    cardName: 'Popcard partner link (example — assign to real card)',
    url: 'https://balaji-partner-h.getpopcard.co/?utm_source=SRIBALAJI&utm_medium=cardifye&utm_campaign=CADF43_KBS',
  },
  {
    bank: 'AU',
    cardName: 'AU Bank self-onboarding link (example — assign to real card)',
    url: 'https://cconboarding.au.bank.in/auccself/#/?utm_source=MMFNT&utm_medium=banner&utm_campaign=MMFNT-display-campaign-ENT-KBS_50263',
  },
];

export async function seed(databaseUrl: string, env: NodeJS.ProcessEnv = process.env) {
  const prisma = createPrismaClient({ connectionString: databaseUrl, log: ['error'] });
  const summary: string[] = [];
  try {
    // 1. single Admin
    const adminMobileRaw = env.BOOTSTRAP_ADMIN_MOBILE;
    const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!existingAdmin) {
      if (!adminMobileRaw) throw new Error('BOOTSTRAP_ADMIN_MOBILE is required to create the first Admin');
      const admin = await prisma.user.create({
        data: {
          publicRef: makePublicRef(RefPrefix.USER),
          mobile: toE164India(adminMobileRaw),
          role: 'ADMIN',
          status: 'ACTIVE',
          fullName: env.BOOTSTRAP_ADMIN_NAME ?? 'KBS Admin',
          lifecycleEvents: { create: { eventType: 'CREATED', reason: 'bootstrap seed' } },
        },
      });
      summary.push(`admin created ${admin.publicRef}`);
    } else {
      summary.push('admin exists');
    }

    // 2. config defaults (insert-only)
    let configInserted = 0;
    for (const k of CONFIG_KEYS) {
      const res = await prisma.systemConfig.createMany({
        data: [
          {
            key: k.key,
            valueType: k.valueType,
            value: k.defaultValue === null ? undefined : (k.defaultValue as object),
            defaultValue: k.defaultValue === null ? undefined : (k.defaultValue as object),
            description: k.description,
            requiresValueBeforeProd: k.requiresValueBeforeProd,
          },
        ],
        skipDuplicates: true,
      });
      configInserted += res.count;
    }
    summary.push(`config keys inserted ${configInserted}/${CONFIG_KEYS.length}`);

    // 3. categories
    const categories: Array<[string, string]> = [
      ['TRAVEL', 'Travel'],
      ['SHOPPING', 'Shopping'],
      ['PREMIUM', 'Premium / Top'],
      ['FUEL', 'Fuel'],
      ['OTHER', 'Other'],
    ];
    for (const [i, [key, label]] of categories.entries()) {
      await prisma.cardCategory.upsert({ where: { key }, update: {}, create: { key, label, sequence: i } });
    }

    // 4. banks
    const bankIds = new Map<string, string>();
    for (const [code, displayName] of BANKS) {
      const b = await prisma.bank.upsert({ where: { code }, update: {}, create: { code, displayName } });
      bankIds.set(code, b.id);
    }
    summary.push(`banks ${bankIds.size}`);

    // 5. HDFC MIS profile v1 (DRAFT)
    const hdfcId = bankIds.get('HDFC') as string;
    await prisma.misImportProfile.upsert({
      where: { bankId_version: { bankId: hdfcId, version: 1 } },
      update: {},
      create: {
        bankId: hdfcId,
        version: 1,
        name: 'HDFC MIS v1 (36 columns, sample KBS804)',
        sheetSelector: 'Sheet1',
        headerAliases: {},
        fieldMap: HDFC_FIELD_MAP,
        referenceFields: [
          { kind: 'APPLICATION_NO', header: 'Application No' },
          { kind: 'APPLICATION_REFERENCE_NUMBER', header: 'APPLICATION_REFERENCE_NUMBER' },
        ],
        snapshotMode: 'DELTA',
        blankOverwrites: false,
        timezone: 'Asia/Kolkata',
        timezoneAssumed: true,
        dateFormats: ['dd-MM-yyyy HH:mm:ss', 'dd-MM-yyyy', 'dd/MM/yyyy HH:mm:ss', 'dd/MM/yyyy', 'yyyy-MM-dd HH:mm:ss', 'yyyy-MM-dd'],
        knownValues: HDFC_KNOWN_VALUES,
        status: 'DRAFT',
      },
    });
    summary.push('hdfc mis profile v1');

    // 6. pincode profiles (DRAFT)
    for (const p of PINCODE_PROFILES) {
      const bankId = bankIds.get(p.bank) as string;
      await prisma.bankPincodeProfile.upsert({
        where: { bankId_version: { bankId, version: 1 } },
        update: {},
        create: {
          bankId,
          version: 1,
          name: p.name,
          sheetName: p.sheetName,
          headerMapping: Object.fromEntries(p.headers.map((h) => [h, h])),
          pincodeColumn: p.pincodeColumn,
          semantics: p.semantics as object,
          status: 'DRAFT',
        },
      });
    }
    summary.push(`pincode profiles ${PINCODE_PROFILES.length}`);

    // 7. example links as DRAFT cards (never published by seed)
    const admin = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    for (const l of EXAMPLE_LINKS) {
      const bankId = bankIds.get(l.bank) as string;
      const existing = await prisma.creditCard.findFirst({ where: { bankId, name: l.cardName } });
      if (!existing) {
        await prisma.creditCard.create({
          data: {
            bankId,
            name: l.cardName,
            status: 'DRAFT',
            description: 'Seeded placeholder for a user-supplied example partner URL (REQ-07 §7.5). Admin must assign it to a real card/channel.',
            links: { create: { channel: 'BOTH', url: l.url, version: 1, effectiveFrom: new Date(), effectiveTo: new Date(), createdByUserId: admin.id } },
          },
        });
      }
    }
    summary.push('example links seeded as draft');

    // 8. payout rules: intentionally none.
    const rules = await prisma.payoutRule.count();
    summary.push(`payout rules ${rules} (must stay 0 until KBS approves per-bank rules)`);
    return summary;
  } finally {
    await prisma.$disconnect();
  }
}

const isMain = process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js');
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  seed(url)
    .then((s) => {
      for (const line of s) console.warn(`[seed] ${line}`);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

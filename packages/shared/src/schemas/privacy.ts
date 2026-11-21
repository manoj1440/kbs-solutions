import { z } from 'zod';

import { DataRequestStatus, DataRequestType } from '../enums';

/**
 * F-908 data-principal rights (DPDP Act 2023 ss.11-13): a signed-in user files a request, sees its status and downloads
 * their own data; the Admin works the queue by hand. Nothing is ever hard-deleted — an erasure request is carried out by
 * staff within what the law lets KBS delete (payout and tax records are kept).
 */
export const DATA_REQUEST_TYPES = Object.values(DataRequestType) as [DataRequestType, ...DataRequestType[]];
export const DATA_REQUEST_STATUSES = Object.values(DataRequestStatus) as [DataRequestStatus, ...DataRequestStatus[]];

/** Human-readable reference prefix for a data request (Crockford base32 like every other KBS ref). */
export const DATA_REQUEST_REF_PREFIX = 'KBS-DR-';

/** Internal target for closing a request: created + 30 days. A code constant, not config (owner has not set one). */
export const DATA_REQUEST_TARGET_DAYS = 30;

export const DATA_REQUEST_DETAILS_MAX = 2000;

export const DATA_REQUEST_TYPE_LABEL: Record<DataRequestType, string> = {
  ACCESS: 'Copy of my data',
  CORRECTION: 'Correct my data',
  ERASURE: 'Delete my account',
  GRIEVANCE: 'Grievance',
};

export const DATA_REQUEST_STATUS_LABEL: Record<DataRequestStatus, string> = {
  OPEN: 'Received',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  REJECTED: 'Declined',
};

/** Correction and grievance need the user's words; access and erasure may be filed with none. */
export const DataRequestCreateBody = z
  .object({
    type: z.enum(DATA_REQUEST_TYPES),
    details: z.string().trim().max(DATA_REQUEST_DETAILS_MAX, `At most ${DATA_REQUEST_DETAILS_MAX} characters.`).optional(),
  })
  .strict()
  .superRefine((b, ctx) => {
    if ((b.type === 'CORRECTION' || b.type === 'GRIEVANCE') && (b.details ?? '').length < 10) {
      ctx.addIssue({ code: 'custom', path: ['details'], message: 'Tell us what is wrong (at least 10 characters).' });
    }
  });
export type DataRequestCreateBody = z.infer<typeof DataRequestCreateBody>;

export const DataRequestListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(DATA_REQUEST_STATUSES).optional(),
  type: z.enum(DATA_REQUEST_TYPES).optional(),
  /** `open` = OPEN + IN_PROGRESS (the working queue). */
  queue: z.enum(['open', 'closed']).optional(),
});
export type DataRequestListQuery = z.infer<typeof DataRequestListQuery>;

/** Allowed moves: OPEN → IN_PROGRESS → COMPLETED | REJECTED (OPEN may close directly). Closed is final. */
export const DATA_REQUEST_TRANSITIONS: Record<DataRequestStatus, readonly DataRequestStatus[]> = {
  OPEN: ['IN_PROGRESS', 'COMPLETED', 'REJECTED'],
  IN_PROGRESS: ['COMPLETED', 'REJECTED'],
  COMPLETED: [],
  REJECTED: [],
};

export const DataRequestUpdateBody = z
  .object({
    status: z.enum(DATA_REQUEST_STATUSES).optional(),
    /** Shown to the requester. Required (≥ 10 chars) when closing as COMPLETED or REJECTED. */
    resolutionNote: z.string().trim().max(DATA_REQUEST_DETAILS_MAX).optional(),
    /** Staff-only working note; replaces the previous one. */
    staffNote: z.string().trim().max(DATA_REQUEST_DETAILS_MAX).optional(),
    /** Take the request (sets the handler to the caller). */
    assignToMe: z.boolean().optional(),
  })
  .strict()
  .superRefine((b, ctx) => {
    if (b.status === undefined && b.staffNote === undefined && !b.assignToMe) {
      ctx.addIssue({ code: 'custom', message: 'Nothing to change.' });
    }
    if ((b.status === 'COMPLETED' || b.status === 'REJECTED') && (b.resolutionNote ?? '').length < 10) {
      ctx.addIssue({ code: 'custom', path: ['resolutionNote'], message: 'Write what was done or why it was declined (at least 10 characters).' });
    }
  });
export type DataRequestUpdateBody = z.infer<typeof DataRequestUpdateBody>;

/** What the requester sees about their own request (no staff note, no handler identity). */
export interface DataRequestView {
  id: string;
  publicRef: string;
  type: DataRequestType;
  status: DataRequestStatus;
  details: string | null;
  resolutionNote: string | null;
  createdAt: string;
  dueAt: string;
  closedAt: string | null;
  /** KBS operational record, never a bank value (AGENTS.md "provenance everywhere"). */
  provenance: 'KBS_OPERATIONAL';
  asOf: string;
}

/** Admin queue row / detail. */
export interface DataRequestAdminView extends DataRequestView {
  staffNote: string | null;
  overdue: boolean;
  requester: { id: string; publicRef: string; fullName: string; role: string; status: string; mobileMasked: string | null };
  handledBy: { id: string; fullName: string } | null;
}

/**
 * The self-service data download. Masked by construction: PAN and bank account appear as last 4 only, customers on the
 * user's leads appear as the lead reference only (their names, mobiles and PAN are the customers' data, not the user's).
 */
export interface PersonalDataExport {
  format: 'kbs-personal-data/v1';
  generatedAt: string;
  notice: string;
  profile: {
    publicRef: string;
    fullName: string;
    mobileMasked: string | null;
    email: string | null;
    role: string;
    status: string;
    employeeCode: string | null;
    createdAt: string;
    lastLoginAt: string | null;
  };
  payeeProfile: {
    onboardingStep: string;
    identity: { status: string; method: string | null; verifiedAt: string | null };
    bank: { bankName: string | null; ifsc: string | null; accountLast4: string | null; accountHolderName: string | null } | null;
    chequeOnFile: boolean;
    submittedAt: string | null;
    reviewOutcome: string | null;
    consents: { privacyNoticeVersion: string; at: string; scopes: string[] }[];
  } | null;
  reportingHistory: { parentName: string; parentRole: string; from: string; to: string | null }[];
  leads: { publicRef: string; card: string; bank: string; createdAt: string; bankStage: string | null; bankDecision: string | null; cardActivation: string | null; bankAsOf: string | null }[];
  payoutRequests: { publicRef: string; state: string; itemCount: number; amountInr: string | null; submittedAt: string; paidAt: string | null }[];
  sessions: { platform: string; device: string | null; createdAt: string; lastSeenAt: string; active: boolean }[];
  dataRequests: { publicRef: string; type: string; status: string; createdAt: string; closedAt: string | null }[];
}

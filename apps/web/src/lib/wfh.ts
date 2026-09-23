export interface WfhRow {
  id: string;
  telecallerUserId: string;
  startsAt: string;
  endsAt: string | null;
  revokedAt: string | null;
  reason: string;
  telecaller?: { id: string; fullName: string; employeeCode: string | null };
  grantedBy?: { fullName: string; role: string };
}

/** Not revoked and not past its end (may still be scheduled for the future). */
export const wfhOpen = (w: WfhRow, now = Date.now()) =>
  !w.revokedAt && (!w.endsAt || new Date(w.endsAt).getTime() >= now);
/** In effect right now. */
export const wfhActive = (w: WfhRow, now = Date.now()) =>
  wfhOpen(w, now) && new Date(w.startsAt).getTime() <= now;

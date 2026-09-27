# F-808 Admin Calling: one records page + one caller performance page

- Group: Telecaller ops · Status: **IN_PROGRESS** · Depends on: F-303, F-305, F-307, F-313, F-314, F-807
- PRD refs: REQ-06 (calling list import, record states §6.5), REQ-08 (outcomes §8.6, masking §8.3), REQ-15 §15.3 / REQ-16 §16.3 (evidence counts, provider-confirmed "connected")
- Origin: user request (2026-09-27): "Calling — a single page: upload Excel at the top, tiles with clear numbers of what is in the system, then all records in a table (100 per page, paginated, search by status, name, pincode). Another page for caller performance. Make sure we have all the data."

## Audit (before)
Calling had four entry points: Calling lists (batches only, no records), Allocation (distribution cards + a records table limited to active/follow-ups/hidden, max 100, no paging, no pincode/status filter), Calls & delivery (telephony oversight), Telecaller drill-down. There were no system-wide record counts; the Admin records list defaulted to "active", which silently mixed import-review rows in and left closed rows out.

## Record status (one per row, mutually exclusive, sums to total)
Derived in this order: import excluded → needs import review → do not contact (suppressed) → waiting for a caller (accepted, unassigned) → the interaction status of the assigned record.

| Key | Label | Meaning |
|---|---|---|
| `NEEDS_REVIEW` | Needs import review | Row imported with a problem; accept or exclude in its batch |
| `EXCLUDED` | Excluded at import | Excluded with a reason; never called |
| `DO_NOT_CONTACT` | Do not contact | Suppressed (DNC list or customer request) |
| `UNASSIGNED` | Waiting for a caller | Accepted, no Telecaller yet (consent gate or no eligible caller) |
| `UNTOUCHED` | Not yet called | Assigned, no outcome recorded |
| `UNREACHABLE` | Not reachable | Last outcome no answer / failed |
| `FOLLOW_UP` | Follow-up scheduled | Callback booked |
| `INTERESTED` | Interested | Connected, customer interested |
| `LINK_SHARED` | Link / PDF shared | Application link or benefit PDF shared |
| `DECLINED` | Declined | Closed: not interested |
| `COMPLETED` | Completed | Closed: nothing further |

"Converted" is deliberately **not** a label: a calling record never carries a bank result (bank outcomes come only from MIS on Advisor leads, INV-01/INV-05). The furthest KBS-known step is "Link / PDF shared".

## Tiles
Customer records (total, batches) · Waiting for a caller · Not yet called · Called at least once (distinct records with a call attempt; provider-connected underneath) · Outcome recorded (worked) · Interested / link shared · Follow-ups due now · Closed / do not contact · Needs import review.

## Pages
- `/admin/calling-list` **Calling records**: upload (existing mapping wizard; bank of batches needing action), tiles, records table: 100 per page, paging, filters status / name / pincode / caller, reassignment.
- `/admin/calling-list/performance` **Caller performance**: per-caller evidence for a date range (existing F-313 overview + drill-down), caller load and eligibility (distribution), and a Calls & delivery tab (F-314 oversight). `/admin/calling-list/distribution` redirects here.

## API
- `GET /calling/records` gains `status` (keys above) and `pincode` (prefix); `pageSize` stays ≤100.
- `GET /calling/records/summary` (same permissions and scope): counts per status + attempted / connected / follow-ups due / batches needing action.

## Acceptance criteria
- [ ] Sidebar Calling = Calling records, Caller performance; no functionality lost (upload wizard, batch history, reassignment, distribution, oversight, drill-down reachable).
- [ ] Status counts sum to total records; each tile/filter uses the same definition (API e2e).
- [ ] Table: 100 per page, paging, status / name / pincode / caller filters; mobiles masked.
- [ ] typecheck, lint, unit, API e2e (calling-queue), web Playwright green; route sweep.

## Progress notes

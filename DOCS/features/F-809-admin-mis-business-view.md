# F-809 — Admin MIS: business-first records view

**Status:** DONE
**Depends on:** F-501–F-505 (MIS pipeline), F-507 (integrity), F-808 (layout patterns)

## Goal

Make `/admin/mis` a business page like Calling records: cumulative status numbers + the bank-reported applications themselves, one click to import.

## Scope

1. `/admin/mis` = MiniStat tiles (Applications reported · Approved · Declined · In process · Cards active · Not reported) + filters (search, bank, stage, decision, activation) + applications table (Application no · Bank · Customer · Product · Stage · Decision · Activation · Reported; 50/page; newest import first; internal scroll) + `Applications | Uploads` pill (uploads = batch list) + Upload MIS modal.
2. Upload = bank + file only. `CreateMisBatchBody.profileId` optional → bank's latest APPROVED profile. After create, client triggers `/mis/batches/:id/apply` (apply runs match internally; large files queue via F-508 jobs).
3. Remove `/admin/mis/integrity` UI (page, sidebar, header button, smoke entries). `/dashboards/mis-integrity*` API stays (compliance surface, e2e-covered).

## Notes

- Auto-apply is deliberate: apply writes only exact-reference MATCHED rows (INV-08); UNMATCHED/CONFLICT/INVALID rows never write and stay on the batch page for F-504 resolution. Audited as before.
- Tiles show cumulative counts from BankStatusSnapshot; decision/activation buckets matched case-insensitively (bank values are verbatim).

## Acceptance criteria

- [x] Applications table lists every MIS-reported application with status columns; filters work
- [x] Tiles show cumulative business counts
- [x] Upload is one modal: bank + file → imported (auto apply); batch page shows the result
- [x] No integrity page/sidebar entry; deep links handled
- [x] typecheck/lint/build + Playwright clean

## Verification (2026-09-28)
- End-to-end browser upload of a real .xlsx via the modal: batch created (profile auto-resolved, no mapping UI), auto-applied, batch page shows APPLIED with row counts.
- `/admin/mis` renders tiles + applications table at 1440 and 390; uploads behind the `Uploads` pill; no page scroll.
- Filters verified live (`decision=Approved&activation=INACTIVE` → correct subset).
- api e2e: `mis-import`, `mis-apply` (incl. new F-809 test), `mis-jobs` — 12/12 pass. web smoke: 61 pass / 1 skip.
- Leftover: `applicationsSummary` hardcodes the default blank-token list instead of reading `mis.blankValueTokens` config (matches seed defaults; fine).

- User feedback (same day): removed the `Applications | Uploads` pill — the page is now filters + Upload MIS + the applications table only. Batches are reachable via the batch ref link on each row and an amber attention strip when an upload is running/failed.

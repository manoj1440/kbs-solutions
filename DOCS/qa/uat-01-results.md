# UAT-01 — results (2026-11-15, session 28)

Plan and oracle: [uat-01-end-to-end-plan.md](./uat-01-end-to-end-plan.md). Every check: [uat-01-checks.md](./uat-01-checks.md).

## 1. Outcome
**354 checks, 354 passed** on the last clean run (fresh database → every stage → web screens → app screens).
Five product defects were found on the way, fixed, covered by tests, and the whole run repeated from a fresh database.
Finding F-1 was decided by the owner the same day and closed by F-822 (the last 14 checks).

| Stage | Checks |
|---|---|
| S01 Setup · S02 People · S03 Training · S04 Advisor onboarding | 13 · 12 · 16 · 19 |
| S05 Calling list · S06 Calling desk | 16 · 26 |
| S07 Leads · S08 Bank MIS 1 | 24 · 27 |
| S09 Payouts (incl. second MIS, exception + correction) | 61 |
| S10 Roll-up (earnings + performance at every level + leads per Advisor) | 62 |
| S11 Access, sessions, privacy, audit, notifications | 28 |
| S12 Follow-ups, official ID, reporting change | 18 |
| S13 Web screens (Admin, Manager, Accounts — 28 pages) | 28 |
| S14 App screens (2 Advisors, Manager, Telecaller on the release APK) | 4 flows |

Existing suites after the fixes: API unit 76, API e2e 183, web unit 24, mobile unit 17, typecheck + lint on all three — green.

## 2. Who earned what (as the system reports it — equal at every level, to the paisa)
| | Paid | Approved, unpaid | Claimable | Under review |
|---|---|---|---|---|
| Arjun (Advisor, Manager North) | ₹3,000.00 · 2 cards | — | — | — |
| Anita (Advisor, Manager North) | ₹2,500.50 · 2 cards | — | — | — |
| Aman (Advisor, Manager South) | — | ₹1,500.00 · 1 card | 1 card | 1 card |
| Alok (Advisor, under the Admin) | ₹1,000.00 · 1 card | — | — | — |
| **Manager North — team total** | **₹5,500.50** | — | — | — |
| **Manager South — team total** | — | **₹1,500.00** | 1 | 1 |
| **Organisation (Admin)** | **₹6,500.50** · 3 requests · 5 cards | **₹1,500.00** | 1 | 1 |
| Accounts | 3 paid = ₹6,500.50 transferred | 1 awaiting = ₹1,500.00 | | |
| Telecallers (3), Managers' own earning | none | | | |

Checked equal: Advisor's own app ↔ Manager's team table ↔ Admin's Managers / Advisors reports ↔ Admin home ↔ payout
dashboard (also filtered by Manager) ↔ Accounts queues ↔ the payment records in the database.

Performance roll-up checked the same way: calls (Tara 3/2, Tarun 3/3, Tina 2/2 → North 6/5, South 2/2 → organisation 8/7),
talk time, outcomes, shares, customer-list counts, and leads (Arjun 4, Anita 3, Aman 3, Alok 2 → North 7, South 3 →
organisation 12; 11 with a bank result, 9 approved, 2 declined, 7 cards active).

## 3. Findings for the owner (decisions, not defects)
**F-1 is decided (owner, 2026-11-15):** the Manager's share is agreed and settled outside KBS; the product holds no Manager amount. The Manager must see every lead per Advisor with full detail — delivered in [F-822](../features/F-822-manager-leads-per-advisor.md). O-2 to O-4 stay as observations.

| # | Finding | What it means |
|---|---|---|
| **F-1** | **A Manager earns nothing in the product.** Only Advisors have payouts; the requirements give the Manager approval and oversight only (REQ-03, REQ-15, REQ-17). There is no rate, share or ledger for a Manager, and none for a Telecaller (salaried by REQ-03 / INV-05). | If a Manager should receive a share when their Advisor is paid, it has to be specified and built: basis (per card or % of the Advisor's amount), who sets it, who approves, whether Accounts pays it with proof, what happens on a reversal, and whose it is after an Advisor changes Manager (see O-2). |
| O-2 | Team totals follow the Advisor's **current** reporting person. After the Admin moved Alok under Manager South, the ₹1,000.00 he was paid while under the Admin counted in South's team total (S12-14). Each lead still records who he reported to when it was created, and the paid request keeps the Manager who approved it. | Fine for "my team today". For any Manager share it must be decided whether past earnings move with the Advisor. REQ-03 §3.2 lists this as open. |
| O-3 | A Manager's "Advisors" count includes applicants who were rejected or have not finished onboarding (South shows 2: Aman + the rejected applicant). | Cosmetic; say if the count should be active Advisors only. |
| O-4 | The Admin → Managers report totals the rows below it, so an Advisor reporting to the Admin (Alok: 2 leads, ₹1,000.00) is in the organisation totals and the Advisors report, not in any Manager row. | As designed; worth knowing when reading that page. |

## 4. Defects found and fixed in this run
| # | Defect | Fix | Test |
|---|---|---|---|
| B-1 | An upload hung for minutes when the file store was unreachable (the request never returned). | Connection (5 s) and request (60 s) timeouts on the S3 client, 2 attempts. | `s3-storage.adapter.spec.ts` |
| B-2 | Card copy rule (no "guaranteed / instant approval") had two holes: "create and publish" was refused **but left a draft behind**, so each retry from the web form created another card; and forbidden wording could be **edited onto a card that was already offered** with no check. | The wording is checked before anything is written, on create and on edit of a published card. An override recorded through "publish with a reason" stays valid. | `catalogue.e2e-spec.ts` CARD-01, UAT S01-08b/c |
| B-3 | The Manager's Advisors table (web) and the Manager's app screens rounded payout money to whole rupees: ₹2,500.50 showed as **₹2,501**. | Payout amounts always show paise. | UAT S13-M01, app flow `manager-m1` |
| B-5 | On the Advisor's lead screen a paid amount read as that lead's own: two leads paid in one ₹3,000.00 request each showed "₹3,000.00". | It is the request's amount; it now reads "₹3,000.00 for 2 cards" (Advisor and Manager lead screens). | UAT S10-V-08, app flow `manager-m1` |
| B-4 | A follow-up's due time in the lead activity list showed as a raw timestamp (`2026-11-15T09:17:53.665Z`) on web and app. | Formatted as date and time (IST). | `pending-actions.e2e-spec.ts`, UAT S12-02b |

Also noted, not a product defect: the local `apps/api/.env` points the file store at an old LAN address
(`S3_ENDPOINT=http://192.168.0.148:9000`); the machine's address has changed, which is how B-1 showed up. The UAT launch
entry overrides it with `localhost`. Update that line if the everyday dev API should upload files again.

## 5. What this run did not cover
- **Real outside providers.** SMS, calling / recording, Aadhaar and PAN ran on the local stand-ins. The real adapters
  (MSG91, Exotel, Cashfree) are unit-tested only and have never been called live (runbook 08).
- **Time-driven behaviour**: the 72-hour training deadline and Manager reactivation, follow-up-due notices, retention.
  These are covered by the API e2e suite with a controlled clock, not by this run.
- **A physical phone.** The app flows ran on the Android emulator; screen-capture protection and push delivery need a device.
- **Load.** Twelve leads and fifteen customers prove correctness, not capacity (see `DOCS/perf`).
- The web was checked at desktop width only in this run.

## 6. How to repeat
```
pnpm infra:up
bash apps/api/scripts/uat/reset.sh        # fresh kbs_uat
# start the API on :4000 against kbs_uat (api-uat in .claude/launch.json) and the web on :3000
bash apps/api/scripts/uat/run.sh          # all stages + web + app screens; writes DOCS/qa/uat-01-checks.md
```

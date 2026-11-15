# UAT-01 — full end-to-end test on a local stack (dummy data, real API)

Owner request (2026-11-15): one more round of testing, every role, every step from creating to uploading to validating,
individual performance at each hierarchy level and who earned what. Local only. Fix any bug found and re-run everything.

Results: [uat-01-results.md](./uat-01-results.md) · every check: [uat-01-checks.md](./uat-01-checks.md).
Driver: `apps/api/scripts/uat/` — `reset.sh` (fresh database), restart the API (`api-uat` in `.claude/launch.json`), `run.sh`.

## 1. Analysis — what the product does, so we know what to prove

### 1.1 Roles and hierarchy (REQ-03)
```
Admin (company owner)
├── Accounts                      pays approved requests outside KBS, records reference + proof
├── Manager                       creates Telecallers, supervises Advisors who used the Manager's Agent Code
│   ├── Telecaller  (calling agent)   salary; calls assigned customers; no card payout (INV-05)
│   └── Advisor / FOS                 self-registers; creates leads; earns per activated card
└── Advisor / FOS with no Agent Code  reports to the Admin directly
```

### 1.2 Where money comes from (REQ-17, gap-analysis A22)
1. An Advisor's lead carries a bank application reference.
2. The Admin uploads the bank MIS. A row with the same reference sets Stage / Decision / Activation on the lead.
3. When Activation reads as *active* (whole word ACTIVE / ACTIVATED; "INACTIVE", "ACTIVATION PENDING", "YET TO ACTIVATE"
   do not count) the lead becomes one claimable card for that Advisor.
4. The Advisor requests a payout for claimable cards. The cards are reserved by that request.
5. The Advisor's Manager approves, then the Admin approves **and sets the amount** (payouts carry no rate table).
   An Advisor under the Admin needs the designated Manager approver.
6. Accounts transfers the money outside KBS and records paid date, amount, reference and proof. The request is Paid.

### 1.3 Who earns — the answer to "does the Manager get a share?"
| Role | Earns in KBS? | Source |
|---|---|---|
| Advisor / FOS | **Yes** — the amount the Admin approved and Accounts paid, per request | REQ-17 |
| Telecaller | **No** — "Monthly salary, no card-based payout claim"; a Telecaller's lead never creates a payout | REQ-03 §3.1, INV-05 |
| Manager | On Advisors' cards: **no** — settled outside KBS (owner decision, F-822). On leads the Manager creates **themselves: yes**, paid through KBS like an Advisor (owner decision, F-823) | REQ-03, REQ-15, REQ-17; F-822, F-823 |
| Admin, Accounts | No | — |

**Owner decision (2026-11-15): the Manager's share is settled outside KBS; the product only has to show the Manager every
lead per Advisor with full detail (F-822, checks S10-V, S13-M07…M10).**

So "an amount also goes to the Manager under whom the FOS works" **is not a feature of this product today**. What the
hierarchy does carry is *attribution*: an Advisor's leads, activated cards and paid amounts roll up to their Manager's
team totals and to the Admin's organisation totals. This plan proves that roll-up to the paisa and reports the missing
Manager earning as finding F-1 for the owner to decide (rate, basis, who approves, who pays) — it is a money rule and is
not invented here.

### 1.4 What "performance" exists per level
| Level | Figures | Endpoint / screen |
|---|---|---|
| Telecaller | call attempts, connected, outcomes, follow-ups, shares, interested customers and their bank result | `/calling/me/performance`, app "My stats" |
| Manager → Telecallers | the same per Telecaller + team total, training status | `/calling/team/overview`, `/dashboards/manager`, web Manager → Team calling |
| Advisor | leads, bank results, claimable / requested / approved / paid | `/leads/summary`, `/payouts/me/ledger`, app Home + Earnings |
| Manager → Advisors | per Advisor: leads, matched, approved, activated, eligible, available, approved unpaid, paid | `/dashboards/manager/advisors`, web Manager → Advisors |
| Admin | per Manager, per Advisor, per Telecaller, organisation totals | `/dashboards/admin/*`, web Admin home + Reports |
| Accounts | awaiting payment, paid, exceptions | `/payouts/payments/queues`, web Accounts |

## 2. Environment
- Fresh database `kbs_uat` (migrations + baseline seed: one Admin, config defaults, banks, no users, no rules).
- API from source on :4000 (`api-uat` in `.claude/launch.json`), web on :3000, release APK on the Android emulator.
- Postgres, Redis and S3 storage (MinIO) are the real compose services; uploads are real files.
- **Nothing in the API is stubbed.** Every step is an HTTP call a screen makes. The only local stand-ins are the
  outside providers KBS has no account for yet (runbook 08): SMS (code printed to the log; dev master code), calling
  (mock provider that reports ring / connect / end and a recording), identity and PAN (mock provider). Their real
  adapters are unit-tested but have never been called live — out of scope here and stated in the results.
- Test-only shortcuts, each stated in the driver: OTP cooldown rows are cleared between logins; the API request
  throttle is raised for the run.

## 3. Cast and data (all fictitious)
| Key | Role | Reports to | Mobile |
|---|---|---|---|
| admin | Admin | — | 9999999999 |
| acc | Accounts | Admin | 9800000001 |
| m1 | Manager (North) | Admin | 9800000011 |
| m2 | Manager (South) | Admin | 9800000012 |
| t1, t2 | Telecaller | m1 | 9800000021, 22 |
| t3 | Telecaller | m2 | 9800000023 |
| a1, a2 | Advisor | m1 (Agent Code) | 9800000031, 32 |
| a3 | Advisor | m2 (Agent Code) | 9800000033 |
| a4 | Advisor | Admin (no code) | 9800000034 |
| a5 | Advisor — onboarding rejected | — | 9800000035 |

Cards: **Rewards** (all India), **Travel** (pincodes 302001 and 110001 only).
Calling list: 14 rows = 10 valid + 1 duplicate mobile + 1 on the do-not-contact list (both excluded automatically) + 1 bad
mobile + 1 bad pincode (both wait for the Admin's review, then excluded). A second one-row list is imported without the
consent confirmation to prove it is never allocated.

### 3.1 Leads and the two MIS files (the oracle)
| Lead | Advisor | App no. | MIS-1 (Stage / Decision / Activation) | MIS-2 | Claimable card? |
|---|---|---|---|---|---|
| L1 | a1 | UATA1001 | Card Issued / Approved / V + ACTIVE | — | yes, after MIS-1 |
| L2 | a1 | UATA1002 | Card Issued / Approved / INACTIVE | … / TXN ACTIVE - Rs 100 | yes, after MIS-2 |
| L3 | a1 | UATA1003 | Decisioned Cases / Declined / (blank) | — | no |
| L4 | a1 | (none) | not in any file | — | no — stays "Awaiting" |
| L5 | a2 | UATA2001 | Card Issued / Approved / V + ACTIVE | — | yes |
| L6 | a2 | UATA2002 | Card Issued / Approved / ACTIVATION PENDING | — | no (unknown wording) |
| L7 | a2 | UATA2003 | Document Curing / Inprocess / (blank) | Card Issued / Approved / ACTIVE | yes, after MIS-2 |
| L8 | a3 | UATA3001 | Card Issued / Approved / V + ACTIVE | — | yes |
| L9 | a3 | UATA3002 | Card Issued / Approved / V + ACTIVE | — | yes |
| L10 | a3 | UATA3003 | Card Issued / Approved / V + ACTIVE | … / INACTIVE | yes after MIS-1, **under review** after MIS-2 |
| L11 | a4 | UATA4001 | Card Issued / Approved / ACTIVE | — | yes |
| L12 | a4 | UATA4002 | Decisioned Cases / Declined / (blank) | — | no |
| — | t1's interested customer | UATT1001 | Card Issued / Approved / V + ACTIVE | — | **no** — Telecaller, INV-05 |
| — | nobody | UATX9999 | Card Issued / Approved / V + ACTIVE | — | no — unmatched row |

### 3.2 Payout requests and expected money
| Request | Advisor | Cards | Path | Amount set by Admin | End state |
|---|---|---|---|---|---|
| PR1 | a1 | L1, L2 | m1 approves → Admin → Accounts first records ₹2,999 (held as an exception) → corrected entry of ₹3,000 approved by the Admin | ₹3,000.00 | Paid |
| PR2 | a2 | L5 | m1 **rejects** | — | Rejected, L5 claimable again |
| PR3 | a2 | L5, L7 | m1 → Admin → Accounts records payment, proof attached later | ₹2,500.50 (₹1,250.25 per card) | Paid |
| PR4 | a3 | L8 | m2 → Admin, **not paid yet** | ₹1,500.00 | Approved, awaiting payment |
| PR5 | a4 | L11 | designated approver m1 → Admin → Accounts pays | ₹1,000.00 | Paid |

| Whose total | Paid | Approved, unpaid | Claimable, not requested | Under review |
|---|---|---|---|---|
| a1 | 3,000.00 (2 cards) | 0 | 0 | 0 |
| a2 | 2,500.50 (2 cards) | 0 | 0 | 0 |
| a3 | 0 | 1,500.00 (1 card) | 1 card (L9) | 1 card (L10) |
| a4 | 1,000.00 (1 card) | 0 | 0 | 0 |
| **m1 team** (a1 + a2) | **5,500.50** | 0 | 0 | 0 |
| **m2 team** (a3) | 0 | **1,500.00** | 1 | 1 |
| Admin-direct (a4) | 1,000.00 | 0 | 0 | 0 |
| **Organisation** | **6,500.50** (3 requests, 5 cards) | **1,500.00** (1 request) | 1 | 1 |
| Telecallers t1–t3 | none | none | none | none |
| Managers' own earning | none (finding F-1) | | | |

## 4. Test stages (each check has an id in the results)
| Stage | What is done | What is checked |
|---|---|---|
| S01 Setup | Admin: declarations, config, 2 cards (PDF, apply link, availability), pincode master, 3 training modules with video + questions, MIS profile, office network | each object exists and is published; launch-gate list shrinks; a card with no availability is offered nowhere |
| S02 People | Admin creates Accounts + 2 Managers + Agent Codes; Managers create 3 Telecallers | employee codes generated; reporting lines; Manager cannot create a Manager; Telecaller cannot be created by Admin route misuse; duplicate mobile refused |
| S03 Training | t1, t2 complete video + pass 3 modules in order; t3 fails module 1 then passes; out-of-order attempt | sequence enforced, video required, pass mark, status Passed, Manager and Admin see progress; customers only after passing |
| S04 Advisor onboarding | a1–a5 self-register, personal, consent, identity, bank, cheque, Agent Code, submit; Admin approves 4 and rejects 1 | gates before approval (no leads), reporting person from code, blank code → Admin, rejection reason shown, bank details masked |
| S05 Calling list | Admin adds a do-not-contact number, uploads 14 rows, maps headers, confirms consent, allocates | 10 accepted, 4 excluded with the right reason each; equal round-robin; t3 gets a share after passing (rebalance); Telecaller sees only own records; Manager only own team |
| S06 Calling desk | calls through the provider, every outcome type, follow-up with time, decline + do-not-contact, remarks, card list for the pincode, shares (link, PDF, office ID), application number on an interested customer | call states and recording, outcome rules (reason required), hidden-not-deleted, share log, WFH exception vs office network, reassignment keeps history |
| S07 Leads | a1–a4 create 12 leads through all 8 steps; duplicate mobile warning; unavailable card at pincode refused; bank reference entry; link share / open | lead refs, PAN masked + verified, "Awaiting" before MIS, Advisor sees only own leads, Manager only team, drafts resume |
| S08 MIS-1 | Admin uploads MIS-1 (13 rows), previews, applies | matched / unmatched counts, three separate bank fields verbatim, history rows, claimable cards exactly per §3.1, Telecaller interest updated with **no** payout, notifications |
| S09 Payouts | PR1–PR5 as §3.2, plus MIS-2 between them | reservation, double-claim refused, wrong Manager refused, Admin cannot stand in for the Manager, Accounts sees nothing before both approvals, amount split per card, duplicate transfer reference refused, proof required for Paid, rejection releases cards, under-review after reversal, older-dated MIS changes nothing |
| S10 Roll-up | read every ledger and dashboard | §3.2 table to the paisa at Advisor, Manager, Admin and Accounts level; calling totals per Telecaller = Manager team = Admin; lead funnel per Advisor = Manager = Admin |
| S11 Access | every role tries the others' data and actions | 401 without token, 403 across roles and across teams, masked PAN / mobile / account everywhere, sensitive reveals logged, audit trail has each money action with actor |
| S12 Follow-ups, ID, reporting change | lead remarks and follow-up tasks, official ID + public verification, Admin moves the Admin-direct Advisor under Manager South | operational items never touch bank status; what a change of reporting person does to team totals; history kept |
| S15 Manager sells (F-823) | Manager South gives identity + bank details, Admin approves, two own leads, a third bank file, payout request with no Manager step, Admin approves ₹2,000.00, Accounts pays | selling closed until approved while team work stays open; own vs team scope; only own leads earn; no self-approval; Admin-only approval; roll-up counts the Manager's sales with the team |
| S16 / S17 | the same on 9 web pages and 2 app flows | owner named on leads, four-step payout journey, "My sales" and "Back to team" |
| S13 Web screens | Admin, Manager North and Accounts sign in on the web; 24 pages opened on the same data (run before S12) | the figures and names on screen equal the oracle; no other team's data; no full mobile / PAN / account on screen |
| S14 App screens | release APK on the emulator, Maestro flows for two Advisors, Manager North and a Telecaller (run before S12) | earnings, claimable cards, team lists and "no rupee figure for a Telecaller" |

Corrections made to this plan while running it (the product was right, the first expectation was not): Agent Codes are
issued by the Admin only; the consent confirmation gates *allocation*, not import; invalid rows wait for review instead of
being excluded outright; a wrong payment amount is held as an exception and fixed by an audited correction rather than
refused; a Manager can deactivate but only the Admin reactivates; MIS-1 has 13 rows (L4 is deliberately absent).

## 5. Rules for the run
- A check fails → find the cause → if it is a product bug, fix it with a unit / e2e test, then **drop the database and
  run every stage again** (the driver is one command). A wrong expectation in the plan is corrected in the plan with
  the reason written down.
- Existing suites must stay green after any fix: API unit + e2e, web unit, mobile unit.
- Exit: every check passes on one clean run, or is listed as an open finding with its reason.

# F-315 Manager Advisor team drill-down (web + mobile)

- Group: Advisor · Status: **IN_PROGRESS** · Depends on: F-106, F-408, F-506, F-603, F-604, F-702
- PRD refs: REQ-15 §15.1 ("View Advisors assigned through reporting code, their lead/MIS results and payout requests"), REQ-15 §15.3 ("Advisor view drills down to each eligible card/lead, bank result and payout history"; no score/ranking), REQ-25 §25.3 ("Advisor team and lead-MIS details … Mobile may use smaller cards/filters; web may use richer full-width data tables, but authorization and calculation must be consistent"), REQ-14 §14.3 (separate Stage / Decision / Activation), REQ-16 §16.3 (denominators, sources, no mixing)
- QA ids: RBAC-01, DASH-02, VIEW-01
- Origin: session 10 gap analysis. On web the Manager "Team" page lists Advisors as plain rows (name/status/mobile) with no link. On mobile, tapping an Advisor does nothing, and the Manager app has no lead/MIS screen at all. The data APIs (`/leads?advisorId`, `/payouts/requests?advisorId`, `/payouts/entitlements?advisorId`, F-702 metric engine) already exist, but no per-Advisor summary was available to Managers (`/dashboards/admin/advisors` is Admin-only).

## Detailed requirements
1. **API** `GET /dashboards/manager/advisors` (permission `DASHBOARD_MANAGER`; the Admin also holds it and may pass `managerId`). Same `DashboardQuery` filters as F-702 (date range = KBS lead created date, bank, card, `advisorId`). Scope = the F-702 scope (Manager → own team; another team's `advisorId` → 404; Manager passing someone else's `managerId` → 404). One row per Advisor in scope:
   - `user` (id, name, public ref, status, masked mobile), `reporting` (source, Agent Code when the link came from a code, since),
   - `leads` (created, MIS-matched with denominator, awaiting MIS), `stage` / `decision` / `activation` distributions (verbatim bank values, `Not reported`, `Awaiting MIS` — the F-702 engine, not a new calculation),
   - `payouts` buckets from the payout ledger (eligible, available, requested, approved-unpaid, on hold, paid), each with count + amount,
   - `pendingMyApproval` — requests by this Advisor still waiting on the Manager's decision.
   Rows sorted by name. No score, rank or "top performer" field (REQ-15 §15.3).
2. **Web Manager**
   - `/manager/advisors` — table of the rows above (name → drill-down, reporting source/code, leads created, MIS matched `x of y`, activation values, eligible / approved-unpaid / paid with ₹, pending approval). Date + bank filters. Nav item "Advisors". The Team page's Advisor rows link to the drill-down.
   - `/manager/advisors/[id]` — header (name, status, reporting), metric tiles with source labels, Stage / Decision / Activation distributions as three separate lists, bank reasons, the Advisor's leads (existing `LeadsBrowser` with `advisorId`, links to the existing Manager lead detail), payout requests (state, amount, card events, submitted, link to the approval page) and entitlement ledger (lead, card, state, amount).
3. **Mobile Manager** (Expo)
   - New tab "Advisors": list of cards (name, status, leads/matched, eligible/paid, pending my approval) → Advisor screen.
   - Advisor screen: tiles, three separate distributions, recent leads using the existing `LeadRow` (three separate badges), payout requests → existing payout-request screen.
   - Manager lead screen (read-only): customer summary (masked mobile/PAN as the API returns them), Stage / Decision / Activation badges with provenance, bank reason / KYC fields verbatim, MIS update history by batch, KBS activity. No bank-reference entry, link actions or follow-up creation (those are the Advisor's).
   - The Team list opens the Advisor screen for Advisor rows.
   - The new screens show customer data, so all three are added to `PROTECTED_ROUTES` (FLAG_SECURE, F-302).
4. Calculation consistency: web and mobile read the same endpoint; nothing is recomputed on the client (REQ-25 §25.3).

## Acceptance criteria
- [ ] A Manager sees one row per own-team Advisor with lead, MIS and payout figures equal to F-702 for that Advisor (same engine).
- [ ] Another team's Advisor → 404; Telecaller / Advisor / Accounts → 403; the Admin can view any Manager's rows (DASH-02).
- [ ] Stage, decision and activation stay three separate distributions with `Awaiting MIS` / `Not reported` buckets; no ranking field.
- [ ] Web list + drill-down render and link to the lead detail and payout request pages; they fit 390 px.
- [ ] Mobile: Advisors tab → Advisor → lead (read-only) and → payout request; the new routes are protected.

## Progress notes
- Session 10: started.

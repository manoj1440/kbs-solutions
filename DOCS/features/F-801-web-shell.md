# F-801 Web shell: layout, navigation, OTP login, role routing

- Group: UX shells · Status: **IN_PROGRESS** · Depends on: F-003, F-006, F-101, F-111
- PRD refs: REQ-20 §20.1 (shadcn/ui), §20.3 (web components: sidebar, cards, dialogs, command/search, data tables, upload steps, badges, filters, date-range, drill-down, viewers, notification drawer), REQ-25 §25.1 (shared screens), REQ-02 §2.3 (web roles), REQ-23 §23.1
- QA ids: AUTH-01, AUTH-02

## Detailed requirements
1. Routes: `/login` (mobile → OTP → cookies), `/(admin)/*`, `/(manager)/*`, `/(accounts)/*` route groups with server-side role check from `/auth/me` (middleware); `/access-denied` role-aware; `/session-expired`; `/verify/[ref]` public ID-card verification (F-312).
2. App shell: shadcn `Sidebar` with role-specific nav, top bar (search command palette, notification drawer, profile menu with logout), content container with breadcrumb; responsive down to tablet.
3. Base components installed (F-003) plus `DataTable` (TanStack), `DateRangePicker`, `UploadStepper`, `StatCard` with provenance chip, `EmptyState`, `ErrorState`, `ConfirmDialog` (for sensitive irreversible actions).
4. API client with cookie auth, envelope handling, idempotency header injection for mutations, 401 → session-expired redirect.

## Acceptance criteria
- [ ] Admin logs in on web and lands on `/admin`; Advisor login on web → access denied screen.
- [ ] Playwright smoke: login + role redirect + logout.

## Progress notes
- 2026-09-23: Admin web redesign in progress: grouped responsive navigation, workspace search, business overview using existing scoped API summaries, actionable exceptions, payout positions and per-bank MIS freshness. Mobile and backend contracts remain unchanged; full F-703 analytics are separate.
- 2026-09-22 (session 1): Login (OTP, cookies), proxy redirect, role-gated route groups, AppShell sidebar, admin overview (launch gates), config + users tables, access-denied. Pending: shadcn Sidebar/DataTable/date-range/command components, notification drawer, `/verify/[ref]`, Playwright smoke in CI.

# F-904 Data retention and deletion authority (BLOCKED)

- Group: Hardening · Status: **BLOCKED** · Depends on: F-104
- PRD refs: REQ-21 §21.5 (OPEN), REQ-24 §24.4, INV-07

## Scope
Retention jobs for recordings/documents/calling records driven by `retention.*` config; restriction (not deletion) of records under legal hold; never removes MIS/payout audit. Cannot start until KBS sets retention values.

## Progress notes
- Session 8: status stays **BLOCKED** (retention durations are OPEN, REQ-21 §21.5). Building the structure fail-closed: dry-run plan, legal hold, and an execute path that refuses (`CONFIG_MISSING`) until KBS sets `retention.*Days` and turns on `retention.executionEnabled`.

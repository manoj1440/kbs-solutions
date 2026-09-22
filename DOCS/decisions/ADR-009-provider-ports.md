# ADR-009: Provider ports and mock adapters for all external vendors

- Status: Accepted · Date: 2026-09-22 · PRD refs: REQ-02 §2.2, REQ-28 §28.1, INV-10

## Decision
Interfaces in `apps/api/src/providers/ports/`: `OtpProvider`, `TelephonyProvider`, `WhatsAppProvider`, `KycProvider`, `PanVerificationProvider`, `StorageProvider`, `PushProvider`, `ScanProvider`. Selection by env (`OTP_PROVIDER=console|…`). Dev/mock adapters are deterministic and log what a real provider would do. Every adapter returns explicit `confirmed: boolean` on delivery/recording/verification so the UI never claims what the provider did not confirm (INV-10).

No bank-status provider port exists and none may be added (REQ-28 §28.1).

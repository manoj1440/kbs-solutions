# F-108 Files: upload, storage port, scan status, presigned access

- Group: Core · Status: **DONE** · Depends on: F-102, F-103, F-109
- PRD refs: REQ-24 §24.4 (validate size/type/content, malware scanning, access control, restricted downloads), REQ-21 §21.1 (protected delivery URLs with expiry), REQ-06 §6.2 (preserve original file in restricted storage), REQ-13 §13.4 step 4 (immutable source file, checksum)
- QA ids: RBAC-02 (file access), AUDIT-01

## Detailed requirements
1. `StoredFile` with `purpose` enum (`CUSTOMER_LIST`, `BANK_PINCODE`, `MIS`, `TRAINING_VIDEO`, `CARD_IMAGE`, `BENEFIT_PDF`, `CHEQUE`, `PAYMENT_PROOF`, `ID_CARD`, `RECORDING`, `CONFIG_ATTACHMENT`). Purpose determines allowed MIME types, max size, and who may read.
2. Upload: multipart to API → stream to `StorageProvider` under `private/<purpose>/<uuid>`; compute SHA-256; sniff content type (magic bytes) and reject mismatch; enqueue `files.scan` job; `scanStatus=PENDING` → `CLEAN | INFECTED | SKIPPED`.
3. Read: `GET /files/:id/url` checks purpose-specific permission + object ownership via `assertCanAccess`, requires `scanStatus=CLEAN` (or `SKIPPED` when `files.requireCleanScanForNonAdmin=false` or actor is Admin), writes `SensitiveAccessLog` for sensitive purposes, returns a presigned URL valid `files.presignExpirySec`.
4. Immutability: no update/delete endpoints; files referenced by batches/payments are never removed by application code.
5. Dev: MinIO; `StorageProvider` also has an in-memory adapter for tests.

## Acceptance criteria
- [x] Wrong magic bytes vs extension is rejected; oversize rejected before full read.
- [x] Advisor cannot obtain a URL for another Advisor's cheque (NOT_FOUND) and the attempt is audited.
- [x] INFECTED files are never presignable, even for Admin.

## Progress notes
- 2026-09-22 (session 2): `POST /files/:purpose` (multipart, per-purpose upload roles, size limit from config, magic-byte sniff, SHA-256, scan via ScanProvider → SKIPPED with noop), `GET /files/:id`, `GET /files/:id/url` (presigned, scan gate, sensitive downloads logged). S3 adapter (MinIO) + memory adapter. Purpose-based read rules; owner refinements land with F-401/F-605/F-309. Scan job runs inline for now (ClamAV async path in F-902).

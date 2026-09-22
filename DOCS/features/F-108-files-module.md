# F-108 Files: upload, storage port, scan status, presigned access

- Group: Core · Status: **PLANNED** · Depends on: F-102, F-103, F-109
- PRD refs: REQ-24 §24.4 (validate size/type/content, malware scanning, access control, restricted downloads), REQ-21 §21.1 (protected delivery URLs with expiry), REQ-06 §6.2 (preserve original file in restricted storage), REQ-13 §13.4 step 4 (immutable source file, checksum)
- QA ids: RBAC-02 (file access), AUDIT-01

## Detailed requirements
1. `StoredFile` with `purpose` enum (`CUSTOMER_LIST`, `BANK_PINCODE`, `MIS`, `TRAINING_VIDEO`, `CARD_IMAGE`, `BENEFIT_PDF`, `CHEQUE`, `PAYMENT_PROOF`, `ID_CARD`, `RECORDING`, `CONFIG_ATTACHMENT`). Purpose determines allowed MIME types, max size, and who may read.
2. Upload: multipart to API → stream to `StorageProvider` under `private/<purpose>/<uuid>`; compute SHA-256; sniff content type (magic bytes) and reject mismatch; enqueue `files.scan` job; `scanStatus=PENDING` → `CLEAN | INFECTED | SKIPPED`.
3. Read: `GET /files/:id/url` checks purpose-specific permission + object ownership via `assertCanAccess`, requires `scanStatus=CLEAN` (or `SKIPPED` when `files.requireCleanScanForNonAdmin=false` or actor is Admin), writes `SensitiveAccessLog` for sensitive purposes, returns a presigned URL valid `files.presignExpirySec`.
4. Immutability: no update/delete endpoints; files referenced by batches/payments are never removed by application code.
5. Dev: MinIO; `StorageProvider` also has an in-memory adapter for tests.

## Acceptance criteria
- [ ] Wrong magic bytes vs extension is rejected; oversize rejected before full read.
- [ ] Advisor cannot obtain a URL for another Advisor's cheque (NOT_FOUND) and the attempt is audited.
- [ ] INFECTED files are never presignable, even for Admin.

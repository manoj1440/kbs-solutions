# F-304 Pincode master reference and location resolution

- Group: Telecaller ops · Status: **PLANNED** · Depends on: F-108
- PRD refs: REQ-06 §6.1 (resolve city/state from validated pincode/reference data where possible, otherwise 'Location unavailable'), REQ-11 §11.4 (residence pincode with confirmed city/state), REQ-12 S16, gap analysis A4

## Detailed requirements
1. `PincodeMaster` import (Admin, CSV from India Post directory: pincode, office name, district, state) — upsert, versioned by import time; large file processed in job with progress.
2. `GET /pincodes/:pincode` → `{pincode, district, state, offices[], resolved:boolean}` used by import (F-303) and by lead creation (F-406) to pre-fill and let the user confirm city/state.
3. Never used for sourceability — that is F-404.

## Acceptance criteria
- [ ] Unknown pincode → `resolved:false`, UI text "Location unavailable".
- [ ] Import of 150k rows completes within job limits and is idempotent.

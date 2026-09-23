# Maestro mobile flows (F-901)

Critical Android paths from REQ-24 §24.5, run against a dev-client or preview APK connected to a non-production API
with `OTP_DEV_MASTER_CODE=000000`.

```bash
# emulator running, app installed (package com.kbs.dsa), API reachable from the device (adb reverse tcp:4200 tcp:4200)
maestro test apps/mobile/.maestro/                 # all flows
maestro test apps/mobile/.maestro/advisor-login.yaml
```

Flows use the demo users from `apps/api/scripts/demo-seed.mjs` (Advisor 9555999001, Manager 9876500001,
Telecaller 9776500001). They are not part of the blocking CI (no hosted Android emulator is configured); run them
before each APK release (F-906 checklist) and after changes to mobile navigation.

#!/usr/bin/env bash
# F-905: prepare a NON-PRODUCTION database for a perf run.
#   PERF_DATABASE_URL=postgresql://kbs:kbs@localhost:5432/kbs_dev ./perf/prepare.sh
# Clears OTP challenge history (so the 60 s resend cooldown / hourly caps from earlier runs do not block setup logins).
# The API under test must run with THROTTLE_LIMIT_PER_MIN raised (e.g. 100000) and OTP_DEV_MASTER_CODE set.
set -euo pipefail
: "${PERF_DATABASE_URL:?set PERF_DATABASE_URL to the perf database (never production)}"
case "$PERF_DATABASE_URL" in *prod*) echo "refusing: looks like production" >&2; exit 1 ;; esac
psql "$PERF_DATABASE_URL" -qc 'DELETE FROM "OtpChallenge"'
echo "OTP challenges cleared on $(echo "$PERF_DATABASE_URL" | sed -E 's#//[^@]*@#//***@#')"

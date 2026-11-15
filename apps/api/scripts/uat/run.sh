#!/usr/bin/env bash
# UAT-01 driver: runs every stage in order against the API on :4000 (kbs_uat). See DOCS/qa/uat-01-end-to-end-plan.md.
#   bash apps/api/scripts/uat/reset.sh   → fresh database (then restart the API)
#   bash apps/api/scripts/uat/run.sh     → all stages (s01…s11, web screens, app screens, s12, s15 Manager sells, s18 Advisor referral codes, each with its screens);  run.sh s05 s06 → only those
set -uo pipefail
cd "$(dirname "$0")"
stages=("$@"); [ ${#stages[@]} -eq 0 ] && stages=(s01 s02 s03 s04 s05 s06 s07 s08 s09 s10 s11 web app s12 s15 web-sells app-sells s18 web-referrals app-referrals)
curl -sf -m 3 "${UAT_API_URL:-http://localhost:4000/api/v1}/health" >/dev/null || { echo "API is not up on :4000" >&2; exit 1; }
for s in "${stages[@]}"; do
  case "$s" in
    web) (cd ../../../web && node test/uat-screens.mjs) || true; continue ;;   # needs the web app on :3000
    app) node app-screens.mjs || true; continue ;;                              # needs the emulator + the release APK
    web-sells) (cd ../../../web && node test/uat-screens.mjs --sells) || true; continue ;;
    app-sells) node app-screens.mjs --sells || true; continue ;;
    web-referrals) (cd ../../../web && node test/uat-screens.mjs --referrals) || true; continue ;;
    app-referrals) node app-screens.mjs --referrals || true; continue ;;
  esac
  f=$(ls ${s}-*.mjs 2>/dev/null | head -1)
  [ -n "$f" ] || { echo "no stage $s"; continue; }
  node "$f" || { echo "✗ stage $s stopped on an unexpected error" >&2; exit 1; }
done
node report.mjs

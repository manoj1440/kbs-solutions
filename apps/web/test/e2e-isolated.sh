#!/usr/bin/env bash
# Web Playwright e2e against a disposable database — never kbs_dev (the demo DB).
# Mirrors the CI web-e2e job locally: fresh kbs_e2e (migrations + baseline seed), its own api + web, then Playwright.
# The dev stack (:3000/:4000, kbs_dev) keeps running untouched.
#
# Usage (repo root):  bash apps/web/test/e2e-isolated.sh [playwright args…]
#   E2E_SKIP_BUILD=1   reuse the last e2e web build (apps/web/.next-e2e)
#   E2E_KEEP=1         keep kbs_e2e and leave the servers running for debugging (ports below)
# Needs: the kbs-test-pg / kbs-test-redis containers (colima start; docker start kbs-test-pg kbs-test-redis),
#        an api build in apps/api/dist (the dev `nest start --watch` keeps it current; else `pnpm --filter api build`).
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
PG=${E2E_PG_CONTAINER:-kbs-test-pg}
DB=${E2E_DB:-kbs_e2e}
PG_PORT=${E2E_PG_PORT:-55432}
REDIS_URL=${E2E_REDIS_URL:-redis://localhost:56379/3}
API_PORT=${E2E_API_PORT:-4300}
WEB_PORT=${E2E_WEB_PORT:-3300}
DB_URL="postgresql://kbs:kbs@localhost:${PG_PORT}/${DB}"
API="http://localhost:${API_PORT}/api/v1"
WEB="http://localhost:${WEB_PORT}"
LOGS=${E2E_LOG_DIR:-$(mktemp -d -t kbs-e2e)}  # not test-results/: Playwright clears that dir on start

case "$DB" in kbs_dev|kbs_base|kbs_test) echo "refusing to recreate $DB — use a dedicated e2e database" >&2; exit 2 ;; esac

pids=()
cleanup() {
  [ "${E2E_KEEP:-}" = 1 ] && { echo "E2E_KEEP=1: api $API, web $WEB, db $DB left running"; return; }
  for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done
}
trap cleanup EXIT

echo "› fresh database $DB"
docker exec "$PG" psql -U kbs -d postgres -qc "DROP DATABASE IF EXISTS $DB WITH (FORCE)" >/dev/null
docker exec "$PG" psql -U kbs -d postgres -qc "CREATE DATABASE $DB" >/dev/null
(cd "$ROOT" && DATABASE_URL=$DB_URL pnpm --silent --filter @kbs/db migrate:deploy >/dev/null && DATABASE_URL=$DB_URL pnpm --silent db:seed >/dev/null)

[ -f "$ROOT/apps/api/dist/main.js" ] || (cd "$ROOT" && pnpm --filter api build >/dev/null)
echo "› api on :$API_PORT"
(cd "$ROOT/apps/api" && DATABASE_URL=$DB_URL REDIS_URL=$REDIS_URL API_PORT=$API_PORT WEB_ORIGIN=$WEB \
  STORAGE_PROVIDER=memory THROTTLE_LIMIT_PER_MIN=10000 JOBS_INLINE=1 exec node dist/main.js >"$LOGS/e2e-api.log" 2>&1) &
pids+=($!)

export NEXT_DIST_DIR=.next-e2e NEXT_PUBLIC_API_URL=$API API_URL=$API
if [ "${E2E_SKIP_BUILD:-}" != 1 ] || [ ! -d "$ROOT/apps/web/.next-e2e" ]; then
  echo "› web build (.next-e2e)"
  (cd "$ROOT/apps/web" && node_modules/.bin/next build >/dev/null)
fi
echo "› web on :$WEB_PORT"
(cd "$ROOT/apps/web" && exec node_modules/.bin/next start -p "$WEB_PORT" >"$LOGS/e2e-web.log" 2>&1) &
pids+=($!)

for _ in $(seq 1 90); do
  curl -sf "$API/health" >/dev/null && curl -sf -o /dev/null "$WEB/login" && break
  sleep 1
done
curl -sf "$API/health" >/dev/null || { echo "api did not start — see $LOGS/e2e-api.log" >&2; exit 1; }

echo "› playwright (server logs: $LOGS)"
cd "$ROOT/apps/web"
E2E_BASE_URL=$WEB E2E_API_URL=$API E2E_PG_CONTAINER=$PG E2E_PG_DB=$DB npx playwright test "$@"

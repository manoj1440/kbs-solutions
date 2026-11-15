#!/usr/bin/env bash
# UAT-01: fresh kbs_uat database (migrations + baseline seed) and an empty Redis db 9.
# Restart the API afterwards (it caches configuration): the `api-uat` entry in .claude/launch.json, or
#   DATABASE_URL=postgresql://kbs:kbs@localhost:5432/kbs_uat REDIS_URL=redis://localhost:6379/9 \
#   S3_ENDPOINT=http://localhost:9000 THROTTLE_LIMIT_PER_MIN=100000 pnpm --filter api dev
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../../../.." && pwd)
PG=${UAT_PG_CONTAINER:-kbs-postgres-1}
DB=${UAT_DB:-kbs_uat}
case "$DB" in *uat*) ;; *) echo "refusing to recreate $DB" >&2; exit 2 ;; esac
URL="postgresql://kbs:kbs@localhost:${UAT_PG_PORT:-5432}/${DB}"
docker exec "$PG" psql -U kbs -d postgres -qc "DROP DATABASE IF EXISTS $DB WITH (FORCE)" >/dev/null
docker exec "$PG" psql -U kbs -d postgres -qc "CREATE DATABASE $DB" >/dev/null
(cd "$ROOT" && DATABASE_URL=$URL pnpm --silent --filter @kbs/db migrate:deploy >/dev/null \
  && DATABASE_URL=$URL BOOTSTRAP_ADMIN_MOBILE=9999999999 BOOTSTRAP_ADMIN_NAME="KBS Owner" pnpm --silent db:seed >/dev/null)
docker exec "${UAT_REDIS_CONTAINER:-kbs-redis-1}" redis-cli -n 9 flushdb >/dev/null
rm -rf "$(dirname "$0")/.out"
echo "fresh $DB ready — restart the API, then: bash apps/api/scripts/uat/run.sh"

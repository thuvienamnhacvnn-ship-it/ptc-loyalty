#!/bin/sh
# Bring the database schema up to date, then hand over to the Next server.
#
# Runs on every container start. `prisma db push` is idempotent: if the schema
# already matches it does nothing. Startup aborts on failure so a half-migrated
# database can never serve traffic.
set -e

echo "[entrypoint] waiting for the database..."
i=0
until node -e "
const { PrismaClient } = require('@prisma/client');
new PrismaClient().\$queryRaw\`SELECT 1\`.then(() => process.exit(0)).catch(() => process.exit(1));
" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "[entrypoint] database unreachable after 60s — giving up" >&2
    exit 1
  fi
  sleep 2
done
echo "[entrypoint] database is up"

# Schema changes are applied by the one-shot `migrate` service, which runs from
# the build stage where the full Prisma CLI (and its dependency tree) lives.
# Keeping the CLI out of the runtime image is what keeps it small.

echo "[entrypoint] starting: $*"
exec "$@"

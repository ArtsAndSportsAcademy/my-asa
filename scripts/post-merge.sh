#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Apply schema changes non-interactively. `drizzle-kit push` requires a TTY for
# conflict resolution and cannot run here; `migrate` only replays the generated
# SQL in lib/db/drizzle/ and keeps the dev/test DB 1:1 with lib/db/src/schema/.
pnpm --filter @workspace/db run migrate

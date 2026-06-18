#!/bin/bash
set -e
pnpm install --frozen-lockfile
# drizzle-kit push requires TTY for conflict resolution.
# Apply schema changes manually via psql scripts/fix-enums.ts when adding new tables/enums.
echo "post-merge: skipping drizzle push (apply schema changes via psql when needed)"

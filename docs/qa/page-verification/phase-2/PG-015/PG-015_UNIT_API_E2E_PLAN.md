# PG-015 Phase 2.2 Implementation Plan

- Extend `apps/web/test/attendance.test.mjs` for canonical/alias policy and preserve current UTC/timezone cases. No production helper exports are needed.
- Add `apps/api/tests/features/attendance/time-logs-records.test.ts` for direct API/PGlite scenarios. Extend current PG-014 auth and attendance backend guards only at the approved assertion sites. Use real signed synthetic sessions and the injected clock. Reuse seeded relationships and migration-based Prisma fixture. Plan isolated rollback injection confined to its test DB.
- Add `apps/web/e2e/time-logs-records.spec.ts` for mocked-at-HTTP UI checks and use mocked Next rendering compatibility where already established. Gate flaky races by observing requests, releasing gates in finally, and asserting UI tied to the current fetch key. Model response fields from named stored fixtures. Keep 390/820/1440 and keyboard use. Existing-sufficient integration runs in `attendance.spec.ts`, one worker on 5391, keeping all WC-06 and WC-I3 assertions.
- For the two A019 cases, use proposed opt-in `apps/api/tests/features/attendance/time-logs-reconciliation.postgres.ts` and follow D1's explicit local DB identity/migration checks and wait observation. Keep standard test paths offline with PGlite. See [database prerequisites](PG-015_GAPS_AND_DEPENDENCIES.md).
- Record any reproducible shared menu regression, including focused viewport and actual focus/navigation trace. The Phase 2.2 test plan does not authorize a production fix.
- No new Next.js rewrite run is necessary for this page because its endpoints share existing same-origin attendance transport. If separately requested, verify the explicit Next destination and Express receipt with interception disabled only on intended paths, and route to isolated DB.

## Proposed focused execution

These are future commands, subject to separate implementation authorization. Run integration with one worker and a free 5391. Hard-seed deterministic browser/server times separately.

```powershell
pnpm --filter @nexus/web exec node --test test/attendance.test.mjs test/workspace-selection.test.mjs
pnpm --filter @nexus/api exec node scripts/run-tests.mjs tests/features/attendance/backend.test.ts tests/features/attendance/management.test.ts tests/features/attendance/superadmin.test.ts tests/features/attendance/time-logs-overview.test.ts tests/features/attendance/workforce-log-reconciliation.test.ts tests/features/attendance/time-logs-records.test.ts tests/features/leave/leave-requests.test.ts
pnpm --filter @nexus/web exec playwright test e2e/time-logs-records.spec.ts --workers=1 --retries=0
pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts --grep 'grouped attendance|time logs employee table|attendance employee search|department head reviews scoped|WC-06-F02|reactivated employee|WC-I3-F02' --workers=1 --retries=0
pnpm --filter @nexus/web exec playwright test e2e/time-logs-overview.spec.ts e2e/superadmin-attendance.spec.ts --grep 'records links|Superadmin uses existing attendance administration' --workers=1 --retries=0
pnpm --filter @nexus/api exec node scripts/run-tests.mjs tests/features/attendance/time-logs-reconciliation.postgres.ts
pnpm format
pnpm lint
pnpm typecheck
git diff --check
```

Run the PostgreSQL line only with a disposable DB preflight and explicit opt-in identity. Retain the exact commands, disposition, output, pass/fail counts, injected HTTP faults and real paths per case. No discovery test execution took place.

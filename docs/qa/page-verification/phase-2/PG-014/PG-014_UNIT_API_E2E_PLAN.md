# PG-014 Phase 2.2 Unit, API and Browser Plan

This plan requires separate implementation authorization. Discovery executed no tests.

1. Extend `apps/web/test/attendance.test.mjs` at U2 using fixed synthetic role/permissions cases and preserve U1 fake-clock boundary. Keep assertions on production policy outcomes. The inline UI arithmetic has no independent exported helper and is covered at the rendering boundary.
2. Extend `apps/api/tests/features/attendance/management.test.ts` and `superadmin.test.ts` in P1–P3 without changing their baselines. Use fresh per-test PGlite for the new scope-transfer, coverage and boundary fixtures in `apps/api/tests/features/attendance/time-logs-overview.test.ts`. Seed role accounts and issue sessions using existing support; do not rely on global seed or production configuration. For cap seed deterministic valid rows in bounded batches. Give request teardown to the existing harness and avoid shared state with other attendance suites.
3. Implement mocked browser cases in `apps/web/e2e/time-logs-overview.spec.ts`. Use fixed browser time and explicit payloads. Register intercepts before navigation. Use independent gates for loading and stale responses, release them in finally, and verify the response consumed by the current route. Mock refresh/current-account endpoints for auth branches and distinguish abort from HTTP 503. Assert requests by exact pathname/method and query keys, not by racing page load. Use 390, 820 and 1440 CSS px to preserve compatibility.
4. Extend B3 and B4 in `apps/web/e2e/attendance.spec.ts` for the four integration additions. Place department reset before the subsequent suspended-only branch and restore filters. Keep the existing WC-06 assertions and shared state intact. Preserve B1/B2/B5/B6. Keep the 5391 server single-owner and run the fixture with one worker and no competing run. Track server clock and frozen browser date independently.
5. Retain coverage boundaries from the [baseline](PG-014_EXISTING_TEST_BASELINE.md). All 11 integration records use I1. The initial 503 in B3 is synthetic and the recovered/sibling response hits Express/PGlite. A dedicated rewrite case is unnecessary for the current read-only feature because it uses the existing same-origin API client without route-specific Next middleware. If separately required, start an isolated Next instance with `API_PROXY_TARGET` set to an isolated Express origin, disable browser interception for the two paths, assert actual Next origin request URL plus Express receipt and row-specific output, and never route to a shared DB.

## Focused commands for future execution

```powershell
pnpm --filter @nexus/web exec node --test test/attendance.test.mjs test/module-registry.test.mjs test/workspace-modules.test.mjs
pnpm --filter @nexus/api exec node scripts/run-tests.mjs tests/features/attendance/management.test.ts tests/features/attendance/superadmin.test.ts tests/features/attendance/time-logs-overview.test.ts
pnpm --filter @nexus/web exec playwright test e2e/time-logs-overview.spec.ts --workers=1
pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts --grep 'grouped attendance|time log overview|WC-06-F02' --workers=1
pnpm --filter @nexus/web exec playwright test e2e/superadmin-attendance.spec.ts e2e/superadmin-module-access.spec.ts --grep 'Workforce Compliance|Superadmin uses existing attendance administration' --workers=1
pnpm format
pnpm lint
pnpm typecheck
git diff --check
```

Use installed Playwright Chromium, generated Prisma client, repository runner/migration setup and unoccupied loopback ports. Verify script flags against the checked-out runners before execution. Restore only incidental changes introduced by the run. Rerun focused cases after any fixture-level repair and retain per-case status. A004-T003 and A019-T003 stay out of execution until resolved. No PostgreSQL-specific test is proposed for the currently implementable read behavior.

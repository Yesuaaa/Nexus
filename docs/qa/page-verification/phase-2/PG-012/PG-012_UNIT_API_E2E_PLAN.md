# PG-012 Unit, API, and E2E Implementation Plan

**Authorization boundary:** this is a future Phase 2.2 plan. No test file, fixture, database, or test infrastructure was modified or executed during PG-012 Phase 2.1.

## Proposed test files and additions

| File                                                                | Planned Phase 2.2 work                                                                                                                                                                                                                                                                                                                                                                        | Boundary and preservation notes                                                                                                                                                                                                                           |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/test/attendance.test.mjs`                                 | Add explicit Overtime canonical-route role/grant assertions to the existing attendance navigation policy declaration (`A001-T001`).                                                                                                                                                                                                                                                           | Keep all existing loop and PG-004/PG-010/PG-011 route assertions. Do not turn route-policy unit evidence into a claim of browser/API security.                                                                                                            |
| `apps/api/tests/features/attendance/overtime.test.ts`               | Add narrow API/PGlite declarations for Head rejection, verified HR rejection, Superadmin verified-stage decisions, request interval boundary matrix, anonymous/USER detail denial, and detail privacy where no existing assertion is sufficient (`A001-T003`, `A010-T002`, `A011-T002`, `A013-T001`, `A017-T001`, `A018-T002`).                                                               | Reuse `startPgliteApp`; avoid copying existing Head→HR, request-key replay, clock-out, notification, and attendance non-mutation assertions. Keep `type` and status assertions source-specific.                                                           |
| `apps/api/tests/features/attendance/management.test.ts`             | Add list filter/search boundary assertions to the existing stable 10-row pagination coverage (`A004-T002`, `A005-T001`, `A016-T001`) only where they add distinct assertions.                                                                                                                                                                                                                 | Preserve `[PG-004-F001-A002-T009]` and its 10-row order, invalid page and scope assertions. Keep API tests in `apps/api/tests/`, never `src/`.                                                                                                            |
| `apps/api/tests/features/attendance/overtime-notifications.test.ts` | Extend current-authority/handoff assertions only if a PG-012-specific gap remains after baseline reconciliation (`A020-T001` is currently existing-sufficient).                                                                                                                                                                                                                               | Keep replacement, fallback, transfer, rollback and transaction invariants. Do not create duplicate notification tests.                                                                                                                                    |
| `apps/api/tests/features/attendance/overtime-corrections.test.ts`   | Only extend if a missing workday/budget boundary is confirmed not covered by its existing nested scenarios (`A018-T002`).                                                                                                                                                                                                                                                                     | Preserve all nested rollback, split overnight, pending-correction and policy timezone assertions. These tests interact with Attendance and Leave data.                                                                                                    |
| `apps/api/tests/features/attendance/overtime-routing.postgres.ts`   | Reuse the existing controlled interleaving case for `A022-T001`; add no race unless a review-specific concurrency gap is established from the current assertions.                                                                                                                                                                                                                             | Explicit opt-in file, not default `*.test.ts` glob. Require fresh disposable PostgreSQL, local `127.0.0.1`, `/nexus_wc_f02`, explicit port, migrated schema, zero accounts, observer/control connections and cleanup. Never use production/shared dev DB. |
| `apps/web/e2e/attendance-overtime.spec.ts` (proposed new file)      | Add isolated mocked Playwright cases for typed Overtime loading/errors, scope, search/status/page, row projection, capabilities, review note/pending/error states, keyboard menu, responsive layout and side-panel accessibility (`A001-T002`, `A002-T001`, `A003-T001`, `A004-T001`, `A006-T001`, `A007-T001`, `A009-T001/T002`, `A014-T001/T002/T003`, `A015-T001/T002`, `A023-T001/T002`). | Mocked browser cases validate UI requests and state only; they do not establish API authorization or persistence. Do not assert blocked empty copy or manual-submission contract.                                                                         |
| `apps/web/e2e/attendance.spec.ts`                                   | Add the ordinary unlinked queue Browser/API/PGlite case: real clock-in/out, navigate without `?request`, verify pending row and persisted adjustment (`A019-T002`).                                                                                                                                                                                                                           | This file uses the shared attendance browser server and configures serial mode at line 20. Reuse its fixture; no parallel execution with another test writing the same database/port. Keep existing notification deep-link case.                          |
| `apps/web/e2e/superadmin-attendance.spec.ts`                        | If needed, add page-specific Overtime capability response assertions (`A009-T001`) to existing authorization-mock declaration.                                                                                                                                                                                                                                                                | Preserve `test.skip(live, ...)` environment behavior and do not treat mocked privileged UI as real backend authorization.                                                                                                                                 |

## Reusable fixtures and mock boundaries

- Unit route policy: current account objects and `canAccessRoute` from `apps/web/test/attendance.test.mjs`.
- API/PGlite: `apps/api/tests/support/pglite-app.ts`, existing attendance account/policy/session helpers, `issueSession`, seeded Department/Head/Employee/Adjustment, and deterministic clock.
- Browser mocks: `routeAttendanceApi`, `restoreSession`, `signIn`, and Playwright helpers from `apps/web/e2e/regression-support.ts`. Stub list/detail/review separately so status, 403/404 and generic 500 responses can be asserted.
- Real Browser/API/PGlite: `apps/api/tests/support/attendance-browser-server.ts` and existing serial test fixture. Verify the database row after the browser route is loaded and reloaded.
- PostgreSQL: reuse only the disposable, explicit `WC_F02_POSTGRES_URL` test harness. Check URL preconditions and empty account table before any test-created object; retain trigger/table cleanup and deadlock monitoring.

## Focused future commands (not run in Phase 2.1)

```powershell
pnpm --filter @nexus/web exec node --experimental-strip-types --test test/attendance.test.mjs
```

```powershell
pnpm --filter @nexus/api exec node scripts/run-tests.mjs tests/features/attendance/overtime.test.ts tests/features/attendance/overtime-notifications.test.ts tests/features/attendance/overtime-corrections.test.ts tests/features/attendance/management.test.ts
```

```powershell
pnpm --filter @nexus/web exec playwright test e2e/attendance-overtime.spec.ts --workers=1
```

```powershell
pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts --grep "replacement Head opens and marks a real pending overtime notice|typed attendance deep links enforce request type and backend scope" --workers=1
```

The real PostgreSQL case is separate and must be invoked only after confirming the required disposable environment:

```powershell
pnpm --filter @nexus/api exec node scripts/run-tests.mjs tests/features/attendance/overtime-routing.postgres.ts
```

Set `WC_F02_POSTGRES_URL` only for that isolated run, with a fresh migrated disposable local database matching the test's exact path and port requirements. No database URL or secret belongs in a report.

## Regression compatibility commands (future implementation)

```powershell
pnpm --filter @nexus/web exec playwright test e2e/attendance-adjustments.spec.ts --workers=1
pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts --grep "overtime|typed attendance deep links" --workers=1
pnpm --filter @nexus/web exec playwright test e2e/superadmin-attendance.spec.ts --grep "backend-denied review capabilities" --workers=1
```

Before focused runs, inspect current fixture setup, use the exact PG-012 selectors and paths, and record the full output. Do not use a one-run pass to erase prior intermittency or the known shared menu failure.

## Isolation and worker risks

- Root `pnpm test`, `pnpm test:unit`, `pnpm test:api`, `pnpm test:e2e`, and any full regression command are out of the PG-012 implementation plan's focused execution scope.
- Playwright config uses `fullyParallel: true`; limit the fixture-sharing `attendance.spec.ts` path to `--workers=1`. Its suite declares serial mode and a shared API/PGlite browser server. Do not run two tests against the same server/port or clock/database state concurrently.
- Mocked Playwright can run independently only if each test owns its page and network routes. Prefer one worker for first execution due shared-menu history and browser variability.
- API/PGlite creates isolated in-memory databases via `startPgliteApp`; do not replace that with a live database.
- PostgreSQL lock/race verification is environment-dependent and must not run concurrently with a migration or another test process on the same disposable database.

## Quality gates and assertion-preservation requirements

1. Add source-backed tests only; do not duplicate the overtime minute algorithm in test code.
2. Preserve all current request-key, workflow, current-authority, rollback, audit, attendance timestamp, pagination, and typed-link assertions.
3. Keep a failing keyboard assertion if `PG-004-D-001` reproduces. Do not change it to pointer interaction, skip a width, or increase timeout to mask the failure.
4. Keep PG-006/T024, PG-011 intermittent cases, PG-008 environment blocker, and PG-010/PG-011 contracts in their original records; do not transfer pass/fail status based on shared components.
5. Treat `CONTRACT CLARIFICATION REQUIRED` cases as blocked until authoritative product direction is recorded.
6. Verify that mock tests are reported as mock-only, PGlite as isolated persistence, and PostgreSQL as a separate disposable environment.

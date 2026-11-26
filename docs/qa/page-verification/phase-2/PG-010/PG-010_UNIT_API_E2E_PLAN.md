# PG-010 Unit, API, and E2E Implementation Plan

Phase 2.2 planning only. No test source, fixture, mock, application source, or database was changed or exercised for this report. Implementable cases are the 35 cases in the case specification; T036/C001 is excluded pending product clarification.

## Proposed files and coverage

| File                                                                       | Planned work                                                                                                                                                                                                                                                                      | Environment and preservation                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/test/attendance.test.mjs`                                        | Add the exact `/attendance/requests/corrections` route-policy matrix (T001); keep current generic navigation and PG-004 assertions.                                                                                                                                               | Node unit runner with production permission helpers and existing account fixture shape.                                                                                                                                                                                       |
| `apps/api/tests/features/attendance/management.test.ts`                    | Extend/add focused API cases for independent auth, correction-only API scope, pagination boundaries, self-service/profileless ADMIN, HR pending exception, review transitions, missing-attendance validation, replay, and transfer/stale scope as needed (T003, T010, T017-T031). | `startPgliteApp` and existing isolated in-memory PostgreSQL fixtures. Reuse management helpers; never point this suite at a configured live database.                                                                                                                         |
| `apps/api/tests/features/attendance/correction-notifications.test.ts`      | Add assertions for adjustment/audit/notification transaction consistency and rollback for correction create or review (T033).                                                                                                                                                     | Existing PGlite failure-injection and notification fixtures; assert complete before/after state.                                                                                                                                                                              |
| `apps/web/e2e/attendance-corrections.spec.ts`                              | Prefer a dedicated mocked browser file for route-specific list query, initial loading/error/retry, search, status/scope, row values, details, cancel, form validation, denied actions, stale review error, keyboard menu, and responsive view (T004-T011, T014-T015, T034-T035).  | Playwright with `restoreSession`, same-origin API interception, typed correction fixtures, deterministic clock/timezone. Mocked cases prove UI behavior only, not persistence.                                                                                                |
| `apps/web/e2e/attendance.spec.ts`                                          | Add/extend real notification deep-link and form-submission coverage, plus a timezone boundary assertion where existing fixture supports it (T012-T013, T016, T019). Reuse current grouped attendance server and session helpers.                                                  | Browser -> Next proxy -> Express -> Prisma/PGlite fixture. The file has serial fixture lifecycle; run targeted selections with one worker.                                                                                                                                    |
| `apps/web/e2e/attendance-adjustments.spec.ts`                              | Add a typed-route compatibility assertion only if the dedicated file cannot reuse existing shared list helpers; otherwise keep existing PG-004 tests intact and use them as shared-component compatibility coverage.                                                              | Existing mocked route fixtures default to `/attendance/adjustments`; do not treat those results as direct PG-010 route coverage.                                                                                                                                              |
| `apps/web/e2e/superadmin-attendance.spec.ts`                               | If adding a route-specific UI assertion, preserve the file's live-mode skip and distinguish mock UI behavior from backend authorization. Prefer API/PGlite for actual Superadmin permission checks.                                                                               | Existing mocked Superadmin session and capability fixtures; the file's `test.skip(live, ...)` means its status varies by environment.                                                                                                                                         |
| `apps/api/tests/features/attendance/corrections.postgres.ts` (new, opt-in) | Implement T032 competing HR decisions only after an explicitly disposable, migrated PostgreSQL target and deterministic connection barrier are available.                                                                                                                         | Require explicit `PG010_POSTGRES_URL`, target verification, dedicated schema/database, and cleanup. Never fall back to developer `DATABASE_URL`. If repository runner conventions cannot isolate this test, keep T032 blocked rather than placing it in default PGlite tests. |

## Test infrastructure and expectations

- Keep unit tests pure where possible. Route access uses the production `canAccessRoute` helper; it does not prove Express middleware behavior.
- API behavior uses authenticated Express requests through `tests/support/pglite-app.ts`, with actor, employee, department, policy, session, adjustment, and notification fixtures scoped to each case.
- Mocked Playwright tests intercept same-origin `/api/attendance/...` routes after restoring a test session. Assert request parameters, visible state, and mutation count. Do not claim database persistence from mocked responses.
- Real browser/API cases must use the existing isolated attendance browser server and PGlite-backed API. Assert persisted `AttendanceAdjustment`, session, notification, and audit state through the appropriate API/database test boundary.
- Concurrency requires independent PostgreSQL connections and a real PostgreSQL engine. The PGlite integration and single-request lock tests cannot establish competing-transaction behavior.
- Preserve source-defined timezone interpretation: browser/device local time is resolved to explicit ISO instants; backend receives offset/Z values. Use fixed timezone and clock fixtures for DST gap/fold cases.
- Keep failures for previously confirmed shared defects. If T035 reproduces PG-004-D-001, retain the assertion and report PG-010 reproduction evidence separately; do not use forced actions, skipped assertions, or longer timeouts to make it pass.

## Focused commands for separately authorized Phase 2.2

These are proposed commands and were not run during discovery.

```powershell
# Route policy unit assertions
pnpm --filter @nexus/web exec node --experimental-strip-types --test test/attendance.test.mjs

# Correction API/PGlite suites
pnpm --filter @nexus/api test -- tests/features/attendance/management.test.ts tests/features/attendance/correction-notifications.test.ts

# Mocked PG-010 browser cases
pnpm --filter @nexus/web exec playwright test e2e/attendance-corrections.spec.ts --workers=1

# Real browser/API/PGlite cases tagged PG-010 in the serial attendance spec
pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts --grep "PG-010" --workers=1

# Shared PG-004 adjustments and Superadmin UI compatibility selection
pnpm --filter @nexus/web exec playwright test e2e/attendance-adjustments.spec.ts e2e/superadmin-attendance.spec.ts --workers=1

# Optional PostgreSQL concurrency case, only after target verification
$env:PG010_POSTGRES_URL = '<verified disposable local PostgreSQL URL>'; pnpm --filter @nexus/api exec node scripts/run-tests.mjs tests/features/attendance/corrections.postgres.ts
```

The final PostgreSQL command is a plan, not an instruction to use any database. Confirm the current test runner supports opt-in PostgreSQL tests and ensure the URL points to a disposable isolated target before implementation or execution. Do not add it to the default PGlite suite.

## Compatibility, concurrency, and quality gates

- Keep `attendance.spec.ts` selections at `--workers=1`; it owns a serial API fixture lifecycle. Do not run separate selections concurrently against its port or shared fixture.
- Mocked browser cases may run with the file's configured worker settings only after confirming no shared mutable server state. Use one worker for initial focused verification to reduce fixture noise.
- Preserve existing PG-004 `attendance-adjustments.spec.ts` coverage and the role/deep-link cases in `attendance.spec.ts`. Run the focused compatibility command after new tests are implemented; a page-specific pass is not full-system regression reconciliation.
- Existing intermittent 820 px behavior and the earlier 390 px fixture failure are reliability risks to record, not reasons to suppress assertions.
- After implementation, run `pnpm format`, `pnpm lint`, `pnpm typecheck`, and `git diff --check`. Run the focused tests above only under Phase 2.2 authorization. No tests or regression suites were run in Phase 2.1.

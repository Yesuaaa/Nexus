# PG-004 Unit, API and E2E Plan

## Test implementation scope

Implement only the 14 additions listed in `PG-004_TEST_CASE_SPECIFICATION.md` after Phase 2.2 is authorized. Do not modify application behavior. Preserve the current PG-003 implementation and existing attendance regressions.

| Primary type                         | Cases                 | Proposed home                                           | Environment                                                                                                                        |
| ------------------------------------ | --------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Unit                                 | T001                  | `apps/web/test/attendance.test.mjs`                     | Node `node:test`; call production `canAccessRoute`; no browser or network.                                                         |
| API/PGlite                           | T009                  | `apps/api/tests/features/attendance/management.test.ts` | `startPgliteApp`; authenticated local HTTP; seed deterministic rows; no live DB.                                                   |
| Browser with deterministic API mocks | T002–T007, T011, T017 | New `apps/web/e2e/attendance-adjustments.spec.ts`       | Playwright, `configureRegressionTest`/`restoreSession`, stub only attendance API; no database.                                     |
| Browser + API + database integration | T008, T014–T016       | Existing `apps/web/e2e/attendance.spec.ts`              | Existing serial Playwright suite with `attendance-browser-server.ts`, Express and isolated PGlite; two browser contexts for races. |

## Fixture and data design

- Reuse `startPgliteApp` and `tests/support/attendance-browser-server.ts`; do not connect tests to a developer database. Use existing fixture actors when possible and seed actor/employee/department relationships within the helper's transaction.
- For mocked browser cases, use a compact factory that creates complete `AttendanceAdjustment` rows with stable IDs, employee identity, request type/status, UTC timestamps, notes, and explicit capabilities. Assert query parameters rather than copying server filtering logic into the test.
- For real correction submissions, use a fresh UUID request key, a missing-attendance interval accepted by the fixed test clock/policy, and a unique reason. Verify the created row by API read or DB query after the browser action.
- For Head/HR cases, establish a current Head assignment and an Admin with HR scope. Use different employees for request and reviewer. Keep one request per final outcome to avoid terminal-state coupling.
- For stale overtime races, coordinate the winning review from a second isolated browser context; do not use real parallel timing. For placement/authority loss, restore the fixture Head in `finally`.
- Stub unrelated conversations, preferences, and notifications only as the existing attendance browser suite does. Do not mask attendance endpoints in real integration cases.

## Mock and API strategy

- Unit tests invoke production route policy and account facts; they must not duplicate permission predicates.
- Mocked browser tests should record GET query values and return source-shaped response objects. Use explicit controls to hold/release requests for loading and stale-response cases.
- API contract tests must exercise the route through the PGlite app, not call a copied list implementation. Verify status and response body, then independently inspect the database where persistence is part of the assertion.
- The list/detail/review endpoints are authenticated by the existing application middleware. Use actual issued bearer sessions in API/integration tests; do not mock backend authorization in those cases.

## Existing regression preservation

Keep, without weakening assertions:

- PG-003 tests in `attendance.test.mjs` and `attendance-entry.spec.ts`.
- `attendance.spec.ts` correction request, Head verification, date-time/DST, typed deep-link, and overtime conflict cases.
- `superadmin-attendance.spec.ts` desktop/mobile role and denied-capability coverage, including `test.skip(live, ...)`.
- API attendance management, overtime/correction, notification, and PGlite transaction suites.

New PG-004 browser tests should run against `/attendance/adjustments` explicitly. Typed correction/overtime path assertions remain regression dependencies, not replacements for the default route.

## Focused execution commands for a future authorized implementation phase

These commands are proposed for Phase 2.2 and were **not run** during this design task:

```powershell
pnpm --filter @nexus/web exec node --experimental-strip-types --test test/attendance.test.mjs
pnpm --filter @nexus/api exec node scripts/run-tests.mjs tests/features/attendance/management.test.ts
pnpm --filter @nexus/web exec playwright test e2e/attendance-adjustments.spec.ts
pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts
pnpm --filter @nexus/web exec playwright test e2e/superadmin-attendance.spec.ts
```

The API command requires generated Prisma client from the repository's existing setup. The browser commands need the Playwright browser and configured local Next build; `attendance.spec.ts` also needs process-spawn support for its isolated API server. Do not use `test:e2e:live` or live-account credentials.

## Quality gates and environment blockers

After implementation, run the repository-mandated `pnpm format`, `pnpm lint`, and `pnpm typecheck`. Then run only the focused tests above and report their exact totals. Typecheck may regenerate `apps/web/next-env.d.ts`; inspect and restore only incidental generated changes if its contents changed without an intended route change. Environment blockers to record include Playwright browser availability, process-spawn restrictions, fixture startup timeout, Prisma generation, and any accidental live-database target. Never resolve a PGlite failure by pointing tests at a shared database.

# PG-013 Unit, API, Browser, and Integration Plan

## Authorization boundary

This document is a Phase 2.2 proposal only. No test code, fixture, server, database, or runner configuration was changed or executed during Phase 2.1.

## Proposed files and layers

| Layer                          | Proposed location                                                              | Planned work                                                                                                                                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit                           | apps/web/test/attendance.test.mjs                                              | Add the exact PG-013 route policy assertions for active ADMIN, eligible SUPERADMIN with employees:read, inactive accounts, and unsupported USER. Preserve the current shared attendance link loop and prior-page assertion blocks.                                       |
| API/PGlite: Attendance         | apps/api/tests/features/attendance/management.test.ts                          | Add only summary-specific missing-scope/default-personal, unknown query key, anonymous/USER, and response grouping/field assertions to the existing management test. Retain 27-row aggregation, team-scope count, invalid scope, and ADMIN HR pending visibility checks. |
| API/PGlite: Leave              | apps/api/tests/features/leave/leave-requests.test.ts                           | Extend the existing leave-request API test/helper to check the complete overview group projection and strict scope query/auth boundary. Preserve the transfer/revocation helper's SUBMITTED/ANNUAL count and queue assertions.                                           |
| Browser                        | apps/web/e2e/attendance.spec.ts                                                | Extend WC-06-F01/F03 assertions for sparse totals, section-specific empty copy, and authorized retry after Head restoration. Add declarations for unmount/revisit stale protection, keyboard toggle semantics, and responsive layout.                                    |
| Browser                        | apps/web/e2e/attendance.spec.ts                                                | Add one canonical navigation flow from each “View requests” link into Overtime, Corrections, and Leave pages, asserting only source-defined destination paths. Do not assert scope propagation until clarified.                                                          |
| Browser/API/PGlite Integration | apps/web/e2e/attendance.spec.ts and existing attendance-browser-server fixture | Preserve and extend WC-06 behaviors that compare UI output against actual Express/PGlite responses and persistence snapshots.                                                                                                                                            |

There is no pure calculation helper suitable for a separate unit test. Do not copy the aggregation algorithm into a test-only function. No production test infrastructure is proposed.

## Assertion-preservation and fixture plan

- Preserve existing WC-06 declarations and all assertions listed in PG-013_EXISTING_TEST_BASELINE.md.
- Reuse attendance.spec.ts overview helpers: overviewSections, overviewTotals, expectOverviewTotals, overviewResponse, holdOverview, and routeAttendanceApi.
- Reuse current Staff, Head, ADMIN, and SUPERADMIN session actors plus department Head assignment fixture. Create a distinct active ADMIN without Employee profile only if product clarification authorizes assertions about its UI semantics.
- For API additions, use startPgliteApp from apps/api/tests/support/pglite-app.ts. Create an isolated User/Employee/Department fixture per scenario; assert both response and aggregate database counts.
- Use Playwright request gates only for controlled ordering/unmount cases. Avoid arbitrary sleep; use response, navigation, and locator state barriers.
- Use browser widths 390, 820, and 1440 px. These target narrow, known intermediate, and desktop layout. PG-006 T024's 820 px intermittency remains historical; include explicit repeatability and fixture stability review if failures occur.

## Test data and expected source contracts

- Attendance adjustment groups: OVERTIME and CORRECTION across PENDING, VERIFIED, APPROVED, and REJECTED.
- Leave groups: ANNUAL/SICK and SUBMITTED, VERIFIED, APPROVED, REJECTED, CANCELLED, and REVERSED where valid lifecycle setup allows.
- Sparse percentage boundary: exactly one record in one group, zero records in the other fixed overall status rows; expected shares follow the current Math.round calculation.
- ADMIN scope data must distinguish department/team records and pending HR visibility from out-of-scope data.
- Leave team data must distinguish the Staff Head department, Admin submitted-leave fallback scope, and Superadmin organization scope.
- Do not expect matching transaction timestamps across APIs; they are separate requests and transactions.
- Do not assert a pagination limit or ordering; these endpoints return grouped aggregates and the page defines a fixed client status order.

## Database and browser integration requirements

PGlite is the required isolated database for API and current Browser/API integration. The page does not mutate records and has no race-sensitive write behavior, so disposable PostgreSQL is not justified. Existing PG-010 PostgreSQL concurrency results are not a requirement for PG-013 and do not transfer to unrelated historical blockers.

The existing browser setup launches a production Next web server on port 5273 unless NEXUS_E2E_BASE_URL points at a supplied server. For API calls, routeAttendanceApi intercepts /api requests and forwards them to the test Express/PGlite server. Therefore these tests establish browser-to-real-Express-to-PGlite behavior, but do not verify the production Next.js API proxy. Label test reports accurately.

## Focused commands for a separately authorized implementation

Commands below are proposed, not run:

- Unit: pnpm --filter @nexus/web exec node --test test/attendance.test.mjs
- Attendance API/PGlite: pnpm --filter @nexus/api exec node scripts/run-tests.mjs tests/features/attendance/management.test.ts
- Leave API/PGlite: pnpm --filter @nexus/api exec node scripts/run-tests.mjs tests/features/leave/leave-requests.test.ts
- PG-013 WC-06 browser/integration selection: pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts --grep "WC-06-F01|WC-06-F03|requests overview navigation|overview unmount|overview keyboard|overview responsive"
- Existing page compatibility: pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts --grep "WC-06|grouped attendance routes"
- Relevant shared attendance compatibility, when changed assertions justify it: pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts --grep "row-action|attendance routes"

These focused selections should be followed by the existing compatibility selection, then repository quality gates. Do not use a grep selection that accidentally omits a relevant shared declaration. Verify the exact runner option syntax against package scripts when Phase 2.2 is authorized.

## Worker, isolation, and quality gates

- attendance.spec.ts configures its tests serially; keep the browser process at one worker for initial focused verification to reduce fixture/port contention. The project Playwright config otherwise permits parallel files.
- The browser fixture process binds a fixed local test port (5391 in current helper); do not run another invocation against that fixture concurrently.
- API PGlite suites create isolated apps, but concurrent test processes can still contend for generated Prisma output and host resources.
- Run new focused tests repeatedly if timing-based ordering is involved; one pass is not enough to clear a future intermittent result.
- Before implementation handoff, verify all 35 stable IDs reconcile to code or explicit contract blockers, no existing assertion was weakened, no test is silently skipped, all expected new/additive tests are present, and the exact execution environment is recorded.
- Phase 2.2 quality gate: pnpm format, pnpm lint, pnpm typecheck, focused unit/API/browser/integration commands, relevant compatibility commands, and git diff --check. Report actual exits and any environment or flake without claiming a full regression if it was not run.

## Known dependencies and limitations

- Product wording/scope clarification is needed for profileless ADMIN toggle behavior and scope carry-through on queue links.
- API source errors are not guaranteed to map to the same status between Attendance and Leave; assert each endpoint's current contract separately.
- Browser tests use intercepted API traffic; they do not prove the production proxy route.
- No PG-013 test was executed in this design phase, so no test pass, failure, or flakiness status is established.

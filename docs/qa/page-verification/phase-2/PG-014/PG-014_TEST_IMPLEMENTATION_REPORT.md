# PG-014 Test Implementation Report

## Authorized scope and entry baseline

The branch was `293-test-full-system-audit-for-verifying-recent-changes` at `2937d849710629994d918555b79c44921968cc67`, the same commit used in discovery. There were no intervening commits or staged files. Entry status contained only the modified Phase 2 ledger and the seven untracked PG-014 Phase 2.1 reports. Those seven reports were preserved. Production route, page, permission, Express, Prisma, and migration source matches the implementation baseline.

The scope contains 38 case records and 19 atomic behaviors. Eleven new Chromium declarations exercise the real page with mocked APIs. Six new API declarations exercise authenticated Express and Prisma with a fresh PGlite database per case. The original Unit, API, and browser definitions carry eight additive groups. The eleven existing-sufficient records retain their original assertions.

| Path                                                            | Implementation                                                                                                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/test/attendance.test.mjs`                             | Extend the navigation-policy declaration with the PG-014 role/permission matrix; preserve the shared UTC range test.                                                      |
| `apps/api/tests/features/attendance/time-logs-overview.test.ts` | Six new isolated cases for credentials, empty directory, validation, leave coverage, cap, and committed scope changes.                                                    |
| `apps/api/tests/features/attendance/management.test.ts`         | Add a paid open break and event projection assertions to the existing partition fixture.                                                                                  |
| `apps/api/tests/features/attendance/superadmin.test.ts`         | Add sorted exact department projections and compare authorized, foreign, blank, omitted, and missing department scopes.                                                   |
| `apps/web/e2e/time-logs-overview.spec.ts`                       | Eleven Chromium cases with stable time, synthetic manager/denied accounts, controlled responses, keyboard input, and responsive checks.                                   |
| `apps/web/e2e/attendance.spec.ts`                               | Extend the existing partial-failure and WC-06-F02 workflows to cover independent retry requests, complete error presentation, exact KPI values, and the department reset. |

The cap fixture uses 40 distinct employees with 250 unique workdays each and zero leave rows. The extra workday belongs to the same department and date range, so the guard is tested at 10,001 scoped rows. The leave fixture distinguishes approved overlap, leave-only, a sessionless recorded date, submitted and reversed leave, a zero-minute approved row, and an outside department. The placement fixture changes Employee department in the isolated database, then changes Department headship before new reads using the original bearer.

Browser loading uses controlled independent releases. The auth test uses synthetic refresh tokens and a managed request cycle. Out-of-order and unmount scenarios release fixture gates explicitly. Browser integration keeps the existing forwarding harness on port 5391, one worker, and real successful sibling and retry responses. Application production behavior and test infrastructure were preserved.

The [complete case matrix](PG-014_TEST_EXECUTION_RESULTS.md) identifies all declarations, synthetic inputs, expected/actual results, status, and preserved coverage. The [assertion baseline](PG-014_REGRESSION_PRESERVATION.md) identifies the original and additional assertions separately.

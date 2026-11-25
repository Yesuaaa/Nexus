# PG-005 Test Execution Results

**Phase:** 2.2  
**Page:** PG-005, `/attendance/audit`  
**Execution date:** 2026-11-23 (Asia/Singapore)

## Focused execution

| Layer                | Command                                                                                                                                                                             | Result                                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web unit             | `node --experimental-strip-types --test apps/web/test/attendance.test.mjs apps/web/test/route-policy.test.mjs`                                                                      | Passed, 29/29. Includes T002 and preserved U1/U2 route and navigation assertions.                                                                    |
| API / PGlite         | `pnpm --filter @nexus/api test -- tests/features/attendance/management.test.ts tests/features/attendance/superadmin.test.ts tests/features/attendance/transfer-attribution.test.ts` | Passed, 20/20; 0 skipped. Covers T015/T016, T017 in A1, existing scope/search coverage, Superadmin audit access, and persisted transfer attribution. |
| Browser / Playwright | `pnpm --filter @nexus/web test:e2e -- e2e/attendance.spec.ts --grep "PG-005                                                                                                         | attendance audit                                                                                                                                     | grouped attendance pages | grouped attendance routes | WC-07-F01"` | Passed, 12/12 in the final focused selection. Includes all six new browser cases, T008 within B2, responsive B1 at 390/820/1440 px, B3, B2, and existing integration X1. |

The browser run used the Playwright configuration's production build and isolated attendance server fixture. It did not use `NEXUS_E2E_LIVE` or a live base URL. API tests used PGlite and local Express only.

## Required repository quality gates

| Gate               | Result                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `pnpm format`      | Passed, exit code 0.                                                                            |
| `pnpm lint`        | Passed, exit code 0 (`eslint . --max-warnings 0`).                                              |
| `pnpm typecheck`   | Passed, exit code 0 for web and API; Next route types and Prisma client generated successfully. |
| `git diff --check` | Passed, exit code 0.                                                                            |

## Run history and interpretation

The first restricted Node test launch was blocked by `spawn EPERM`, and initial pnpm invocations could not open the global store lock. Reruns with the required process/store access completed successfully. These were invocation/environment issues, not assertion failures.

Intermediate browser attempts exposed test-side locator/expected-text issues in T005, T009, and T011. Those selectors and expectations were corrected against the rendered page, and the final complete 12-case focused selection passed. No PG-005 application defect was established by these attempts. A subsequent focused unit rerun after completing the inactive ADMIN T002 assertion also passed 29/29.

PGlite emitted dependency deprecation warnings and expected error logs from rollback-failure scenarios already exercised by the API suite; the command exited 0 and reported no failed or skipped tests. These logs are not PG-005 failures.

No full repository test suite was run, in accordance with the authorized focused scope.

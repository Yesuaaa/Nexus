# PG-007 Test Execution Results

**Scope:** Phase 2.2 implementation and focused verification for `/attendance/overview` only.  
**Baseline:** branch `293-test-full-system-audit-for-verifying-recent-changes`, HEAD `972428afbcd3d48d7ca6b8084b6f2906c2de84bc`.  
**Test data:** Isolated PGlite databases and controlled browser API routes; no live database.

## Results

| Layer                            | Command                                                                                                                                                        | Result                                                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web unit                         | `pnpm --filter @nexus/web exec node --experimental-strip-types --test test/attendance.test.mjs test/route-policy.test.mjs`                                     | 30 passed, exit 0. This includes existing route and permission assertions plus T003.                                                             |
| API/PGlite                       | `pnpm --filter @nexus/api exec node scripts/run-tests.mjs tests/features/attendance/management.test.ts tests/features/attendance/superadmin.test.ts`           | 22 passed, exit 0. Includes T016-T019 and existing attendance management/Superadmin coverage.                                                    |
| Mocked browser                   | `pnpm --filter @nexus/web exec playwright test e2e/attendance-overview.spec.ts --grep PG-007 --workers=1`                                                      | 8 passed, exit 0 (T004, T005, T008, T009, T011-T014).                                                                                            |
| Mocked browser retry             | `pnpm --filter @nexus/web exec playwright test e2e/async-resource.spec.ts --grep 'attendance request failures show an error and recover on retry' --workers=1` | 1 passed, exit 0 (T015). Existing 503/503/success retry behavior remains asserted.                                                               |
| Browser and real API integration | `pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts --grep 'PG-007                                                                           | attendance overview summary layout' --workers=1`                                                                                                 | 5 passed, exit 0 (T002, T020, and the preserved 390/820/1440 px responsive cases T021). |
| Stale response follow-up         | `pnpm --filter @nexus/web exec playwright test e2e/attendance-overview.spec.ts --grep T005 --workers=1`                                                        | 1 passed, exit 0. This reran T005 after adding explicit confirmation that the older response was fulfilled. It is not an additional unique case. |

Across the final focused selections, 30 unit, 22 API, and 14 unique browser/integration test instances passed. T021 is parameterized at three viewports. The T005 follow-up is counted once. No full repository test suite was run.

## Run issues and resolution

- The first sandboxed Node test invocation was blocked by a pnpm shared-store lock / process-spawn restriction. The reviewed invocation of the same focused command passed.
- The first API test compilation found zero-filled generated Prisma TypeScript files and failed with invalid-character diagnostics before tests ran. `pnpm --filter @nexus/api exec prisma generate` completed with exit 0; generated client output is ignored. The focused API/PGlite command then passed.
- An initial T019 fixture attempted multiple simultaneous unfinished sessions for one employee. PGlite correctly rejected it under the attendance overlap constraint. The fixture was corrected to use a valid on-break session for the aggregate dataset and separate personal actors for suspended and working status counts. The final API selection passed with the invariant intact.
- The first mocked KPI assertion selected a `<dd>` containing both a value and note. The locator was narrowed to the first value span; the final eight-case run passed.
- A retry assertion initially counted the shared empty live region as an alert after recovery. It now asserts removal of the two page-specific errors; the retry case passed.
- The first web typecheck caught a test assertion calling the Fetch `Response.status` property as a function. This was corrected; web and later root typechecks passed.

These were test harness, fixture, or generated-client setup issues. No PG-007 application defect was reproduced. The separate PG-004-D-001 defect, PG-006 T018 reproduction, PG-006 T024 intermittent result, and PG-006 contract limitation remain unchanged in the cumulative ledger.

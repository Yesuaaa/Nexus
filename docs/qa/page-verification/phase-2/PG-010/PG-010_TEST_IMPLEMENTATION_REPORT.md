# PG-010 Test Implementation Report

## Scope and result

Phase 2.2 implemented the approved PG-010 test cases and ran focused verification only. The changes add 12 new test declarations and 11 additive assertion groups. The 12 cases classified as `EXISTING COVERAGE SUFFICIENT` remain in place without replacement. T036/C001 remains contract-blocked and was not implemented. No production application, API, schema, migration, or authorization code was changed.

The approved case inputs, reproducible steps, source-backed expected results, priorities, and dependencies remain in [the PG-010 case specification](PG-010_TEST_CASE_SPECIFICATION.md). Per-case implementation and execution status are reconciled in [test execution results](PG-010_TEST_EXECUTION_RESULTS.md).

## Implemented files

| File                                                                  | PG-010 cases                             | Implementation                                                                                                                                                                                                                     |
| --------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/test/attendance.test.mjs`                                   | T001                                     | Added the canonical `/attendance/requests/corrections` pathname to the existing route policy assertions for active STAFF, ADMIN, eligible SUPERADMIN, USER, and inactive accounts.                                                 |
| `apps/web/e2e/attendance-corrections.spec.ts`                         | T002, T004, T008, T014, T034, T035       | Added the route access matrix, correction-only initial query, status filter/page reset, capability-gated correction form cancellation, stale-review 409 recovery, and keyboard/responsive row-action test.                         |
| `apps/web/e2e/attendance-adjustments.spec.ts`                         | T005, T006, T007, T009, T015             | Added Corrections-route query and data assertions to the existing PG-004 load/retry, row display, search, scope, and form validation cases. Existing assertions were retained.                                                     |
| `apps/api/tests/features/attendance/management.test.ts`               | T003, T017, T018, T021, T022, T027, T029 | Added direct API authentication/role checks, reason boundaries, malformed request validation, no-write interval/context rejections, duplicate active-session correction handling, HR fallback rules, and profileless ADMIN denial. |
| `apps/api/tests/features/attendance/transfer-attribution.test.ts`     | T031                                     | Added a former Department Head review-denial assertion after employee transfer.                                                                                                                                                    |
| `apps/api/tests/features/attendance/correction-notifications.test.ts` | T033                                     | Added transaction rollback and adjustment/audit/notification consistency assertions for a failed verification notification, followed by the successful stage transition.                                                           |
| `apps/web/e2e/attendance.spec.ts`                                     | T019                                     | Added a real browser-to-Next-proxy-to-Express-to-PGlite missing-attendance correction submission and persistence workflow.                                                                                                         |
| `apps/api/tests/features/attendance/corrections.postgres.ts`          | T032                                     | Added an opt-in PostgreSQL concurrency case using independent review requests, row locking, and a synchronization trigger to verify a single winning HR decision.                                                                  |

No existing assertion was deleted or weakened. Test-only fixture/locator corrections discovered during focused runs are recorded below and in the execution report.

## New declarations and IDs

| Test ID | Declaration                                                                                              |
| ------- | -------------------------------------------------------------------------------------------------------- |
| T002    | `[PG-010-F001-A001-T002] Corrections route enforces the frontend access matrix`                          |
| T003    | `[PG-010-F001-A001-T003] correction API authentication is independent of route access`                   |
| T004    | `[PG-010-F001-A002-T004] Corrections starts with a fixed correction-only query`                          |
| T008    | `[PG-010-F001-A005-T008] correction status filtering preserves route type and resets page`               |
| T014    | `[PG-010-F001-A012-T014] correction request form is capability-gated and cancels without a write`        |
| T018    | `[PG-010-F001-A014-T018] adjustment API rejects unsupported filters and malformed inputs without writes` |
| T019    | `[PG-010-F001-A015-T019] Corrections route submission persists through Next, Express, and PGlite`        |
| T022    | `[PG-010-F001-A016-T022] one active correction is allowed per attendance session`                        |
| T027    | `[PG-010-F001-A020-T027] HR finalizes only pending corrections without an independent Head`              |
| T032    | `[PG-010-F001-A021-T032] competing correction decisions serialize in PostgreSQL`                         |
| T034    | `[PG-010-F001-A021-T034] stale correction review remains open and reports the API conflict`              |
| T035    | `[PG-010-F001-A023-T035] correction row action and details respond to keyboard across viewports`         |

## Additive assertion groups

| Test ID | Existing declaration extended                                                                | Added assertion focus                                                                                                            |
| ------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| T001    | `[PG-004-F001-A001-T001] adjustment route enforces active roles and employee read grant`     | Exact Corrections pathname access matrix.                                                                                        |
| T005    | `[PG-004-F001-A005-T006] loading, empty, error and retry states recover`                     | Typed route remains correction-only through loading, 503, retry, and empty result.                                               |
| T006    | `[PG-004-F001-A002-T002] default route renders mixed scoped requests`                        | Typed route displays correction source, employee name, reason, stage, and device-zone times; it does not render overtime rows.   |
| T007    | `[PG-004-F001-A004-T004] search and filters update the default list query`                   | Search debounce, page reset, maximum length, and fixed `type=CORRECTION`.                                                        |
| T009    | `[PG-004-F001-A003-T003] mine and team scope follows the account`                            | Typed route scope and available controls for STAFF, Head, ADMIN, and SUPERADMIN.                                                 |
| T015    | `[PG-004-F001-A006-T007] correction action is capability-gated and validates before writing` | Reverse interval is rejected client-side; valid instants, request key, fixed type, and missing session ID are sent correctly.    |
| T017    | Existing correction create validation case in `management.test.ts`                           | Trimmed blank/short reason rejection and inclusive supported length boundaries.                                                  |
| T021    | Existing correction create validation case in `management.test.ts`                           | Reversed/future/overlap and attendance-context invalidity do not create records.                                                 |
| T029    | Existing profileless ADMIN overview case in `management.test.ts`                             | Corrections capability is false and create returns 409 without a write.                                                          |
| T031    | Existing transfer attribution case in `transfer-attribution.test.ts`                         | Former Head cannot review after the employee's current department changes.                                                       |
| T033    | Existing correction notification transaction case in `correction-notifications.test.ts`      | Notification failure rolls back status/audit/notice writes; successful verification has consistent stage history and recipients. |

## Implementation boundaries

- Unit/API test infrastructure uses the existing Node runner and `tests/support/pglite-app.ts` setup; no default API case targets a live database.
- The browser integration case uses the repository's isolated browser/API/PGlite fixture. Mocked Playwright cases establish client behavior only.
- T032 is explicitly opt-in and was run only against a fresh disposable PostgreSQL 16 container with tmpfs storage and the repository migrations applied. It was not run against a developer or shared database.
- The test-only T032 barrier was adjusted after its first attempt exposed a harness timeout/observer issue. The final fresh-database run passed; the details are in [execution results](PG-010_TEST_EXECUTION_RESULTS.md).
- T035 intentionally retains the failing keyboard assertion because it reproduces the already confirmed shared-menu issue `PG-004-D-001`. No production fix is included.

## Scope reconciliation

| Approved disposition              | Count | Phase 2.2 result                                                                   |
| --------------------------------- | ----: | ---------------------------------------------------------------------------------- |
| `NEW TEST REQUIRED`               |    12 | Implemented as new declarations.                                                   |
| `ADDITIONAL ASSERTION REQUIRED`   |    11 | Added to existing tests without removing prior checks.                             |
| `EXISTING COVERAGE SUFFICIENT`    |    12 | Preserved; focused relevant coverage was run where listed in the execution report. |
| `CONTRACT CLARIFICATION REQUIRED` |     1 | T036/C001 not implemented or counted as executable.                                |

There are 35 implementable unique cases: 1 unit, 17 API/PGlite, 15 browser, and 2 integration. Case counts are unique-ID counts; overlapping test invocations are not added together.

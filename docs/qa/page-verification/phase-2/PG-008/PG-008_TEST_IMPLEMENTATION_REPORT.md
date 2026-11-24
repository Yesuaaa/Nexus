# PG-008 Test Implementation Report

## Status and baseline

**Test implementation: COMPLETE. Focused verification: PARTIALLY COMPLETE.** The approved PG-008 scope is `/attendance/policies/management`, rendered by `AttendanceSettingsPage`; `/attendance/settings` is its redirect alias. The branch at task entry was `293-test-full-system-audit-for-verifying-recent-changes`, HEAD `3c28524299253f8e6ff9da0f2603e398f43d6516`. This matched the Phase 2.1 baseline. The task-entry worktree already contained a modified cumulative ledger and seven untracked PG-008 Phase 2.1 design reports. Those files were retained. No staged changes were present. No production, Prisma schema, migration, authorization implementation, or unrelated page source was changed.

## Approved case reconciliation

The approved design contains 35 unique case records across 25 atomic features: 14 new declarations, five additive assertion groups, 15 existing-sufficient cases, and one contract-clarification case. All 14 declarations and five additive groups are implemented. Existing-sufficient assertions remain present. A012-T003/C001 remains deferred. One new browser case reproduces the already-confirmed shared keyboard-menu defect; the PostgreSQL concurrency declaration is implemented but safely skipped because no disposable PostgreSQL target was available.

| Work                                                                                                             | Implementation location                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A001-T001 permission-helper and route-policy matrix                                                              | `apps/web/test/attendance.test.mjs`, existing “all attendance navigation pages preserve module ownership and role boundaries” test.                                                                                      |
| A002-T001 initial directory query assertions                                                                     | `apps/web/e2e/attendance.spec.ts`, existing responsive policy skeleton test; asserts page 1, size 10, active status, and absent search.                                                                                  |
| A006-T001 policy row projection                                                                                  | `apps/web/e2e/attendance.spec.ts`, existing “Admin policy creation and assignment are live; clients remain denied” flow; checks schedule type, timezone, weekly hours, and assignment count before and after assignment. |
| A009-T001 assignment-history pages and status projection                                                         | `apps/api/tests/features/attendance/policy-management.test.ts`, existing “assignment details are paginated and restricted to managers” test.                                                                             |
| A013-T001 assigned timezone is read-only                                                                         | `apps/web/e2e/attendance.spec.ts`, existing policy edit test; the UI assertion supplements the existing API 409 assertion.                                                                                               |
| API declarations A003-T001, A005-T001, A012-T002, A015-T002                                                      | `apps/api/tests/features/attendance/policy-management.test.ts`; PGlite request, validation, pagination, and no-partial-write assertions.                                                                                 |
| Browser declarations A001-T002, A002-T002, A003-T002/T003, A007-T001, A013-T002, A014-T002, A015-T003, A022-T001 | `apps/web/e2e/attendance-policy-assignment.spec.ts`; controlled browser/API fixtures.                                                                                                                                    |
| PostgreSQL declaration A025-T001                                                                                 | `apps/api/tests/features/attendance/policy-assignment-concurrency.postgres.ts`; opt-in, allowlisted, disposable-database-only scenario.                                                                                  |

The complete approved preconditions, inputs, source expectations, and original test-layer assignments remain in [the Phase 2.1 case specification](PG-008_TEST_CASE_SPECIFICATION.md). The per-case execution reconciliation is in [PG-008_TEST_EXECUTION_RESULTS.md](PG-008_TEST_EXECUTION_RESULTS.md).

## Existing coverage preserved

The 15 existing-sufficient records are A004-T001, A008-T001, A010-T001, A011-T001, A012-T001, A014-T001, A015-T001, A016-T001, A017-T001, A018-T001, A019-T001, A020-T001, A021-T001, A023-T001, and A024-T001. Their declarations and assertions were not removed, skipped, weakened, or renamed. A023-T001's existing 390 px cross-page test failed at its attendance-record fixture assertion before reaching the policy settings panel; the limitation is recorded without changing that unrelated assertion.

## Test infrastructure and boundaries

- Web unit tests use the existing Node test setup and production route/permission helpers.
- API tests use the repository's PGlite-backed Express fixture. They do not connect to a shared or production database.
- The assignment-directory browser tests stub only the relevant API requests and make no persistence claim.
- Existing browser/API/PGlite workflows continue through the real Next.js page, local Express API, Prisma, and isolated PGlite database. The new row assertions were added to that real create-and-assign path.
- A025-T001 requires a separate, verified disposable PostgreSQL database. Its opt-in test file was run with `PG008_POSTGRES_URL` forced empty to validate the skip path; it made no database connection. It is not counted as passed.

## Files changed for PG-008 Phase 2.2

- Test source: `apps/web/test/attendance.test.mjs`, `apps/web/e2e/attendance.spec.ts`, `apps/web/e2e/attendance-policy-assignment.spec.ts`, `apps/api/tests/features/attendance/policy-management.test.ts`, and the new `apps/api/tests/features/attendance/policy-assignment-concurrency.postgres.ts`.
- QA documentation: the four Phase 2.2 reports and the cumulative `PHASE_2_PROGRESS_LEDGER.md`.
- No production application functionality, schema, migration, or prior-page regression source was modified.

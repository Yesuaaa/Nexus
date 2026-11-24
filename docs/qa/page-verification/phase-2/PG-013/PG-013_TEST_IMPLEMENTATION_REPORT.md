# PG-013 Test Implementation Report

## Status

**Implementation complete; focused verification passed for all 33 implementable case records.** The two approved product-contract cases remain deferred and are excluded from executable totals. No PG-013 application defect was confirmed.

## Repository baseline

| Item                 | Result                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Branch               | 293-test-full-system-audit-for-verifying-recent-changes                                                       |
| Task-entry HEAD      | 098dec928ed89271f7af40764854c1d0b1bc72e1                                                                      |
| Prior Phase 2.1 HEAD | 03340d6136ec7d6680b9bbc68fa5738370d29398                                                                      |
| Intervening commit   | 098dec9 fix(security): suppress verified historical billing test fixtures                                     |
| Intervening paths    | .gitleaksignore; docs/qa/security/GITLEAKS_CI_INVESTIGATION.md                                                |
| Task-entry worktree  | Existing ledger modification and seven untracked PG-013 Phase 2.1 reports; no staged files or source changes. |
| Final HEAD           | Unchanged; no branch or commit operations.                                                                    |

The intervening security-fixture commit does not modify PG-013 implementation or its approved test-case inventory. The seven Phase 2.1 reports and prior ledger content were preserved.

## Approved scope and case totals

The target is /attendance/requests/overview, implemented by AttendanceRequestsOverviewPage in Workforce Compliance / Attendance. The Phase 2.1 inventory specifies 35 unique stable case records:

| Approved disposition            | Planned | Implemented or preserved |
| ------------------------------- | ------: | -----------------------: |
| New test declarations           |       4 |                        4 |
| Additive assertion groups       |       8 |                        8 |
| Existing coverage sufficient    |      21 |             21 preserved |
| Contract clarification required |       2 |               2 deferred |
| Total records                   |      35 |            35 reconciled |

There are 33 implementable records: 1 Unit, 6 API, 5 Browser, and 21 Integration. All 33 passed focused verification. The remaining two records are not executable until product decisions are supplied.

## New test declarations

| Test ID               | Test declaration                                                                                                | Layer   | Evidence                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------ |
| PG-013-F001-A002-T001 | Summary links navigate to their canonical Overtime, Corrections, and Leave queues.                              | Browser | apps/web/e2e/attendance.spec.ts, WC-06-F01 |
| PG-013-F001-A012-T002 | A delayed response from an unmounted overview does not replace a separately mounted account's current overview. | Browser | apps/web/e2e/attendance.spec.ts, WC-06-F01 |
| PG-013-F001-A016-T001 | Department/My scope controls support Tab, Space, and Enter with correct pressed state and refreshed totals.     | Browser | apps/web/e2e/attendance.spec.ts, WC-06-F01 |
| PG-013-F001-A017-T001 | Overview controls remain visible without document-level horizontal overflow at 390, 820, and 1440 CSS pixels.   | Browser | apps/web/e2e/attendance.spec.ts, WC-06-F01 |

## Additive assertion groups

| Test ID               | Additions                                                                                                                              | Layer       | Evidence                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| PG-013-F001-A001-T001 | Exact route-policy matrix for active Staff, Head, Admin, permitted Superadmin, inactive accounts, User, and unpermitted Superadmin.    | Unit        | Existing declaration in apps/web/test/attendance.test.mjs                                                                                  |
| PG-013-F001-A005-T002 | Exact Attendance summary projection keys and values for 27 pending correction rows, including overtime minutes and HR-pending count.   | API         | Existing PGlite declaration in apps/api/tests/features/attendance/management.test.ts                                                       |
| PG-013-F001-A006-T002 | Isolated Head team with exactly one Leave request; all six overall statuses, percentages, and InlineBar accessible labels are checked. | Integration | Existing WC-06-F03 declaration in apps/web/e2e/attendance.spec.ts; isolated fixture in apps/api/tests/support/attendance-browser-server.ts |
| PG-013-F001-A008-T002 | Superadmin Leave grouped projection keys and counts are compared with persisted status/type groups.                                    | API         | Existing PGlite declaration in apps/api/tests/features/leave/leave-requests.test.ts                                                        |
| PG-013-F001-A010-T002 | Overtime, Corrections, and Leave each assert their source-defined empty message and absence of an empty table.                         | Integration | Existing WC-06-F03 empty-scope helper                                                                                                      |
| PG-013-F001-A011-T006 | After restoring the real Head relationship, Retry rereads both team endpoints and recovers the prior team totals.                      | Integration | Existing WC-06-F01 real-403 declaration                                                                                                    |
| PG-013-F001-A014-T002 | Attendance summary omitted-scope default, unknown query, anonymous, unsupported User, and no-summary-data responses.                   | API         | Existing PGlite declaration in apps/api/tests/features/attendance/management.test.ts                                                       |
| PG-013-F001-A015-T002 | Leave missing/invalid/unknown scope, anonymous, User, non-Head Staff, and valid Staff mine/Head team/Admin/Superadmin access.          | API         | Existing PGlite declaration in apps/api/tests/features/leave/leave-requests.test.ts                                                        |

## Preservation and implementation boundaries

- All 21 EXISTING COVERAGE SUFFICIENT records and their assertions remain. Their exact test references and execution evidence are itemized in PG-013_TEST_EXECUTION_RESULTS.md.
- The existing WC-06 full-lifecycle and no-write snapshots, actual 401/403 responses, three 503/retry variants, paired-scope stale-response checks, and role coverage were retained.
- The two contract blockers remain unresolved: profileless ADMIN personal-scope presentation/recovery and whether static queue links should carry overview scope.
- One isolated Head/department actor was added to the existing PGlite browser fixture solely for the approved one-record status-boundary case.
- No production code, shared components, authentication, permissions, Prisma schema, migration, or prior-page test/report was modified. PG-014 was not started.
- Successful browser API requests are forwarded by the Playwright fixture to real Express and PGlite. They bypass the production Next.js API proxy; mocked 503 responses remain intentionally mocked.

## Outcome

The authorized implementation is complete and ready for acceptance review. All implementable PG-013 cases passed focused runs. The two contract cases remain deferred; no broader regression result is implied.

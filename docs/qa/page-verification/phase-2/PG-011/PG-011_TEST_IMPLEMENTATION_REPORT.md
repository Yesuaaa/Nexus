# PG-011 Test Implementation Report

## Status

**Implementation complete; focused verification partially complete.** The authorized 15 new declarations and 13 additive assertion groups are implemented. All 12 existing-sufficient cases remain. Both product-contract cases remain deferred. PG-011 reproduces the existing shared keyboard-menu defect PG-004-D-001; two transfer-related records remain intermittent. This is not a fully passing page verification.

## Repository baseline and reconciliation

- Branch: `293-test-full-system-audit-for-verifying-recent-changes`.
- Task-entry HEAD: `9b4d3936d425d4c743bea6bc021f0daf10b585d6`, matching the reported PG-011 Phase 2.1 HEAD. No later commit was present.
- At Phase 2.2 entry, the cumulative ledger was already modified and the seven-file PG-011 Phase 2.1 directory was untracked; no staged files were present. This differs from the Phase 2.1 ledger's clean-entry statement. Those pre-existing Phase 2.1 artifacts were preserved. The difference is recorded here and in the appended ledger section rather than rewriting the historical discovery report.
- The approved route, component, feature, permissions, API path and persistence map were rechecked against current source. No PG-011 identity or behavior discrepancy required a design change.
- No branch or commit operation was performed.

## Implemented case reconciliation

| Approved disposition              | Count | Implementation                                                                                                                                         |
| --------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEW TEST REQUIRED`               |    15 | 11 mocked Playwright declarations, two API/PGlite declarations, one browser/API/PGlite declaration, and one opt-in PostgreSQL concurrency declaration. |
| `ADDITIONAL ASSERTION REQUIRED`   |    13 | One unit group, four API/PGlite groups and eight browser groups. Existing assertions remain.                                                           |
| `EXISTING COVERAGE SUFFICIENT`    |    12 | Preserved in place without duplicate declarations.                                                                                                     |
| `CONTRACT CLARIFICATION REQUIRED` |     2 | Deferred; no expected product behavior was invented.                                                                                                   |
| Total                             |    42 | All approved stable IDs reconciled in `PG-011_TEST_EXECUTION_RESULTS.md`.                                                                              |

The detailed case-to-feature mapping, source-backed preconditions, inputs, expected results, declaration/assertion references and actual outcomes are recorded in the execution-results matrix. Approved reproducible steps remain in `PG-011_TEST_CASE_SPECIFICATION.md`.

## Test-source changes

| File                                                        | Implemented work                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/test/attendance.test.mjs`                         | Added A001-T001 access assertions against the existing production attendance route-policy helper, retaining the surrounding navigation coverage.                                                                                                                                                       |
| `apps/web/e2e/leave-requests.spec.ts`                       | Added 11 mocked Leave Requests declarations covering scope, list states, search, filters, row rendering, row-action capability/keyboard behavior, request dialog, preview, cancellation, and responsive/accessibility behavior. It intentionally retains the failing keyboard assertion for A009-T002. |
| `apps/web/e2e/attendance.spec.ts`                           | Added A013-T001 real browser/API/PGlite submission coverage. Added assertions to existing navigation/deep-link, detail, reversal, transfer, stale HR, and revoked-scope declarations for A001-T002, A010-T001/T002, A016-T001, A017-T001, and A018-T001.                                               |
| `apps/api/tests/features/leave/leave-requests.test.ts`      | Added A007-T001 pagination and A014-T002 policy-coverage failure declarations. Added the approved search/filter/date/validation/overlap assertions in the existing PGlite suite. Synthetic inconsistent policy states are confined to this test database.                                              |
| `apps/api/tests/features/leave/leave-decisions.postgres.ts` | Added opt-in A020-T003 concurrent reviewer decisions against a verified disposable PostgreSQL target. The test guards database/role identity, creates only synthetic records, and cleans its temporary database objects.                                                                               |

### Additive assertion preservation

- A001-T001 uses the existing route-policy test and retains all prior assertions.
- A004-T002, A005-T002, A006-T001 and A014-T001 extend existing API/PGlite list and validation coverage without replacing prior cases.
- A009-T001 capability checks are grouped in the new row-action browser declaration; the keyboard assertion is independently identified as A009-T002.
- A001-T002, A010-T001/T002, A016-T001, A017-T001 and A018-T001 extend existing browser declarations. Existing route, notification, workflow, stale-action and access assertions remain.
- A012-T001's positive preview assertions are kept alongside the A012-T002 failure/recovery declaration and do not assert an entitlement formula.

## Isolated PostgreSQL execution

The A020-T003 race ran against a task-owned PostgreSQL 16 container mapped to loopback. The test verified database `nexus_pg011`, role `pg011_test`, zero pre-existing users/departments/leave requests, and Read Committed isolation before seeding synthetic records. All 91 repository migrations were applied to the disposable database. Two independently submitted reviewer decisions competed on one request/version; one committed and one returned the source-defined conflict. The persisted request, decision version, terminal state, and notification delta were checked. The first attempt exposed an overly narrow notification-count assumption in the test; the fixture assertion was corrected to check the winner's incremental notice. A fresh empty database rerun passed 1/1. The task-owned container was stopped and removed. This does not resolve PG-008's distinct assignment-concurrency blocker.

## Scope and limitations

- No production source, Prisma schema, migration, authentication rule, permission rule, or prior QA report was changed.
- The two deferred cases are profileless ADMIN request-button behavior (C001/A002-T003) and selected-detail behavior when filters remove its row (C002/A010-T003).
- The test results confirm a PG-011 reproduction of PG-004-D-001 at 1440 px. No shared component was modified.
- The existing Employee Directory transfer test produced a route-fetch teardown failure on one run and a missing Edit-menuitem timeout on its focused repeat. This remains intermittent; the assertions and test were not weakened or skipped.
- The opt-in PostgreSQL test is distinct from PGlite verification. Mocked browser tests do not establish persistence; A013-T001 provides the real browser-to-PGlite persistence boundary.
- No full repository regression suite was run. PG-012 was not started.

## Related reports

- [Execution results and 42-case reconciliation](PG-011_TEST_EXECUTION_RESULTS.md)
- [Regression preservation](PG-011_REGRESSION_PRESERVATION.md)
- [Final verification](PG-011_FINAL_VERIFICATION.md)

# PG-023 Final Verification

Employee Management at /employees. The continuation starts from the clean committed checkpoint 94eb190deea91197e53bc94c9ade149d8487d687 on branch 293-test-full-system-audit-for-verifying-recent-changes. The original Phase 2.2 baseline was 59167cbc03ed10cd52de2a8404e62f4366b13dfb.

The approved inventory contains 26 features, 42 cases and 39 implementable cases. All 18 planned new registrations are present. There are zero additions to retained declarations, zero additive groups and no registration variance. The primary layers remain 19 Browser, 2 Unit, 15 API/PGlite, 1 Integration and 2 PostgreSQL.

| Full case ID          | Outcome and evidence                                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PG-023-F001-A001-T001 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F002-A001-T002 | PARTIAL. Role-gate responses passed. The retained mixed-role declaration does not snapshot all three denial stores.                                                              |
| PG-023-F003-A001-T003 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F004-A001-T004 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F004-A002-T005 | PARTIAL. Intersection and pagination passed. The selected declarations do not independently cover case-insensitive matching across every search field.                           |
| PG-023-F004-A003-T006 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F006-A001-T007 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F006-A002-T008 | FAIL. Form Department remained enabled after the failed request. Submit remained guarded.                                                                                        |
| PG-023-F007-A001-T009 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F008-A001-T010 | FAIL. At 1001 CSS pixels the row stayed 188 px. Expected 58 px.                                                                                                                  |
| PG-023-F009-A001-T011 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F009-A002-T012 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F010-A001-T013 | PASS. The final focused run verified date and team, literal text, recordless display, and close/focus behavior.                                                                  |
| PG-023-F010-A002-T014 | PARTIAL. Loading, failure, retry, surviving-row focus and obsolete response isolation passed. The separate opener-removed fallback was not exercised.                            |
| PG-023-F011-A001-T015 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F011-A002-T016 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F011-A003-T017 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F012-A001-T018 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F013-A001-T019 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F014-A001-T020 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F014-A002-T021 | PASS. Valid-name fixture reached the 409, retained the draft, and refreshed on the second PUT. Department switch cleared the prior team. Payload omitted credentials and userId. |
| PG-023-F015-A001-T022 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F016-A001-T023 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F016-A002-T024 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F017-A001-T025 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F017-A002-T026 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F018-A001-T027 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F019-A001-T028 | PARTIAL. Unarchived denial and archived deletion passed, with HR retention and attribution. A restrictive-reference conflict and unchanged snapshot were not established.        |
| PG-023-F020-A001-T029 | PARTIAL. Injected-failure rollback checks passed. The selected account lifecycle snapshot does not include attendance work-session rows.                                         |
| PG-023-F020-A002-T030 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F023-A001-T031 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F023-A002-T032 | FAIL. Independent contention produced HTTP 201 and 500. Expected 201 and 409. SQLSTATE 40001. Final persistence assertions did not run.                                          |
| PG-023-F003-A002-T033 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F021-A001-T034 | PASS. The scoped department GET, member DELETE, directory reload, return to details, and reduced-permission fixture all passed in the browser.                                   |
| PG-023-F004-A004-T035 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F011-A004-T036 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F002-A002-T037 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F011-A005-T038 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |
| PG-023-F024-A001-T039 | DEFERRED CONTRACT. See the approved specification.                                                                                                                               |
| PG-023-F025-A001-T040 | DEFERRED CONTRACT. See the approved specification.                                                                                                                               |
| PG-023-F026-A001-T041 | DEFERRED CONTRACT. See the approved specification.                                                                                                                               |
| PG-023-F006-A003-T042 | PASS. See the mapped selection in execution results and regression preservation.                                                                                                 |

The 39 implementable cases reconcile to 31 PASS, 3 FAIL and 5 PARTIAL.
The partial records are T002, T005, T014, T028 and T029. There are zero wholly
unexecuted, intermittent or environment-blocked cases. The three separately
deferred records are T040/C001, T039/C002 and T041/C003. The adversarial
addendum reconciles 3 verified controls, 11 partial hypotheses and 3 blocked
by contract, within the mapped fixtures and assertion boundaries.

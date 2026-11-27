# PG-024 Final Verification

Employee Overview at /employees/overview renders EmployeeOverviewPage inside ModuleTransition. Portal admission requires ADMIN or SUPERADMIN with employees:read. Express Employee GET independently checks authentication and employees:read. Department GET requires departments:read and has its own Employee read projection boundary.

Entry and verification revision af31220286f691535a129a8effc674b506572f6a on 293-test-full-system-audit-for-verifying-recent-changes. The entry index was empty. The eight discovery reports and modified ledger were inherited.

## Approved case outcomes

| Full ID               | Outcome | Evidence                                                                                                                         |
| --------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| PG-024-F001-A001-T001 | PASS    | Corrected browser rerun, six actors and eligible refreshes.                                                                      |
| PG-024-F002-A001-T002 | PASS    | Retained API role declaration and scoped exact-query adapter.                                                                    |
| PG-024-F003-A001-T003 | PASS    | Ten page-owned GETs, exact query set and bearer header.                                                                          |
| PG-024-F004-A001-T004 | PASS    | Switch Workspace, ten Chromium aborts, released route gates and absent overview.                                                 |
| PG-024-F005-A001-T005 | PASS    | Two independent real rewrite GET paths, seeded UI and equal domain snapshots.                                                    |
| PG-024-F006-A001-T006 | PASS    | Total and optional separate archive note.                                                                                        |
| PG-024-F007-A001-T007 | PASS    | Admin and Superadmin, nine query scopes per actor and equal domain snapshots.                                                    |
| PG-024-F008-A001-T008 | PASS    | Figure values, accessible availability chart and legend.                                                                         |
| PG-024-F009-A001-T009 | PASS    | Four employment types and settled zero denominator.                                                                              |
| PG-024-F010-A001-T010 | PASS    | Retained Department projection and relation count with equal snapshots.                                                          |
| PG-024-F011-A001-T011 | PASS    | Tie ordering, zero-member display, placement total and shares.                                                                   |
| PG-024-F012-A001-T012 | PASS    | Empty successes, safe zeros and no alert.                                                                                        |
| PG-024-F013-A001-T013 | PASS    | Both release orders preserve skeletons until both sources settle.                                                                |
| PG-024-F014-A001-T014 | PASS    | Count error, retry action, exact second batch and successful settled display.                                                    |
| PG-024-F016-A001-T016 | PASS    | Corrected accessible label and named structures.                                                                                 |
| PG-024-F017-A001-T017 | PASS    | Tab focus, Enter, directory and browser Back.                                                                                    |
| PG-024-F018-A001-T018 | FAIL    | At 480 CSS px the Department Share column remained visible. 479/481/1023/1024/1025 passed. All six widths ran.                   |
| PG-024-F019-A001-T019 | PASS    | Aggregate and absence of the six row canaries in the overview main DOM.                                                          |
| PG-024-F020-A001-T020 | PARTIAL | Browser declaration passed literal benign markup and corresponding-node absence. Executable-event boundary remained unexercised. |

## Contract deferrals

| Contract    | Full deferred case    | Hypothesis       | Question                             |
| ----------- | --------------------- | ---------------- | ------------------------------------ |
| PG-024-C001 | PG-024-F010-A002-T021 | PG-024-ABUSE-005 | Failed Employee count presentation.  |
| PG-024-C002 | PG-024-F015-A001-T015 | PG-024-ABUSE-006 | Department failure recovery.         |
| PG-024-C003 | PG-024-F016-A003-T022 | PG-024-ABUSE-007 | Employee response data minimization. |
| PG-024-C004 | PG-024-F018-A001-T023 | PG-024-ABUSE-008 | Cross-request snapshot consistency.  |

## Reconciliation

18 features and 23 unique cases: 16 NEW, 0 ADDITIVE, 3 EXISTING-SUFFICIENT and 4 CONTRACT. The primary layers account for 19 implementable cases: 15 Browser, 3 API/PGlite and 1 Integration. Results are 17 PASS, 1 FAIL, 1 PARTIAL, zero blocked, intermittent or unexecuted cases. The four contract records are separate.

All 16 planned declarations were implemented, with one necessary T002 adapter for 17 actual additions and zero existing declaration extensions or additive groups. Browser selections contained 15 and 4 runner instances with overlap. API selections passed 24 and 2 runner instances with overlap. The Integration case used two independent selections with one instance each. T018's six steps are within one registration. See [attempts and viewport results](PG-024_TEST_EXECUTION_RESULTS.md).

The 13 hypotheses reconcile to four VERIFIED CONTROL (001, 002, 004, 010), five PARTIAL (003, 009, 011, 012, 013), and four BLOCKED — CONTRACT (005–008). The [assessment addendum](PG-024_ADVERSARIAL_AND_ABUSE_CASE_ASSESSMENT.md) gives actor and provider boundaries, inherited provenance and mapped evidence. The [preservation report](PG-024_REGRESSION_PRESERVATION.md) traces retained tests and historical findings.

The responsive mismatch remains a functional finding. The progression policy permits review with the retained failure and partial verification.

## Gates and final audit

An initial and final approved root sequence ran pnpm format, pnpm lint and pnpm typecheck. Each command exited 0 in both sequences. The final sequence also ran git diff --check, exit 0. Earlier discovery results remain a separate checkpoint with two supplemental pnpm store-lock failures. Outside-scope gate changes were limited to the PG-023 spec's pre-existing whitespace and Next's generated next-env.d.ts route imports. Both were restored. The next-env.d.ts SHA256 matches entry: 0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC.

The final change scope is the PG-024 ledger row and continuation, the two new test files, four execution reports and the assessment execution addendum. The eight discovery reports were inherited and the seven non-assessment files retain their entry hashes. The assessment's discovery content retains its entry bytes. HEAD, branch and empty index were verified at closeout.

Browser and PGlite teardown completed. The six owned loopback ports 5273, 5274, 5283, 5284, 5285 and 5286 had no listeners after execution. The two integration fixture build directories run-fjripE and run-hNb72J remained after runner exit and were removed after checking ownership and resolved paths. No database container was provisioned.

## Comprehensive coverage reconciliation

This documentation audit maps recorded Phase 2.2 assertions to the [ten-category matrix](PG-024_TEST_CASE_SPECIFICATION.md#comprehensive-testing-coverage-matrix). It adds no runtime evidence. Full case IDs and the individual outcomes appear above.

| Category       | Reconciled assertion evidence and limits                                                                                                                                                                                                                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional     | PG-024 Chromium mocks verified the exact ten page-owned GETs, separate archived count, figures, shares, department ordering and directory navigation. The mock supplied the responses. T007 and T010 separately exercised server totals and relations in PGlite.                                                                                                                  |
| Negative       | T001 exercised six actor variants and observed zero matched page data requests for denied actors. T002 exercised real Express 401/403 and checked the 403 payloads for absence of an Employee array. T014 used a synthetic 503. Malformed filter assertions are retained PG-023 T004 evidence. T015 and T021 are contract-blocked.                                                |
| Edge case      | T007 exercised both privileged actors across nine filter scopes. T009/T011/T012 covered zero shares, ordering and empty state. T013 held each source in turn. T018 reached all six widths and failed the approved Share expectation at 480 CSS px.                                                                                                                                |
| Security       | T001's mock verifies UI admission. T002 and T010 exercise backend role/permission and projection boundaries in Express/PGlite. T019 excludes six canaries from the rendered main DOM while the mock still delivers row fields. T020 reached literal rendering and absence of the markup node. Executable-event behavior remains unverified. API payload minimization is deferred. |
| Abuse case     | The existing assessment addendum records four verified controls, five partial hypotheses and four contract blockers. Direct endpoint access, fixed request fan-out and cancellation have scoped evidence. No mid-flight role change, stored-input execution, sustained refresh or load budget assertion ran for PG-024.                                                           |
| Data integrity | T002/T007/T010 and both T005 rewrite paths reached the recorded equal-snapshot assertions. These cover the checked records in their respective fixtures and runs. No page-wide atomic snapshot or absence of session bookkeeping is established.                                                                                                                                  |
| Concurrency    | T013 exercised read settlement order. T004 observed ten Chromium aborts on in-app exit and checked that the overview stayed absent. This uses gated mocked responses. No PostgreSQL contention or concurrent write evidence was collected for PG-024. T023 remains contract-blocked.                                                                                              |
| Recovery       | T014 observed the retry control after the mocked failure, a new nine-request set, successful results and the removal of the error. T004 exercised recovery on navigation away. Department recovery and failed count presentation remain deferred.                                                                                                                                 |
| Accessibility  | T008/T016 verified chart and structural names. T017 used Tab and Enter on the actual link and exercised browser Back. T018 retained the width failure and independent readability/grid assertions. These are the specified checks, with no broader accessibility conformance claim.                                                                                               |
| Integration    | The two Phase 2.2 T005 selections re-executed retained declarations through actual loopback Next → Express → disposable PGlite. Backend receives, seeded UI and checked snapshots passed on the independent paths. The approved integration scope leaves a combined overview render unverified.                                                                                   |

T018 already uses soft assertions to collect all six viewport results while preserving its failure. The passing API and integration snapshots were reached in the cited runs. Their declarations still place some snapshots after hard response checks, so a future early failure could leave those snapshots unverified. For future approved scenarios that require independent persistence or security evidence, collect each boundary in separately reported checks, then surface the original failure and any independent failures. Missing observations keep their unreached status. This audit preserves the existing 17 PASS, 1 FAIL, 1 PARTIAL and four deferrals. No serious security or data-integrity incident is confirmed by the evidence reviewed here.

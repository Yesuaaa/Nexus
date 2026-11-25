# PG-011 Regression Preservation

## Baseline preserved

The repository remained on branch `293-test-full-system-audit-for-verifying-recent-changes`, HEAD `9b4d3936d425d4c743bea6bc021f0daf10b585d6`. No staged change was present at task entry. The already-modified cumulative ledger and untracked seven-file PG-011 Phase 2.1 directory were preserved; they were not treated as Phase 2.2 output or overwritten. This task-entry state differs from the clean worktree recorded by the prior Phase 2.1 entry and is reconciled in the new ledger section.

### Baseline executions recorded before implementation

| Baseline                        | Observed outcome                                        | Limitation                                                                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web attendance unit file        | 9/9 passed.                                             | Test presence/pass result is limited to this focused unit file.                                                                                                                                           |
| API leave-request PGlite file   | 28/28 passed.                                           | Isolated PGlite; not PostgreSQL concurrency evidence.                                                                                                                                                     |
| Four selected browser workflows | Two passed, one callback teardown failure, one skipped. | The pre-edit shell invocation was not retained; exact scenario names and the observed results were preserved in the task notes. Do not treat the initial pass as proof the route-fetch issue is resolved. |

The two test-file commands retained from the task record are listed with the post-change run in `PG-011_TEST_EXECUTION_RESULTS.md`. No passing claim is inferred from declarations alone.

## Original declarations and assertions retained

| Existing source                                                                 | Preserved coverage                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/tests/features/leave/leave-requests.test.ts`                          | Existing PGlite request creation, mine/team scope, validation, list/detail access, idempotency/replay, staged Head and HR review, rejection/cancellation/reversal, ownership and denial, notifications, department transfer/reverification, stale actions, attendance conflict, approval snapshots, and downstream attendance/report/calendar effects. API file changed additively; existing expectations were not deleted or weakened. |
| `apps/web/e2e/attendance.spec.ts`                                               | Existing deep-link/notification navigation, transfer and receiving-Head reverification, stale HR conflict refresh, revoked-scope detail clearing and leave-related review workflows. The same declarations gained only the approved PG-011 assertion groups; no declaration was renamed or skipped.                                                                                                                                     |
| `apps/web/test/attendance.test.mjs`                                             | Existing attendance navigation role/module assertions remain. A001-T001 extends the production-helper matrix in the same declaration.                                                                                                                                                                                                                                                                                                   |
| `apps/web/e2e/superadmin-attendance.spec.ts` and shared route-policy/menu tests | Inspected as compatibility evidence; no changes made. Their historical scope was not represented as a PG-011 pass without a relevant run.                                                                                                                                                                                                                                                                                               |
| Shared PGlite and browser fixtures                                              | Existing fixtures and authenticated identities remain. New fixtures are local to the PG-011 declarations; no shared fixture behavior was weakened.                                                                                                                                                                                                                                                                                      |

All 12 cases classified `EXISTING COVERAGE SUFFICIENT` remain preserved: A002-T002, A013-T002, A014-T003, A016-T002, A017-T002, A019-T001, A020-T001, A020-T002, A021-T001, A022-T001, A022-T002, and A023-T001. Their test names, locations, environments, and current results are listed in the per-case execution matrix.

## Additive assertion groups and original coverage

| Case                              | Original assertion retained                                              | New assertion added                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A001-T001                         | Attendance navigation ownership and role coverage in the Node unit test. | Canonical Leave route evaluated using the production route-policy helper for STAFF, ADMIN, permissioned/unpermissioned SUPERADMIN, USER and inactive accounts.    |
| A001-T002                         | Existing Superadmin direct URL and notice deep-link workflow.            | Ordinary Staff navigation through Requests & Approvals > Leave and direct canonical route check.                                                                  |
| A004-T002 / A005-T002 / A006-T001 | Existing API leave list query/filter cases.                              | Approved search normalization/scope/limit, filter composition, and paired inclusive-date boundary assertions.                                                     |
| A009-T001                         | Existing role/capability API coverage.                                   | Browser row-action menu content compared with API-supplied capabilities; pointer menu path remains checked separately from keyboard opening.                      |
| A010-T001                         | Existing detail deep-link and notification workflow.                     | Read-only summary, policy-coverage, decision-history content and absence of a decision-note form.                                                                 |
| A010-T002                         | Existing detail refresh and revocation workflow.                         | Scoped 404 response body and stale private detail removal.                                                                                                        |
| A012-T001                         | Existing preview and submission service coverage.                        | Positive, response-derived covered-day/hour rendering retained alongside A012-T002 preview failure/recovery. No entitlement algorithm is duplicated.              |
| A014-T001                         | Existing API request validation declarations.                            | Direct body, date, reason, enum and boundary rejection matrix.                                                                                                    |
| A016-T001                         | Existing Employee Directory transfer and review workflow.                | Review action ID/version/note payload and resulting response state. The group was reached and passed once, but the test remains intermittent across focused runs. |
| A017-T001                         | Existing stale HR approval conflict workflow.                            | Original stale request payload and absence of false approval success feedback.                                                                                    |
| A018-T001                         | Existing UI/API review coverage.                                         | Reverse approval confirmation-before-write, submitted note/version and refreshed Reversed state.                                                                  |

## Test execution and failure preservation

- Focused API/PGlite leave verification passed 30/30 after the approved additions; the original 28-case baseline file coverage remains and two nested declarations were added.
- Focused web unit verification passed 9/9.
- The new mocked Leave Requests file ran 10/11. A009-T002 remains failing with the PG-011-specific keyboard menuitem omission; its assertion is not skipped, softened, or removed. A009-T001 pointer capability assertions passed within the same declaration.
- The real-browser A013-T001 submission/persistence workflow passed 1/1 against PGlite.
- Existing direct-link/notification/reversal, stale-HR and revoked-scope browser checks passed focused runs. The transfer workflow had one teardown failure and a later menu-item timeout; both observations are retained as intermittent instead of reporting the prior one-run pass alone.
- The A020-T003 PostgreSQL race passed 1/1 against a verified disposable PostgreSQL 16 database. It is separate from the PG-008 assignment-concurrency scenario and does not close that blocker.
- The first PostgreSQL attempt revealed a test expectation issue around notification fan-out. Only the new test assertion was corrected against source behavior; no production behavior or existing regression expectation changed.

## Historical Phase 2 findings remain open

The cumulative ledger sections for PG-001 through PG-010 were not rewritten. In particular:

- PG-001 whitespace-only token behavior remains contract-blocked.
- PG-002 create/edit/API validation differences and unauthorized-list navigation remain unresolved.
- PG-003 query/navigation state remains contract-blocked.
- PG-004-D-001 remains the confirmed shared keyboard row-action defect. PG-011 is now a reproduced affected page at 1440 px.
- PG-005 cleared-date and detail-panel filter-state behavior remain contract-blocked.
- PG-006 remains implementation complete with partial verification: T018 menu defect; T024 820 px intermittency; T025/C001 date/timezone contracts; profileless ADMIN 409 recovery limitation.
- PG-007 cleared-date and suspended-session semantics remain deferred.
- PG-008 remains partially verified: shared menu defect, separate assignment-concurrency blocker, 390 px fixture failure and seven-nonworking-days contract remain. PG-010's PostgreSQL test does not resolve PG-008's separate concurrency case; PG-011's PostgreSQL run does not change that status either.
- PG-009 reporting/counter wording and canceled-assignment count contracts remain deferred; no PG-009 defect is newly claimed.
- PG-010 remains implementation complete with partially complete verification: 34/35 executable cases passed; T035 menu reproduction, T036 wording contract and T032 disposable PostgreSQL pass remain as reported.

PG-011 C001 (profileless ADMIN request-button behavior) and C002 (selected panel when filters remove its row) remain contract-blocked. No earlier finding was silently closed or reclassified.

## Scope audit

The only source changes are automated test files under `apps/api/tests/` and `apps/web/test/` or `apps/web/e2e/`. No production application source, shared component, auth/permission source, Prisma schema, migration, or prior-page QA report was changed. The incidental Next.js-generated `apps/web/next-env.d.ts` reference change is restored to its task-entry contents after quality checks. No relevant test was deleted, renamed, weakened, or newly skipped.

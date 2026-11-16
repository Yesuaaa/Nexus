# Phase 7.3 Backend and API Reliability Verification

**Verification date:** 2026-11-11  
**Branch:** 219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages  
**Source HEAD:** 4e98092d0bfedcad679db92f701efad9ace768e9  
**Status:** COMPLETE — WITH VERIFIED DEFECTS OR ACCEPTED LIMITATIONS

## 1. Executive Summary

Phase 7.3 reconciled and executed all 28 API test modules with Node.js built-in test runner. Nineteen modules use isolated PGlite databases; nine use unit, mock, or in-process server state. The API compile and Prisma generation passed. The initial serial suite ran all 28 modules and exited 1.

Node TAP reported 184 test entries: 181 passed and three failed entries. The three include one failing nested-suite parent, so they represent two unique leaf failures: an app bootstrap test run under the suite's local-only database sentinel, and one request-workflow test. A targeted app rerun with database variables absent passed. A targeted request-workflow rerun reproduced a test defect. After separating those outcomes, 169 of 170 unique leaf cases passed and one failed. No test was skipped or marked todo; no module was blocked.

The request-workflow failure is caused by the test reading internal milestones from a client response that intentionally returns an empty milestone array. No application or existing test source was changed. The five deferred live-backend browser cases were assessed and not run because no disposable live API database was verified.

## 2. Git Baseline

| Check         | Initial                                                                                          | Final                                                  |
| ------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Branch        | 219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages | Same                                                   |
| HEAD          | 4e98092d0bfedcad679db92f701efad9ace768e9                                                         | Same                                                   |
| Latest commit | test: add project workspace API tests and billing/project E2E specs                              | Same                                                   |
| Working tree  | Phase 7.2 report untracked                                                                       | Phase 7.2 report preserved; new Phase 7.3 report added |

The Phase 7.2 report at docs/testing/verification/phase7/phase7.2-page-verification.md was untracked at the start and was preserved without modification. The only new unignored file from this phase is this report. Phase 7.3 test evidence, Prisma generated client, and API dist output are ignored. No application source, existing test, assertion, migration, or Git history was changed.

## 3. Backend Test Architecture

The API package is an ES module package using Node.js built-in node:test. Its test script runs Prisma generation, TypeScript compilation, and node --test against 28 explicit compiled test files. The test:regression script delegates to test through pnpm. Package script and source-file inventories both contain the same 28 modules.

The tests do not require a separately running API service. Integration modules import the app and listen on an ephemeral loopback port, then issue HTTP requests to that in-process server. PGlite integration modules create an in-memory database and a PGLiteSocketServer on 127.0.0.1 with port 0. They use repository migration SQL or a focused migration subset. Tests register teardown to stop the socket and close the database. Pure and mocked modules do not start a database service.

The suite has no skip, todo, or only markers. The run serialized modules with Node's test-concurrency set to 1. Tests within a module use Node's default sequential scheduling; some integration tests intentionally share a module-scoped PGlite fixture.

## 4. Environment Readiness

| Item                           | Result                                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Node.js                        | v24.16.0                                                                                                               |
| Workspace package manager      | Pins pnpm 12.7.0; installed pnpm is 12.15.0 and reports ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK                         |
| API test runner                | Node.js built-in node:test                                                                                             |
| Prisma                         | Client generation completed with Prisma 7.10.1                                                                         |
| API TypeScript build           | Passed using the installed TypeScript compiler                                                                         |
| Workspace Prettier             | Passed using the installed local Prettier executable                                                                   |
| Workspace ESLint               | Passed using the installed local ESLint executable with --max-warnings 0                                               |
| API TypeScript noEmit          | Passed using the installed local TypeScript compiler                                                                   |
| Web route types and TypeScript | Next.js type generation and web TypeScript noEmit both passed                                                          |
| Separate API service           | Not required and not started                                                                                           |
| Database URLs at start         | DATABASE_URL and DIRECT_URL were absent from the current process                                                       |
| Test-runner database guard     | Test subprocesses received only a loopback port-1 sentinel; PGlite fixtures replaced it with their isolated socket URL |
| External service credentials   | Supabase URL/key were absent from the current process; tests use fixtures or mocks                                     |
| Live browser environment       | NEXUS_E2E_LIVE and NEXUS_E2E_BASE_URL were absent                                                                      |
| Live account secrets           | Five required password keys were present in the local regression env file; values were not read or printed             |

The root pnpm test:regression command was not used because the package manager's previously documented global store-lock failure remains. Instead, the equivalent package-local workflow ran Prisma generation, TypeScript compilation, and the exact 28 compiled test paths from apps/api/package.json. Generation and compilation exited 0. The repository-wide Prettier check and ESLint check, API TypeScript noEmit check, Next.js route type generation, and web TypeScript noEmit check were also run with installed local executables; all exited 0. The pnpm root scripts remain unavailable under the observed global store-lock error.

The first reporter attempt requested JSON, which this installed Node test runner does not provide as a built-in reporter. It exited 7 with ERR_MODULE_NOT_FOUND before any API module ran. The diagnostic is preserved in test-results/phase7/phase7.3/json-reporter-attempt.stderr.txt. The suite then ran once with the built-in TAP reporter.

## 5. API Inventory

The package script and current source both contain 28 test modules: 19 PGlite modules and nine non-PGlite modules. The matrix counts unique leaf cases, excluding a parent test entry when that entry only groups nested cases. The raw TAP report counts both parents and children.

| Module                                         | API domain                                                   | Database                                  | Leaf cases | Passed after triage | Failed | Skipped | Not run | Status                                                     |
| ---------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------- | ---------: | ------------------: | -----: | ------: | ------: | ---------------------------------------------------------- |
| src/api-system-regression.test.ts              | Cross-cutting API and security contracts                     | PGlite                                    |          6 |                   6 |      0 |       0 |       0 | PASS                                                       |
| src/app.test.ts                                | API bootstrap, health, and error responses                   | None; test removes DATABASE_URL           |          1 |                   1 |      0 |       0 |       0 | PASS after corrected rerun                                 |
| src/backend-regression.test.ts                 | Authentication, authorization, persistence across API routes | PGlite                                    |         28 |                  28 |      0 |       0 |       0 | PASS                                                       |
| src/calendar.test.ts                           | Calendar role, assignment, and department-head scope         | PGlite                                    |          1 |                   1 |      0 |       0 |       0 | PASS                                                       |
| src/client-integration.test.ts                 | Client directory, ownership, and related resources           | PGlite                                    |          9 |                   9 |      0 |       0 |       0 | PASS                                                       |
| src/client-requests.test.ts                    | Client service-request lifecycle and migrations              | PGlite                                    |         11 |                  11 |      0 |       0 |       0 | PASS                                                       |
| src/employee-integration.test.ts               | Employees, linked accounts, and departments                  | PGlite                                    |         21 |                  21 |      0 |       0 |       0 | PASS                                                       |
| src/features/auth/auth.jwt.test.ts             | JWT claims, signature, and expiry                            | None; pure unit test                      |          1 |                   1 |      0 |       0 |       0 | PASS                                                       |
| src/features/auth/auth.test.ts                 | Password and registration helpers                            | None; pure unit tests                     |          3 |                   3 |      0 |       0 |       0 | PASS                                                       |
| src/features/auth/employee-permissions.test.ts | Employee permissions and middleware                          | None; in-process Express                  |          1 |                   1 |      0 |       0 |       0 | PASS                                                       |
| src/features/auth/session-location.test.ts     | Client IP and trusted-proxy behavior                         | None; mocked fetch                        |          1 |                   1 |      0 |       0 |       0 | PASS                                                       |
| src/features/employees/validation.test.ts      | Employee create/update validation                            | None; pure unit tests                     |          5 |                   5 |      0 |       0 |       0 | PASS                                                       |
| src/features/services/validation.test.ts       | Service, image, pricing, and package validation              | None; pure unit tests                     |          5 |                   5 |      0 |       0 |       0 | PASS                                                       |
| src/features/users/account-password.test.ts    | Password changes and session revocation                      | PGlite                                    |          1 |                   1 |      0 |       0 |       0 | PASS                                                       |
| src/features/users/account-restore.test.ts     | Restore and account status                                   | PGlite                                    |          1 |                   1 |      0 |       0 |       0 | PASS                                                       |
| src/features/users/account-status.test.ts      | Status, deletion, and login                                  | Mock repository; loopback port-1 sentinel |          1 |                   1 |      0 |       0 |       0 | PASS                                                       |
| src/features/users/role-policy.test.ts         | Fixed roles and account hierarchy                            | None; in-process Express                  |          6 |                   6 |      0 |       0 |       0 | PASS                                                       |
| src/jwt-session.test.ts                        | JWT rotation, replay, and revocation                         | PGlite                                    |         10 |                  10 |      0 |       0 |       0 | PASS                                                       |
| src/lib/database-read.test.ts                  | Database read retries and latency                            | PGlite                                    |          3 |                   3 |      0 |       0 |       0 | PASS                                                       |
| src/login-validation.test.ts                   | Login and registration input contracts                       | PGlite                                    |          5 |                   5 |      0 |       0 |       0 | PASS                                                       |
| src/profile.test.ts                            | Profile scope and employee synchronization                   | PGlite                                    |          1 |                   1 |      0 |       0 |       0 | PASS                                                       |
| src/project-conversations.test.ts              | Project conversation membership and unread state             | PGlite                                    |          2 |                   2 |      0 |       0 |       0 | PASS                                                       |
| src/project-workspace.test.ts                  | Workspace lifecycle and persisted transitions                | PGlite                                    |          6 |                   6 |      0 |       0 |       0 | PASS                                                       |
| src/request-conversations.test.ts              | Conversation chronology, access, and concurrency             | PGlite                                    |         10 |                  10 |      0 |       0 |       0 | PASS                                                       |
| src/request-inbox.test.ts                      | Department-head routing and acceptance                       | PGlite                                    |          9 |                   9 |      0 |       0 |       0 | PASS                                                       |
| src/request-workflow.test.ts                   | Requirements, quotations, payment, staffing, and activation  | PGlite                                    |         17 |                  16 |      1 |       0 |       0 | TEST_DEFECT reproduced                                     |
| src/service-specialists.test.ts                | Specialist catalog and client booking                        | PGlite                                    |          4 |                   4 |      0 |       0 |       0 | PASS                                                       |
| src/settings.test.ts                           | Preference persistence and session isolation                 | PGlite                                    |          1 |                   1 |      0 |       0 |       0 | PASS                                                       |
| **Total unique leaf cases**                    |                                                              | **19 PGlite / 9 other**                   |    **170** |             **169** |  **1** |   **0** |   **0** | **27 modules pass after triage; 1 contains a test defect** |

All 28 modules were selected by the existing package test script and executed. The module table excludes the five separate browser live-backend cases.

## 6. Database Safety Assessment

The 19 PGlite modules instantiate PGlite in memory, bind the PostgreSQL-compatible socket bridge to loopback on an ephemeral port, set DATABASE_URL to that bridge, and close the socket/database in test teardown. The modules use the tracked migrations or focused migration SQL against newly created in-memory state. Tests that reuse a fixture do so within their module; serial file execution prevents cross-module process environment or database state from overlapping.

The remaining nine modules were inspected individually:

- app.test.ts verifies the API with DATABASE_URL removed and an in-process server.
- auth, JWT, permission, employee validation, and service validation tests use pure functions or in-process middleware.
- session-location.test.ts replaces the geolocation fetch with a test function.
- account-status.test.ts injects mocked repository functions and uses a non-listening loopback sentinel URL.
- role-policy.test.ts starts only ephemeral in-process Express servers.

No module required a production, remote, or shared development database. No database server, migration, reset, truncate, external seed, or persistent data write was performed. The only initial failure affected app.test.ts because the suite-wide sentinel conflicted with its explicit missing-DATABASE_URL setup; the corrected targeted run passed with both database URL variables absent.

The single serial run found no cross-module state leakage. It does not prove order independence: randomized or parallel execution was not performed, and some module tests intentionally share fixture state.

## 7. Execution Results

### Commands and outcomes

From apps/api, local package tools ran:

1. Prisma generation using node node_modules/prisma/build/index.js generate, with both database URLs set only to a loopback port-1 sentinel: exit 0.
2. API compilation using node node_modules/typescript/lib/tsc.js: exit 0.
3. The exact 28 compiled test paths from the package test script using node --test --test-concurrency=1 --test-reporter=tap --test-reporter-destination=<api-suite.tap>: exit 1 after 108.711 seconds.

The full suite JSON summary and module mapping are in test-results/phase7/phase7.3/execution-summary.json and api-module-matrix.json. Raw TAP, stdout, and stderr are preserved in the same directory. Stdout and stderr files are empty because the TAP reporter wrote directly to its report file.

### Aggregate reconciliation

| Result view                                                  | Tests | Passed | Failed | Skipped/todo |                              Exit |
| ------------------------------------------------------------ | ----: | -----: | -----: | -----------: | --------------------------------: |
| Initial Node TAP entries, including suite parents            |   184 |    181 |      3 |            0 |                                 1 |
| Initial unique leaf cases, excluding 14 parent suite entries |   170 |    168 |      2 |            0 |                                 1 |
| Unique leaf cases after the two targeted diagnostics         |   170 |    169 |      1 |            0 | Initial full-suite exit remains 1 |

The initial three TAP failures were the app test, the request-workflow failing subtest, and its parent suite roll-up. They represent two unique failed leaf cases. The app test passed when rerun with the environment it asserts. The request-workflow test failed again. Targeted rerun results are kept separate and are not added to unique test totals:

| Targeted module                                 | Result                                                  | Exit | Evidence                                                         |
| ----------------------------------------------- | ------------------------------------------------------- | ---: | ---------------------------------------------------------------- |
| app.test.ts, DATABASE_URL and DIRECT_URL absent | 1 passed                                                |    0 | test-results/phase7/phase7.3/targeted-app-no-db.tap              |
| request-workflow.test.ts, isolated PGlite       | 16 passed, 1 leaf case failed; parent suite also failed |    1 | test-results/phase7/phase7.3/targeted-request-workflow-rerun.tap |

## 8. Functional API Contract Coverage

The executed modules provide evidence for these existing contracts:

- **Authentication and RBAC:** JWT claims, login/registration input, session rotation/replay/revocation, role hierarchy, account state, and protected route behavior have assertions across auth, account, backend, and API-system modules.
- **Validation:** Employee and service field validation, login/registration input, request details, attachment IDs, quotation values, and workflow transitions are asserted by existing tests.
- **Persistence and integrity:** PGlite integration tests verify client, employee, service-request, project, conversation, settings, profile, and account records against real migration schemas in disposable databases. Migration tests preserve legacy request status and approval history.
- **Authorization and ownership:** Tests assert role restrictions, client ownership, department-head scope, project membership, conversation membership, and access to user/account records.
- **Error handling:** Tests cover unauthenticated/forbidden/not-found responses, malformed JSON, unavailable database responses, invalid states, and rejected writes.
- **Concurrency and idempotency:** Existing request/conversation and workflow tests cover concurrent acceptance or activation, retry behavior, and state/version checks.

These claims are limited to the assertions that ran. No endpoint, branch, or line coverage percentage was calculated. A passing API suite does not establish complete authorization/security coverage, and the request-workflow defect leaves later milestone assertions in that scenario unexecuted.

## 9. Defect and Failure Register

| Finding         | Module / endpoint                                      | Expected and observed behavior                                                                                                                                                                                                                                                                                                                             | Classification / confidence                                    | Evidence and recommended action                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API-TEST-001    | request-workflow.test.ts; client GET /api/projects/:id | After activation, the test confirms two ProjectMilestone records exist, requests the project as the client, then reads milestones[0].id. The response intentionally contains milestones: [] for a client, so the test throws “Cannot read properties of undefined (reading 'id')” before its later milestone assertions. Reproduced in the targeted rerun. | TEST_DEFECT; high confidence                                   | Initial and targeted TAP: test-results/phase7/phase7.3/api-suite.tap and targeted-request-workflow-rerun.tap. Source behavior: apps/api/src/features/projects/projects.service.ts returns an empty milestone list for clients; apps/api/src/project-workspace.test.ts also asserts that client view. Keep client visibility restrictions and obtain the milestone ID through the seeded fixture or an authorized staff view in a separately approved test correction. |
| API-HARNESS-001 | app.test.ts; /api/db-check                             | The initial suite supplied DATABASE_URL=127.0.0.1:1 while this test expects the variable to be absent. It observed the unavailable response without the expected “DATABASE_URL is not configured” message. With DATABASE_URL and DIRECT_URL absent, the test passed.                                                                                       | ENVIRONMENT_FAILURE; confirmed and corrected by targeted rerun | Initial assertion in api-suite.tap; corrected result in targeted-app-no-db.tap. Run this module without the suite-wide sentinel in future invocations.                                                                                                                                                                                                                                                                                                                |

The request-workflow test is the only persistent failing leaf scenario. No application defect, authorization defect, data integrity failure, flaky result, or external-service failure was verified. The initial app failure is preserved in the raw full-suite evidence but is not classified as an application failure.

## 10. Deferred Live-Backend Cases

The five cases remain in apps/web/e2e/regression/live-backend.spec.ts and were not executed in Phase 7.3:

| Test identity                                        | Behavior and dependencies                                                                                      | Eligibility                             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| SUPERADMIN logs in and validates real feature access | Live login/session checks; Accounts, Departments, Employees, Services, Clients; direct API authorization reads | BLOCKED_DATA_SAFETY; defer to Phase 7.5 |
| ADMIN logs in and validates real feature access      | Live login/session checks and role-denied/allowed feature reads across those routes                            | BLOCKED_DATA_SAFETY; defer to Phase 7.5 |
| STAFF logs in and validates real feature access      | Live login/session checks, department access, feature denial, and API reads                                    | BLOCKED_DATA_SAFETY; defer to Phase 7.5 |
| USER logs in and validates real feature access       | Live login/session checks, client service catalog, and feature/API access reads                                | BLOCKED_DATA_SAFETY; defer to Phase 7.5 |
| deactivated account cannot establish a session       | Requires the provisioned deactivated account and live authentication service                                   | BLOCKED_DATA_SAFETY; defer to Phase 7.5 |

The cases require NEXUS_E2E_LIVE=1, a running web/API environment, and provisioned accounts. The five password keys exist in the local regression env file, but their values were not read; no live base URL or dedicated disposable database was configured. The role scenarios create/revoke authentication sessions and query several live resources. Their target database could not be verified as disposable, so execution would violate the data-safety prerequisite. Run them in the later live end-to-end phase after a dedicated test database and accounts are verified.

## 11. Historical Reconciliation

- **Preservation baseline:** 292 historical browser identities, 1,630 assertion sites, and 4,211 mappings remain the accepted Phase 6 reconciliation. Phase 7.3 did not change any historical artifact or test.
- **Phase 7.2:** 319 browser cases passed and two NEX-017 notification assertions failed. API results are separate; these tests do not resolve the frontend notification issue.
- **NEX-006:** API project-workspace lifecycle tests do not make the inaccessible browser wizard available or verify that journey.
- **NEX-015:** Assignment and reassignment remain supported; team-lead removal remains intentionally unsupported. No removal defect was asserted.
- **NEX-017:** The two Sileo notification failures remain open as frontend findings; the API suite did not modify or reclassify them.
- **Request Inbox:** Existing API tests exercise department-head routing and acceptance. The accepted successful decline/delete contract gap remains unresolved; no success behavior was invented.

## 12. Reliability Assessment

All 28 API modules executed in one serial run with isolated module processes. Nineteen used disposable PGlite, nine did not use persistent database state, and all fixtures completed teardown. No tests were skipped or marked todo. The request-workflow defect reproduced once in the full suite and once in its targeted rerun; this is a reproducible test defect, not flaky behavior.

A pg client deprecation warning appeared during the full suite and targeted request-workflow rerun: client.query() was called while another query was executing. The tests continued, and the warning's exact originating call was not isolated. Review the PGlite socket/pg interaction before upgrading to pg 9; no source change was made.

The TAP reporter attempt is the only test-runner setup failure. It ran no modules and was replaced with the installed built-in TAP reporter. No browser suite, standalone API service, persistent database, or external API was started.

## 13. Phase 7.3 Acceptance Assessment

**Administrative phase status: complete with one reproducible test defect and five safely deferred live-browser cases.** The current Git baseline, test architecture, all 28 modules, database dependencies, and safe execution conditions were reconciled. Every safe API module ran. The app harness mismatch was corrected by a targeted rerun; the request-workflow test defect was reproduced and documented. Results and evidence are recorded without changing source or assertions.

The API suite is **not fully passing**: one unique request-workflow test case remains failed. The full-suite initial exit code remains 1 in preserved evidence. The five deferred live cases require a verified disposable live database and belong to a later end-to-end phase.

## 14. Phase 7.4 Readiness

Phase 7.4 can proceed with cross-page/integration planning after the request-workflow test contract is corrected under separate authorization. Use a disposable database for live browser cases; the local PGlite API suite does not supply the provisioned live accounts required by those cases. Keep the Phase 7.2 NEX-017 notification findings visible.

Phase 7.4 has not started. No combined browser/API suite or Phase 7.5 live execution was performed.

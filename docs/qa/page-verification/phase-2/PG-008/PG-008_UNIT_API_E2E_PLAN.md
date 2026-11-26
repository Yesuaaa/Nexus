# PG-008 Unit, API, Browser, and Integration Plan

## Implementation boundary

This is a future Phase 2.2 plan only. No test or fixture files were created in Phase 2.1. Obtain separate Phase 2.2 authorization before implementing or executing any proposed test. Preserve all existing test declarations and assertions in PG-001 through PG-007 and the shared attendance suite.

## Proposed files and changes

| File                                                                         | Planned action                                                                                                                                                                                                                                                                                                           | Cases                                                                                       |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| apps/web/test/attendance.test.mjs                                            | Add the exact canConfigureAttendance account matrix to the existing Attendance navigation test group.                                                                                                                                                                                                                    | A001-T001                                                                                   |
| apps/web/e2e/attendance-policy-assignment.spec.ts                            | Add scoped-mock cases for denied/allowed route, initial list retry, search page reset and stale responses, keyboard row menu, edit failure, picker loader retry, duplicate confirmation, and assignment detail retry. Keep the existing test.skip(live) guard and do not broaden live-mode mocking.                      | A001-T002; A002-T002; A003-T002/T003; A007-T001; A013-T002; A014-T002; A015-T003; A022-T001 |
| apps/web/e2e/attendance.spec.ts                                              | Add only focused assertions to the existing real fixture where possible: exact initial policy query, row timezone/assignment count, and assigned-timezone readOnly state. Add a real-search integration case with at least 12 policies if no API/browser mock can exercise both server matching and page reset reliably. | A002-T001; A006-T001; A013-T001; optional A003-T002 if real API boundary is needed          |
| apps/api/tests/features/attendance/policy-management.test.ts                 | Extend assignment-directory fixture/assertions to cover pages and status projection; add separate nested PGlite cases for directory search/order and policy/assignment input boundaries. Keep the current staff 403, assigned-timezone 409, same-ID update, history, archive, deletion, and audit assertions.            | A003-T001; A005-T001; A009-T001; A012-T002; A015-T002                                       |
| apps/api/tests/features/attendance/policy-assignment-concurrency.postgres.ts | Propose an opt-in PostgreSQL-only integration file for the employee-row-lock race. The file does not exist yet. Require a dedicated fresh loopback database and explicit opt-in environment variable; fail closed if the host/database does not match the fixture allowlist.                                             | A025-T001                                                                                   |

No production code, Prisma schema, migration, shared fixture, or authentication rule is needed for the authorized source-backed cases. If a test cannot be implemented without changing production behavior or making a product decision, document that dependency and stop at the proposed case.

## Test boundaries and fixtures

### Unit

- Exercise production canConfigureAttendance and attendancePolicyDays/attendanceTimeZone helpers directly.
- Keep account role and active-state data explicit; do not duplicate the helper algorithm inside tests.
- Existing fixed-schedule and foundation validator tests already cover most pure validation behavior. Preserve those assertions; add only an omitted exact boundary where justified.

### API/PGlite

- Reuse apps/api/tests/support/pglite-app.ts. It starts the actual Express application against isolated in-memory PostgreSQL-compatible PGlite and applies migrations.
- Create test users, employee profiles, policies, weekday rows, assignments, workdays, and leave records in the isolated fixture only.
- Use the injected attendance clock for effective dates and calculated assignment statuses.
- Assert both HTTP response and persisted state/audit counts for denied mutations.
- Test authentication/authorization directly through the API; do not treat a hidden page as API enforcement.
- The current policies list handler is transactional with RepeatableRead. Keep pagination expectations at the public request/response boundary, not an internal query mock.

### Mocked Playwright

- Use scoped page.route handlers for deterministic list, employee, policy-choice, assignment-detail, and mutation responses.
- Use deferred promises for stale requests and duplicate submit checks; release all held routes in finally/teardown to avoid hung workers.
- Assert browser query strings and payloads, busy/error/retry state, visible rows, menu/dialog semantics, and focus.
- A mocked Playwright response is not evidence of persistence or backend authorization.
- Keep the explicit live-mode skip for attendance-policy-assignment.spec.ts; execute that spec in normal offline/mock mode.

### Browser/API/PGlite integration

- Reuse the existing Attendance browser server and fixed-clock fixture in attendance.spec.ts for create, edit, assign, replace, archive, restore, and delete workflows.
- Confirm the test server points to the isolated PGlite fixture. Do not use .env.regression.local credentials or a configured application database.
- Keep attendance.spec.ts serial (it configures serial mode at line 13) because the fixture and attendance clock are shared.
- The integrated create/assignment cases establish state across Next.js -> same-origin /api proxy -> Express -> Prisma -> PGlite. Do not count the scoped mock suite as persistence coverage.

### PostgreSQL concurrency

- PGlite tests remain the default offline API environment. Employee row-lock correctness is database-specific; a separate opt-in PostgreSQL case is proposed for actual concurrent transactions.
- Follow the existing explicit opt-in PostgreSQL test convention only after separately creating a dedicated disposable loopback database. Do not reuse the existing payroll or employee-deactivation databases.
- The standard API test glob includes *.test.ts, not arbitrary *.postgres.ts. Run any future opt-in file by explicit path and explicit environment.
- The future integration must validate host, port, dedicated database name, clean schema, expected isolation level, and no pre-existing accounts before writing. Teardown must close clients and disconnect Prisma.

## Focused future commands (not run in Phase 2.1)

Commands below are proposals for Phase 2.2 after authorization; none were executed during this discovery phase.

| Purpose                                      | Proposed command                                                                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit permission helper                       | pnpm test:web -- test/attendance.test.mjs                                                                                                                                                   |
| PGlite policy API                            | pnpm test:api -- tests/features/attendance/policy-management.test.ts                                                                                                                        |
| Mocked policy browser cases                  | pnpm --filter @nexus/web test:e2e -- e2e/attendance-policy-assignment.spec.ts                                                                                                               |
| Real browser/PGlite management compatibility | pnpm --filter @nexus/web test:e2e -- e2e/attendance.spec.ts --grep "policy                                                                                                                  | attendance management layout | skeletons" |
| Opt-in PostgreSQL concurrency                | Set PG008_POSTGRES_URL to an explicitly provisioned disposable loopback database, then pnpm --filter @nexus/api test -- tests/features/attendance/policy-assignment-concurrency.postgres.ts |
| Required repository gates                    | pnpm format; pnpm lint; pnpm typecheck                                                                                                                                                      |

Focused browser command syntax must be confirmed against the then-current Playwright script before execution. The quoted grep expression is a selection proposal, not evidence of a valid current test selection. Do not run pnpm test:e2e as part of a focused case check: its root wrapper also launches the backend regression suite.

## Regression compatibility commands and preservation checks

After implementation authorization, run only the focused suites first, then the current compatibility groups:

- Web unit compatibility: pnpm test:web -- test/attendance.test.mjs
- API route compatibility: pnpm test:api -- tests/features/attendance/policy-management.test.ts tests/features/attendance/policy-replacement.test.ts tests/features/attendance/policy-unassignment.test.ts tests/features/attendance/fixed-schedule.test.ts tests/features/attendance/foundation.test.ts
- Browser integration compatibility: focused attendance.spec.ts filter covering existing policy create/fixed schedule/edit/archive/restore/delete and layout cases.
- Mocked browser compatibility: attendance-policy-assignment.spec.ts in non-live mode, including both pre-existing selection and partial-retry declarations.
- Preserve the explicit test.skip(live) branch and test seriality.
- Preserve all historical PG-004 and PG-006 failing/intermittent evidence; do not use retries or skips to conceal a defect.
- Reconcile execution results in the ledger only after actually running the relevant command.

## Worker and environment risks

- attendance.spec.ts is serial because multiple tests use a shared browser fixture and clock. Do not enable parallel execution for that file.
- The default Playwright configuration is fullyParallel and CI retries twice. New mocked tests need per-test isolated handlers and state; avoid shared mutable route fixtures.
- The API runner compiles the API test tree and uses two Node test workers by default. Each PGlite test must start/close its own isolated app or remain in the current parent test fixture.
- The opt-in PostgreSQL race must use a dedicated pool size sufficient for concurrent requests, a unique database/schema, and explicit teardown; no live or developer database is acceptable.
- Intermittent browser behavior at 820px is recorded for PG-006 T024 only. New PG-008 width failures must be reported separately with repeat evidence.

## Quality gates for future implementation

AGENTS.md requires pnpm format, pnpm lint, and pnpm typecheck before handoff. The PG-008 Phase 2.1 request separately lists git diff --check. Do not execute unit/API/Playwright/integration suites until Phase 2.2 is separately authorized. Record command, exit code, generated files, and final diff. Restore only incidental files created by the command to their entry-state bytes.

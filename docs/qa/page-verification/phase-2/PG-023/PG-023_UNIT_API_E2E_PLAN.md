# PG-023 Unit, API and E2E Plan

**Status:** Planned only. No tests, test discovery, fixtures, servers, browser, or database were run or created for PG-023 Phase 2.1.
**Baseline:** 293-test-full-system-audit-for-verifying-recent-changes at 59167cbc03ed10cd52de2a8404e62f4366b13dfb.

## Layer allocation

| Primary layer                           | Cases                                                                                                            | Rationale and boundary                                                                                                                                                                                                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mocked Browser                          | T001, T006, T007, T008, T009, T010, T011, T012, T013, T014, T017, T021, T023, T025, T034, T035, T036, T038, T042 | Real employee page and shared portal/UI in Chromium with synthetic API responses. Proves route UI, forms, keyboard/focus, visual reflow and client request state only. It does not prove Express authorization, persistence, rewrite transport or session revocation. |
| Unit                                    | T015, T016                                                                                                       | Pure UI/API validation boundaries. T015 preserves client/helper normalization; T016 preserves API schema validation. No network or persistence claim.                                                                                                                 |
| API/PGlite                              | T002, T003, T004, T005, T018, T019, T020, T022, T024, T026, T027, T028, T029, T030, T037                         | Real Express middleware/controllers/services and supported database transaction/projection behavior with disposable migrated PGlite. Verify response and persisted snapshots. PGlite does not establish PostgreSQL provider contention.                               |
| Browser/Next/Express/PGlite integration | T033                                                                                                             | New read-only browser flow must use same-origin /api and the actual Next rewrite to an isolated Express/PGlite fixture. PG-022 T009 is Department-only and does not satisfy this employee-path case.                                                                  |
| PostgreSQL                              | T031, T032                                                                                                       | T031 reuses an existing opt-in real-PostgreSQL concurrency declaration for deactivation/attendance overlap. T032 is a new independent-connection profile-attachment race because Employee.userId is unique and attachment uses Serializable isolation.                |

Primary counts reconcile to 39 implementable unique cases: Browser 19, Unit 2, API/PGlite 15, Integration 1, PostgreSQL 2. T039/T040/T041 remain contract-blocked and have no primary layer; provisional layers are respectively Browser, Browser/API, and API/PGlite plus Browser after decisions. Supporting assertions do not create extra unique cases.

## Actors, synthetic data and assertions

### Browser

Use dedicated synthetic ADMIN and SUPERADMIN session fixtures with employees:read/manage. Exercise STAFF, USER and anonymous route states separately. Do not infer real STAFF employee-directory permission from a UI-only capability fixture used in T034. Seed synthetic linked Employee/STAFF, ADMIN, account-only STAFF and archived STAFF responses with unique sentinel values. Intercept page-owned employee and department endpoints; do not intercept unrelated same-origin routes needed by the portal fixture. Use accessible roles/names, one worker, zero retries, and event/state-driven waits. Keep the existing T012/T025 viewport loops and assertions intact.

For T010, use one test with a controlled context/config loop at 390, 560, 561, 1000 and 1001 CSS px. Assert row content/actions and toolbar/table modes at each width and document overflow results. This is five in-test iterations, not five Playwright registrations. Do not modify PG-022 tests or import its breakpoint expectation.

For asynchronous cases, hold responses with explicit deferred promises. Resolve B before A for T035; assert final rows and footer remain B. For pending submissions, assert the disabled/pending state before releasing the request and separately exercise success/failure. Avoid fixed sleeps and hidden retry behavior.

### Unit and API/PGlite

Use existing test locations and helpers: apps/web/test/employee-validation.test.mjs, apps/api/tests/features/employees/validation.test.ts, and apps/api/tests/support/pglite-app.ts. Proposed new API read module is apps/api/tests/features/employees/pg023-read.test.ts. Build fixtures with synthetic actors, sessions, departments, teams, Employees, histories, sessions/refresh tokens, and attendance work sessions as required. Use only the PGlite application harness and transaction snapshots; teardown must close Prisma/PGlite and leave no shared database. Do not use DATABASE_URL, real accounts, external notifications, or production data.

Preserve all existing titles, setup/assertions, mocks, lifecycle order, test hooks, cleanup, and account data. New assertions should compare exact response projections, no-write denial snapshots, and before/after rollback snapshots where case oracles require them. PGlite is not evidence for independent PostgreSQL connection races.

### Integration

Create a separate employee fixture for the existing integration harness pattern, plus apps/web/e2e-integrated/pg023-integration.spec.ts and a dedicated config derived from the PG-021 integration config. It should start a task-owned Express/PGlite fixture and a task-owned Next process with API_PROXY_TARGET pointed at that fixture, using separate loopback ports and reuseExistingServer=false. Seed a synthetic ADMIN plus linked employee; authenticate only through a fixture-issued token in sessionStorage. Observe GET /api/employees and GET /api/employees/:id at the Next origin, assert Express receipt/projection and exact before/after User/Employee/history snapshots. Do not intercept the employee requests. Teardown both processes and the disposable PGlite fixture.

This path is justified because same-origin rewrite transport, real page hydration, backend projection and no-write behavior are one cross-layer invariant. It is not covered by mocked browser or the earlier Department integration.

### PostgreSQL

T031 uses apps/api/tests/features/employees/deactivation-concurrency.postgres.ts, whose opt-in source requires WC_F01_POSTGRES_URL targeting the documented loopback disposable database and independent control/observer connections. Preserve its isolated database validation and cleanup. Execute only in a future authorized phase with that disposable service; it was not connected or checked here.

T032 should use two independent PostgreSQL clients and separately authenticated ADMIN/SUPERADMIN actors attaching the same eligible unprofiled account. Establish an overlap at the Serializable/unique-link boundary with a deterministic barrier, then assert one linked Employee, one accepted attachment, one conflict, preserved account role/password/session, and exactly one attributed operation. Do not infer a winner identity beyond the supported source constraint. Use a fresh disposable migrated database, validate target/loopback identity, close connections, and clean fixture rows. A serialized PGlite promise is insufficient.

## Planned commands — NOT EXECUTED

Repository scripts were inspected: root test:api forwards arguments through scripts/tests/run-api.mjs; the API package test script invokes Prisma generation plus scripts/run-tests.mjs; the API runner compiles the API test tree and selects Node test paths. Web test runs node --test test/*.test.mjs. Playwright config starts a production Next build/server, so it must not be invoked in this design phase. Commands below are future Phase 2.2 candidates after implementation and environment approval:

| Purpose                                           | Planned command                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Validation unit                                   | pnpm --filter @nexus/web exec node --test test/employee-validation.test.mjs; pnpm --filter @nexus/api exec node scripts/run-tests.mjs tests/features/employees/validation.test.ts                                                                                                                                                   |
| New/read-focused API and preserved API selections | pnpm --filter @nexus/api exec node scripts/run-tests.mjs tests/features/employees/pg023-read.test.ts tests/features/employees/employee-integration.test.ts tests/features/employees/creation-attribution.test.ts tests/features/employees/update-attribution.test.ts tests/features/employees/account-lifecycle-attribution.test.ts |
| Mocked browser                                    | pnpm --filter @nexus/web exec playwright test e2e/employees/pg023.spec.ts --config=playwright.pg023.config.ts --workers=1 --retries=0                                                                                                                                                                                               |
| Real rewrite integration                          | pnpm --filter @nexus/web exec playwright test e2e-integrated/pg023-integration.spec.ts --config=playwright.pg023-integration.config.ts --workers=1 --retries=0                                                                                                                                                                      |
| Opt-in PostgreSQL concurrency                     | Set only the documented disposable WC_F01_POSTGRES_URL, then invoke the selected .postgres declaration through the approved PostgreSQL runner/configuration; do not route it through the default PGlite-only root test selection.                                                                                                   |

The proposed PG-023 Playwright configs/fixtures do not exist yet; those paths are design targets, not runnable current commands. Command and environment feasibility must be confirmed in Phase 2.2 before use. Never invoke the webServer config against an unrelated existing process.

## Concurrency decision

PostgreSQL coverage is justified for T031 because deactivation competes with clock-in/out over an open attendance session and production code uses row locking/transaction boundaries. T032 is justified by unique Employee.userId plus Serializable profile attachment for two independent managers. Existing T031 source is reusable for the API path called by this page; it must not be represented as newly run.

Other list/search/filter/detail/form actions have no concurrent database invariant beyond ordinary transaction rollback covered by PGlite. Browser stale response tests use controlled synthetic fetch responses and establish UI ordering only. No PostgreSQL environment was provisioned, checked, or accessed in Phase 2.1.

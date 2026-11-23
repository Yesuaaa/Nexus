# PG-005 Unit, API, Browser, and Integration Plan

**Phase 2.2 planning only.** No test implementation or execution is authorized in this Phase 2.1 record.

## Proposed placement by layer

| Layer                                         | Proposed location                                                                      | Scope                                                                                                                                                                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web unit                                      | apps/web/test/attendance.test.mjs                                                      | Add T002 role/activity/permission assertions to the existing route-policy coverage. Reuse production permission helpers.                                                                                                      |
| API / PGlite                                  | apps/api/tests/features/attendance/management.test.ts                                  | Add T016 malformed query cases and T017 date-boundary/order/projection assertions adjacent to the existing audit search case; add T015 auth denial coverage with PGlite actors. Keep fixtures in tests/support/pglite-app.ts. |
| Browser                                       | apps/web/e2e/attendance.spec.ts                                                        | Add T003/T005/T009/T011/T012/T013 using scoped Playwright route interceptions. Add T008 to the existing mocked search flow without deleting or weakening its existing assertions.                                             |
| Browser / Next / Express / PGlite integration | Existing apps/web/e2e/attendance.spec.ts and apps/web/e2e/attendance-browser-server.ts | Preserve T014 responsive live-fixture coverage and T018 WC-07-F01 persisted transfer-to-audit flow. No new integration case is justified by current gaps.                                                                     |

No standalone unit test is proposed for private formatting helpers in AttendanceAuditPage. Their user-visible output is best checked through the page in T011/T012. Existing route-policy tests already exercise production authorization helpers; T002 fills only the missing negative matrix.

The exported parseAttendanceHistory function is independently callable, but T016 is placed at the authenticated API boundary so it verifies query parsing, HTTP status, and response behavior together. Do not duplicate its full invalid-input matrix in a second unit suite unless Phase 2.2 discovery identifies a shared parser contract that benefits from isolation.

## Fixtures and boundaries

- API requests must use apps/api/tests/support/pglite-app.ts, migrated in-memory PostgreSQL, issued sessions, and local Express. Do not use configured or live databases.
- T015 should test both no Authorization header and a valid USER bearer token. Keep one authorized Head and existing role fixtures for the negative/positive scope matrix.
- API boundary tests should seed explicit UTC timestamps and stable IDs in PGlite. Assert serialized JSON keys for omitted internal fields and narrow actor/employee projections.
- Browser-only tests should authenticate through the existing isolated regression helpers or the attendance browser fixture, then intercept only /api/attendance/departments and /api/attendance/audit. Keep Next routing and the page implementation real.
- The existing attendance browser suite already starts a local API fixture and forwards same-origin Next requests. Its focused mock test intercepts only the audit list. Use route-specific mocks for display and failure tests; do not replace T018's real persistence flow with a mock.
- Set the browser timezone to a non-UTC IANA zone for T011 so the explicit UTC display requirement is observable. Keep viewport 390 px for T013 and use the existing 390/820/1440 matrix for T014.
- Do not add production exports solely to reach page-private helpers. Do not introduce a second attendance-specific mock framework if the existing Playwright helpers suffice.

## Assertion-preservation procedure

1. Before edits, capture test declaration names and assertion sites for U1/U2/B1/B2/B3/A1/A2/A3/A4/X1/X2 in PG-005_EXISTING_TEST_BASELINE.md.
2. Make T002, T008, and T017 additive. Preserve their parent declarations, existing expected values, route lists, role fixtures, retry timing, PGlite cleanup, and skipped-live conditions.
3. Add the eight new cases as separate declarations or narrowly scoped additions. Keep T019/T020 out until product decisions are recorded.
4. Compare the before/after diff and declaration list. Confirm no existing declaration was removed, skipped, renamed to avoid a failure, or weakened.
5. Run only authorized focused tests for implementation, then retain the full required quality gates. Do not claim every historical assertion passed unless it is executed in that future phase.

## Focused commands for the future implementation phase

Run from the repository root after Phase 2.2 authorization:

| Purpose                     | Candidate command                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------ |
| Web route unit tests        | pnpm --filter @nexus/web test -- test/attendance.test.mjs test/route-policy.test.mjs |
| API/PGlite management tests | pnpm --filter @nexus/api test -- tests/features/attendance/management.test.ts        |
| Targeted browser cases      | pnpm --filter @nexus/web test:e2e -- attendance.spec.ts --grep PG-005                |
| Required repository gates   | pnpm format; pnpm lint; pnpm typecheck                                               |

Verify argument forwarding against the package scripts before execution. Playwright's configured webServer performs a production build and starts the isolated fixture path; do not set NEXUS_E2E_LIVE or point it at a live base URL. Root test runners and environments are described in PHASE_2_TEST_PLANNING_BASELINE.md.

## Dependencies and likely blockers

- Web/API test data shapes must match the current AttendanceAudit response type and PGlite-generated schema.
- Browser support code is shared. Keep mocks narrowly scoped so they do not intercept /api/auth/me or bypass route policy.
- Exact input labels, focus restoration, and skeleton locators must be checked against current accessible markup when implementing; do not replace semantic locators with forced clicks.
- T019 and T020 remain excluded until their expected behavior is approved. Their uncertainty does not block the other 11 additions/assertions.
- Phase 2.1 did not run test suites. Runtime status of the existing declarations remains unverified here.

# PG-007 Gaps and Dependencies

**Page:** PG-007, `/attendance/overview`  
**Phase:** 2.1 discovery/design only; no tests or source edits were made.

## Confirmed source and mapping

- Approved Phase 1 identifier, canonical route, route source, component, module, and role family match current source: PG-007, `/attendance/overview`, `AttendanceOverviewPage`, Workforce Compliance, personal attendance access.
- Current HEAD is `972428afbcd3d48d7ca6b8084b6f2906c2de84bc`, one commit after the last reported PG-006 baseline. The worktree was clean at entry; no changes were made to Git state.
- Phase 1 existing-test coverage labels PG-007 `INDIRECT`, but current declarations directly render the route, check Refresh, retry failures, verify a live overview API response, and exercise personal overview through PGlite. The current coverage is direct but partial; it does not prove every figure or error/empty display and has not been re-executed in this phase.

## Unresolved product contracts

| Contract ID        | Question                                                                                   | Current source behavior                                                                                                                  | Test disposition                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| PG-007-C001 / T006 | What should the overview display when From or Through is cleared?                          | `enabled` becomes false; no new GET is issued; `useAsyncResource` retains last successful `data`, which the page can still display.      | CONTRACT CLARIFICATION REQUIRED; no expected display assertion.                                                   |
| PG-007-C002 / T010 | Should suspended sessions have a separate visible row or contribute to “Still clocked in”? | API returns `suspended`; page renders only working, unpaid break, and closed rows; the “Still clocked in” number is `working + onBreak`. | CONTRACT CLARIFICATION REQUIRED for suspended UI meaning. Implement other status cases with suspended count zero. |

The default range's UTC ISO conversion and the API's date-only workday filtering are source-visible. Do not infer a configurable policy timezone for date defaults. Event timestamps and `asOf` are explicitly formatted as UTC.

## Coverage gaps that can be implemented

- No current fixed-clock unit assertion for `defaultRange()`.
- No browser route matrix that directly observes allowed and denied role destinations for this exact path.
- No controlled initial-loading, date-query, stale-response, or pending-refresh duplicate-request assertions.
- Existing refresh test checks HTTP 200 but not whether request dates equal visible From/Through values.
- No exact browser assertion for KPI field mapping, status percentages, accessible bar labels, sessions-per-day, approved leave days, UTC timestamp strings, or successful empty copy.
- Existing retry test verifies attempts and generic error change but not the overview's unavailable figure/section content.
- Existing personal API test does not include anonymous/USER denial, missing-profile `/me/overview` response, invalid date boundaries, or approved leave merge combined with personal session-state totals.
- Current integration route test observes HTTP 200 and page heading only. A single real PGlite-backed rendered summary case can bridge that UI gap.

## Dependencies and design controls

- Phase 2.2 must use existing PGlite infrastructure (`startPgliteApp`) for API/persistence and clearly label intercepted browser tests as mocked.
- T020 needs a dedicated test actor or an equivalent isolated employee/workday seed so it does not mutate shared staff/admin history in the serial attendance browser suite.
- API tests need assigned policies and fixed policy-zone work dates; leave records need an APPROVED request and linked `LeaveRequestDay` fixtures.
- Browser time and API attendance clock are separate controls. Freeze each independently when an assertion depends on both.
- For maximum date boundaries, 366 inclusive dates are source-accepted; 367 are rejected. Keep input validation tests separate from the C001 blank-date contract.
- No PG-007 PostgreSQL-specific implementation or concurrency property is established. PGlite is the planned persistence environment.
- The full feature does not expose search, sort, pagination, detail, approval, or mutation behavior; these do not block discovery and should not be invented as test cases.

## Existing reliability findings to preserve

- PG-004-D-001 remains a confirmed `RowActionsMenu` keyboard defect.
- PG-006 T018 reproduces the shared-menu failure on Check-Ins; T024 remains intermittent at 820 px. PG-007 overview does not render the shared menu. The grouped attendance spec may surface that separate 820 px failure while running the same test file.
- PG-006 T025/C001 cleared history date, the default history timezone basis, and active ADMIN without Employee profile 409/recovery behavior remain as recorded in the ledger.
- Earlier PG-001 through PG-005 defects and contracts remain open according to their existing records. This discovery did not re-evaluate or resolve them.

## Test inventory and readiness

- 21 unique PG-007 case records: 14 new tests, 3 additive assertion groups, 2 existing-sufficient records, and 2 contract-blocked records.
- 19 unblocked records: 2 unit, 4 API/PGlite, 12 browser, and 1 browser/API/PGlite integration primary-layer cases.
- T001 and T021 should remain intact. T007, T015, and T016 are additive; all their original assertions are listed in the preservation inventory.
- Current PG-007 execution status is **UNVERIFIED**. No test, regression suite, app build, or quality gate was run for PG-007 discovery. The mandatory non-test quality checks are recorded in the final response after documentation formatting/checking.
- The unblocked design is ready for future Phase 2.2 implementation after separate authorization. T006/T010 must remain deferred unless product contracts are clarified.

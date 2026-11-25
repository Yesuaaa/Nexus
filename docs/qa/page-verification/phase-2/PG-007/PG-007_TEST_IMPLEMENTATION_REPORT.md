# PG-007 Test Implementation Report

**Page:** PG-007, `/attendance/overview`  
**Component:** `AttendanceOverviewPage`  
**Implementation status:** Complete for the authorized source-supported scope.  
**Production changes:** None.

## Baseline and reconciliation

- Branch: `293-test-full-system-audit-for-verifying-recent-changes`.
- HEAD: `972428afbcd3d48d7ca6b8084b6f2906c2de84bc`.
- The worktree at assignment entry contained the Phase 2.1 PG-007 reports and ledger edit from the preceding authorized task. No test or application source was changed before this assignment. Those documents were preserved.
- All seven PG-007 design reports and the cumulative ledger were read before implementation. Relevant PG-006 execution and preservation records were reviewed.
- Implemented 14 new test declarations and three additive assertion groups. T001 and T021 remain in place. T006/C001 and T010/C002 remain deferred.
- T019's original fixture proposed three simultaneously unfinished states for one employee. PGlite's attendance overlap constraint rejects that fixture. The final declaration verifies closed/on-break aggregation for the leave and activity dataset, then verifies suspended and working counts through separate personal reads for isolated employees. This preserves source-supported API coverage without weakening the database invariant or inventing a UI contract.

## Case implementation record

### T001 — `PG-007-F001-A001-T001`

- **Atomic / layer:** A001; Unit.
- **Declaration / source:** Existing `all attendance navigation pages preserve module ownership and role boundaries` and `[PG-003-F001-A001-T001] personal attendance selection requires active STAFF or ADMIN` in `apps/web/test/attendance.test.mjs`.
- **Preconditions and data:** Production route-policy helpers; active STAFF/ADMIN, USER, SUPERADMIN, inactive role accounts.
- **Expected / actual:** Only active STAFF/ADMIN pass the personal overview predicate. Existing assertions remain unchanged and passed in the focused unit command.
- **Action / status:** EXISTING COVERAGE SUFFICIENT; preserved.
- **Execution:** `pnpm --filter @nexus/web exec node --experimental-strip-types --test test/attendance.test.mjs test/route-policy.test.mjs`; Node unit environment.

### T002 — `PG-007-F001-A001-T002`

- **Atomic / layer:** A001; Browser.
- **Declaration / source:** `[PG-007-F001-A001-T002] overview route admits STAFF and ADMIN and redirects denied roles` in `apps/web/e2e/attendance.spec.ts`.
- **Preconditions and data:** Real portal layout, four isolated session-storage states using the local attendance fixture: STAFF, ADMIN, USER (`client` fixture), SUPERADMIN.
- **Expected / actual:** STAFF/ADMIN remain on `/attendance/overview`; USER lands on `/dashboard`; SUPERADMIN lands on `/module`; denied roles see no overview heading. All four outcomes matched.
- **Action / status:** NEW TEST REQUIRED; implemented and PASSED.
- **Execution:** `pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts --grep 'PG-007|attendance overview summary layout' --workers=1`; Chromium, real Next route and local Express/PGlite fixture.

### T003 — `PG-007-F001-A002-T003`

- **Atomic / layer:** A002; Unit.
- **Declaration / source:** `[PG-007-F001-A002-T003] default overview range uses UTC date serialization` in `apps/web/test/attendance.test.mjs`.
- **Preconditions and data:** Node Date mock fixed at `2026-11-23T04:30:00.000Z`.
- **Expected / actual:** `defaultRange()` returns `{ from: "2026-10-24", to: "2026-11-24" }`. The assertion passed.
- **Action / status:** NEW TEST REQUIRED; implemented and PASSED.
- **Execution:** Focused Node unit command above; no API dependency.

### T004 — `PG-007-F001-A002-T004`

- **Atomic / layer:** A002; Browser.
- **Declaration / source:** `[PG-007-F001-A002-T004] initial load requests the default range while figures are busy` in `apps/web/e2e/attendance-overview.spec.ts`.
- **Preconditions and data:** STAFF session, browser clock fixed to the T003 instant, mocked same-origin GET held until assertions complete.
- **Expected / actual:** The request contains `from=2026-10-24&to=2026-11-24`; figures expose `aria-busy=true` while held, then settle and display the controlled value. Passed.
- **Action / status:** NEW TEST REQUIRED; implemented and PASSED.
- **Execution:** `pnpm --filter @nexus/web exec playwright test e2e/attendance-overview.spec.ts --grep PG-007 --workers=1`; Chromium, actual component with intercepted API response.

### T005 — `PG-007-F001-A003-T005`

- **Atomic / layer:** A003; Browser.
- **Declaration / source:** `[PG-007-F001-A003-T005] date changes send bounded ranges and ignore a superseded response` in `apps/web/e2e/attendance-overview.spec.ts`.
- **Preconditions and data:** ADMIN session and fixed browser clock; initial range `2026-10-24..2026-11-24`; changed ranges `2026-11-01..2026-11-24` then `2026-11-01..2026-11-20`; deferred older response.
- **Expected / actual:** Native input max/min values follow the paired date; each request contains the date-only values; the latest response displays 3 recorded days even after the held older response is fulfilled with 2. Passed, including an assertion that the old response was fulfilled.
- **Action / status:** NEW TEST REQUIRED; implemented and PASSED.
- **Execution:** Mocked PG-007 Playwright command above; separately rerun with `--grep T005 --workers=1` after strengthening the late-response assertion; both final runs passed.

### T006 — `PG-007-F001-A003-T006`

- **Atomic / layer:** A003; Browser / contract.
- **Declaration / source:** None added.
- **Preconditions and data:** Requires an established product expectation for clearing From or Through.
- **Expected / actual:** Product outcome remains unspecified; current source disables fetching when a bound is blank and may retain prior data.
- **Action / status:** CONTRACT CLARIFICATION REQUIRED; not executed or counted.
- **Execution:** None. PG-007-C001 remains open.

### T007 — `PG-007-F001-A004-T007`

- **Atomic / layer:** A004; Browser.
- **Declaration / source:** Additive assertions in existing `attendance overview summary layout at {width}px` cases in `apps/web/e2e/attendance.spec.ts`.
- **Preconditions and data:** Existing ADMIN fixture, visible From/Through values, successful live local overview endpoint.
- **Expected / actual:** Refresh remains a GET, returns 200, uses exactly the currently visible input values, and the figure row settles. Passed at 390, 820, and 1440 px.
- **Action / status:** ADDITIONAL ASSERTION REQUIRED; implemented without removing layout assertions; PASSED.
- **Execution:** Real browser selection command; local Express/PGlite fixture.

### T008 — `PG-007-F001-A004-T008`

- **Atomic / layer:** A004; Browser.
- **Declaration / source:** `[PG-007-F001-A004-T008] pending refresh is disabled and issues one read` in `apps/web/e2e/attendance-overview.spec.ts`.
- **Preconditions and data:** Mocked first successful read followed by a held refresh response.
- **Expected / actual:** During refresh the button is disabled and figures are busy; one refresh GET is issued; a native click on the disabled control does not add a request; completion displays the new result. Passed.
- **Action / status:** NEW TEST REQUIRED; implemented and PASSED.
- **Execution:** Mocked PG-007 Playwright command; one worker.

### T009 — `PG-007-F001-A005-T009`

- **Atomic / layer:** A005; Browser.
- **Declaration / source:** `[PG-007-F001-A005-T009] summary figures map the source response values` in `apps/web/e2e/attendance-overview.spec.ts`.
- **Preconditions and data:** Mocked response with 7 recorded days, 4 sessions, 2 closed, 1 working, 1 on break, 0 suspended.
- **Expected / actual:** Figures render 7, 4, 2 with “50% completed”, and 2. Passed.
- **Action / status:** NEW TEST REQUIRED; implemented and PASSED.
- **Execution:** Mocked PG-007 Playwright command; one worker.

### T010 — `PG-007-F001-A006-T010`

- **Atomic / layer:** A006; Browser / contract.
- **Declaration / source:** None added.
- **Preconditions and data:** Requires product direction for a Suspended row and the meaning of “Still clocked in”.
- **Expected / actual:** API `suspended` count and current UI omission are documented; no suspended UI expectation is asserted. The API count is checked in T019 without a UI assertion.
- **Action / status:** CONTRACT CLARIFICATION REQUIRED; not executed or counted.
- **Execution:** No UI case. PG-007-C002 remains open.

### T011 — `PG-007-F001-A006-T011`

- **Atomic / layer:** A006; Browser.
- **Declaration / source:** `[PG-007-F001-A006-T011] supported status rows expose counts, shares, and bar labels` in `apps/web/e2e/attendance-overview.spec.ts`.
- **Preconditions and data:** Mocked total 4 with 1 working, 1 on break, 2 closed, 0 suspended.
- **Expected / actual:** Three supported rows show 1/25%, 1/25%, and 2/50%; each `InlineBar` has the source-defined accessible label. Passed.
- **Action / status:** NEW TEST REQUIRED; implemented and PASSED.
- **Execution:** Mocked PG-007 Playwright command; one worker.

### T012 — `PG-007-F001-A007-T012`

- **Atomic / layer:** A007; Browser.
- **Declaration / source:** `[PG-007-F001-A007-T012] personal summary displays the selected range, leave, and UTC refresh time` in `apps/web/e2e/attendance-overview.spec.ts`.
- **Preconditions and data:** Fixed browser clock in `Pacific/Auckland`; response has 2 recorded days, 3 sessions, 1 approved leave day, and `asOf=2026-11-13T12:34:00.000Z`; From set to Nov 13.
- **Expected / actual:** Personal scope, Nov 13–14 range, 1.5 sessions/day, one approved leave day, and `Nov 13, 2026, 12:34 PM` display. Passed.
- **Action / status:** NEW TEST REQUIRED; implemented and PASSED.
- **Execution:** Mocked PG-007 Playwright command; actual formatting component and non-UTC browser zone.

### T013 — `PG-007-F001-A008-T013`

- **Atomic / layer:** A008; Browser.
- **Declaration / source:** `[PG-007-F001-A008-T013] recent activity renders supported labels in payload order and UTC` in `apps/web/e2e/attendance-overview.spec.ts`.
- **Preconditions and data:** Eight controlled events covering all four actions, Avery Staff, and UTC times 12:27–12:34 PM; browser zone Pacific/Auckland.
- **Expected / actual:** All eight rows preserve payload order, map to the four source labels, show the employee name, and render each explicit UTC timestamp. Passed.
- **Action / status:** NEW TEST REQUIRED; implemented and PASSED.
- **Execution:** Mocked PG-007 Playwright command; one worker.

### T014 — `PG-007-F001-A009-T014`

- **Atomic / layer:** A009; Browser.
- **Declaration / source:** `[PG-007-F001-A009-T014] successful empty period shows zeros and empty messages` in `apps/web/e2e/attendance-overview.spec.ts`.
- **Preconditions and data:** Successful all-zero payload with empty recent activity and no leave.
- **Expected / actual:** Four figures show zero; check-in and activity empty messages appear; sessions/day is an em dash; Retry is absent. Passed.
- **Action / status:** NEW TEST REQUIRED; implemented and PASSED.
- **Execution:** Mocked PG-007 Playwright command; one worker.

### T015 — `PG-007-F001-A010-T015`

- **Atomic / layer:** A010; Browser.
- **Declaration / source:** Additive assertions in existing `attendance request failures show an error and recover on retry` in `apps/web/e2e/async-resource.spec.ts`.
- **Preconditions and data:** Preserved deterministic 503, 503, success responses and ADMIN mock session.
- **Expected / actual:** Both failures retain Retry, dash all four figures, and show the unavailable status/activity text; success removes the two page-specific error messages, settles figures, and preserves the original three-attempt result. Passed.
- **Action / status:** ADDITIONAL ASSERTION REQUIRED; implemented; existing `test.skip(live, ...)` remains unchanged; PASSED.
- **Execution:** `pnpm --filter @nexus/web exec playwright test e2e/async-resource.spec.ts --grep 'attendance request failures show an error and recover on retry' --workers=1`; mocked route, one worker.

### T016 — `PG-007-F001-A011-T016`

- **Atomic / layer:** A011; API/PGlite.
- **Declaration / source:** Additive assertions in existing `personal overview derives identity from the session and rejects scope overrides` in `apps/api/tests/features/attendance/management.test.ts`.
- **Preconditions and data:** Existing STAFF/ADMIN scope/override fixtures; anonymous request and a session-backed USER without an Employee.
- **Expected / actual:** Anonymous returns 401; USER returns 403; neither response contains personal `scope` or `checkIns`; original STAFF/ADMIN identity, ownership, and override assertions remain intact. Passed.
- **Action / status:** ADDITIONAL ASSERTION REQUIRED; implemented; PASSED.
- **Execution:** Focused API/PGlite command in the execution report; isolated `startPgliteApp` database.

### T017 — `PG-007-F001-A011-T017`

- **Atomic / layer:** A011; API/PGlite.
- **Declaration / source:** `[PG-007-F001-A011-T017] personal overview requires a linked Employee without creating one` in `apps/api/tests/features/attendance/management.test.ts`.
- **Preconditions and data:** Active ADMIN without an Employee; Nov 13 query; Employee/workday/session counts captured before request.
- **Expected / actual:** API returns 409 and “Complete your employee profile before using attendance”; counts remain identical. Passed.
- **Action / status:** NEW TEST REQUIRED; implemented and PASSED.
- **Execution:** Focused API/PGlite command; isolated in-memory database.

### T018 — `PG-007-F001-A012-T018`

- **Atomic / layer:** A012; API/PGlite.
- **Declaration / source:** `[PG-007-F001-A012-T018] personal overview validates date range boundaries` in `apps/api/tests/features/attendance/management.test.ts`.
- **Preconditions and data:** Linked STAFF session; impossible Feb 30, reversed bounds, 366- and 367-inclusive-day ranges, and an unsupported key.
- **Expected / actual:** Invalid calendar/reversed/367-day/unknown-key requests return 400; 366 inclusive dates return 200. All assertions passed.
- **Action / status:** NEW TEST REQUIRED; implemented and PASSED.
- **Execution:** Focused API/PGlite command; no live database.

### T019 — `PG-007-F001-A012-T019`

- **Atomic / layer:** A012; API/PGlite.
- **Declaration / source:** `[PG-007-F001-A012-T019] personal overview aggregates attendance, approved leave, and recent activity` in `apps/api/tests/features/attendance/management.test.ts`.
- **Preconditions and data:** Isolated PGlite accounts and assignments; four personal workdays, three closed sessions, one open unpaid-break session, an approved leave day overlapping Nov 13, a leave-only Nov 17 day, and a foreign employee session. Suspended and working sessions are created for separate employee identities because the database rejects simultaneous unfinished sessions for one employee.
- **Expected / actual:** Main personal response has `scope=PERSONAL`, 1 employee, 4 recorded days, 2 approved leave days / 12 hours, and 4 sessions (3 closed, 1 on break); eight newest events are source-ordered and exclude the foreign employee. Separate personal responses report one suspended session and one working session. Passed.
- **Action / status:** NEW TEST REQUIRED; implemented with documented source-supported fixture reconciliation; PASSED. No UI expectation for C002 is added.
- **Execution:** Focused API/PGlite command; isolated data and explicit expected values.

### T020 — `PG-007-F001-A013-T020`

- **Atomic / layer:** A013; Browser/API/PGlite integration.
- **Declaration / source:** `[PG-007-F001-A013-T020] PGlite attendance renders through the real personal overview path` in `apps/web/e2e/attendance.spec.ts`; dedicated `pg007-overview` actor in `apps/api/tests/support/attendance-browser-server.ts`.
- **Preconditions and data:** Dedicated STAFF user, linked Employee, assigned Asia/Manila policy, isolated PGlite history initially empty for Nov 20, 2026. Fixture API clock and browser clock set separately.
- **Expected / actual:** Real clock-in/out create one closed session; browser makes the real overview GET through Next and Express; UI shows one day, one session, 100% completed, one status bar, 1.0 sessions/day, and two UTC events. History IDs/counts before and after viewing match, showing the report GET adds no workday/session. Passed.
- **Action / status:** NEW TEST REQUIRED; implemented and PASSED.
- **Execution:** Real browser/API/PGlite selection command; no overview response interception and no PostgreSQL-specific claim.

### T021 — `PG-007-F001-A013-T021`

- **Atomic / layer:** A013; Browser.
- **Declaration / source:** Existing `attendance overview summary layout at {width}px` cases in `apps/web/e2e/attendance.spec.ts`.
- **Preconditions and data:** Existing ADMIN and isolated local attendance fixture; 390, 820, and 1440 px.
- **Expected / actual:** Original page headings, link, refresh 200, settled state, and no-overflow assertions remain and passed at all three widths.
- **Action / status:** EXISTING COVERAGE SUFFICIENT; preserved.
- **Execution:** Real browser/API/PGlite selection command; three viewport runs.

## Scope closure

- **New declarations:** 14/14 implemented.
- **Additive assertion groups:** 3/3 implemented.
- **Existing-sufficient cases:** T001 and T021 preserved.
- **Deferred contracts:** T006/C001 and T010/C002 remain blocked and excluded from implementable/pass totals.
- No application, authentication, attendance formula, schema, migration, or product behavior was changed.

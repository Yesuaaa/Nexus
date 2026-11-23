# PG-007 Test Case Specification

**Page:** `/attendance/overview` (PG-007)  
**Design only:** No test implementation or execution occurred.  
**Counting rule:** Each stable case ID is counted once. Existing-sufficient and contract-blocked records are separated from implementable additions.

## Reconciled inventory

| Classification                  |  Count | Case IDs                                   |
| ------------------------------- | -----: | ------------------------------------------ |
| NEW TEST REQUIRED               |     14 | T002-T005, T008-T009, T011-T014, T017-T020 |
| ADDITIONAL ASSERTION REQUIRED   |      3 | T007, T015-T016                            |
| EXISTING COVERAGE SUFFICIENT    |      2 | T001, T021                                 |
| CONTRACT CLARIFICATION REQUIRED |      2 | T006, T010                                 |
| **Total unique records**        | **21** | T001-T021                                  |

The 19 unblocked records map by primary target to 2 unit, 4 API/PGlite, 12 browser, and 1 real browser/API/PGlite integration case. This is a primary-layer count; it is not a declaration count or a claim that tests passed. No PostgreSQL-specific case is proposed. No `NOT APPLICABLE` records are included in the test count; source-absent controls are listed separately in the edge matrix.

## T001 - Personal route permission predicate

| Field             | Specification                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test ID           | `PG-007-F001-A001-T001`                                                                                                                                           |
| Atomic feature    | A001 - personal route and navigation access                                                                                                                       |
| Test type         | Unit                                                                                                                                                              |
| Scenario          | Route-policy helper grants the overview to active STAFF/ADMIN and excludes USER/SUPERADMIN and inactive allowed roles.                                            |
| Preconditions     | Import the production permission and route-policy functions.                                                                                                      |
| Test data         | Active STAFF; active ADMIN; USER; SUPERADMIN with and without `employees:read`; inactive STAFF and ADMIN.                                                         |
| Steps             | Evaluate `canAccessRoute(account, "/attendance/overview")` and `canAccessPersonalAttendance(account)` for the matrix.                                             |
| Expected result   | Only active STAFF/ADMIN pass the exact personal overview route. SUPERADMIN remains denied even if the broader attendance access helper permits a different route. |
| Existing coverage | `apps/web/test/attendance.test.mjs:240,262` covers the navigation route policy and personal predicate.                                                            |
| Proposed action   | EXISTING COVERAGE SUFFICIENT; preserve both declarations and assertions.                                                                                          |
| Priority          | High                                                                                                                                                              |
| Environment       | Node unit test; production helpers, no API.                                                                                                                       |
| Evidence          | `permissions.ts:92-116`; `route-policy.ts:353-385`; `attendance.test.mjs:240-281`.                                                                                |

## T002 - Browser route access and denial redirects

| Field             | Specification                                                                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test ID           | `PG-007-F001-A001-T002`                                                                                                                                               |
| Atomic feature    | A001 - personal route and navigation access                                                                                                                           |
| Test type         | Browser                                                                                                                                                               |
| Scenario          | Exercise direct navigation to the overview through the portal layout for allowed and denied roles.                                                                    |
| Preconditions     | Isolated browser session for each role; current portal account fixture.                                                                                               |
| Test data         | Active `STAFF`, active `ADMIN`, active `USER`, and active `SUPERADMIN`; no overview-specific API response needed for denied roles.                                    |
| Steps             | Sign in each fixture, navigate directly to `/attendance/overview`, wait for the portal route decision, and inspect final URL and visible page.                        |
| Expected result   | STAFF/ADMIN remain on Attendance Overview; USER is redirected to `/dashboard`; SUPERADMIN is redirected to `/module`; denied accounts do not render overview content. |
| Existing coverage | T001 is helper-level. Existing overview browser cases sign in ADMIN only and do not exercise denied-role redirects.                                                   |
| Proposed action   | NEW TEST REQUIRED.                                                                                                                                                    |
| Priority          | High                                                                                                                                                                  |
| Environment       | Playwright with isolated role sessions and the real portal layout.                                                                                                    |
| Evidence          | `portal-layout.tsx:23-34,59-64`; `route-policy.ts:353-385,743-755`; `attendance.spec.ts:1403-1408`.                                                                   |

## T003 - Default date range calculation

| Field             | Specification                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| Test ID           | `PG-007-F001-A002-T003`                                                                                        |
| Atomic feature    | A002 - default range and initial load                                                                          |
| Test type         | Unit                                                                                                           |
| Scenario          | Check the source-defined UTC date strings produced by `defaultRange()`.                                        |
| Preconditions     | Use the repository Node test runner's Date mock and reset it after the assertion.                              |
| Test data         | Fixed instant `2026-11-23T04:30:00.000Z`.                                                                      |
| Steps             | Call `defaultRange()` with the mocked instant.                                                                 |
| Expected result   | `{ from: "2026-10-24", to: "2026-11-24" }` (minus 30 days and plus one day, serialized through ISO UTC dates). |
| Existing coverage | No `defaultRange()` assertion was found in the current attendance unit test.                                   |
| Proposed action   | NEW TEST REQUIRED.                                                                                             |
| Priority          | Medium                                                                                                         |
| Environment       | Node unit test; deterministic clock.                                                                           |
| Evidence          | `attendance.ts:103-109`; `attendance-overview-page.tsx:29-39`.                                                 |

## T004 - Initial request and loading transition

| Field             | Specification                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Test ID           | `PG-007-F001-A002-T004`                                                                                                                  |
| Atomic feature    | A002 - default range and initial load                                                                                                    |
| Test type         | Browser                                                                                                                                  |
| Scenario          | Verify the component sends the default range and renders loading before the response.                                                    |
| Preconditions     | Active STAFF session; use browser clock and a deferred same-origin response.                                                             |
| Test data         | Browser fixed to `2026-11-23T04:30:00.000Z`; controlled `AttendanceOverview` payload.                                                    |
| Steps             | Install the clock, intercept `/api/attendance/me/overview`, navigate, hold the request, inspect query and `aria-busy`, then fulfill it.  |
| Expected result   | Query has `from=2026-10-24&to=2026-11-24`; figure row is busy while held and settles after success; data appears without an error alert. |
| Existing coverage | Responsive tests wait for `aria-busy=false` and the live response but do not assert the request bounds or held-loading state.            |
| Proposed action   | NEW TEST REQUIRED.                                                                                                                       |
| Priority          | High                                                                                                                                     |
| Environment       | Mocked Playwright API; actual `AttendanceOverviewPage`.                                                                                  |
| Evidence          | `attendance-overview-page.tsx:29-44,92-103`; `defaultRange()` at `attendance.ts:103-109`.                                                |

## T005 - Date changes, constraints, and stale responses

| Field             | Specification                                                                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test ID           | `PG-007-F001-A003-T005`                                                                                                                                                           |
| Atomic feature    | A003 - date range controls and query changes                                                                                                                                      |
| Test type         | Browser                                                                                                                                                                           |
| Scenario          | Confirm edited dates drive requests and a late response for an old range cannot replace the newest result.                                                                        |
| Preconditions     | Active ADMIN session; deterministic initial data and deferred responses keyed by query.                                                                                           |
| Test data         | Initial fixed range `2026-10-24` to `2026-11-24`; change From to `2026-11-01`, then Through to `2026-11-20`.                                                                      |
| Steps             | Inspect `max` on From and `min` on Through; edit each field; hold the older response and fulfill the latest response first; release the stale response last.                      |
| Expected result   | Each populated range is sent as date-only query data; constraints reflect the opposing value; final visible values remain those from the latest range after the stale completion. |
| Existing coverage | No direct PG-007 date input/query or stale-response assertion found. Generic async-resource coverage does not vary overview ranges.                                               |
| Proposed action   | NEW TEST REQUIRED.                                                                                                                                                                |
| Priority          | High                                                                                                                                                                              |
| Environment       | Mocked Playwright API; deferred route handlers, no arbitrary waits.                                                                                                               |
| Evidence          | `attendance-shared.tsx:89-118`; `attendance-overview-page.tsx:30-39,80-84`; `use-async-resource.ts:25-57`.                                                                        |

## T006 - Clearing either range date

| Field             | Specification                                                                                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test ID           | `PG-007-F001-A003-T006`                                                                                                                                                                      |
| Atomic feature    | A003 - date range controls and query changes                                                                                                                                                 |
| Test type         | Browser / contract                                                                                                                                                                           |
| Scenario          | Determine the intended view after From or Through is cleared.                                                                                                                                |
| Preconditions     | A successful overview has already loaded.                                                                                                                                                    |
| Test data         | Clear From while retaining Through, then restore and clear Through while retaining From.                                                                                                     |
| Steps             | Observe request activity, selected values, and displayed aggregate data after each clear.                                                                                                    |
| Expected result   | **Not specified.** Current source disables fetching when either bound is empty and may continue exposing previously loaded data. Product intent could be retain, clear, or replace the view. |
| Existing coverage | No PG-007 clear-date assertion. PG-006 T025/C001 has a similar but page-specific open contract; it does not resolve PG-007.                                                                  |
| Proposed action   | CONTRACT CLARIFICATION REQUIRED; defer assertions until product defines the cleared-range result.                                                                                            |
| Priority          | High                                                                                                                                                                                         |
| Environment       | Browser. No expected result should be asserted before clarification.                                                                                                                         |
| Evidence          | `attendance-overview-page.tsx:31-39`; `use-async-resource.ts:25-81`; `attendance-shared.tsx:89-118`.                                                                                         |

## T007 - Refresh uses the selected range

| Field             | Specification                                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Test ID           | `PG-007-F001-A004-T007`                                                                                                                      |
| Atomic feature    | A004 - refresh and pending-action state                                                                                                      |
| Test type         | Browser                                                                                                                                      |
| Scenario          | Extend the existing responsive overview test to verify Refresh requests the visible date range and settles.                                  |
| Preconditions     | Existing ADMIN browser fixture and successful initial overview request.                                                                      |
| Test data         | The From/Through values actually rendered at test time; response status 200.                                                                 |
| Steps             | Capture the GET triggered by Refresh, click the existing button, compare its query with both visible inputs, and wait for figures to settle. |
| Expected result   | A GET to `/api/attendance/me/overview` uses the selected dates and returns 200; the figure row is no longer busy.                            |
| Existing coverage | `attendance.spec.ts:1403-1458` already clicks Refresh, expects status 200, checks settled figures and overflow.                              |
| Proposed action   | ADDITIONAL ASSERTION REQUIRED; retain all responsive, link, heading, and overflow assertions.                                                |
| Priority          | Medium                                                                                                                                       |
| Environment       | Existing isolated browser/API/PGlite attendance fixture.                                                                                     |
| Evidence          | `attendance.spec.ts:1398-1458`; `attendance-overview-page.tsx:52-75`.                                                                        |

## T008 - Pending refresh prevents duplicate requests

| Field             | Specification                                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Test ID           | `PG-007-F001-A004-T008`                                                                                                                      |
| Atomic feature    | A004 - refresh and pending-action state                                                                                                      |
| Test type         | Browser                                                                                                                                      |
| Scenario          | Verify Refresh is disabled while a retry request is pending and cannot create duplicate concurrent reads through repeated clicks.            |
| Preconditions     | Page has completed initial load; refresh response can be held deterministically.                                                             |
| Test data         | One successful initial payload and one held refresh payload.                                                                                 |
| Steps             | Click Refresh once, inspect disabled state and `aria-busy`, attempt a second click, then fulfill the held response.                          |
| Expected result   | Refresh is disabled and the page is busy during the held request; only one refresh GET is issued; success returns the page to settled state. |
| Existing coverage | Existing refresh test checks only a successful HTTP 200.                                                                                     |
| Proposed action   | NEW TEST REQUIRED.                                                                                                                           |
| Priority          | Medium                                                                                                                                       |
| Environment       | Mocked Playwright API with deferred response.                                                                                                |
| Evidence          | `attendance-overview-page.tsx:52-75,92-103`; `use-async-resource.ts:29-57`.                                                                  |

## T009 - KPI values and completion rate

| Field             | Specification                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Test ID           | `PG-007-F001-A005-T009`                                                                                                          |
| Atomic feature    | A005 - summary figures                                                                                                           |
| Test type         | Browser                                                                                                                          |
| Scenario          | Check that each summary figure maps the intended API field and checkout-rate calculation.                                        |
| Preconditions     | Controlled populated response with zero suspended sessions to avoid the separate unresolved display contract.                    |
| Test data         | `recordedDays=7`; total 4; closed 2; working 1; onBreak 1; suspended 0.                                                          |
| Steps             | Load the page with the response and inspect each named figure and note.                                                          |
| Expected result   | Attendance days 7; Check-ins 4; Check-outs 2 with “50% completed”; Still clocked in 2.                                           |
| Existing coverage | Existing page tests assert figure container state and headings but do not assert exact values. API tests cover partial counters. |
| Proposed action   | NEW TEST REQUIRED.                                                                                                               |
| Priority          | High                                                                                                                             |
| Environment       | Mocked Playwright API; production component and formatting.                                                                      |
| Evidence          | `attendance-overview-page.tsx:40-50,92-115`; `attendance.management.ts:716-742`.                                                 |

## T010 - Suspended-session display contract

| Field             | Specification                                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Test ID           | `PG-007-F001-A006-T010`                                                                                                                                                                                |
| Atomic feature    | A006 - session status breakdown and proportional bars                                                                                                                                                  |
| Test type         | Browser / contract                                                                                                                                                                                     |
| Scenario          | Decide whether suspended sessions require a separate visible status or inclusion in “Still clocked in”.                                                                                                |
| Preconditions     | Controlled response includes `total=1`, `suspended=1`, and other status counts zero.                                                                                                                   |
| Test data         | One suspended session and no other sessions.                                                                                                                                                           |
| Steps             | Inspect the figure and the Check-in status table.                                                                                                                                                      |
| Expected result   | **Product meaning is not established.** Current source renders no Suspended row and computes “Still clocked in” only from `working + onBreak`; an assertion could cement an unintended interpretation. |
| Existing coverage | Organization API test checks `suspended` as a separate count, but no PG-007 screen expectation exists.                                                                                                 |
| Proposed action   | CONTRACT CLARIFICATION REQUIRED for the suspended UI representation; other non-suspended status tests remain implementable.                                                                            |
| Priority          | High                                                                                                                                                                                                   |
| Environment       | Browser after product clarification.                                                                                                                                                                   |
| Evidence          | `attendance-overview-page.tsx:40-50,118-168`; `attendance.management.ts:694-742`.                                                                                                                      |

## T011 - Non-suspended status counts and bars

| Field             | Specification                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Test ID           | `PG-007-F001-A006-T011`                                                                                                           |
| Atomic feature    | A006 - session status breakdown and proportional bars                                                                             |
| Test type         | Browser                                                                                                                           |
| Scenario          | Verify the three supported status rows, counts, rounded shares, and accessible proportional-bar labels.                           |
| Preconditions     | Controlled nonempty response with no suspended sessions.                                                                          |
| Test data         | Total 4; closed 2; working 1; onBreak 1; suspended 0.                                                                             |
| Steps             | Load the response and inspect rows, percentage text, and role=img bar labels.                                                     |
| Expected result   | Clocked in 1 / 25%; On unpaid break 1 / 25%; Clocked out 2 / 50%; bar labels identify the corresponding status and session count. |
| Existing coverage | No exact status-row or bar-label assertions in the current overview browser test. API has aggregate coverage.                     |
| Proposed action   | NEW TEST REQUIRED. Do not include a suspended-session expected display until T010 is clarified.                                   |
| Priority          | High                                                                                                                              |
| Environment       | Mocked Playwright API; actual `FiguresRow`/`InlineBar` presentation.                                                              |
| Evidence          | `attendance-overview-page.tsx:118-168`; `overview-panel.tsx:249-293`.                                                             |

## T012 - Personal summary details and leave figure

| Field             | Specification                                                                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test ID           | `PG-007-F001-A007-T012`                                                                                                                               |
| Atomic feature    | A007 - personal attendance summary fields                                                                                                             |
| Test type         | Browser                                                                                                                                               |
| Scenario          | Verify the personal metadata section maps a response to the displayed range, per-day figure, leave count, and refresh timestamp.                      |
| Preconditions     | Controlled success response and populated date fields.                                                                                                |
| Test data         | Range `2026-11-13` to `2026-11-14`; `scope=PERSONAL`; recordedDays 2; total sessions 3; approvedLeaveDays 1; asOf `2026-11-13T12:34:00.000Z`.         |
| Steps             | Render the fixture and inspect the Personal attendance definition list.                                                                               |
| Expected result   | Reporting scope Personal; exact selected dates; Sessions per day 1.5; Approved leave days 1; Last refreshed displays `Nov 13, 2026, 12:34 PM` in UTC. |
| Existing coverage | No exact personal metadata assertions on the page. Existing API test checks scope but not these fields.                                               |
| Proposed action   | NEW TEST REQUIRED.                                                                                                                                    |
| Priority          | High                                                                                                                                                  |
| Environment       | Mocked Playwright API; fixed values and UTC output.                                                                                                   |
| Evidence          | `attendance-overview-page.tsx:172-215`; `format.ts:12-23`.                                                                                            |

## T013 - Recent activity labels and UTC timestamps

| Field             | Specification                                                                                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test ID           | `PG-007-F001-A008-T013`                                                                                                                                                                        |
| Atomic feature    | A008 - recent check-in activity                                                                                                                                                                |
| Test type         | Browser                                                                                                                                                                                        |
| Scenario          | Verify action labels, employee names, API ordering, and explicit UTC formatting for the returned eight events.                                                                                 |
| Preconditions     | Successful controlled response with recent activity.                                                                                                                                           |
| Test data         | Eight chronologically ordered events covering all four action types; first timestamp `2026-11-13T12:34:00.000Z`; name `Avery Staff`.                                                           |
| Steps             | Load the page and inspect event text and timestamp cells in source order.                                                                                                                      |
| Expected result   | Actions map to Clocked in, Clocked out, Started break, Ended break; employee name is shown; first time renders `Nov 13, 2026, 12:34 PM`; all eight returned rows appear in the order supplied. |
| Existing coverage | API test verifies sorting/cap for an organization overview and the personal test checks event ownership; no page text/time assertion exists.                                                   |
| Proposed action   | NEW TEST REQUIRED. Server cap/order will be verified separately by T019.                                                                                                                       |
| Priority          | High                                                                                                                                                                                           |
| Environment       | Mocked Playwright API; UTC formatting in the real component.                                                                                                                                   |
| Evidence          | `attendance-overview-page.tsx:219-253`; `attendance.management.ts:705-735`; `format.ts:12-23`.                                                                                                 |

## T014 - Successful empty period

| Field             | Specification                                                                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Test ID           | `PG-007-F001-A009-T014`                                                                                                                                                                                      |
| Atomic feature    | A009 - empty period state                                                                                                                                                                                    |
| Test type         | Browser                                                                                                                                                                                                      |
| Scenario          | Distinguish a successful zero result from loading and API failure.                                                                                                                                           |
| Preconditions     | Successful response with no workdays, sessions, or recent activity.                                                                                                                                          |
| Test data         | recordedDays 0; all check-in counters 0; empty activity; no approved leave.                                                                                                                                  |
| Steps             | Fulfill the overview GET with the zero-valued payload and inspect figures and sections.                                                                                                                      |
| Expected result   | Numeric summary values are zero; status table is replaced by “No check-ins in this period.”; activity shows “No check-in activity in this period.”; sessions per day is an em dash; no Retry alert is shown. |
| Existing coverage | API test has an empty overview assertion; browser page copy is not asserted.                                                                                                                                 |
| Proposed action   | NEW TEST REQUIRED.                                                                                                                                                                                           |
| Priority          | Medium                                                                                                                                                                                                       |
| Environment       | Mocked Playwright API.                                                                                                                                                                                       |
| Evidence          | `attendance-overview-page.tsx:40-50,118-124,219-230`.                                                                                                                                                        |

## T015 - Failed overview states and recovery

| Field             | Specification                                                                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test ID           | `PG-007-F001-A010-T015`                                                                                                                                               |
| Atomic feature    | A010 - loading, error, and retry recovery                                                                                                                             |
| Test type         | Browser                                                                                                                                                               |
| Scenario          | Extend the existing two-failures-then-success regression to assert the page's unavailable data, not only the Retry loop.                                              |
| Preconditions     | Existing ADMIN session and deterministic intercepted responses.                                                                                                       |
| Test data         | First two GETs return 503 with `Attendance unavailable (1)` and `(2)`; third returns the current controlled overview payload.                                         |
| Steps             | Preserve the existing two Retry clicks and assert the alert, em-dash figures, unavailable status/activity text after failures, then confirm they clear after success. |
| Expected result   | Failed reads show Retry and source-defined unavailable placeholders; successful retry clears error UI and settles the figures.                                        |
| Existing coverage | `async-resource.spec.ts:12-78` verifies two failure messages, retry count, final heading, and three attempts.                                                         |
| Proposed action   | ADDITIONAL ASSERTION REQUIRED; keep the intentional `test.skip(live, ...)` and all existing failure/retry assertions.                                                 |
| Priority          | High                                                                                                                                                                  |
| Environment       | Mocked Playwright API; the spec intentionally skips in live mode.                                                                                                     |
| Evidence          | `async-resource.spec.ts:1-78`; `attendance-overview-page.tsx:86-103,118-124,219-230`.                                                                                 |

## T016 - Personal overview authorization and identity

| Field             | Specification                                                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test ID           | `PG-007-F001-A011-T016`                                                                                                                                         |
| Atomic feature    | A011 - authentication, role checks, and employee ownership                                                                                                      |
| Test type         | API                                                                                                                                                             |
| Scenario          | Extend the personal PGlite route case with anonymous and USER denials while preserving existing STAFF/ADMIN scope and override assertions.                      |
| Preconditions     | Existing PGlite management overview test and isolated User/role fixtures.                                                                                       |
| Test data         | Anonymous request; active USER with no attendance role; existing STAFF and ADMIN; existing SUPERADMIN denial case remains in `superadmin.test.ts`.              |
| Steps             | Request `/me/overview` without credentials and as USER, then run existing valid STAFF/ADMIN requests and ownership/override assertions.                         |
| Expected result   | Anonymous 401; USER 403; existing STAFF/ADMIN source behavior unchanged; SUPERADMIN remains 403; no personal data fields are returned to denied callers.        |
| Existing coverage | Management test covers STAFF/ADMIN identity and overrides; Superadmin suite covers SUPERADMIN denial. No direct anonymous/USER `/me/overview` assertions found. |
| Proposed action   | ADDITIONAL ASSERTION REQUIRED; preserve existing test fixture and checks.                                                                                       |
| Priority          | Critical                                                                                                                                                        |
| Environment       | API/PGlite via `startPgliteApp`; no live database.                                                                                                              |
| Evidence          | `management.test.ts:1239-1285`; `superadmin.test.ts:9-260`; `routes.ts:10-11,159-161`; `attendance.service.ts:25-57`.                                           |

## T017 - Personal overview with missing Employee profile

| Field             | Specification                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Test ID           | `PG-007-F001-A011-T017`                                                                                                    |
| Atomic feature    | A011 - authentication, role checks, and employee ownership                                                                 |
| Test type         | API                                                                                                                        |
| Scenario          | Confirm an active ADMIN who has no linked Employee cannot obtain a personal overview and the read does not create records. |
| Preconditions     | Isolated PGlite app; active ADMIN User without Employee.                                                                   |
| Test data         | `from=2026-11-13&to=2026-11-13`; record Employee/workday counts before request.                                            |
| Steps             | GET `/attendance/me/overview` with the ADMIN token; compare status/body and record counts afterward.                       |
| Expected result   | HTTP 409 with the source-defined profile-required error; no Employee or attendance rows are implicitly created.            |
| Existing coverage | PG-006 T004 tests profileless ADMIN for `/me/current` and `/me/history`, not `/me/overview`.                               |
| Proposed action   | NEW TEST REQUIRED.                                                                                                         |
| Priority          | High                                                                                                                       |
| Environment       | API/PGlite; isolated user and database.                                                                                    |
| Evidence          | `attendance.service.ts:37-57`; `attendance.management.ts:656-660`; PG-006 `backend.test.ts` T004.                          |

## T018 - Date format, ordering, and length boundaries

| Field             | Specification                                                                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test ID           | `PG-007-F001-A012-T018`                                                                                                                                                                       |
| Atomic feature    | A012 - range validation and report aggregation                                                                                                                                                |
| Test type         | API                                                                                                                                                                                           |
| Scenario          | Check accepted and rejected personal overview date filters.                                                                                                                                   |
| Preconditions     | Active linked STAFF/ADMIN and isolated PGlite API.                                                                                                                                            |
| Test data         | Invalid `2026-02-30`; reversed `2026-11-14` to `2026-11-13`; 366 inclusive dates `2025-01-01` to `2026-01-01`; 367 inclusive dates `2025-01-01` to `2026-01-02`; unsupported extra query key. |
| Steps             | Issue the GET for each query and record each response.                                                                                                                                        |
| Expected result   | Invalid calendar date, reversed bounds, 367-day span, and unsupported key return 400; 366 inclusive dates is accepted with 200, including when no rows match.                                 |
| Existing coverage | Shared `parseAttendanceHistory` has API coverage through history/report endpoints; no direct boundary case was found for `/me/overview`.                                                      |
| Proposed action   | NEW TEST REQUIRED. Keep existing `departmentId`/`employeeId` override assertions in T016.                                                                                                     |
| Priority          | High                                                                                                                                                                                          |
| Environment       | API/PGlite; fixed attendance clock.                                                                                                                                                           |
| Evidence          | `attendance.schema.ts:44-77`; `attendance.management.ts:643-651`; `management.test.ts:1278-1285`.                                                                                             |

## T019 - Personal aggregation, leave merge, and activity cap

| Field             | Specification                                                                                                                                                                                                                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test ID           | `PG-007-F001-A012-T019`                                                                                                                                                                                                                                                                                                      |
| Atomic feature    | A012 - range validation and report aggregation                                                                                                                                                                                                                                                                               |
| Test type         | API                                                                                                                                                                                                                                                                                                                          |
| Scenario          | Reconcile personal counters against deterministic PGlite data, including workday/leave overlap, leave-only date, session states, recent-event cap, and employee isolation.                                                                                                                                                   |
| Preconditions     | Active STAFF with linked Employee and assigned Asia/Manila policy; second employee with same-range attendance; fixed clock after the seeded events.                                                                                                                                                                          |
| Test data         | Own workdays Nov 13-16, 2026; three closed sessions Nov 13 (one with a completed break), one open unpaid-break session Nov 14, one suspended session Nov 15, one working session Nov 16; approved leave 240 min overlapping Nov 13 and 480 min on leave-only Nov 17; one foreign employee session in range. Query Nov 13-17. |
| Steps             | GET `/me/overview`; compare returned fields to explicit Prisma counts/fixtures; inspect recent event identities and order.                                                                                                                                                                                                   |
| Expected result   | `scope=PERSONAL`; recordedDays 4; approvedLeaveDays 2; approvedLeaveHours 12; checkIns employees 1, total 6, closed 3, working 1, onBreak 1, suspended 1; recent activity length 8, newest-first, no foreign employee. Overlapping date is merged, and the leave-only day is not a recorded attendance day.                  |
| Existing coverage | Existing PGlite personal test verifies session total, own employee count/name, and admin zero; organization overview test verifies state totals, eight-event cap/order, and empty result. It does not cover personal leave merge or all stated fields together.                                                              |
| Proposed action   | NEW TEST REQUIRED. Avoid asserting the UI representation of suspended sessions here; this test verifies the API's separate suspended count.                                                                                                                                                                                  |
| Priority          | Critical                                                                                                                                                                                                                                                                                                                     |
| Environment       | API/PGlite with fixed dates, deterministic policy assignment, and fixture cleanup.                                                                                                                                                                                                                                           |
| Evidence          | `attendance.management.ts:658-761`; `attendance.reporting.ts:19-105,158-173`; `attendance.summary.ts:20-137`; `management.test.ts:1000-1136,1239-1285`; Prisma models `schema.prisma:822-864,1280-1296,1519-1567`.                                                                                                           |

## T020 - Real overview render from PGlite-backed attendance

| Field             | Specification                                                                                                                                                                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test ID           | `PG-007-F001-A013-T020`                                                                                                                                                                                                                                                                |
| Atomic feature    | A013 - responsive and accessible presentation; real summary path                                                                                                                                                                                                                       |
| Test type         | Integration                                                                                                                                                                                                                                                                            |
| Scenario          | Verify one deterministic real attendance session flows through browser, Next proxy, Express, Prisma, and PGlite into the overview display.                                                                                                                                             |
| Preconditions     | Isolated `attendance-browser-server.ts` PGlite fixture; dedicated STAFF identity with Employee and assigned policy; no existing workday for the selected fixture date. Browser clock and API attendance clock are independently controlled.                                            |
| Test data         | Fixed workday `2026-11-20`, Asia/Manila policy; create one session via real `/me/clock-in` and `/me/clock-out` API calls at 09:00 and 10:00 local time; page range includes Nov 20.                                                                                                    |
| Steps             | Set fixture API clock, create and close the session with the dedicated token, freeze browser clock for the range, navigate to `/attendance/overview` without route interception, and inspect the actual GET and rendered summary.                                                      |
| Expected result   | Real same-origin request succeeds; one recorded day and one closed session appear; Check-outs is 1 with 100% completed; status is Clocked out 1; sessions per day is 1.0; recent activity shows the two real events in UTC. Read-only page view creates no additional workday/session. |
| Existing coverage | Current live overview route checks only status 200/headings; existing API/PGlite checks aggregate data without rendering the page.                                                                                                                                                     |
| Proposed action   | NEW TEST REQUIRED.                                                                                                                                                                                                                                                                     |
| Priority          | Critical                                                                                                                                                                                                                                                                               |
| Environment       | Browser → Next.js proxy → Express → Prisma/PGlite integration; no mocked overview response and no PostgreSQL-specific claim.                                                                                                                                                           |
| Evidence          | `attendance.spec.ts:13-45,180-188`; `attendance-browser-server.ts:1-90,210-250`; API mount `apps/api/src/app.ts:131`; `attendance-overview-page.tsx:29-39`; `routes.ts:159-161`.                                                                                                       |

## T021 - Existing responsive overview matrix

| Field             | Specification                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| Test ID           | `PG-007-F001-A013-T021`                                                                                              |
| Atomic feature    | A013 - responsive and accessible presentation                                                                        |
| Test type         | Browser                                                                                                              |
| Scenario          | Preserve responsive overview rendering, headings, action link, refresh, and overflow assertions at 390/820/1440 px.  |
| Preconditions     | Existing serial attendance browser fixture.                                                                          |
| Test data         | Existing ADMIN fixture and real overview API responses.                                                              |
| Steps             | Keep the current per-width route flow and all assertions unchanged.                                                  |
| Expected result   | Existing expected headings/link/status, Refresh 200, settled figures, and no horizontal overflow remain in the test. |
| Existing coverage | `apps/web/e2e/attendance.spec.ts:1398-1458` directly covers the listed viewports.                                    |
| Proposed action   | EXISTING COVERAGE SUFFICIENT; preserve. No current pass claim is made.                                               |
| Priority          | Medium                                                                                                               |
| Environment       | Playwright with isolated local attendance API/PGlite fixture.                                                        |
| Evidence          | `attendance.spec.ts:1398-1458`; `overview-panel.tsx:249-293`.                                                        |

## Count and scope reconciliation

- New tests: T002-T005, T008-T009, T011-T014, T017-T020 (14).
- Additive assertion groups: T007, T015-T016 (3).
- Existing-sufficient records: T001, T021 (2).
- Contract-blocked: T006/C001 date clearing and T010/C002 suspended-session display (2).
- Not applicable: search, sorting, pagination, employee/department filtering, details, approval dialogs, and mutations are absent from the page source.
- PG-004-D-001 and PG-006 T024 remain open findings; neither is attributed to this page absent evidence.

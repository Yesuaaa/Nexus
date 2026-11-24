# PG-008 Test Case Specification

## Counting and execution status

The inventory contains 35 unique case records: 14 new test declarations, 5 additive assertion groups, 15 existing-sufficient cases, and 1 contract-clarification case. The contract-blocked record is excluded from the 34 implementable cases. None of the tests were executed during Phase 2.1; “existing sufficient” means source-level assertions were found, not that a passing run was observed.

| Primary test layer | Unique records | Implementable records |
| ------------------ | -------------: | --------------------: |
| Unit               |              2 |                     2 |
| API                |              9 |                     8 |
| Browser            |             17 |                    17 |
| Integration        |              7 |                     7 |
| Total              |             35 |                    34 |

| Disposition                     | Count |
| ------------------------------- | ----: |
| NEW TEST REQUIRED               |    14 |
| ADDITIONAL ASSERTION REQUIRED   |     5 |
| EXISTING COVERAGE SUFFICIENT    |    15 |
| CONTRACT CLARIFICATION REQUIRED |     1 |

## Cases

### PG-008-F001-A001-T001 — Configure permission helper matrix

- Test ID / atomic feature / type: PG-008-F001-A001-T001 / A001 / Unit.
- Objective: establish the direct route predicate for active ADMIN and SUPERADMIN with employees:manage, and its denied role/inactive/permission cases.
- Preconditions and inputs: account fixtures for active ADMIN/SUPERADMIN with and without employees:manage, active STAFF/USER, and inactive ADMIN.
- Steps: call canConfigureAttendance for each fixture; inspect the Policies navigation access decision.
- Expected result: only active privileged accounts with employees:manage pass.
- Evidence: apps/web/src/features/auth/model/permissions.ts:118-124; route-policy.ts:341-379,438-442,739-744; attendance-navigation tests at apps/web/test/attendance.test.mjs:87-148,250-270.
- Existing coverage: attendance.test.mjs:87-148 and 250-270 covers neighboring Attendance navigation predicates, not a full canConfigureAttendance matrix.
- Proposed action: ADDITIONAL ASSERTION REQUIRED.
- Priority: High. Environment/dependencies: Node unit; production permission and navigation helpers.

### PG-008-F001-A001-T002 — Canonical page access and alias

- Test ID / atomic feature / type: PG-008-F001-A001-T002 / A001 / Browser.
- Objective: check direct canonical navigation, sidebar visibility, denial, and legacy redirect.
- Preconditions and inputs: isolated sessions for active ADMIN, active SUPERADMIN, active STAFF, active USER, and inactive ADMIN.
- Steps: navigate each session directly to /attendance/policies/management; inspect page content and current route policy destination; then navigate eligible sessions to /attendance/settings.
- Expected result: eligible accounts see the management page; denied accounts never see policy data or controls; the alias redirects to /attendance/policies/management.
- Evidence: route-policy.ts:341-379,438-442,739-744; permissions.ts:118-124; attendance/settings/page.tsx:1-5; canonical page.tsx:1-5.
- Existing coverage: attendance.spec.ts checks the alias and neighboring role boundaries, but not this complete direct-route matrix.
- Proposed action: NEW TEST REQUIRED.
- Priority: High. Environment/dependencies: Playwright with real portal auth/route policy; mocked or isolated policy GET.

### PG-008-F001-A002-T001 — Initial directory request contract

- Test ID / atomic feature / type: PG-008-F001-A002-T001 / A002 / Browser.
- Objective: assert the initial directory request uses page 1, size 10, active status, and no search, while loading is announced.
- Preconditions and inputs: authorized ADMIN session; defer the policy GET then return a deterministic active row.
- Steps: navigate to canonical route; inspect GET query and aria-busy/skeleton; fulfill the response and inspect the row.
- Expected result: exact query is page=1, size=10, status=active with no search value; five skeleton rows appear while pending and the table settles after success.
- Evidence: attendance-settings-page.tsx:105-123,208-260; attendance-api.ts:283-307; attendance.management.ts:795-861.
- Existing coverage: attendance.spec.ts:2786-approximately 2890 verifies skeleton count, cells, busy state, and retained rows, but does not assert the query tuple.
- Proposed action: ADDITIONAL ASSERTION REQUIRED.
- Priority: High. Environment/dependencies: Playwright deferred API response; existing attendance browser fixture.

### PG-008-F001-A002-T002 — Directory error and retry

- Test ID / atomic feature / type: PG-008-F001-A002-T002 / A002 / Browser.
- Objective: verify an initial policy-list failure can recover through the page retry control.
- Preconditions and inputs: authorized session; first GET returns 503, second returns one active policy.
- Steps: navigate, assert visible ResourceStatus error, activate Retry once, then wait for the successful result.
- Expected result: first error is visible; second request occurs; policy row renders and error clears.
- Evidence: attendance-settings-page.tsx:208-212; use-paginated-list.ts:177-190; ResourceStatus in attendance-shared.tsx.
- Existing coverage: no initial list failure/retry case found.
- Proposed action: NEW TEST REQUIRED.
- Priority: High. Environment/dependencies: Mocked Playwright API; no database claim.

### PG-008-F001-A003-T001 — Backend policy name and timezone search

- Test ID / atomic feature / type: PG-008-F001-A003-T001 / A003 / API.
- Objective: verify policy GET filters name and timezone case-insensitively and accepts a trimmed search query up to the configured limit.
- Preconditions and inputs: PGlite ADMIN fixture with three active policies: “Alpha flex” / Asia/Manila, “Beta fixed” / America/New_York, and “Gamma” / UTC.
- Steps: GET /policies with search=alpha, search=AMERICA/NEW_YORK, search padded with whitespace, and a 101-character value.
- Expected result: matching policy rows and total are returned for name/timezone terms; surrounding query whitespace is parsed consistently with source; over-limit query returns 400.
- Evidence: attendance.management.ts:795-821; routes.ts:35-37.
- Existing coverage: no policy-directory search API assertion found.
- Proposed action: NEW TEST REQUIRED.
- Priority: High. Environment/dependencies: PGlite API fixture; no browser or live database.

### PG-008-F001-A003-T002 — Search, page reset, and empty result

- Test ID / atomic feature / type: PG-008-F001-A003-T002 / A003 / Browser.
- Objective: verify name/timezone search is trimmed, case-insensitive, debounced, resets pagination, and displays no-match state.
- Preconditions and inputs: 12 active policies across two pages, with unique names and timezones; page starts at 2.
- Steps: search by mixed-case partial name with surrounding spaces; inspect request and result; search a timezone; search an unmatched value.
- Expected result: page resets to 1; query matches name or timezone without case sensitivity; the unmatched query displays SearchEmptyState.
- Evidence: attendance-settings-page.tsx:105-123,181-191,271-279; use-paginated-list.ts:107-127; attendance.management.ts:795-821.
- Existing coverage: no policy directory search assertion found.
- Proposed action: NEW TEST REQUIRED.
- Priority: High. Environment/dependencies: Mocked Playwright API; deterministic response rows.

### PG-008-F001-A003-T003 — Out-of-order search responses

- Test ID / atomic feature / type: PG-008-F001-A003-T003 / A003 / Browser.
- Objective: prove an older search response cannot replace the current query result.
- Preconditions and inputs: two distinct search values; hold the first GET and return the second GET first.
- Steps: enter query “Alpha”; before it resolves enter “Beta”; fulfill Beta, then fulfill or reject the aborted Alpha request.
- Expected result: Beta rows remain displayed, pending state settles, and no stale Alpha rows overwrite them.
- Evidence: use-paginated-list.ts:107-127,151-190; attendance-settings-page.tsx:105-123.
- Existing coverage: hook implements abort and active-response guards; no policy-page assertion found.
- Proposed action: NEW TEST REQUIRED.
- Priority: High. Environment/dependencies: Mocked Playwright API with deferred requests.

### PG-008-F001-A004-T001 — Active/archive view switching

- Test ID / atomic feature / type: PG-008-F001-A004-T001 / A004 / Browser.
- Objective: preserve the existing archive/restore directory behavior and verify switching clears the current search and resets page.
- Preconditions and inputs: an active policy and an archived policy; search/page state populated.
- Steps: archive the active policy through its confirmation; view archived policies; restore it; return to active policies.
- Expected result: status-specific rows and empty copy follow selected view; archive/restore moves the row between the views; search clears and page returns to 1.
- Evidence: attendance-settings-page.tsx:132-137,192-201,271-279,330-368; attendance.spec.ts:1809 onward.
- Existing coverage: lifecycle browser case and API archive tests directly cover view transition and mutation.
- Proposed action: EXISTING COVERAGE SUFFICIENT; preserve current lifecycle assertions.
- Priority: High. Environment/dependencies: Existing Playwright + local API/PGlite fixture.

### PG-008-F001-A005-T001 — Directory pagination and stable ordering

- Test ID / atomic feature / type: PG-008-F001-A005-T001 / A005 / API.
- Objective: verify server policy list pagination and deterministic ordering at the ten-row page boundary.
- Preconditions and inputs: isolated PGlite; create 11 policies with deterministic createdAt/id order.
- Steps: GET /policies?page=1&size=10&status=active, then page=2; compare IDs and order with fixture order.
- Expected result: page 1 contains 10, page 2 contains 1, there are no duplicates/missing rows, total is 11, order is createdAt desc then id desc.
- Evidence: attendance.management.ts:795-861; routes.ts:35-37; attendance-api.ts:283-307.
- Existing coverage: no >10 policy directory page test found; assignment detail paging is a different endpoint.
- Proposed action: NEW TEST REQUIRED.
- Priority: High. Environment/dependencies: PGlite API fixture and deterministic policy dates.

### PG-008-F001-A006-T001 — Directory row projection

- Test ID / atomic feature / type: PG-008-F001-A006-T001 / A006 / Browser.
- Objective: add assertions for timezone and assignment count to the existing real create-and-assign workflow.
- Preconditions and inputs: created flexible policy in Asia/Manila with one employee assignment.
- Steps: inspect the policy row after creation and again after successful assignment refresh.
- Expected result: row shows Flexible, Asia/Manila, derived weekly hours, and one assignment; current existing fallback for omitted _count remains zero.
- Evidence: attendance-settings-page.tsx:280-325; attendance.management.ts:847-856; attendance.spec.ts:1021-1059,1106-1108.
- Existing coverage: current browser assertions check the row name and fixed schedule/hours in a separate workflow; timezone/count are not comprehensively asserted.
- Proposed action: ADDITIONAL ASSERTION REQUIRED.
- Priority: Medium. Environment/dependencies: Existing browser/PGlite fixture; real list response.

### PG-008-F001-A007-T001 — Keyboard access to row actions

- Test ID / atomic feature / type: PG-008-F001-A007-T001 / A007 / Browser.
- Objective: directly exercise the policy row menu by keyboard without changing the shared component.
- Preconditions and inputs: one active policy; 390px viewport; focus the More actions button.
- Steps: press ArrowDown; inspect accessible menu and View policy details item; press Escape.
- Expected result: menu opens with accessible items; Escape closes it and returns focus to the same trigger. If the menu does not appear, preserve the failure.
- Evidence: attendance-settings-page.tsx:330-379; apps/web/src/components/ui/row-actions-menu.tsx:45 onward; PG-004-D-001 and PG-006 T018 ledger evidence.
- Existing coverage: PG-008 browser tests use pointer clicks; no keyboard assertion found for this page.
- Proposed action: NEW TEST REQUIRED.
- Priority: High. Environment/dependencies: Playwright; shared RowActionsMenu; do not alter PG-004 finding.

### PG-008-F001-A008-T001 — Policy overview details

- Test ID / atomic feature / type: PG-008-F001-A008-T001 / A008 / Browser.
- Objective: preserve overview content for fixed and flexible policies and the Assigned people tab transition.
- Preconditions and inputs: existing flexible policy and fixed Monday 22:00-06:00 with a 30-minute unpaid break.
- Steps: open policy details; inspect weekly hours, timezone and rules; switch to Assigned people and back to Overview.
- Expected result: API-backed rules and derived 7.5 hours render; overnight time includes “next day”; tabs show corresponding panel content without overflow.
- Evidence: attendance-policy-details-panel.tsx:52-195; attendance.spec.ts:1068-1135,1693-1734.
- Existing coverage: fixed schedule and responsive details browser cases directly assert these behaviors.
- Proposed action: EXISTING COVERAGE SUFFICIENT; preserve current field assertions.
- Priority: High. Environment/dependencies: Existing Playwright/PGlite fixture.

### PG-008-F001-A009-T001 — Assignment history statuses and pages

- Test ID / atomic feature / type: PG-008-F001-A009-T001 / A009 / API.
- Objective: expand the existing assignment detail test to verify multiple pages and all source status projections.
- Preconditions and inputs: PGlite fixture with at least 11 linked assignment rows at controlled dates, including CURRENT, SCHEDULED, ENDED, and CANCELLED.
- Steps: request page 1 and page 2 from /policies/:id/assignments; inspect status, employee projection, total and stable order.
- Expected result: each assignment appears once, status is calculated at injected time in policy timezone, and page boundaries/order match the response contract.
- Evidence: attendance.management.ts:989-1052; policy-management.test.ts:186-215; attendance-policy-details-panel.tsx:300-311.
- Existing coverage: existing API nested test checks permission, invalid page, one CURRENT row and employee identity; a separate scoped-mock Superadmin browser workflow asserts a CANCELLED row has no unassign action. Extend the PGlite fixture/assertion group for the full status set and page boundary.
- Proposed action: ADDITIONAL ASSERTION REQUIRED.
- Priority: High. Environment/dependencies: PGlite route fixture; injected clock; existing test declaration.

### PG-008-F001-A010-T001 — Flexible policy creation

- Test ID / atomic feature / type: PG-008-F001-A010-T001 / A010 / Integration.
- Objective: preserve the real flexible-policy create and assignment workflow through the browser and local database-backed API.
- Preconditions and inputs: ADMIN session; default flexible policy form; Attendance staff fixture; future effective date 2026-11-16 under fixed clock 2026-11-13.
- Steps: create “Browser new policy”, verify row, select employee and policy, choose date, confirm assignment.
- Expected result: panel closes, row is visible, assignment confirmation completes through actual Next.js/Express/PGlite path.
- Evidence: attendance.spec.ts:1021-1059; attendance-policy-panel.tsx:127-189; attendance.management.ts:862-881,1203-1325.
- Existing coverage: direct integrated workflow exists.
- Proposed action: EXISTING COVERAGE SUFFICIENT; preserve it. Its all-rest default is recorded as compatibility behavior, not as a separately approved product contract.
- Priority: High. Environment/dependencies: Existing isolated browser server and PGlite fixture.

### PG-008-F001-A011-T001 — Fixed overnight policy creation

- Test ID / atomic feature / type: PG-008-F001-A011-T001 / A011 / Integration.
- Objective: preserve a fixed overnight shift with derived required minutes and the break toggle.
- Preconditions and inputs: Monday 22:00-06:00, scheduled unpaid break 30 minutes, Asia/Manila timezone, review flags at defaults.
- Steps: switch to Fixed schedule, enable Monday, enter times, disable/re-enable unpaid breaks, enter 30 minutes, save and inspect row/details.
- Expected result: 7.5 required hours and “next day” display; 390px page has no horizontal overflow.
- Evidence: attendance.spec.ts:1068-1123; attendance-policy-panel.tsx:333-475; attendance.validation.ts:106-128.
- Existing coverage: direct integrated workflow exists.
- Proposed action: EXISTING COVERAGE SUFFICIENT; preserve all input and detail assertions.
- Priority: High. Environment/dependencies: Existing isolated browser server/PGlite fixture and attendance clock.

### PG-008-F001-A012-T001 — Pure policy validation boundaries

- Test ID / atomic feature / type: PG-008-F001-A012-T001 / A012 / Unit.
- Objective: preserve pure validator boundaries for exactly seven unique weekdays, timezone validity, flexible minute bounds, fixed shift boundaries, and break/overnight rules.
- Preconditions and inputs: deterministic seven-day payloads; valid named timezone; integer minutes 0, 1440, fractional, and out-of-range; fixed times 0-1439.
- Steps: invoke attendancePolicyDays, requiredAttendanceMinutes, and attendanceTimeZone using existing helper test patterns.
- Expected result: valid source-defined boundaries are accepted; duplicate/missing weekdays, invalid timezone, fractional/out-of-range minutes, identical shift endpoints, invalid break and overlap are rejected.
- Evidence: attendance.validation.ts:24-34,75-176; foundation.test.ts:486-510; fixed-schedule.test.ts:18-53.
- Existing coverage: relevant direct pure unit assertions already exist.
- Proposed action: EXISTING COVERAGE SUFFICIENT; preserve the validators and existing cases.
- Priority: High. Environment/dependencies: Node unit; no database.

### PG-008-F001-A012-T002 — API policy input boundaries

- Test ID / atomic feature / type: PG-008-F001-A012-T002 / A012 / API.
- Objective: verify server-side policy create validation independent of browser constraints.
- Preconditions and inputs: isolated ADMIN API session; valid Asia/Manila timezone; names of 100 and 101 characters; whitespace-only name; valid seven-day flexible payload; minutes 0, 1440, 1441, and fractional.
- Steps: POST valid boundary payloads and each invalid payload; inspect HTTP status and policy/day row counts after rejection.
- Expected result: valid source boundary values return 201; trimmed-empty name and invalid length/minute values return 400 with no partial policy persistence.
- Evidence: attendance.management.ts:101-165,862-881; attendance.validation.ts:24-34,75-176; routes.ts:38-41.
- Existing coverage: current API test rejects an invalid day configuration; existing unit tests cover several pure boundaries, but not this API request matrix.
- Proposed action: NEW TEST REQUIRED.
- Priority: High. Environment/dependencies: PGlite API fixture; no configured database.

### PG-008-F001-A012-T003 — All-rest policy contract

- Test ID / atomic feature / type: PG-008-F001-A012-T003 / A012 / API.
- Objective: determine whether a policy with seven non-working days and zero required minutes is intended to be accepted and assignable.
- Preconditions and inputs: seven days with isWorkingDay=false and requiredMinutes=0; named timezone and otherwise valid policy.
- Steps: defer a new assertion until an authoritative product rule is recorded; preserve the existing E2E behavior in the interim.
- Expected result: CONTRACT BLOCKED. Current source accepts the data, and the existing create workflow submits the default all-rest form, but intended business meaning is not documented.
- Evidence: attendance-policy-panel.tsx:77-93; attendance.validation.ts:75-145; attendance.spec.ts:1026-1038,1040-1059; attendance-settings-page.tsx:277.
- Existing coverage: compatibility assertion exists in the integrated create/assign workflow; it is not treated as authoritative clarification.
- Proposed action: CONTRACT CLARIFICATION REQUIRED.
- Priority: Medium. Environment/dependencies: Product owner/authoritative attendance policy contract; excluded from implementation counts.

### PG-008-F001-A013-T001 — Assigned timezone is read-only

- Test ID / atomic feature / type: PG-008-F001-A013-T001 / A013 / Browser.
- Objective: add a browser assertion that an assigned policy timezone input is read-only.
- Preconditions and inputs: policy with at least one assignment; enter Edit.
- Steps: inspect Attendance timezone value and readOnly attribute; attempt user input.
- Expected result: timezone remains the original value and cannot be changed in the UI; API rejection remains asserted separately.
- Evidence: attendance-policy-panel.tsx:314-330; attendance.spec.ts:1774-1786; policy-management.test.ts:91-105.
- Existing coverage: UI asserts the value, API asserts HTTP 409 on changing an assigned timezone.
- Proposed action: ADDITIONAL ASSERTION REQUIRED.
- Priority: High. Environment/dependencies: Existing Playwright/PGlite fixture and API test.

### PG-008-F001-A013-T002 — Edit API failure recovery

- Test ID / atomic feature / type: PG-008-F001-A013-T002 / A013 / Browser.
- Objective: verify the edit panel retains input and exposes an API error after a failed PATCH.
- Preconditions and inputs: active editable policy; fill a new name; mock PATCH response 409 with a stable error body.
- Steps: submit edit; inspect error and form; replace input with valid value; retry with 200 response.
- Expected result: failed attempt leaves panel open with error and changed input intact; successful retry closes and reloads row.
- Evidence: attendance-policy-panel.tsx:127-167,190-213,298-332; errorMessage call at 197-210.
- Existing coverage: no edit-panel API failure/retry assertion found.
- Proposed action: NEW TEST REQUIRED.
- Priority: High. Environment/dependencies: Mocked Playwright API; no persistence claim.

### PG-008-F001-A014-T001 — Employee search and selection persistence

- Test ID / atomic feature / type: PG-008-F001-A014-T001 / A014 / Browser.
- Objective: preserve name/ID search, selection across query changes, multi-selection, no-match copy, and assignment payload.
- Preconditions and inputs: mocked employee response with 12 rows over two pages; choose two employee IDs and search terms that hide one selected row.
- Steps: select, search, clear/change query, inspect selected count and checkboxes, confirm assignment and inspect POST bodies.
- Expected result: selected IDs survive filtering, search finds name/ID, no-match copy appears, payload contains selected IDs one request at a time.
- Evidence: attendance-policy-assignment.spec.ts:104-174; attendance-api.ts:195-215; employee-selection.tsx:57-151.
- Existing coverage: direct mocked browser case exists at desktop and compact widths.
- Proposed action: EXISTING COVERAGE SUFFICIENT; keep its live-mode skip.
- Priority: High. Environment/dependencies: Scoped mock API; this does not prove persistence.

### PG-008-F001-A014-T002 — Employee and policy-choice loader retry

- Test ID / atomic feature / type: PG-008-F001-A014-T002 / A014 / Browser.
- Objective: test retry of employee list and active policy choice loaders before assignment can submit.
- Preconditions and inputs: assignment panel; first employees request fails then succeeds; active policies request fails then succeeds.
- Steps: open panel, assert ResourceStatus and disabled submit, use Retry for each resource, choose an employee/policy/date.
- Expected result: both resources recover and render; assignment remains disabled until the required data is ready.
- Evidence: attendance-employee-selection.tsx:24-31; attendance-settings-page.tsx:124-131,393-400; attendance-policy-panel.tsx:113-119,242-262,481-498.
- Existing coverage: no loader-failure retry case found.
- Proposed action: NEW TEST REQUIRED.
- Priority: Medium. Environment/dependencies: Mocked Playwright API with independently controlled endpoints.

### PG-008-F001-A015-T001 — Successful assignment persistence

- Test ID / atomic feature / type: PG-008-F001-A015-T001 / A015 / Integration.
- Objective: preserve one successful employee assignment through the real browser/API/database boundary.
- Preconditions and inputs: ADMIN; active policy; Attendance staff employee; future date 2026-11-16 under fixed clock 2026-11-13.
- Steps: select employee and policy, choose date, submit, confirm; verify panel closes and user-facing result.
- Expected result: POST /assignments succeeds and a persisted assignment links employee, policy, and effectiveFrom; audit/persistence belong to the PGlite fixture.
- Evidence: attendance.spec.ts:1021-1059; attendance-policy-panel.tsx:127-189; attendance.management.ts:1203-1325; schema.prisma:1500-1517.
- Existing coverage: direct integrated workflow already crosses Next.js, Express, Prisma, and isolated PGlite.
- Proposed action: EXISTING COVERAGE SUFFICIENT; preserve it.
- Priority: Critical. Environment/dependencies: Isolated PGlite browser fixture; no live DB.

### PG-008-F001-A015-T002 — Assignment API input and date guards

- Test ID / atomic feature / type: PG-008-F001-A015-T002 / A015 / API.
- Objective: verify malformed assignment dates/IDs, missing employee/policy, unknown body keys, and a date before today in policy timezone are rejected.
- Preconditions and inputs: ADMIN session, valid active policy and employee, injected clock 2026-11-13T12:00Z, policy timezone Asia/Manila; inputs include malformed 2026-99-99 and prior date 2026-11-12.
- Steps: POST each invalid request; inspect status, assignment count, and audit count.
- Expected result: malformed input returns 400, missing records return 404, and past effective date returns 400; rejected requests write no assignment or mutation audit.
- Evidence: attendance.management.ts:101-120,1203-1240; attendance.schema.ts:44-73; routes.ts:87-90.
- Existing coverage: overlap, archived policy, leave/workday and timezone transition guards exist in neighboring API tests; this exact request-boundary matrix was not found.
- Proposed action: NEW TEST REQUIRED.
- Priority: High. Environment/dependencies: PGlite API fixture; fixed attendance clock.

### PG-008-F001-A015-T003 — Duplicate confirm while assignment is pending

- Test ID / atomic feature / type: PG-008-F001-A015-T003 / A015 / Browser.
- Objective: ensure rapid confirmation does not issue duplicate POSTs while save is pending.
- Preconditions and inputs: one selected employee, active policy, date set, mocked POST held pending.
- Steps: submit, click confirmation twice before resolving first request, then fulfill once.
- Expected result: one assignment POST is sent, controls are disabled while pending, one success closes the panel.
- Evidence: attendance-policy-panel.tsx:101-103,127-131,168-189,263-268,481-523.
- Existing coverage: source has a pending guard; no duplicate-click assertion found.
- Proposed action: NEW TEST REQUIRED.
- Priority: High. Environment/dependencies: Mocked Playwright API with deferred POST.

### PG-008-F001-A016-T001 — Partial multi-employee assignment retry

- Test ID / atomic feature / type: PG-008-F001-A016-T001 / A016 / Browser.
- Objective: preserve the existing partial success and retry-only-remaining behavior.
- Preconditions and inputs: two selected employees; first assignment succeeds; second returns 409 once then succeeds.
- Steps: submit both; inspect success/error and selected IDs; retry; inspect subsequent POST.
- Expected result: successful ID is removed; failed ID remains selected; retry sends only the remaining ID.
- Evidence: attendance-policy-panel.tsx:132-177,190-210; attendance-policy-assignment.spec.ts:177-237.
- Existing coverage: direct mocked Playwright test exists.
- Proposed action: EXISTING COVERAGE SUFFICIENT; preserve test and assertions.
- Priority: High. Environment/dependencies: Mock API only; not database persistence.

### PG-008-F001-A017-T001 — Replace current policy and return to details

- Test ID / atomic feature / type: PG-008-F001-A017-T001 / A017 / Integration.
- Objective: preserve current-policy replacement, outgoing-policy exclusion, back navigation, scheduled state, and scheduled cancellation.
- Preconditions and inputs: current assignment under Asia/Manila; a second active fixed policy; future replacement date 2026-11-16.
- Steps: open Assigned people, choose Replace, back and re-open; select a different policy/date, confirm; inspect successor status and cancel it.
- Expected result: outgoing policy is not a replacement choice; Back restores details tab/page; successor is scheduled; cancellation restores prior coverage and removes pending row.
- Evidence: attendance.spec.ts:1183-1243; attendance-policy-details-panel.tsx:312-326; attendance.management.ts:1263-1322; policy-replacement.test.ts:121-323.
- Existing coverage: direct browser/PGlite and API/PGlite coverage exists.
- Proposed action: EXISTING COVERAGE SUFFICIENT; preserve lifecycle and relationship assertions.
- Priority: Critical. Environment/dependencies: Existing attendance browser server/PGlite fixture and injected clock.

### PG-008-F001-A018-T001 — Archive and restore history

- Test ID / atomic feature / type: PG-008-F001-A018-T001 / A018 / API.
- Objective: preserve archive/restore guards, active choice behavior, and historical assignment retention.
- Preconditions and inputs: assigned active policy and separate disposable unassigned policy.
- Steps: archive assigned policy; attempt new assignment/edit/delete; restore; inspect archivedAt and assignment history.
- Expected result: archive persists; existing attendance remains associated; archived policy cannot be assigned/edited/deleted while assigned; restore clears archivedAt.
- Evidence: policy-management.test.ts:216-258; attendance.management.ts:947-966.
- Existing coverage: direct API/PGlite assertions exist.
- Proposed action: EXISTING COVERAGE SUFFICIENT; preserve all existing denial and history checks.
- Priority: High. Environment/dependencies: PGlite API fixture and audit context.

### PG-008-F001-A019-T001 — Permanent deletion constraints

- Test ID / atomic feature / type: PG-008-F001-A019-T001 / A019 / API.
- Objective: preserve the archived-unassigned-only deletion rule and resulting row/audit state.
- Preconditions and inputs: active policy, assigned archived policy, and disposable unassigned policy.
- Steps: attempt deletes for active and assigned policy; archive unassigned policy; delete; query policy, days, and audit rows; repeat delete.
- Expected result: first attempts return 409; allowed deletion returns 200 and removes policy/day rows with audit; repeated delete returns 404.
- Evidence: policy-management.test.ts:260-301; attendance.management.ts:968-987; schema.prisma:1474-1498.
- Existing coverage: direct API/PGlite assertions exist.
- Proposed action: EXISTING COVERAGE SUFFICIENT; preserve DB and audit assertions.
- Priority: High. Environment/dependencies: PGlite API fixture.

### PG-008-F001-A020-T001 — End current assignment

- Test ID / atomic feature / type: PG-008-F001-A020-T001 / A020 / Integration.
- Objective: preserve current assignment confirmation, expectedStatus payload, focus/cancel behavior, and server conflict recovery.
- Preconditions and inputs: current assignment and a mocked/server 409 caused by recorded attendance.
- Steps: choose End assignment; inspect confirmation copy; cancel with Escape and verify focus; reopen, confirm, inspect request and error; cancel.
- Expected result: POST includes expectedStatus CURRENT; conflict stays visible and assignment remains; cancel closes dialog and restores focus.
- Evidence: attendance.spec.ts:1143-1182; attendance-policy-details-panel.tsx:224-243,312-359; attendance.management.ts:1053-1202.
- Existing coverage: direct browser and PGlite unassignment cases exist.
- Proposed action: EXISTING COVERAGE SUFFICIENT; preserve expectedStatus and 409 assertions.
- Priority: High. Environment/dependencies: Existing browser/PGlite fixture plus controlled conflict response.

### PG-008-F001-A021-T001 — Cancel scheduled assignment

- Test ID / atomic feature / type: PG-008-F001-A021-T001 / A021 / Integration.
- Objective: preserve cancellation of future scheduled coverage and restore linked prior coverage.
- Preconditions and inputs: current predecessor with future scheduled successor effective 2026-11-16.
- Steps: choose Cancel scheduled assignment; confirm; reload assignment history.
- Expected result: POST includes expectedStatus SCHEDULED; successor is cancelled/removed according to retained history rules and predecessor interval is restored; list refreshes.
- Evidence: attendance.spec.ts:1232-1243; attendance.management.ts:1053-1178; policy-unassignment.test.ts:160-465; policy-replacement.test.ts:144-285.
- Existing coverage: direct browser/API PGlite assertions exist.
- Proposed action: EXISTING COVERAGE SUFFICIENT; preserve.
- Priority: High. Environment/dependencies: Existing browser/PGlite fixture and controlled clock.

### PG-008-F001-A022-T001 — Assignment detail retry and stale page response

- Test ID / atomic feature / type: PG-008-F001-A022-T001 / A022 / Browser.
- Objective: verify assignment-detail GET failure retry, page selection clearing, and stale page response rejection.
- Preconditions and inputs: policy with two pages of assignments; defer page 1 and page 2 requests; make one request fail once.
- Steps: open Assigned people, trigger page 2, resolve it before held page 1; then fail/retry current page.
- Expected result: page 2 remains visible after older response; page change clears pending confirmation; retry repopulates current page and error clears.
- Evidence: attendance-policy-details-panel.tsx:216-243,373-381; attendance-api.ts:373-381; use-async-resource.ts shared hook.
- Existing coverage: no policy detail async-race/retry browser assertion found.
- Proposed action: NEW TEST REQUIRED.
- Priority: Medium. Environment/dependencies: Mocked Playwright API with deferred page responses.

### PG-008-F001-A023-T001 — Responsive settings and panels

- Test ID / atomic feature / type: PG-008-F001-A023-T001 / A023 / Browser.
- Objective: preserve compact, threshold, and desktop layout with details and create/edit/assignment panels.
- Preconditions and inputs: authorized fixture and widths 390, 820, and 1440px.
- Steps: visit settings, inspect policy row, open details and create/edit/assignment panels, check document and panel overflow.
- Expected result: page and dialogs fit viewport, controls remain visible and interactable, no horizontal overflow.
- Evidence: attendance.spec.ts:1636-1806; attendance-settings-page.tsx:53-65,213-260.
- Existing coverage: direct responsive page/panel cases exist at the three widths.
- Proposed action: EXISTING COVERAGE SUFFICIENT; preserve widths and assertions. PG-006 T024 remains separately intermittent at 820px.
- Priority: Medium. Environment/dependencies: Existing serial Playwright/PGlite fixture.

### PG-008-F001-A024-T001 — Backend role and authentication enforcement

- Test ID / atomic feature / type: PG-008-F001-A024-T001 / A024 / API.
- Objective: preserve direct API authorization for policy reads and management mutations independent of the frontend route.
- Preconditions and inputs: anonymous, USER, STAFF, ADMIN, and SUPERADMIN sessions in the PGlite API fixture.
- Steps: GET /attendance/policies as each actor; attempt a policy mutation/detail operation with STAFF; use permitted ADMIN/SUPERADMIN requests.
- Expected result: anonymous/unsupported actors are rejected; only configured roles with employees:manage perform policy configuration; no client-side visibility is accepted as proof.
- Evidence: backend-regression.test.ts:103-127; policy-management.test.ts:91-105,186-198; routes.ts:16,35-100; attendance.management.ts:82-100.
- Existing coverage: direct role/read matrix and mutation 403 assertions are present.
- Proposed action: EXISTING COVERAGE SUFFICIENT; preserve both role and API-boundary assertions.
- Priority: Critical. Environment/dependencies: Real Express API with isolated PGlite; auth sessions.

### PG-008-F001-A025-T001 — Concurrent assignment serialization

- Test ID / atomic feature / type: PG-008-F001-A025-T001 / A025 / Integration.
- Objective: verify conflicting simultaneous assignments for one employee serialize under PostgreSQL row locking.
- Preconditions and inputs: fresh disposable local PostgreSQL database; two active policies; one employee; two manager sessions; both effective dates overlap; no existing assignment.
- Steps: send both POST /assignments concurrently; query persisted assignment intervals and audit rows after both responses.
- Expected result: at most one conflicting assignment succeeds, the other returns a source-defined conflict, and no overlapping active intervals or duplicate accepted assignment persist.
- Evidence: attendance.management.ts:1203-1325 (employee row lock, overlap validation, ReadCommitted transaction); deactivation-concurrency.postgres.ts:1-54 as opt-in PostgreSQL test convention.
- Existing coverage: no PG-008-specific PostgreSQL concurrency declaration found.
- Proposed action: NEW TEST REQUIRED.
- Priority: High. Environment/dependencies: Opt-in disposable loopback PostgreSQL database, isolated credentials, concurrency-safe fixture/teardown; not PGlite.

## Summary by disposition and primary layer

| Disposition                     | Unit | API | Browser | Integration | Total |
| ------------------------------- | ---: | --: | ------: | ----------: | ----: |
| NEW TEST REQUIRED               |    0 |   4 |       9 |           1 |    14 |
| ADDITIONAL ASSERTION REQUIRED   |    1 |   1 |       3 |           0 |     5 |
| EXISTING COVERAGE SUFFICIENT    |    1 |   3 |       5 |           6 |    15 |
| CONTRACT CLARIFICATION REQUIRED |    0 |   1 |       0 |           0 |     1 |
| Total records                   |    2 |   9 |      17 |           7 |    35 |

The blocked API case is excluded from the 34 implementable records. Implementable counts by layer are 2 Unit, 8 API, 17 Browser, and 7 Integration.

# PG-005 Test Case Specification

**Phase:** 2.1, design only  
**Page:** PG-005, /attendance/audit  
**Baseline:** branch 293-test-full-system-audit-for-verifying-recent-changes, HEAD 64535202df403eb6f3a8e80ff3a7e6385d1dbc2b.  
**Execution:** No test suite was run. Existing coverage classifications mean the relevant assertions exist in source; they are not claims that those tests currently pass.

## Classification and count

The inventory contains 20 unique case records: 8 NEW TEST REQUIRED, 3 ADDITIONAL ASSERTION REQUIRED, 7 EXISTING COVERAGE SUFFICIENT, 2 CONTRACT CLARIFICATION REQUIRED. The 11 implementable additions/assertions exclude the two blocked cases.

| Test type                                     | New test | Additional assertion | Existing sufficient | Contract blocked |
| --------------------------------------------- | -------: | -------------------: | ------------------: | ---------------: |
| Unit                                          |        0 |                    1 |                   1 |                0 |
| API / PGlite                                  |        2 |                    1 |                   3 |                0 |
| Browser                                       |        6 |                    1 |                   2 |                2 |
| Browser / Next / Express / PGlite integration |        0 |                    0 |                   1 |                0 |
| **Total**                                     |    **8** |                **3** |               **7** |            **2** |

## Cases

### PG-005-F001-A001-T001 — Existing route and navigation matrix

| Field                           | Specification                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature / type           | A001; Unit                                                                                                                                                                |
| Scenario                        | Verify the current route policy and navigation visibility for ordinary STAFF, Head, ADMIN, SUPERADMIN, and USER account fixtures.                                         |
| Preconditions                   | Use the existing production permission and route-policy helpers with active accounts.                                                                                     |
| Test data / steps               | Preserve the role fixtures and checks for /attendance/audit, /attendance/time-logs/audit, and the Audit Trail navigation item.                                            |
| Expected result                 | Existing assertions continue to distinguish ordinary STAFF/USER from Head and permitted administrative accounts; the legacy route remains an alias under the same policy. |
| Source evidence                 | route-policy.ts:396-412; permissions.ts:92-109; attendance.test.mjs:77-120; route-policy.test.mjs:434-523.                                                                |
| Existing test                   | U1 and U2 in PG-005_EXISTING_TEST_BASELINE.md.                                                                                                                            |
| Required addition               | EXISTING COVERAGE SUFFICIENT.                                                                                                                                             |
| Priority / environment / status | High; web unit; existing assertion source preserved, runtime unverified in this phase.                                                                                    |

### PG-005-F001-A001-T002 — Missing and inactive route grants

| Field                           | Specification                                                                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature / type           | A001; Unit                                                                                                                                                     |
| Scenario                        | Extend the current route-policy matrix for accounts whose role alone must not grant access.                                                                    |
| Preconditions                   | Use the production canAccessRoute and canManageAttendance helpers, not a copied permission implementation.                                                     |
| Test data / steps               | Add USER, inactive Head, inactive ADMIN, ADMIN without employees:read, and SUPERADMIN without employees:read fixtures; evaluate the canonical route and alias. |
| Expected result                 | These accounts do not gain route access. Active Head and active ADMIN/SUPERADMIN with employees:read remain governed by the existing positive cases.           |
| Source evidence                 | permissions.ts:92-109; route-policy.ts:396-412.                                                                                                                |
| Existing test                   | U1 directly tests common role cases but is partial for these exact negative cases.                                                                             |
| Required addition               | ADDITIONAL ASSERTION REQUIRED, additive to the existing route matrix.                                                                                          |
| Priority / environment / status | High; web unit; proposed.                                                                                                                                      |

### PG-005-F001-A002-T003 — Department selection filters and resets pagination

| Field                           | Specification                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature / type           | A002; Browser                                                                                                                         |
| Scenario                        | Selecting a department sends the selected filter and returns the list to page 1.                                                      |
| Preconditions                   | Authenticated permitted ADMIN fixture; mocked department and audit endpoints return two department options and paginated event data.  |
| Test data / steps               | Load page 2, select the second department, record the next audit request, and inspect the resulting row.                              |
| Expected result                 | The GET /api/attendance/audit request contains the selected departmentId and page=1; the selected department's response row is shown. |
| Source evidence                 | attendance-audit-page.tsx:151-152, 161-177, 204-219; attendance-api.ts:247-271.                                                       |
| Existing test                   | No direct department-filter UI assertion found. API scope tests do not prove the browser control submits its value.                   |
| Required addition               | NEW TEST REQUIRED.                                                                                                                    |
| Priority / environment / status | High; mocked browser test in the isolated attendance Playwright suite; proposed.                                                      |

### PG-005-F001-A003-T004 — Existing backend department scope

| Field                           | Specification                                                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature / type           | A003; API                                                                                                                                                        |
| Scenario                        | Preserve proof that Head audit reads are limited to the current department and an authorized ADMIN can read organization scope.                                  |
| Preconditions                   | Existing PGlite fixture with Head, STAFF, ADMIN, and employees in two departments.                                                                               |
| Test data / steps               | Retain the existing audit requests for in-scope/out-of-scope department IDs and organization reads; retain scope-loss denial.                                    |
| Expected result                 | Head receives only current department data, a requested outside department is forbidden, non-head STAFF is denied, and permitted ADMIN reads organization scope. |
| Source evidence                 | attendance.management.ts:82-100, 451-513; management.test.ts:649-739, 1044-1139.                                                                                 |
| Existing test                   | A2 and A3.                                                                                                                                                       |
| Required addition               | EXISTING COVERAGE SUFFICIENT.                                                                                                                                    |
| Priority / environment / status | Critical; API with isolated PGlite; preserve unchanged.                                                                                                          |

### PG-005-F001-A004-T005 — UTC date controls filter and reset pagination

| Field                           | Specification                                                                                                                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature / type           | A004; Browser                                                                                                                                                                                  |
| Scenario                        | Changing a complete date range updates both query boundaries and returns pagination to page 1.                                                                                                 |
| Preconditions                   | Authenticated permitted ADMIN fixture and mocked audit responses with at least two pages.                                                                                                      |
| Test data / steps               | Navigate to page 2, change From and Through to a valid range, then capture the audit request and displayed result.                                                                             |
| Expected result                 | Request includes the selected from/to date strings and page=1. The visible date labels identify UTC filtering. Native input bounds prevent choosing From after Through or Through before From. |
| Source evidence                 | attendance-audit-page.tsx:148-150, 172-177, 197-203; attendance-shared.tsx:89-121; attendance.schema.ts:42-76.                                                                                 |
| Existing test                   | No direct audit date-control assertion found. Existing API cases establish date filtering but not browser query wiring.                                                                        |
| Required addition               | NEW TEST REQUIRED.                                                                                                                                                                             |
| Priority / environment / status | High; mocked browser test; proposed.                                                                                                                                                           |

### PG-005-F001-A005-T006 — Existing debounced search and asynchronous refresh

| Field                           | Specification                                                                                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature / type           | A005; Browser                                                                                                                                                                     |
| Scenario                        | Preserve the existing mocked search flow for trim/debounce behavior, page reset, stale response handling, empty results, and retry.                                               |
| Preconditions                   | Existing browser suite and audit route interception.                                                                                                                              |
| Test data / steps               | Keep the existing page-2 query, delayed “payroll” response, newer “latest” response, cleared search, no-match result, and 503 retry sequence.                                     |
| Expected result                 | Search request uses page=1; rows remain busy during refresh; the stale response does not replace newer results; clearing omits search; empty and retry states remain as asserted. |
| Source evidence                 | attendance-audit-page.tsx:148-160, 186-195, 225-287; attendance.spec.ts:1835-1921.                                                                                                |
| Existing test                   | B2.                                                                                                                                                                               |
| Required addition               | EXISTING COVERAGE SUFFICIENT for search behavior. The separate initial-loading gap is T008.                                                                                       |
| Priority / environment / status | High; mocked browser; preserve all existing assertions.                                                                                                                           |

### PG-005-F001-A005-T007 — Existing API search fields and pagination

| Field                           | Specification                                                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature / type           | A005; API                                                                                                                                                        |
| Scenario                        | Preserve search over audit action/entity/reason, actor identity, and employee identity before pagination.                                                        |
| Preconditions                   | Existing PGlite fixture with searchable audit events and department scopes.                                                                                      |
| Test data / steps               | Keep searches for employee name/ID, actor name/email/ID, action, entity type, and reason; preserve 10+2 pagination, action counts, and scoped result assertions. |
| Expected result                 | Each term returns the expected matching rows within the authorized scope, with total and page contents consistent before pagination.                             |
| Source evidence                 | attendance.management.ts:430-442, 504-551; management.test.ts:510-647.                                                                                           |
| Existing test                   | A1.                                                                                                                                                              |
| Required addition               | EXISTING COVERAGE SUFFICIENT for current search fields and pagination.                                                                                           |
| Priority / environment / status | High; API with isolated PGlite; preserve unchanged.                                                                                                              |

### PG-005-F001-A006-T008 — Initial audit loading state

| Field                           | Specification                                                                                                                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature / type           | A006; Browser                                                                                                                                                                                      |
| Scenario                        | Add deterministic coverage for the initial skeleton while the first audit request is pending.                                                                                                      |
| Preconditions                   | Existing B2 mocked audit test, with a deferred first list response.                                                                                                                                |
| Test data / steps               | Start navigation without releasing the first audit response; assert the audit table is busy and its loading skeleton is present; release the response and continue the existing search assertions. |
| Expected result                 | Before the response resolves, five skeleton rows render and aria-busy is true; after resolution, event rows replace the skeleton. Existing B2 assertions remain intact.                            |
| Source evidence                 | attendance-audit-page.tsx:225-287; attendance-shared.tsx:13-45; attendance.spec.ts:1835-1921.                                                                                                      |
| Existing test                   | B2 tests busy refresh with retained rows but does not assert initial loading.                                                                                                                      |
| Required addition               | ADDITIONAL ASSERTION REQUIRED inside the existing mocked browser declaration.                                                                                                                      |
| Priority / environment / status | Medium; mocked browser; proposed.                                                                                                                                                                  |

### PG-005-F001-A002-T009 — Department list error and retry

| Field                           | Specification                                                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature / type           | A002; Browser                                                                                                                          |
| Scenario                        | The department-choice resource displays its own retry state after failure and recovers when retried.                                   |
| Preconditions                   | Authenticated permitted ADMIN fixture; mocked departments endpoint.                                                                    |
| Test data / steps               | Return 503 for the first GET /api/attendance/departments, then return a valid department list on retry.                                |
| Expected result                 | The department resource displays its error and Retry control; retry loads the options. This does not assert an audit-list error state. |
| Source evidence                 | attendance-audit-page.tsx:161-163, 204-219; attendance-shared.tsx:13-45; use-async-resource.ts:49-96.                                  |
| Existing test                   | No direct department-list failure/retry assertion found.                                                                               |
| Required addition               | NEW TEST REQUIRED.                                                                                                                     |
| Priority / environment / status | Medium; mocked browser; proposed.                                                                                                      |

### PG-005-F001-A010-T010 — Existing recordsOnly and action-count API contract

| Field                           | Specification                                                                                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature / type           | A010; API                                                                                                                                                                         |
| Scenario                        | Preserve the API contract for recordsOnly filtering, summary counts, date scope, empty results, invalid option values, and department boundaries.                                 |
| Preconditions                   | Existing PGlite management fixture.                                                                                                                                               |
| Test data / steps               | Keep the current recordsOnly=true request, count comparison, invalid recordsOnly values, empty date range, and scope-loss checks.                                                 |
| Expected result                 | The API returns only supported record entities when requested and preserves existing response/count/scope behavior. The browser page does not expose recordsOnly or actionCounts. |
| Source evidence                 | attendance.management.ts:425-551; management.test.ts:1044-1139.                                                                                                                   |
| Existing test                   | A3.                                                                                                                                                                               |
| Required addition               | EXISTING COVERAGE SUFFICIENT for the server-only option.                                                                                                                          |
| Priority / environment / status | Medium; API with isolated PGlite; preserve unchanged.                                                                                                                             |

### PG-005-F001-A007-T011 — Row formatting and missing-identity fallbacks

| Field                           | Specification                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature / type           | A007; Browser                                                                                                                                                                                                                                                                                              |
| Scenario                        | Verify displayed timestamps and readable summaries for normal and incomplete audit rows.                                                                                                                                                                                                                   |
| Preconditions                   | Authenticated permitted ADMIN fixture; mocked response supplies several valid event rows.                                                                                                                                                                                                                  |
| Test data / steps               | Include a known UTC instant, a named actor/employee, an actor ID with a null relation, no actor ID, a policy event without an employee, an unresolved ordinary employee, a known action, and an unfamiliar action/entity. Use a browser context with a non-UTC timezone.                                   |
| Expected result                 | Timestamp text equals the UTC formatter output rather than local-zone output; actor fallbacks are Name unavailable and No actor recorded; employee fallbacks are Not applicable (policy change) and Employee unavailable; known actions/entities are human-readable and unknown enum values are humanized. |
| Source evidence                 | attendance-audit-page.tsx:49-145, 289-323; format.ts:13-21.                                                                                                                                                                                                                                                |
| Existing test                   | B1 confirms a row and page heading but does not assert row formatting or fallback values.                                                                                                                                                                                                                  |
| Required addition               | NEW TEST REQUIRED.                                                                                                                                                                                                                                                                                         |
| Priority / environment / status | Medium; mocked browser; proposed.                                                                                                                                                                                                                                                                          |

### PG-005-F001-A008-T012 — Read-only detail snapshots

| Field                           | Specification                                                                                                                                                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature / type           | A008; Browser                                                                                                                                                                                                          |
| Scenario                        | Verify the event detail panel displays the selected row's reason, timestamp, allowlisted after/before fields, and previous values without mutation controls.                                                           |
| Preconditions                   | Authenticated permitted ADMIN fixture; mocked event with before and after snapshots.                                                                                                                                   |
| Test data / steps               | Use status/type, overtimeMinutes, an At-suffixed timestamp, a boolean, null/undefined fields, and an unrelated private-looking key. Open the event detail button.                                                      |
| Expected result                 | The detail panel shows the event's reason and UTC time, humanized enum, minutes, Yes/No boolean, recognized previous values, and no arbitrary unlisted key or edit/mutation action. Null/undefined values are omitted. |
| Source evidence                 | attendance-audit-page.tsx:49-89, 311-321, 338-400; side-panel.tsx:66-129.                                                                                                                                              |
| Existing test                   | B1 opens and closes the panel and checks headings only; snapshot values and read-only projection are not directly asserted.                                                                                            |
| Required addition               | NEW TEST REQUIRED.                                                                                                                                                                                                     |
| Priority / environment / status | High; mocked browser; proposed.                                                                                                                                                                                        |

### PG-005-F001-A009-T013 — Keyboard open, dismiss, and focus return

| Field                           | Specification                                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature / type           | A009; Browser                                                                                                                      |
| Scenario                        | Exercise the row's native event button and shared detail panel with keyboard at the mobile viewport.                               |
| Preconditions                   | Authenticated permitted ADMIN fixture, one audit event, viewport 390 px.                                                           |
| Test data / steps               | Focus the View audit event button, activate with Enter, verify the details panel, press Escape, then inspect visibility and focus. |
| Expected result                 | The panel opens, Escape closes it, focus returns to the triggering row button, and the page has no horizontal overflow.            |
| Source evidence                 | attendance-audit-page.tsx:311-321, 331-400; side-panel.tsx:66-129; attendance.spec.ts:1554-1739.                                   |
| Existing test                   | B1 opens with a pointer and closes with Done; it does not test keyboard activation, Escape, or focus return.                       |
| Required addition               | NEW TEST REQUIRED.                                                                                                                 |
| Priority / environment / status | High; mocked browser at 390 px; proposed.                                                                                          |

### PG-005-F001-A009-T014 — Existing responsive page and overflow

| Field                           | Specification                                                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature / type           | A009; Browser                                                                                                                                |
| Scenario                        | Preserve the integrated audit page checks at 390, 820, and 1440 px.                                                                          |
| Preconditions                   | Existing browser suite using same-origin Next calls and the offline Express/PGlite attendance fixture.                                       |
| Test data / steps               | Keep the audit page heading/API success, event details pointer open/Done close, and horizontal overflow assertions at each configured width. |
| Expected result                 | The page renders scoped live fixture data and remains within the tested viewport widths.                                                     |
| Source evidence                 | attendance.spec.ts:1554-1739; attendance-browser-server.ts.                                                                                  |
| Existing test                   | B1.                                                                                                                                          |
| Required addition               | EXISTING COVERAGE SUFFICIENT for shell-level responsive coverage. T013 adds keyboard behavior.                                               |
| Priority / environment / status | High; browser/Next/Express/PGlite; preserve unchanged.                                                                                       |

### PG-005-F001-A003-T015 — Unauthenticated and USER API denial

| Field                           | Specification                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature / type           | A003; API                                                                                                                             |
| Scenario                        | Verify server-side authentication and authorization independently of the frontend route guard.                                        |
| Preconditions                   | Isolated PGlite Express fixture with a USER account that has no management grant.                                                     |
| Test data / steps               | GET /attendance/audit once without authorization and once with a valid USER bearer token.                                             |
| Expected result                 | Anonymous request receives 401; authenticated USER request receives 403; neither response includes audit rows.                        |
| Source evidence                 | attendance.routes.ts:11-28; attendance.management.ts:82-100.                                                                          |
| Existing test                   | A2 covers non-head STAFF denial. A4 verifies Superadmin success. Neither directly asserts anonymous or USER denial for this endpoint. |
| Required addition               | NEW TEST REQUIRED.                                                                                                                    |
| Priority / environment / status | Critical; API with isolated PGlite using tests/support/pglite-app.ts; proposed.                                                       |

### PG-005-F001-A010-T016 — Malformed audit query validation

Add valid control requests to this same table-driven API case: a 100-character scalar search and a whitespace-only search return 200, with whitespace trimmed to an empty filter. Also verify that a syntactically valid but nonexistent department ID returns 404; an existing out-of-scope department remains the 403 case in T004.

| Field                           | Specification                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Atomic feature / type           | A010; API                                                                                                                                                                                                                                  |
| Scenario                        | Add table-driven rejection checks for malformed audit query values.                                                                                                                                                                        |
| Preconditions                   | Authorized Head fixture in the isolated PGlite Express application.                                                                                                                                                                        |
| Test data / steps               | Submit search length 101, repeated search parameters, invalid calendar date, wrong date format, to earlier than from, a range longer than 366 inclusive dates, page 0, page 100001, malformed department ID, and an unsupported query key. |
| Expected result                 | Every unsupported or malformed value returns 400 and no audit result body is exposed as a successful response. Keep missing-date behavior out of this case because the API currently supplies defaults.                                    |
| Source evidence                 | attendance.schema.ts:42-76; attendance.management.ts:425-479; query-helpers.ts:6-9; pagination.ts:12-23, 44-73.                                                                                                                            |
| Existing test                   | A1 covers valid search/paging; A3 covers invalid recordsOnly. No direct audit assertion was found for these malformed values.                                                                                                              |
| Required addition               | NEW TEST REQUIRED.                                                                                                                                                                                                                         |
| Priority / environment / status | High; API with isolated PGlite; proposed.                                                                                                                                                                                                  |

### PG-005-F001-A010-T017 — UTC interval, tie ordering, and response projection

| Field                           | Specification                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Atomic feature / type           | A010; API                                                                                                                                                                                                                                                                                  |
| Scenario                        | Extend the existing audit API test with boundary, deterministic order, and internal-field omission assertions.                                                                                                                                                                             |
| Preconditions                   | Existing PGlite fixture with permitted Head scope and controlled audit rows.                                                                                                                                                                                                               |
| Test data / steps               | Seed events at the from-date UTC midnight, at the final millisecond before the next UTC midnight, and exactly at the exclusive next-day boundary; give two included events identical createdAt values and distinct IDs. Populate operationId, correlationId, and actorRoleAtTime on a row. |
| Expected result                 | Both in-range boundary events are included, the event at the exclusive upper bound is excluded, equal timestamps order by id descending, and operationId/correlationId/actorRoleAtTime are absent from serialized rows. Actor and employee relations expose only fullName.                 |
| Source evidence                 | attendance.management.ts:443-446, 485-490, 515-551; schema.prisma:1570-1597; management.test.ts:510-647.                                                                                                                                                                                   |
| Existing test                   | A1 covers pagination and actor/employee relation projection but not UTC edge instants, equal-time tie order, or omitted internal fields.                                                                                                                                                   |
| Required addition               | ADDITIONAL ASSERTION REQUIRED in the existing API/PGlite audit test.                                                                                                                                                                                                                       |
| Priority / environment / status | High; API with isolated PGlite; proposed.                                                                                                                                                                                                                                                  |

### PG-005-F001-A007-T018 — Existing persisted audit after cross-page transfer

| Field                           | Specification                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Atomic feature / type           | A007; Integration                                                                                                                                                                          |
| Scenario                        | Preserve the real browser-to-API-to-PGlite workflow that transfers an employee and then reads persisted audit events.                                                                      |
| Preconditions                   | Existing isolated browser/API fixture, authorized Admin and Head actors, employee with the relevant attendance review records.                                                             |
| Test data / steps               | Keep the WC-07-F01 transfer and follow-up audit search flow, including actor attribution and review-reset records.                                                                         |
| Expected result                 | The audit page displays rows persisted by the transfer workflow and attributes those reset rows to the authenticated Admin; access after scope transfer follows the current Head boundary. |
| Source evidence                 | attendance.spec.ts:3217-3308; transfer-attribution.test.ts:8-307.                                                                                                                          |
| Existing test                   | X1 browser integration and X2 direct API persistence assertions.                                                                                                                           |
| Required addition               | EXISTING COVERAGE SUFFICIENT for a real persisted cross-page audit read.                                                                                                                   |
| Priority / environment / status | High; browser/Next/Express/PGlite integration; preserve unchanged.                                                                                                                         |

### PG-005-F001-A004-T019 — Date clearing display semantics

| Field                           | Specification                                                                                                                                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature / type           | A004; Browser                                                                                                                                                                                                                                             |
| Scenario                        | Determine the intended visible state after either required date input is cleared.                                                                                                                                                                         |
| Preconditions                   | A successful audit result is already displayed.                                                                                                                                                                                                           |
| Test data / steps               | Clear From while Through remains set; separately consider clearing Through while From remains set.                                                                                                                                                        |
| Expected result                 | Unspecified. Current source stops issuing the audit request while a date is empty, and the asynchronous resource can retain prior successful data. The product must define whether rows are hidden, a validation state is shown, or prior results remain. |
| Source evidence                 | attendance-audit-page.tsx:168-183; use-async-resource.ts:49-96.                                                                                                                                                                                           |
| Existing test                   | No expected-result assertion found; related contract is C001 in PG-005_GAPS_AND_DEPENDENCIES.md.                                                                                                                                                          |
| Required addition               | CONTRACT CLARIFICATION REQUIRED; exclude from implementable totals.                                                                                                                                                                                       |
| Priority / environment / status | Medium; browser; blocked pending product decision.                                                                                                                                                                                                        |

### PG-005-F001-A008-T020 — Detail panel after filter or scope changes

| Field                           | Specification                                                                                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature / type           | A008; Browser                                                                                                                                                                    |
| Scenario                        | Determine whether an already-open event detail panel should close or remain visible when the user changes dates, search, or department.                                          |
| Preconditions                   | One event detail panel is open and the list has at least one other query result.                                                                                                 |
| Test data / steps               | Open an event, change one filter at a time, and observe the selected detail record while the list refreshes.                                                                     |
| Expected result                 | Unspecified. Current selected state is independent of the filters, so the existing event can remain open while new rows load. Product must define close versus persist behavior. |
| Source evidence                 | attendance-audit-page.tsx:148-183, 331-332.                                                                                                                                      |
| Existing test                   | B1 opens/closes details but does not change list filters with the panel open; related contract is C002 in PG-005_GAPS_AND_DEPENDENCIES.md.                                       |
| Required addition               | CONTRACT CLARIFICATION REQUIRED; exclude from implementable totals.                                                                                                              |
| Priority / environment / status | Medium; browser; blocked pending product decision.                                                                                                                               |

## Phase 2.2 assertion preservation

Retain all existing declarations and assertions in U1/U2/B1/B2/B3/A1/A2/A3/A4/X1/X2. Add only T002 to the route matrix, T008 to the mocked loading flow, and T017 to the API/PGlite audit test. Implement T003/T005/T009/T011/T012/T013/T015/T016 as additive cases. Do not convert existing passing declarations to skips or broaden mocks so they bypass backend scope coverage.

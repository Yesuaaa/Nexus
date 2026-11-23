# PG-006 Test Case Specification

**Page:** PG-006, `/attendance/check-ins`  
**Scope:** Proposed cases only. No tests were implemented or executed.  
**ID format:** `PG-006-F001-A###-T###`; IDs are stable and unique within this page.

## Case summary

| Category                                    |  Count |
| ------------------------------------------- | -----: |
| Unit                                        |      2 |
| API/PGlite                                  |      6 |
| Browser                                     |     11 |
| Integration (browser + API/PGlite workflow) |      6 |
| **Total records**                           | **25** |
| NEW TEST REQUIRED                           |     10 |
| ADDITIONAL ASSERTION REQUIRED               |      6 |
| EXISTING COVERAGE SUFFICIENT                |      8 |
| CONTRACT CLARIFICATION REQUIRED             |      1 |
| Implementable new/additional cases          |     16 |

The 8 existing-sufficient records document the preservation baseline. T025 is excluded from implementable totals until PG-006-C001 is resolved.

## Cases

### PG-006-F001-A001-T001 — Personal attendance role predicate

| Field             | Specification                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature    | A001 — Personal route and navigation access                                                                                               |
| Test category     | Unit                                                                                                                                      |
| Scenario          | Active STAFF and ADMIN can access personal Check-Ins independent of `employees:read`; inactive accounts, USER, and SUPERADMIN are denied. |
| Preconditions     | Production route-policy/permission helpers imported by the web unit suite.                                                                |
| Test data         | Active STAFF, active ADMIN with no employee-read grant, inactive STAFF/ADMIN, active USER, active SUPERADMIN.                             |
| Test steps        | Evaluate the personal-attendance predicate and route access for each actor; assert navigation access matches the route policy.            |
| Expected result   | Only active STAFF/ADMIN pass the personal-attendance predicate.                                                                           |
| Evidence          | `permissions.ts:111-117`; `route-policy.ts:352-394,426-430`.                                                                              |
| Existing coverage | `apps/web/test/attendance.test.mjs:77,209`; direct role predicate exists.                                                                 |
| Proposed addition | EXISTING COVERAGE SUFFICIENT                                                                                                              |
| Priority          | High                                                                                                                                      |
| Environment       | Node unit; production helpers, no browser/API.                                                                                            |

### PG-006-F001-A001-T002 — Legacy alias reaches canonical Check-Ins

| Field             | Specification                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| Atomic feature    | A001 — Personal route and navigation access                                                                     |
| Test category     | Browser                                                                                                         |
| Scenario          | An active STAFF or ADMIN opening `/attendance/my` reaches `/attendance/check-ins`.                              |
| Preconditions     | Authenticated eligible fixture; isolated browser test account.                                                  |
| Test data         | STAFF and ADMIN actor variants; mocked or isolated current/history GETs return valid empty state.               |
| Test steps        | Navigate directly to `/attendance/my`; wait for redirect; inspect final URL and Check-Ins heading.              |
| Expected result   | Browser ends on the canonical route and renders Check-Ins.                                                      |
| Evidence          | `apps/web/src/app/(portal)/attendance/my/page.tsx:1-4`; canonical page `.../attendance/check-ins/page.tsx:1-6`. |
| Existing coverage | PG-003 `attendance-entry.spec.ts:54-193` tests entry redirects; no direct alias assertion found.                |
| Proposed addition | NEW TEST REQUIRED                                                                                               |
| Priority          | Medium                                                                                                          |
| Environment       | Playwright with mocked same-origin attendance GETs.                                                             |

### PG-006-F001-A002-T003 — Complete denied-role matrix for personal action endpoints

| Field             | Specification                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature    | A002 — Load and refresh personal attendance state; A004–A006 action endpoint authorization                                               |
| Test category     | API                                                                                                                                      |
| Scenario          | Every personal attendance POST rejects unauthorized roles across clock-in, clock-out, break start, and break end.                        |
| Preconditions     | PGlite app with active STAFF/ADMIN employee fixtures, USER and SUPERADMIN accounts, and owned session/break IDs.                         |
| Test data         | Anonymous, USER, and SUPERADMIN actors; all four POST paths and minimally valid payloads.                                                |
| Test steps        | Send each request without a token, then as USER and SUPERADMIN; retain current API 401/403 checks and add missing POST combinations.     |
| Expected result   | Anonymous receives 401; authenticated disallowed roles receive 403; no attendance rows are written.                                      |
| Evidence          | `routes.ts:11-28,159-169`; `attendance.service.ts:37-76`; `backend.test.ts:131-160`.                                                     |
| Existing coverage | `backend.test.ts:131-160` covers anonymous actions and disallowed-role clock-in but not role denial for clock-out/break start/break end. |
| Proposed addition | ADDITIONAL ASSERTION REQUIRED                                                                                                            |
| Priority          | Critical                                                                                                                                 |
| Environment       | API/PGlite using `tests/support/pglite-app.ts`.                                                                                          |

### PG-006-F001-A002-T004 — ADMIN without Employee profile cannot load self state

| Field             | Specification                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Atomic feature    | A002 — Load and refresh personal attendance state                                                                        |
| Test category     | API                                                                                                                      |
| Scenario          | An active route-eligible ADMIN without a linked Employee receives the documented conflict for current and history reads. |
| Preconditions     | Active ADMIN user with no Employee row in isolated PGlite.                                                               |
| Test data         | `GET /me/current`; `GET /me/history?from=2026-11-01&to=2026-11-02`.                                                      |
| Test steps        | Authenticate each GET as the ADMIN and inspect status/error payload; assert reads create no Employee or attendance rows. |
| Expected result   | Both reads return 409 because self-service requires a linked Employee; no implicit profile is created.                   |
| Evidence          | `permissions.ts:111-117`; `routes.ts:159-169`; `attendance.controller.ts:9-35`; `attendance.service.ts:37-76`.           |
| Existing coverage | `backend.test.ts:131-160` checks missing-profile clock-in only; GET case not found.                                      |
| Proposed addition | NEW TEST REQUIRED                                                                                                        |
| Priority          | High                                                                                                                     |
| Environment       | API/PGlite; isolated app and database.                                                                                   |

### PG-006-F001-A002-T005 — Current-state load failure and retry recovery

| Field             | Specification                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature    | A002 — Load and refresh personal attendance state                                                                                  |
| Test category     | Browser                                                                                                                            |
| Scenario          | A failed current-state request presents an error and Retry; a later successful retry renders the recovered state.                  |
| Preconditions     | Signed-in eligible actor; browser route responses controlled by the test.                                                          |
| Test data         | First GET `/api/attendance/me/current` returns 503; Retry GET returns valid no-policy or not-started state; history returns empty. |
| Test steps        | Open Check-Ins, wait for error alert, verify Retry, click it, then verify the error clears and recovered state appears.            |
| Expected result   | Failure is visible and actionable; retry recovers without a page reload or duplicate mutation.                                     |
| Evidence          | `my-attendance-page.tsx:42-119`; `use-attendance-clock.ts:12-64`.                                                                  |
| Existing coverage | `attendance.spec.ts:200-245` covers successful current-state load; no current-state 503/retry case found.                          |
| Proposed addition | NEW TEST REQUIRED                                                                                                                  |
| Priority          | High                                                                                                                               |
| Environment       | Playwright with mocked same-origin API responses.                                                                                  |

### PG-006-F001-A003-T006 — Elapsed-work calculation boundaries

| Field             | Specification                                                                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature    | A003 — Display live work time and daily requirement                                                                                                                               |
| Test category     | Unit                                                                                                                                                                              |
| Scenario          | Calculation clamps before start and after end/suspension, subtracts unpaid but not paid breaks, and composes split sessions.                                                      |
| Preconditions     | Production `elapsedWork`/`duration` helper and explicit instants.                                                                                                                 |
| Test data         | Future `asOf` before session start; ended session; suspended session; one unpaid and one paid break; multiple sessions spanning midnight.                                         |
| Test steps        | Evaluate each fixture at fixed instants; include a long duration exceeding 24 hours and zero-duration boundary.                                                                   |
| Expected result   | No negative time; completed/suspended time stops at its boundary; unpaid break time is excluded, paid break time remains included; existing overnight/split totals remain stable. |
| Evidence          | `model/attendance.ts:44-92`; page summary `my-attendance-page.tsx:60-68,132-333`.                                                                                                 |
| Existing coverage | `attendance.test.mjs:140-185` covers overnight attribution, unpaid break, split sessions, and long duration, but not all listed clamps/paid break.                                |
| Proposed addition | ADDITIONAL ASSERTION REQUIRED                                                                                                                                                     |
| Priority          | Medium                                                                                                                                                                            |
| Environment       | Node unit with deterministic timestamps; no API.                                                                                                                                  |

### PG-006-F001-A003-T007 — Render required hours and live progress from current response

| Field             | Specification                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Atomic feature    | A003 — Display live work time and daily requirement                                                                                              |
| Test category     | Integration                                                                                                                                      |
| Scenario          | The visible summary reflects the fixture's workday status, elapsed work, required duration, remaining/excess amount, and schedule/policy values. |
| Preconditions     | Existing isolated browser attendance actor with an assigned policy and test-controlled server clock.                                             |
| Test data         | Policy/workday response containing known required minutes, workday status, schedule, and active session.                                         |
| Test steps        | Open Check-Ins; read the visible status, elapsed label, required-hours/progress summary, and schedule details; advance fixture time and refresh. |
| Expected result   | Rendered fields agree with the current API fixture and elapsed helper; one refresh advances elapsed work using server `asOf`.                    |
| Evidence          | `my-attendance-page.tsx:132-333`; `model/attendance.ts:44-92`; `attendance.summary.ts:15-160`.                                                   |
| Existing coverage | `attendance.spec.ts:200-245` verifies overnight elapsed label but not the complete summary/policy display.                                       |
| Proposed addition | ADDITIONAL ASSERTION REQUIRED                                                                                                                    |
| Priority          | High                                                                                                                                             |
| Environment       | Playwright + isolated Next.js/Express/PGlite fixture.                                                                                            |

### PG-006-F001-A004-T008 — Normal clock-in state and persistence

| Field             | Specification                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| Atomic feature    | A004 — Clock in or continue an overnight workday                                                        |
| Test category     | Integration                                                                                             |
| Scenario          | An eligible employee confirms a normal clock-in and the returned active workday appears and persists.   |
| Preconditions     | Active STAFF with assigned policy, no active session, isolated browser fixture.                         |
| Test data         | Test-controlled server instant within the assigned workday.                                             |
| Test steps        | Open Check-Ins, confirm Clock in, inspect current state, then read self history from the fixture API.   |
| Expected result   | One active session is created on the policy workday; current UI and history agree.                      |
| Evidence          | `my-attendance-page.tsx:78-148,185-202`; `attendance.service.ts:329-389`; `attendance.spec.ts:200-245`. |
| Existing coverage | `attendance.spec.ts:200-245`; `backend.test.ts:164-208`.                                                |
| Proposed addition | EXISTING COVERAGE SUFFICIENT                                                                            |
| Priority          | High                                                                                                    |
| Environment       | Existing isolated browser/API/PGlite fixture.                                                           |

### PG-006-F001-A004-T009 — Continue an overnight workday through the page control

| Field             | Specification                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature    | A004 — Clock in or continue an overnight workday                                                                                                                    |
| Test category     | Integration                                                                                                                                                         |
| Scenario          | When the API supplies an overnight continuation, the page confirmation posts the supplied prior `workdayId` and the new session remains attributed to that workday. |
| Preconditions     | Active STAFF, policy fixture, prior overnight workday eligible for a continuation session, no conflicting open session.                                             |
| Test data         | Prior workday ID and a server time in the continuation window.                                                                                                      |
| Test steps        | Load Check-Ins, select Continue for the prior workday, confirm; inspect POST payload, returned current state, and persisted history.                                |
| Expected result   | Request carries the server-provided workday ID; response/history group the continuation session under the prior policy workday.                                     |
| Evidence          | `my-attendance-page.tsx:78-148,185-202`; `attendance.service.ts:329-389`; `backend.test.ts:210-262`.                                                                |
| Existing coverage | API continuation is covered at `backend.test.ts:210-262`; UI wiring is not directly asserted.                                                                       |
| Proposed addition | NEW TEST REQUIRED                                                                                                                                                   |
| Priority          | High                                                                                                                                                                |
| Environment       | Playwright + isolated Next.js/Express/PGlite with seeded workday.                                                                                                   |

### PG-006-F001-A005-T010 — Unpaid-break transitions and clock-out during break

| Field             | Specification                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature    | A005 — Start or end an unpaid break; A006 — Clock out and close an active session                                                                   |
| Test category     | Integration                                                                                                                                         |
| Scenario          | Break start pauses elapsed time, break end resumes it, and clock-out while a break is open closes the break and session at the same server instant. |
| Preconditions     | Active employee with unpaid breaks enabled and current active session.                                                                              |
| Test data         | Controlled clock instants before/during/after break.                                                                                                |
| Test steps        | Start/end a break, advance time, assert timer pause/resume; start another break and clock out; inspect persisted session and break.                 |
| Expected result   | Worked time excludes unpaid break; clock-out closes both active records consistently.                                                               |
| Evidence          | `attendance.service.ts:382-435`; `my-attendance-page.tsx:206-257`; `attendance.spec.ts:247-300`; `backend.test.ts:269-375`.                         |
| Existing coverage | Browser and API state transitions are both covered.                                                                                                 |
| Proposed addition | EXISTING COVERAGE SUFFICIENT                                                                                                                        |
| Priority          | High                                                                                                                                                |
| Environment       | Existing isolated browser/API/PGlite fixture.                                                                                                       |

### PG-006-F001-A006-T011 — Clock-action validation, ownership, server time, and concurrency

| Field             | Specification                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature    | A006 — Clock out and close an active session; related A004/A005 endpoint contracts                                                                  |
| Test category     | API                                                                                                                                                 |
| Scenario          | Invalid, foreign, stale, spoofed-time, status-revoked, and concurrent personal clock actions are rejected without duplicate or foreign writes.      |
| Preconditions     | Existing PGlite fixtures with two employees, active/suspended/closed sessions, and controlled server clock.                                         |
| Test data         | Foreign IDs, invalid body keys/timestamps, active-state changes, duplicate concurrent action calls.                                                 |
| Test steps        | Exercise existing validation/ownership/status/concurrency matrix; inspect response codes and persisted counts/timestamps.                           |
| Expected result   | Actor identity and times remain server-derived; ownership and state checks hold; concurrent transitions serialize without duplicate active records. |
| Evidence          | `attendance.schema.ts:5-79`; `attendance.service.ts:329-435`; `backend.test.ts:377-456,570-643`.                                                    |
| Existing coverage | `backend.test.ts` anti-spoof/ownership, concurrency, account-status cases; existing PGlite assertions cover the backend contract.                   |
| Proposed addition | EXISTING COVERAGE SUFFICIENT                                                                                                                        |
| Priority          | Critical                                                                                                                                            |
| Environment       | API/PGlite with isolated app and deterministic clock.                                                                                               |

### PG-006-F001-A007-T012 — Policy, suspension, block reason, and leave-conflict presentation

| Field             | Specification                                                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature    | A007 — Show policy and clock-in blockers                                                                                                                       |
| Test category     | Browser                                                                                                                                                        |
| Scenario          | Page presentation matches four current-state variants: no policy, explicit clock-in block, suspended workday, and active session with approved-leave conflict. |
| Preconditions     | Eligible signed-in user; current-state API response selectable per scenario; history response valid.                                                           |
| Test data         | `needsPolicy`; `clockInBlockedReason`; suspended workday; leave-conflict active session.                                                                       |
| Test steps        | Load each state; assert the matching message/action availability; for leave conflict, confirm warning and keep Clock out enabled.                              |
| Expected result   | Missing policy points to HR setup; blocked/suspended states do not offer clock-in; active leave-conflicted session remains endable with warning.               |
| Evidence          | `my-attendance-page.tsx:72-119,153-176,323-333`; `attendance.service.ts:145-179,441-554`.                                                                      |
| Existing coverage | API missing-policy case at `backend.test.ts:457-477`; no page-level state table found.                                                                         |
| Proposed addition | NEW TEST REQUIRED                                                                                                                                              |
| Priority          | High                                                                                                                                                           |
| Environment       | Playwright with mocked current-state API payloads; no database required.                                                                                       |

### PG-006-F001-A008-T013 — History range submission, reset, and native bounds

| Field             | Specification                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Atomic feature    | A008 — Filter and paginate personal history                                                                                                                  |
| Test category     | Browser                                                                                                                                                      |
| Scenario          | Changing From/Through resets page to 1 and submits exactly the dates displayed in the controls; native `min`/`max` bounds constrain the opposing date field. |
| Preconditions     | Eligible actor; page loaded with history controls and valid responses.                                                                                       |
| Test data         | `from=2026-11-10`, `to=2026-11-20`; begin on page 2.                                                                                                         |
| Test steps        | Change From and Through separately; observe requests and page indicator; inspect control min/max attributes.                                                 |
| Expected result   | Each changed range resets page 1; query values match visible input values; From cannot exceed Through and Through cannot precede From per native bounds.     |
| Evidence          | `my-attendance-page.tsx:51-69,353-405`; `attendance-shared.tsx:68-120`; `attendance-api.ts:180-193`.                                                         |
| Existing coverage | API filters covered by `backend.test.ts:644-693`; no PG-006 browser date-control test found.                                                                 |
| Proposed addition | NEW TEST REQUIRED                                                                                                                                            |
| Priority          | Medium                                                                                                                                                       |
| Environment       | Playwright with mocked GET history and captured query strings.                                                                                               |

### PG-006-F001-A008-T014 — History pagination request and rendered page

| Field             | Specification                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature    | A008 — Filter and paginate personal history                                                                                         |
| Test category     | Browser                                                                                                                             |
| Scenario          | Selecting the next history page sends the requested page and renders the matching rows/page state.                                  |
| Preconditions     | API fixture has at least two pages of self workdays.                                                                                |
| Test data         | `total` and page size sufficient for pages 1 and 2; unique workday labels per page.                                                 |
| Test steps        | Load page 1; select Next; capture history query; verify page 2 indicator and page-2 row.                                            |
| Expected result   | Query includes `page=2`; UI displays response rows and correct pagination state; unavailable directions are disabled at boundaries. |
| Evidence          | `my-attendance-page.tsx:353-405`; `attendance-history.tsx:40-240`; `attendance-shared.tsx:68-120`.                                  |
| Existing coverage | API page behavior at `backend.test.ts:644-693`; browser pagination assertion not found.                                             |
| Proposed addition | NEW TEST REQUIRED                                                                                                                   |
| Priority          | Medium                                                                                                                              |
| Environment       | Playwright with mocked paged history responses.                                                                                     |

### PG-006-F001-A008-T015 — History loading, empty, failed, retry, and retained-data states

| Field             | Specification                                                                                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature    | A008 — Filter and paginate personal history                                                                                                                                                     |
| Test category     | Browser                                                                                                                                                                                         |
| Scenario          | History shows initial loading, explicit empty state, retry on failure, and preserves the last successful rows while a refresh is pending or fails.                                              |
| Preconditions     | Current attendance succeeds; history responses are test-controlled.                                                                                                                             |
| Test data         | Deferred first GET; empty success; populated success followed by 503 and successful Retry.                                                                                                      |
| Test steps        | Observe skeleton before first response; resolve empty and assert message; load rows; trigger a filter/retry whose request fails; assert retained rows and retry affordance; retry successfully. |
| Expected result   | Each visual state matches source behavior; prior successful data remains rendered during refresh/error; Retry replaces it only after success.                                                   |
| Evidence          | `use-async-resource.ts:11-96`; `attendance-history.tsx:40-240`; `my-attendance-page.tsx:353-405`.                                                                                               |
| Existing coverage | API history failures are not a page rendering assertion; no direct history loading/error/retry browser case found.                                                                              |
| Proposed addition | NEW TEST REQUIRED                                                                                                                                                                               |
| Priority          | High                                                                                                                                                                                            |
| Environment       | Playwright with delayed/mocked history API responses.                                                                                                                                           |

### PG-006-F001-A008-T016 — API history date/page validation and self scope

| Field             | Specification                                                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature    | A008 — Filter and paginate personal history                                                                                                                     |
| Test category     | API                                                                                                                                                             |
| Scenario          | Personal history rejects malformed, reversed, overlong, invalid-page, repeated/unknown query inputs and cannot be redirected to another employee.               |
| Preconditions     | PGlite app with self and foreign employee fixtures.                                                                                                             |
| Test data         | Valid date range; invalid format; reversed dates; 367-day span; page 0/100001/nondecimal; repeated query key; unknown `employeeId` key.                         |
| Test steps        | Request each query variation as the caller and inspect status/payload; verify only caller-owned rows are returned for valid requests.                           |
| Expected result   | Valid bounded request returns paginated self data; invalid/extra inputs follow current schema's 400 validation response; caller cannot select another employee. |
| Evidence          | `attendance.schema.ts:42-79`; `attendance.reporting.ts:128-163`; `backend.test.ts:644-693`.                                                                     |
| Existing coverage | `backend.test.ts:644-693` directly exercises bounded pagination, invalid query, and self-scope behavior.                                                        |
| Proposed addition | EXISTING COVERAGE SUFFICIENT                                                                                                                                    |
| Priority          | Critical                                                                                                                                                        |
| Environment       | API/PGlite through `tests/support/pglite-app.ts`.                                                                                                               |

### PG-006-F001-A009-T017 — History row summaries reflect API-provided workday context

| Field             | Specification                                                                                                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature    | A009 — Render history rows and inspect workday details                                                                                                                                               |
| Test category     | Browser                                                                                                                                                                                              |
| Scenario          | Row content identifies workday-zone dates/times, status, overnight attribution, required/worked values, pending correction, schedule warnings, and missing-time cases when supplied by the response. |
| Preconditions     | Isolated browser fixture with purpose-built history responses covering each supported field.                                                                                                         |
| Test data         | One complete overnight day, one pending correction, scheduled/late or early day, and a row with a missing session boundary.                                                                          |
| Test steps        | Load Check-Ins history and assert each visible row label/value against fixture data; verify no cross-employee information appears.                                                                   |
| Expected result   | UI labels and warnings correspond to the returned workday, policy timezone, session and adjustment state.                                                                                            |
| Evidence          | `attendance-history.tsx:40-240`; `attendance-shared.tsx:13-67`; `attendance.reporting.ts:128-163`.                                                                                                   |
| Existing coverage | `attendance.spec.ts:200-245` asserts complete/overnight history; `attendance.spec.ts:3217-3270` enters details for an existing session. Remaining field assertions are absent.                       |
| Proposed addition | ADDITIONAL ASSERTION REQUIRED                                                                                                                                                                        |
| Priority          | Medium                                                                                                                                                                                               |
| Environment       | Playwright; mocked response or isolated fixture data.                                                                                                                                                |

### PG-006-F001-A009-T018 — Detail panel contents and keyboard/focus lifecycle

| Field             | Specification                                                                                                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature    | A009 — Render history rows and inspect workday details                                                                                                                                             |
| Test category     | Browser                                                                                                                                                                                            |
| Scenario          | Open a row's View details panel, inspect read-only workday/session/break/schedule values, then close by supported keyboard and button controls with focus returned to the trigger.                 |
| Preconditions     | History row with multiple sessions, break, policy/schedule details, and a correction action.                                                                                                       |
| Test data         | Self-owned row fixture with distinct timestamps and values; no reconciliation capability.                                                                                                          |
| Test steps        | Focus row action trigger; open menu with keyboard; activate View details; assert panel fields/read-only semantics; close with Escape and Done; inspect focus restoration.                          |
| Expected result   | Correct detail panel appears; controls are keyboard accessible; no write occurs until Request correction; dismissal returns focus to row trigger.                                                  |
| Evidence          | `attendance-history.tsx:40-240`; `attendance-history-details-panel.tsx:31-214`; shared `row-actions-menu.tsx`; `side-panel.tsx:66-129`.                                                            |
| Existing coverage | `attendance.spec.ts:3217-3270` covers pointer menu/detail/correction route. PG-004-D-001 is confirmed on the shared menu in another page; it is a regression risk, not an observed PG-006 failure. |
| Proposed addition | NEW TEST REQUIRED                                                                                                                                                                                  |
| Priority          | High                                                                                                                                                                                               |
| Environment       | Playwright with browser-rendered Check-Ins history.                                                                                                                                                |

### PG-006-F001-A010-T019 — Missing-attendance request persists and reaches review queue

| Field             | Specification                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature    | A010 — Request missing attendance or a session correction                                                                             |
| Test category     | Integration                                                                                                                           |
| Scenario          | Submit a missing-attendance request from Check-Ins, then verify it persists and appears Pending to an authorized downstream reviewer. |
| Preconditions     | STAFF employee with valid request interval; isolated Head actor authorized for the employee.                                          |
| Test data         | Valid local start/end and 5–2,000-character reason; request key generated by client.                                                  |
| Test steps        | Submit via the page; assert success/closed dialog and refreshed page; sign in as Head and inspect the Pending request.                |
| Expected result   | One owned PENDING correction request exists and is visible to the authorized reviewer.                                                |
| Evidence          | `adjustment-dialog.tsx:26-169`; `attendance.management.ts:1506-1597`; `attendance.spec.ts:247-300`.                                   |
| Existing coverage | Real browser/API flow and downstream Pending assertion already exist.                                                                 |
| Proposed addition | EXISTING COVERAGE SUFFICIENT                                                                                                          |
| Priority          | High                                                                                                                                  |
| Environment       | Existing isolated browser/API/PGlite fixture.                                                                                         |

### PG-006-F001-A010-T020 — Existing-session correction preserves and links session instants

| Field             | Specification                                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature    | A010 — Request missing attendance or a session correction                                                                                                   |
| Test category     | Integration                                                                                                                                                 |
| Scenario          | Launch correction from a history detail session; prefilled local values/offset map back to exact original instants and the request carries that session ID. |
| Preconditions     | Existing session with explicit timestamps in a browser timezone that has a repeated local time.                                                             |
| Test data         | Recorded start/end instants, repeated-time occurrence offsets, session ID, valid reason.                                                                    |
| Test steps        | Open Check-Ins history details; choose Request correction; inspect local input/occurrence values; submit; inspect API request and persisted request.        |
| Expected result   | Instants and offset occurrence are preserved; correction is linked to the selected session; existing attendance remains unchanged until review.             |
| Evidence          | `adjustment-dialog.tsx:26-169`; `attendance-date-time-input.tsx:1-100`; `attendance.spec.ts:3217-3270`; `attendance.management.ts:1506-1597`.               |
| Existing coverage | Direct Playwright + isolated API/PGlite test already covers prefill, repeated offset, seconds, and linked `sessionId`.                                      |
| Proposed addition | EXISTING COVERAGE SUFFICIENT                                                                                                                                |
| Priority          | High                                                                                                                                                        |
| Environment       | Existing Playwright + isolated API/PGlite fixture with explicit timezone.                                                                                   |

### PG-006-F001-A010-T021 — Correction reason minimum and maximum API boundaries

| Field             | Specification                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature    | A010 — Request missing attendance or a session correction                                                                           |
| Test category     | API                                                                                                                                 |
| Scenario          | The request API accepts reason lengths 5 and 2,000 and rejects lengths 4 and 2,001.                                                 |
| Preconditions     | Active STAFF with valid policy/session-less correction interval and fresh UUID request key per call.                                |
| Test data         | Valid nonoverlapping start/end; reason strings at 4, 5, 2,000, and 2,001 characters.                                                |
| Test steps        | POST each request through PGlite API; assert response and inspect created adjustment count/reason for accepted cases.               |
| Expected result   | 5 and 2,000 are accepted; 4 and 2,001 return 400; rejected calls create no adjustment.                                              |
| Evidence          | `adjustment-dialog.tsx:26-169`; `attendance.management.ts:1506-1597` (`text(input.reason, 5)`, default max 2,000).                  |
| Existing coverage | Existing API management suite covers ownership/replay at `management.test.ts:345-448`; direct reason boundary assertions not found. |
| Proposed addition | ADDITIONAL ASSERTION REQUIRED                                                                                                       |
| Priority          | High                                                                                                                                |
| Environment       | API/PGlite with isolated in-memory PostgreSQL.                                                                                      |

### PG-006-F001-A010-T022 — Request ownership, replay safety, and duplicate prevention

| Field             | Specification                                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature    | A010 — Request missing attendance or a session correction                                                                                                                        |
| Test category     | API                                                                                                                                                                              |
| Scenario          | Requests are self-owned; foreign session targeting is denied; identical request-key replay is idempotent; changed payload and duplicate pending session correction are rejected. |
| Preconditions     | Existing PGlite staff/other employee fixtures and a session eligible for correction.                                                                                             |
| Test data         | Valid request payload/key, same-payload replay, changed-reason replay, foreign employee/session, duplicate pending session request.                                              |
| Test steps        | Submit each payload; compare statuses/IDs; inspect persisted rows and ensure no foreign or duplicate record.                                                                     |
| Expected result   | Original request is created once; same payload returns same record; mismatched key payload conflicts; foreign/duplicate request is rejected.                                     |
| Evidence          | `attendance.management.ts:1506-1597`; `management.test.ts:345-448`.                                                                                                              |
| Existing coverage | `management.test.ts:345-448` directly covers ownership, same-key replay, changed payload, and foreign session.                                                                   |
| Proposed addition | EXISTING COVERAGE SUFFICIENT                                                                                                                                                     |
| Priority          | Critical                                                                                                                                                                         |
| Environment       | API/PGlite.                                                                                                                                                                      |

### PG-006-F001-A011-T023 — Confirmation cancel, pending guard, and action failure recovery

| Field             | Specification                                                                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature    | A011 — Confirm actions and recover from action errors                                                                                                                                     |
| Test category     | Browser                                                                                                                                                                                   |
| Scenario          | Cancel performs no write; rapid duplicate confirm is suppressed while pending; a server error remains visible in the dialog; a later successful submit closes it and creates one action.  |
| Preconditions     | Eligible active employee with deterministic current state and intercepted clock-action endpoint.                                                                                          |
| Test data         | One cancel scenario; delayed POST response; first confirmed response 503 then next confirmation success.                                                                                  |
| Test steps        | Open action confirmation and cancel while tracking writes; reopen, hold response and attempt duplicate confirmation; resolve failure and inspect error/dialog; retry and resolve success. |
| Expected result   | Cancel sends no POST; pending disables/ignores duplicates; failure keeps dialog/error; subsequent success updates state and yields one successful mutation.                               |
| Evidence          | `my-attendance-page.tsx:80-91,423-445`; `use-attendance-clock.ts:30-86`; shared `confirmation-dialog.tsx`.                                                                                |
| Existing coverage | `attendance.spec.ts:200-300` exercises successful confirmations only; cancellation/error assertions not found.                                                                            |
| Proposed addition | NEW TEST REQUIRED                                                                                                                                                                         |
| Priority          | High                                                                                                                                                                                      |
| Environment       | Playwright with delayed/mocked same-origin API.                                                                                                                                           |

### PG-006-F001-A011-T024 — Check-Ins controls remain usable at supported widths

| Field             | Specification                                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic feature    | A011 — Confirm actions and recover from action errors; A008 controls                                                                                                                |
| Test category     | Browser                                                                                                                                                                             |
| Scenario          | Check-Ins navigation, date filters, primary clock action, history row actions, and dialogs remain visible/usable without horizontal overflow at narrow, tablet, and desktop widths. |
| Preconditions     | Existing Check-Ins browser fixture and viewport matrix.                                                                                                                             |
| Test data         | 390 px, 820 px, and 1440 px viewports; active and completed workday states.                                                                                                         |
| Test steps        | Visit Check-Ins at each width; verify no document overflow and that relevant controls can be focused/activated; open/close one dialog or row menu.                                  |
| Expected result   | Controls remain operable and page width does not exceed viewport.                                                                                                                   |
| Evidence          | `my-attendance-page.tsx:132-440`; `attendance-history.tsx:40-240`; `attendance.spec.ts:1556-1638`.                                                                                  |
| Existing coverage | Current width matrix checks route heading, API success, and overflow; action/filter/detail usability assertions are not comprehensive.                                              |
| Proposed addition | ADDITIONAL ASSERTION REQUIRED                                                                                                                                                       |
| Priority          | Medium                                                                                                                                                                              |
| Environment       | Playwright; isolated existing browser fixture at 390/820/1440 px.                                                                                                                   |

### PG-006-F001-A008-T025 — Clearing From or Through date

| Field             | Specification                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Atomic feature    | A008 — Filter and paginate personal history                                                                                                                                                |
| Test category     | Browser                                                                                                                                                                                    |
| Scenario          | Define expected history behavior when either date field is cleared.                                                                                                                        |
| Preconditions     | Product owner has approved a rule for incomplete date ranges.                                                                                                                              |
| Test data         | Previously loaded nonempty history; clear From and Through separately.                                                                                                                     |
| Test steps        | After contract approval, clear each field and assert the approved query, table, empty, or validation state.                                                                                |
| Expected result   | **Unspecified.** Current source disables fetching when either date is blank while retaining last successful data; do not freeze this behavior as product acceptance without clarification. |
| Evidence          | `my-attendance-page.tsx:51-69,353-405`; `use-async-resource.ts:11-96`.                                                                                                                     |
| Existing coverage | No direct browser case found; current source behavior is described in discovery.                                                                                                           |
| Proposed addition | CONTRACT CLARIFICATION REQUIRED                                                                                                                                                            |
| Priority          | Medium                                                                                                                                                                                     |
| Environment       | Browser after product contract is decided.                                                                                                                                                 |

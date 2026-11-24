# PG-004 Test Case Specification

**Planning only:** all cases below are proposals or existing-coverage classifications. No test code was added and no test was executed.  
**Counting rule:** each stable case ID is counted once. Implementable totals include `NEW TEST REQUIRED` and `ADDITIONAL ASSERTION REQUIRED`; existing sufficient coverage and contract-blocked cases are excluded.

## Proposal totals

| Classification                  |  Count | Included in additions?                                               |
| ------------------------------- | -----: | -------------------------------------------------------------------- |
| NEW TEST REQUIRED               |     12 | Yes                                                                  |
| ADDITIONAL ASSERTION REQUIRED   |      2 | Yes                                                                  |
| EXISTING COVERAGE SUFFICIENT    |      5 | No; preserve existing assertions                                     |
| CONTRACT CLARIFICATION REQUIRED |      0 | No current-source behavior is blocked on an undefined contract       |
| **Implementable additions**     | **14** | **1 unit + 1 API/PGlite + 8 browser + 4 browser/PGlite integration** |

“Browser” cases use deterministic mocked API responses. Browser/PGlite integration cases use the existing attendance browser server and real same-origin API calls. Counts are by primary execution type and do not double-count one test across categories.

## Proposed and preserved cases

### PG-004-F001-A001-T001 — exact route authorization matrix

- **Classification / type:** NEW TEST REQUIRED; Unit.
- **Scenario and objective:** Verify the exact `/attendance/adjustments` route allows the implemented roles and rejects denied accounts.
- **Preconditions / data:** Use production `canAccessRoute` and realistic account objects: active STAFF, active ADMIN, active SUPERADMIN with and without `employees:read`, active USER, and inactive STAFF/ADMIN/SUPERADMIN.
- **Steps:** Call `canAccessRoute(account, "/attendance/adjustments")` for each fixture.
- **Expected:** Active STAFF/ADMIN and active SUPERADMIN with `employees:read` are allowed; USER, inactive accounts and ungranted SUPERADMIN are denied.
- **Source evidence:** `route-policy.ts:420-424`; `permissions.ts:92-100`.
- **Existing coverage:** `attendance.test.mjs:77-117` directly asserts STAFF/Head/ADMIN allowed, but not the exact denied matrix.
- **Required addition:** Add a named PG-004 unit case to the existing attendance unit file; no production helper copy.
- **Priority / environment / file:** P1; Node `node:test`, no network/database; `apps/web/test/attendance.test.mjs`.

### PG-004-F001-A002-T002 — default mixed queue renders scoped request data

- **Classification / type:** NEW TEST REQUIRED; Browser.
- **Scenario and objective:** Open the default route and verify it requests and renders both correction and overtime rows with status/date/reason/employee fields.
- **Preconditions / data:** Active Head account; deterministic GET response with one correction and one overtime row in different statuses, full employee and capability fields, `total/page/pageSize`.
- **Steps:** Navigate to `/attendance/adjustments`; observe the list request; inspect heading, controls, table label and both rows.
- **Expected:** Request uses `scope=team&page=1&search=&type=&status=`; both row types and statuses render and use browser-zone date formatting; type and status filters are visible.
- **Source evidence:** `attendance-adjustments-page.tsx:77-121,230-271`; `attendance-adjustment-table.tsx:90-225`.
- **Existing coverage:** Direct PG-004 tests check a Pending label and one Head review, not mixed row display or query defaults.
- **Required addition:** Add a mocked route-level happy-path browser case.
- **Priority / environment / file:** P1; local Playwright app, `restoreSession`, stubbed API; new `apps/web/e2e/attendance-adjustments.spec.ts`.

### PG-004-F001-A003-T003 — mine/team scope control and request selection

- **Classification / type:** NEW TEST REQUIRED; Browser.
- **Scenario and objective:** Verify manager/self-service toggle visibility, initial scope, scope request value and page reset.
- **Preconditions / data:** Active Head, ADMIN, ordinary STAFF and SUPERADMIN profiles; page response with page metadata; manager starts on page 2 before toggling.
- **Steps:** Visit the default route per profile; inspect available toggle and first list scope; for manager/self-service actors select My requests and then team scope.
- **Expected:** Head and ADMIN have toggle and default to team; ordinary STAFF defaults mine with no toggle; SUPERADMIN has no personal toggle and requests team. Toggling resets to page 1 and queries the expected scope.
- **Source evidence:** `attendance-adjustments-page.tsx:49-52,270-301`; `permissions.ts:92-116`.
- **Existing coverage:** `superadmin-attendance.spec.ts:558-687,715-768` covers shared behavior on the typed corrections/overtime routes, not the PG-004 route.
- **Required addition:** Add default-route role matrix; avoid repeating typed-route assertions.
- **Priority / environment / file:** P1; Playwright with `restoreSession` and deterministic list stubs; `apps/web/e2e/attendance-adjustments.spec.ts`.

### PG-004-F001-A004-T004 — search/type/status filters and reset behavior

- **Classification / type:** NEW TEST REQUIRED; Browser.
- **Scenario and objective:** Verify debounced search, filter option values, combined query encoding and page reset.
- **Preconditions / data:** Manager account, stubbed list endpoint that records requests and returns distinguishable rows; start at page 2.
- **Steps:** Enter a search term, select Overtime and Verified, then change each filter and clear it; capture settled requests.
- **Expected:** Search is capped at 100 chars and settles after 200 ms; requests carry the selected scope/page/search/type/status; no request fires for each unsettled keystroke; every change resets page to 1 and displayed rows match response.
- **Source evidence:** `attendance-adjustments-page.tsx:54-69,230-271`; `attendance-api.ts:406-427`; API filter validation at `attendance.management.ts:1416-1464`.
- **Existing coverage:** API list filters exist, but no default-route control/query assertion was found.
- **Required addition:** Add one browser case covering the combined filters and debounce without timing sleeps.
- **Priority / environment / file:** P1; Playwright, controlled route handler and `restoreSession`; `apps/web/e2e/attendance-adjustments.spec.ts`.

### PG-004-F001-A005-T005 — pagination controls and page metadata

- **Classification / type:** NEW TEST REQUIRED; Browser.
- **Scenario and objective:** Verify page navigation reflects server page metadata and disables paging during a refresh.
- **Preconditions / data:** Stub page 1 and page 2 responses with 10 and 1 distinguishable records, totals, and correct page metadata.
- **Steps:** Open page 1, go Next, inspect page 2 rows/range, then return Previous; trigger a pending response and inspect disabled state.
- **Expected:** Exactly the response rows are displayed; footer range/total/page labels agree with metadata; controls use page 2 and return to page 1; page controls are disabled while loading.
- **Source evidence:** `attendance-adjustments-page.tsx:303-339`; `attendance-shared.tsx` `AttendancePagination`; `shared/query/pagination.ts:8-68`.
- **Existing coverage:** Shared pagination has coverage on other attendance pages; no default adjustment pager assertion was identified.
- **Required addition:** Add default-route pager behavior using deterministic responses.
- **Priority / environment / file:** P2; Playwright with mocked API; `apps/web/e2e/attendance-adjustments.spec.ts`.

### PG-004-F001-A005-T006 — loading, empty, error and retry states

- **Classification / type:** NEW TEST REQUIRED; Browser.
- **Scenario and objective:** Ensure pending load, zero results, failed load, and retry recovery have distinct observable states.
- **Preconditions / data:** Stub a held list response, an empty successful response, one 503, and a succeeding retry.
- **Steps:** Open route while response is held; release empty response; configure one failure and retry; return a populated list.
- **Expected:** Table is busy with skeleton rows while pending; empty message appears only for successful empty data; failure shows retry/error without stale rows; retry loads rows and clears error.
- **Source evidence:** `attendance-adjustments-page.tsx:107-121,303-333`; `attendance-adjustment-table.tsx:117-155`; `attendance-shared.tsx` `ResourceStatus`.
- **Existing coverage:** Other attendance pages have partial-failure/retry assertions; no PG-004 state matrix found.
- **Required addition:** Add controlled response-state test; release every held request in cleanup.
- **Priority / environment / file:** P1; Playwright mocked API, request gates; `apps/web/e2e/attendance-adjustments.spec.ts`.

### PG-004-F001-A006-T007 — correction action availability and form validation

- **Classification / type:** NEW TEST REQUIRED; Browser.
- **Scenario and objective:** Verify the default route exposes only eligible correction submission and validates the form before sending a write.
- **Preconditions / data:** Self-service STAFF with `requestCorrection=true`; negative profiles with capability false and SUPERADMIN; valid correction fixture; no overtime option expected.
- **Steps:** Visit route for each profile; open Request correction where allowed; inspect fields; submit missing/invalid times and short reason; use a local DST gap/fold case if browser timezone is controlled; cancel.
- **Expected:** Action appears only for self-service plus server capability; form is titled for missing attendance, has start/end/reason and no type selector; invalid inputs show validation and send no POST; cancel closes without a write.
- **Source evidence:** `attendance-adjustments-page.tsx:221-228,336-344`; `adjustment-dialog.tsx:26-151`; `attendance-date-time-input.tsx:11-114`.
- **Existing coverage:** Shared date/time validation is exercised from personal attendance; PG-004 launch/visibility is not.
- **Required addition:** Add PG-004 launch and no-write assertions; retain shared DST cases.
- **Priority / environment / file:** P1; Playwright with mocked list/API and controlled browser timezone; `apps/web/e2e/attendance-adjustments.spec.ts`.

### PG-004-F001-A006-T008 — submit correction from PG-004 and refresh queue

- **Classification / type:** NEW TEST REQUIRED; Browser/API/DB integration.
- **Scenario and objective:** Verify a missing-attendance correction submitted from PG-004 is persisted and visible after the page retries.
- **Preconditions / data:** Active STAFF with self-service, isolated attendance browser server/PGlite, valid non-overlapping timestamps and reason at least five characters.
- **Steps:** Navigate to `/attendance/adjustments`, submit the correction, wait for POST and list retry, then inspect the resulting row.
- **Expected:** POST `/api/attendance/adjustments` returns 201, a PENDING correction is persisted for the actor, modal closes, success toast appears, and refreshed list contains the submitted reason/type/status.
- **Source evidence:** `adjustment-dialog.tsx:56-91`; API routes `routes.ts:115-119`; service `attendance.management.ts:1506-1598`.
- **Existing coverage:** `attendance.spec.ts:246-299` submits through `/attendance/check-ins` and only checks a Pending label on PG-004.
- **Required addition:** Exercise the actual PG-004 action and assert the created row.
- **Priority / environment / file:** P1; Playwright against local Next app and `attendance-browser-server.ts` PGlite fixture; `apps/web/e2e/attendance.spec.ts`.

### PG-004-F001-A002-T009 — API list pagination boundary and stable ordering

- **Classification / type:** NEW TEST REQUIRED; API/PGlite.
- **Scenario and objective:** Verify list `page`, `pageSize`, `total`, stable order and adjacent page boundaries.
- **Preconditions / data:** `startPgliteApp` actors and 11 deterministically ordered adjustment rows within one scope, with distinct IDs/timestamps.
- **Steps:** GET page 1 and page 2 under the same scope/filter; compare ids, counts and metadata; request invalid page values including 0, decimal and greater than 100000.
- **Expected:** Page size is 10; page 1 has 10 and page 2 has 1; no duplicate/missing IDs; ties sort by id descending after createdAt; invalid pages return 400; total agrees with the scoped matching rows.
- **Source evidence:** `attendance.management.ts:1416-1504`; `shared/query/pagination.ts:8-68`.
- **Existing coverage:** `management.test.ts:821-898` verifies scope/type/status counts but not adjustment list page boundaries.
- **Required addition:** Add one PGlite list-contract subtest to the management suite.
- **Priority / environment / file:** P1; isolated PGlite via `tests/support/pglite-app.ts`; `apps/api/tests/features/attendance/management.test.ts`.

### PG-004-F001-A006-T010 — correction ownership, replay and scope API contract

- **Classification / type:** EXISTING COVERAGE SUFFICIENT; API/PGlite.
- **Scenario and objective:** Preserve owner-derived creation, safe replay, changed-payload conflict, cross-employee denial, team-scope denial, and self-review denial.
- **Preconditions / data:** Existing STAFF, Head, outsider and correction fixtures from the attendance management suite.
- **Steps:** Keep the current requests and assertions unchanged.
- **Expected:** Same request key/payload returns same adjustment; changed payload conflicts; foreign target and unauthorized scope/self-review are rejected.
- **Source evidence:** `attendance.management.ts:1506-1547,1600-1660`.
- **Existing coverage:** `apps/api/tests/features/attendance/management.test.ts:292-448`.
- **Required addition:** None; preserve the suite.
- **Priority / environment / file:** P1 preservation; PGlite; `apps/api/tests/features/attendance/management.test.ts`.

### PG-004-F001-A007-T011 — read-only row details

- **Classification / type:** NEW TEST REQUIRED; Browser.
- **Scenario and objective:** Verify View details displays the selected mixed-queue request without granting a decision form.
- **Preconditions / data:** Mock list with correction and overtime examples containing employee, dates, status, reason, review and verification notes.
- **Steps:** Open each row menu, choose View details, inspect summary and close with Done/Escape.
- **Expected:** Correct type-specific labels, status, dates, reason and workflow/stage notes render; no review-note textbox or Confirm decision appears; no detail GET is issued for ordinary default-route row detail; closing returns to the queue and focus to the trigger.
- **Source evidence:** `attendance-adjustments-page.tsx:127-145,323-371`; `attendance-adjustment-review-panel.tsx:22-174`.
- **Existing coverage:** Typed deep-link tests fetch detail; Superadmin tests open read-only details on a typed route. Default row-detail behavior is not directly asserted.
- **Required addition:** Add mocked default-route row-detail case.
- **Priority / environment / file:** P2; Playwright mocked API; `apps/web/e2e/attendance-adjustments.spec.ts`.

### PG-004-F001-A008-T012 — capability-based actions and Superadmin limits

- **Classification / type:** EXISTING COVERAGE SUFFICIENT; Browser.
- **Scenario and objective:** Preserve proof that backend row capabilities override assumed role privileges and self-service controls depend on role/capability.
- **Preconditions / data:** Existing correction rows with varying `approve`, `verify`, `reject` capabilities; mocked account roles.
- **Steps:** Keep current typed-route role/capability matrix unchanged.
- **Expected:** A denied capability produces only View details; Head/Admin/Staff/Superadmin controls match response capabilities and self-service conditions.
- **Source evidence:** `attendance-adjustment-table.tsx:34-88`; `attendance-adjustments-page.tsx:132-145`.
- **Existing coverage:** `apps/web/e2e/superadmin-attendance.spec.ts:558-768`.
- **Required addition:** None for shared decision-menu logic; PG-004 route display is covered by T002/T003.
- **Priority / environment / file:** P1 preservation; Playwright mocked API; `apps/web/e2e/superadmin-attendance.spec.ts`.

### PG-004-F001-A009-T013 — Head verification UI

- **Classification / type:** EXISTING COVERAGE SUFFICIENT; Browser/API integration.
- **Scenario and objective:** Preserve the direct PG-004 Head verification path and visible Verified state.
- **Preconditions / data:** Real isolated STAFF correction and current Department Head actor.
- **Steps:** Keep existing route, row menu, Verify correction, review-note and confirmation assertions.
- **Expected:** Verification succeeds, row reports Verified, and no final attendance approval is inferred from this stage alone.
- **Source evidence:** `attendance-adjustments-page.tsx:146-207`; API stage rules `attendance.management.ts:1650-1745`.
- **Existing coverage:** `apps/web/e2e/attendance.spec.ts:301-360`.
- **Required addition:** None for the Head stage itself; final HR stage is separately proposed in T014.
- **Priority / environment / file:** P1 preservation; real Playwright/Express/PGlite fixture; `apps/web/e2e/attendance.spec.ts`.

### PG-004-F001-A009-T014 — HR final correction approval and rejection

- **Classification / type:** NEW TEST REQUIRED; Browser/API/DB integration.
- **Scenario and objective:** Verify an authorized HR reviewer can finalize a verified correction or reject an eligible request through the PG-004 mixed queue.
- **Preconditions / data:** Isolated real API/PGlite; one verified correction and one independently pending/verified correction, distinct rows, actor outside the target employee's ownership.
- **Steps:** As Admin, open PG-004, approve one verified request with a valid note; inspect final row and session; reject the second with a valid note; inspect row and session.
- **Expected:** Approval changes correction status to APPROVED and applies proposed attendance; rejection changes status to REJECTED and leaves attendance unchanged; list reloads and row actions reflect terminal state.
- **Source evidence:** `attendance.management.ts:1600-1805`; panel form `attendance-adjustment-review-panel.tsx:49-76,151-174`.
- **Existing coverage:** API final correction/rejection is present; direct PG-004 browser coverage stops at Head verification.
- **Required addition:** Add HR final and reject browser integration assertions.
- **Priority / environment / file:** P1; local Next app and attendance PGlite browser fixture; `apps/web/e2e/attendance.spec.ts`.

### PG-004-F001-A010-T015 — stale overtime decision reconciliation on mixed route

- **Classification / type:** NEW TEST REQUIRED; Browser/API/DB integration.
- **Scenario and objective:** Verify a losing concurrent overtime decision on PG-004 fetches and shows the winning state as read-only.
- **Preconditions / data:** PGlite overtime row visible in the unfiltered mixed queue; two reviewers/browser contexts; valid winning note.
- **Steps:** Open review in context A; commit competing decision in context B; submit stale decision in A; await 409 and latest-detail fetch.
- **Expected:** The winning status/note appears in read-only details, no decision form remains, row reflects updated status after list retry, and no duplicate mutation occurs.
- **Source evidence:** `attendance-adjustments-page.tsx:33-43,146-205`; backend stale status conflict `attendance.management.ts:1650-1660`.
- **Existing coverage:** `attendance.spec.ts:3333-3455` verifies this shared logic on typed overtime route.
- **Required addition:** Exercise the same conflict through the default mixed route specifically.
- **Priority / environment / file:** P1; real Playwright/Express/PGlite with two sessions; `apps/web/e2e/attendance.spec.ts`.

### PG-004-F001-A010-T016 — access loss clears overtime details on default route

- **Classification / type:** ADDITIONAL ASSERTION REQUIRED; Browser/API/DB integration.
- **Scenario and objective:** Extend the existing Head handoff conflict case to prove the mixed PG-004 route clears private request data after a 403 and inaccessible detail fetch.
- **Preconditions / data:** Existing overtime row/reviewer fixtures; Head loses department assignment during the pending review; target reason is unique.
- **Steps:** Run the current stale conflict handoff scenario through `/attendance/adjustments` in addition to its typed-route assertion; await review denial, detail 404 and list denial.
- **Expected:** Review panel closes, row/action is removed, private reason is absent, and current error state is visible; no mutation is persisted.
- **Source evidence:** `attendance-adjustments-page.tsx:164-205`; API rechecks current scope in `attendance.management.ts:1600-1660`.
- **Existing coverage:** `attendance.spec.ts:3456-3521` covers the behavior on typed overtime route.
- **Required addition:** Add the default route as an asserted path; do not duplicate fixture or remove typed-route regression.
- **Priority / environment / file:** P1; existing real Playwright/PGlite concurrent fixture; `apps/web/e2e/attendance.spec.ts`.

### PG-004-F001-A011-T017 — default route responsive and keyboard operation

- **Classification / type:** ADDITIONAL ASSERTION REQUIRED; Browser.
- **Scenario and objective:** Extend existing attendance viewport coverage to the default mixed queue and verify accessible keyboard use of a row menu/detail panel.
- **Preconditions / data:** At least one mixed-queue row with a permitted action; narrow 390px and desktop viewport; deterministic account/API response.
- **Steps:** Open PG-004 at both widths; check no horizontal page overflow; tab to row actions, open menu, use keyboard selection/Escape, and close the side panel.
- **Expected:** Table remains within viewport, labels remain available, keyboard can open/close the action menu and detail panel, focus returns to the row action trigger.
- **Source evidence:** `attendance-adjustment-table.tsx:15-18,90-225`; `attendance-adjustment-review-panel.tsx:43-48`.
- **Existing coverage:** `attendance.spec.ts:1288-1472` and `superadmin-attendance.spec.ts:558-687` cover related attendance layouts at several widths, but not default PG-004.
- **Required addition:** Add the default route and interaction assertion to the existing shared page suite or route spec.
- **Priority / environment / file:** P2; Playwright Chromium, mocked data; `apps/web/e2e/attendance-adjustments.spec.ts`.

### PG-004-F001-A006-T018 — local-time, DST and overnight helper behavior

- **Classification / type:** EXISTING COVERAGE SUFFICIENT; Unit/browser helper coverage.
- **Scenario and objective:** Preserve ambiguous/nonexistent local-time resolution, selected UTC offset, and overnight date/time formatting used by the shared correction dialog/table.
- **Preconditions / data:** Existing deterministic dates and configured browser timezone fixtures.
- **Steps:** Keep current helper and browser assertions unchanged.
- **Expected:** Invalid gaps cannot submit; repeated local time requires an explicit occurrence; valid overnight/repeated-time values retain their chosen instant.
- **Source evidence:** `attendance-date-time-input.tsx:11-114`; `features/attendance/model/attendance.ts` date utilities.
- **Existing coverage:** `apps/web/test/attendance.test.mjs:21-75`; `apps/web/e2e/attendance.spec.ts:2293-2640`.
- **Required addition:** None for shared date/time resolution; T007 covers route-specific dialog launch/no-write.
- **Priority / environment / file:** P1 preservation; Node unit and existing PGlite-backed Playwright suite.

### PG-004-F001-A009-T019 — API staged decisions and overtime non-mutation

- **Classification / type:** EXISTING COVERAGE SUFFICIENT; API/PGlite.
- **Scenario and objective:** Preserve Head verification, HR finalization, Superadmin override, rejection, own-request denial, and overtime interval/attendance invariants.
- **Preconditions / data:** Current PGlite account, department, attendance policy, sessions, correction and overtime fixtures.
- **Steps:** Keep current management/overtime test assertions unchanged.
- **Expected:** Stage rules are enforced; verified requests are not treated as finally approved; final overtime approval does not alter attendance timestamps; rejection does not apply corrections.
- **Source evidence:** `attendance.management.ts:1600-1805`.
- **Existing coverage:** `management.test.ts:176-258,292-508`; `overtime.test.ts:12-20` and body.
- **Required addition:** None for the backend stage/persistence contract; T014 adds the missing direct HR browser flow.
- **Priority / environment / file:** P1 preservation; PGlite; existing API files.

## Contract-blocked cases

None. The default route's source behavior, visible controls, role gates, API filters, and persistence transitions are defined well enough to test. PG-003 C001/T010 and PG-002 C001/C002 are separate existing deferred contracts and remain unchanged in the ledger.

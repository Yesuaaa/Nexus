# PG-011 Test Case Specification

## Reconciliation counts

| Measure                                                          |                                     Count |
| ---------------------------------------------------------------- | ----------------------------------------: |
| Unique case records                                              |                                        42 |
| `NEW TEST REQUIRED`                                              |                                        15 |
| `ADDITIONAL ASSERTION REQUIRED`                                  |                                        13 |
| `EXISTING COVERAGE SUFFICIENT`                                   |                                        12 |
| `CONTRACT CLARIFICATION REQUIRED`                                |                                         2 |
| `NOT APPLICABLE`                                                 |                                         0 |
| Implementable records (all dispositions except contract-blocked) |                                        40 |
| Proposed new declarations                                        |                                        15 |
| Proposed additive assertion groups                               |                                        13 |
| Existing-sufficient cases to preserve                            |                                        12 |
| Implementable by primary layer                                   | Unit 1; API 15; Browser 19; Integration 5 |

Every case ID appears once below. Existing-sufficient cases remain part of the 40 implementable scope but do not propose duplicate declarations. Contract-blocked cases are excluded from all implementable layer totals.

## Case records

### PG-011-F001-A001-T001 — Verify the route policy matrix

- **Layer / disposition / priority:** Unit / ADDITIONAL ASSERTION REQUIRED / High.
- **Objective:** Use the production route-policy helper to assert access for active STAFF and ADMIN, active SUPERADMIN with `employees:read`, and denial for USER, inactive accounts, and SUPERADMIN without permission.
- **Preconditions and input:** Account objects for those six role/activity/permission combinations; path `/attendance/requests/leave`.
- **Steps:** Call `canAccessRoute` with each account and the canonical path; retain existing attendance navigation assertions.
- **Expected:** Result matches `canAccessAttendance`: active STAFF/ADMIN and permissioned active SUPERADMIN pass; unsupported/inactive/no-permission combinations fail.
- **Existing coverage:** `apps/web/test/attendance.test.mjs`, `all attendance navigation pages preserve module ownership and role boundaries`, lines 252-271; current matrix omits the complete positive/negative combinations.
- **Evidence and dependencies:** `apps/web/src/features/workspaces/model/route-policy.ts:352-394,739`; `features/auth/model/permissions.ts:92-100`; use production helper and current account shape.
- **Environment:** Web Node unit; no network/database.

### PG-011-F001-A001-T002 — Verify canonical Leave navigation and portal route

- **Layer / disposition / priority:** Browser / ADDITIONAL ASSERTION REQUIRED / Medium.
- **Objective:** Confirm an allowed active Staff user can reach the page from Attendance > Requests & Approvals > Leave and by direct canonical URL.
- **Preconditions and input:** Authenticated STAFF fixture with linked Employee; canonical URL `/attendance/requests/leave`.
- **Steps:** Open Attendance navigation, select Leave, confirm URL/page; reload through direct URL.
- **Expected:** The same Leave Requests page renders at the canonical URL. No separate leave redirect is expected.
- **Existing coverage:** `Superadmin opens organization leave by direct URL and notification` covers direct query-linked access for SUPERADMIN, not ordinary navigation for Staff.
- **Evidence and dependencies:** `attendance/model/navigation.ts:45-72`; route `page.tsx:3-10`; `portal-layout.tsx:21-64`; authenticated browser fixture.
- **Environment:** Browser/API integration fixture; no mutation.

### PG-011-F001-A002-T001 — Verify mine/team toggle and query scope

- **Layer / disposition / priority:** Browser / NEW TEST REQUIRED / High.
- **Objective:** Verify an eligible manager with personal access switches between team/organization requests and My requests and that the matching scope is sent.
- **Preconditions and input:** STAFF Department Head and ADMIN with `employees:read`; mocked lists contain distinguishable own/team rows.
- **Steps:** Open page; inspect default team scope; switch to My requests; switch back; capture GET query after each selection.
- **Expected:** STAFF labels team as “Department requests,” ADMIN as “Organization requests”; personal view sends `scope=mine`, team sends `scope=team`, page resets to 1, and rows follow response.
- **Existing coverage:** API scope is exercised in `leave-requests.test.ts:170-188,375-377`; no page toggle/query assertion found.
- **Evidence and dependencies:** `leave-requests-page.tsx:30-56,214-239`; `ManagementViewToggle`; typed API list fixture.
- **Environment:** Mocked Playwright; does not prove backend data scope.

### PG-011-F001-A002-T002 — Preserve independent backend scope enforcement

- **Layer / disposition / priority:** API / EXISTING COVERAGE SUFFICIENT / Critical.
- **Objective:** Preserve independent API enforcement for mine/team scopes, current Head department, ADMIN permission and organization access.
- **Preconditions and input:** Existing PGlite actors: requester, Head, ADMIN, SUPERADMIN and outsider; linked Employees and multiple Departments.
- **Steps:** Run existing scoped list/detail/action requests and compare allowed rows, 403s and hidden-record 404s.
- **Expected:** Only current actor scope/capabilities are returned; UI toggle does not grant access; request writes outside scope do not mutate.
- **Existing coverage:** `leave-requests.test.ts:170-188,468-490,1737-2120`; `attendance.spec.ts:6844-6900`.
- **Evidence and dependencies:** `leave.service.ts:79-105,219-278,592-773`; existing `startPgliteApp` fixture.
- **Environment:** Isolated API/PGlite; retain current assertions without duplicate declarations.

### PG-011-F001-A002-T003 — Resolve profileless ADMIN request-button contract

- **Layer / disposition / priority:** Browser / CONTRACT CLARIFICATION REQUIRED / Medium.
- **Objective:** Determine expected UI behavior for active ADMIN with personal-route access but no linked Employee profile.
- **Preconditions and input:** Active ADMIN with `employees:read`, no Employee row; load `/attendance/requests/leave`.
- **Steps:** Observe Request leave visibility; if visible, open dialog and submit valid dates/reason against API; record preview/submit response and recovery UI without asserting product intent.
- **Expected:** No expected UI assertion can be selected yet. Backend currently requires linked Employee for mine/preview/submit and rejects missing profile; assert only no request was persisted. Product must decide whether to hide the control or present a supported recovery path.
- **Existing coverage:** PG-006 profileless ADMIN 409 is a different page and cannot resolve this contract. API `leave-requests.test.ts` covers actor scope, not this specific page state.
- **Evidence and dependencies:** `permissions.ts:92-115`; `leave-requests-page.tsx:147-151`; `leave.service.ts:219-227,398-420,422-450`; product decision required before UI assertion.
- **Environment:** Browser/API/PGlite, isolated account fixture; blocked from implementation pending contract.

### PG-011-F001-A003-T001 — Verify initial loading, empty, error and retry

- **Layer / disposition / priority:** Browser / NEW TEST REQUIRED / High.
- **Objective:** Verify loading skeleton, empty copy, failure alert and retry on the Leave list.
- **Preconditions and input:** Authenticated page; control GET `/api/leave/requests` responses in sequence: delayed 200 with empty page, 503, then 200 with one row.
- **Steps:** Load during delay; release empty response; reload with 503; click Retry; return a row.
- **Expected:** Table is busy/skeleton while waiting; empty text is exactly source copy; error exposes Retry; retry uses current query and renders recovered row.
- **Existing coverage:** No Leave route-specific list-state test found.
- **Evidence and dependencies:** `leave-requests-page.tsx:59-81,246-268`; `leave-request-table.tsx:94-151`; Playwright route interception.
- **Environment:** Mocked Playwright; no persistence claim.

### PG-011-F001-A004-T001 — Verify search debounce and page reset

- **Layer / disposition / priority:** Browser / NEW TEST REQUIRED / Medium.
- **Objective:** Verify search waits 200 ms, caps input at 100 characters, resets page 1 and submits the settled value.
- **Preconditions and input:** Mocked two-page list; search string `Mira`; a string of 120 characters for native maxLength.
- **Steps:** Navigate to page 2; type `Mira`; inspect request count before and after debounce; inspect query; attempt over-limit input.
- **Expected:** No request for unsettled intermediate value; a request occurs after the source debounce with `search=Mira&page=1`; input cannot exceed 100 characters.
- **Existing coverage:** No page-specific Leave search declaration found.
- **Evidence and dependencies:** `leave-requests-page.tsx:38-45,176-194`; `leave.service.ts:528-590`; deterministic fake timer or Playwright clock.
- **Environment:** Mocked Playwright; mock list data.

### PG-011-F001-A004-T002 — Verify API search normalization, fields and boundary

- **Layer / disposition / priority:** API / ADDITIONAL ASSERTION REQUIRED / Medium.
- **Objective:** Verify search is scoped, trimmed/normalized and matches source fields, and that >100 input is rejected.
- **Preconditions and input:** PGlite request fixtures with unique employee name, employee ID and reason; query lengths 100 and 101.
- **Steps:** Query each value inside mine/team scope; query the boundary; query 101 characters.
- **Expected:** Name/ID/reason matches return scoped records; 100 is accepted; unsupported over-limit query returns 400.
- **Existing coverage:** No explicit Leave search boundary assertion located in `leave-requests.test.ts`.
- **Evidence and dependencies:** `leave.service.ts:528-590`; `query-helpers`/search helper referenced by service; PGlite employee/request fixtures.
- **Environment:** Isolated API/PGlite.

### PG-011-F001-A005-T001 — Verify type/status filter interaction

- **Layer / disposition / priority:** Browser / NEW TEST REQUIRED / Medium.
- **Objective:** Verify type and status filters compose and reset pagination.
- **Preconditions and input:** Mock page 2; options include SICK, APPROVED, CANCELLED and the empty “all” values.
- **Steps:** Change type, then status; clear either filter; capture each request.
- **Expected:** Each change sends the current type/status combination with `page=1`; clearing uses an empty filter; visible rows equal the response.
- **Existing coverage:** API status query appears in `leave-requests.test.ts:375-377`; no UI filter interaction found.
- **Evidence and dependencies:** `leave-requests-page.tsx:195-231`; mocked API responses.
- **Environment:** Mocked Playwright.

### PG-011-F001-A005-T002 — Verify API filter composition and invalid values

- **Layer / disposition / priority:** API / ADDITIONAL ASSERTION REQUIRED / Medium.
- **Objective:** Verify type/status/date/search query filters compose and invalid enum values fail.
- **Preconditions and input:** Requests differing by type/status/employee/reason/date; query `type=SICK&status=APPROVED` and invalid type/status strings.
- **Steps:** Query matching combination; query each invalid enum; check response metadata.
- **Expected:** Only records satisfying all active filters are returned; invalid enum is 400.
- **Existing coverage:** `leave-requests.test.ts:375-377` tests a status filter but not the combined matrix.
- **Evidence and dependencies:** `leave.schema.ts:4-19,70-81`; `leave.service.ts:528-590`; PGlite data fixture.
- **Environment:** Isolated API/PGlite.

### PG-011-F001-A006-T001 — Verify paired date filter boundaries

- **Layer / disposition / priority:** API / ADDITIONAL ASSERTION REQUIRED / Medium.
- **Objective:** Verify inclusive valid date overlap, paired parameters, reversed/partial ranges and page reset through the UI.
- **Preconditions and input:** A request ending on `2026-12-10`, one spanning `2026-12-10` through `2026-12-12`, one beginning `2026-12-13`; query each valid boundary and one-sided/reversed pair.
- **Steps:** Assert the boundary requests are included by API; exercise both date inputs and capture paired query; send partial/reversed API range.
- **Expected:** Inclusive overlapping requests match; UI enforces min/max and sends both dates only when populated; partial/reversed server range is rejected.
- **Existing coverage:** `leave-requests.test.ts:495-499` checks one date-window query but not boundary/pair validation.
- **Evidence and dependencies:** `leave-api.ts:80-103`; `leave-requests-page.tsx:157-175`; `leave.schema.ts:48-68`; `leave.service.ts:528-590`.
- **Environment:** API/PGlite plus a mocked browser assertion (one stable case, primary layer API).

### PG-011-F001-A007-T001 — Verify page boundary and deterministic order

- **Layer / disposition / priority:** API / NEW TEST REQUIRED / Medium.
- **Objective:** Verify page metadata, page transition, final partial page, and deterministic tie order.
- **Preconditions and input:** At least 11 in-scope requests with controlled timestamps, including equal `createdAt`; pages 1, 2, 0 and an out-of-range page.
- **Steps:** Request each page; compare total/page/pageSize and row IDs; repeat the tied timestamp query.
- **Expected:** Page size/order follow current service contract (`createdAt desc`, then `id desc`); page 2 contains the remainder; invalid page is rejected by parser.
- **Existing coverage:** No Leave-list pagination assertion found.
- **Evidence and dependencies:** `leave.service.ts:528-590`; pagination parser used by leave list; PGlite seeded rows.
- **Environment:** Isolated API/PGlite.

### PG-011-F001-A008-T001 — Verify row values and optional department rendering

- **Layer / disposition / priority:** Browser / NEW TEST REQUIRED / Medium.
- **Objective:** Verify employee/department, type, UTC date span, summed leave hours and status label in desktop and narrow layout.
- **Preconditions and input:** Mock row with two days totaling 720 minutes, multi-date range crossing UTC date boundary, no department, `VERIFIED`; another row requiring reverification.
- **Steps:** Render at 1440px and 390px; inspect accessible row cells and status text.
- **Expected:** Hours show 12; type/status labels follow source maps; missing department says “No department”; date labels use UTC; reflow preserves visible values.
- **Existing coverage:** Existing E2E asserts selected leave statuses/detail fields; no complete row presentation test found.
- **Evidence and dependencies:** `leave-request-table.tsx:19-53,94-196`; `leave-status.ts:1-19`; typed response fixture.
- **Environment:** Mocked Playwright.

### PG-011-F001-A009-T001 — Verify capability-derived action visibility

- **Layer / disposition / priority:** Browser / ADDITIONAL ASSERTION REQUIRED / High.
- **Objective:** Verify each row menu exposes only the capabilities returned by the API.
- **Preconditions and input:** Mock rows with SUBMITTED Head verify/reject, VERIFIED HR approve/reject, own cancellable request, APPROVED reverse, terminal read-only, and reverification state.
- **Steps:** Open each row menu and compare menu items with capability flags.
- **Expected:** View details always appears; each action appears iff its corresponding capability is true; reverification suppresses approve until current route requirements pass.
- **Existing coverage:** Mocked transferred leave test in `superadmin-attendance.spec.ts:88-151`; real stale tests also check capability changes, but not full matrix.
- **Evidence and dependencies:** `leave-request-table.tsx:54-92,182-192`; backend `leave.service.ts:169-217`; typed mocks.
- **Environment:** Mocked Playwright; API capability logic remains separately tested.

### PG-011-F001-A009-T002 — Reproduce keyboard row-menu behavior across widths

- **Layer / disposition / priority:** Browser / NEW TEST REQUIRED / High.
- **Objective:** Verify keyboard opening, accessible menu item availability, action selection, Escape close and focus return at 390, 820 and 1440px.
- **Preconditions and input:** Row with View details and one authorized action; run same scenario at each viewport.
- **Steps:** Focus row-action trigger; press ArrowDown; assert menu expanded and item present; navigate/select using keyboard; separately open and press Escape; verify focus.
- **Expected:** Source semantics expose menu items and action/focus behavior at every width. If the known shared failure reproduces, retain the failing assertion and record PG-011 evidence without weakening it.
- **Existing coverage:** PG-004-D-001 remains confirmed; PG-010 T035 reproduced it twice at all three widths. No test is claimed for PG-011 yet.
- **Evidence and dependencies:** `row-actions-menu.tsx:45-187`; `leave-request-table.tsx:182-192`; preserve existing regression tests.
- **Environment:** Browser, mocked Leave list, fixed viewport; one worker for initial focused run.

### PG-011-F001-A010-T001 — Verify detail summary, policy days and decision history

- **Layer / disposition / priority:** Browser / ADDITIONAL ASSERTION REQUIRED / High.
- **Objective:** Verify read-only detail shows employee, department, type, total hours, private reason, per-day policy coverage, status and decisions.
- **Preconditions and input:** Mock a request with two day snapshots, missing optional department in one subcase, and SUBMITTED + VERIFIED decisions.
- **Steps:** Open View details; inspect labeled sections and content; verify no decision note form/action submit is present in read mode.
- **Expected:** Values reflect response snapshots; decision actor/note history appears; private reason is displayed to authorized reader; no mutation control appears.
- **Existing coverage:** Direct-link and transfer tests assert selected reason/status/reverification, but not the full read-only content inventory.
- **Evidence and dependencies:** `leave-review-panel.tsx:38-153`; `leave-request-table.tsx:54-60`; typed mock.
- **Environment:** Mocked Playwright.

### PG-011-F001-A010-T002 — Verify deep-link and revoked/missing detail recovery

- **Layer / disposition / priority:** Browser / ADDITIONAL ASSERTION REQUIRED / High.
- **Objective:** Verify an authorized `?request=<id>` link loads detail, while missing or newly inaccessible IDs do not expose stale request data.
- **Preconditions and input:** Existing real request ID; invalid UUID; valid ID that becomes out of scope before detail refresh.
- **Steps:** Open authorized link; open invalid link; for revoked case open detail, change current department/role via fixture, trigger stale reload.
- **Expected:** Authorized detail opens; invalid path follows route validation; revoked detail is cleared after scoped 404 with the existing stale-refresh message; no stale private reason remains.
- **Existing coverage:** Valid Superadmin direct link in `attendance.spec.ts:5764-5820`; revoked Head detail in `attendance.spec.ts:6844-6900`.
- **Evidence and dependencies:** route `page.tsx:3-10`; `leave.service.ts:592-610`; `leave-requests-page.tsx:95-145`; real browser/API fixture.
- **Environment:** Browser/API/PGlite integration; preserve current tests.

### PG-011-F001-A010-T003 — Resolve panel behavior when filters hide its row

- **Layer / disposition / priority:** Browser / CONTRACT CLARIFICATION REQUIRED / Low.
- **Objective:** Determine whether an open selected panel should remain visible after search/filter/scope removes its row from the list.
- **Preconditions and input:** Open a request detail; apply a filter whose response excludes that ID.
- **Steps:** Observe panel and action capability state without asserting product intent; capture current behavior for clarification.
- **Expected:** Product contract is needed. Current source retains selection and falls back to the selected request object if the new list omits it. Do not freeze this as desired behavior.
- **Existing coverage:** PG-005 detail-panel persistence during filtering is a separate page contract and cannot decide PG-011 behavior.
- **Evidence and dependencies:** `leave-requests-page.tsx:86-94,157-239`; product clarification required before test implementation.
- **Environment:** Mocked Playwright; blocked from expected-result assertion.

### PG-011-F001-A011-T001 — Verify request-dialog initialization and cancellation

- **Layer / disposition / priority:** Browser / NEW TEST REQUIRED / Medium.
- **Objective:** Verify Request leave opens the dialog with Annual default and Cancel closes without POSTing a request.
- **Preconditions and input:** Active STAFF with linked Employee; stub preview/list and count POST `/api/leave/requests` calls.
- **Steps:** Open dialog; inspect default type and blank values; click Cancel; inspect request count and dialog state.
- **Expected:** Dialog closes, no submit request is sent, and list is unchanged.
- **Existing coverage:** No PG-011 request dialog browser declaration found.
- **Evidence and dependencies:** `leave-requests-page.tsx:147-151,279-285`; `leave-request-dialog.tsx:21-35,61-179`; Playwright route interception.
- **Environment:** Mocked Playwright.

### PG-011-F001-A011-T002 — Verify request form input boundaries and pending lock

- **Layer / disposition / priority:** Browser / NEW TEST REQUIRED / High.
- **Objective:** Verify required dates/reason, min/max length and disabled controls while POST is pending.
- **Preconditions and input:** Empty dates; reason lengths 4, 5, 2000 and attempted 2001; selected supported types; successful preview; delayed POST.
- **Steps:** Attempt empty submit; fill boundary values; delay submit response; inspect button/input states; release response.
- **Expected:** Required/HTML constraints prevent invalid submit; source min=5/max=2000; pending disables inputs and close; after server failure values remain and error is visible.
- **Existing coverage:** No form-field or submit-pending Leave browser coverage found.
- **Evidence and dependencies:** `leave-request-dialog.tsx:67-118,146-178`; browser clock/route delay.
- **Environment:** Mocked Playwright.

### PG-011-F001-A012-T001 — Verify successful preview display

- **Layer / disposition / priority:** Browser / ADDITIONAL ASSERTION REQUIRED / High.
- **Objective:** Verify the inclusive date range preview renders returned working day count and covered hours.
- **Preconditions and input:** Preview response for `2026-11-20` through `2026-11-23` with four day snapshots, 960 total minutes and two days with positive minutes.
- **Steps:** Fill dates; wait for preview POST; inspect `role=status` content and Submit enabled state.
- **Expected:** UI reports 2 working days and 16 hours from returned values; Submit is enabled only after successful preview.
- **Existing coverage:** API preview asserts four inclusive days/960 minutes at `leave-requests.test.ts:144-153`; no browser presentation assertion.
- **Evidence and dependencies:** `leave-request-dialog.tsx:37-57,120-143`; `leave-api.ts:109-118`; mocked response fixture.
- **Environment:** Mocked Playwright; expected values are response-derived.

### PG-011-F001-A012-T002 — Verify preview failure, submission gate and recovery

- **Layer / disposition / priority:** Browser / NEW TEST REQUIRED / High.
- **Objective:** Verify policy/preview API failure is visible, disables submit and recovers after valid dates/policy response.
- **Preconditions and input:** Preview returns 409 for a missing assignment, then succeeds for a covered range.
- **Steps:** Enter dates; assert error and disabled submit; correct dates or retry by changing range; return successful preview.
- **Expected:** Failure is presented in the status region; no submit POST occurs before preview data exists; successful preview enables submit.
- **Existing coverage:** API validates policy coverage, but no dialog failure/recovery assertion found.
- **Evidence and dependencies:** `leave-request-dialog.tsx:37-57,120-178`; `leave.service.ts:106-164,398-420`; Playwright mock.
- **Environment:** Mocked Playwright.

### PG-011-F001-A013-T001 — Verify submitted request persists across browser, API and PGlite

- **Layer / disposition / priority:** Integration / NEW TEST REQUIRED / Critical.
- **Objective:** Submit through the real page and verify request, date snapshots, initial decision, route notices and refreshed row persist.
- **Preconditions and input:** Staff linked Employee with active policy assignment and eligible Head; type SICK; reason `Medical appointment follow-up`; one covered date `2026-12-08`.
- **Steps:** Sign in; open form; enter values; wait for preview; submit through browser; inspect list; query isolated API/database records and notifications.
- **Expected:** 201-backed request appears as SUBMITTED; payload matches; one LeaveRequestDay snapshot and SUBMITTED decision exist; recipient notices follow current routing; no duplicate request is created.
- **Existing coverage:** API submit and persistence are covered by `leave-requests.test.ts:155-167`; browser integration currently seeds requests through API, not the form.
- **Evidence and dependencies:** `leave-request-dialog.tsx:61-97`; `leave.service.ts:422-525`; `schema.prisma:1251-1318`; existing `attendance-browser-server.ts` fixture.
- **Environment:** Browser → Next.js → Express → Prisma/PGlite; serial fixture, one worker; not a mocked browser test.

### PG-011-F001-A013-T002 — Preserve request-key idempotent replay

- **Layer / disposition / priority:** API / EXISTING COVERAGE SUFFICIENT / High.
- **Objective:** Preserve same requester/requestKey/same canonical payload replay and mismatched payload conflict behavior.
- **Preconditions and input:** Existing PGlite requester, fixed UUID requestKey, exact payload then changed payload.
- **Steps:** Submit twice with identical payload; submit again with same key but changed canonical field; inspect records and response.
- **Expected:** Identical replay returns existing request; different payload returns 409; only one request/day/initial decision/notice set is persisted.
- **Existing coverage:** `leave-requests.test.ts:1455-1545` canonical payload and idempotency cases.
- **Evidence and dependencies:** `leave.service.ts:422-459`; Prisma `LeaveRequest` requester/requestKey uniqueness.
- **Environment:** Isolated API/PGlite; retain current assertions.

### PG-011-F001-A014-T001 — Preserve API schema boundaries

- **Layer / disposition / priority:** API / ADDITIONAL ASSERTION REQUIRED / High.
- **Objective:** Complete the direct boundary matrix for whitelisted fields, UUID, enums, reason limits, exact dates and inclusive range maximum.
- **Preconditions and input:** Valid payload; added/unknown field; 4/5/2000/2001-character reason; malformed UUID; leap/non-leap invalid dates; 366 and 367 inclusive days; unsupported type.
- **Steps:** POST each variant to isolated API; compare status/body and persisted side effects.
- **Expected:** Valid boundary values follow source rules; invalid fields return 400; no rejected variant leaves request, day, decision or notice records.
- **Existing coverage:** General API workflow and a few request failures exist; no complete schema boundary inventory was located.
- **Evidence and dependencies:** `leave.schema.ts:24-87`; `leave.service.ts:422-525`; PGlite fixture.
- **Environment:** Isolated API/PGlite.

### PG-011-F001-A014-T002 — Verify policy coverage gaps and no partial writes

- **Layer / disposition / priority:** API / NEW TEST REQUIRED / High.
- **Objective:** Verify request preview/submission rejects no assignment, overlapping/ambiguous assignments, missing weekday rule and zero covered working minutes.
- **Preconditions and input:** Isolated employees with each policy configuration; include a weekend-only inclusive range and date crossing an assignment boundary.
- **Steps:** Call preview and submit for each state; snapshot request/day/decision/notification counts before and after.
- **Expected:** Source-defined 409 for ambiguous/missing/incomplete coverage and 400 when total leave minutes are zero; rejected submit leaves all persisted counts unchanged.
- **Existing coverage:** Policy snapshots and approval recalculation are covered, but this complete create-time failure matrix was not found.
- **Evidence and dependencies:** `leave.service.ts:106-164,398-525`; policy/assignment fixture from `startPgliteApp`.
- **Environment:** Isolated API/PGlite.

### PG-011-F001-A014-T003 — Preserve overlapping active-request rejection

- **Layer / disposition / priority:** API / EXISTING COVERAGE SUFFICIENT / High.
- **Objective:** Preserve 409 for a second active leave request whose inclusive date range overlaps an existing active request.
- **Preconditions and input:** Existing requester with active `2026-11-18`–`2026-11-20`; second request `2026-11-19`–`2026-11-21` with new key.
- **Steps:** Submit the overlapping request; verify unchanged persistence after response.
- **Expected:** 409 and no second request/day/decision/notice records.
- **Existing coverage:** `leave-requests.test.ts:155-167` asserts 409; Phase 2.2 should preserve and strengthen persisted-state assertion only if not already present.
- **Evidence and dependencies:** `leave.service.ts:460-475`; existing PGlite fixture.
- **Environment:** Isolated API/PGlite.

### PG-011-F001-A015-T001 — Verify cancellation confirmation and whole-request effect

- **Layer / disposition / priority:** Browser / NEW TEST REQUIRED / High.
- **Objective:** Verify cancel is confirm-before-write, the UI-required decision note is retained, success feedback and full-request refresh.
- **Preconditions and input:** Mock request with cancel capability; note `Dates are no longer needed`; action response success; then rejection case. The backend also accepts an omitted cancellation note for direct API calls.
- **Steps:** Open Cancel request; fill required note; submit to show confirmation; close confirmation and verify no POST; reopen and confirm; inspect payload and row/detail state.
- **Expected:** No mutation before confirm; cancel endpoint receives actionId/version/note; success closes panel and refreshes; backend/API coverage establishes request is terminal and all coverage is removed. Failure retains actionable feedback. Preserve the separate direct API omitted-note assertion.
- **Existing coverage:** API cancellation and optional-note behavior in `leave-requests.test.ts:289-301,1545-1600`; no page confirmation test.
- **Evidence and dependencies:** `leave-review-panel.tsx:153-167,177-211`; `leave-requests-page.tsx:95-145`; mocked browser plus retained API case at `leave-requests.test.ts:1545`.
- **Environment:** Mocked Playwright for confirmation; API/PGlite remains persistence boundary.

### PG-011-F001-A016-T001 — Verify Head verification UI payload and success state

- **Layer / disposition / priority:** Browser / ADDITIONAL ASSERTION REQUIRED / High.
- **Objective:** Verify a Head can submit a valid verification note and sees updated state/history/feedback.
- **Preconditions and input:** SUBMITTED request with `verify=true`; note `Verified for current department`; mocked 200 response with VERIFIED request.
- **Steps:** Open Verify request; fill note; submit; inspect POST path/body and updated panel/list.
- **Expected:** One verify POST includes actionId, expectedVersion and note; success toast and refreshed status/history; stale or denied response does not show false success.
- **Existing coverage:** API staged verification at `leave-requests.test.ts:182-191`; transfer UI test handles capability/status but not a normal verification submit.
- **Evidence and dependencies:** `leave-review-panel.tsx:153-189`; `leave-requests-page.tsx:95-145`; mocked response fixture.
- **Environment:** Mocked Playwright; backend action remains API-tested.

### PG-011-F001-A016-T002 — Preserve Head rejection authorization and required-note checks

- **Layer / disposition / priority:** API / EXISTING COVERAGE SUFFICIENT / High.
- **Objective:** Preserve allowed Head rejection, denied outsider/self-review, invalid stage and required note behavior.
- **Preconditions and input:** Existing PGlite Head/requester/outside Head; SUBMITTED and later-stage requests; notes at required boundary.
- **Steps:** Exercise reject and invalid actors/stages/notes; inspect status, decisions and notifications.
- **Expected:** Current eligible Head may reject only permitted stage with valid note; rejected operation leaves state unchanged; valid rejection records decision/status and notice.
- **Existing coverage:** Staged workflow, outsiders and lifecycle cases in `leave-requests.test.ts:182-208,658-735,1397-1545`.
- **Evidence and dependencies:** `leave.service.ts:169-217,639-773`; existing PGlite fixture.
- **Environment:** Isolated API/PGlite.

### PG-011-F001-A017-T001 — Verify HR decision controls and API error feedback

- **Layer / disposition / priority:** Browser / ADDITIONAL ASSERTION REQUIRED / High.
- **Objective:** Verify HR sees approval only at the eligible stage, required note errors preserve input, and a rejected API action stays visible without false success.
- **Preconditions and input:** Mock VERIFIED row with approve/reject capabilities; second SUBMITTED row without approve; 409 action response.
- **Steps:** Inspect both menus; open approval; submit invalid note then valid note with 409 response; inspect note/error and toast count.
- **Expected:** Controls follow capability flags; invalid note does not submit; 409 error is displayed, note remains editable, no success toast/close occurs.
- **Existing coverage:** `stale HR approval refreshes leave after Superadmin rejection` (`attendance.spec.ts:5999-6114`) is real integration and API conflict evidence; `superadmin-attendance.spec.ts:88-151` is mocked capability UI.
- **Evidence and dependencies:** `leave-request-table.tsx:54-92`; `leave-review-panel.tsx:153-189`; page action error at `leave-requests-page.tsx:95-145`.
- **Environment:** Mocked Playwright; existing real stale integration preserved separately.

### PG-011-F001-A017-T002 — Preserve fallback and privileged review rules

- **Layer / disposition / priority:** API / EXISTING COVERAGE SUFFICIENT / Critical.
- **Objective:** Preserve rules for HR/Admin/Superadmin approval at VERIFIED and source-defined no-eligible-Head fallback, including self-review denial.
- **Preconditions and input:** Existing PGlite actors and requests with eligible Head, no Head, self-request, and differing workflow status.
- **Steps:** Submit each action through API; compare status/capabilities/notice and persisted decision.
- **Expected:** Only source-authorized reviewer/stage succeeds; fallback state and notices match current routing; self-review is denied.
- **Existing coverage:** Role/fallback/replay/head-change scenarios in `leave-requests.test.ts:658-735,1397-2120`; API workflow base at lines 170-208.
- **Evidence and dependencies:** `leave.service.ts:169-278,639-773`; `leave.repository.ts:31-160`.
- **Environment:** Isolated API/PGlite; retain.

### PG-011-F001-A018-T001 — Verify reversal confirmation and action payload

- **Layer / disposition / priority:** Browser / ADDITIONAL ASSERTION REQUIRED / High.
- **Objective:** Verify Reverse approval is confirmed before mutation and sends the current expected version.
- **Preconditions and input:** APPROVED row with `reverse=true`; mocked success and 409 responses.
- **Steps:** Open Reverse approval; inspect confirmation description; cancel once and assert zero POSTs; reopen, confirm; inspect payload and recovery on 409.
- **Expected:** Description states whole-request coverage removal/restored attendance requirements; request is sent only after confirmation; success refreshes; failure shows error without false success.
- **Existing coverage:** API reversal and attendance consequences at `leave-requests.test.ts:289-301,1231-1235`; no page confirmation assertion.
- **Evidence and dependencies:** `leave-review-panel.tsx:177-211`; `leave-requests-page.tsx:95-145`.
- **Environment:** Mocked Playwright, with API persistence case retained.

### PG-011-F001-A019-T001 — Preserve transfer/reverification across actual pages

- **Layer / disposition / priority:** Integration / EXISTING COVERAGE SUFFICIENT / High.
- **Objective:** Preserve Employee Directory transfer, new Head notice/deep link, old Head denial and receiving Head reverification behavior.
- **Preconditions and input:** Existing serial browser fixture with two Heads and a request at each review stage.
- **Steps:** Run current transfer workflow and verify notification, scope and page state at each actor.
- **Expected:** New current Head receives notices; former Head cannot read/review after transfer; reverification gates HR approval until route is current.
- **Existing coverage:** `WC-I3-F01 Employee Directory transfer routes both Leave review stages to the receiving Head`, `attendance.spec.ts:5821-5990`; related PGlite Head-change cases at API test lines 1737-2120.
- **Evidence and dependencies:** `leave.repository.ts:31-60,88-160`; existing serial Browser/API/PGlite fixture.
- **Environment:** Browser/API/PGlite; retain existing integration and assertions.

### PG-011-F001-A020-T001 — Preserve stale-action refresh and scope-revocation recovery

- **Layer / disposition / priority:** Integration / EXISTING COVERAGE SUFFICIENT / Critical.
- **Objective:** Preserve stale HR conflict refresh and inaccessible Head detail clearing.
- **Preconditions and input:** Two actors; one prepares action while another changes request status or current Head scope.
- **Steps:** Run current competing-action and revoked-scope browser workflows.
- **Expected:** Version conflict refreshes current status/history and capabilities; hidden record 404 removes private detail and action panel; no stale action succeeds.
- **Existing coverage:** `attendance.spec.ts:5999-6114` and `6844-6900`.
- **Evidence and dependencies:** `leave-requests-page.tsx:95-145`; `leave.service.ts:639-773`; existing two-context browser fixture.
- **Environment:** Browser/API/PGlite; preserve and do not weaken.

### PG-011-F001-A020-T002 — Preserve decision-action idempotent replay

- **Layer / disposition / priority:** API / EXISTING COVERAGE SUFFICIENT / High.
- **Objective:** Preserve same actor/actionId/canonical body replay and reject actionId reuse with changed actor, scope or payload.
- **Preconditions and input:** Existing request and first persisted action; repeat with same and altered payloads/actors.
- **Steps:** Replay action calls; compare response and full saved request/decision/notification state.
- **Expected:** Identical replay returns canonical prior response without duplicate writes; altered/revoked replay follows current source conflict or scoped result.
- **Existing coverage:** `leave-requests.test.ts:468-490,1397-1600`.
- **Evidence and dependencies:** `leave.service.ts:639-773`; unique `[requestId, actorId, actionId]` in `schema.prisma:1299-1318`.
- **Environment:** Isolated API/PGlite.

### PG-011-F001-A020-T003 — Verify concurrent leave decisions on disposable PostgreSQL

- **Layer / disposition / priority:** Integration / NEW TEST REQUIRED / High.
- **Objective:** Exercise two different reviewers racing on the same request/version and verify only one transition commits.
- **Preconditions and input:** Fresh, explicitly disposable PostgreSQL 16 database; current schema/migrations; VERIFIED request version 2; two permitted reviewers with distinct action IDs and decision actions.
- **Steps:** Use independent connections and a barrier to submit competing approve/reject operations with expectedVersion 2; inspect both responses and final rows.
- **Expected:** One operation wins; the loser receives a source-defined stale/state conflict (currently expected 409); exactly one new decision/version/notification set persists and no mixed terminal state occurs. Confirm exact response contract during implementation from source/current run.
- **Existing coverage:** API PGlite tests include account-disable/approval race (`leave-requests.test.ts:1059-1092`) and replay; this is not a two-decision race. PG-010 T032 demonstrates disposable PostgreSQL availability but does not prove this behavior.
- **Evidence and dependencies:** `leave.service.ts:639-773`; `lockRows` calls; `LeaveDecision` uniqueness; a verified disposable PostgreSQL target and barrier fixture.
- **Environment:** Opt-in real PostgreSQL integration only; never default PGlite or developer database. Keep separate from PG-008 assignment-concurrency blocker.

### PG-011-F001-A021-T001 — Preserve notification recipients and deep-link behavior

- **Layer / disposition / priority:** Integration / EXISTING COVERAGE SUFFICIENT / High.
- **Objective:** Preserve requester/reviewer notice creation and authorized notification-to-detail navigation.
- **Preconditions and input:** Staff submission, Head/HR workflow actors, notice inbox, valid entity ID.
- **Steps:** Run API recipient assertions and real browser notification click/deep-link case.
- **Expected:** Notices follow current route/stage; click opens canonical `?request=id`; detail still enforces current scope; read action is per-user.
- **Existing coverage:** `attendance.spec.ts:5764-5820,5821-5990`; `leave-requests.test.ts:301-458` and transfer cases.
- **Evidence and dependencies:** `leave.repository.ts:88-160`; workflow notification link `workflow-notifications.tsx:136-149`; existing browser/API/PGlite fixture.
- **Environment:** Browser/API/PGlite integration; preserve.

### PG-011-F001-A022-T001 — Preserve approval conflict and policy-snapshot checks

- **Layer / disposition / priority:** API / EXISTING COVERAGE SUFFICIENT / Critical.
- **Objective:** Preserve rejection of approval when covered attendance is already recorded or an overlapping attendance request exists, and revalidation against current policy assignment snapshots.
- **Preconditions and input:** Approved leave candidates with clock session, overnight interval, pending adjustment, changed policy/assignment or changed employee state.
- **Steps:** Invoke approve after each conflicting state; inspect 409 and saved state; verify valid adjacent interval succeeds.
- **Expected:** Conflict returns source-defined 409 without decision/status changes; current policy/employee constraints are rechecked; no false approval.
- **Existing coverage:** `leave-requests.test.ts:211-301,515-636,880-1092` and assignment/policy cases around lines 515 onward.
- **Evidence and dependencies:** `leave.service.ts:311-395,639-773`; `leave.repository.ts:162-206`; PGlite attendance fixtures.
- **Environment:** Isolated API/PGlite; preserve.

### PG-011-F001-A022-T002 — Preserve approved-leave downstream attendance effects

- **Layer / disposition / priority:** API / EXISTING COVERAGE SUFFICIENT / High.
- **Objective:** Preserve current/history/report/project-calendar values for approved leave and ensure terminal requests cease counting.
- **Preconditions and input:** Existing PGlite employee, policy and approved/cancelled/reversed requests with covered work date.
- **Steps:** Read personal/team history, records/report and project calendar before/after state transition.
- **Expected:** Only active APPROVED day snapshots affect required attendance; cancel/reverse removes coverage under current service semantics.
- **Existing coverage:** `leave-requests.test.ts:211-242,1100-1235` and downstream calendar assertion around 225-227.
- **Evidence and dependencies:** `leave.repository.ts:162-206`; attendance service/report and project calendar clients; existing PGlite fixture.
- **Environment:** Isolated API/PGlite.

### PG-011-F001-A023-T001 — Preserve endpoint authentication and record isolation

- **Layer / disposition / priority:** API / EXISTING COVERAGE SUFFICIENT / Critical.
- **Objective:** Preserve unauthenticated, inactive/deleted, USER, unsupported scope, foreign department, invalid UUID and cross-user access behavior for list/preview/detail/mutations.
- **Preconditions and input:** Existing authenticated and anonymous requests; requester, Head, outsider, ADMIN/SUPERADMIN with/without required permission; malformed/nonexistent IDs.
- **Steps:** Call each endpoint directly without relying on UI visibility; compare response and persisted state.
- **Expected:** Router auth and service actor/scope rules are enforced; hidden detail is non-disclosing; rejected requests do not write.
- **Existing coverage:** `leave-requests.test.ts:138-188,468-490,880-1092,1397-2120`; browser stale scope test `attendance.spec.ts:6844-6900`.
- **Evidence and dependencies:** `routes.ts:6-49`; `leave.service.ts:79-105,219-278,592-773`; API PGlite fixture.
- **Environment:** Isolated API/PGlite; retain existing protections.

### PG-011-F001-A024-T001 — Verify form, panel and responsive accessibility

- **Layer / disposition / priority:** Browser / NEW TEST REQUIRED / Medium.
- **Objective:** Verify accessible names/required states for search, date fields, reason and note; status announcement for preview; dialog/panel close labels and focus return; no horizontal overflow at 390/820/1440px.
- **Preconditions and input:** Authenticated mock page; request dialog, review panel and table opened in each viewport.
- **Steps:** Inspect roles/names/required attributes; use keyboard to open/close form and panel; measure page/table width against viewport; assert focus moves to source fallback trigger after panel close.
- **Expected:** Labels/status attributes match source; focus target exists and is reachable; content remains within viewport. Row-action keyboard assertion stays in A009-T002.
- **Existing coverage:** No focused Leave accessibility/responsive test found. Shared menu defect, PG-006 intermittency and PG-008 fixture limitation remain separate risks.
- **Evidence and dependencies:** `leave-request-dialog.tsx:61-179`; `leave-review-panel.tsx:53-217`; `leave-request-table.tsx:94-196`; existing Chromium Playwright project.
- **Environment:** Mocked Playwright at three fixed viewports; one worker initially.

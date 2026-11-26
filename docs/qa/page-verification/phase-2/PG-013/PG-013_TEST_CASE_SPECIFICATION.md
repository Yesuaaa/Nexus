# PG-013 Test Case Specification

## Counting and disposition

This inventory contains 35 unique stable case records. Every ID appears once. Cases classify the future action, not execution results. No automated test was run during Phase 2.1.

| Disposition                                | Case records |
| ------------------------------------------ | -----------: |
| NEW TEST REQUIRED                          |            4 |
| ADDITIONAL ASSERTION REQUIRED              |            8 |
| EXISTING COVERAGE SUFFICIENT               |           21 |
| CONTRACT CLARIFICATION REQUIRED            |            2 |
| Total unique cases                         |           35 |
| Implementable, excluding contract blockers |           33 |

Implementable cases by primary layer: Unit 1; API 6; Browser 5; Integration 21. Existing coverage-sufficient cases are included in implementable layer totals because their assertions must be preserved and reconciled. “New declaration” and “additive assertion group” are counts of planned changes, not the number of implementable case records.

## Route, navigation, scope, and initialization

### PG-013-F001-A001-T001 — Assert exact route policy for PG-013 roles

- Atomic feature / layer / objective: A001; Unit. Verify canonical PG-013 path access for the route-policy role matrix.
- Preconditions / inputs: active STAFF, active ADMIN, active SUPERADMIN with employees:read, inactive ADMIN, USER, and SUPERADMIN without employees:read; exact path /attendance/requests/overview.
- Steps: invoke canAccessRoute for each account/path pair in the existing attendance route-policy unit declaration.
- Expected: STAFF, ADMIN, and permitted SUPERADMIN are allowed; inactive and unsupported USER or unpermitted SUPERADMIN are denied, matching current helpers.
- Evidence: apps/web/src/features/auth/model/permissions.ts:92-116; apps/web/src/features/workspaces/model/route-policy.ts:352-386,423-447.
- Existing coverage: attendance.test.mjs:251-270 loops over STAFF, Head, USER, and unpermitted SUPERADMIN; it does not explicitly complete this exact-path matrix.
- Disposition / priority: ADDITIONAL ASSERTION REQUIRED / High.
- Environment / dependencies: mocked pure route-policy unit; reuse existing account objects and Permissions import.

### PG-013-F001-A001-T002 — Render the canonical route under staff access

- Atomic feature / layer / objective: A001; Browser. Preserve the direct route smoke and verify the source-defined heading and absence of manager toggle for non-manager staff.
- Preconditions / inputs: active basic STAFF test session; canonical PG-013 URL.
- Steps: sign in, navigate directly, wait for Requests & Approvals Overview, inspect toggle group.
- Expected: overview heading is visible and management toggle is absent for basic Staff.
- Evidence: route page; attendance.spec.ts:2992-3018.
- Existing coverage: exact grouped-attendance route declaration.
- Disposition / priority: EXISTING COVERAGE SUFFICIENT / High.
- Environment / dependencies: existing Browser/API/PGlite harness and Staff fixture.

### PG-013-F001-A002-T001 — Follow summary links to their canonical queues

- Atomic feature / layer / objective: A002; Browser. Verify the Overtime, Corrections, and Leave “View requests” links navigate to the static source-defined queue routes.
- Preconditions / inputs: authorized Head viewing PG-013; populated or empty summary is acceptable because links render independently.
- Steps: click View requests within Overtime, Corrections, then return and click View leave requests; verify each URL and destination heading.
- Expected: destinations are /attendance/requests/overtime, /attendance/requests/corrections, and /attendance/requests/leave. Do not assert that selected overview scope is transferred.
- Evidence: attendance-requests-overview-page.tsx:255-297,344-354; navigation.ts:56-72.
- Existing coverage: no PG-013 assertion directly follows these three links as a set.
- Disposition / priority: NEW TEST REQUIRED / Medium.
- Environment / dependencies: Browser/API/PGlite; existing Head session, routeAttendanceApi, queue fixtures.

### PG-013-F001-A003-T001 — Basic Staff defaults to personal scope

- Atomic feature / layer / objective: A003; Integration. Preserve default mine scope and hidden toggle for non-manager Staff.
- Preconditions / inputs: active basic Staff with Employee profile and seeded personal summary rows.
- Steps: navigate to page; observe summary API query and rendered totals; inspect toggle.
- Expected: requests use scope=mine; totals match the Staff mine API results; no management toggle is rendered.
- Evidence: page component:62-103; attendance.spec.ts:6767-6785, Staff branch.
- Existing coverage: exact role-loop declaration.
- Disposition / priority: EXISTING COVERAGE SUFFICIENT / High.
- Environment / dependencies: Browser/API/PGlite; existing Staff actor.

### PG-013-F001-A003-T002 — Head defaults to team and can switch scope

- Atomic feature / layer / objective: A003; Integration. Preserve Head team default, personal/team toggling, and independently scoped data.
- Preconditions / inputs: active Staff Head assigned to a department with team rows and a different personal count.
- Steps: load page; verify team totals; select My requests; verify mine totals; select Department requests; verify team totals.
- Expected: API scopes and displayed values follow the selected view; no obsolete scope result overwrites current data.
- Evidence: page component:62-103; attendance.spec.ts:6537-6609.
- Existing coverage: Head scope comparison and gated response declaration.
- Disposition / priority: EXISTING COVERAGE SUFFICIENT / High.
- Environment / dependencies: Browser/API/PGlite; Head, Staff, department assignment, gated responses.

### PG-013-F001-A003-T003 — ADMIN defaults to organization/team and can switch to mine

- Atomic feature / layer / objective: A003; Integration. Preserve ADMIN default scope, toggle, accessible labels, and personal read where profile exists.
- Preconditions / inputs: active ADMIN with employees:read and Employee profile; distinguish organization and personal counts.
- Steps: load page; assert Organization requests pressed; choose My requests; compare totals and API scope.
- Expected: initial team/organization summary, visible toggle with current aria-pressed state, and personal results after selection.
- Evidence: page component:64-88; attendance.spec.ts:6767-6785, Admin branch.
- Existing coverage: exact ADMIN role-loop branch.
- Disposition / priority: EXISTING COVERAGE SUFFICIENT / High.
- Environment / dependencies: Browser/API/PGlite; existing ADMIN session with Employee fixture.

### PG-013-F001-A003-T004 — SUPERADMIN receives team scope without personal toggle

- Atomic feature / layer / objective: A003; Integration. Preserve organization/team scope and current no-personal-toggle presentation.
- Preconditions / inputs: active SUPERADMIN with employees:read and no requirement for an Employee profile; organization-scoped rows.
- Steps: navigate to PG-013; assert team query, totals, and absence of personal toggle.
- Expected: authorized team summary renders; personal scope is not offered to this actor by the current page helpers.
- Evidence: permissions.ts:92-116; page component:64-88; attendance.spec.ts:6767-6785, SUPERADMIN branch.
- Existing coverage: exact SUPERADMIN role-loop branch.
- Disposition / priority: EXISTING COVERAGE SUFFICIENT / High.
- Environment / dependencies: Browser/API/PGlite; existing SUPERADMIN fixture and scoped rows.

### PG-013-F001-A003-T005 — Clarify profileless ADMIN toggle and recovery semantics

- Atomic feature / layer / objective: A003; Browser. Determine intended view-toggle visibility and recovery when ADMIN has no Employee profile.
- Preconditions / inputs: active ADMIN with employees:read but no Employee record; both team and mine selected.
- Steps: product owner first decides whether personal view is offered and expected user feedback; then assert the selected contract at UI and endpoint boundaries.
- Expected: unresolved. Current source allows personal view client-side; Attendance may respond 409 and Leave responds 403.
- Evidence: permissions.ts:111-116; attendance-requests-overview-page.tsx:64-88; attendance.service.ts:37-57; leave.service.ts:219-231; prior PG-006 409 finding.
- Existing coverage: no targeted PG-013 profileless ADMIN toggle assertion found.
- Disposition / priority: CONTRACT CLARIFICATION REQUIRED / High.
- Environment / dependencies: product decision; Browser/API/PGlite profileless ADMIN fixture. Excluded from implementable count.

### PG-013-F001-A004-T001 — Wait for both summary sources before combined metrics

- Atomic feature / layer / objective: A004; Integration. Verify independent source loading and combined-result completeness.
- Preconditions / inputs: Head team has data; delay Leave mine response while Attendance mine succeeds, then delay one source during a return to team.
- Steps: navigate; change to mine; gate one response; inspect section-level retained data and aggregate metrics; release response; change scope while both new responses are gated; inspect old and new scope.
- Expected: combined metrics remain unavailable until both selected-scope responses complete; an available sibling section may remain visible; stale scope totals do not return.
- Evidence: page component:105-120,161-196; attendance.spec.ts:6537-6609.
- Existing coverage: existing gated paired-source scenario.
- Disposition / priority: EXISTING COVERAGE SUFFICIENT / High.
- Environment / dependencies: Browser/API/PGlite; existing requestGate and holdOverview helpers.

## Aggregate calculations and section display

### PG-013-F001-A005-T001 — Verify combined top-line figures

- Atomic feature / layer / objective: A005; Integration. Preserve Pending, Awaiting HR, Approved, and Rejected totals across Attendance and Leave.
- Preconditions / inputs: mixed source groups including Attendance PENDING/VERIFIED and Leave SUBMITTED/VERIFIED/APPROVED/REJECTED.
- Steps: open Head team scope and compare each displayed figure with independently queried group totals.
- Expected: Leave SUBMITTED maps to Pending; adjustment PENDING adds to Pending; VERIFIED maps to Awaiting HR; Approved and Rejected combine as implemented.
- Evidence: page component:122-159,172-195; attendance.spec.ts:6895-6903,6946-6956.
- Existing coverage: WC-06-F03 helper and visible totals.
- Disposition / priority: EXISTING COVERAGE SUFFICIENT / High.
- Environment / dependencies: Browser/API/PGlite; WC-06 seeded groups and overviewTotals helper.

### PG-013-F001-A005-T002 — Assert Attendance summary response projection

- Atomic feature / layer / objective: A005; API. Add exact projection and aggregation assertions for Attendance summary groups.
- Preconditions / inputs: isolated PGlite department with one OVERTIME/PENDING row and one CORRECTION/VERIFIED row; authorized Head or ADMIN as appropriate.
- Steps: GET /attendance/adjustments/overview?scope=team; inspect group keys, type/status/count, overtimeMinutes, awaitingHrPending; compare counts and minutes with database aggregates.
- Expected: source-defined response fields and grouped values match stored records; omitted summary groups are not treated as a separate product response contract.
- Evidence: attendance.management.ts:1380-1414; routes.ts:101-103.
- Existing coverage: management.test.ts:1255-1334 checks a PENDING group count and total scope, not all projected fields.
- Disposition / priority: ADDITIONAL ASSERTION REQUIRED / High.
- Environment / dependencies: API/PGlite; reuse management test's account, department and Prisma fixture.

### PG-013-F001-A006-T001 — Verify all status rows and rounded shares

- Atomic feature / layer / objective: A006; Integration. Preserve six status rows, total consistency, rounded shares, and terminal Leave statuses.
- Preconditions / inputs: non-empty mixed overview with Pending 3, Verified 2, Approved 1, Rejected 1, Cancelled 1, Reversed 1 in current WC-06 fixture.
- Steps: reload after data setup; read each status row and percentage, plus Leave status table.
- Expected: all six rows display in fixed order; count sum is 9; rounded shares are 33%, 22%, 11%, 11%, 11%, and 11%; Leave table includes positive terminal rows.
- Evidence: page component:198-253; attendance.spec.ts:6957-6973.
- Existing coverage: WC-06-F03 exact row assertions.
- Disposition / priority: EXISTING COVERAGE SUFFICIENT / High.
- Environment / dependencies: Browser/API/PGlite; existing WC-06 fixture.

### PG-013-F001-A006-T002 — Verify sparse non-empty status denominator

- Atomic feature / layer / objective: A006; Integration. Add one-record boundary coverage for zero-count overall status rows.
- Preconditions / inputs: isolated Head team contains exactly one request in one supported status, with all other overall statuses absent.
- Steps: render page; inspect six status rows, numeric totals, percentage text, and InlineBar accessible labels.
- Expected: the populated row is 1 and 100%; every zero row is 0 and 0%; no divide-by-zero or NaN text appears.
- Evidence: page component:122-143,227-245.
- Existing coverage: F03 has positive values in all six status rows, so this boundary is absent.
- Disposition / priority: ADDITIONAL ASSERTION REQUIRED / Medium.
- Environment / dependencies: Browser/API/PGlite; add an isolated department/Head fixture to WC-06 without changing existing assertions.

### PG-013-F001-A007-T001 — Verify Overtime and Corrections section summaries

- Atomic feature / layer / objective: A007; Integration. Preserve per-type totals, positive status rows, and links.
- Preconditions / inputs: one OVERTIME and one CORRECTION group with differing statuses.
- Steps: load complete view; compare card totals and rows with API groups; locate link names.
- Expected: each card shows only its type total and nonzero status rows; target hrefs remain source-defined.
- Evidence: page component:255-342; attendance.spec.ts:6946-6979.
- Existing coverage: WC-06-F03 checks per-type totals and related status/attention grouping.
- Disposition / priority: EXISTING COVERAGE SUFFICIENT / High.
- Environment / dependencies: Browser/API/PGlite; existing WC-06 fixture.

### PG-013-F001-A007-T002 — Clarify whether summary scope follows queue links

- Atomic feature / layer / objective: A007; Integration. Resolve the expected scope state after following a queue link.
- Preconditions / inputs: manager selects My or team view then follows Overtime, Corrections, or Leave link.
- Steps: product owner specifies whether destination receives scope and behavior on reload; then add the contract-specific assertion.
- Expected: unspecified; current hrefs are static and omit scope.
- Evidence: page component:255-297,344-354.
- Existing coverage: navigation to these destinations is not asserted as scope propagation.
- Disposition / priority: CONTRACT CLARIFICATION REQUIRED / Medium.
- Environment / dependencies: product decision; Browser/API fixture. Excluded from implementable count.

### PG-013-F001-A008-T001 — Verify Leave status breakdown and terminal states

- Atomic feature / layer / objective: A008; Integration. Preserve Leave totals and visible positive status rows including Cancelled and Reversed.
- Preconditions / inputs: Leave groups across SUBMITTED, VERIFIED, APPROVED, REJECTED, CANCELLED, REVERSED.
- Steps: open team scope; compare Leave rows and total with API data; inspect terminal statuses.
- Expected: Leave total matches all groups and only positive groups render, including source-supported terminal statuses.
- Evidence: page component:122-132,344-391; attendance.spec.ts:6965-6973,7057-7062.
- Existing coverage: WC-06-F03 exact Leave rows and terminal-status checks.
- Disposition / priority: EXISTING COVERAGE SUFFICIENT / High.
- Environment / dependencies: Browser/API/PGlite; existing Leave decision helpers and WC-06 data.

### PG-013-F001-A008-T002 — Assert Leave summary grouped projection

- Atomic feature / layer / objective: A008; API. Add exact status/type/count assertions for the Leave overview endpoint.
- Preconditions / inputs: team contains one SUBMITTED/ANNUAL and one APPROVED/SICK record; unrelated department has a matching-looking record.
- Steps: GET /leave/overview?scope=team as Head; compare each response group with database rows; repeat personal scope for owner where appropriate.
- Expected: response groups have status, type, and count; team and personal counts follow current scope.
- Evidence: leave.service.ts:610-634; leave/routes.ts:17-19.
- Existing coverage: leave-requests.test.ts:1842-1865 checks SUBMITTED/ANNUAL count only within a transfer workflow.
- Disposition / priority: ADDITIONAL ASSERTION REQUIRED / High.
- Environment / dependencies: API/PGlite; extend leave-requests.test.ts fixture and preserve pendingLeaveQueue assertions.

### PG-013-F001-A009-T001 — Verify Needs attention inclusion rules

- Atomic feature / layer / objective: A009; Integration. Preserve Attendance and Leave pending/verification inclusion and labels.
- Preconditions / inputs: at least one adjustment PENDING, one adjustment VERIFIED, one Leave SUBMITTED, one Leave VERIFIED, plus terminal statuses.
- Steps: compare displayed definition list and awaiting total with API groups.
- Expected: only PENDING/VERIFIED adjustments and SUBMITTED/VERIFIED Leave contribute; verified groups say awaiting HR and submitted/pending groups say pending.
- Evidence: page component:150-159,393-427; attendance.spec.ts:6914-6917,6974-6979.
- Existing coverage: WC-06-F03 asserts combined attention rows and total.
- Disposition / priority: EXISTING COVERAGE SUFFICIENT / High.
- Environment / dependencies: Browser/API/PGlite; existing WC-06 fixture.

### PG-013-F001-A010-T001 — Preserve overall zero-data empty state

- Atomic feature / layer / objective: A010; Integration. Preserve zero total, no overall table, and no awaiting decision message.
- Preconditions / inputs: Head personal scope with no matching requests and both endpoints succeed.
- Steps: select My requests; inspect Request status and Needs attention.
- Expected: 0 total, source-defined empty message, no status table, 0 awaiting, and source-defined no-awaiting-decision message.
- Evidence: page component:198-213,393-408; attendance.spec.ts:6981-6993.
- Existing coverage: WC-06-F03 empty Head mine assertions.
- Disposition / priority: EXISTING COVERAGE SUFFICIENT / Medium.
- Environment / dependencies: Browser/API/PGlite; existing Head personal empty scope.

### PG-013-F001-A010-T002 — Assert each per-section empty state

- Atomic feature / layer / objective: A010; Integration. Add explicit Overtime, Corrections, and Leave empty messages when only other categories exist or no section rows exist.
- Preconditions / inputs: complete responses with empty type/category groups; include zero adjustment groups and zero Leave groups.
- Steps: render empty scope; inspect the three cards and their tables/message content.
- Expected: Overtime and Corrections show “No requests in this scope.”; Leave shows “No leave requests in this scope.”; no empty table is rendered.
- Evidence: page component:283-310,312-338,344-366.
- Existing coverage: current F03 verifies overall status and attention empty state, not each card's empty copy.
- Disposition / priority: ADDITIONAL ASSERTION REQUIRED / Medium.
- Environment / dependencies: Browser/API/PGlite; add scoped empty actor or department to WC-06 setup.

## Denial, recovery, async lifecycle, and read-only behavior

### PG-013-F001-A011-T001 — Retry after Leave 503

- Atomic feature / layer / objective: A011; Integration. Preserve Leave-only failure/recovery.
- Preconditions / inputs: Head team scope; first Leave summary response is 503; Attendance response succeeds.
- Steps: render, verify Leave error and hidden Leave total, then click Retry and allow Leave response to succeed.
- Expected: combined figures remain unavailable during failure; successful sibling count remains visible; retry restores complete totals.
- Evidence: page component:110-119,161-170,344-366; attendance.spec.ts:6688-6765, Leave branch.
- Existing coverage: current parameterized browser declaration.
- Disposition / priority: EXISTING COVERAGE SUFFICIENT / High.
- Environment / dependencies: Browser with one mocked 503 and real Express/PGlite sibling/retry.

### PG-013-F001-A011-T002 — Retry after Attendance 503

- Atomic feature / layer / objective: A011; Integration. Preserve adjustment-only failure/recovery.
- Preconditions / inputs: Head team scope; adjustment response is 503; Leave succeeds.
- Steps: render, verify adjustment section error and hidden total; confirm Leave section count; retry.
- Expected: combined figures unavailable until recovery; Leave section remains visible; complete totals return after retry.
- Evidence: page component:106-119,161-170,255-342; attendance.spec.ts:6688-6765, adjustments branch.
- Existing coverage: current parameterized browser declaration.
- Disposition / priority: EXISTING COVERAGE SUFFICIENT / High.
- Environment / dependencies: Browser with one mocked 503 and real Express/PGlite sibling/retry.

### PG-013-F001-A011-T003 — Retry after both summaries return 503

- Atomic feature / layer / objective: A011; Integration. Preserve simultaneous error and retry of both sources.
- Preconditions / inputs: first Attendance and Leave responses are 503.
- Steps: render; verify both section failures and unavailable combined summary; click Retry; allow both sources to complete.
- Expected: both retry requests are issued and successful data repopulates all summaries.
- Evidence: page component:161-170; attendance.spec.ts:6688-6765, both-source branch.
- Existing coverage: current parameterized browser declaration.
- Disposition / priority: EXISTING COVERAGE SUFFICIENT / High.
- Environment / dependencies: Browser with two mocked 503 responses and real Express/PGlite retry.

### PG-013-F001-A011-T004 — Hide summary after one endpoint returns 401

- Atomic feature / layer / objective: A011; Integration. Preserve denial precedence over successful sibling response.
- Preconditions / inputs: Head personal scope; Leave request lacks Authorization and returns 401; Attendance succeeds.
- Steps: change scope; await both responses; inspect alert, combined summary, and all totals.
- Expected: authentication alert is visible and no current or old count is exposed after denial.
- Evidence: page component:47-52,114-119; attendance.spec.ts:6660-6686.
- Existing coverage: direct real API 401 case.
- Disposition / priority: EXISTING COVERAGE SUFFICIENT / Critical.
- Environment / dependencies: Browser/API/PGlite; request interception removes authorization for one call.

### PG-013-F001-A011-T005 — Clear team data after Head authorization is revoked

- Atomic feature / layer / objective: A011; Integration. Preserve data removal on real 403 from both team endpoints.
- Preconditions / inputs: Head initially has team data and is assigned to department; while personal request is pending, remove Head assignment.
- Steps: select team; await both real endpoint responses; inspect error alert, summary unavailable state, and section totals.
- Expected: both responses are 403 and previously visible team totals are not retained.
- Evidence: attendance.spec.ts:6611-6658; Attendance/Leave scope source references in functional discovery.
- Existing coverage: exact scope-revocation declaration; it restores fixture authority in finally.
- Disposition / priority: EXISTING COVERAGE SUFFICIENT / Critical.
- Environment / dependencies: Browser/API/PGlite; Admin department update and real Head scope enforcement.

### PG-013-F001-A011-T006 — Recover after Head scope is restored

- Atomic feature / layer / objective: A011; Integration. Add retry recovery after authorization is restored.
- Preconditions / inputs: same revoked-Head case; restore department Head relationship after both endpoints returned 403.
- Steps: restore authority; activate Retry; wait for both team requests; inspect team counts.
- Expected: successful reread replaces the denial state with current authorized totals; no stale personal/team mix is shown.
- Evidence: page component:161-170; current denial case attendance.spec.ts:6611-6658 restores fixture in finally but does not retry.
- Existing coverage: authorization restoration is cleanup only; post-restore page recovery is absent.
- Disposition / priority: ADDITIONAL ASSERTION REQUIRED / High.
- Environment / dependencies: Browser/API/PGlite; restructure the existing case with guaranteed cleanup and keep its denial assertions intact.

### PG-013-F001-A012-T001 — Ignore obsolete scope response

- Atomic feature / layer / objective: A012; Integration. Preserve stale response guard across a quick scope change.
- Preconditions / inputs: current Head summary; gate one scope response, switch twice, then release out of order.
- Steps: exercise My and Department scope controls; release old request after newer scope has rendered; compare visible totals with current API scope.
- Expected: obsolete result does not overwrite the currently selected scope.
- Evidence: use-async-resource.ts:11-87; attendance.spec.ts:6537-6609,6995-7006.
- Existing coverage: existing gated Head scope cases.
- Disposition / priority: EXISTING COVERAGE SUFFICIENT / High.
- Environment / dependencies: Browser/API/PGlite; existing request gates.

### PG-013-F001-A012-T002 — Leave and revisit with requests pending

- Atomic feature / layer / objective: A012; Browser. Add page unmount/revisit coverage for abort and stale response handling.
- Preconditions / inputs: gate one pending response; navigate away from PG-013; release old response; revisit with a distinct scope/account response.
- Steps: record the old request, leave route, resolve it, return to page, and wait for current response.
- Expected: old response does not render into the remounted page and no unhandled stale state is visible; new values match current request.
- Evidence: attendance-requests-overview-page.tsx:91-100; use-async-resource.ts:11-87.
- Existing coverage: scope-stale tests exist; page-unmount/revisit is not directly asserted.
- Disposition / priority: NEW TEST REQUIRED / Medium.
- Environment / dependencies: mocked Playwright route gates; ensure deterministic response release and no arbitrary sleeps.

### PG-013-F001-A013-T001 — Browsing and switching scope performs no writes

- Atomic feature / layer / objective: A013; Integration. Preserve read-only dashboard behavior.
- Preconditions / inputs: seeded request rows, notification rows, and audit snapshot; Staff Head with toggle.
- Steps: snapshot rows/notifications; navigate, toggle scopes, wait for summaries, and snapshot again; track non-GET calls.
- Expected: no non-GET request from the page and persisted requests, notifications, and audit records remain unchanged.
- Evidence: page component:62-120; attendance.spec.ts:6540-6609,6858-6869,6945-6946,7068-7069.
- Existing coverage: both WC-06 paired-scope and full-lifecycle cases track writes/snapshots.
- Disposition / priority: EXISTING COVERAGE SUFFICIENT / High.
- Environment / dependencies: Browser/API/PGlite; preserve snapshot and request tracking assertions.

## API contract and access cases

### PG-013-F001-A014-T001 — Preserve Attendance summary scope and aggregation

- Atomic feature / layer / objective: A014; API. Preserve multi-record mine/team count, Staff/Head restrictions, invalid scope, and scoped total.
- Preconditions / inputs: 27 PENDING/CORRECTION rows for Staff actor; no Head assignment initially, then assigned department.
- Steps: call team as Staff and Head before assignment; call invalid scope as Admin; call mine as owner; assign Head and call team; compare database count.
- Expected: current 403/400/200 boundaries and grouped counts remain source-defined; department aggregate equals scoped DB count.
- Evidence: management.test.ts:1255-1334; adjustmentScope and adjustmentOverview source in attendance.management.ts:358-373,1380-1414.
- Existing coverage: exact nested summary declaration.
- Disposition / priority: EXISTING COVERAGE SUFFICIENT / Critical.
- Environment / dependencies: API/PGlite; preserve 27-row and scope fixtures.

### PG-013-F001-A014-T002 — Add Attendance query and auth boundaries

- Atomic feature / layer / objective: A014; API. Add default-scope, unknown-key, anonymous, and USER assertions.
- Preconditions / inputs: employee-backed Staff owner; anonymous request; USER session; authenticated request with unknown parameter; omitted scope.
- Steps: issue GET summary for each variant; inspect HTTP status and response shape; compare omitted-scope result with mine.
- Expected: omitted scope uses personal scope; unknown query is rejected by allowlist; anonymous is 401; unsupported USER is denied; no unauthorized group data is returned.
- Evidence: attendance.routes.ts:11-16,101-103; attendance.management.ts:1380-1414, adjustmentScope 358-373; current summary test covers invalid scope but not this matrix.
- Existing coverage: management.test.ts:1255-1334 and superadmin.test.ts:202-259 cover subsets only.
- Disposition / priority: ADDITIONAL ASSERTION REQUIRED / Critical.
- Environment / dependencies: API/PGlite; extend management.test.ts with anonymous and USER tokens.

### PG-013-F001-A015-T001 — Preserve Leave team count through reviewer transfer

- Atomic feature / layer / objective: A015; API. Preserve source-of-truth grouped count used by transfer/revocation workflow.
- Preconditions / inputs: submitted ANNUAL Leave request; old and receiving Head; both department assignments in isolated PGlite.
- Steps: query team overview before and after transfer using the existing helper; compare submittedAnnual count and queue entry authority.
- Expected: current Head-scoped count and workflow queue reflect source-defined transfer behavior.
- Evidence: leave-requests.test.ts:1842-1865 and call sites at 2003-2026,2099-2126.
- Existing coverage: helper asserts the overview status, reads SUBMITTED/ANNUAL group, and is used across transfer/revocation.
- Disposition / priority: EXISTING COVERAGE SUFFICIENT / High.
- Environment / dependencies: API/PGlite; preserve Leave transfer and department fixture assertions.

### PG-013-F001-A015-T002 — Add Leave query and auth boundaries

- Atomic feature / layer / objective: A015; API. Add strict scope, unknown-query, anonymous, USER, and Staff-without-Head denial checks.
- Preconditions / inputs: anonymous caller, USER, ordinary Staff, Staff Head, valid ADMIN/SUPERADMIN, missing scope, invalid scope, and extra query parameter.
- Steps: GET /leave/overview for each case; inspect status and ensure rejected responses contain no groups.
- Expected: valid mine/team access follows actor scope; missing/invalid or unknown query is rejected; anonymous gets 401; unsupported/unauthorized actors get 403 with no summary groups.
- Evidence: leave/routes.ts:6-19; leave.service.ts:79-92,219-258,610-634.
- Existing coverage: leave-requests.test.ts:1842-1865 checks a valid Head team read, but no direct full query/auth matrix was found.
- Disposition / priority: ADDITIONAL ASSERTION REQUIRED / Critical.
- Environment / dependencies: API/PGlite; extend leave-requests.test.ts with role and scope fixtures.

## Accessibility and responsive cases

### PG-013-F001-A016-T001 — Use view toggle by keyboard

- Atomic feature / layer / objective: A016; Browser. Verify labeled group and native keyboard activation.
- Preconditions / inputs: Head or ADMIN account for which toggle is visible.
- Steps: navigate by Tab to Request summary view; inspect accessible group and button names; use Space or Enter to switch; inspect aria-pressed and updated totals.
- Expected: group name is Request summary view; buttons are named; exactly the selected view reports aria-pressed=true; scope data changes after activation.
- Evidence: page component:71-89; management-view-toggle.tsx; overview-panel.tsx:198-263.
- Existing coverage: WC-06-F01 uses role locators and asserts pressed state for ADMIN but does not operate it by keyboard.
- Disposition / priority: NEW TEST REQUIRED / Medium.
- Environment / dependencies: mocked or Browser/API/PGlite; use keyboard and role locators, avoid direct DOM handlers.

### PG-013-F001-A017-T001 — Verify responsive overview layout

- Atomic feature / layer / objective: A017; Browser. Add viewport coverage for summary sections and controls.
- Preconditions / inputs: authorized manager with data; viewports 390, 820, and 1440 CSS pixels.
- Steps: set each viewport; load complete summary; inspect named sections, cards, toggle, links, and document scroll width.
- Expected: essential controls and named sections remain reachable; no page-level horizontal overflow at these tested sizes. This is a proposed layout quality check, not a source-defined numeric guarantee.
- Evidence: page component:255-256,410-415; overview-panel.tsx:198-263.
- Existing coverage: no PG-013 responsive browser measure found; PG-006 820 px intermittency is a separate historical issue.
- Disposition / priority: NEW TEST REQUIRED / Medium.
- Environment / dependencies: Chromium Playwright; stable seeded summary; single worker for the serial attendance fixture.

## Reconciled counts

| Primary layer, implementable records only |  Count | Case IDs                                                                                                                                                            |
| ----------------------------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                                      |      1 | A001-T001                                                                                                                                                           |
| API                                       |      6 | A005-T002; A008-T002; A014-T001, T002; A015-T001, T002                                                                                                              |
| Browser                                   |      5 | A001-T002; A002-T001; A012-T002; A016-T001; A017-T001                                                                                                               |
| Integration                               |     21 | A003-T001 through T004; A004-T001; A005-T001; A006-T001 and T002; A007-T001; A008-T001; A009-T001; A010-T001 and T002; A011-T001 through T006; A012-T001; A013-T001 |
| **Total implementable**                   | **33** | Contract cases A003-T005 and A007-T002 are excluded.                                                                                                                |

The eight additive assertion groups are A001-T001, A005-T002, A006-T002, A008-T002, A010-T002, A011-T006, A014-T002, and A015-T002. New declarations are A002-T001, A012-T002, A016-T001, and A017-T001. Twenty-one cases are existing-sufficient; two are blocked on contract clarification. Disposition counts reconcile to 4 + 8 + 21 + 2 = 35.

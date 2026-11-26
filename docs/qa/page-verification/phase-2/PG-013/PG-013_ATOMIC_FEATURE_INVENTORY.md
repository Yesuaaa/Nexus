# PG-013 Atomic Feature Inventory

Page: PG-013-F001, /attendance/requests/overview.

Each behavior is traced to the present source. “No mutation” means the page does not write; it does not assert that unrelated destination queues are read-only.

## PG-013-F001-A001 — Route access and initialization

- Actor: authenticated active Attendance-access account.
- UI trigger: direct URL, Attendance navigation entry, or route link.
- Handler: route wrapper renders AttendanceRequestsOverviewPage; shared PortalLayout/RoleLayout enforces account and route policy.
- Preconditions: authenticated portal account; active STAFF/ADMIN or SUPERADMIN with employees:read, subject to shared policy.
- Validation/state: route policy checks access; route itself has no form state. Denied access follows shared route handling.
- API: summary requests begin after account context is available.
- Authorization/persistence: frontend route policy plus independent backend requireAuth and endpoint scope. No persistence write.
- Success/failure: page shell and allowed view render; denied actors do not receive the page through the route policy.
- Evidence: app/(portal)/attendance/requests/overview/page.tsx:1-4; components/layout/portal-layout.tsx:21-33,67-92; features/workspaces/model/route-policy.ts:352-386,423-447; features/auth/model/permissions.ts:92-116.

## PG-013-F001-A002 — Attendance navigation and queue links

- Actor: page viewer.
- UI trigger: Requests & Approvals navigation group, or one of the three View requests links.
- Handler: navigation hrefs and Next Link controls; no page-specific data handler.
- Preconditions: route access for the destination.
- Validation/state: no query or selected overview scope is appended to static destination hrefs.
- API/persistence: no write; destination pages issue their own requests.
- Success/failure: links target Overview, Overtime, Corrections, or Leave. Scope carry-through is unspecified.
- Evidence: features/attendance/model/navigation.ts:43-72; attendance-requests-overview-page.tsx:255-297,344-354.

## PG-013-F001-A003 — Initial scope and management-view toggle

- Actor: non-manager staff, Staff Head, ADMIN, or eligible SUPERADMIN.
- UI trigger: Request summary view group buttons.
- Handler: AttendanceRequestsOverviewPage stores mine with setMine; scope is derived from manager, personal-access helper, and mine state.
- Preconditions: canManageAttendance and canAccessPersonalAttendance decide toggle visibility.
- Validation/state: non-manager starts mine; manager starts team. Staff Head and eligible ADMIN can select personal/team; eligible SUPERADMIN without personal access receives team with no toggle.
- API: both summary APIs receive the computed scope. Key includes account ID, role, Head department, and scope.
- Authorization/persistence: both backend endpoints independently enforce scope; no writes.
- Success/failure: scope changes remount summaries and trigger reads. Profileless ADMIN toggle semantics are unresolved because the UI helper permits personal view without requiring Employee identity.
- Evidence: attendance-requests-overview-page.tsx:62-103; permissions.ts:92-116; route-policy.ts:352-386.

## PG-013-F001-A004 — Paired summary initialization and completeness

- Actor: authorized page viewer.
- UI trigger: route mount or scope/account change.
- Handler: RequestSummaries invokes useRequestSummary twice, once per domain.
- Preconditions: valid selected scope and API session.
- Validation/state: combined figures require both data objects. While either source is pending, aggregate figures are loading; one successful sibling may retain its own section data, while combined totals remain unavailable.
- API: Attendance adjustment summary and Leave overview, each with AbortSignal.
- Authorization/persistence: each endpoint separately enforces auth and scope; read-only.
- Success/failure: both responses enable combined calculations. A denial withholds all displayed counts; non-auth errors expose unavailable/error feedback and retry.
- Evidence: attendance-requests-overview-page.tsx:105-120,161-196; use-async-resource.ts:11-87.

## PG-013-F001-A005 — Combined summary figures

- Actor: authorized page viewer.
- UI trigger: automatic render after paired data is complete.
- Handler: RequestSummaries builds leaveCounts, requestCounts, total, and figures.
- Preconditions: both endpoints return their groups.
- Validation/state: Leave SUBMITTED maps to Pending; PENDING adjustment contributes to Pending; VERIFIED contributes to Awaiting HR; APPROVED and REJECTED combine across domains.
- API/persistence: read-only data from A014/A015.
- Success/failure: Pending, Awaiting HR, Approved, and Rejected show counts; incomplete data displays em dashes for aggregate values.
- Evidence: attendance-requests-overview-page.tsx:122-159,172-195.

## PG-013-F001-A006 — Overall status distribution and share

- Actor: authorized page viewer.
- UI trigger: automatic render of Request status.
- Handler: Object.entries(requestCounts), total reduction, InlineBar and rounded share formatting.
- Preconditions: complete paired data.
- Validation/state: fixed six-status order; a nonzero total renders all six rows, including zero-count rows. Percentage is Math.round(count / total * 100). A zero total renders an empty message instead of a table.
- API/persistence: read-only A014/A015 aggregates.
- Success/failure: counts and rounded shares reflect current response groups; incomplete data shows unavailable state.
- Evidence: attendance-requests-overview-page.tsx:122-143,198-253.

## PG-013-F001-A007 — Overtime and Corrections summaries

- Actor: authorized page viewer.
- UI trigger: automatic render; View requests link for navigation.
- Handler: groups filtered by type and status; static Next Link.
- Preconditions: Attendance response available for those sections.
- Validation/state: cards total OVERTIME and CORRECTION groups; only nonzero type/status rows are shown.
- API/persistence: Attendance summary GET; no mutation.
- Success/failure: section total and rows render, or section-specific empty/unavailable/loading feedback.
- Evidence: attendance-requests-overview-page.tsx:255-342.

## PG-013-F001-A008 — Leave summary

- Actor: authorized page viewer.
- UI trigger: automatic render; View leave requests link.
- Handler: leaveCount and leaveRows aggregation plus Next Link.
- Preconditions: Leave overview response available.
- Validation/state: counts by status; only statuses with positive count are rendered.
- API/persistence: Leave overview GET; no mutation.
- Success/failure: total/table, or Leave-specific loading/empty/unavailable feedback.
- Evidence: attendance-requests-overview-page.tsx:122-132,344-391.

## PG-013-F001-A009 — Needs attention summary

- Actor: authorized page viewer.
- UI trigger: automatic render after paired summaries.
- Handler: attention combines adjustment PENDING/VERIFIED with Leave SUBMITTED/VERIFIED.
- Preconditions: complete paired summary data.
- Validation/state: PENDING/SUBMITTED text is “pending”; VERIFIED text is “awaiting HR”.
- API/persistence: A014/A015 read-only aggregates.
- Success/failure: nonzero attention groups display as definition list; zero attention shows source-defined no-awaiting-decision copy; incomplete data shows unavailable.
- Evidence: attendance-requests-overview-page.tsx:150-159,393-427.

## PG-013-F001-A010 — Empty data and section empty states

- Actor: authorized viewer whose selected scope has no matching records or no records in one section.
- UI trigger: automatic rendering of zero aggregates.
- Handler: total and per-section zero checks.
- Preconditions: complete response groups, possibly empty.
- Validation/state: overall total zero suppresses status table; Overtime, Corrections, Leave, and Needs attention have separate empty copy.
- API/persistence: read-only aggregates; zero rows are valid.
- Success/failure: show the implemented empty state; no empty-state wording contract beyond current source has been approved.
- Evidence: attendance-requests-overview-page.tsx:198-213,283-310,344-366,393-408.

## PG-013-F001-A011 — Authentication denial, request error, and retry

- Actor: page viewer with expired/invalid session, revoked scope, or failed service.
- UI trigger: automatic API request and shared Retry button after an error.
- Handler: useRequestSummary maps ApiError 401/403 to denial; RequestSummaries combines resource state and calls retry for affected resource(s).
- Preconditions: one or both summary APIs fail.
- Validation/state: denial wins over success and hides summary data; non-denial failure makes combined data incomplete and section feedback source-specific.
- API/persistence: endpoint responses; reads only.
- Success/failure: 401/403 displays role/auth alert; retryable failures show Retry and a subsequent successful request repopulates summaries.
- Evidence: attendance-requests-overview-page.tsx:38-59,114-119,161-170; attendance-shared.tsx:11-39.

## PG-013-F001-A012 — Stale response and request lifecycle

- Actor: viewer changing view or leaving the route while requests are pending.
- UI trigger: change scope/account context, then response arrival or unmount.
- Handler: keyed RequestSummaries plus useAsyncResource abort/stale guard.
- Preconditions: at least one in-flight summary request.
- Validation/state: obsolete resources do not become current display state; new scope uses new requests.
- API/persistence: GET only; no writes.
- Success/failure: current view remains aligned with current scope; cancellation is internal and has no user copy.
- Evidence: attendance-requests-overview-page.tsx:91-100; use-async-resource.ts:11-87.

## PG-013-F001-A013 — Read-only dashboard invariant

- Actor: any page viewer.
- UI trigger: mount, toggle scope, refresh/retry, navigate.
- Handler: page handlers issue GET requests and change local scope state; no submit or mutation handler exists.
- Preconditions: none beyond route access.
- Validation/state: no persistent state transition is initiated by the overview itself.
- API/persistence: GET /attendance/adjustments/overview and GET /leave/overview only.
- Success/failure: summary display changes with scope/results; backend rows, notices, and audit history are not mutated by browsing this page.
- Evidence: attendance-requests-overview-page.tsx:62-120; attendance-api.ts:460-468; leave-api.ts:103-107.

## PG-013-F001-A014 — Attendance adjustment summary API

- Actor: authenticated eligible employee/head/management account.
- UI trigger: page summary request.
- Handler: attendanceRequestSummary → GET route → adjustmentOverview.
- Preconditions: active actor and mine/team scope rules.
- Validation/state: query allowlist contains scope; invalid values return 400. Missing scope follows the personal path. Personal scope resolves caller Employee; team uses managementScope and ADMIN HR filtering.
- Authorization/persistence: Attendance router requireAuth; read-only RepeatableRead transaction and groupBy type/status; model AttendanceAdjustment.
- Success/failure: groups contain type/status/count/overtimeMinutes/awaitingHrPending; service-specific auth/scope errors are mapped through Express.
- Evidence: attendance-api.ts:460-468; attendance/routes.ts:11-16,101-103; attendance.management.ts:358-373,1380-1414; attendance.service.ts:27-57.

## PG-013-F001-A015 — Leave summary API

- Actor: authenticated active STAFF Head, ADMIN with employees:read, or SUPERADMIN with employees:read, within supported scope.
- UI trigger: page summary request.
- Handler: leaveOverview → GET route → overview service.
- Preconditions: explicit mine/team scope; active non-USER actor; Employee or Head/permission relationship as required.
- Validation/state: query allowlist contains scope; absent/invalid scope returns 400. Mine without Employee and unauthorized team access return 403. ADMIN pending submissions are limited by submittedLeaveFallbackScope.
- Authorization/persistence: Leave router requireAuth; read-only RepeatableRead transaction and groupBy status/type on LeaveRequest.
- Success/failure: groups contain status/type/count; denial or validation errors are mapped to response status and handled by A011.
- Evidence: leave-api.ts:103-107; leave/routes.ts:6-19; leave.service.ts:79-92,219-258,610-634.

## PG-013-F001-A016 — Accessible controls and summary semantics

- Actor: keyboard or assistive-technology user.
- UI trigger: focus and activate scope buttons, links, retry button; navigate section/table content.
- Handler: native button/Link behavior; no custom key handler.
- Preconditions: control is rendered for the current account/state.
- Validation/state: toggle group has accessible label and buttons report aria-pressed; common sections/headings and chart accessible names are provided by shared components.
- API/persistence: same read-only requests as A003/A004.
- Success/failure: buttons remain keyboard-operable by native semantics; errors use shared status/alert semantics.
- Evidence: attendance-requests-overview-page.tsx:71-89; components/layout/management-view-toggle.tsx; components/ui/overview-panel.tsx:198-263; attendance-shared.tsx:11-39.

## PG-013-F001-A017 — Responsive presentation

- Actor: page viewer at supported viewport sizes.
- UI trigger: render and viewport resize.
- Handler: responsive Tailwind grid and flex classes; no JS resize state.
- Preconditions: page access and summary data.
- Validation/state: two summary cards use a large-screen grid; attention items stack at narrow widths.
- API/persistence: no change.
- Success/failure: content remains presented through CSS breakpoints; no contractual overflow threshold is declared in source.
- Evidence: attendance-requests-overview-page.tsx:255-256,410-415; components/ui/overview-panel.tsx:198-263.

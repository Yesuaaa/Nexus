# PG-008 Atomic Feature Inventory

## Scope

IDs preserve the approved Phase 1 PG-008 identifier and functionality cluster PG-008-F001. Each item describes one independently testable source-backed behavior. Roles below are active ADMIN or SUPERADMIN with employees:manage unless the item explicitly describes a denied actor. API role checks remain independent from portal navigation.

## Features

### PG-008-F001-A001 — Canonical route, navigation, and frontend access

- Actor: active ADMIN/SUPERADMIN with employees:manage; other account states are route-denied.
- Trigger: open /attendance/policies/management directly or select Attendance > Policies > Management. /attendance/settings is a redirect alias.
- Implementation/state: Next page renders AttendanceSettingsPage inside the portal; portal route policy uses canConfigureAttendance; navigation link has access configure.
- Validation/access: active privileged account and employee-management permission; separate from API authorization.
- API/data: no request is required to decide whether the portal route is accessible; on success the directory loads through A002.
- Outcome/failure: allowed accounts render the page; denied routes follow shared portal denial routing.
- Evidence: apps/web/src/app/(portal)/attendance/policies/management/page.tsx:1-5; apps/web/src/app/(portal)/attendance/settings/page.tsx:1-5; apps/web/src/features/workspaces/model/route-policy.ts:341-379,438-442,739-744; apps/web/src/features/auth/model/permissions.ts:118-124; apps/web/src/features/attendance/model/navigation.ts:61-84.

### PG-008-F001-A002 — Initial policy directory load and recovery

- Actor/trigger: authorized manager enters page or retries a failed request.
- Implementation/state: AttendanceSettingsPage calls usePaginatedList at page 1, active status, size 10, empty search; loading, data, error, and retry are provided by the hook.
- Validation: response must conform to the typed page contract; API validates page, search, status, and size.
- API/access: GET /api/attendance/policies; requireAuth plus employees:manage.
- Data/outcome: AttendancePolicy rows include seven ordered days and assignment counts; initial pending state renders five skeleton rows and aria-busy; empty active state has explicit copy; failure exposes retry.
- Evidence: attendance-settings-page.tsx:105-123,208-279; use-paginated-list.ts:26-45,151-190; attendance-api.ts:283-307; routes.ts:16,35-37; attendance.management.ts:795-861; schema.prisma:1474-1498.

### PG-008-F001-A003 — Search policies by name or timezone

- Actor/trigger: authorized manager types in Search attendance policies.
- Implementation/state: input maxLength 100; query is trimmed/lowercased; setPage(1); request waits for debounced query and local preview matches name or timezone.
- API: GET /policies?page=&size=10&status=&search=; backend accepts a query up to 100 characters and performs case-insensitive matching on name and timeZone.
- Outcome/failure: matches are shown; no match uses SearchEmptyState; failed request follows A002 retry.
- Evidence: attendance-settings-page.tsx:105-123,181-191,271-279; use-paginated-list.ts:107-127,151-190; attendance.management.ts:795-821.

### PG-008-F001-A004 — Switch active and archived directory views

- Actor/trigger: manager selects Active policies or Archived policies.
- Implementation/state: switchView resets page 1 and clears search, then changes status.
- API: GET /policies with status active or archived; backend filters archivedAt null/not-null.
- Outcome: rows and empty-state copy reflect selected view.
- Evidence: attendance-settings-page.tsx:132-137,192-201,271-279; attendance.management.ts:812-821.

### PG-008-F001-A005 — Paginate and retain stable server ordering

- Actor/trigger: manager uses Attendance policy pages footer.
- Implementation/state: TablePaginationFooter sets usePaginatedList page; list fetch aborts prior request and clamps a page if total shrinks.
- API: page and size=10; backend order is createdAt descending then id descending.
- Outcome/failure: one page is displayed, footer counts match current total, out-of-range page settles to the last valid page.
- Evidence: attendance-settings-page.tsx:106-115,386-391; use-paginated-list.ts:26-30,93-101,151-175; attendance.management.ts:795-861.

### PG-008-F001-A006 — Render policy row projection

- Actor/trigger: directory response is rendered.
- Implementation/state: row projection displays name, Flexible/Fixed schedule label, timezone, sum(requiredMinutes)/60, and assignment count; missing optional count falls back to 0.
- API/data: GET /policies returns day rows and _count.assignments.
- Outcome: seven day requiredMinutes produce displayed weekly hours; no UI sort is offered.
- Evidence: attendance-settings-page.tsx:280-325; attendance.management.ts:847-856; schema.prisma:1474-1498.

### PG-008-F001-A007 — Open row menu and dispatch row actions

- Actor/trigger: activate More actions for a policy; keyboard ArrowDown opens menu.
- Implementation/state: active actions View, Assign, Edit, Archive; archived actions View, Restore, Delete permanently.
- Outcome: handler opens the details panel, create/edit or assign panel, or a confirmation dialog.
- Accessibility risk: shared RowActionsMenu has confirmed PG-004-D-001 reproduction and PG-006 T018 reproduction; PG-008 use is established, PG-008 reproduction is not.
- Evidence: attendance-settings-page.tsx:68-84,330-379; apps/web/src/components/ui/row-actions-menu.tsx:45 onward; PG-004/PG-006 ledger entries.

### PG-008-F001-A008 — Display policy overview details

- Actor/trigger: choose View policy details.
- Implementation/state: details SidePanel initially opens Overview; displays mode, timezone, weekly hours, weekday/rest-day rules, shift times and next-day marker, break/overnight options, assignment count.
- Outcome: Overview/Assigned people tabs change displayed panel; Escape/Done close and focus returns to the opener.
- API/data: selected AttendancePolicy object is passed from the current row; no additional request for Overview.
- Evidence: attendance-settings-page.tsx:370-379,407-420; attendance-policy-details-panel.tsx:52-195.

### PG-008-F001-A009 — Load and render assigned people

- Actor/trigger: select Assigned people tab.
- Implementation/state: useAsyncResource requests assignments for current policy/page; list shows employee identity, effective dates, and Current/Scheduled/Ended/Cancelled status; empty, loading, error/retry states are distinct.
- API/access: GET /policies/:policyId/assignments?page=; backend requires authenticated employee-management permission, validates page, includes employee projection, orders effectiveFrom descending/id ascending.
- Outcome: page changes render selected page; available actions depend on assignment status.
- Evidence: attendance-policy-details-panel.tsx:199-223,245-381; attendance-api.ts:366-381; attendance.management.ts:989-1052.

### PG-008-F001-A010 — Create flexible policy

- Actor/trigger: Create policy button, keep Flexible schedule.
- Initial state: name empty; timezone Asia/Manila; unpaid breaks enabled; overnight review disabled; seven non-working days with 0 hours.
- Handler/API: submit maps seven days to weekday, isWorkingDay, requiredMinutes (0 for rest day), then POST /policies.
- Validation: name/timezone required; name max 100; timezone max 100; day hours min 0, max 24, step one minute; API validates trimmed name, named timezone, booleans, mode, exact seven unique days, and integer minutes 0-1440.
- Outcome/failure: success toast and panel closes/reloads; API failures display inline.
- Evidence: attendance-policy-panel.tsx:67-93,127-189,300-426; attendance-api.ts:323-350; attendance.management.ts:101-165,862-881; attendance.validation.ts:75-176.

### PG-008-F001-A011 — Create fixed schedule policy

- Actor/trigger: create panel Schedule type selects Fixed schedule.
- Handler/API: working days require type=time start/end; convert clock to minute-of-day; if enabled, break minutes submitted; POST /policies.
- Validation: start/end required, each 0-1439, distinct; break is integer 0-1440 and less than shift; disabled breaks are zero; overnight ends earlier than start; adjacent overnight shifts cannot overlap.
- Outcome: backend derives required minutes from shift length minus break; details and row show derived values.
- Evidence: attendance-policy-panel.tsx:333-381,383-475; attendance-policy-panel.tsx save at 127-167; attendance.validation.ts:66-163; fixed-schedule.test.ts:18-53.

### PG-008-F001-A012 — Validate form and API policy inputs

- Actor/trigger: submit create/edit with invalid or boundary values.
- Implementation/state: browser required/maxLength/min/max/step attributes constrain some inputs; server independently rejects unknown keys, blank trimmed names, invalid timezone/mode/flags/day configuration.
- API: POST/PATCH /policies.
- Outcome: 400 response with source-defined validation message; UI keeps panel open and shows inline error. Browser native validation is not the API contract.
- Boundary: 100-character name/timezone accepted if otherwise valid; 101 rejected; flexible required minutes 0 and 1440 accepted by validator, fractional/out-of-range rejected. Exact all-rest-day business rule is unresolved under C001.
- Evidence: attendance-policy-panel.tsx:300-426; attendance.management.ts:101-165; attendance.validation.ts:24-34,75-176.

### PG-008-F001-A013 — Edit policy while preserving history rules

- Actor/trigger: active policy menu > Edit, change values, submit.
- Implementation/state: form is initialized from template; PATCH uses same policy ID; timezone field becomes read-only if assignment count is nonzero.
- API constraints: archived policies cannot be edited; assigned policy timezone cannot change; fixed schedule edits require explicit scheduleMode; schedule/history/approved-leave dependencies are guarded. Recorded workdays retain original policy snapshots.
- Outcome/failure: successful edit refreshes directory; failure leaves form open with error and values.
- Evidence: attendance-policy-panel.tsx:67-93,127-167,300-332; attendance.management.ts:883-945; schema.prisma:1519-1535; policy-management.test.ts:91-120.

### PG-008-F001-A014 — Load and search employee choices

- Actor/trigger: open Assign panel.
- Implementation/state: AttendanceEmployeeSelection loads all pages through attendancePolicyEmployees; EmployeeSelection filters loaded name and employeeId, retains selection across query changes, has accessible checkbox/button labels and empty/no-match messages.
- API: GET /attendance/employees, paged requests; the page does not supply departmentId.
- Outcome/failure: retryable resource error before list; selected count updates; selected employee identity remains selected while search changes.
- Evidence: attendance-employee-selection.tsx:11-61; employee-selection.tsx:24-151; attendance-api.ts:195-215.

### PG-008-F001-A015 — Assign active policy to employee(s)

- Actor/trigger: choose policy, employee(s), effective date; submit, then Confirm assignment.
- Implementation/state: canAssign requires at least one employee, selected active policy, date, and successful policy-choice loading; confirm modal can be cancelled; save posts one assignment per employee.
- API: POST /assignments with employeeId, policyId, effectiveFrom; manager permission; date must be today or later in policy timezone; policy must be active and have seven day rows; checks overlap, approved leave, recorded workdays, and timezone cutoff.
- Outcome/failure: success toast and close; failure remains actionable with error; each created assignment persists with date/policy/employee relations and audit.
- Evidence: attendance-policy-panel.tsx:110-119,127-215,481-523; attendance-api.ts:382-391; attendance.management.ts:1203-1325; schema.prisma:1500-1517.

### PG-008-F001-A016 — Recover from partial multi-employee assignment

- Actor/trigger: assignment panel submits multiple selected employees and a later request fails.
- Implementation/state: requests are sequential; successful IDs are removed from selection; failed and unattempted IDs remain selected; error explains partial count.
- Outcome: retry submits only still-selected employees.
- Evidence: attendance-policy-panel.tsx:132-177,190-210; attendance-policy-assignment.spec.ts:177-237.

### PG-008-F001-A017 — Replace current assignment

- Actor/trigger: current assigned-person row > Replace policy.
- Implementation/state: replacement panel preselects employee and excludes the outgoing policy; back returns to the same details panel, tab, and page.
- API: POST /assignments with replacesAssignmentId; server requires another active policy and a replacement date covered by the current assignment.
- Outcome: confirmation explains effective date; replacement creates successor and preserves interval linkage; new row becomes Scheduled or Current by clock.
- Evidence: attendance-policy-details-panel.tsx:312-326; attendance-settings-page.tsx:411-418; attendance-policy-panel.tsx:94-118,242-262,481-498; attendance.management.ts:1263-1322; attendance.spec.ts:1183-1234; policy-replacement.test.ts:121-323.

### PG-008-F001-A018 — Archive and restore policy

- Actor/trigger: active menu Archive or archived menu Restore; confirm dialog.
- API/state: POST /policies/:id/archive or /restore; transaction updates archivedAt, audit records mutation.
- Outcome: archived policies leave active choices; restore returns policy to active choices; assignments and recorded history remain.
- Evidence: attendance-settings-page.tsx:138-160,330-368,422-452; attendance-api.ts:359-363; attendance.management.ts:947-966; policy-management.test.ts:216-258.

### PG-008-F001-A019 — Permanently delete archived unassigned policy

- Actor/trigger: archived row > Delete permanently; confirm.
- API validation: DELETE /policies/:id; requires archivedAt set and assignment count zero; active or assigned deletion returns 409; absent record returns 404.
- Outcome: policy and day rules are deleted; audit event is recorded; referenced policies cannot be deleted because history uses restrictive relations.
- Evidence: attendance-settings-page.tsx:330-355,422-452; attendance-api.ts:364-365; attendance.management.ts:968-987; policy-management.test.ts:260-301.

### PG-008-F001-A020 — End current assignment

- Actor/trigger: current assigned-person row > End assignment; confirm dialog.
- API/state: POST /assignments/:id/unassign with expectedStatus CURRENT; checks stale status, leave/workday constraints; current coverage ends tomorrow in policy timezone.
- Outcome/failure: success refreshes list; 409 shows error in confirmation and preserves state; cancel/Escape closes and focus returns to opener.
- Evidence: attendance-policy-details-panel.tsx:224-243,312-359; attendance-api.ts:392-399; attendance.management.ts:1053-1202; attendance.spec.ts:1143-1182; policy-unassignment.test.ts:160-465.

### PG-008-F001-A021 — Cancel scheduled assignment

- Actor/trigger: scheduled row > Cancel scheduled assignment; confirm.
- API/state: same unassign endpoint with expectedStatus SCHEDULED; server checks stale status, workday and leave dependencies, and restores/re-wires prior coverage if applicable.
- Outcome/failure: successful cancellation refreshes list and may reveal previous coverage; failure stays visible in the dialog.
- Evidence: attendance-policy-details-panel.tsx:224-243,328-359,383-396; attendance.management.ts:1053-1178; attendance.spec.ts:1232-1243; policy-unassignment.test.ts:160-465; policy-replacement.test.ts:144-285.

### PG-008-F001-A022 — Paginate/retry assignment details and recover stale selection

- Actor/trigger: assigned-person page controls or GET error retry.
- Implementation/state: assignment resource keyed by policyId and page; page change clears pending selected confirmation; pagination disabled while loading or pending.
- Outcome: new page replaces rows; retry reissues current resource; stale page responses must not replace newer data.
- Evidence: attendance-policy-details-panel.tsx:216-243,373-381; attendance-api.ts:373-381; apps/web/src/lib/use-async-resource.ts.

### PG-008-F001-A023 — Responsive layout and accessible controls

- Actor/trigger: render directory/panels at desktop and compact widths; keyboard through menu/dialog/tab controls.
- Implementation/state: five-column grid collapses at 820px; controls use labels and accessible names; shared panels/dialogs provide modal semantics and focus handling.
- Outcome: no horizontal overflow is currently an asserted layout goal in adjacent tests; menu keyboard path is specifically risk-bearing due shared defect history.
- Evidence: attendance-settings-page.tsx:53-65,213-260,330-379; attendance-policy-panel.tsx:263-289,300-523; attendance-policy-details-panel.tsx:52-83; attendance.spec.ts:1636-1806.

### PG-008-F001-A024 — Enforce API authentication, authorization, and employee scope

- Actor/trigger: direct request to policy, assignment, or employee endpoints.
- API: router applies requireAuth; policy CRUD, policy assignments, and assignment transitions use managementScope with employees:manage. Employee directory read uses managementScope's read permission and any implemented manager scope; PG-008 page passes no department ID.
- Outcome/failure: unauthorized requests reject independently of page visibility; managers receive policy and employee projection required for configuration.
- Data: actor, Employee, AttendancePolicy, AttendancePolicyAssignment.
- Evidence: routes.ts:11-19,35-100; attendance.management.ts:82-100,590-636,795-1325; auth.permissions.ts:19,34-103.

### PG-008-F001-A025 — Serialize competing assignment mutations

- Actor/trigger: overlapping concurrent POST /assignments for the same employee.
- Implementation: service locks the employee row, checks existing assignment overlap, then creates assignment and closes predecessor coverage in ReadCommitted transaction.
- Outcome: at most one conflicting assignment succeeds; persisted intervals remain valid. Exact locking behavior is PostgreSQL-specific and needs a disposable PostgreSQL integration environment.
- Evidence: attendance.management.ts:1203-1325, especially employee lock and overlap checks at 1221-1263; existing PostgreSQL-test convention at apps/api/tests/features/employees/deactivation-concurrency.postgres.ts:1-54.

## Notes

- No atomic feature is based solely on a route name or visual assumption.
- There is no sorting UI behavior to test.
- C001 is the only contract-blocked feature state; it does not block other atomics.
- Shared RowActionsMenu defect status remains owned by PG-004-D-001/PG-006 T018 and is not reclassified here.

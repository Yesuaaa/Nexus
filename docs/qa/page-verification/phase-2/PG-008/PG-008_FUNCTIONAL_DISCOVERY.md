# PG-008 Functional Discovery

## Scope and baseline

This report records Phase 2.1 source discovery for PG-008 only. No automated test, test suite, application code, or schema was modified or executed. Test results below describe inspected declarations and assertions; they are not claims that those tests pass.

- Request-reported prior baseline: branch 293-test-full-system-audit-for-verifying-recent-changes, HEAD 972428afbcd3d48d7ca6b8084b6f2906c2de84bc.
- Actual entry baseline: same branch, HEAD 3c28524299253f8e6ff9da0f2603e398f43d6516.
- Difference: one commit ahead, 3c285242 (test(PAGE-007): add tests, unit tests, and qa documentation).
- Entry worktree: clean; no staged, unstaged, or untracked paths. No pre-existing modifications needed preservation.
- No checkout, fetch, reset, merge, rebase, commit, or push was performed.

## Approved identity

The Phase 1 route inventory, component mapping, functionality inventory, authorization matrix, and existing-coverage inventory consistently identify PG-008 as the Attendance Policy Management page. Current source agrees; no identity discrepancy was found.

| Field                 | Verified value                                                      |
| --------------------- | ------------------------------------------------------------------- |
| Stable page ID        | PG-008                                                              |
| Canonical URL         | /attendance/policies/management                                     |
| Next.js route         | apps/web/src/app/(portal)/attendance/policies/management/page.tsx   |
| Main component        | AttendanceSettingsPage                                              |
| Feature               | apps/web/src/features/attendance; Workforce Compliance / Attendance |
| Phase 1 functionality | Review and configure attendance policies and assignments            |
| Legacy alias          | /attendance/settings redirects to the canonical URL                 |
| Separate overview     | /attendance/policies/overview is a distinct page, not PG-008        |

Approved inventory references: PHASE_1_COMPLETE_ROUTE_INVENTORY.md:18; PHASE_1_PAGE_COMPONENT_MAPPING.md:29; PHASE_1_PAGE_FUNCTIONALITY_INVENTORY.md:14; PHASE_1_PAGE_AUTHORIZATION_MATRIX.md:33; PHASE_1_EXISTING_TEST_COVERAGE.md:38. The alias is also recorded at PHASE_1_COMPLETE_ROUTE_INVENTORY.md:81-83.

The route file is a thin server component that renders AttendanceSettingsPage (page.tsx:1-5). The page and panel components are client components.

## Access, layout, providers, navigation

- The root layout wraps children in AuthProvider: apps/web/src/app/layout.tsx:4,34.
- The exact Attendance navigation routes, including /attendance/policies/management, derive access from canConfigureAttendance when link access is configure; the legacy /attendance/settings policy uses the same predicate: apps/web/src/features/workspaces/model/route-policy.ts:341-379,438-442,739-744.
- canConfigureAttendance requires an active account, a privileged role, and employees:manage: apps/web/src/features/auth/model/permissions.ts:118-124. The approved matrix identifies active ADMIN and SUPERADMIN.
- Attendance navigation places Policies under access configure; Overview and Management links are both gated by configure access: apps/web/src/features/attendance/model/navigation.ts:61-84.
- AttendanceShell renders the Attendance module frame and current settings tab: apps/web/src/features/attendance/components/attendance-shell.tsx:82 onward; attendance-settings-page.tsx:163-179.
- The /attendance/settings legacy route calls Next redirect to /attendance/policies/management: apps/web/src/app/(portal)/attendance/settings/page.tsx:1-5.
- Route protection is only a frontend navigation boundary. The API independently applies requireAuth and managementScope with Permission.EMPLOYEES_MANAGE to policy management. This is a global configure scope; no department filter is applied to the policy list or assignment mutation.

## Implementation trace

Route -> component -> hooks/state -> API client -> Express router -> management service -> Prisma

| Layer             | Current implementation                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route             | The canonical route renders AttendanceSettingsPage; the settings alias redirects to it.                                                                                                                                                                                                                                                                                                                         |
| Page and children | AttendanceSettingsPage composes AttendanceShell, ResponsiveDataTable, SearchField, ManagementViewToggle, RowActionsMenu, AttendancePolicyPanel, AttendancePolicyDetailsPanel, AttendanceEmployeeSelection, ConfirmationDialog, ResourceStatus, and pagination.                                                                                                                                                  |
| State and hooks   | Local state stores query, active/archive view, pending destructive action, create/assign panel mode, selected detail policy, and assignment page. usePaginatedList loads the policy directory and coordinates request cancellation, delayed search, stale response rejection, page clamping, and retained rows. useAsyncResource loads assignment policy choices, employee options, and assignment detail rows. |
| API client        | attendance-api.ts calls same-origin /api/attendance endpoints. The directory requests page, size, status, and search; creates and updates use JSON POST/PATCH; archive/restore and assignment lifecycle use POST; permanent deletion uses DELETE.                                                                                                                                                               |
| Express           | apps/api/src/app.ts mounts createAttendanceRouter at /api/attendance. routes.ts uses inline handlers and passes policy operations to createAttendanceManagement. There is no separate policy controller.                                                                                                                                                                                                        |
| Service/domain    | attendance.management.ts owns policy input parsing, permission checks, transaction logic, audit context, assignment transition rules, employee directory projection, and policy list/detail operations.                                                                                                                                                                                                         |
| Persistence       | Prisma AttendancePolicy, AttendancePolicyDay, AttendancePolicyAssignment, Employee, AttendanceWorkday, LeaveRequestDay, and AttendanceAudit. AttendancePolicyDay is keyed by policyId and weekday; assignment rows retain effective dates and links to workdays and leave days.                                                                                                                                 |

Key source: route page.tsx:1-5; attendance-settings-page.tsx:86-455; attendance-policy-panel.tsx:48-550; attendance-policy-details-panel.tsx:52-400; attendance-employee-selection.tsx:11-61; attendance-api.ts:195-215,283-399; routes.ts:11-100; app.ts:131; attendance.management.ts:82-165,795-1325; attendance.validation.ts:24-34,56-176; schema.prisma:1474-1537,1570-1583.

## Source-backed behavior summary

### Directory

The initial view is Active policies, page 1, ten rows. The request includes the active status filter and an empty search. Search is trimmed and lowercased for local preview; the backend also searches name and timezone without case sensitivity. Changing search resets page to 1. Changing active/archive view resets page and clears search. The backend orders by createdAt descending, then id descending. There is no user-controlled sort control.

The page reports initial loading through five skeleton rows and aria-busy. A list error is exposed through ResourceStatus with retry. Empty active, empty archived, and no-search-match states have distinct copy. While a subsequent fetch occurs, the paginated hook is designed to retain current rows; a superseded request is aborted and ignored.

Evidence: attendance-settings-page.tsx:105-137,181-216,237-279,386-391; attendance-api.ts:283-307; use-paginated-list.ts:26-45,107-190; attendance.management.ts:795-861.

### Row projection and actions

Each row shows policy name and schedule mode, timezone, weekly required hours (sum of all seven requiredMinutes divided by 60), assignment count, and actions. If the optional assignment count is absent, the UI displays zero. Active rows expose View, Assign, Edit, Archive. Archived rows expose View, Restore, Delete permanently. These actions open details, the relevant panel, or a confirmation dialog.

Evidence: attendance-settings-page.tsx:280-379,422-452.

### Creation and editing

A new policy defaults to FLEXIBLE, Asia/Manila, unpaid breaks enabled, overnight review disabled, and seven rest days with zero hours. The flexible form allows per-day working-day toggles and daily required hours from 0 to 24 in one-minute steps. Unchecked rest days are submitted with requiredMinutes 0.

FIXED mode asks each working weekday for start/end times and, when unpaid breaks are enabled, scheduled unpaid break minutes. Times are minute-of-day values; an end earlier than start is interpreted as overnight. Required minutes are derived by the API from shift duration less scheduled break. Break values are bounded in the UI to 0-1438 and must be shorter than the computed shift. Unpaid break fields disappear when break tracking is disabled. Both policy modes submit through POST /policies; edit uses PATCH /policies/:policyId.

The name is required and maxLength 100. Timezone is required and maxLength 100. During edit, timezone is read-only if the policy has assignments. The backend trims and bounds the name, validates a named timezone, requires explicit schedule mode for fixed-policy edits, prevents editing archived policies, prevents changing the timezone of assigned policies, and protects future approved leave/history dependencies. Browser-required constraints and API validation are distinct.

Evidence: attendance-policy-panel.tsx:67-93,127-215,300-475; attendance-api.ts:323-358; attendance.management.ts:101-165,862-945; attendance.validation.ts:24-34,75-176.

### Assignment and replacement

The assignment panel loads active policy choices and all pages of employees. The employee selector searches the loaded rows by name or employee ID and retains selected IDs while the local query changes. Assignment requires at least one employee, an active target policy, an effective date, and successful policy-choice loading. A confirmation precedes submission. Selected employees are posted sequentially, one request each. When a later request fails, prior successful employee IDs are removed from selection, the remaining employees stay selected, and the failure is shown for retry.

The API requires valid employee and policy IDs, a valid date, permission to manage employees, an active policy with seven configured day rows, and an effective date not earlier than today in the policy timezone. It rejects missing records, assignment overlap, future approved leave, recorded workdays on or after the proposed effective date, and conflicting timezone-midnight handoffs. Replacement requires a different active policy and an overlapping existing assignment; it preserves predecessor/replacement links in a transaction.

Evidence: attendance-policy-panel.tsx:94-119,127-215,216-262,481-523; attendance-employee-selection.tsx:11-61; employee-selection.tsx:24-151; attendance-api.ts:195-215,309-322,382-391; attendance.management.ts:1203-1325.

The source accepts a seven-day configuration where every day is marked non-working and has zero required minutes. The UI permits that state. Product requirements do not establish whether such a policy should be creatable or assignable. This is recorded as contract clarification C001; no expected accept/reject result is invented.

### Details and assignment lifecycle

The overview panel presents schedule mode, timezone, weekly hours, each weekday, fixed shift times including next-day indication, break policy, overnight-review policy, and assignment count. Assigned people are loaded by policy and page, with identity, date range, and status. UI statuses include Current, Scheduled, Ended, Cancelled. Current assignments offer Replace and End; scheduled assignments offer cancellation. Ending a current assignment sends expectedStatus CURRENT; scheduled cancellation sends SCHEDULED. The API checks that expected status remains current, applies policy-timezone effective-date rules, and protects recorded workdays and leave history.

Evidence: attendance-policy-details-panel.tsx:52-195,199-400; attendance-api.ts:366-399; attendance.management.ts:989-1202.

### Archive and deletion

Archive and restore are confirmed actions. Archiving removes a policy from active choices while retaining assignment and recorded-attendance history. Restore makes it active again. Permanent deletion is a separate destructive action; backend requires the policy to be archived and have no assignment rows. A denied mutation stays in the confirmation flow and surfaces the API error through the dialog.

Evidence: attendance-settings-page.tsx:138-160,330-379,422-452; attendance-api.ts:359-365; attendance.management.ts:947-987.

## Errors, accessibility, and responsive behavior

- Directory, employee, policy-choice, and assignment-list loaders have retryable ResourceStatus paths.
- Create/edit and assignment panels guard pending mutations, show inline errors, disable relevant inputs while pending/confirming, and close on success.
- Assignment selection includes an accessible search label and labeled employee checkboxes/buttons. Dialogs and SidePanel supply modal/focus behavior through shared UI primitives.
- The details panel has Overview and Assigned people tabs, Escape-to-close behavior, and restores focus to the row action that opened it. Current assignment end dialog also restores focus to its opener.
- The row action control is the shared RowActionsMenu and handles ArrowDown to open. PG-004-D-001 is a confirmed shared keyboard-operated row-action menu defect, and PG-006 T018 reproduces it. PG-008 imports the same component at attendance-settings-page.tsx:30-34,330-379. This makes a PG-008-specific keyboard test a required regression risk check. This discovery does not assert a PG-008 reproduction or defect.
- The settings page uses a five-column desktop layout and a two-column compact layout at 820px; existing browser coverage uses 390, 820, and 1440px. PG-006 T024 is intermittent at 820px on a different page. It is retained as a shared-browser reliability risk, not attributed to PG-008.

Evidence: row-actions-menu.tsx:45 onward; attendance-settings-page.tsx:53-65,330-379; attendance-policy-details-panel.tsx:52-83,312-359; attendance-policy-panel.tsx:127-215,263-289; attendance.spec.ts:1636-1806,2786-2840.

## Out-of-scope and not applicable

- Sorting: no interactive sort control exists; source-defined API ordering is fixed.
- Department filter: no department control is presented in this page. Policy management is global for actors with employees:manage.
- User-managed policy status field: status is represented by archivedAt and changed only through Archive/Restore actions.
- Permanent deletion with assigned history: backend denies it, and the UI explicitly describes the restriction.
- Independent attendance schedule preview/calculator in the browser: required minutes are rendered from API-provided policy days; calculations and validation live in backend validation.
- Direct database test from mocked Playwright: not applicable; mocked tests will only verify browser/API request behavior.

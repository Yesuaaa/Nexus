# Attendance Workspace and Management Workflows

Developed: 2026-11-13

Attendance belongs to the standalone **Attendance & Monitoring** module, separate from **People & HR**. It reuses the existing sidebar disclosures/flyouts, shared topbar, workspace provider, route policy, tabs, confirmation dialogs, date inputs, cards, and responsive tables. Staff enter Attendance & Monitoring without access to People & HR or Employee Management. Existing Admin module entry routes remain unchanged.

## Module separation (2026-11-14)

Attendance & Monitoring reuses the existing workspace cards, sidebar disclosure/flyout, workspace provider, and shared topbar. Admin and current Department Heads enter Overview; ordinary Staff and Admin without management access enter Check-Ins. People & HR retains department and employee management. Existing `/attendance/*` routes, permissions, attendance components, and APIs are preserved.

## Grouped workspace pages (2026-11-14)

The module keeps the shared ModuleCard, workspace provider, sidebar disclosures/flyouts, topbar, breadcrumbs, and role guards. The four sidebar groups are defined once in `features/attendance/model/navigation.ts`; route policies use the same page metadata. Existing attendance, employee, workload, and availability rules remain unchanged.

| Group                | Page        | Route                              | Access                  |
| -------------------- | ----------- | ---------------------------------- | ----------------------- |
| Attendance           | Overview    | `/attendance/overview`             | Attendance managers     |
| Attendance           | Check-Ins   | `/attendance/check-ins`            | Active Staff/Admin      |
| Time Logs            | Overview    | `/attendance/time-logs/overview`   | Attendance managers     |
| Time Logs            | Records     | `/attendance/time-logs/records`    | Attendance managers     |
| Time Logs            | Audit Trail | `/attendance/time-logs/audit`      | Attendance managers     |
| Requests & Approvals | Overview    | `/attendance/requests/overview`    | Active Staff/Admin      |
| Requests & Approvals | Overtime    | `/attendance/requests/overtime`    | Active Staff/Admin      |
| Requests & Approvals | Corrections | `/attendance/requests/corrections` | Active Staff/Admin      |
| Policies             | Overview    | `/attendance/policies/overview`    | Authorized policy Admin |
| Policies             | Management  | `/attendance/policies/management`  | Authorized policy Admin |
| Policies             | Assignments | `/attendance/policies/assignments` | Authorized policy Admin |

Attendance managers retain the existing organization or current-department scope. Staff request pages remain personal. The legacy `/attendance/adjustments` route still provides the combined request directory for existing links. Clients and Superadmins do not gain attendance access.

Time Logs Overview summarizes the selected historical workday period, using the existing summary service, policy snapshots, and unpaid-break deductions. Records retains its employee directory, session details, filters, and CSV export. Audit Trail uses the existing paginated audit API and shows actors, reasons, and before/after snapshots. Its date filters apply to UTC event timestamps; it is business history rather than developer diagnostics.

Requests Overview uses `GET /api/attendance/adjustments/overview?scope=mine|team` to aggregate all authorized rows by type and status. It does not total only the displayed page. Overtime and Corrections share the existing request table, review panel, pagination, and scope toggle; the existing list endpoint additionally accepts a validated `status` filter. Overtime remains automatic at clock-out with department verification before HR approval. Corrections reuse the existing submission dialog and approval validation.

Policies Overview uses full-inventory counts returned alongside `GET /api/attendance/policies`. Assignment-period totals include current, scheduled, and ended history and do not claim employee coverage. The existing recent-policy directory remains limited to 200 entries, explicitly labeled in the new inventory and assignment views. Assignments selects a policy and reuses the assigned-people view from policy details, including server-calculated statuses and pagination. Assignment creation reuses the existing form, confirmation, effective-date validation, and archived-policy restrictions.

Implementation proceeded through navigation/access unit checks; existing clocking/foundation checks; records/audit scope checks; request summary/status and overtime tests; policy inventory/lifecycle tests; then integrated browser and responsive regression checks. Backend tests use isolated PGlite without live data or schema changes.

## Check-in overview focus (2026-11-14)

Attendance Overview now shows only check-in activity: distinct employees checked in, sessions started, recorded check-outs, open sessions, session status, and the latest eight clock-in/out and break actions. Counts use the existing authorized workday range and department scope; split sessions count separately and overnight sessions retain their attendance workday. Activity timestamps are shown in UTC. The shared overview API adds a `checkIns` summary while preserving the existing fields used by Time Logs Overview. The page reuses StatStrip, BreakdownList, ItemList, OverviewPanel, the shared filters and resource hook, and links only to Check-Ins. It contains no time-log, request, overtime, correction, or policy summaries.

## Records and audit overview focus (2026-11-14)

Time Logs Overview now summarizes check-ins, check-outs, open sessions, session status, and record-change activity. It reuses the existing scoped attendance summary and audit API, with `recordsOnly=true` selecting workday/session/break events before pagination. The audit response includes action counts across all matching events, so summaries do not total only one page. The overview shows the latest eight matching events without reasons or snapshots, and links to Records and Audit Trail for details. Record statistics use attendance work dates; audit statistics and activity use UTC creation dates. Policy, overtime, approval, correction, and request information is excluded, along with detailed record tables and hour-requirement summaries. Existing audit behavior is preserved when the new filter is omitted.

## Routes and access

| Subtab      | Route                             | Staff          | Current Department Head            | Authorized Admin                     |
| ----------- | --------------------------------- | -------------- | ---------------------------------- | ------------------------------------ |
| Overview    | `/attendance/overview`            | Denied         | Department summaries               | Organization summaries               |
| Check-Ins   | `/attendance/check-ins`           | Own attendance | Own attendance                     | Own attendance                       |
| Time Logs   | `/attendance/time-logs/records`   | Denied         | Current department records         | Organization employee records        |
| Adjustments | `/attendance/adjustments`         | Own requests   | Own requests and department review | Own requests and organization review |
| Policies    | `/attendance/policies/management` | Denied         | Denied                             | Policy configuration and assignment  |

Clients and Superadmins do not gain HR attendance access. Admin records/summaries use the existing `employees:read` permission; policy management uses `employees:manage`. Department management access is derived from the current active Staff account and current `Department.headId`, checked by the backend on every request. Changing a head assignment revokes that scope immediately on subsequent requests.

## Personal attendance

The live clock anchors to the API's `asOf` timestamp and advances with the browser's monotonic clock. It calculates from actual session and break timestamps, excludes unpaid breaks, and resynchronizes on polling, focus, visibility, and reconnect. Local clock settings do not determine punch timestamps. Midnight does not stop a session or split its credited hours.

The screen shows status, attendance workday, timezone, assigned policy, required-hours progress, remaining time, and excess-hour review flags. Clock in, unpaid break start/end, and clock out require confirmation. The previous overnight workday can be explicitly continued when eligible; a normal new clock-in uses the current local date.

History is grouped by attendance workday and shows complete actual clock-in/out dates in that workday's timezone. Overnight badges remain visible without expanding the detailed session/break rows. Empty, loading, retry, policy-setup, and mutation-error states use shared UI components.

## Corrections and approvals

Employees can request a correction from a recorded session or submit a missing closed session. The form explicitly labels its device timezone and sends complete offset-derived instants. It requires a reason, ordered timestamps, and an end no later than server time.

Requests are separate records until reviewed. Approval updates the existing session or creates the missing session atomically with the decision and audit trail. Rejection records a note without changing attendance. The service prevents:

- Access to another employee's request as an ordinary Staff member.
- Department Head access outside the currently headed department.
- Self-review, including a Department Head or Admin's own request.
- Repeated decisions and reused request keys with different payloads.
- Approval after the original session or breaks changed.
- Overlapping sessions, future times, or a correction that excludes recorded breaks.

Existing-session corrections retain their starting local date and original workday association. Recorded break timestamps are preserved; editing break timestamps or moving a session between attendance dates is outside this workflow. Audit history retains original values and the submitting/reviewing account.

## Policy settings

Policies define all seven weekday working flags and integer-minute targets, a named timezone, unpaid-break availability, and whether overnight work requires review. There is no fixed clock-in window. Overnight work is always recorded across midnight; the review flag does not silently end a session or approve payroll overtime.

Admin can create or edit a policy in place. Edits retain the policy ID and apply to new workdays; recorded workdays preserve the policy name, timezone, daily target, break availability, and overnight-review rule. Assigned policies retain their timezone so effective-date boundaries remain stable. Assignments can start today or on a future date and close earlier overlapping periods only when existing records are preserved.

Archive is the soft-delete action. The policy directory has active and archived filters, and archived policies can be restored. Existing assignments continue to work while archived; new assignments and edits require restoration. Permanent deletion requires archiving first and is limited to policies with no assignments, preserving attendance history. Policy details reuse the shared tabs, `MemberIdentity`, status pills, loading/error state, empty state, and pagination to show current, scheduled, and ended assignments with employee identities and effective dates.

Migration `20261113170000_attendance_policy_management` adds archival status and backfills immutable workday rule snapshots before enabling edits. It must be applied to the target database before using these policy-management changes.

The additive migration `20261113160000_attendance_adjustments` introduces correction requests and backward-compatible policy flags. Existing policy defaults continue to allow unpaid breaks and do not require overnight review. No live migration or data backfill is run by this implementation.

## Management APIs

Monitoring extension (2026-11-13): Time Logs now opens with all permitted employees and combines date, employee, and department filters. `/api/attendance/records` enforces these filters within the caller's server-side scope; `/api/attendance/departments` supplies only authorized choices. Ordinary Staff cannot use either management endpoint. `/api/attendance/audit` exposes paginated change and review history within the same scope, with actor, reason, and before/after snapshots. Audit date filters use UTC creation dates; record filters use attendance work dates. Department Heads cannot access company policy audit events or another department's employees. Open sessions, open unpaid breaks, and pending corrections have explicit indicators. Existing policy management, assignments, requests, and approval/rejection flows remain unchanged. No new migration is needed for this extension.

These complement the [self-service attendance API](attendance-backend.md):

| Method     | Endpoint                                               | Purpose                                                               |
| ---------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| GET        | `/api/attendance/employees?search=&page=`              | Paginated HR identity picker within the caller's scope.               |
| GET        | `/api/attendance/overview?from=&to=`                   | Attendance statistics over a bounded date range and authorized scope. |
| GET        | `/api/attendance/employees/:employeeId/history`        | Admin or department-scoped history.                                   |
| GET / POST | `/api/attendance/adjustments`                          | List scoped requests or submit an owned request.                      |
| POST       | `/api/attendance/adjustments/:id/review`               | Approve or reject with a required review note.                        |
| GET / POST | `/api/attendance/policies`                             | Read recent policy versions or create a version; Admin only.          |
| POST       | `/api/attendance/assignments`                          | Assign a policy version; Admin only.                                  |
| PATCH      | `/api/attendance/policies/:policyId`                   | Edit the existing policy; Admin only.                                 |
| GET        | `/api/attendance/policies/:policyId/assignments?page=` | Paginated people and effective assignment periods; Admin only.        |
| POST       | `/api/attendance/policies/:policyId/archive`           | Soft delete without interrupting assigned attendance; Admin only.     |
| POST       | `/api/attendance/policies/:policyId/restore`           | Restore an archived policy; Admin only.                               |
| DELETE     | `/api/attendance/policies/:policyId`                   | Permanently delete an archived, unassigned policy; Admin only.        |

Overview queries are limited to 10,000 records and policy listings to the latest 200 versions. Time Logs exports the currently displayed page as CSV, with daily totals included once per workday and actual session instants retained.

## Verification

### Management design alignment (2026-11-13)

Attendance was compared with the rendered Department Management and Employee Management pages. It now follows their page composition as well as their component palette: each subtab has a specific `PageHeader`, compact segmented navigation, navy header actions, 34px toolbar controls, and the same table typography, borders, header tint, and responsive container breakpoints. Time Logs places employee, department, and date filters in one wrapping toolbar and renders its directory directly, without nested overview cards. Record loading/errors use `DataTableSkeletonRows` and `DataTableErrorRow` inside the shared table.

Policies is a searchable, paginated policy directory using `ResponsiveDataTable`, `AnimatedSlotGridBody`, `useLocalTable`, and `TablePaginationFooter`. Creating, editing, or assigning a policy opens the same `SidePanel`/`Form`/section/body/footer pattern used by Department and Employee Management. Fields use the existing panel styles and validation; assignment still requires confirmation and preserves recorded workdays. Archive, restore, and permanent deletion reuse `RowActionsMenu` and `ConfirmationDialog`. Adjustments use a directory table with `MemberIdentity`, status pills, and the existing authorized approval actions, replacing the standalone request cards.

Check-Ins keeps its live timer and clock/break actions. Its daily requirement uses the shared `ProgressMeter` and `DetailList`; history tables no longer sit inside another bordered overview card. Existing RBAC, routes, sidebar, topbar, actual timestamps, API calls, and attendance calculations are unchanged.

Attendance Overview now follows the same management overview hierarchy: a header action, reusable `StatStrip` KPIs, `MiniStats`, and `OverviewPanel` sections using `BreakdownList` and `ItemList`. The first version stays within the existing summary response—recorded employees/workdays, net and required hours, completed days, active sessions, excess-hour flags, and permitted scope—so it does not infer absences or invent department/status aggregates that the API does not provide.

Browser verification compares fully loaded Department/Employee/Attendance screens, checks consistent heading typography, and exercises management layouts, policy panel validation, templating, cancellation, and assignment controls at 390px, 820px, and 1440px. Screenshots are generated from the real isolated PGlite API fixture.

- Offline attendance API/foundation/management tests use the shared PGlite harness.
- Web unit tests cover tab access independently of Employee Management, workspaces, overnight elapsed time, split sessions, and paused timers.
- `attendance.spec.ts` uses a real Express API with an isolated PGlite database, real JWT sessions, and a controlled server clock. No production UI uses mock data or browser request stubs.
- Browser coverage includes overnight clocking, unpaid breaks, real correction submission/approval, records, policy creation/assignment, and denied client access. Layout checks use 390px, 820px, and 1440px widths and cover mobile drawers and collapsed sidebar flyouts.
- Existing employee-management and module-navigation browser tests verify the shared shell and other navigation remain intact.

Future work includes break-time corrections, cross-workday reassignment, approved-leave exceptions, and payroll/night-rate calculations.

## Combined attendance requests

OT & Agreements retains `/attendance/adjustments` for route compatibility. Corrections and overtime share the existing search field, type filter, management scope toggle, responsive table, pills, ellipsis menu, and review side panel. Staff use the existing correction modal for missing or incorrect attendance.

Clock-out automatically creates a Pending overtime request for whole excess worked minutes, excluding unpaid breaks. The request and punch are saved atomically. Split sessions submit only additional excess; rejected time is not resubmitted. Active sessions do not submit overtime. Pending corrections defer automatic submission until attendance is resolved. Approved corrections also submit newly recorded excess.

The existing notification inbox alerts the current Department Head and active HR/Admin accounts. Department Heads verify requests within their department; verification notifies HR for final approval. HR cannot approve Pending overtime before department verification. A department needs an authorized head to complete this step, and self-review remains prohibited. Verification identity, date, and note are preserved separately from final review. Approval records overtime minutes without modifying attendance timestamps or calculating pay. Corrections are blocked while the workday has pending, verified, or approved overtime to protect reviewed totals. Existing manual overtime API requests remain supported for compatibility and use the same validation and approval flow.

`pnpm --filter @nexus/api db:seed:attendance-requests` adds three pending demo overtime requests and supporting demo sessions without replacing existing corrections or time logs. Reruns preserve existing demo requests.

## Personal overview and module dashboard (2026-11-14)

Attendance Overview now uses `/api/attendance/me/overview`, deriving the employee from the authenticated account. It has no department selector and accepts no scope overrides. `/attendance/dashboard` is a separate Dashboard sidebar group for authorized attendance managers. It reuses the attendance, record-audit, request, and policy summaries with links to all permitted pages. Admin sees organization data; Department Heads retain their current department scope and cannot access policy summaries. Attendance/audit filters apply to those sections; requests cover all permitted history and policies cover the current organization inventory.

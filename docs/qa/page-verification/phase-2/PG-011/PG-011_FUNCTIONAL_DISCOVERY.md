# PG-011 Functional Discovery

## Discovery scope and baseline

This is Phase 2.1 source discovery and test design only. No automated tests were run, and no production or test source was changed. Current repository source defines implemented behavior; the prior reports are historical evidence and context.

| Baseline item            | Result                                                                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch                   | `293-test-full-system-audit-for-verifying-recent-changes`                                                                                                                               |
| Task-entry HEAD          | `9b4d3936d425d4c743bea6bc021f0daf10b585d6`                                                                                                                                              |
| Previously reported HEAD | `53ffd689b146fbf72cb6ba2e4fcbfd7b80aefd19`                                                                                                                                              |
| Difference               | One intervening commit, `test(PAGE-010): add tests, unit tests, and qa documentation`; it contains PG-010 implementation and QA documentation. No other intervening commit was present. |
| Task-entry worktree      | Clean; no staged, unstaged, or untracked files.                                                                                                                                         |
| Git actions              | No checkout, fetch, reset, merge, rebase, commit, or push.                                                                                                                              |

The task-entry worktree was clean before these reports were created. Phase 1 and Phase 2 planning/ledger files were present, including all seven required Phase 1 inventories and the PG-010 design/execution reports.

## Approved identity and reconciliation

| Field                         | Approved Phase 1 identity                                                                         | Current source                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Stable page ID                | `PG-011-F001`                                                                                     | Preserved.                                                                                                                      |
| Canonical URL                 | `/attendance/requests/leave`                                                                      | Matches the route and navigation.                                                                                               |
| Route entry                   | `apps/web/src/app/(portal)/attendance/requests/leave/page.tsx`                                    | Awaits `searchParams.request` and renders `LeaveRequestsPage`; the query selects linked-detail mode.                            |
| Main component                | `LeaveRequestsPage`                                                                               | `apps/web/src/features/leave/pages/leave-requests-page.tsx`                                                                     |
| Module                        | Workforce Compliance / Attendance Requests & Approvals                                            | Matches `attendanceNavigation` and route policy.                                                                                |
| Feature module                | `apps/web/src/features/leave/`                                                                    | API, page, table, dialog, review panel, and status label modules.                                                               |
| Approved function             | “Create and review leave requests, including request-day inputs and decisions shown to the user.” | Supported by current source.                                                                                                    |
| Current implementation status | Route, page, feature module, API router/service, and persistence models are present in source.    | Runtime correctness remains unverified because test execution was not authorized.                                               |
| Mapping discrepancy           | None found for PG-011 route, component, module, or feature owner.                                 | The Phase 1 dependency inventory groups the leave API at family level; this report adds the operation-level endpoint map below. |

Phase 1 classifies the existing test coverage as PARTIAL and states that request-form and decision-role page coverage are needed. Current source review confirms that gap: API workflow coverage is strong, while the request dialog and several page-level list/form flows lack direct browser assertions.

## Route, layouts, providers, and navigation

The route source is a small async Next.js page. It reads the optional `request` query value, passes it as `linkedId`, and keys the client component by that ID (`apps/web/src/app/(portal)/attendance/requests/leave/page.tsx:3-10`). No leave-specific redirect alias was found. The canonical link is in the Attendance “Requests & Approvals” navigation group (`apps/web/src/features/attendance/model/navigation.ts:45-72`). Other entry points are:

- Requests overview links to the leave queue (`apps/web/src/features/attendance/pages/requests-overview-page.tsx:353`).
- Leave workflow notifications link to `/attendance/requests/leave?request=<entityId>` (`apps/web/src/features/workflow-notifications/components/workflow-notifications.tsx:136-149`).
- Approved leave appears in project-calendar data that links back to the canonical page (`apps/api/src/features/projects/calendar.service.ts:355`).

The portal layout obtains the account, checks `isRouteDenied`, displays account loading/error states, and redirects denied users (`apps/web/src/components/layout/portal-layout.tsx:21-64`). It wraps the rendered page in `AccountContext`, preferences, breadcrumb, role-layout, and for internal roles the workspace provider. The page itself is client-rendered under `AttendanceShell` (`apps/web/src/features/leave/pages/leave-requests-page.tsx:1-3,147-151`).

Route policy is generated from `attendanceNavigation` (`apps/web/src/features/workspaces/model/route-policy.ts:352-394,739`). The leave link has `access: "self"`, which resolves to `canAccessAttendance`: an active STAFF or ADMIN, or an active SUPERADMIN with `employees:read` (`apps/web/src/features/auth/model/permissions.ts:92-100`). UI manager controls use the separate `canManageAttendance` helper: privileged roles also need `employees:read`, while a STAFF Department Head can manage their department (`permissions.ts:102-109`). The personal-control predicate allows active STAFF and ADMIN (`permissions.ts:111-115`).

## Frontend behavior and state

`LeaveRequestsPage` initializes manager scope to `team` and other users to `mine`; a user with both manager and personal access can switch between them. Search, type, status, date range, and page are client state. Search waits 200 ms before loading and disables the resource while unsettled. Any search/filter/scope change resets page to 1. List requests use `useAsyncResource`; a `linkedId` switches the request to a detail fetch and makes the resulting one-item view read-only. Resource errors are surfaced through `LeaveRequestTable` with retry. After a review action, the page retries the list; a specific stale-version 409 reloads detail and refreshes capabilities, while an inaccessible detail closes and clears the selection (`leave-requests-page.tsx:30-145`).

| UI control/state     | Source behavior                                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request leave        | Shown when `canAccessPersonalAttendance` is true. Opens `LeaveRequestDialog`; success retries the list.                                                                                                           |
| Mine/team toggle     | Shown only when both manager and personal access are true. “Department requests” is used for STAFF managers and “Organization requests” for other managers.                                                       |
| Search               | `SearchField`, max length 100; searches employee or reason in the API; 200 ms debounce.                                                                                                                           |
| Type/status filters  | Empty value means all. Supported types: Annual, Sick, Emergency, Unpaid, Other. Supported statuses: Submitted, Verified, Approved, Rejected, Cancelled, Reversed.                                                 |
| Date filters         | Paired `from`/`to` native date inputs; `from` has `max=to` and `to` has `min=from`. Client sends the pair only when both are nonempty.                                                                            |
| Pagination           | Shared `AttendancePagination`; page changes load the corresponding API page and is disabled during load/search debounce.                                                                                          |
| Request table        | Shows employee and department, type, UTC-formatted date range, summed leave hours, status label, and capability-derived row menu. At container width <=900px it reflows to two columns.                           |
| Row actions          | “View details” is always present. Verify/approve/reject/cancel/reverse are added only when the API capability says the action is available.                                                                       |
| Details/review panel | Read-only view displays summary, private reason, per-day policy coverage, and decision history. Action view adds a required decision note (5-2000 characters).                                                    |
| Cancel/reverse       | Form submit first opens a `ConfirmationDialog`; it describes whole-request cancellation or reversal effects. The backend call happens only on confirmation.                                                       |
| Request dialog       | Defaults to Annual leave; requires start/end date and reason. Type options are source-defined. Escape dismissal is disabled; Cancel closes; pending submission disables close and input controls.                 |
| Preview              | Once both dates match `YYYY-MM-DD` and start <= end, POST preview runs. A status region reports working days and hours, preview failure, or calculation progress. Submit remains disabled until preview succeeds. |
| Feedback             | Request/review success uses toast feedback. Request failures stay in the dialog; action failures stay in the panel.                                                                                               |

Detailed source references: page `leave-requests-page.tsx:30-306`; table `leave-request-table.tsx:19-196`; dialog `leave-request-dialog.tsx:21-179`; review panel `leave-review-panel.tsx:23-217`; status mapper `model/leave-status.ts:1-19`; shared resource hook `apps/web/src/lib/use-async-resource.ts:25-90`; shared pagination/status components `features/attendance/components/attendance-shared.tsx:13-101`.

## API and backend trace

The web client uses same-origin `/api/leave/...` requests (`apps/web/src/features/leave/api/leave-api.ts:73-145`). Express mounts the leave router with `requireAuth`, a UUID path-parameter guard, and direct service calls; there is no separate controller layer (`apps/api/src/features/leave/routes.ts:6-49`).

| Method and path                                                              | Caller                      | Backend service behavior                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/leave/preview`                                                    | Request dialog              | Validates exact calendar dates and current employee/policy coverage; returns per-day snapshots and total minutes. It does not create a request.                                                                           |
| `GET /api/leave/requests?scope&page&search&type&status&from&to`              | Main page                   | Validates allowed query keys and filters, applies actor-derived data scope, returns deterministic created-time/ID order, page metadata, request details, and capabilities.                                                |
| `GET /api/leave/requests/:requestId`                                         | Deep-link or detail refresh | Returns a scoped request or a non-disclosing 404.                                                                                                                                                                         |
| `POST /api/leave/requests`                                                   | Request dialog              | Validates fields, resolves current requester/employee, applies idempotency and overlap checks, calculates policy-day snapshots, creates request/initial decision/notices transactionally; returns 201.                    |
| `POST /api/leave/requests/:requestId/{verify,approve,reject,cancel,reverse}` | Review panel                | Validates action ID, expected version, optional/required note; locks/reloads current state, re-evaluates scope/capability and approval conflicts, then records decision/status/version and notifications transactionally. |
| `GET /api/leave/overview?scope`                                              | Not called by PG-011 page   | Used by other page(s); do not include it as direct PG-011 page behavior.                                                                                                                                                  |

Service/schema evidence: routes `routes.ts:6-49`; schemas `leave.schema.ts:4-87`; service actor/coverage/capability/scope/conflict logic `leave.service.ts:79-395`; preview and submit/list/detail/overview `leave.service.ts:398-638`; action and locks/state transition `leave.service.ts:639-773`; routing, review head, transfer notification, and attendance overlap helpers `leave.repository.ts:31-206`.

### Validation and source-defined outcomes

- The body/query object is whitelisted; unsupported keys are rejected with 400 (`leave.schema.ts:24-30`).
- Reason and decision notes are trimmed and require 5-2000 characters. Cancellation note is optional; other action notes are required (`leave.schema.ts:33-41`; `leave.service.ts:642-650`).
- Request keys/action IDs are UUIDs; dates must be exact valid `YYYY-MM-DD`; ranges contain 1-366 inclusive dates; type/status and expected-version fields use enums/positive integer validation (`leave.schema.ts:43-87`).
- Preview/submission calculate days from assigned attendance-policy periods. Every inclusive calendar date needs exactly one applicable assignment, a complete weekday rule, and a covered working minute; no positive leave minutes is rejected. Date/day snapshots preserve timezone, policy name, assignment, and minute values (`leave.service.ts:106-164`).
- Active overlap of leave requests is rejected with 409. A matching requester/requestKey payload replays idempotently; a mismatched payload conflicts. Request, day snapshots, initial decision, and route notices are created in a transaction (`leave.service.ts:422-525`).
- Review capabilities are recomputed from active actor, current role, ownership, current Department Head, status, route department, fallback state, and employee placement (`leave.service.ts:79-105,169-217`). STAFF reviewers cannot review their own request; Head review is department-scoped; privileged review requires `employees:read` and relevant status/route conditions (`leave.service.ts:219-278`).
- Approval rechecks active requester/employee, recalculates day snapshots, and rejects recorded attendance or overlapping attendance-adjustment requests with 409 (`leave.service.ts:311-395`).
- Actions lock related department/employee/user/request rows, check action replay and expected version, re-evaluate capability, append decision, update status/version, and create notification in one transaction (`leave.service.ts:639-773`).

## Authorization and data isolation

Frontend route access, UI visibility, backend authentication, action capability, and record scope are separate boundaries.

| Boundary                 | Source-defined rule                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route gate               | Active STAFF/ADMIN; active SUPERADMIN requires `employees:read`; other roles denied. PortalLayout redirects denied accounts.                                            |
| Personal UI controls     | Active STAFF/ADMIN get personal controls; source does not additionally require a linked Employee profile in the front-end predicate.                                    |
| Team UI controls         | STAFF Head or privileged role with `employees:read`; manager with personal access can switch to mine.                                                                   |
| API authentication       | Every leave endpoint inherits `requireAuth`. Service `actor` rejects inactive/deleted accounts and USER role.                                                           |
| Mine list/preview/submit | Backend resolves the current linked Employee and enforces requester self-service; mine scope without Employee is rejected.                                              |
| STAFF team               | Requires current Head-of-department relationship; request subject cannot act on their own request.                                                                      |
| ADMIN team               | Requires `employees:read`; list includes non-SUBMITTED requests plus specifically routed fallback submissions; ADMIN's own requests remain visible in applicable scope. |
| SUPERADMIN team          | Requires `employees:read`; can read organization scope. Self-review is excluded.                                                                                        |
| Detail/action            | Current record and current actor scope/capabilities are re-evaluated. Hidden records resolve as 404; unauthorized operations do not mutate.                             |

The above is taken from `permissions.ts:92-115`, `route-policy.ts:352-394`, router `routes.ts:6-49`, and service `leave.service.ts:79-105,219-278,639-773`. Tests must independently cover API enforcement; route/UI checks alone do not establish data isolation.

## Persistence and relationships

Prisma models are `LeaveRequest`, `LeaveRequestDay`, `LeaveDecision`, `WorkflowNotification`, `Employee`, `User`, `Department`, `AttendancePolicy`, `AttendancePolicyDay`, `AttendancePolicyAssignment`, attendance session/workday, and `AttendanceAdjustment` (`apps/api/prisma/schema.prisma:1237-1318` plus referenced model relations). `LeaveRequest` uniquely scopes `requestKey` by requester and stores route department, status, version, and timestamps. A request day stores unique request/workDate snapshots and has an employee/workDate index. A decision stores the action ID and version; action IDs are unique per request and actor. Notifications are unique by user/request/type/version. Approval and action persistence are transactional; no controller/database boundary is absent for the operations above.

## Shared components and known risks

`LeaveRequestTable` uses `apps/web/src/components/ui/row-actions-menu.tsx:45-187`. The menu’s keyboard-open behavior uses ArrowDown and Radix menu semantics. The same shared component is linked to confirmed defect `PG-004-D-001`; PG-010 T035 reproduced the keyboard failure at 390, 820, and 1440 px. PG-011 must have its own assertion at these widths. This is a risk only; no PG-011 reproduction was executed.

The page also uses shared `FilterSelect`, `DateInput`, `ResponsiveDataTable`, `SidePanel`, `ConfirmationDialog`, `useAsyncResource`, and `AttendancePagination`. Their presence supports focused integration assertions, but their shared use does not prove the leave route works correctly. Historical PG-006 T024 is still an intermittent 820 px result and is not attributed to PG-011.

## Contracts and discovery limitations

1. **Profileless ADMIN self-service contract.** `canAccessPersonalAttendance` displays “Request leave” for active ADMIN, while manager status and team access require `employees:read`; API mine/preview/submit requires a linked Employee. The source does not state whether a profileless ADMIN should have the button hidden, be allowed to submit through another employee association, or receive a UI recovery message. Existing PG-006 profileless ADMIN 409 is a separate page finding, not evidence of a PG-011 defect. Keep its page/UI expectation contract-blocked; verify backend no-write scope independently.
2. **Selected panel when filters/scope change.** The page keeps `selection` state while list query changes and falls back to the previously selected object if the row is absent from the newly loaded list. The intended product behavior when filters hide the selected request is not specified. Do not assert panel close/persistence until clarified.
3. **No current-source mapping mismatch or new defect is claimed.** The discovery is static. Browser execution is explicitly out of scope.

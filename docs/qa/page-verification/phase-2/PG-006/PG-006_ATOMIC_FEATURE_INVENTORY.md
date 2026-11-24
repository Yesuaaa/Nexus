# PG-006 Atomic Feature Inventory

**Page:** PG-006, `/attendance/check-ins`  
**Primary source:** `MyAttendancePage`  
**Method:** Split the Phase 1 F001 page cluster only where current source has independent state or actions.

## Atomic behaviors

### PG-006-F001-A001 — Personal route and navigation access

| Field                       | Source-backed behavior                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| User action / trigger       | Open Check-Ins from Attendance navigation, open the canonical URL, or follow AL-001 `/attendance/my`.                                       |
| Handler / state             | Portal route policy evaluates `canAccessPersonalAttendance`; AL-001 redirects to the canonical route. This page has no local route state.   |
| Validation / authorization  | Active STAFF or ADMIN; USER and SUPERADMIN are excluded. No employees-read permission or department-head role is required.                  |
| API / backend authorization | No PG-006 read is issued until the page renders; API calls are independently authenticated and resolve the caller's own employee.           |
| Success / failure           | Eligible accounts see Check-Ins; denied accounts are redirected by PortalLayout. The legacy alias resolves to `/attendance/check-ins`.      |
| Database                    | None for navigation; downstream personal APIs use User and Employee.                                                                        |
| Evidence                    | `permissions.ts:111-117`; `route-policy.ts:352-394,426-430`; `navigation.ts:1-57`; `portal-layout.tsx:21-69`; `attendance/my/page.tsx:1-4`. |

### PG-006-F001-A002 — Load and refresh personal attendance state

| Field                       | Source-backed behavior                                                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User action / trigger       | Initial page load, visibility return, Refresh button, successful action, or Retry after a current-state failure.                                                     |
| Handler / state             | `useAttendanceClock` calls `currentAttendance`, tracks state/error/loading/pending, ignores aborted/stale responses by sequence, and updates the server-time anchor. |
| Validation / authorization  | API requires an active STAFF/ADMIN account and an Employee profile linked to that account. No profile returns 409.                                                   |
| API / backend authorization | `GET /api/attendance/me/current`; `requireAuth` → `selfEmployee`.                                                                                                    |
| Success / failure           | Current state is rendered; failures show an alert and Retry. Initial loading is announced with a status region.                                                      |
| Database                    | User, Employee, AttendancePolicyAssignment/Policy, AttendanceWorkday, AttendanceWorkSession, AttendanceBreak, and approved leave rows as needed.                     |
| Evidence                    | `my-attendance-page.tsx:42-119`; `use-attendance-clock.ts:12-64`; `attendance-api.ts:165-166`; `attendance.service.ts:37-76,441-554`.                                |

### PG-006-F001-A003 — Display live work time and daily requirement

| Field                       | Source-backed behavior                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User action / trigger       | Current-state response arrives or the one-second elapsed timer advances.                                                                                           |
| Handler / state             | `elapsedWork`, `duration`, and the `worked`/`target` calculations derive live worked time, remaining/excess time, state pill, and progress.                        |
| Validation / authorization  | Time is based on the server `asOf` anchor; unpaid breaks are subtracted, paid breaks are not, and elapsed time is clamped to session end/suspension and `asOf`.    |
| API / backend authorization | Uses `GET /me/current`; server response is scoped to self.                                                                                                         |
| Success / failure           | Shows “Clocked in”, “On unpaid break”, “Shift suspended”, “Clocked out”, or “Not started”, plus required-hours progress and schedule/policy details where present. |
| Database                    | Workday, session, break, policy assignment/day; summary also uses approved leave.                                                                                  |
| Evidence                    | `my-attendance-page.tsx:60-68,132-333`; `model/attendance.ts:44-92`; `attendance.summary.ts:15-160`.                                                               |

### PG-006-F001-A004 — Clock in or continue an overnight workday

| Field                       | Source-backed behavior                                                                                                                                                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User action / trigger       | Click Clock in or Continue `<workDate>`, then confirm.                                                                                                                                                                                                                  |
| Handler / state             | `propose` opens ConfirmationDialog; `clock.act` posts the typed action; accepted state replaces the snapshot and history is refreshed. Continuation includes the server-provided workday ID.                                                                            |
| Validation / authorization  | Only an active self employee may clock in; one open session is allowed. Policy and employee status must permit it. A continuation must be the current effective workday or a valid latest overnight continuation. Client-supplied timestamps/employee IDs are rejected. |
| API / backend authorization | `POST /api/attendance/me/clock-in`, 201; `requireAuth`, `selfEmployee(write=true)`, policy/leave/active-session checks in a transaction.                                                                                                                                |
| Success / failure           | Creates a session on the selected policy workday; 400/403/404/409 conditions are returned as errors in the confirmation dialog. Continuation adds a session to the prior workday.                                                                                       |
| Database                    | Employee, policy assignment, workday, session, leave, audit context.                                                                                                                                                                                                    |
| Evidence                    | `my-attendance-page.tsx:78-148,185-202,423-439`; `attendance-api.ts:150-178`; `attendance.schema.ts:13-39`; `attendance.service.ts:329-389,441-554`.                                                                                                                    |

### PG-006-F001-A005 — Start or end an unpaid break

| Field                       | Source-backed behavior                                                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User action / trigger       | On an active session, click Start break or End break and confirm.                                                                                                                                                  |
| Handler / state             | `propose` opens the confirmation dialog; `clock.act` posts `break-start` or `break-end`; current state and elapsed time update.                                                                                    |
| Validation / authorization  | Breaks require an owned active, non-suspended session. Starting requires policy-enabled unpaid breaks and no active break; ending requires the matching active unpaid break ID and an end instant after its start. |
| API / backend authorization | `POST /api/attendance/me/breaks/start` and `/breaks/end`; session is looked up for the caller's employee inside a transaction.                                                                                     |
| Success / failure           | Start creates an unpaid break and pauses worked time; end closes it and resumes time. Invalid/replayed transitions return 400/404/409.                                                                             |
| Database                    | AttendanceWorkSession and AttendanceBreak; policy values come from the assigned workday.                                                                                                                           |
| Evidence                    | `my-attendance-page.tsx:206-241,268-275`; `attendance-api.ts:167-178`; `attendance.service.ts:382-435`.                                                                                                            |

### PG-006-F001-A006 — Clock out and close an active session

| Field                       | Source-backed behavior                                                                                                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User action / trigger       | Click Clock out and confirm while a session is active, including while a break is active.                                                                                                                                  |
| Handler / state             | Confirmation submits `clock-out` with the active session ID; response state is accepted and history is reloaded.                                                                                                           |
| Validation / authorization  | Session must belong to the caller, remain active, and not be suspended. End time must follow session and break times. API time is authoritative.                                                                           |
| API / backend authorization | `POST /api/attendance/me/clock-out`, `requireAuth`, locked self employee/department placement, owned session, transaction.                                                                                                 |
| Success / failure           | Closes the session; an active break closes at the same instant. An approved-leave overlap does not prevent an active session from being ended; API records conflict context/notifications and the page warns the employee. |
| Database                    | Employee, AttendanceWorkSession, AttendanceBreak, AttendanceAudit, and leave/notification rows where a conflict exists.                                                                                                    |
| Evidence                    | `my-attendance-page.tsx:242-257,323-329,423-439`; `attendance.service.ts:220-279,329-435`.                                                                                                                                 |

### PG-006-F001-A007 — Show policy and clock-in blockers

| Field                       | Source-backed behavior                                                                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User action / trigger       | Current API state indicates missing policy, a blocked clock-in reason, a suspended session, or an approved-leave conflict.                                                  |
| Handler / state             | Page derives `suspended`, `blocked`, `clockInReason`, and `leaveConflict`; action controls are hidden or disabled according to returned state.                              |
| Validation / authorization  | Policy assignment, employee ACTIVE status, active session ordering, approved leave coverage, and suspension are enforced by API service logic.                              |
| API / backend authorization | `GET /me/current` returns `needsPolicy`, `clockInBlockedReason`, `continuation`, and leave-conflict state; POST clock-in revalidates in a transaction.                      |
| Success / failure           | No policy prompts HR setup; suspended work blocks clock-in and points to Time Logs; an active leave-conflicted session remains closable and shows a reconciliation warning. |
| Database                    | Employee status, policy assignment/day, workday/session, leave request/day.                                                                                                 |
| Evidence                    | `my-attendance-page.tsx:72-119,153-176,323-333`; `attendance.service.ts:145-179,441-554`; `leave.repository.ts` through attendance service imports.                         |

### PG-006-F001-A008 — Filter and paginate personal history

| Field                       | Source-backed behavior                                                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User action / trigger       | Change From/Through or choose a history page.                                                                                                                         |
| Handler / state             | Range change stores both dates and resets page to 1; page selection changes page. `useAsyncResource` keys each request by range/page/revision/suspension.             |
| Validation / authorization  | Both dates are required for a request; strict `YYYY-MM-DD`, non-reversed, maximum 366-day inclusive span, decimal page 1–100,000; extra query keys are rejected.      |
| API / backend authorization | `GET /api/attendance/me/history?from=…&to=…&page=…`; server resolves the caller's own Employee and never accepts an employee selector in this query.                  |
| Success / failure           | Returns date-filtered/paginated workdays; range/page controls reflect the selected values. Errors show Retry.                                                         |
| Database                    | Employee, AttendanceWorkday/Session/Break, Assignment/Policy, and leave records included by reporting.                                                                |
| Evidence                    | `my-attendance-page.tsx:51-69,353-405`; `attendance-shared.tsx:68-120`; `attendance-api.ts:180-193`; `attendance.schema.ts:42-79`; `attendance.reporting.ts:128-163`. |

### PG-006-F001-A009 — Render history rows and inspect workday details

| Field                       | Source-backed behavior                                                                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User action / trigger       | Inspect rows, open a row's actions menu, select View details, then close with Done/close/Escape.                                                                                                                |
| Handler / state             | `AttendanceHistoryTable` derives status, time labels, warnings, and selected details; `AttendanceHistoryDetailsPanel` renders a SidePanel and returns focus to its row trigger.                                 |
| Validation / authorization  | All detail rows come from the caller's own history response. A correction action is offered per session; a reconciliation action only renders when supplied by another caller/page and is not passed by PG-006. |
| API / backend authorization | History read is self-scoped. Opening details is local state and makes no request.                                                                                                                               |
| Success / failure           | Shows workday, policy/timezone/schedule, worked/required, status, sessions, breaks, and pending corrections; empty/no-session states have explicit text.                                                        |
| Database                    | Attendance report rows and related session/break/assignment/leave data.                                                                                                                                         |
| Evidence                    | `attendance-history.tsx:40-240`; `attendance-history-details-panel.tsx:31-214`; `side-panel.tsx:66-129`; `row-actions-menu.tsx`.                                                                                |

### PG-006-F001-A010 — Request missing attendance or a session correction

| Field                       | Source-backed behavior                                                                                                                                                                                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User action / trigger       | Click Request missing attendance, or open history details and click Request correction for a session.                                                                                                                                                                                                          |
| Handler / state             | `AdjustmentDialog` collects actual start/end local times, optional repeated-time offset, and reason; submit calls `requestAttendanceAdjustment`.                                                                                                                                                               |
| Validation / authorization  | Times must resolve to instants and end after start; reason is required and 5–2,000 characters. API checks active self employee, UUID request key, timestamp format/order/future time, optional owned session, breaks/leave/overlap/policy constraints, pending duplicates, and request-key replay consistency. |
| API / backend authorization | `POST /api/attendance/adjustments`, authenticated self employee, transaction, optional `sessionId`. PG-006 does not expose review controls.                                                                                                                                                                    |
| Success / failure           | Creates a correction request and notification; page shows success, closes dialog, and refreshes current/history. API errors remain visible in the dialog.                                                                                                                                                      |
| Database                    | AttendanceAdjustment, optional AttendanceWorkSession/Workday, employee/user, workflow notification, audit context, leave/policy records for validation.                                                                                                                                                        |
| Evidence                    | `my-attendance-page.tsx:353-366,435-445`; `adjustment-dialog.tsx:26-169`; `attendance-date-time-input.tsx:1-100`; `attendance-api.ts:429-441`; `attendance.management.ts:101-116,192-263,1506-1597`.                                                                                                           |

### PG-006-F001-A011 — Confirm actions and recover from action errors

| Field                       | Source-backed behavior                                                                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User action / trigger       | Confirm or cancel a clock/break action; retry a failed current/history load or handle a failed action submission.                                                                  |
| Handler / state             | ConfirmationDialog guards pending/close state; `clock.act` marks pending, invalidates older refreshes, accepts successful state, catches failures, and refreshes after completion. |
| Validation / authorization  | While pending, duplicate submission is ignored/disabled; API remains the authoritative concurrency guard.                                                                          |
| API / backend authorization | Uses the action endpoints in A004–A006; `useAsyncResource.retry` increments its request revision for history.                                                                      |
| Success / failure           | Success closes confirmation and shows a toast; a failure remains in the dialog with an error. Retry updates the appropriate read.                                                  |
| Database                    | No extra model; success/failure is over A004–A010 operations.                                                                                                                      |
| Evidence                    | `my-attendance-page.tsx:80-91,423-445`; `use-attendance-clock.ts:30-86`; `use-async-resource.ts:25-96`; `confirmation-dialog.tsx`.                                                 |

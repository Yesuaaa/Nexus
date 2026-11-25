# PG-006 Functional Discovery

**Phase:** 2.1 — source discovery and test design only  
**Page:** PG-006, `/attendance/check-ins`  
**Discovery status:** Complete from current source. No tests were run and no source code was changed.

## Repository baseline

| Item                             | Evidence                                                                                                                                                                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch                           | `293-test-full-system-audit-for-verifying-recent-changes`                                                                                                                                                                                                 |
| HEAD                             | `607d3242c7a8a679cfac02a07b041ad2b95d2d2b`                                                                                                                                                                                                                |
| Worktree                         | Clean; no tracked modifications or untracked files at task entry.                                                                                                                                                                                         |
| Request baseline                 | `64535202df403eb6f3a8e80ff3a7e6385d1dbc2b`                                                                                                                                                                                                                |
| Difference from request baseline | `git diff 64535202df403eb6f3a8e80ff3a7e6385d1dbc2b..HEAD` contains 15 PG-005 files: the PG-005 test additions, its seven design reports and four execution reports, plus the cumulative ledger update. No production/schema source differs in that range. |
| Phase 1 / planning files         | All nine Phase 1 reports, `PHASE_2_TEST_PLANNING_BASELINE.md`, and `PHASE_2_PROGRESS_LEDGER.md` are present.                                                                                                                                              |

The current checkout is authoritative. The prior PG-005 baseline and the Phase 1 historical snapshot remain documented as history; no branch or repository state was changed.

## Page identity and Phase 1 reconciliation

| Concern                       | Current source                                                                                                                                                                                                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stable ID and canonical route | PG-006, `/attendance/check-ins`, matching the approved route inventory.                                                                                                                                                                                                                                           |
| Next.js route file            | `apps/web/src/app/(portal)/attendance/check-ins/page.tsx`, a static page importing and rendering `MyAttendancePage`.                                                                                                                                                                                              |
| Primary component             | `MyAttendancePage` in `apps/web/src/features/attendance/pages/my-attendance-page.tsx`.                                                                                                                                                                                                                            |
| Feature ownership             | Workforce Compliance / Attendance, feature-driven under `apps/web/src/features/attendance/`.                                                                                                                                                                                                                      |
| Shared layout/providers       | Root `AuthProvider`; portal `PortalLayout` and `RoleLayout`; `AccountContext`, `PreferencesProvider`, `BreadcrumbLabelProvider`, and `WorkspaceProvider` for non-USER roles. No PG-006-specific provider or layout exists.                                                                                        |
| Route access                  | `canAccessPersonalAttendance`: active `STAFF` or `ADMIN`. USER and SUPERADMIN are excluded; `employees:read` is not required for this personal page. `PortalLayout` evaluates the route policy before rendering the page.                                                                                         |
| Navigation                    | The Attendance navigation group includes Overview and Check-Ins; Check-Ins points to `/attendance/check-ins`. The Attendance overview page also links to this route. Legacy `/attendance/my` redirects to the canonical route (AL-001). PG-003 `/attendance` sends eligible personal-attendance accounts here.    |
| Web API clients               | `attendance-api.ts`: `currentAttendance`, `attendanceHistory`, `mutateAttendance`, and `requestAttendanceAdjustment`; requests use same-origin `/api/attendance/...`.                                                                                                                                             |
| Backend                       | `/api/attendance` Express router; all attendance routes are behind `requireAuth`. Personal current/history/actions resolve the caller's own `Employee`; request submission uses the attendance management service.                                                                                                |
| Persistence relationships     | `User` ↔ optional `Employee`; `AttendancePolicyAssignment` ↔ `AttendancePolicy`; `AttendanceWorkday` ↔ employee/assignment; `AttendanceWorkSession` ↔ workday/employee; `AttendanceBreak` ↔ session; `AttendanceAdjustment` ↔ employee and optional session; approved leave records affect current workday state. |
| Current status                | Page and all traced source paths are implemented. This is source verification, not runtime verification.                                                                                                                                                                                                          |

The route, Next.js page file, and primary component match Phase 1 exactly. Phase 1 grouped the attendance routes under the attendance API family; direct inspection narrows PG-006 to the self-service attendance endpoints and the shared correction-request endpoint. The page imports no leave API client directly. Leave affects the returned current state and server-side attendance rules through the attendance service and leave repository.

## Source trace

```text
Portal route gate and Attendance navigation
  → (portal)/attendance/check-ins/page.tsx
  → MyAttendancePage
  → useAttendanceClock + useAsyncResource + AttendanceHistoryTable
  → attendance-api.ts (/api/attendance/me/* and /api/attendance/adjustments)
  → createAttendanceRouter + attendanceHandlers / attendance management
  → selfEmployee ownership, action/history parsers, policy and session services
  → AttendancePolicyAssignment / AttendanceWorkday / AttendanceWorkSession /
    AttendanceBreak / AttendanceAdjustment and related employee/leave rows
```

The page loads `GET /me/current` and `GET /me/history`. It submits clock actions to `POST /me/clock-in`, `/me/clock-out`, `/me/breaks/start`, and `/me/breaks/end`. Correction requests use `POST /adjustments`; that shared API is also used by other attendance request surfaces. The page does not call management overview, employee-directory, search, audit, or leave endpoints.

## Current user-visible behavior

### Current workday and action controls

- On mount, the page loads current attendance state. While that request is pending it announces “Loading attendance policy”; a failure shows a retry alert. `useAttendanceClock` refreshes when the page becomes visible, anchors its timer to the API's `asOf`, and advances elapsed time every second using `performance.now()`.
- If no policy is assigned, the page displays an HR configuration message and omits a workday action card. A returned clock-in block reason or a suspended shift also prevents clock-in. Approved leave conflict is displayed on an active workday, while the page tells the employee they can still end an active session.
- When a current workday exists, the page displays elapsed worked time, active/paused/suspended/completed status, required hours, remaining or excess time, working-day and unpaid-break policy values, and schedule details where present.
- Clock in, continue overnight workday, start/end break, and clock out all open a confirmation dialog. The action uses server time; timestamps and employee identity are not accepted from the client. A successful action updates current state and refreshes history. A failure leaves the confirmation dialog open with an error.
- While on an unpaid break, the timer is paused. Clock out during an active break ends the break and the session together. A continuation action can attach another session to the previous overnight workday.

### Personal history and corrections

- History defaults to a date range and is loaded independently of current state. From/Through controls set native min/max bounds and reset the page to 1. The page requests `GET /me/history?from=…&to=…&page=…`; there is no search, sorting, employee selector, or export control.
- History has initial skeleton rows, an empty-state message, a retry alert, and pagination. The shared async resource retains the last successful `data` while another request is pending or after a failure; the page still renders that data. The table is not passed the `loading` prop during these refreshes, although pagination is disabled while loading.
- Rows group sessions by assigned attendance workday and display policy-zone timestamps, elapsed/required time, status, pending correction, overnight, and schedule warnings. A row action opens a read-only detail panel with workday, session, break, schedule, and correction details. The detail panel's session action opens an attendance correction form.
- “Request missing attendance” opens the same correction dialog without a linked session. The dialog accepts actual clock-in/out instants and a required 5–2,000-character reason. It describes date/time values in the device timezone and handles nonexistent or repeated local times. Submission closes the dialog on success, toasts, and refreshes current/history data; errors remain in the dialog.

## Contracts and boundaries

- **PG-006-C001 — clearing a history date:** a blank From or Through value disables the history request. `useAsyncResource` still returns the prior successful `data`, so those rows remain renderable. Product intent for blank dates is not documented. T025 is contract-blocked; do not assert that rows should clear, remain, or produce validation until the rule is approved.
- `defaultRange()` derives dates from the browser's current `Date` and converts them to ISO date strings. No product contract states whether “last 30 days” is based on the device calendar, UTC, or the employee policy timezone. Future filter tests should compare submitted query values with the visible inputs and avoid locking an unstated timezone rule.
- An active ADMIN passes the page route gate, but the attendance service requires an associated Employee profile for personal current/history/actions and returns 409 when no profile exists. This is explicit current API behavior and should be covered without implying that all ADMIN accounts have employee records.
- PG-004-D-001 is a confirmed keyboard row-action defect on `/attendance/adjustments`. PG-006's history table uses the shared `RowActionsMenu`; this is a relevant regression risk only. No PG-006 manifestation was observed or tested here.
- PG-003 C001 remains limited to the entry route's undocumented query/navigation state. It does not change PG-006 behavior. PG-005 T019/C001 and T020/C002 remain deferred and unchanged.

## Scope exclusions

No employee management, department scope selection, approval/rejection, reconciliation, policy configuration, workforce audit, or overtime controls appear on this page. The correction request can lead to downstream Head/HR review, but review decisions belong to other page/workflow scopes. No test suite or runtime workflow was executed.

## Evidence anchors

- Approved page route/component: `PHASE_1_COMPLETE_ROUTE_INVENTORY.md:16`; `PHASE_1_PAGE_COMPONENT_MAPPING.md:27`; `PHASE_1_PAGE_FUNCTIONALITY_INVENTORY.md:12`.
- Current route/layout/access: `apps/web/src/app/(portal)/attendance/check-ins/page.tsx:1-6`; `apps/web/src/components/layout/portal-layout.tsx:21-91`; `apps/web/src/features/auth/model/permissions.ts:111-117`; `apps/web/src/features/workspaces/model/route-policy.ts:352-394,426-430`.
- Navigation and redirect: `apps/web/src/features/attendance/model/navigation.ts:1-57`; `apps/web/src/app/(portal)/attendance/my/page.tsx:1-4`; `apps/web/src/features/attendance/pages/attendance-entry-page.tsx:8-17`.
- Main page and current-state hook: `apps/web/src/features/attendance/pages/my-attendance-page.tsx:42-440`; `apps/web/src/features/attendance/hooks/use-attendance-clock.ts:12-86`; `apps/web/src/lib/use-async-resource.ts:11-96`.
- History, detail, and correction UI: `apps/web/src/features/attendance/components/attendance-history.tsx:40-240`; `attendance-history-details-panel.tsx:31-214`; `attendance-shared.tsx:13-121`; `adjustment-dialog.tsx:26-169`; `attendance-date-time-input.tsx:1-100`.
- Client/API/server: `apps/web/src/features/attendance/api/attendance-api.ts:150-193,429-441`; `apps/api/src/app.ts:63-145`; `apps/api/src/features/attendance/routes.ts:11-28,159-169`; `attendance.controller.ts:9-35`; `attendance.schema.ts:5-79`.
- Services and persistence: `apps/api/src/features/attendance/attendance.service.ts:37-180,329-625`; `attendance.reporting.ts:128-163`; `attendance.summary.ts:15-160`; `attendance.management.ts:192-263,1506-1588`; `apps/api/prisma/schema.prisma:822-865,1474-1629`.

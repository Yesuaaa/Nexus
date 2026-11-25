# PG-007 Functional Discovery

**Phase:** 2.1 - discovery and test design only  
**Page ID:** PG-007  
**Canonical route:** `/attendance/overview`  
**Current discovery status:** COMPLETE for source inspection; no tests were run.

## Repository baseline

- Branch: `293-test-full-system-audit-for-verifying-recent-changes`
- HEAD: `972428afbcd3d48d7ca6b8084b6f2906c2de84bc`
- The request reported HEAD `607d3242c7a8a679cfac02a07b041ad2b95d2d2b`. Current HEAD is one commit later: `972428a test(PAGE-006): add tests, unit tests, and qa documentation`.
- `git status --porcelain=v2 --branch` was clean. No staged, tracked, or untracked worktree changes were present at discovery entry. No Git state was changed.
- All eight requested Phase 1/2 planning files and the Phase 2 ledger are present. PG-006's seven design records and four Phase 2.2 reports are also present.

## Approved identity and current source

| Field                 | Discovery                                                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stable page ID        | PG-007, preserved from Phase 1.                                                                                                                                                                                                                               |
| Canonical URL         | `/attendance/overview`.                                                                                                                                                                                                                                       |
| Next.js route         | `apps/web/src/app/(portal)/attendance/overview/page.tsx`, a static App Router page.                                                                                                                                                                           |
| Main component        | `AttendanceOverviewPage`, in `apps/web/src/features/attendance/pages/attendance-overview-page.tsx`.                                                                                                                                                           |
| Module                | Workforce Compliance / Attendance Monitoring.                                                                                                                                                                                                                 |
| Layout                | `(portal)/layout.tsx` renders `PortalLayout`; the component uses shared `AttendanceShell` with the `overview` tab.                                                                                                                                            |
| Providers             | `PortalLayout` supplies account context, preferences, breadcrumb labels, and the workspace provider for non-USER roles. The page has no route-specific provider.                                                                                              |
| Navigation            | Attendance self-access group: “Overview” (`attendance-overview`, `ariaLabel: Attendance Overview`) and “Check-Ins”. The page also links directly to `/attendance/check-ins`.                                                                                  |
| Frontend route policy | The exact overview link is governed by `canAccessPersonalAttendance`: active STAFF or ADMIN. USER and SUPERADMIN are excluded from this personal route. `PortalLayout` redirects denied USER accounts to `/dashboard` and other denied accounts to `/module`. |
| API                   | Same-origin `GET /api/attendance/me/overview?from=…&to=…`, through `personalAttendanceOverview` in `attendance-api.ts`.                                                                                                                                       |
| Backend route         | `GET /me/overview` in the authenticated `/api/attendance` router. It passes the session user ID and `personal=true` to attendance management.                                                                                                                 |
| Persistence           | `Employee`, `AttendanceWorkday`, `AttendanceWorkSession`, `AttendanceBreak`, `AttendancePolicyAssignment`, `LeaveRequest`, and `LeaveRequestDay`; read is performed in a Prisma `RepeatableRead` transaction.                                                 |

The Phase 1 route, component, functionality, and role identity match current source. The Phase 1 existing-test-coverage classification is less complete than the current tree: it labels PG-007 `INDIRECT`, but the current tree has direct overview browser and PGlite declarations described in [the baseline](PG-007_EXISTING_TEST_BASELINE.md). That is a coverage-inventory discrepancy, not evidence that those declarations pass now.

## Source trace

| Layer                       | Current implementation and evidence                                                                                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route                       | `page.tsx` returns `AttendanceOverviewPage`; no page-specific data or server component logic exists there.                                                                                                                                                                            |
| Component and state         | `AttendanceOverviewPage` initializes a `{from,to}` range with `defaultRange()`, calls `useAsyncResource`, and passes the range to `personalAttendanceOverview`. The page has no search, sort, pagination, detail panel, decision dialog, or write action.                             |
| Controls                    | `RangeFields` renders native date inputs with `max={to}` on From and `min={from}` on Through. The component's onChange updates the local range. Refresh calls the hook's `retry`; “Open Check-Ins” is a Next link.                                                                    |
| Async state                 | `useAsyncResource` keys requests by range, aborts a superseded request, ignores a stale completion, exposes retry, and holds prior data internally. The page masks data while loading/error. When a date is blank, `enabled` is false and no request runs.                            |
| API client                  | `personalAttendanceOverview(from,to,signal)` calls `apiRequest<AttendanceOverview>` with `/api/attendance/me/overview` and only the two date parameters.                                                                                                                              |
| Express                     | `createAttendanceRouter` applies `requireAuth` to the router. `/me/overview` calls `management.overview(req.auth.user.id, req.query, true)`. The app mounts the router at `/api/attendance`.                                                                                          |
| Service and scope           | `overview()` permits only `from` and `to` for personal calls, parses the date range, resolves the employee from the authenticated user through `selfEmployee`, invokes `attendanceReportOverview` scoped to that employee, and returns the summary in a `RepeatableRead` transaction. |
| Persistence and calculation | `attendance.reporting.ts` merges workdays with approved leave days by employee/date, filters by personal employee ID, loads workday/session/break records, and delegates workday calculations to `summarizeAttendance`. The overview aggregates session states and activity events.   |

## Source-defined page behavior

1. `defaultRange()` computes From as the current instant minus 30 × 24 hours and Through as the current instant plus 24 hours, then serializes both instants to UTC `YYYY-MM-DD` values. It is not a policy-time-zone lookup.
2. The page issues an initial request when both date strings are non-empty and issues another request when either value changes. It displays the selected date strings as “Attendance workdays”.
3. Refresh retries the current keyed request and is disabled while the resource is loading. The four-figure row exposes `aria-busy` while loading; page sections show skeletons.
4. The figure values are: `recordedDays`; total sessions; closed sessions with a rounded completed percentage; and `working + onBreak` sessions. The last figure is labeled “Still clocked in”.
5. “Check-in status” shows Clocked in, On unpaid break, and Clocked out counts and rounded shares when total session count is nonzero. It does not render a Suspended row, though the API returns a `suspended` count.
6. “Personal attendance” shows Personal scope, the selected range, total sessions divided by recorded days to one decimal (or an em dash when there are no recorded days), approved leave days, and `asOf` formatted in UTC.
7. “Recent check-in activity” maps CLOCK_IN, CLOCK_OUT, BREAK_START, and BREAK_END to labels, appends the API-provided employee name, and formats timestamps in UTC. The backend sends at most eight events ordered newest first, with an ID tie-break.
8. Empty sessions produce zero figures, “No check-ins in this period.”, and “No check-in activity in this period.” No status table is shown when the total is zero.
9. On request error the page presents the fallback alert and Retry button, dash placeholders for unavailable figures, and per-section unavailable messages. A successful retry clears the error.
10. Responsive styling changes the summary figures and section spacing at narrow widths. The current Playwright coverage names 390, 820, and 1440 px viewports.

## Access separation and error behavior

- The frontend personal route policy independently limits `/attendance/overview` to active STAFF/ADMIN accounts. A shared `/attendance` base route and other attendance groups use different predicates; do not conflate the overview link with broader attendance-management access.
- API access is separate. `requireAuth` rejects anonymous access; `selfEmployee` rechecks active/non-deleted account state, requires STAFF or ADMIN, resolves the employee linked to the session user, returns 403 for disallowed roles, and returns 409 if the employee profile is absent.
- Personal calls reject `departmentId` and `employeeId` query overrides. The personal employee scope is derived server-side; it is not supplied by the page.
- Date parsing accepts date-only `YYYY-MM-DD`, defaults missing bounds at the API layer, rejects invalid/reversed dates and spans exceeding 366 inclusive calendar dates, and rejects unknown query keys. The UI itself sends both values.
- API errors are surfaced by `useAsyncResource` through `ResourceStatus`; the page does not implement a separate setup flow for a missing employee profile.

## Shared-defect review and prior findings

PG-004-D-001 concerns the shared keyboard-operated `RowActionsMenu`. PG-007 does not render that menu or the Check-Ins history actions associated with PG-006 T018/T024, so there is no source basis to attribute that defect to PG-007. PG-007 does use shared `AttendanceShell`, `RangeFields`, `DateInput`, `useAsyncResource`, and overview display primitives; no confirmed PG-004/PG-006 finding currently names those components.

PG-006 remains **implementation complete, verification partially complete**: T018 reproduces PG-004-D-001; T024 is intermittent at 820 px; T025/C001 remains blocked; the default history timezone is unspecified; and active ADMIN without an Employee profile receives 409 with Retry as the only page recovery shown. This discovery neither changes nor resolves those findings. No tests were executed, and no source or test files were modified.

## Source references

- Phase 1 identity and expectations: `PHASE_1_COMPLETE_ROUTE_INVENTORY.md:17`, `PHASE_1_PAGE_COMPONENT_MAPPING.md:28`, `PHASE_1_PAGE_FUNCTIONALITY_INVENTORY.md:13`, `PHASE_1_PAGE_AUTHORIZATION_MATRIX.md:32`, and `PHASE_1_PAGE_API_DEPENDENCIES.md:11`.
- Route and page: `apps/web/src/app/(portal)/attendance/overview/page.tsx:1-4`; `apps/web/src/features/attendance/pages/attendance-overview-page.tsx:29-252`.
- Navigation/policy: `apps/web/src/features/attendance/model/navigation.ts:1-16`; `apps/web/src/features/workspaces/model/route-policy.ts:353-385`; `apps/web/src/features/auth/model/permissions.ts:111-116`; `apps/web/src/components/layout/portal-layout.tsx:23-34`.
- Query/state: `apps/web/src/features/attendance/model/attendance.ts:103-109`; `apps/web/src/features/attendance/components/attendance-shared.tsx:89-118`; `apps/web/src/lib/use-async-resource.ts:25-81`; `apps/web/src/features/attendance/api/attendance-api.ts:120-143,469-477`.
- API/service: `apps/api/src/app.ts:131`; `apps/api/src/features/attendance/routes.ts:10-11,159-161`; `apps/api/src/features/attendance/attendance.management.ts:638-761`; `apps/api/src/features/attendance/attendance.service.ts:25-57`.
- Reporting/models: `apps/api/src/features/attendance/attendance.reporting.ts:19-87,158-173`; `apps/api/src/features/attendance/attendance.summary.ts:20-137`; `apps/api/src/features/attendance/attendance.schema.ts:44-77`; `apps/api/prisma/schema.prisma:822-864,1280-1296,1519-1567`.

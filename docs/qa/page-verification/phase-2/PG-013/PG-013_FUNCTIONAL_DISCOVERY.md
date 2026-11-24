# PG-013 Functional Discovery

## Status and baseline

- Phase: 2.1 source discovery and test design only.
- Discovery: complete for the behavior implemented in the current repository.
- Test implementation and automated test execution: not authorized and not performed.
- Branch at task entry: 293-test-full-system-audit-for-verifying-recent-changes.
- Full task-entry HEAD: 03340d6136ec7d6680b9bbc68fa5738370d29398.
- Previously reported HEAD: 050fbc2b46b3a77d8785cf76a07c8c0a5c498e26. The single intervening commit is 03340d6, “test(PAGE-012): add tests, unit tests, and qa documentation.” It contains committed PG-012 test and QA work. The task-entry worktree had no staged, unstaged, or untracked changes. No branch or commit operation was performed.

## Approved identity and reconciliation

| Field                  | Approved/current value                                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stable page ID         | PG-013-F001                                                                                                                                                                         |
| Canonical URL          | /attendance/requests/overview                                                                                                                                                       |
| Route source           | apps/web/src/app/(portal)/attendance/requests/overview/page.tsx                                                                                                                     |
| Primary component      | AttendanceRequestsOverviewPage                                                                                                                                                      |
| Module                 | Workforce Compliance / Attendance requests and approvals                                                                                                                            |
| Feature source         | apps/web/src/features/attendance/pages/attendance-requests-overview-page.tsx                                                                                                        |
| Phase 1 reconciliation | Route inventory, component mapping, functionality inventory, and authorization matrix agree with the current route and component. No route alias or identity discrepancy was found. |

The Phase 1 existing-test-coverage table describes PG-013 as indirect coverage for summary counts and query-to-queue links (PHASE_1_EXISTING_TEST_COVERAGE.md:43). Current committed source includes the page-specific WC-06-F01 and WC-06-F03 browser declarations in apps/web/e2e/attendance.spec.ts:6499-7071. This is a documentation coverage-classification discrepancy: current source shows direct browser coverage. Reconcile the Phase 1 row during a later documentation reconciliation; do not rewrite the prior report here.

## Route, layout, providers, and navigation trace

| Boundary                        | Current implementation                                                                                                                    | Evidence                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Root auth provider              | AuthProvider wraps the application.                                                                                                       | apps/web/src/app/layout.tsx:4,34                                           |
| Portal route layout             | PortalLayout renders the route within the portal.                                                                                         | apps/web/src/app/(portal)/layout.tsx:1-6                                   |
| Account and workspace providers | PortalLayout supplies AccountContext, PreferencesProvider, BreadcrumbLabelProvider, WorkspaceProvider, and RoleLayout.                    | apps/web/src/components/layout/portal-layout.tsx:21-33,67-92               |
| Route entry                     | Thin route wrapper renders AttendanceRequestsOverviewPage.                                                                                | apps/web/src/app/(portal)/attendance/requests/overview/page.tsx:1-4        |
| Shared page shell               | AttendanceShell selects the Requests & Approvals Overview title, description, and active navigation tab.                                  | apps/web/src/features/attendance/components/attendance-shell.tsx:21-35,105 |
| Navigation                      | The Attendance Requests & Approvals group links to Overview, Overtime, Corrections, and Leave.                                            | apps/web/src/features/attendance/model/navigation.ts:43-72                 |
| Route policy                    | Attendance navigation links and route gates derive access from canAccessAttendance, canManageAttendance, and canAccessPersonalAttendance. | apps/web/src/features/workspaces/model/route-policy.ts:352-386,423-447     |

No page-specific authentication form or redirect alias exists. Unauthenticated handling is owned by the shared auth/portal route flow. The page itself consumes the authenticated portal account and does not implement a second route guard.

## Access and scope behavior

The route policy, page presentation, and API authorization are distinct boundaries:

| Boundary              | Source-defined behavior                                                                                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend route access | Active STAFF and ADMIN can access Attendance; SUPERADMIN requires employees:read. USER is not admitted by the Attendance access helper.                                                                                                                                                                                         |
| Manager view          | canManageAttendance admits an eligible ADMIN/SUPERADMIN or a Staff department head according to the attendance permission helpers.                                                                                                                                                                                              |
| Personal view         | canAccessPersonalAttendance admits active STAFF/ADMIN. It does not test whether an Employee profile exists.                                                                                                                                                                                                                     |
| Toggle visibility     | The view toggle renders only when both manager and personal-access helpers return true. A non-manager starts in My requests. A manager starts with the team scope; the component key includes account ID, role, Head department ID, and computed scope.                                                                         |
| Attendance endpoint   | requireAuth is applied to the Attendance router. The summary accepts mine/team; omitted scope currently takes the personal path. Personal scope resolves the caller's Employee and can return 409 when it is absent. Team scope uses managementScope, with additional ADMIN HR scoping.                                         |
| Leave endpoint        | requireAuth is applied to the Leave router. The summary requires explicit mine/team. Mine without an Employee profile returns 403. Team access requires a Staff Head relationship or employees:read for management roles. ADMIN pending Leave rows use submittedLeaveFallbackScope; SUPERADMIN receives the organization scope. |

Source references: apps/web/src/features/auth/model/permissions.ts:92-116; apps/web/src/features/workspaces/model/route-policy.ts:352-386; apps/api/src/features/attendance/routes.ts:11-16,101-103; apps/api/src/features/attendance/attendance.management.ts:358-373; apps/api/src/features/attendance/attendance.service.ts:27-57; apps/api/src/features/leave/routes.ts:6-19; apps/api/src/features/leave/leave.service.ts:79-92,219-258.

An active ADMIN without an Employee profile can pass the frontend personal-access helper. If that account selects My requests, source behavior differs between endpoints: Attendance personal scope may fail with 409 and Leave personal scope fails with 403. The page treats 401/403 as denial and removes summary data; other failures expose a retryable resource error. The intended toggle visibility and recovery semantics for this profileless account are not established as a product contract. Preserve PG-006's historical profileless-ADMIN 409/limited-recovery finding; this discovery does not create a new PG-013 defect.

## Initialization and displayed data

AttendanceRequestsOverviewPage starts the appropriate scope and mounts RequestSummaries. RequestSummaries independently requests the Attendance adjustment summary and Leave overview. It withholds the combined figures until both datasets are available. If either endpoint reports 401/403, it treats that response as a denial and withholds all count data. A non-denial request failure is surfaced through the shared ResourceStatus and Retry control. The page's two API calls are separate HTTP requests and separate RepeatableRead transactions; no cross-endpoint common snapshot is implemented.

The current transformations are source-defined:

- Leave SUBMITTED contributes to the overall Pending status.
- Attendance adjustment PENDING and Leave SUBMITTED both contribute to the overall Pending count.
- Attendance adjustment VERIFIED and Leave VERIFIED contribute to the overall Awaiting HR status.
- The Approved and Rejected figures combine matching statuses from both domains.
- The status distribution always constructs Pending, Verified, Approved, Rejected, Cancelled, and Reversed rows. For non-empty totals it shows counts and rounded percentage shares.
- Overtime and Corrections cards count AttendanceAdjustment groups by type, show the statuses present for that type, and link to their respective queue routes.
- Leave totals and status rows are derived from Leave groups. Rows with zero count are filtered from the Leave table.
- Needs attention includes Attendance adjustment PENDING/VERIFIED and Leave SUBMITTED/VERIFIED groups. Source copy labels these as pending or awaiting HR.
- When the overall total is zero, the overall status table is replaced by “No requests in this scope.” The Overtime, Corrections, Leave, and Needs attention sections each have source-defined empty copy.

Evidence: apps/web/src/features/attendance/pages/attendance-requests-overview-page.tsx:105-159,172-253,255-342,344-427.

## Controls and non-applicable behavior

The current page exposes the shared management-view toggle, three View requests navigation links, summary tables, and a shared Retry button on resource errors. It has no search, filter, sort, pagination, detail panel, row-action menu, submission form, mutation action, date control, confirmation dialog, upload, or download. These controls and workflows are not applicable to this page based on current source.

The static View requests links do not add the selected overview scope to their hrefs. Whether the selected My/Department/Organization scope should be transferred into the destination queue is unspecified. Record as a contract question; do not invent a propagation expectation.

## Frontend-to-persistence trace

| Layer          | Attendance summaries                                                                                                                                          | Leave summaries                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Page and state | AttendanceRequestsOverviewPage → RequestSummaries → useRequestSummary → useAsyncResource.                                                                     | Same page and resource wrapper.                                                                                                           |
| API client     | attendanceRequestSummary(scope, signal).                                                                                                                      | leaveOverview(scope, signal).                                                                                                             |
| Request        | GET /api/attendance/adjustments/overview?scope=mine or team.                                                                                                  | GET /api/leave/overview?scope=mine or team.                                                                                               |
| Router         | Attendance router mounted by apps/api/src/app.ts:131-132; GET /adjustments/overview uses requireAuth.                                                         | Leave router mounted by apps/api/src/app.ts:131-132; GET /overview uses requireAuth.                                                      |
| Service/query  | adjustmentOverview validates the query allowlist, resolves adjustmentScope, then groups by type and status.                                                   | overview validates the query allowlist, resolves scopeWhere, then groups by status and type.                                              |
| Persistence    | Read-only Prisma groupBy queries on AttendanceAdjustment; scope derives from Employee/Department and requester/reviewer identity. RepeatableRead transaction. | Read-only Prisma groupBy on LeaveRequest; scope derives from Employee/Department and review-submission scope. RepeatableRead transaction. |
| Writes         | None.                                                                                                                                                         | None.                                                                                                                                     |

Client evidence: apps/web/src/features/attendance/api/attendance-api.ts:460-468; apps/web/src/features/leave/api/leave-api.ts:103-107. Server evidence: apps/api/src/features/attendance/routes.ts:101-103; apps/api/src/features/attendance/attendance.management.ts:1380-1414; apps/api/src/features/leave/routes.ts:17-19; apps/api/src/features/leave/leave.service.ts:610-634.

Relevant Prisma models are AttendanceAdjustment, LeaveRequest, Employee, Department, and User: apps/api/prisma/schema.prisma:450-471,822-845,1251-1278,1606-1636. Both API groups are aggregates rather than paged record lists. Attendance response groups include type, status, count, overtimeMinutes, and awaitingHrPending; Leave response groups include status, type, and count. The page currently consumes type/status/count and does not display overtimeMinutes or awaitingHrPending directly.

## Loading, error, retry, keyboard, and responsive behavior

useAsyncResource aborts or ignores obsolete requests on dependency changes/unmount and exposes retry state; the page keys RequestSummaries on account and scope so changed authorization context remounts the summary resources. Shared ResourceStatus presents loading/error feedback and retry. Relevant source: apps/web/src/lib/use-async-resource.ts:11-87 and apps/web/src/features/attendance/components/attendance-shared.tsx:11-39.

The ManagementViewToggle uses a labeled group of buttons and aria-pressed state; Requests & Approvals controls do not implement a custom keyboard handler. Native buttons are the source interaction. Shared OverviewPanel sections provide named section/heading semantics and InlineBar labels its graphic. Sources: apps/web/src/components/layout/management-view-toggle.tsx; apps/web/src/components/ui/overview-panel.tsx:198-263.

Responsive source includes a two-column card grid at the large breakpoint and a stacked Needs attention row below 560 px. There is no page-specific browser measurement in this discovery. Source references: attendance-requests-overview-page.tsx:255-256,410-415; overview-panel.tsx:198-263.

The page does not use the shared row-action menu implicated in PG-004-D-001. That historical defect is not attributed to PG-013. Shared components relevant here are AttendanceShell, ManagementViewToggle, ResourceStatus, Section, FiguresRow, InlineBar, and RowsSkeleton.

## Discovery conclusion

PG-013 identity matches Phase 1. The implemented page is a read-only, scoped aggregate dashboard with two independently authorized backend requests. Discovery found no page-specific application defect because tests were not executed. Product clarification is needed only for account-profile toggle semantics and scope carry-through on destination navigation. Existing and proposed test design is in the accompanying baseline and case specification.

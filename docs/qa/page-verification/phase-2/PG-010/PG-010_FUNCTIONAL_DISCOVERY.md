# PG-010 Functional Discovery

**Phase:** 2.1 discovery and test design only  
**Approved page:** PG-010-F001  
**Discovery date:** 2026-11-24  
**Repository baseline:** branch 293-test-full-system-audit-for-verifying-recent-changes, HEAD 53ffd689b146fbf72cb6ba2e4fcbfd7b80aefd19  
**Entry worktree:** clean; no staged, unstaged, or untracked changes  
**Status:** Source discovery complete. No tests were implemented or executed.

## Identity and Phase 1 reconciliation

| Field                   | Current evidence                                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stable ID               | PG-010-F001                                                                                                                                                                                                                    |
| Canonical URL           | /attendance/requests/corrections                                                                                                                                                                                               |
| Next.js route           | apps/web/src/app/(portal)/attendance/requests/corrections/page.tsx:1-16                                                                                                                                                        |
| Main component          | AttendanceAdjustmentsPage at apps/web/src/features/attendance/pages/attendance-adjustments-page.tsx:45-370                                                                                                                     |
| Feature module          | apps/web/src/features/attendance/                                                                                                                                                                                              |
| Route mode              | The route supplies requestType CORRECTION and optionally linkedId from the request query parameter. The shared component fixes the server query to correction records and does not show the type filter.                       |
| Phase 1 mapping         | The approved route inventory, component mapping, functionality inventory, API dependency family, authorization matrix, and existing coverage row all identify PG-010 as this correction request route.                         |
| Reconciliation          | No route or stable-ID discrepancy found. The current source adds detail: PG-010 is a correction-only mode of a component also used by PG-004 and PG-012.                                                                       |
| Redirect aliases        | No correction-specific alias was found in the attendance navigation or route policy. Notification links and the Requests & Approvals Overview link lead to this canonical route.                                               |
| Navigation entry points | Corrections sidebar link in apps/web/src/features/attendance/model/navigation.ts:43-72; Corrections card in attendance-requests-overview-page.tsx:255-273; attendance notification link in workflow-notifications.tsx:143-162. |

## Repository baseline

The supplied last-reported HEAD was cccf2d5c788f551ba155010973dc32084ed4abf7. The actual HEAD is one commit later at 53ffd689b146fbf72cb6ba2e4fcbfd7b80aefd19. That intervening commit is the PG-009 implementation and its reports: test(PAGE-009): add tests, unit tests, and qa documentation. The branch name is unchanged. The task-entry worktree was clean, including staged and untracked state. No Git branch or commit operation was performed.

## Layout, providers, and route access

The root layout wraps the app in AuthProvider (apps/web/src/app/layout.tsx:30-36). The portal route group wraps pages in PortalLayout (apps/web/src/app/(portal)/layout.tsx:5-7). PortalLayout loads the account, applies route policy, and supplies AccountContext, PreferencesProvider, BreadcrumbLabelProvider, WorkspaceProvider for non-USER roles, and RoleLayout (apps/web/src/components/layout/portal-layout.tsx:21-92). AttendanceShell supplies the page heading and workspace landmark (attendance-shell.tsx:19-45, 82-113).

The route policy is generated from attendanceNavigation and assigns self-access attendance routes to canAccessAttendance (apps/web/src/features/workspaces/model/route-policy.ts:352-394). The helper admits active STAFF and ADMIN, and active SUPERADMIN with employees:read (apps/web/src/features/auth/model/permissions.ts:92-100). The page separately uses canAccessPersonalAttendance, which admits active STAFF and ADMIN only, and canManageAttendance, which admits eligible privileged accounts with employees:read or a STAFF department head (permissions.ts:102-115). Thus route access does not grant self-service or organization-wide review. The UI derives request capabilities from the API response as well as account state.

## Route-to-persistence trace

| Layer                   | Implementation                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js route           | Awaits searchParams, accepts a string request parameter, and renders AttendanceAdjustmentsPage with requestType CORRECTION, key=requestId, and linkedId=requestId (route page.tsx:2-15).                                                                                                                                                                                          |
| Page state and resource | AttendanceAdjustmentsPage initializes linked-panel visibility, scope, search/debounced search, type/status filters, page, request dialog, review panel, pending, and error state (page component:52-76). useAsyncResource loads either one linked detail or the paginated list, disables fetch during the 200 ms search settle period, and exposes retry (page component:77-122). |
| Shared UI               | AttendanceShell; SearchField; FilterSelect; ManagementViewToggle; ResourceStatus; AttendanceAdjustmentTable; AttendancePagination; AdjustmentDialog; AttendanceAdjustmentReviewPanel (page component:211-368).                                                                                                                                                                    |
| API client              | apps/web/src/features/attendance/api/attendance-api.ts:81-99, 400-449. GET /api/attendance/adjustments with scope, page, search, type, and status; GET /api/attendance/adjustments/:id; POST /api/attendance/adjustments; POST /api/attendance/adjustments/:id/review. Calls use the same-origin /api path.                                                                       |
| Express router          | apps/api/src/features/attendance/routes.ts:11-19 applies requireAuth to the attendance router; correction routes are GET /adjustments, GET /adjustments/:adjustmentId, POST /adjustments, and POST /adjustments/:adjustmentId/review at lines 101-128. The router has no separate correction controller; it calls createAttendanceManagement directly.                            |
| Service/domain layer    | apps/api/src/features/attendance/attendance.management.ts:1327-1808 contains detail, list, create, and review operations. attendance.service.ts provides current actor and employee checks; attendance.overtime.ts provides HR exception scope, notifications, and related overtime rules.                                                                                        |
| Persistence             | apps/api/prisma/schema.prisma:1599-1636 defines AttendanceAdjustmentStatus and AttendanceAdjustment, including unique requestKey, employee/session relations, originalSession snapshot, proposed timestamps, reason, stage fields, and indexes. AttendanceWorkSession is updated or created only after final correction approval.                                                 |
| Audit/notifications     | Creation calls setAttendanceAuditContext and notifyPendingAdjustment within the creation transaction (management.ts:1579-1595). Review records the decision and calls notifyOvertime for the correction workflow stage (management.ts:1732-1804); the generic helper supports correction types. The page does not call a separate audit client.                                   |
| Not applicable          | No separate correction controller, custom client-side sort, date-range filter, file upload/download, or correction edit/cancel API was found for this route.                                                                                                                                                                                                                      |

## Source-defined page behavior

### Initial load and list

Without a request query parameter, the route requests a list. A manager with personal attendance access initially uses team scope; a non-manager uses mine. A manager who also has personal self-service can switch between team and mine. For PG-010 the requestType prop fixes the type query to CORRECTION and removes the type-filter control; status filter, search, pagination, table, and API-derived requestCorrection capability remain available (page component:56-103, 211-295).

The API list validates scope, page, search length, type, and status; searches employee name, employee ID, or reason; scopes records; sorts createdAt descending then id descending; paginates ten records; and returns per-record review capabilities plus requestCorrection capability (management.ts:1416-1504; shared/query/pagination.ts:12-29, 44-72). The page debounces search by 200 ms and resets to page one when search, status, scope, or available type controls change (page component:60-67, 230-297).

Loading, error/retry, and empty states are source-backed. The table exposes aria-busy, skeleton rows, a retry row, and an empty row (attendance-adjustment-table.tsx:117-175); ResourceStatus exposes an alert and Retry (attendance-shared.tsx:13-46). The current empty copy mentions both corrections and overtime even though PG-010 requests corrections only. Intended page-specific wording is not established; see C001 in the case report and gaps report.

Rows show employee identity, correction type, session-correction versus missing-attendance label, proposed start/end in the device timezone, reason, status, and actions. Rows use ResponsiveDataTable with a compact layout at the 1000 px container breakpoint (attendance-adjustment-table.tsx:23-26, 117-267). No user-controlled sort exists; the API order is authoritative.

### Linked request detail

For ?request=<id>, the route remounts the shared page using that ID as its key and calls the detail API instead of the list. A detail whose type is not CORRECTION is converted into a 404. The detail response is shown as a read-only side panel, with no review note field or decision buttons; closing the panel clears the local linked state (route page.tsx:7-14; page component:77-94, 123-144, 344-367; review panel:43-45, 69-102, 168-215). The notification menu links attendance correction notifications here with the request ID (workflow-notifications.tsx:143-162).

### Correction request form

The Request correction header action appears only when the account is STAFF or ADMIN, API capability requestCorrection is true, and this is not the overtime route (page component:220-228, 337-343). PG-010 opens AdjustmentDialog with session=null and the default allowOvertime=false. The form has no request-type selector, initially blank start/end fields, a reason textarea, Cancel, and Submit request (adjustment-dialog.tsx:26-53, 108-169). The datetime fields use the browser/device timezone; nonexistent local times are rejected, repeated local times require the user to choose a UTC offset, and successful form values are serialized as ISO instants (attendance-date-time-input.tsx:11-49, 71-115; model/attendance.ts:110-160).

The client checks that both instants resolve and that end is later than start before posting. Reason has native required, minLength 5, and maxLength 2000 constraints. While submitting, duplicate handler entry is blocked and controls use the modal busy state. A successful POST shows Correction requested, invokes list retry, and closes the dialog. An API failure is displayed in the dialog and leaves it open; Cancel closes it (adjustment-dialog.tsx:70-105, 141-168). The server trims reason and enforces length 5 through 2000 after trimming (management.ts:109-117).

### Review and lifecycle

The row menu always offers View details. It offers Approve request or Verify correction only when the API says approve or verify is allowed; Reject request is capability-gated. The callback opens the review panel with an APPROVED or REJECTED decision (attendance-adjustment-table.tsx:38-88, 234-249). A review panel requires a 5-2000 character review note, disables submission/cancellation while pending, and closes after a successful callback; it shows an API error without closing on failure (review panel:92-102, 168-215).

Backend stage behavior is enforced on every request:

- A Department Head with current department scope can approve a PENDING correction to record VERIFIED, verifier and verification note, without updating attendance timestamps.
- A Department Head may reject a PENDING correction; that is a terminal REJECTED decision.
- ADMIN HR review of a normal pending request is denied until verification. An HR exception applies when there is no independent active eligible Head; the API determines it from current records.
- ADMIN HR finalizes a VERIFIED correction. SUPERADMIN with employees:read can approve or reject at either pending or verified stage and is not granted employee self-service by that permission alone.
- Own requests cannot be reviewed. API rechecks actor status, employee/department placement, current request status and scope, and current attendance snapshot. A stale session snapshot returns 409; a lost scope may return 403/404.
- Final APPROVED correction updates the existing session or creates a session for missing attendance, then records status/reviewer/note. REJECTED requests do not apply proposed timestamps.

Evidence: adjustmentReviewAccess at management.ts:375-405; detail and capabilities at 1327-1377; request creation at 1506-1598; review locks, stage, snapshot, mutations, and conflict handling at 1600-1808.

## Authorization boundaries

| Boundary               | Source-defined rule                                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend route         | Active STAFF/ADMIN; active SUPERADMIN requires employees:read. USER and inactive accounts are denied by route policy and portal account policy.            |
| UI self-service        | STAFF/ADMIN only, plus API-provided requestCorrection capability. SUPERADMIN can review with the required permission but has no personal request controls. |
| UI review controls     | Derived from per-record API capabilities, current team scope, and manager role; visibility is presentation only.                                           |
| Backend authentication | requireAuth checks a valid active, non-deleted session before all attendance routes.                                                                       |
| Personal data          | Creation resolves the caller's Employee record server-side. A missing Employee profile produces 409. Client-supplied employee identity is not accepted.    |
| Team scope             | Department Head gets current department; ADMIN/SUPERADMIN with employees:read get organization scope subject to HR pending-request exception filtering.    |
| Resource detail        | Record owner/employee/head/HR/Superadmin scopes are re-evaluated by detail handler. Out-of-scope records are hidden as 404 in applicable paths.            |
| Decision               | Server rechecks current placement, own-request rule, status, Head/HR stage, exception conditions, and attendance snapshot.                                 |

Evidence: route policy and permission helpers cited above; attendance.management.ts:82-117, 358-405, 1327-1377, 1506-1808; attendance.service.ts:27-76; attendance.overtime.ts:11-30.

## Shared-component and prior-finding risk

PG-010 renders AttendanceAdjustmentTable, which uses RowActionsMenu at attendance-adjustment-table.tsx:14-17 and 234-249. RowActionsMenu handles ArrowDown at row-actions-menu.tsx:105-151. PG-004-D-001 is a confirmed shared keyboard-operated menu failure; PG-006 T018 and PG-008 A007-T001 also reproduced it. PG-010 therefore has a justified keyboard menu verification case. No evidence in this source-only discovery establishes that PG-010 itself reproduces the defect. Keep existing failing regression assertions intact.

The table also uses the same responsive data-table family as attendance pages with prior 820 px intermittent behavior. PG-006 T024 remains intermittent and PG-008 has a separate 390 px fixture failure. Neither result is attributed to PG-010.

## Discovery limits

No automated tests were run, as authorized. Existing coverage was inspected from source only; this report does not claim any PG-010 assertion passes. No contract outside source-backed behavior was inferred. The only new page-level contract question identified is the correction-only empty-state copy. PG-001 through PG-009 findings remain unchanged in the cumulative ledger.

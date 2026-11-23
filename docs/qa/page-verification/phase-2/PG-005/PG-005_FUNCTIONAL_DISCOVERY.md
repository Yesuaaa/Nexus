# PG-005 Functional Discovery

**Phase:** 2.1, design only  
**Page:** PG-005 — /attendance/audit  
**Current source baseline:** branch 293-test-full-system-audit-for-verifying-recent-changes, HEAD 64535202df403eb6f3a8e80ff3a7e6385d1dbc2b; worktree clean at discovery entry.  
**Prior reported baseline:** b870c7a2b8a07e5bd6583f2dd625d9cdd8bc26a. HEAD now includes the PG-004 test/documentation commit; the commit diff from that baseline contains tests and QA documentation, with no application source changes.

## Scope and method

This record reconciles Phase 1 evidence with the current route, page, authorization, API, persistence, and test source. Current source is authoritative. No test, application, schema, migration, or test-fixture source was edited or executed.

## Page identity

| Field                | Current evidence                                                                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stable page ID       | PG-005                                                                                                                                                                                        |
| Canonical route      | /attendance/audit                                                                                                                                                                             |
| Module ownership     | Workforce Compliance / attendance-monitoring                                                                                                                                                  |
| Route entry          | apps/web/src/app/(portal)/attendance/audit/page.tsx                                                                                                                                           |
| Primary component    | AttendanceAuditPage                                                                                                                                                                           |
| Authentication       | Portal route requires a current authenticated account; the attendance API router applies requireAuth.                                                                                         |
| Route authorization  | canManageAttendance: an active STAFF department head, or an active ADMIN/SUPERADMIN with employees:read.                                                                                      |
| Record authorization | API independently resolves managementScope: privileged employee-read users get organization scope; a current STAFF department head is limited to their department. Other callers receive 403. |
| Navigation           | Main navigation entry “Audit Trail” at /attendance/audit, route-policy order 39.                                                                                                              |
| Related alias        | /attendance/time-logs/audit redirects to /attendance/audit and has the same route-policy gate. It is an alias, not another PG-005 page.                                                       |

Evidence: Phase 1 route inventory and component map; apps/web/src/app/(portal)/attendance/audit/page.tsx:1-5; apps/web/src/app/(portal)/attendance/time-logs/audit/page.tsx:1-3; apps/web/src/features/workspaces/model/route-policy.ts:396-412; apps/web/src/features/auth/model/permissions.ts:92-109; apps/api/src/features/attendance/routes.ts:11-28; apps/api/src/features/attendance/attendance.management.ts:82-100.

## Phase 1 reconciliation

Phase 1 assigns PG-005 to /attendance/audit, AttendanceAuditPage, and the AttendanceAudit API/model family. Current source confirms the identifier, canonical route, primary component, module ownership, and management-access policy.

The Phase 1 API dependency table groups PG-003–PG-015 and lists both attendance and leave API families. That is a group-level map, not a page-level call graph. Current PG-005 source imports only attendanceDepartments and attendanceAudit from attendance-api.ts; it does not call the leave API. This narrows the grouped historical mapping and is not a source discrepancy.

The Phase 1 route snapshot predates the current HEAD. The intervening commit history is test and documentation work; the current PG-005 source still matches its stable Phase 1 identity. No page ID or route renumbering is needed.

## Source chain

| Layer                   | Source and behavior                                                                                                                                                                                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route and portal shell  | Portal route renders AttendanceAuditPage. PortalLayout loads the current account and applies the shared route policy before rendering the portal.                                                                                                                                         |
| Page and local children | attendance-audit-page.tsx renders AttendanceShell(tab="audit"), inline AuditDetails, SearchField, RangeFields, FilterSelect, responsive table components, status/empty/error rows, and AttendancePagination.                                                                              |
| State and hooks         | Local state holds date range, one-based page, department ID, typed search, settled search, and selected event. useAsyncResource loads departments and audit events, aborts outdated requests, ignores stale completions, preserves last successful data while loading, and exposes retry. |
| Web API client          | GET /api/attendance/departments and GET /api/attendance/audit with from, to, page, employeeId="", departmentId, and optional trimmed search. The page does not send recordsOnly.                                                                                                          |
| Next.js and Express     | Same-origin /api proxy; Express mounts createAttendanceRouter at /api/attendance. The router applies requireAuth and maps GET /departments and GET /audit to attendance management.                                                                                                       |
| Service and persistence | createAttendanceManagement resolves current scope and reads AttendanceAudit inside a RepeatableRead transaction. It includes actor and employee fullName projections and omits operationId, correlationId, and actorRoleAtTime.                                                           |
| Data models             | AttendanceAudit with Employee and User relations, before/after JSON snapshots, action, reason, and createdAt; Department supplies current Head scope and filter choices.                                                                                                                  |

Evidence: apps/web/src/features/attendance/pages/attendance-audit-page.tsx:1-44, 148-183, 185-334, 338-402; apps/web/src/features/attendance/api/attendance-api.ts:217-271; apps/web/src/features/attendance/components/attendance-shared.tsx:13-87, 89-121; apps/web/src/features/attendance/components/attendance-shell.tsx:19-30, 82-114; apps/web/src/lib/use-async-resource.ts:11-24, 25-96; apps/api/src/app.ts:131-132; apps/api/src/features/attendance/routes.ts:11-28; apps/api/src/features/attendance/attendance.management.ts:82-100, 410-424, 425-551; apps/api/prisma/schema.prisma:1570-1597.

## Source-supported behavior

### List rows and detail panel

- Rows show event timestamp in UTC, actor, affected employee, a human-readable action/entity summary, and a View audit event button. The button label includes the event ID.
- Actor fallback is the trimmed name, Name unavailable when actorId exists without a resolved name, or No actor recorded when actorId is absent.
- Employee fallback is the resolved name, Not applicable (policy change) for policy records, or Employee unavailable.
- Action labels map INSERT/UPDATE/DELETE to Created/Updated/Deleted. Attendance adjustments distinguish overtime requests from corrections; known policy, workday, session, and break entities receive readable names.
- Details are read-only. They display actor, affected employee, change description, UTC timestamp, reason fallback, recognized fields from after-or-before, and previous values from before when recognized fields exist. The drawer has Done and the shared side-panel close control; no mutation control is present.
- Snapshot rendering only reads the explicit snapshotFields list. Type and status are humanized, overtimeMinutes is rendered in minutes, booleans as Yes/No, timestamp-suffixed fields in UTC, and null/undefined values are omitted.

Evidence: attendance-audit-page.tsx:49-89, 92-145, 289-323, 338-400; side-panel.tsx:66-129.

### Filters, validation, pagination, and asynchronous states

- Search has a 100-character input limit, trims the value, settles after 200 ms, and resets page to 1. The API trims again, rejects non-string values, and rejects more than 100 characters.
- Search is case-insensitive across action, entityType, reason, actorId, employee name/employee ID, and actor name/email. The page label describes employee, actor, event type, or reason.
- From/Through controls use native date bounds: From.max equals Through and Through.min equals From. They reset page to 1. The page note states date filtering is by event timestamp in UTC.
- Department choices come from the scope-filtered departments endpoint, are ordered by name, and the control is disabled while choices load. “All permitted departments” is the default; a selected value is sent as departmentId and resets page to 1.
- The server accepts an inclusive date-only range of at most 366 calendar days by filtering createdAt >= UTC start of from and createdAt < UTC midnight after to. Page numbers are plain decimal 1–100,000; page size is 10; rows sort createdAt descending then id descending.
- Initial audit loading uses skeleton rows and aria-busy. During a refresh, prior rows remain and the table is busy. Audit errors render a retry row; department errors render ResourceStatus with Retry. Empty search results use SearchEmptyState; a zero-result unsearched range says “No audit events in this period and scope.” Pagination is shown only while settled data is available.

Evidence: attendance-audit-page.tsx:148-182, 186-219, 221-287, 328-332; attendance-shared.tsx:13-45, 68-121; attendance.schema.ts:42-76; shared/query/pagination.ts:12-23, 44-73.

## Access and privacy boundaries

The client route policy is a navigation/rendering guard, not an API security boundary. The router requires authentication, and managementScope independently grants global reads only to users with employees:read. A STAFF actor must currently head a department. The server rejects a requested department outside that Head’s current scope, rejects nonexistent departments with 404, and verifies an employee belongs to the requested department before returning records.

Existing PGlite tests directly cover Head scoping, privileged organization reads, non-head STAFF denial, scope loss, and audit search. New design cases add unauthenticated/USER denial assertions and safe response/order boundary assertions; they must use only the offline PGlite fixture.

## Behaviors not present on this page

The page has no create/update/delete, approval, rejection, export/download, employee selector, sort control, action-count display, or recordsOnly toggle. The API returns actionCounts and accepts employeeId/recordsOnly, but AttendanceAuditPage does not render or set those options. No leave API call is made.

## Contract questions discovered from source

- C001: Clearing either date disables the audit request, while useAsyncResource retains prior successful data and the page can continue rendering it. Product intent is not documented: should clearing a required date clear/hide rows, show validation, or retain the previous result? Do not add an assertion for any of those outcomes until clarified.
- C002: selected is independent of range, search, and department state. A selected event can remain in the details panel while the query changes. Product intent is not documented: should filter/scope changes close the panel or keep the previously selected record visible? Defer that expected-result assertion until clarified.

These are case-level contract questions, not confirmed application defects. No PG-005 runtime defect was confirmed during this source-only phase. PG-004-D-001 remains a separate open defect and is carried forward unchanged in the ledger.

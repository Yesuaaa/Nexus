# PG-005 Atomic Feature Inventory

**Scope:** PG-005 /attendance/audit. Feature identifiers extend the Phase 1 anchor PG-005-F001. Source and line references point to the current repository snapshot.

## PG-005-F001-A001 — Route access and navigation

- **UI trigger:** Direct navigation to /attendance/audit; main-navigation Audit Trail link.
- **Handler/state:** PortalLayout applies canAccessRoute; route-policy entry attendance-audit delegates to canManageAttendance. No page-local route state.
- **API:** None for the route decision.
- **Validation:** Current active account and page permission helper.
- **Authorization:** Active STAFF department head; or ADMIN/SUPERADMIN with employees:read. Ordinary STAFF, USER, inactive accounts, and privileged roles without the read grant are denied. API authorization remains separate.
- **Success/failure:** Authorized users render AttendanceAuditPage; shared portal behavior handles denied routes. The /attendance/time-logs/audit alias redirects to the canonical route under the same guard.
- **Dependencies/source:** apps/web/src/app/(portal)/attendance/audit/page.tsx:1-5; apps/web/src/features/workspaces/model/route-policy.ts:396-412; apps/web/src/features/auth/model/permissions.ts:92-109; apps/web/src/components/layout/portal-layout.tsx:19-75.

## PG-005-F001-A002 — Department choices and filter control

- **UI trigger:** Audit department combobox; select “All permitted departments” or a returned department.
- **Handler/state:** attendance-audit-page.tsx:151-152 and 204-219 stores departmentId, resets page to 1, and reloads the audit query. The combobox is disabled while the department resource loads.
- **API:** GET /api/attendance/departments; selected department is sent as departmentId to GET /api/attendance/audit.
- **Validation:** Department ID is parsed by the API as a record ID; absent or empty means no requested department.
- **Authorization:** Department choices are filtered by the server’s current managementScope; a Head receives only their department, a permitted HR reader receives all departments.
- **Success/failure:** Options are name-sorted. Selecting one constrains the resulting events. Department load failure displays a retry alert; an outside-scope department is rejected by the audit endpoint.
- **Dependencies/source:** attendance-audit-page.tsx:161-163, 204-219; attendance-api.ts:229-233, 247-271; attendance.management.ts:410-424, 451-468.

## PG-005-F001-A003 — Department authorization scope

- **UI trigger:** Any audit read, whether the filter is empty or contains departmentId.
- **Handler/state:** No client authorization state is trusted for data scope; the backend recomputes managementScope from the authenticated actor.
- **API:** GET /api/attendance/audit and GET /api/attendance/departments.
- **Validation:** Invalid IDs return 400; a valid but missing department returns 404; a Head requesting outside their scope receives 403. Employee IDs are also checked against the resolved department.
- **Authorization:** employees:read grants organization-wide access; a current STAFF Department.headId grants that one department; other roles are denied.
- **Success/failure:** Rows and department choices are limited to authorized scope even if a client alters query parameters.
- **Dependencies/source:** attendance.management.ts:82-100, 410-424, 451-479, 488-513; attendance.routes.ts:16-28.

## PG-005-F001-A004 — UTC date-range filtering

- **UI trigger:** Attendance from date and Attendance through date inputs.
- **Handler/state:** RangeFields updates range and resets page to 1; From has max=to and Through has min=from. The page requests nothing unless both dates are truthy.
- **API:** GET /api/attendance/audit?from=...&to=...&page=....
- **Validation:** Strict YYYY-MM-DD, real date, to >= from, no more than 366 inclusive dates, valid page. Server interprets dates in UTC and filters AttendanceAudit.createdAt to the half-open interval [from midnight, midnight after to).
- **Authorization:** Same current Head/HR scope as A003.
- **Success/failure:** Events are selected by audit-record timestamp in UTC; invalid query data yields 400. Clearing a date has unresolved display semantics C001.
- **Dependencies/source:** attendance-audit-page.tsx:148-150, 197-203; attendance-shared.tsx:89-121; attendance.schema.ts:42-76; attendance.management.ts:443-446, 485-490.

## PG-005-F001-A005 — Search behavior

- **UI trigger:** Search audit events input.
- **Handler/state:** search is trimmed; a 200 ms timer produces settledQuery; cleanup cancels the timer; changes reset page to 1. useAsyncResource aborts superseded requests and ignores stale completions.
- **API:** GET /api/attendance/audit?search=...; empty trimmed search is omitted.
- **Validation:** Input maxLength=100; backend accepts only a scalar string, trims it, and rejects values over 100 characters.
- **Authorization:** Same audit scope.
- **Success/failure:** Case-insensitive matching over action, entityType, reason, actorId, employee full name/employee ID, actor full name/email. No matches display SearchEmptyState.
- **Dependencies/source:** attendance-audit-page.tsx:148-160, 186-195; attendance-api.ts:247-271; attendance.management.ts:430-442, 504-513; query-helpers.ts:6-9.

## PG-005-F001-A006 — Pagination and asynchronous list states

- **UI trigger:** Attendance pages pagination controls; mount and any date/search/department update.
- **Handler/state:** page starts at 1; filters reset it to 1. Search can be pending while old data remains. Query key changes abort earlier requests and stale responses are ignored.
- **API:** Audit GET returns events, total, page, pageSize, asOf, actionCounts.
- **Validation:** Page is a plain decimal 1–100,000; server page size is 10.
- **Authorization:** Server checks current scope on every request.
- **Success/failure:** Initial loading uses five skeleton rows; refresh keeps prior rows with aria-busy; API errors offer Try again; zero results show either no-search text or no-results SearchEmptyState; settled data shows page controls. Department failures use a separate Retry alert.
- **Dependencies/source:** attendance-audit-page.tsx:149-182, 225-287, 328-330; attendance-shared.tsx:13-87; use-async-resource.ts:11-24, 49-96; pagination.ts:12-23, 44-73.

## PG-005-F001-A007 — Event row summaries

- **UI trigger:** Each returned table row.
- **Handler/state:** actorName, affectedEmployeeName, auditEntityName, and describeAuditChange derive display text from the event. No mutation state.
- **API:** GET /api/attendance/audit response event fields, actor.fullName, employee.fullName.
- **Validation:** Helpers tolerate null actor/employee and unknown entity/action values.
- **Authorization:** The server scopes employee-linked events. Organization-level policy events may have no employee.
- **Success/failure:** UTC time, actor, affected employee, and action/entity text render; fallbacks distinguish no actor, unresolved name, policy change, and unresolved employee.
- **Dependencies/source:** attendance-audit-page.tsx:92-145, 289-323; attendance-api.ts:217-228; attendance.management.ts:515-551.

## PG-005-F001-A008 — Read-only audit event details

- **UI trigger:** View audit event button on a row; Done, close icon, Escape, or outside dismissal closes the panel.
- **Handler/state:** selected holds the chosen event; AuditDetails renders while selected is non-null. close clears selected after the shared panel transition.
- **API:** No detail request; the selected row object supplies the content.
- **Validation:** before/after are unknown and must pass isAuditSnapshot before known snapshot fields are read. Null and undefined fields are omitted.
- **Authorization:** Only the already-scoped row can be selected. The drawer does not perform a second API check.
- **Success/failure:** Shows change, actor, employee, UTC time, reason, recognized after-or-before values, and previous values. Page source contains no mutation action. Scope/filter persistence while open is unresolved C002.
- **Dependencies/source:** attendance-audit-page.tsx:49-89, 161, 311-321, 331-400; side-panel.tsx:53-129.

## PG-005-F001-A009 — Responsive and keyboard interaction

- **UI trigger:** Search, date, department, pagination, View audit event, and drawer controls at supported viewport widths.
- **Handler/state:** ResponsiveDataTable collapses its layout at <=900px; shared Sheet manages modal focus and dismissal; the event button is a native button with an event-specific accessible label.
- **API:** Same list and department reads; keyboard actions do not add calls.
- **Validation:** Accessible names and semantic roles are source-provided.
- **Authorization:** Route and API scope remain active at all widths.
- **Success/failure:** No horizontal overflow at 390/820/1440px; keyboard can activate the row button, Escape closes the panel, and focus restoration follows the shared side-panel primitive. These page-specific keyboard assertions are not present in the current audit tests.
- **Dependencies/source:** attendance-audit-page.tsx:46-47, 234-246, 311-321; side-panel.tsx:66-129; edge-sheet.tsx; existing responsive assertions in attendance.spec.ts:1554-1739.

## PG-005-F001-A010 — Audit query validation and response projection

- **UI trigger:** Search/date/department/page state produces query parameters; callers may also address the endpoint directly.
- **Handler/state:** attendance routes dispatch GET /audit to management.records(..., true).
- **API:** GET /api/attendance/audit; GET /api/attendance/departments.
- **Validation:** Only from, to, page, employeeId, departmentId, recordsOnly, search are accepted. recordsOnly, when present, must equal true. Search is scalar and <=100 characters. Date/page/ID constraints are applied before querying.
- **Authorization:** requireAuth plus managementScope and current employee/department checks.
- **Success/failure:** A RepeatableRead transaction returns stable createdAt-descending/id-descending events, matching total, and action counts. Actor and employee relations expose fullName only; operationId, correlationId, and actorRoleAtTime are omitted. Invalid filter shape/value returns 400, denied scope 403, and a valid missing resource 404.
- **Dependencies/source:** attendance.routes.ts:11-28; attendance.management.ts:425-551; attendance.schema.ts:42-76; pagination.ts:12-73; schema.prisma:1570-1597.

# PG-023 Functional Discovery

**Status:** Phase 2.1 source discovery and design only. No PG-023 tests, probes, browser sessions, application servers, API servers, or databases were run.
**Source baseline:** Branch 293-test-full-system-audit-for-verifying-recent-changes, HEAD 59167cbc03ed10cd52de2a8404e62f4366b13dfb. The task-entry index and worktree were clean. PG-023 reports did not exist at entry.

## Verified identity

| Registry field              | Verified value                                                                                                                                                                   | Evidence                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Page                        | PG-023, Employee Management                                                                                                                                                      | PHASE_1_PAGE_FUNCTIONALITY_INVENTORY.md:29                            |
| Canonical route             | /employees; static Portal route; People & HR module                                                                                                                              | PHASE_1_COMPLETE_ROUTE_INVENTORY.md:33                                |
| Route wrapper               | ModuleTransition around EmployeeManagementPage                                                                                                                                   | apps/web/src/app/(portal)/employees/page.tsx:1-8                      |
| Feature component           | EmployeeManagementPage, named export                                                                                                                                             | apps/web/src/features/employees/pages/employee-management-page.tsx:86 |
| Registry behavior           | Browse/search employees and perform permitted employee profile/provisioning operations                                                                                           | PHASE_1_PAGE_FUNCTIONALITY_INVENTORY.md:29                            |
| API family                  | employees-api.ts; current page calls employee and department endpoints                                                                                                           | PHASE_1_PAGE_API_DEPENDENCIES.md:18 and current client                |
| Registry persistence family | Employee, User, Department, Team, EmployeeCompensation, WorkforceManagementChange                                                                                                | PHASE_1_PAGE_API_DEPENDENCIES.md:18                                   |
| Existing coverage summary   | Employee validation, integration/creation/account lifecycle and employee-directory/form/login/browser specs; profile attachment and account lifecycle are called direct coverage | PHASE_1_EXISTING_TEST_COVERAGE.md:53                                  |

The adjacent /employees/overview route is PG-024 and mounts EmployeeOverviewPage. It is not part of PG-023. Phase 1 groups PG-023 and PG-024 under one API family; current PG-023 behavior is narrower and is traced below.

## Route, shell and authorization

The route is a client-facing static Portal page. PortalLayout resolves the session account, checks the exact /employees route policy, and redirects a denied USER to /dashboard and other denied accounts to /module; an unauthenticated or expired session follows the shared login path. The route policy binds /employees to the people-hr module and canAccessEmployeeManagement. That helper requires an ADMIN or SUPERADMIN role and employees:read. The built-in role permission map grants employees:read and employees:manage to both ADMIN and SUPERADMIN, and neither to STAFF or USER. The page separately checks permission values before showing actions; route admission and mutation permissions are distinct checks.

Server routes independently apply requireAuth. GET list and detail require employees:read. Create, profile attachment, update, status options, login creation, login status, archive and permanent deletion require employees:manage. Hiding a UI control is not the server authorization boundary. Login lifecycle endpoints also refuse self-targeting and only operate on STAFF logins; an ADMIN employee row can be displayed and edited as an employee profile, but its login is managed through Account Management.

Sources: apps/web/src/features/workspaces/model/route-policy.ts:598-607 and :765-769; apps/web/src/features/auth/model/permissions.ts:57-67; apps/api/src/features/auth/auth.permissions.ts:56-116; apps/web/src/components/layout/portal-layout.tsx:24-40; apps/api/src/features/employees/employees.controller.ts:48-321.

## Implemented page behavior

### Directory query and state

EmployeeManagementPage starts in Employees view at page 1 with page size 10. Search is component state, trimmed before request, limited in the input to 100 characters, and debounced by useTableSearchQuery. The client preview matches full name, employee ID, email and contact number. The server search is case-insensitive across those fields. Department, employment type and Employee.status filters combine with search and page in GET /api/employees. Any filter change returns to page 1. Clear filters resets search, department, type and status. The page does not serialize filters, page, drawer or view state into URL/storage; a fresh page load starts at defaults.

The Employees/Archive toggle resets search and all filters and returns to page 1. While a login confirmation action is pending, the toggle is disabled. Archive view requests archived=true. Server pagination is fixed at PAGE_SIZE 10, with stable ordering by fullName, email, then id; the result includes total/page/pageSize. The page has no sort control.

Department filter options come from useDepartments (GET /api/departments). On department-list error the filter is disabled and Retry is shown. The employee list has loading, skeleton, search-preview, result, empty, error and retry states through usePaginatedList and EmployeeTable. Search empty, filtered empty, no employee records and no archived accounts have distinct messages. The table announces busy/loading state and settled row count. No successful-response runtime schema validator is present in the client.

Sources: apps/web/src/features/employees/pages/employee-management-page.tsx:86-194 and :206-334; apps/web/src/components/ui/use-paginated-list.ts:20-95 and :96-245; apps/web/src/components/ui/use-table-search-query.ts; apps/api/src/shared/query/pagination.ts:12-72; apps/api/src/features/employees/employees.repository.ts:92-132.

### Directory projection and row actions

The API lists User rows whose role is ADMIN or STAFF. Main view selects accountDeletedAt=null; Archive selects non-null accountDeletedAt. An account without an Employee row is represented with id account:<userId>, hasEmployeeRecord=false and empty employeeId; its account identity remains visible for profile completion. Employee rows without a linked User are not returned by this account-based list. A linked archived account appears only in Archive. Search and filters are applied before the 10-row page window.

Columns show employee ID, identity, department, position/team, employment type, start/archive date, employment status and actions. At widths up to 1000px each record reflows as a compact card; page filter controls also stack through 560px. The table has an accessible Employees name, headers and per-person action names. Only one row menu is tracked open at a time.

In Employees view, view is available to admitted readers, edit is gated by employees:manage, and Create login appears for an account with no linked login and no archive date. Login deactivation/reactivation/delete actions are offered only to a manager acting on a different STAFF account. Delete account is disabled until the login is inactive. Archive view removes view/edit/create actions and exposes Delete permanently for an eligible non-self STAFF account. ADMIN login actions are not offered here. Employment status shown in the table is Employee.status; accountIsActive and accountDeletedAt represent separate User state.

Sources: apps/api/src/features/employees/employees.repository.ts:15-80 and :92-149; apps/web/src/features/employees/components/employee-table.tsx:138-240 and :250-425; apps/web/src/features/employees/components/employee-row-actions.tsx:20-98.

### Details and department-membership bridge

View Employee opens a side panel and loads GET /api/employees/:id. It displays identity/contact, current position, employment type/status, start date, department and team. Loading and error states include retry. The panel has a labeled close control and fallback focus to the row menu or directory heading. Row view is unavailable in Archive.

When the viewed employee has a department and the actor has departments:manage, the panel exposes Manage department. The employee detail panel closes before ManageMembersDrawer opens. Closing that drawer reopens prior employee details; a member change requests a fresh employee list. This is a bridge into department management. Department-member business rules and PG-021 outcomes remain owned by that feature.

Sources: apps/web/src/features/employees/components/employee-details-drawer.tsx:36-192; apps/web/src/features/employees/pages/employee-management-page.tsx:373-403; apps/web/src/features/departments/components/manage-members-drawer.tsx. This source review records the drawer bridge only; it does not reopen PG-021.

### Create, edit and profile attachment

Create Employee opens a side panel only for employees:manage. Employee ID has a fixed EXP- prefix and a 36-character editable suffix; validation accepts a trimmed total length of 2-40 and only letters, digits, underscore and hyphen after EXP-. Full name is required, trimmed, 2-100 characters and follows NAME_PATTERN. Email is required, input max 254, trimmed client-side and normalized server-side. Contact is required and must be 11 digits beginning 09 or 08; the UI strips non-digits and limits the field to 11 characters. Position is required, trimmed and at most 100 characters. Employment type is FULL_TIME, PART_TIME, CONTRACT or INTERN. Start date is a required valid ISO calendar date and submits as midnight UTC. Department is required. Team is required as a choice, with No Team represented by null; selecting another department clears the team and reloads that department's teams.

Create additionally requires a strong password and matching confirmation. Edit omits credentials. Validation is shown on blur/interaction or submit; submit focuses the first invalid control. While saving, inputs and close paths are disabled. Department/team load errors prevent submit and provide retries. A server error keeps the form and values open for correction/retry. Existing account-only rows use POST /api/employees/accounts/:accountId/profile, while a normal employee uses PUT /api/employees/:id. The route's form does not include Employee.status.

Sources: apps/web/src/features/employees/components/employee-form-panel.tsx:89-239, :241-299 and :300-669; apps/web/src/features/employees/model/validation.ts:42-129; apps/api/src/features/employees/employees.schema.ts:13-161.

### Login provisioning and lifecycle

The separate Create login account panel accepts a strong password and confirmation, then POSTs /api/employees/:id/account. It does not create or update Employee profile fields. Login confirmations state their target and consequence. PATCH /api/employees/:id/account/status sets isActive; DELETE /api/employees/:id/account moves an already inactive STAFF account to Archive; DELETE /api/employees/:id/account/permanent permanently removes an already archived, inactive STAFF account. The page reloads the list after completion.

The backend rejects self-targeting and non-STAFF targets for these routes. Deactivation suspends eligible open attendance work sessions and revokes sessions in the same transaction. Archive revokes sessions. Permanent deletion checks related-record constraints; foreign-key failure returns a conflict instructing the manager to retain the account. These login changes do not change Employee.status. Employee HR details survive soft archive and the Employee row remains after account unlinking on permanent delete.

Sources: apps/web/src/features/employees/components/employee-login-panel.tsx:26-120; apps/web/src/features/employees/components/employee-login-action-dialog.tsx:20-200; apps/web/src/features/employees/pages/employee-management-page.tsx:405-425; apps/api/src/features/employees/employees.controller.ts:224-320; apps/api/src/features/employees/employees.service.ts:950-1107; apps/api/src/features/users/account-lifecycle.ts:31-245; apps/api/src/features/users/account-workforce-history.ts:172-270.

## API and persistence trace

| Operation                          | Current page call                                                                                  | Server guard and persistence                                                                                                                                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List employees                     | GET /api/employees?page=...&search=...&departmentId=...&employmentType=...&status=...&archived=... | requireAuth + employees:read; validates query types, enums, search <=100, departmentId <=80 and page; lists ADMIN/STAFF User rows with 10-row window                                                                          |
| Read details                       | GET /api/employees/:id                                                                             | requireAuth + employees:read; only non-archived ADMIN/STAFF accounts; supports employee id and account:<id>; 404 if absent                                                                                                    |
| Create employee and login          | POST /api/employees                                                                                | requireAuth + employees:manage; validates fields and strong password, hashes it; creates STAFF User, Employee and attribution in one Prisma transaction; 201 sanitized response                                               |
| Attach profile to existing account | POST /api/employees/accounts/:accountId/profile                                                    | requireAuth + employees:manage; accepts only existing, non-archived ADMIN/STAFF; rejects password and existing Employee; Serializable transaction creates Employee and attribution                                            |
| Edit employee/profile              | PUT /api/employees/:id                                                                             | requireAuth + employees:manage; partial schema for omitted fields; rejects userId/password changes; transaction updates Employee, selected User mirrors and history; validates department/team and protected leadership links |
| Load department/team options       | GET /api/departments and GET /api/departments/:id                                                  | Department API; page uses list for filter/form and selected department detail for team options                                                                                                                                |
| Create login                       | POST /api/employees/:id/account                                                                    | requireAuth + employees:manage; strong password, Employee must exist and have no login; transaction creates STAFF account, links it and writes account/workforce history                                                      |
| Change login state                 | PATCH /api/employees/:id/account/status                                                            | requireAuth + employees:manage; boolean isActive; rejects self, ADMIN and missing/archived login; deactivation reconciles attendance and revokes sessions                                                                     |
| Archive login                      | DELETE /api/employees/:id/account                                                                  | requireAuth + employees:manage; STAFF, non-self and already inactive required; writes archive/audit transactionally                                                                                                           |
| Permanently delete login           | DELETE /api/employees/:id/account/permanent                                                        | requireAuth + employees:manage; STAFF, non-self, inactive and archived required; related records can block; account/workforce effects and history are transactional                                                           |

API sources: apps/api/src/features/employees/routes.ts:22-44 and apps/api/src/features/employees/employees.controller.ts:48-321; repository: apps/api/src/features/employees/employees.repository.ts:15-149; service/history: apps/api/src/features/employees/employees.service.ts and employee-creation.service.ts.

Prisma Employee has unique employeeId and unique nullable userId. Department, Team and User links are nullable and use SetNull on delete; Team belongs to one Department and has unique department/name. EmployeeCompensation references Employee with Restrict. WorkforceManagementChange stores actor, operation, origin, changed field names and JSON changes; audited helpers do not put profile values or credentials in event changes. Directory/detail queries do not load EmployeeCompensation. Account deletion can unlink the User while preserving the Employee profile and its compensation relationship, but other User references can prevent deleting the account.

Schema sources: apps/api/prisma/schema.prisma:243-259, :384-448, :451-480, :806-888. The page has no upload, download, export, bulk action or direct compensation editing; those categories are inapplicable.

## Source-backed discrepancies and boundaries

1. EmployeeStatusDialog exists in apps/web/src/features/employees/components/employee-status-dialog.tsx and Employee API accepts status plus has a status-options endpoint. Current EmployeeManagementPage imports neither the dialog nor status-options; its reachable form has no status control. Whether PG-023 should expose employment-status editing is an unresolved product-scope question, not a confirmed defect.
2. employees-api.ts uses typed response assertions without runtime validation. A malformed HTTP 200 list envelope can reach usePaginatedList/table array operations. The intended distinction between valid empty results and malformed success is unspecified.
3. PG-023 page size is fixed at 10. The total-count query still evaluates all matching accounts, while no maximum directory cardinality or performance target is documented. No load claim is made.
4. PG-022 contract C001/C002 and results remain page-specific. PG-022-C002 concerned an unpaginated Department Overview. PG-023's per-request page window is bounded at 10, but this does not resolve PG-022-C002 or establish an employee-directory scale target.

No fresh runtime result, permission probe, database assertion or PG-023 test execution is claimed. Existing declarations are design evidence only.

## Historical preservation

The cumulative ledger and prior reports remain unchanged except for the required PG-023 status/baseline fields, additive PG-022 traceability required by this assignment, and the PG-023 entry. PG-022-F008-A001-T019 remains FAIL at the reported 560/640/1024px observations with intended inclusivity open; PG-022-C001/C002 remain open; and the 18-NEW-case / 19-registration T009 variance remains distinguished. PG-021's four failed cases, D-001 through D-003 classifications, C001 and real PostgreSQL/rewrite evidence remain preserved. Earlier intermittent findings, PostgreSQL blockers and PG-004-D-001 remain as recorded. PG-017/Attendance Stage 3 hooks and declarations were not modified. The historical Docker build verification issue remains unresolved in the ledger.

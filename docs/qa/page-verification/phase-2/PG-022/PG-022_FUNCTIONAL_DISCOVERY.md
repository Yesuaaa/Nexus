# PG-022 Functional Discovery

**Status:** Phase 2.1 source discovery and design only. No PG-022 tests, browser sessions, servers, API probes or databases were run.
**Source baseline:** HEAD 9b674995888330740d2abeafd67f69f4aa63f45e on branch 293-test-full-system-audit-for-verifying-recent-changes. The merge has parents 8bb55c9 and 0d2cdae6; its tree matches 0d2cdae6. Worktree and index were clean at the recheck before documentation edits.

## Verified identity

| Registry field                     | Verified value                                                               | Evidence                                                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Page ID and name                   | PG-022, Department Overview                                                  | Phase 1 functionality inventory, PG-022-F001                                                                                 |
| Canonical route                    | /departments/overview                                                        | Phase 1 complete route inventory; exact route file                                                                           |
| Route group and module             | Static route, Portal layout, People & HR                                     | Phase 1 route inventory and component mapping                                                                                |
| Component                          | DepartmentOverviewPage, named export                                         | apps/web/src/features/departments/pages/department-overview-page.tsx                                                         |
| Route wrapper                      | ModuleTransition around DepartmentOverviewPage                               | apps/web/src/app/(portal)/departments/overview/page.tsx                                                                      |
| Frontend module                    | apps/web/src/features/departments                                            | Route and component imports                                                                                                  |
| Page-owned API client and endpoint | departments-api.ts; GET /api/departments                                     | useDepartments defaults to listDepartments                                                                                   |
| Shared portal API requests         | GET /api/auth/me; for admitted accounts, GET /api/auth/settings              | PortalLayout/useAccount resolves the actor before mounting the page; PreferencesProvider loads that actor's date preferences |
| Page function                      | Review department staffing, leadership and service coverage; open management | Phase 1 functionality inventory, PG-022-F001; current JSX                                                                    |

Authoritative records: PHASE_1_COMPLETE_ROUTE_INVENTORY.md:32, PHASE_1_PAGE_COMPONENT_MAPPING.md:43, PHASE_1_PAGE_FUNCTIONALITY_INVENTORY.md:28, PHASE_1_PAGE_AUTHORIZATION_MATRIX.md:47, PHASE_1_PAGE_API_DEPENDENCIES.md:17, and PHASE_1_EXISTING_TEST_COVERAGE.md:52. Phase 1 groups PG-021 and PG-022 under the departments API family; current PG-022 source narrows its actual call path to the general list endpoint.

## Implemented request and authorization flow

1. The route page imports ModuleTransition and DepartmentOverviewPage. The portal route group wraps it in PortalLayout.
2. PortalLayout waits for useAccount, then calls isRouteDenied. The departments-overview route policy uses canAccessDepartmentManagement, which requires ADMIN or SUPERADMIN and departments:read. Denied USER accounts are redirected to /dashboard; denied internal roles go to /module.
3. PortalLayout's useAccount calls getCurrentAccount for GET /api/auth/me when a token exists and refreshes the account on visibility/account-update events. Anonymous users without a token are sent to login without this request. A USER or otherwise denied account returns before child providers render. For an admitted account, PreferencesProvider mounts and calls getSettings for GET /api/auth/settings; it uses the returned preferences for date formatting and ignores the settings request's other response fields. This is shared shell behavior, not a Department Overview data request.
4. DepartmentOverviewPage calls useDepartments with defaults. The hook uses useAsyncResource and its default loader calls listDepartments(signal). This is the page-owned list request; the page calls no department details, mutation, employee-options, team, project-management-directory, filter or search endpoint.
5. listDepartments calls apiRequest for GET /api/departments. Both shared auth/settings calls and the department request use apiRequest, which adds the Bearer token from sessionStorage, uses the same-origin apiUrl by default, handles shared refresh/session-version logic, and passes AbortSignal where supplied.
6. Next rewrites /api/:path* to API_PROXY_TARGET, default http://localhost:3001. Express mounts authRouter at /api/auth and departmentsRouter at /api/departments. GET /auth/me requires authentication and profile:read; GET /auth/settings requires authentication and reads the current user's settings. Department GET / requires authentication and departments:read.
7. departmentsService.listDepartments branches on authenticated role EMPLOYEES_READ. ADMIN/SUPERADMIN receive the HR list projection. STAFF has departments:read but not employees:read and receives the minimal directory projection. USER lacks departments:read.

Sources: apps/web/src/app/(portal)/layout.tsx; apps/web/src/components/layout/portal-layout.tsx:17-88; apps/web/src/features/auth/hooks/use-account.ts; apps/web/src/features/auth/api/auth-api.ts:150-208, 276-278; apps/web/src/features/settings/providers/preferences-provider.tsx:39-69; apps/web/src/features/settings/api/settings-api.ts:23-24; apps/web/src/features/workspaces/model/route-policy.ts:574-583, 765; apps/web/src/features/auth/model/permissions.ts:36-61; apps/web/src/features/departments/hooks/use-departments.ts:20-34; apps/web/src/features/departments/api/departments-api.ts:158-166; apps/web/next.config.ts:62-68; apps/api/src/app.ts:116; apps/api/src/features/auth/auth.controller.ts:76-83; apps/api/src/features/auth/settings.controller.ts:5-10; apps/api/src/features/departments/departments.controller.ts:10-48; apps/api/src/features/auth/auth.permissions.ts:40-99; apps/api/src/features/departments/departments.service.ts:35-48.

## Actor, route and API boundaries

| Actor                              | Page route                                                                       | GET /api/departments                    | Response/data boundary                                                                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Anonymous                          | Portal account resolution sends the session to its login route                   | 401 from requireAuth                    | No department payload                                                                                                                                  |
| USER                               | Route policy denies People & HR and PortalLayout redirects to /dashboard         | 403 because USER lacks departments:read | No department payload                                                                                                                                  |
| STAFF, including a department Head | Route policy denies this page and PortalLayout redirects to /module              | Allowed by departments:read             | Minimal organization directory: department id, name, code, color and Head id/fullName; no counts, HR description, contacts or account lifecycle fields |
| ADMIN                              | Allowed when departments:read is present                                         | Allowed                                 | HR list with department metadata, Head id/email/fullName/role and employee/team/service counts                                                         |
| SUPERADMIN                         | Same page gate as ADMIN; global administrative grants add no different page rule | Allowed                                 | Same HR list projection; separate Project Management directory is not called                                                                           |

The API list uses authenticated request context and ignores caller-supplied query fields. Existing PGlite coverage sends include=members and role=SUPERADMIN from STAFF and still observes the minimal STAFF projection. The page's department request is distinct from the shared GET /api/auth/me and GET /api/auth/settings shell requests. Department detail GET is a different entry point: it requires both departments:read and employees:read and returns member/team details. PG-022 does not call it. Project-management-directory routes also have separate global permission gates and are not in this request path.

The API list has no department ownership filter. ADMIN and SUPERADMIN receive the organization-wide list. STAFF may directly call the shared endpoint and gets a reduced cross-department directory, although STAFF cannot open PG-022.

The portal's shared account bootstrap and preferences endpoints have separate boundaries:

| Entry point            | UI caller in this route                                                                                                                                            | API authorization and effect                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET /api/auth/me       | useAccount calls it for a signed-in browser before route admission and on its refresh/account-update events. With no token, the hook redirects without calling it. | requireAuth plus profile:read; the fixed USER, STAFF, ADMIN and SUPERADMIN permission sets all include profile:read. It returns the current account, not department data.                        |
| GET /api/auth/settings | PreferencesProvider calls it only after PortalLayout admits the account and mounts child providers.                                                                | requireAuth only; reads settings for the authenticated user. Directly authenticated roles can call this endpoint even though USER/STAFF do not mount this provider on the denied overview route. |

Neither endpoint provides department-list authorization. They are shared shell dependencies and mocked as such in the future page-browser plan; the department list boundary remains independently enforced by its own route and API middleware.

## Implemented page behavior

### Loading and errors

The hook starts a list load per mount. useAsyncResource marks it busy, aborts on unmount/dependency change, ignores a completion from an inactive effect, and exposes retry. The page shows five skeleton rows while loading without data. On first-request failure it renders an Alert and Try again button. A valid empty response shows zero figures and “No departments yet.” The typed client does not runtime-validate its successful envelope: a missing `departments` value becomes the hook's empty-array fallback, while a non-array value is passed through as if it were `Department[]` and is incompatible with the page's array operations. The malformed-success contract is unresolved under PG-022-C001. There is no page refresh button or local mutation path.

### Figures and department table

The page derives values in the browser from the returned array:

- Departments is the array length.
- Employees is the sum of memberCount.
- Teams is the sum of teamCount, treating null or missing values as zero.
- With a head is the count with non-null head over total departments. A missing Head adds a warning note and tone.
- Rows sort by memberCount descending, then name ascending for ties. There is no interactive sort, search, filter, pagination or URL-backed state.
- Name and optional code are shown. Head displays fullName when truthy, otherwise email; missing Head displays “No head.” Employees has a proportional InlineBar and rounded share of total employees. A zero denominator yields zero percent and zero-width bars. Team and service cells display their count or zero.
- Created is formatted with current date preferences; no time is visible. PreferencesProvider starts with default preferences while its request is pending, applies returned preferences afterward, and silently retains defaults if that request fails; the page does not wait on `preferencesLoaded` before formatting.

The page does not render department color, description, headId, updatedAt, employee records, team rows or service names. It displays a Head’s email only when fullName is falsy.

### Gap summary

For a non-empty settled list, the page builds Without a head, No employees and No services. Groups can overlap. Each group’s names inherit the alphabetical by-name sort. Empty groups are omitted. If all groups are empty, the page shows “None. Every department has a head, employees, and services.” The Gaps section is omitted while loading or when there are no departments.

### Navigation, semantics and responsive behavior

The PageHeader action is a native Next Link wrapped by the shared Button primitive, named “Manage departments,” with href /departments and a forward transition. It is the only page action. There are no row controls or mutation dialogs.

The page exposes a named main landmark, section headings, a labeled figures definition list with aria-busy, native table headings, and each InlineBar as a labeled image role. Loading rows are aria-hidden. No custom focus state exists; keyboard activation follows native link behavior.

At widths up to 640px, Head, Teams and Services are hidden. Created is hidden through 1024px and visible from 1025px. Gap rows switch to vertical layout at 560px and below. FiguresRow remains a four-column grid; its warning note is hidden at 560px and below. These are source breakpoints, not freshly rendered visual observations.

## Persistence and data projection

The page performs no write. For ADMIN/SUPERADMIN, departmentsRepository.findDepartmentsWithCounts uses a department findMany ordered by name with Head id/email/fullName/role and relation counts for employees, teams and services. The service maps fields consumed by the page plus management metadata. Roles without employees:read use departmentSummarySelect and Head id/fullName. The page computes presentation values from the response. It creates no history, mutates no counts and persists no UI state.

Source references: apps/api/src/features/departments/departments.repository.ts:42-98, 120-135; apps/api/src/shared/query/selects.ts:4-9; apps/api/src/features/departments/departments.service.ts:35-48; apps/web/src/features/departments/pages/department-overview-page.tsx:25-221; apps/web/src/components/ui/overview-panel.tsx:191-308.

## Historical comparison and scope limits

Phase 1 accurately identifies the route and notes that overview UI was not separated from shared department tests. Current source confirms the broader Phase 1 API-family grouping but shows no PG-022 write/detail calls. No feature was inferred from neighboring PG-021 management behavior.

PG-004-D-001 is a shared department row-action/menu defect; this overview renders no row-action trigger. PG-021’s four failures and C001 concern the separate management page and remain recorded for later consolidated review. PG-021 is not a prerequisite to this discovery and no PG-021 issue was repaired or reclassified here.

The route has no user-entered field, search, pagination, upload, download, export or mutation. Input validation, rejected-write side effects, transaction rollback, attribution and write concurrency are inapplicable. Response text safety, asynchronous list lifecycle, read authorization, projection privacy and scale are covered in the design package. The API returns an unpaginated list; no product limit or response-volume budget is documented, so a bounded-scale oracle needs clarification.

Static test source was inspected only. Existing coverage and limits are in PG-022_EXISTING_TEST_BASELINE.md. Proposed cases and dependencies are authoritative in PG-022_TEST_CASE_SPECIFICATION.md.

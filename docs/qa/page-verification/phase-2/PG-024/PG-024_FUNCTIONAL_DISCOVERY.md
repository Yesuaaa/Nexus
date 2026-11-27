# PG-024 Functional Discovery

**Phase:** 2.1 source discovery and test design  
**Task entry:** Branch `293-test-full-system-audit-for-verifying-recent-changes`, full HEAD `af31220286f691535a129a8effc674b506572f6a`; clean index and worktree.  
**Original PG-023 Phase 2.2 continuation checkpoint:** `94eb190deea91197e53bc94c9ade149d8487d687`; the later `af312202` commit contains the completed PG-023 browser/report update. This discovery uses the actual `af312202` checkout.  
**Entry `apps/web/next-env.d.ts` SHA256:** `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.

## Verified identity

The authoritative registry is `docs/qa/page-verification/PHASE_1_COMPLETE_ROUTE_INVENTORY.md:34`: PG-024 is the static Portal route `/employees/overview`, in People & HR. `PHASE_1_PAGE_COMPONENT_MAPPING.md:45` maps it to `EmployeeOverviewPage` through the module-transition wrapper. `PHASE_1_PAGE_FUNCTIONALITY_INVENTORY.md:30` describes reviewing employee overview metrics and navigating to the directory. `PHASE_1_PAGE_AUTHORIZATION_MATRIX.md:49` records `ADMIN` or `SUPERADMIN` with `employees:read`. `PHASE_1_PAGE_API_DEPENDENCIES.md:18` groups PG-023 and PG-024 under the employee API; current source adds a second dependency on `/api/departments` through `useDepartments`.

Current route source is [`apps/web/src/app/(portal)/employees/overview/page.tsx`](../../../../../apps/web/src/app/%28portal%29/employees/overview/page.tsx:1). It renders `EmployeeOverviewPage` inside `ModuleTransition`. The feature implementation is [`apps/web/src/features/employees/pages/employee-overview-page.tsx`](../../../../../apps/web/src/features/employees/pages/employee-overview-page.tsx:37). This is a static route, not a dynamic employee ID route. It reads no query string, browser storage, or form input. Its only page action is the `Manage employees` link to `/employees`.

## Route and authorization trace

The portal layout calls `useAccount`, which obtains the current account through `/api/auth/me`; an absent token or a 401 returns to the role-appropriate login route. `route-policy.ts:592-597` registers the exact `/employees/overview` path with `canAccessEmployeeManagement`. That predicate requires a privileged role (`ADMIN` or `SUPERADMIN`) **and** `employees:read`; the portal redirects denied internal accounts to `/module` and a `USER` to `/dashboard` (`portal-layout.tsx:24-34`). This is UI admission only.

The employee router applies `requireAuth` to all routes and `requirePermission(EMPLOYEES_READ)` to `GET /api/employees` (`apps/api/src/features/employees/employees.controller.ts:38-76`). Current API grants give `employees:read` and `employees:manage` to `ADMIN` and `SUPERADMIN`; `STAFF` and `USER` do not receive either (`apps/api/src/features/auth/auth.permissions.ts:32-80`). The overview uses only the read endpoint. Its UI has no management controls and does not need `employees:manage`. The separate `GET /api/departments` route requires `departments:read`; the service returns a rich HR summary only to actors who also have `employees:read`, otherwise it returns the limited department directory. The page's own route admission currently excludes `STAFF` even though Staff can read that limited department endpoint directly.

The old `docs/features/employee-management.md:9` says only `ADMIN` has employee read access and says `SUPERADMIN`, Staff, and User cannot access the API. That statement conflicts with the current web and API permission maps and the Phase 1 PG-024 row. Treat it as stale product documentation; this task does not edit it or change authorization.

## Implemented read flow

`EmployeeOverviewPage` starts `loadOverview` once through `useAsyncResource` and separately starts the shared `useDepartments` hook (`employee-overview-page.tsx:89-98`). `loadOverview` invokes `listEmployees` nine times concurrently, all at `page: 1`; it discards each page's `employees` array and returns only `total` values (`:37-64`). `useDepartments` issues one GET to `/api/departments` and returns the department list (`apps/web/src/features/departments/hooks/use-departments.ts:15-31`). The web API client uses same-origin `/api/...`; `apps/web/next.config.ts:62-67` rewrites `/api/:path*` to the configured Express API origin.

| Concurrent Employee GET | Query filter                                                  | Display use                                 |
| ----------------------- | ------------------------------------------------------------- | ------------------------------------------- |
| 1                       | none; `page=1`                                                | Employee directory total                    |
| 3                       | `status=ACTIVE`, `ON_LEAVE`, `INACTIVE`                       | Status figures and availability composition |
| 1                       | `archived=true`                                               | Optional “N archived” note beside total     |
| 4                       | `employmentType=FULL_TIME`, `PART_TIME`, `CONTRACT`, `INTERN` | Employment-type counts and shares           |

The employee endpoint validates query strings, page bounds, and status/type enums, then calls `employeesRepository.listAccounts` (`employees.controller.ts:41-76`). The repository starts from `User` roles `ADMIN`/`STAFF`, distinguishes archived state by `accountDeletedAt`, and applies status/type/department filters through the related `Employee` row (`employees.repository.ts:96-130`). The directory response contains up to the default page size of 10 projected account and HR rows plus `total`, `page`, and `pageSize`; its mapped row includes account/Employee IDs, names, image URL, email, contact, position, employment type/status/start date, department/team identifiers and summaries, account role/deletion/activation state, and timestamps. It does not select a password hash. The overview reads only `total`. Inactive logins remain in the default directory population because the query does not filter `User.isActive`. HR status is separate from login activation.

`Department` data is loaded independently. For privileged HR readers, `departmentsService.listDepartments` maps the department's raw `_count.employees` to `memberCount` (`apps/api/src/features/departments/departments.service.ts:35-52`; `departments.repository.ts:82-96`). That relation count is not filtered by login state or by whether an Employee has a linked User. The privileged list response also includes Department metadata and the Head's ID/email/name/role; the overview consumes only name and member count. Staff with `departments:read` but without `employees:read` receive the limited directory allowlist (`id`, `name`, `code`, `color`, and Head ID/name); the Employee Overview route itself excludes Staff. The UI sorts by descending `memberCount`, then `name.localeCompare`, and sums those counts as “N placed” (`employee-overview-page.tsx:97-103,220-267`). The source populations differ: the employee total is an account directory count, while department placement is an Employee relationship count. Do not add a test that requires these values to be equal without an approved common-population rule.

The web rewrite is actual application routing, but it is not exercised by any PG-024 runtime in this phase. Historical actual rewrite executions for the exact employee list and department list paths are recorded in PG-023 T033 and PG-022 T009; their boundaries are detailed in the existing-test baseline.

## Metric and rendering behavior

- The “Employees” figure is `data.total`; the archived count is a note only when it is positive. `active`, `onLeave`, and `inactive` are separate HR-status filters, not login `isActive` checks (`:119-143`).
- Availability uses `CompositionBar` with Active, On leave, and Inactive. The shared component exposes a named `role="img"` with segment values and percentages; a zero denominator yields 0% (`overview-charts.tsx:1-59`).
- Employment type labels and request filters come from the four fixed source options in `features/employees/model/employment.ts:4-25`. Each row's share is `Math.round(value / total * 100)` when total is positive, otherwise 0 (`employee-overview-page.tsx:66-85`).
- The department table preserves all returned department rows; it displays a zero member count as “None,” hides only the Share column at `max-width: 480px`, and shows an empty/error sentence instead of a table when the department array is empty (`:220-269`).
- The page uses native headings, tables, definition-list figures and labeled charts; no employee detail value is rendered by the page component. Department names are interpolated as ordinary React text, not HTML.

## Loading, failure, cancellation, and recovery

The page keeps all overview sections in skeleton state until the Employee batch has either data or an error **and** the department request has data or an error (`:97-103`). `useAsyncResource` uses one `AbortController` per load, aborts on cleanup, ignores stale completion, and exposes a retry callback (`apps/web/src/lib/use-async-resource.ts:14-92`). The same employee signal is passed to all nine requests; the department hook has its own signal.

The Employee calls are combined with `Promise.all`; one failed request rejects the whole overview load. On an initial failure the page shows the error alert and “Try again,” but also defaults displayed counts to `0` (`:104-146,183-218`). This is observed source behavior; the intended representation of unavailable figures is not established. Department errors are rendered as the department empty-table sentence. Although `useDepartments` exposes `retry`, the page does not render a retry control for it. Whether the department error should have an in-place retry is unresolved. A retry of the employee batch starts a new load; the existing page has no search/filter control that can trigger a successful-load/changed-key race.

`requireAuth` may touch `Session.lastActiveAt` when a session has been idle for more than five minutes. The Employee and Department GET service paths themselves are read operations: this page creates no Employee, User, Department, Team, or history records; performs no mutation, notification, or domain audit write; and has no concurrency between competing page-initiated writes.

## Responsive and navigation behavior

The employment-type and department sections stack below Tailwind's `lg` breakpoint and use a two-column grid at/above it (`:179`). The department Share column is hidden at widths up to and including 480 CSS px (`:232,264`). `FiguresRow` also changes layout at 560px (`overview-panel.tsx:294-348`). The existing page smoke test visits 1440px and 390px but does not assert these boundaries. Proposed exact iterations and their source basis are in the case specification; they characterize current CSS and do not claim separate design approval.

`PageHeaderLink` is a native Next link to `/employees` and sets the module's forward transition type (`components/layout/page-header-link.tsx:31-61`). Browser back/refresh use the same static route and have no page-owned query/storage state to restore.

## Historical and discovery limits

PG-023 remains complete at 18/18 planned NEW registrations, 31 PASS / 3 FAIL / 5 PARTIAL among 39 implementable cases, and three separate C001/C002/C003 deferrals. Preserve T008's enabled Department picker after options failure; T010's 188px versus expected 58px row at 1001px (all five widths ran); T032's 201/500 versus 201/409 under confirmed independent PostgreSQL contention and SQLSTATE `40001`, with final persistence checks unreached; and partial T002/T005/T014/T028/T029 at the exact boundaries in `PG-023_FINAL_VERIFICATION.md`. PG-023's 17 hypotheses remain 3 VERIFIED CONTROL, 11 PARTIAL, 3 BLOCKED — CONTRACT. Its T033 remains a read-only actual Next rewrite GET check, and its T031 remains retained PostgreSQL deactivation/attendance contention coverage.

No PG-024 test was written, imported, runtime-discovered, or run. No application, API, auth, test, fixture, schema, dependency, or CI source changed. Source inspection documents implemented behavior, not runtime success or product approval of undocumented behavior.

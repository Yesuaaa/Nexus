# PG-009 Functional Discovery

## Scope and repository baseline

This report records Phase 2.1 source discovery and test design for PG-009 only. No tests were implemented or executed, and no application or test source was changed.

| Item                    | Task-entry evidence                                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch                  | `293-test-full-system-audit-for-verifying-recent-changes`                                                                                                  |
| HEAD                    | `cccf2d5c788f551ba155010973dc32084ed4abf7`                                                                                                                 |
| Worktree                | Clean; no staged, unstaged, or untracked changes                                                                                                           |
| Prior reported baseline | `3c28524299253f8e6ff9da0f2603e398f43d6516`                                                                                                                 |
| Difference              | Current HEAD is one commit later than the PG-008 discovery baseline; the current repository is authoritative. No branch or commit operation was performed. |

## Approved page identity

| Field                 | Verified identity                                                                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stable page ID        | `PG-009`                                                                                                                                                                    |
| Canonical URL         | `/attendance/policies/overview`                                                                                                                                             |
| Next.js route source  | `apps/web/src/app/(portal)/attendance/policies/overview/page.tsx`                                                                                                           |
| Main component        | `AttendancePoliciesOverviewPage` in `apps/web/src/features/attendance/pages/attendance-policies-overview-page.tsx:19`                                                       |
| Feature/module        | Attendance feature; Workforce Compliance module, Policies group                                                                                                             |
| Phase 1 feature       | `PG-009-F001`: review attendance policy summary and navigate to management                                                                                                  |
| Implementation status | Route and component are present; current route/component mapping agrees with Phase 1. Source discovery is complete; page-level test execution was not authorized.           |
| Redirect aliases      | None identified for this rendered page. `/attendance/policies/management` is the distinct PG-008 management page. Other legacy attendance routes do not redirect to PG-009. |

Phase 1 identity sources: `PHASE_1_COMPLETE_ROUTE_INVENTORY.md:19`, `PHASE_1_PAGE_COMPONENT_MAPPING.md:30`, `PHASE_1_PAGE_FUNCTIONALITY_INVENTORY.md:15`, and `PHASE_1_PAGE_AUTHORIZATION_MATRIX.md:34`. The Phase 1 API map groups the policy pages under the attendance API family; that grouping is consistent with the exact endpoint traced below.

## Route, layout, providers, and navigation

The route file is a thin static entry that imports and renders the feature page component. `apps/web/src/app/layout.tsx:1-32` supplies root `AuthProvider`; `(portal)/layout.tsx` wraps the page in `PortalLayout`. `components/layout/portal-layout.tsx:15-90` loads the account and composes `AccountContext`, `PreferencesProvider`, `BreadcrumbLabelProvider`, `WorkspaceProvider` for non-USER routes, and `RoleLayout`. There is no PG-009-specific provider or local form state.

Navigation entry points are:

- Attendance → Policies → Overview, defined in `apps/web/src/features/attendance/model/navigation.ts:78-91`.
- The page header action `Manage policies` and the `Open policy management` action in the assignment-history section; both link to `/attendance/policies/management` (`attendance-policies-overview-page.tsx:47-55, 150-157`).

The Policies group and Overview link use `access: "configure"`. `route-policy.ts:350-380` maps the route to `canConfigureAttendance`; `features/auth/model/permissions.ts:118-124` requires an active privileged account with `employees:manage`. Phase 1 identifies the allowed roles as active `ADMIN` and `SUPERADMIN` with that permission. The page has no page-specific authentication mechanism; access is inherited from the portal and route policy.

## Source trace: route to persistence

| Layer                | Source and observed behavior                                                                                                                                                                                                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route                | `apps/web/src/app/(portal)/attendance/policies/overview/page.tsx:1-4` renders `AttendancePoliciesOverviewPage`.                                                                                                                                                                                                                                                                       |
| Component            | `apps/web/src/features/attendance/pages/attendance-policies-overview-page.tsx:19-299`; client component, one resource request, derived display collections, four sections, no writes.                                                                                                                                                                                                 |
| Hook/state           | `useAsyncResource(attendancePolicies, [], { fallbackError: "Couldn't load policy summaries." })` at lines 20-22. The component derives data only when loading and error are both false; `ResourceStatus` receives the error and retry callback. `FiguresRow` and each section render their loading, error, and empty branches.                                                        |
| API client           | `apps/web/src/features/attendance/api/attendance-api.ts:283-320`. `attendancePolicyPage` issues a same-origin GET to `/api/attendance/policies` with `page` and `size`; default size is 200. `attendancePolicies` fetches page 1 and sequentially fetches every later page through `ceil(total/pageSize)`, concatenating policy rows. The overview calls it without status or search. |
| Express mount/router | `apps/api/src/app.ts:131` mounts the attendance router at `/api/attendance`. `apps/api/src/features/attendance/routes.ts:16,35-36` applies `requireAuth` to the router and forwards `GET /policies` to `management.policies(req.auth.user.id, req.query)`. There is no separate controller for this endpoint.                                                                         |
| Service              | `apps/api/src/features/attendance/attendance.management.ts:82-97,795-860`. The service validates allowed query keys, page, search length, status and size; checks manager scope; computes summary counts and returns the requested page in a `RepeatableRead` transaction.                                                                                                            |
| Persistence          | Prisma `AttendancePolicy`, `AttendancePolicyDay`, and `AttendancePolicyAssignment` in `apps/api/prisma/schema.prisma:1474-1517`. Policy rows include days and `_count.assignments`; this endpoint is read-only.                                                                                                                                                                       |

The client sends `page=1&size=200` initially. It does not pass search or status. The server accepts `size=10` or `size=200`; optional status is `active` or `archived`; search is validated and applied to policy name/time zone. The returned summary is global even if filters are supplied. `total` is filtered when search/status is supplied; for this page it is the unfiltered policy total.

### Authorization and data scope

Frontend route access and backend enforcement are separate. The backend router requires authentication, then `managementScope(tx, userId, true)` requires `employees:manage`; unsupported actors receive 403. For authorized ADMIN/SUPERADMIN actors, `managementScope` returns no department filter, so this endpoint is organization-wide. The page displays policy names, archived status, time zones, assignment counts, and aggregate counts. It does not display employee identities or accept a department/owner filter. There are no page mutations or ownership-scoped writes.

### Query and response data

The service validates `page`, `search`, `status`, and `size`. It calculates total policies, active policies, archived policies as total minus active, and assignment periods with `cancelledAt: null`. It returns policies ordered by `createdAt DESC, id DESC`, with policy days ordered by weekday and an unfiltered relation count of assignments. The client returns the first page's summary and concatenated policies. No frontend search, filter, sort, or pagination control is present.

## User-visible behavior

1. **Initialization and retry.** Initial resource load produces loading skeletons in policy status, history, inventory, and no-history sections, plus the busy state on the figures list. A request error removes usable data, shows the shared Retry control, displays `—` KPI values and section-specific unavailable messages. Retry is supplied by `useAsyncResource` through `ResourceStatus`.
2. **Policy figures.** `FiguresRow` displays Policies, Active, Archived, and Assignment periods from the response summary. Error values render as `—`.
3. **Status breakdown.** With policies present, the page renders Active and Archived counts and each percentage as `Math.round(value / totalPolicies * 100)`. With total zero, it renders `No policies yet.` and does not render the division table.
4. **Assignment history.** Policies with `_count.assignments > 0` are sorted by assignment count descending and then policy name ascending. The table displays at most eight, with a relative `InlineBar` and count. The section count reflects all filtered policies in the client collection, not only the eight displayed rows.
5. **Recent inventory.** The page renders the first eight policies in the server's createdAt/id order. Each row displays name, Active/Archived from `archivedAt`, timezone, and assignment count. The timezone column is hidden at viewport widths of 560px or less. The section aside uses the number of all loaded policies even though the table shows at most eight.
6. **Active policies without history.** The page selects non-archived policies with zero assignment count, sorts alphabetically, and displays every match. The empty state says no active policies without history are in this preview.
7. **Management navigation.** The two named actions link to the distinct PG-008 route `/attendance/policies/management`.
8. **Responsive and semantic structure.** The page uses `AttendanceShell`, a named main region, section headings, tables, a definition list for policy figures and the no-history list, native Next links, and `InlineBar` labels. `overview-panel.tsx` supplies shared display primitives. There are no dialogs, row menus, forms, date inputs, or mutations on this page.

There is no page-level search, filtering, user-controlled sorting, or manual pagination. Keyboard interaction is limited to native navigation links and the shared Retry button. No custom key handler is present.

## Existing relevant coverage and source discrepancy

Phase 1 labels PG-009 coverage `PARTIAL; overview-only counts/links not isolated` (`PHASE_1_EXISTING_TEST_COVERAGE.md:39`). Current source inspection found a direct but partial PGlite-backed browser route assertion and direct API tests. Coverage details and declaration references are in `PG-009_EXISTING_TEST_BASELINE.md`; no test was run in this discovery.

One existing API assertion compares `summary.assignmentPeriods` to the count of all `AttendancePolicyAssignment` rows (`apps/api/tests/features/attendance/policy-management.test.ts:187-215`). The current service filters this summary count to `cancelledAt: null`. Current fixture data has no canceled row, so the assertion does not expose the difference; it is not evidence about canceled-row product semantics. This is recorded as contract C002, not silently treated as a failure or as an intended reconciliation rule.

## Contract ambiguities

### C001 — Policy population represented by the preview labels

The API client loads every page until all policies are collected. The UI copy for assignment history and no-history describes the “latest 200 policies,” while both derived collections use all loaded policies. The recent inventory renders eight rows but labels its aside `${policies.length} shown`. For inventories above 200, the intended scope of “latest 200,” whether the section count means loaded or rendered rows, and whether older policies should affect ranking/no-history are not established. Do not write an expected product result until clarified.

### C002 — Canceled assignments in per-policy history

The aggregate “Assignment periods” count excludes canceled assignments; the included policy relation `_count.assignments` counts all related assignments. History ranking and inventory use that relation count. Requirements do not say whether canceled assignments should appear in or affect per-policy history counts, or whether those counts should reconcile with the aggregate. Preserve the source behavior and defer the product assertion.

## Shared risks and boundaries

- PG-009 does not import `RowActionsMenu`; PG-004-D-001 and PG-006 T018 are not exposed by this page's controls.
- PG-006 T024 was intermittent at 820px on the Check-Ins page. PG-009 has an existing 390/820/1440px cross-route responsive assertion; that prior result is a reason to preserve width coverage, not evidence of a PG-009 failure.
- The page uses shared `useAsyncResource`, `ResourceStatus`, and `overview-panel` display primitives. Their generic behavior is indirect coverage only; PG-009-specific multi-page failure, content, and Retry assertions are absent.
- No writes, employee records, department-level data, concurrency transitions, or user input constraints apply to this page. Mutation/concurrency scenarios are not applicable.

## Discovery outcome

Page identity and current source mapping agree with Phase 1. Source discovery covers route access, initial data aggregation, summary, status, history ranking, inventory, no-history list, management links, loading/error/empty behavior, and responsive/semantic rendering. The test design contains 20 unique records, including two contract-blocked cases; counts and coverage are in the case specification. Phase 2.1 does not claim runtime pass status.

    # Converyn — Phase 7.5-D1-03

    ## Dashboard and Workspace Selector Verification

    ## Document Control

    | Field                     | Value                                                        |
    | ------------------------- | ------------------------------------------------------------ |
    | Project                   | Converyn (formerly Nexus)                                    |
    | Page                      | Page 03 — Dashboard / Workspace Selector                     |
    | Routes                    | `/`, `/dashboard`, `/module`, `/module/[moduleId]`           |
    | Report date               | 2026-11-17                                                   |
    | Branch                    | `263-fixglobal-implement-fixes-for-issue-backlogs(REG-001)`  |
    | Task-start and final HEAD | `808d0fbb9b9b9a8f6d6b4f6cb004603ecebda1b6`                   |
    | Final status              | PAGE 03 PARTIALLY COMPLETE — DOCUMENTED CONTRACT LIMITATIONS |

    ## 1. Executive Summary

    The current landing contract is role-specific: Clients (`USER`) use `/dashboard`; internal users (`STAFF`, `ADMIN`, `SUPERADMIN`) use `/module`. The root route sends an unauthenticated visitor to `/login` and an existing session to `/dashboard`; the portal shell then moves internal users to `/module`. The historical Dashboard remains an active, accessible client page.

    The selector uses effective permissions and current Department Head assignment to show implemented workspaces and direct users to their role-specific destinations. Frontend route policies and the backend independently restrict global administrative module access. Unknown or unimplemented module IDs fail safely. The PGlite permission test confirms that only `SUPERADMIN` has the backend `modules:access-all` capability.

    No application defect was confirmed. One new anonymous-route browser test was added. A non-historical module-navigation test had two stale assumptions; its interaction setup and current Project Overview expectations were corrected without changing its route or access assertions. All final targeted browser, unit, and PGlite checks passed.

    Two matters remain for administrative review: the intended behavior for generic direct routes to People & HR, Workforce Compliance, and Administration, and whether the historic `/dashboard` fallback assertions map to the current internal `/module` destination. The role-access document also lists a different Superadmin Project Management selector URL than the current registry and browser test.

    ## 2. Repository State

    - Repository root: `C:/Users/ADMIN/Documents/Thesis/Nexus`.
    - Branch: `263-fixglobal-implement-fixes-for-issue-backlogs(REG-001)`.
    - Task-start and final HEAD: `808d0fbb9b9b9a8f6d6b4f6cb004603ecebda1b6`.
    - The worktree and index were clean at task start; there were no staged, unstaged, or untracked changes. The committed Page 01 and Page 02 work was preserved.
    - This task changes only two current browser specs and creates this report. No application, API, permission, route, database, or historical-baseline source was changed. No commit or push was made.
    - Root [AGENTS.md](../../../../../AGENTS.md) and [Web AGENTS.md](../../../../../apps/web/AGENTS.md) were inspected. No Next.js application code was written.

    ## 3. Historical Dashboard Contract

    The original Page 03 inventory and the Phase 7.4.1 audit describe `/dashboard` as a minimal authenticated shell, without Dashboard widgets, metrics, charts, or a Dashboard data endpoint. The historical audit maps 29 Dashboard identities, including five live-only identities `PW-124`–`PW-128`. It records the Dashboard page as part of shared authenticated navigation and role coverage.

    The current page retains that limited content for `USER`: an accessible main landmark with a Dashboard heading and navigation guidance. Internal accounts no longer render this page; the portal shell redirects them to `/module`. The current role-specific behavior is also described in the [module access guide](../../../../features/module-role-access.md) and exercised by current role-navigation tests. This route change does not alter the historical Page 03 report or its assertions.

    Historical references: [Page 03 audit](../page-by-page/page-03-dashboard.md), [D0 inventory](./phase7.5-D0-comprehensive-defect-inventory.md), and [Phase 7.5.1 preservation reconciliation](../phase7.5.1-historical-preservation-reconciliation.md).

    ## 4. Current Route Inventory

    | Route                                 | Current implementation                                                                                                                                                                                                                                     | Access and result                                                                                                                                                                                                                               |
    | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `/`                                   | [`HomeRedirect`](../../../../../apps/web/src/features/auth/components/home-redirect.tsx) checks for a session token in the browser.                                                                                                                        | No token: replace to `/login`. Token present: replace to `/dashboard`; internal roles then move to `/module` after account loading.                                                                                                             |
    | `/dashboard`                          | [`DashboardPage`](../../../../../apps/web/src/features/dashboard/pages/dashboard-page.tsx) renders in the portal shell.                                                                                                                                    | `USER`: renders the client Dashboard. `STAFF`, `ADMIN`, `SUPERADMIN`: portal shell replaces the route with `/module`. Anonymous users are sent to login.                                                                                        |
    | `/module`                             | [`ModulePage`](../../../../../apps/web/src/features/workspaces/pages/module-page.tsx) renders in the internal selector shell.                                                                                                                              | Active internal accounts can open it. `USER` is redirected to `/dashboard`; anonymous users are redirected to login. Accounts with no available modules see an accessible empty state.                                                          |
    | `/module/[moduleId]`                  | [`module/[moduleId]/page.tsx`](../../../../../apps/web/src/app/%28portal%29/module/%5BmoduleId%5D/page.tsx) checks the central registry before rendering [`ModuleEntryPage`](../../../../../apps/web/src/features/workspaces/pages/module-entry-page.tsx). | Implemented IDs require active, non-deleted account status and `modules:access-all` in the frontend policy. `USER` denial returns to `/dashboard`; internal denial returns to `/module`. Unknown or unimplemented IDs use Next.js `notFound()`. |
    | `/module/service-operations/workload` | Separate static nested route; it is not the `[moduleId]` page.                                                                                                                                                                                             | Requires global module access and organization-read permission.                                                                                                                                                                                 |

    The dynamic page's generic module data comes from `GET /api/modules/:id`. The backend router requires authentication and the service independently verifies global module access. A browser-side route policy is not treated as backend authorization.

    ## 5. Root and Login Redirect Behavior

    `/` uses a client redirect based on token presence, not a server-side role lookup. A token-bearing internal user briefly targets `/dashboard`; [`PortalLayout`](../../../../../apps/web/src/components/layout/portal-layout.tsx) then replaces it with `/module`. Authenticated login uses the resolved account role directly in [`AuthPage`](../../../../../apps/web/src/features/auth/pages/auth-page.tsx): `USER` lands on `/dashboard`, and other roles land on `/module`. Registration remains a client-only flow and lands on `/dashboard`.

    The role-based landing and anonymous protected-route behavior passed in `auth/staff.spec.ts` and `auth/regression.spec.ts`. The new browser case separately verifies that anonymous access to `/module` and `/module/project-management` returns to `/login` without showing protected page content.

    ## 6. Role-Based Routing Matrix

    | Role                                            | Root destination | `/dashboard`              | `/module`                                                                                                                                                                                                                                     | Module access                                                                                                                                                                                        | Unauthorized behavior                                                                                                                         |
    | ----------------------------------------------- | ---------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
    | Client (`USER`)                                 | `/dashboard`     | Renders client Dashboard. | Redirects to `/dashboard`.                                                                                                                                                                                                                    | No internal selector entries; uses direct client navigation. Dynamic administrative module routes are denied.                                                                                        | Protected page routes return to `/login` when unauthenticated; authenticated `/module` or module denial returns to `/dashboard`.              |
    | Staff (`STAFF`)                                 | `/module`        | Redirects to `/module`.   | Project Management at `/project-workspace`; Workforce Compliance at `/attendance/check-ins`; Billing & Finance placeholder.                                                                                                                   | No `modules:access-all`; direct global module IDs are denied.                                                                                                                                        | Internal denied route returns to `/module`; backend administrative module API returns 403.                                                    |
    | Department Head (`STAFF` with current `headOf`) | `/module`        | Redirects to `/module`.   | Service Operations at `/request-inbox`; Project Management at `/project-workspace`; Workforce Compliance at `/attendance/overview`; Billing & Finance placeholder.                                                                            | Head assignment changes the permitted Service Operations and Attendance routes; it does not create a separate role or global module capability.                                                      | Same Staff fallback and API denial. Head-scoped operational access remains limited by route policy and backend scope checks.                  |
    | Admin (`ADMIN`)                                 | `/module`        | Redirects to `/module`.   | Service Operations at `/services`; People & HR at `/employees` or `/departments` according to permissions; Workforce Compliance at `/attendance/overview`; Billing & Finance placeholder.                                                     | No `modules:access-all`; uses role- and feature-permission-based destinations.                                                                                                                       | Internal denied route returns to `/module`; backend global module API returns 403.                                                            |
    | Superadmin (`SUPERADMIN`)                       | `/module`        | Redirects to `/module`.   | Service Operations at `/services`; Project Management at `/project-management/overview`; People & HR at `/employees`; Workforce Compliance at `/attendance/time-logs/overview`; Administration at `/accounts`; Billing & Finance placeholder. | Has `modules:access-all` while active and not deleted. Direct registered dynamic IDs are allowed by the current route policy; operations still retain their own backend scope and capability checks. | Unknown/unimplemented dynamic IDs return not-found; backend returns 404 for unknown/unimplemented IDs. Inactive account authentication fails. |

    Module cards are permission-filtered, not role-name-only. [`getWorkspaceModules`](../../../../../apps/web/src/features/dashboard/model/workspace-modules.ts) derives the available entries, and the [`route policy`](../../../../../apps/web/src/features/workspaces/model/route-policy.ts) guards their destinations. A Superadmin account with no effective permissions sees the safe empty selector state; administrative direct routes also require the explicit capability. A Department Head is a current assignment on a Staff account.

    ## 7. Workspace Selector Functionality

    - The selector derives cards from the central registry, effective permissions, active account status, and current `headOf` assignment. Only implemented modules receive routes.
    - Cards expose the registry's title and description. Selecting an available card preserves the authenticated session and uses its configured destination.
    - Billing & Finance is the intentionally unsupported module. It appears as a focusable, `aria-disabled` “Coming Soon” placeholder with no destination; it provides no finance access.
    - If no workspace is available, the selector presents “No workspaces available” as a status and no workspace links.
    - More than five entries use a carousel with labeled previous/next buttons, arrow-key handling, and a polite live region. Existing Playwright coverage checks keyboard movement, carousel limits, and centering at 390, 715, and 1440 pixels.
    - Existing coverage verifies selector shell controls, role-specific cards, Department Head filtering, client direct navigation at 390 and 1440 pixels, session retention, selection, return through “Switch Workspace,” and no horizontal overflow at the tested sizes.
    - Account loading and lookup errors are handled by the shared `PortalLayout`; module-entry data loading and API errors are handled by `ModuleEntryPage` with a retry control. Selector cards themselves do not fetch module data.

    ## 8. Dynamic Module Entry Behavior

    | Module ID               | Registry        | Current direct `/module/[moduleId]` behavior                                                                                           | Current selector destination                                                                                    | Classification                                                     |
    | ----------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
    | `service-operations`    | Implemented     | Administrative request inspection through `AdministrativeRequestsPage`; the backend module endpoint supplies metadata.                 | Role-specific: `/services` or `/request-inbox`. Superadmin can also use the dedicated request-inspection route. | IMPLEMENTED                                                        |
    | `project-management`    | Implemented     | Administrative project inspection through `AdministrativeProjectsOverview`; operational Staff reads and actions are separately denied. | Current registry and selector test use `/project-management/overview`.                                          | IMPLEMENTED; selector-route documentation discrepancy noted below. |
    | `people-hr`             | Implemented     | The generic entry currently displays “Additional administrative tools are not available here yet.”                                     | `/employees`, or `/departments` when only department permission is available.                                   | UNRESOLVED CONTRACT for the generic direct entry.                  |
    | `attendance-monitoring` | Implemented     | The generic entry currently displays “Additional administrative tools are not available here yet.”                                     | Role-specific Attendance destination.                                                                           | UNRESOLVED CONTRACT for the generic direct entry.                  |
    | `administration`        | Implemented     | The generic entry currently displays “Additional administrative tools are not available here yet.”                                     | `/accounts`.                                                                                                    | UNRESOLVED CONTRACT for the generic direct entry.                  |
    | `billing-finance`       | Not implemented | The dynamic page calls `notFound()`; the backend reports module unavailable.                                                           | No destination; disabled placeholder only.                                                                      | INTENTIONALLY UNSUPPORTED.                                         |

    The Page 7.5-N1 audit explicitly leaves direct dynamic entry behavior for People & HR, Attendance, and Administration for administrative disposition. No placeholder was turned into a functional page and no redirect contract was invented. The [shared module registry](../../../../../apps/api/src/features/modules/module-registry.json) and [`ModuleEntryPage`](../../../../../apps/web/src/features/workspaces/pages/module-entry-page.tsx) establish the current implementation. The existing [module access guide](../../../../features/module-role-access.md) lists `/module/project-management` as the Superadmin Project Management entry, while the current shared registry and [`superadmin-module-access.spec.ts`](../../../../../apps/web/e2e/superadmin-module-access.spec.ts) route selector selection to `/project-management/overview`. The direct `/module/project-management` route remains implemented and is exercised by [`administrative-projects.spec.ts`](../../../../../apps/web/e2e/administrative-projects.spec.ts), but the intended canonical selector URL in the guide should be reconciled.

    ## 9. Existing Regression Coverage

    The following existing tests were inspected and relevant current suites were executed:

    - `dashboard/dashboard.spec.ts`: role-specific Dashboard rendering/redirect, accessible shell, account loading/error, and notifications.
    - `workspace-selector.spec.ts`: module cards by role and Department Head status, empty state, client direct navigation, responsive behavior, keyboard carousel operation, login shell selection, and workspace switching.
    - `module-scoped-navigation.spec.ts`: module-scoped navigation, shared utilities, Department Head context, account isolation, protected routes, and history behavior.
    - `superadmin-module-access.spec.ts`: selector destinations, backend denial, non-Superadmin route denial, unknown/unavailable IDs, and safe error content.
    - `administrative-projects.spec.ts` and `administrative-requests.spec.ts`: direct dynamic Project Management and Service Operations entry behavior with mocked browser APIs.
    - `auth/staff.spec.ts`, `auth/admin.spec.ts`, `auth/regression.spec.ts`, and `auth/portal-regression.spec.ts`: role landing, denied routes, protected deep links, session preservation, and redirects.
    - `shared/project-pages-regression.spec.ts` and `shared/table-interactions.spec.ts`: the remaining current specs attributed to historical Page 03 shared route coverage.
    - Unit tests: `route-policy.test.mjs`, `module-registry.test.mjs`, `workspace-selection.test.mjs`, `workspace-modules.test.mjs`, and `auth-portal.test.mjs`.
    - API authorization: `apps/api/tests/features/auth/module-access.test.ts`, using the isolated PGlite app.

    ## 10. Historical Preservation Impact

    - The immutable 292 identities, 1,630 historical assertion sites, and 4,211 ownership mappings were not edited. The Phase 4 baseline, Phase 6 ledgers, Page 03 audit, and Page 7.5.1 reconciliation remain unchanged.
    - `dashboard/dashboard.spec.ts` and all original Dashboard assertions were left unchanged. The existing role, auth, and protected-route tests were not renamed, skipped, or weakened.
    - One new current-route test was added for anonymous `/module` and `/module/project-management` access. It is additive and is not represented as a historical identity.
    - The non-historical module navigation spec was corrected as described in Sections 11 and 12; its route and authorization checks were retained.
    - The preservation report records that `PW-001`, `PW-003`, `PW-005`, `PW-007`, and `PW-009` originally expected a denied route to reach `/dashboard`. Current internal role denial returns to `/module`. D0 already records `PW-001`, `PW-003`, and `PW-005` route/declaration mapping concerns. No equivalence is claimed here; administrative review is required before reconciling those historical destinations.
    - Browser tests use intercepted API responses. They verify rendered client behavior but do not certify live persistence or production authorization. Backend permissions were checked separately in PGlite.

    ## 11. Identified Defects

    No confirmed application defect was found in Page 03 routing, selector filtering, supported module selection, or backend administrative module authorization.

    The first combined browser run exposed a test-only defect in `module-scoped-navigation.spec.ts`: the test unconditionally toggled the Project Workspace disclosure after navigation had already opened it for the active route. This closed the group before its child link was clicked; the pointer timeout reproduced in isolation. The test now checks `aria-expanded` and only opens the group when needed.

    After correcting that setup, the test reached a second stale expectation: it expected `Project Workspace Overview` and a no-metrics placeholder on `/project-management/overview`. Current source renders the `Project Overview` heading and `Project figures` metrics there; the placeholder message belongs to a different route. The test now checks the current heading and figures region. No application behavior or historical route assertion changed. Both corrections are classified as REGRESSION TEST DEFECT corrections, not product fixes.

    The following remain unresolved contracts rather than confirmed defects: generic direct dynamic entries for People & HR, Attendance, and Administration; the canonical selector URL documented for Superadmin Project Management; and equivalence treatment for historical internal `/dashboard` fallback assertions.

    ## 12. Corrections Implemented

    - Added one isolated browser test verifying anonymous users cannot render `/module` or an implemented `/module/project-management` entry and are redirected to `/login`.
    - Corrected the non-historical Project Management navigation test to open its disclosure only when collapsed and to assert the current Project Overview heading and figures region.
    - No application or API source was modified. No role permission, redirect, unsupported module, database, or historical baseline behavior was changed.
    - The defect register was not changed because no application defect was confirmed. This report records the test defect and the unresolved route contracts.

    ## 13. Browser Verification Results

    | Command                                                                                                                                                                                                                                                | Result                                             | Environment and limitations                                                                                                                                         |
    | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `pnpm --filter @nexus/web test:e2e e2e/workspace-selector.spec.ts e2e/module-scoped-navigation.spec.ts e2e/superadmin-module-access.spec.ts e2e/dashboard/dashboard.spec.ts e2e/auth/staff.spec.ts e2e/auth/admin.spec.ts e2e/auth/regression.spec.ts` | **117 passed, 0 failed, 0 skipped; 51.3 seconds.** | Chromium, offline API mocks. Includes the new anonymous module-route test and corrected navigation case.                                                            |
    | `pnpm --filter @nexus/web test:e2e e2e/administrative-projects.spec.ts e2e/administrative-requests.spec.ts e2e/auth/portal-regression.spec.ts e2e/shared/project-pages-regression.spec.ts e2e/shared/table-interactions.spec.ts`                       | **32 passed, 0 failed, 0 skipped; 28.3 seconds.**  | Chromium, offline API mocks. Includes all five current spec files named by the Page 03 shared route-attribution audit and direct administrative module route tests. |
    | `pnpm --filter @nexus/web test:e2e e2e/module-scoped-navigation.spec.ts --grep "SUPERADMIN enters the read-only Project Management directory" --workers=1`                                                                                             | **1 passed, 0 failed, 0 skipped; 14.3 seconds.**   | Isolated confirmation after correcting the non-historical test setup and stale route-content expectation.                                                           |

    The initial combined run had 116 passes and one reproduced test timeout; an isolated run then exposed the stale route-content expectation. Both test-only issues were corrected, the isolated case passed, and the final 117-case run passed. The first attempt was `ENVIRONMENT FAILURE` (`spawn EPERM`) before test startup; the same authorized browser command ran with local process-launch permission. No live backend or credentials were used.

    ## 14. Unit and Authorization Verification

    | Command                                                                                                                                                                                                                     | Result                                             | Environment and limitations                                                                                                                                                                                         |
    | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `pnpm --filter @nexus/web exec node --experimental-strip-types --test test/route-policy.test.mjs test/module-registry.test.mjs test/workspace-selection.test.mjs test/workspace-modules.test.mjs test/auth-portal.test.mjs` | **36 passed, 0 failed, 0 skipped; 0.206 seconds.** | Covers all four roles, Department Head assignment, route policies, module registry filtering, unknown routes, active workspace selection, and login portal mapping.                                                 |
    | `pnpm --filter @nexus/api test -- tests/features/auth/module-access.test.ts`                                                                                                                                                | **1 passed, 0 failed, 0 skipped; 3.14 seconds.**   | Isolated PGlite. Confirms no-auth 401, Superadmin module listing/entry, 403 for Admin/Staff/User, 404 for unknown or unimplemented modules, and inactive-account denial. No shared or production database was used. |

    The first attempts of both Node test commands were blocked before test execution by `spawn EPERM`. Retrying the same commands with local process-launch permission succeeded. This was an environment restriction, not an assertion failure.

    **Workspace quality gate:** Root `pnpm format`, `pnpm lint`, and `pnpm typecheck` passed with exit code 0. The formatter reported the repository files unchanged; ESLint passed with `--max-warnings 0`; Web and API typechecks passed.

    ## 15. Remaining Contract Questions

    1. Should direct dynamic paths for `people-hr`, `attendance-monitoring`, and `administration` redirect to their registry `administrativePath`, remain explicit placeholders, or receive dedicated screens? The N1 report already requests a decision. The implementation remains unchanged pending review.
    2. Should `/project-management/overview` be recorded as the canonical Superadmin selector destination in `module-role-access.md`, while preserving `/module/project-management` as an implemented direct entry? The current selector registry and browser test use `/project-management/overview`; the guide currently names `/module/project-management` in its selector table.
    3. Should historical denied-route expectations in `PW-001`, `PW-003`, `PW-005`, `PW-007`, and `PW-009` be recognized as a role-aware development contract change from `/dashboard` to `/module` for internal users? Preserve the original baseline and assertions; do not claim equivalence until approved.

    ## 16. Administrative Decisions

    Recommended dispositions:

    - Confirm the current role landing rule: `USER` to `/dashboard`; internal roles to `/module`. Preserve the old historical evidence and approve a documented equivalence for internal denied-route destinations if the administration considers it valid.
    - For generic direct module IDs, use their existing registry `administrativePath` as the canonical destination for People & HR, Attendance, and Administration, or explicitly retain the current placeholder contract. No redirect or new page should be implemented until selected.
    - Update the selector-route documentation to match `/project-management/overview` if that remains the approved Superadmin card destination; retain or deprecate `/module/project-management` only after its direct-entry role is confirmed.

    ## 17. Final Page Status

    **PAGE 03 PARTIALLY COMPLETE — DOCUMENTED CONTRACT LIMITATIONS.** Current root, Dashboard, selector, role, and backend module authorization behavior is verified. No application defect remains confirmed. Administrative disposition is still required for generic dynamic module entries, the selector-route documentation mismatch, and historical internal `/dashboard` destination equivalence.

    ## 18. Recommended Next Step

    Stop for administrative review of Section 15. Page 04 — Account Management may be considered after those routing and preservation questions are dispositioned. Page 04, Phase 7.5-N2, and Phase 8 have not started.

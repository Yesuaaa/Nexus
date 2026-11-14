# Phase 7.4.1 — Page 3: Dashboard Regression Enhancement

## 1. Executive Summary

Page: **Dashboard** (`/dashboard`). Status: **complete with documented limitations**.

The current Dashboard feature renders one empty, accessible `<main aria-label="Dashboard">` inside the authenticated portal shell. It has no Dashboard-owned widgets, metrics, charts, filters, quick actions, or data endpoint. The portal shell supplies the role layout, navigation, account loading/error states, notifications, messages, and account menu.

Nine Dashboard-specific Playwright cases were added. The final bounded selection covers **48 unique browser cases**: the 37-case Phase 7.2 route-attributed group, two narrow historical Dashboard overlaps, and nine new cases. All 48 passed. Four role-navigation cases appear in both the 37-case group and the separate final Dashboard run; they are counted once as identities. The isolated role-permission API module passed **6/6** tests. No application or API source was changed.

The prior Phase 7.2 classification that Dashboard widgets were unsupported still matches the source. No live account or persistent database was used. The five live-only historical identities remain deferred.

## 2. Git Baseline

- Branch: `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages`.
- Initial and final HEAD: `ff9ee8b9bb80e5a5361b8c3c9811262525a344dc`.
- Initial worktree and index: clean.
- Final worktree: two new untracked files only: `apps/web/e2e/dashboard/dashboard.spec.ts` and this report. No tracked files changed.
- Test artifacts are under the Git-ignored `test-results/` directory.
- No commit or push was made.

The initial snapshot and final state are recorded in `test-results/phase7/page-by-page/page-03-dashboard/git-baseline.txt` and `git-final-state.txt`.

## 3. Dashboard Source Inventory

### Route and content

- `apps/web/src/app/(portal)/dashboard/page.tsx:1-4` renders `DashboardPage`.
- `apps/web/src/features/dashboard/pages/dashboard-page.tsx:3-5` returns only `<main className={contentClass} aria-label="Dashboard" />`.
- There are no Dashboard child widgets, headings, cards, charts, tables, filters, selectors, page actions, refresh controls, or page-owned state/data hooks.

### Shared authenticated shell

- `apps/web/src/app/(portal)/layout.tsx` wraps the route in `PortalLayout`.
- `apps/web/src/components/layout/portal-layout.tsx:84-97` displays an account error alert, an account loading status, or the authenticated `RoleLayout`. `/dashboard` is not included in its role-based denial conditions.
- `apps/web/src/features/auth/hooks/use-account.ts` loads the account with `getCurrentAccount`, listens for account updates, and refreshes when the page becomes visible. It does not implement a Dashboard data refresh.
- `apps/web/src/components/layout/role-layout.tsx` maps `SUPERADMIN`, `ADMIN`, `STAFF`, and `USER` to the shared `AppLayout`.
- `apps/web/src/components/layout/sidebar.tsx:140-155` always renders a Dashboard link and sets `aria-current="page"` on `/dashboard`. Other sidebar links vary by role and permissions. The mobile sidebar opens from the Topbar and closes when a link is selected.
- `apps/web/src/components/layout/app-layout.tsx:89-110` renders the sidebar and topbar. `apps/web/src/components/layout/topbar.tsx` contains breadcrumbs, the notifications control, the Messages link, and the account menu.

### Shared topbar data and actions

These features appear on Dashboard as part of the portal shell; they are not Dashboard metrics:

- `WorkflowNotifications` reads `GET /api/request-workflows/notifications`, polls while visible, and reads again when opened. It supports marking one or all notifications read and links to a project or Messages according to notification type. Its panel has loading, empty, and error copy.
- `MessagesLink` reads conversation summaries to calculate unread counts. On Dashboard it reads request conversations for all roles, internal conversations for `STAFF`, `ADMIN`, and `SUPERADMIN`, and project conversations for `STAFF` and `USER`.
- `AccountMenu` exposes the shared account actions. The mobile Topbar exposes the navigation drawer control.

The added tests verify topbar control presence by role, notification loading/empty/error/recovery behavior, and the notification link target. They do not claim to verify the full Messages, notification persistence, or account-menu feature sets.

## 4. Dashboard Metric Contract

There are **no implemented Dashboard metrics**, so there is no Dashboard aggregation, status filter, number/date/currency format, metric empty value, or metric accuracy contract to test. No arbitrary metrics or totals were introduced in tests.

The portal shell does make these shared requests:

| Request                                    | Purpose on Dashboard                            | Access/data contract                                                                                                                                     |
| ------------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/auth/me`                         | Loads the current account for the portal shell. | `requireAuth` and `PROFILE_READ`; returns `{ user }`. The web client calls it from `getCurrentAccount()`.                                                |
| `GET /api/request-workflows/notifications` | Supplies the global topbar notification menu.   | Notification list and unread count; the component handles loading, empty, and error states. Read actions use PATCH routes in the same workflow resource. |
| `GET /api/request-conversations`           | Supplies the global Messages unread count.      | Used for all roles by the shared Messages link.                                                                                                          |
| `GET /api/internal-conversations`          | Supplies the global Messages unread count.      | Used for non-`USER` roles by the shared Messages link.                                                                                                   |
| `GET /api/project-conversations`           | Supplies the global Messages unread count.      | Used for `USER` and `STAFF` roles by the shared Messages link.                                                                                           |

No `/api/dashboard` or Dashboard analytics endpoint is mounted in `apps/api/src/app.ts`. The API permission `dashboard:read` is present in the common permission set for every role, but no Dashboard-specific endpoint consumes it. This is documented as the current contract, not as a confirmed defect.

## 5. Existing Regression Inventory

The accepted Phase 7.1/7.2 ownership inventory maps **29 historical identities** to Dashboard: 24 offline and five live-only (`PW-124`–`PW-128`). The exact identity titles, source files, declaration status, and Phase 6 assertion-site counts are retained in `test-results/phase7/page-by-page/page-03-dashboard/historical-identity-map.csv`. Those counts are per-identity reconciliation records, not a total of unique source lines.

The Phase 7.2 Dashboard row previously attributed 37 offline tests across:

- `apps/web/e2e/auth/admin.spec.ts`
- `apps/web/e2e/auth/staff.spec.ts`
- `apps/web/e2e/auth/portal-regression.spec.ts`
- `apps/web/e2e/shared/project-pages-regression.spec.ts`
- `apps/web/e2e/shared/table-interactions.spec.ts`

This is a shared route-attribution group; some tests mainly exercise the destination page or a cross-page flow. It is not evidence of 37 Dashboard widgets. The 37-case group passed again in this turn.

Other historical Dashboard overlaps are `PW-021` (shared auth/portal styling), `PW-145` (anonymous Dashboard access), `PW-150` (Registration transition), `PW-152`–`PW-155` (authenticated sessions redirecting away from auth routes), and cross-page session/message cases. Login and Registration suites were not rerun. Only the two narrow Dashboard overlaps `PW-021` and `PW-145` were selected from their files.

Before this task there was no dedicated Dashboard spec. Existing coverage concentrated on role landing/navigation, auth redirects, shell styling, and cross-page navigation; it did not assert the Dashboard main landmark across all roles or directly exercise its account-loading/error state and topbar notification states. No widget or metric tests existed because no such source elements exist.

## 6. New Regression Tests

Created only `apps/web/e2e/dashboard/dashboard.spec.ts`, using the existing `restoreSession`, `accountFor`, and `configureRegressionTest` helpers.

1. **`Dashboard renders its accessible shell for SUPERADMIN`**
2. **`Dashboard renders its accessible shell for ADMIN`**
3. **`Dashboard renders its accessible shell for STAFF`**
4. **`Dashboard renders its accessible shell for USER`**
5. **`Dashboard keeps its account loading state until lookup completes`**
6. **`Dashboard reports an account lookup failure without showing the portal`**
7. **`Dashboard navigation works from the mobile drawer`**
8. **`Dashboard notifications show loading before an empty result`**
9. **`Dashboard notification errors recover and keep the source link`**

These additions cover authenticated route rendering, the named main landmark, active Dashboard navigation, shared topbar controls, account-loading and account-error states, mobile drawer behavior, notification loading/empty/error/recovery behavior, and a source-derived notification destination. They assert only behavior present in source.

## 7. Data Accuracy Verification

No Dashboard metrics or aggregated values are rendered, so no controlled Dashboard metric dataset or expected arithmetic applies. The notification test uses a deterministic response matching the current `Notification` shape and checks the implemented `PROJECT_ACTIVATED` destination (`/projects/project-1`). It does not infer persistent notification state or verify the project destination page.

The Messages unread counts and notification persistence remain owned by their feature/API tests. The Dashboard tests verify the shared controls and the notification behavior needed to confirm the visible Dashboard shell.

## 8. Role-Based Verification

The four mocked UI cases load `/dashboard` for `SUPERADMIN`, `ADMIN`, `STAFF`, and `USER`. Each checks the role-marked layout, named Dashboard main landmark, active Dashboard sidebar link, and visible Notifications, Messages, and account-menu controls. The source gives every role the Dashboard link; other sidebar destinations remain role/permission-specific.

The isolated `apps/api/src/features/users/role-policy.test.ts` module passed **6/6** tests. It checks the fixed role permissions, including `dashboard:read` in the common role permissions. It does not test a Dashboard API route; none exists. The account endpoint used by the shell is protected by authentication and `PROFILE_READ`. Browser role cases use mocked accounts and do not prove live backend authorization.

## 9. Feature-to-Test Matrix

| Feature ID | Feature                                                       | Source reference                                                                    | Test ownership and assertion                                                                                    | Result                                                                                     | Verification level                                           |
| ---------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| DSH-01     | Dashboard route and accessible main                           | `app/(portal)/dashboard/page.tsx`; `features/dashboard/pages/dashboard-page.tsx`    | Four role-specific tests assert the named main landmark is visible.                                             | `VERIFIED_PASS`                                                                            | `MOCKED_UI_VERIFIED`                                         |
| DSH-02     | Role shell and active Dashboard link                          | `components/layout/portal-layout.tsx`; `sidebar.tsx`; `role-layout.tsx`             | Four new role cases plus existing `auth/staff.spec.ts`; assert role layout and `aria-current="page"`.           | `VERIFIED_PASS`                                                                            | `MOCKED_UI_VERIFIED`                                         |
| DSH-03     | Account loading state                                         | `portal-layout.tsx`; `features/auth/hooks/use-account.ts`                           | Hold `/api/auth/me`, assert loading status, release account response, assert Dashboard appears.                 | `VERIFIED_PASS`                                                                            | `MOCKED_UI_VERIFIED`                                         |
| DSH-04     | Account lookup failure                                        | `portal-layout.tsx`; `use-account.ts`                                               | Return 503 from mocked `/api/auth/me`; assert shell alert and no Dashboard main.                                | `VERIFIED_PASS`                                                                            | `MOCKED_UI_VERIFIED`                                         |
| DSH-05     | Mobile Dashboard navigation                                   | `topbar.tsx`; `app-layout.tsx`; `sidebar.tsx`                                       | Open mobile drawer, check active Dashboard link, select it, and verify the drawer closes.                       | `VERIFIED_PASS`                                                                            | `MOCKED_UI_VERIFIED`                                         |
| DSH-06     | Shared topbar controls                                        | `topbar.tsx`; `workflow-notifications.tsx`; `messages-link.tsx`; `account-menu.tsx` | Role cases assert visible controls; notification cases verify loading, empty, error, recovery, and link target. | `VERIFIED_PASS` for tested behavior; other feature behavior remains outside this page run. | `MOCKED_UI_VERIFIED`, `SOURCE_ONLY`                          |
| DSH-07     | Dashboard metrics, widgets, charts, filters, and page actions | `features/dashboard/pages/dashboard-page.tsx`                                       | Source contains no such elements or data flow; no invented assertions were added.                               | `INTENTIONALLY_UNSUPPORTED` in the Phase 7.2 inventory; still absent in current source.    | `SOURCE_ONLY`                                                |
| DSH-08     | Portal account data used to render Dashboard                  | `auth-api.ts`; `auth.controller.ts`; `auth.permissions.ts`                          | Mocked shell success/error tests; isolated fixed-role permission module.                                        | `PARTIALLY_VERIFIED`; no live account/API integration run.                                 | `MOCKED_UI_VERIFIED`, `ISOLATED_API_VERIFIED`, `SOURCE_ONLY` |

## 10. Execution Results

### Environment

- Playwright: installed `@playwright/test` 1.64.1; Chromium was available.
- Existing production web server at `http://127.0.0.1:5273` returned HTTP 200 for `/dashboard`. The existing build ID was `BWcdEsbm48l3BM-6LLjqn`; the server was reused and not started or stopped by this task.
- The custom Playwright config used one worker, zero retries, trace off, screenshots on failure, and an output directory unique to Page 3. `NEXUS_E2E_LIVE=0`; no credentials were loaded and no database was used.

### Browser cases

- Existing Phase 7.2 route-attributed group: **37 executed, 37 passed, 0 failed, 0 skipped** in the five specs listed above.
- Two narrow historical Dashboard overlaps: **2 executed, 2 passed** (`PW-021` and `PW-145`). No Login or Registration suite was run.
- New Dashboard tests: **9 executed, 9 passed**.
- Final bounded outputs contain **52 executions** across the 37-case group, the 13-case dedicated role/Dashboard run, and the two historical overlaps. Four role-navigation identities repeat between the 37-case group and the 13-case run. After deduplication, **48 unique case identities passed; 0 failed, 0 skipped, 0 flaky**.
- Five live-only cases `PW-124`–`PW-128` remain deferred because isolated accounts and a disposable live database were not available.

The first Dashboard run exposed a test locator ambiguity (`role=alert` also matched Next.js's empty route announcer). A later notification probe tried to click a Radix trigger while its open menu had made the background inaccessible. Both were test-only issues; the locators/interaction were corrected, the affected cases passed, and the complete focused Dashboard group was rerun. Initial failure artifacts are retained under `artifacts/`.

The first default-sandbox API test launch returned `spawn EPERM` before executing tests. The same database-free module was rerun with local process launch permission and passed **6/6**. No API test assertion failed.

Commands and raw outputs are under `test-results/phase7/page-by-page/page-03-dashboard/`. Repository-wide Prettier check, ESLint, web route type generation and TypeScript, API TypeScript, and `git diff --check` are recorded in `quality-gate.txt`. Installed local binaries were used instead of retrying the pnpm wrappers, which had a previously documented global store-lock failure.

## 11. Defect Register

| Finding                                                                                                                                     | Classification                     | Evidence and disposition                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Generic alert locator matched the empty Next route announcer as well as the Dashboard account error.                                        | `TEST_DEFECT`                      | Initial failure artifact retained; narrowed the assertion to `main[role="alert"]`; corrected case and final group pass. No application defect.                                 |
| Notification recovery test attempted to click the trigger while Radix kept the menu open and hid the background from accessibility queries. | `TEST_DEFECT`                      | Initial DOM snapshot retained; closed the menu with Escape, then reopened it after changing the mocked response. Corrected case and final group pass.                          |
| Default sandbox blocked Node's test worker spawn.                                                                                           | `ENVIRONMENT_FAILURE`              | The API module did not execute on the first attempt; the same module passed after authorized local process launch.                                                             |
| Empty Dashboard feature content.                                                                                                            | Accepted implementation limitation | Source currently renders no Dashboard widgets/metrics; Phase 7.2 already classified widgets as unsupported. No product defect is claimed without a supported content contract. |

No Dashboard metric, data transformation, API contract, or authorization defect was confirmed. Previously recorded Login, Registration, NEX-017, request-workflow, NEX-006, NEX-015, and inbox findings were not modified or reclassified.

## 12. Integration Limitations

- Browser cases use deterministic intercepted responses. They do not prove persisted accounts, notification writes, live message counts, or production role enforcement.
- The role-policy API module is isolated and database-free. No Dashboard-specific API or backend aggregation exists to integrate against.
- The five live historical cases remain deferred; no real credentials, external account, or database was used.
- Shared Topbar Messages and account-menu behavior are only checked for presence in the Dashboard role cases; their deeper workflows remain with their owning feature suites. Phase 7.4's two Dashboard-to-Messages cases remain prior evidence.
- No full browser or API suite was run.

## 13. Historical Preservation

- The 29 Dashboard-attributed historical identities and their original declaration/assertion metadata remain recorded in the Phase 6 reconciliation: 23 declarations are `UNCHANGED` and six (`PW-130`–`PW-133`, `PW-281`–`PW-282`) retain the previously approved `APPROVED_DELTA` disposition. No declaration changed in this turn. The existing specs were not edited, renamed, skipped, or weakened.
- SHA-256 snapshots for the existing auth/navigation specs are in `preservation-hashes-before.txt`; final comparisons are in `preservation-verification.json`.
- Page 1 and Page 2 Login/Registration files and reports retain their initial hashes. Global Phase 6 historical totals remain the accepted **292 identities, 1,630 assertion sites, 4,211 preservation mappings, and 34 additional browser cases**; this task did not regenerate those totals.
- Phase 7.1–7.4 documentation, API source, Dashboard app source, schema, dependencies, and lockfiles were not changed.

## 14. Page Acceptance Assessment

The Dashboard route, portal shell, role behavior, topbar dependencies, and lack of Dashboard data features were inspected. The existing route-attributed browser group and the relevant narrow historical overlaps passed. Nine meaningful cases were added for behavior that exists in source; all nine pass. The isolated role-permission module passed. The feature matrix distinguishes mocked UI, isolated API, and source-only conclusions.

Page 3 is administratively complete **with the accepted limitation that the Dashboard content remains an empty shell and has no metrics to validate**. No confirmed product defect remains from this work. Quality results and preservation evidence are recorded in the Page 3 evidence directory.

## 15. Next Page Readiness

Page 3 is handed off. Account Management can be audited under its own authorization and page-specific scope. **Page 4 was not started. Phase 7.5 was not started.**

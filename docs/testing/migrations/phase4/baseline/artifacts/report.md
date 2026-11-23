# Phase 2 ? Existing Playwright regression audit

## Verified baseline

Revision `2075d354d62dd15b6d34b53600416de336eca4d6`; 35 spec files, 157 executable declaration sites, 292 expanded Chromium cases, 1,630 static matcher assertion sites (1,626 in specs, four in shared support). Every case maps to its declaration; every assertion site maps to at least one test candidate. Branches/loops/request handlers affect runtime invocation counts. No runtime per-assertion instrumentation was added.

Original test titles, parent describes, routes, role fixtures, direct assertions, helpers/hooks, mocks, conditional skips, source text and hashes: [inventory.md](inventory.md) and [baseline.json](baseline.json). Exact assertion expressions/ownership/hashes: [assertions.md](assertions.md). Future comparison ledger: [preservation-map.csv](preservation-map.csv), with 4,211 test/assertion candidate rows. Future equivalents are intentionally unassigned.

Baseline classes: 270 application API fixture cases; 17 frontend/server/security cases; five opt-in real-backend cases. No real application-backend behavior was verified by this audit run.

## Discovery and execution evidence

Discovery from apps/web: `node node_modules/@playwright/test/cli.js test --list --reporter=json`; NEXUS_E2E_LIVE=0 and NEXUS_E2E_BASE_URL=http://127.0.0.1:5273. Exit 0, 292 cases, 35 files, zero discovery errors. [Discovery JSON](discovery.json), [command/safety record](discovery-command.json). The installed runner list path runs loading/reporting tasks, not global setup/webServer/test tasks. It can write temporary transformation cache; audit stdout is saved under ignored test-results.

Existing suite executed from apps/web with two workers, retries 0, JSON/line reporters and isolated ignored output against a dedicated standalone server at http://127.0.0.1:5274. Result: **287 passed, 0 failed, 5 skipped, 0 reported flaky**, exit 0; 191.790 seconds. One execution per runnable case. Long-term flakiness remains UNVERIFIED. [Execution JSON](execution.json), [log](execution.log), [exact commands/environment/safety](execution-command.json). Initial worker spawn was blocked by sandbox EPERM before tests; escalation allowed the successful run. Stderr on successful run contains NO_COLOR/FORCE_COLOR warnings, not failed tests.

Build ID `RkU8ojA1HJpcyeFNdw-6u` existed before this audit. Its source revision is **UNVERIFIED**. Thus the source/assertion baseline is pinned to HEAD, while execution evidence is pinned to that existing build. A rebuild was not performed. Native image/CSP/SSR tests exercised that build; business-data calls used fixture handlers. Build rewrites target localhost:3001 only; no API listener was observed there before execution. No test database was provisioned or connected. Synthetic accounts were used. The standalone server was stopped afterward. Live credentials exist in a local ignored file but were neither printed nor used for a live run.

The five existing skips are SUPERADMIN, ADMIN, STAFF and USER real login/access cases plus the deactivated-account case in [regression-live.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts:11). No test was newly skipped. List-mode JSON reports all unexecuted cases as skipped in its aggregate stats; this is not a baseline execution result. For execution use execution.json, where only five cases were skipped.

## Configuration and architecture

[apps/web/playwright.config.ts:1](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/playwright.config.ts:1) defines e2e/**/*.spec.ts; .spec.tsx is not matched and none was found. Chromium/Desktop Chrome only, default 1280?720; mobile tests resize the desktop browser (they do not create a touch/mobile browser project). fullyParallel=true; CI forbidOnly=true and two retries; local retries=0. live mode sets one worker and disables trace via config. Default trace retains failures; no explicit custom reporter, screenshot, video, global setup/teardown, storageState or project dependency is configured. Discovery confirms globals null and project dependencies empty. No custom test.extend fixture was found. Tests use built-in page/browser/context/request/baseURL fixtures and local helper functions.

[apps/web/e2e/regression-support.ts:40](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-support.ts:40) installs reduced motion and beforeEach/afterEach checks for page errors/hydration console errors in files invoking configureRegressionTest. This protection is not suite-wide. [apps/web/e2e/regression-support.ts:124](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-support.ts:124) provides catch-all same-origin/bearer-checking API fixtures; [apps/web/e2e/regression-support.ts:833](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-support.ts:833) seeds sessionStorage once. Local helpers in feature specs maintain in-memory records, failures, replay IDs and counters. Their exact code and ownership are in the baseline.

[request-conversations.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:19) starts an ephemeral loopback SSE stub in beforeAll and closes connections/server in afterAll. This verifies browser event transport, not Express authorization or persistence. [session-revocation.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts:2) creates two browser contexts with shared mocked session state. Supabase-style image endpoints are intercepted in profile/chat tests. page.clock and held-response promises isolate time/race behavior in specific tests; no global clock fixture exists.

[apps/web/package.json:13](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/package.json:13) exposes direct Playwright scripts. The root [scripts/run-e2e.mjs:1](C:/Users/ADMIN/Documents/Thesis/Nexus/scripts/run-e2e.mjs:1) concurrently starts the complete API Node test suite, so it was not used for discovery or this browser-only baseline. [apps/api/package.json:11](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/api/package.json:11) and [apps/web/package.json:15](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/package.json:15) run separate Node test suites; *.test.ts API tests and web/test/*.test.mjs are not Playwright cases. API PGlite tests are useful authorization/persistence evidence but were not executed in Phase 2 and are excluded from Playwright counts.

Default Playwright execution builds via pnpm build then starts standalone unless NEXUS_E2E_BASE_URL is supplied. The audit supplied an explicit URL to avoid build writes. [apps/web/scripts/regression-live.mjs:1](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/scripts/regression-live.mjs:1) correctly selects only the live spec; setting NEXUS_E2E_LIVE=1 alone does not globally exclude every mock file. Live wrapper expects the five password environment variables listed in [apps/web/e2e/regression-support.ts:17](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-support.ts:17), a verified test URL/API/test database and designated accounts. Live login/logout writes session state even though it does not intentionally change business records. Such backend/database isolation was not verified, so live execution was not performed.

Screenshots are captured as artifacts in some cases; no toHaveScreenshot/toMatchSnapshot visual oracle was found. Passing captures do not establish pixel regression coverage. Focus, labels, ARIA, geometry and keyboard assertions are present, but no full accessibility audit engine is configured.

## Counts by original file

| Original spec | Expanded cases | Declaration sites | Matcher sites |
|---|---:|---:|---:|
| [admin.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/admin.spec.ts) | 10 | 2 | 5 |
| [auth-performance.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-performance.spec.ts) | 8 | 7 | 21 |
| [auth-styles.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/auth-styles.spec.ts) | 3 | 2 | 17 |
| [booked-services.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/booked-services.spec.ts) | 9 | 7 | 59 |
| [client-mutations.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts) | 2 | 1 | 21 |
| [client-service-requests.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-service-requests.spec.ts) | 8 | 5 | 30 |
| [client.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client.spec.ts) | 12 | 3 | 77 |
| [clients.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts) | 10 | 4 | 36 |
| [departments.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts) | 3 | 3 | 21 |
| [dropdown-positioning.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/dropdown-positioning.spec.ts) | 5 | 3 | 8 |
| [employee-login.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employee-login.spec.ts) | 2 | 1 | 29 |
| [employees.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/employees.spec.ts) | 4 | 3 | 18 |
| [internal-conversations.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/internal-conversations.spec.ts) | 10 | 5 | 65 |
| [jwt-session.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/jwt-session.spec.ts) | 2 | 2 | 12 |
| [login-validation.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/login-validation.spec.ts) | 2 | 2 | 22 |
| [messages-topbar.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/messages-topbar.spec.ts) | 4 | 1 | 8 |
| [operational-loading.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/operational-loading.spec.ts) | 6 | 1 | 13 |
| [portal-regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/portal-regression.spec.ts) | 5 | 2 | 14 |
| [pricing-templates.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/pricing-templates.spec.ts) | 4 | 3 | 21 |
| [profile.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/profile.spec.ts) | 4 | 1 | 40 |
| [project-pages-regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-pages-regression.spec.ts) | 6 | 2 | 17 |
| [project-workspace.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/project-workspace.spec.ts) | 4 | 3 | 17 |
| [regression-live.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression-live.spec.ts) | 5 | 2 | 31 |
| [regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts) | 30 | 21 | 106 |
| [request-conversations.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts) | 46 | 21 | 220 |
| [request-inbox.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts) | 14 | 7 | 85 |
| [request-workflow.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts) | 30 | 19 | 220 |
| [responsive-data-table.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/responsive-data-table.spec.ts) | 2 | 2 | 19 |
| [services.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/services.spec.ts) | 10 | 8 | 67 |
| [session-revocation.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/session-revocation.spec.ts) | 2 | 2 | 23 |
| [settings.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/settings.spec.ts) | 4 | 1 | 37 |
| [staff-workload.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff-workload.spec.ts) | 2 | 2 | 91 |
| [staff.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/staff.spec.ts) | 4 | 1 | 35 |
| [superadmin.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/superadmin.spec.ts) | 8 | 6 | 80 |
| [table-interactions.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/table-interactions.spec.ts) | 12 | 2 | 41 |

Shared support contributes four additional matcher sites. Counts by page and complete test-ID mappings: [coverage-matrix.md](coverage-matrix.md). Counts are not sufficient for preservation; use expression-level identity/hash plus source/loop/branch/fixture context in the ledger.

## Verified limitations and classifications

**F1 ? APPLICATION DEFECT / TEST COVERAGE GAP.** [apps/web/src/features/request-inbox/api/request-inbox-api.ts:62](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/src/features/request-inbox/api/request-inbox-api.ts:62) calls decline/delete, while [apps/api/src/features/request-inbox/request-inbox.controller.ts:11](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/api/src/features/request-inbox/request-inbox.controller.ts:11) registers list/detail/accept only. Keep [request-inbox.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-inbox.spec.ts:399) failed delete cancellation/recovery and acceptance-error coverage. Successful decline/delete scenarios are **BLOCKED BY UNDEFINED APPLICATION CONTRACT**; do not invent a success fixture or state transition. No current test clicks the decline control. [apps/web/e2e/README.md:69](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/README.md:69) records the absent server contract and drawer/confirmation accessibility follow-up. The latter remains a documented/source-observed limitation; this audit did not separately reproduce that dialog interaction.

**F2 ? INTENTIONAL BEHAVIOR.** Client creation/read-only behavior is guarded by [client-mutations.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/client-mutations.spec.ts:5) (including no PATCH/DELETE browser requests) and [clients.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/clients.spec.ts:14). Preserve separate [apps/api/src/client-integration.test.ts:402](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/api/src/client-integration.test.ts:402) PATCH/DELETE rejection assertions; they are Node integration tests and are not browser cases. [docs/features/client-management.md:67](C:/Users/ADMIN/Documents/Thesis/Nexus/docs/features/client-management.md:67) reserves those operations. The dormant edit branch in [apps/web/src/features/clients/components/client-form-dialog.tsx:77](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/src/features/clients/components/client-form-dialog.tsx:77) and [apps/web/src/features/clients/pages/client-management-page.tsx:331](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/src/features/clients/pages/client-management-page.tsx:331) is an implementation observation, not missing regression coverage. The incompatible clients:read + exact SUPERADMIN route requirements remain inaccessible under [apps/api/src/features/clients/clients.controller.ts:13](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/api/src/features/clients/clients.controller.ts:13) and [apps/api/src/features/auth/auth.permissions.ts:61](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/api/src/features/auth/auth.permissions.ts:61).

**Documentation issue.** [docs/rbac.md:13](C:/Users/ADMIN/Documents/Thesis/Nexus/docs/rbac.md:13) says no client creation, conflicting with implemented creation and the feature specification. This is not an application regression failure. Historical E2E README summaries must not substitute for current source/discovery evidence.

**Inactive source history.** [request-conversations.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2026) contains three commented-out legacy archive declarations (six hypothetical expansions). They are not discovered, executable skips or preserved active tests. The comment records intentional removal of the old archive model. Current no-current/ended-booking conversation behavior is covered at [request-conversations.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-conversations.spec.ts:2205). No commented test was changed or restored.

**Coverage gaps in implemented features.** Direct workspace creation/rename/cancel/status/plan/task/deliverable mutations are implemented but lack direct browser scenarios; see source references in the coverage matrix. Existing /messages staffing/activation and /projects milestone tests do not establish these distinct workflows. Registration field assertions are narrower than its title/setup; account creation and successful department-team/member workflows also lack complete browser journeys in this inventory. These are audit findings only; no scenarios were added.

**Environment limits.** All five real-backend cases skipped; backend availability, database isolation and designated live-account safety remain unverified. Chromium only; no Firefox/WebKit/mobile-device project. A single successful run with retries disabled does not establish flake rate. Runtime per-assertion invocation counts and source-to-existing-build equivalence are unverified.

## Intentionally absent behavior to preserve

- Client editing/deletion and successful client PATCH/DELETE scenarios: intentionally unsupported; preserve browser absence and backend rejection tests.
- Removed social login providers: absence asserted in [regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:348).
- Persistent localStorage/cookie bearer sessions: unsupported by architecture; absence/restoration rejection asserted in [regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:330) and [regression.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/regression.spec.ts:401).
- Retired employee employment-status menu action: absence asserted in [departments.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/departments.spec.ts:13).
- Separate signed agreement approval after formal quotation acceptance: absence asserted in [request-workflow.spec.ts](C:/Users/ADMIN/Documents/Thesis/Nexus/apps/web/e2e/request-workflow.spec.ts:292).
- Old archived-conversation delete UI: inactive historical source, not a missing current-contract success case.

No tracked application, test or configuration file was changed; only ignored audit/test artifacts were written. No format/lint/typecheck/build gate was run: this audit changes no source, and format/build/type generation can write files. Phase 3 was not started.

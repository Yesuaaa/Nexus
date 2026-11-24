# PG-003 Test Case Specification

**Planning only:** none of these tests were added or executed. “Expected” means source-supported expected behavior, not an observed test result.

## Proposal totals

| Classification                  | Count | Treatment                                               |
| ------------------------------- | ----: | ------------------------------------------------------- |
| NEW TEST REQUIRED               |     7 | Implementable after Phase 2.2 authorization.            |
| ADDITIONAL ASSERTION REQUIRED   |     1 | Implementable after Phase 2.2 authorization.            |
| EXISTING COVERAGE SUFFICIENT    |     1 | Preserve existing direct Superadmin route coverage.     |
| CONTRACT CLARIFICATION REQUIRED |     1 | Blocked and excluded from implementable totals.         |
| **Implementable additions**     | **8** | **2 unit + 6 browser; 0 API + 0 database integration.** |

There is no PG-003 feature API call or persistence workflow, so no attendance API or PGlite test is proposed. API/database coverage for shared authentication belongs to the auth feature; PG-003 browser tests can control the account lookup through the existing regression fixture.

## Proposed cases

### PG-003-F001-A001-T001 — personal-attendance predicate matrix

- **Classification / category:** NEW TEST REQUIRED; Unit.
- **Scenario:** Verify which account profiles select the personal-attendance branch.
- **Preconditions:** Pure helper test; no browser, API, database, or network.
- **Input data:** Active STAFF and active ADMIN, including an ADMIN without `employees:read`; active USER; active SUPERADMIN with and without `employees:read`; inactive STAFF and ADMIN.
- **Reproducible steps:** Call `canAccessPersonalAttendance(account)` for each profile; assert the boolean result.
- **Expected result:** Only active STAFF and active ADMIN return true. Role, head assignment, and unrelated permissions do not make other profiles personal-attendance eligible.
- **Existing coverage reference:** `apps/web/test/attendance.test.mjs:74-117` checks related subroute access but does not call this helper directly.
- **Coverage gap:** Predicate truth table is not directly isolated; a regression could change the page destination branch without an exact unit assertion.
- **Priority:** P1.
- **Recommended test file:** `apps/web/test/attendance.test.mjs`.
- **Execution environment:** Existing Node `node:test` web unit runner; pure function, no fixture server.
- **Source evidence:** `apps/web/src/features/auth/model/permissions.ts:111-116`; caller `apps/web/src/features/attendance/pages/attendance-entry-page.tsx:11-15`.

### PG-003-F001-A003-T002 — exact entry-route eligibility matrix

- **Classification / category:** NEW TEST REQUIRED; Unit.
- **Scenario:** Assert the route policy for the exact `/attendance` entry path.
- **Preconditions:** Use account fixtures matching production role, active status, and permission data.
- **Input data:** Active STAFF; active ADMIN; active SUPERADMIN with `employees:read`; active SUPERADMIN without it; active USER; inactive STAFF and ADMIN.
- **Reproducible steps:** Call `canAccessRoute(account, "/attendance")` for each profile and assert access.
- **Expected result:** Active STAFF and ADMIN and an active SUPERADMIN with `employees:read` are allowed. USER, inactive accounts, and a SUPERADMIN without `employees:read` are denied.
- **Existing coverage reference:** `apps/web/test/attendance.test.mjs:74-117` covers child routes; `apps/web/test/route-policy.test.mjs:544-575` covers administrative log gates, not the exact entry route.
- **Coverage gap:** The exact root route policy is not asserted in the current unit suite.
- **Priority:** P1.
- **Recommended test file:** `apps/web/test/attendance.test.mjs` or the existing route-policy unit file, following local organization.
- **Execution environment:** Existing Node `node:test` web unit runner; no API/database.
- **Source evidence:** `apps/web/src/features/workspaces/model/route-policy.ts:352-394,444-448`; predicates in `apps/web/src/features/auth/model/permissions.ts:92-100`.

### PG-003-F001-A001-T003 — active STAFF redirects to check-ins

- **Classification / category:** NEW TEST REQUIRED; Browser.
- **Scenario:** A signed-in STAFF member opens the attendance entry route.
- **Preconditions:** Regression fixture returns active STAFF from `/api/auth/me`; the destination route is available.
- **Input data:** Role STAFF, `isActive: true`, route `/attendance`.
- **Reproducible steps:** Restore a regression session, navigate to `/attendance`, and wait for the URL to settle. Stub downstream attendance reads only as needed for a stable route smoke check.
- **Expected result:** URL becomes `/attendance/check-ins`; it does not settle on time-log overview. No attendance write is caused by entry.
- **Existing coverage reference:** Direct root-route browser assertions found only for SUPERADMIN in `superadmin-attendance.spec.ts:586-587` and `superadmin-module-access.spec.ts:115-119`.
- **Coverage gap:** STAFF root-route decision is not directly exercised.
- **Priority:** P1.
- **Recommended test file:** New `apps/web/e2e/attendance-entry.spec.ts`.
- **Execution environment:** Playwright Chromium against the local built web app; `restoreSession` and deterministic attendance read stubs; no real backend/database. Skip live-account mode if using regression mocks.
- **Source evidence:** `apps/web/src/features/attendance/pages/attendance-entry-page.tsx:11-15`; `permissions.ts:111-116`.

### PG-003-F001-A001-T004 — active ADMIN redirects to check-ins

- **Classification / category:** NEW TEST REQUIRED; Browser.
- **Scenario:** An active ADMIN opening the entry route receives the same personal destination as STAFF.
- **Preconditions:** Regression fixture returns active ADMIN; destination route is available.
- **Input data:** Role ADMIN, `isActive: true`, route `/attendance`, and no `employees:read` permission. The outer route permits active ADMIN and the personal predicate is role-based.
- **Reproducible steps:** Restore the session, navigate to `/attendance`, and wait for the URL to settle.
- **Expected result:** URL becomes `/attendance/check-ins`, because the personal predicate includes ADMIN independently of employee permissions.
- **Existing coverage reference:** The direct route assertions currently found are SUPERADMIN-only (the two references for T003).
- **Coverage gap:** ADMIN is not directly covered at the entry route; child-route authorization is not a substitute for the redirect decision.
- **Priority:** P1.
- **Recommended test file:** New `apps/web/e2e/attendance-entry.spec.ts`.
- **Execution environment:** Playwright Chromium with mocked `/api/auth/me` and stable downstream reads; no database. Skip live-account mode if using regression mocks.
- **Source evidence:** `attendance-entry-page.tsx:11-15`; `permissions.ts:111-116`.

### PG-003-F001-A002-T005 — eligible SUPERADMIN redirects to time logs

- **Classification / category:** EXISTING COVERAGE SUFFICIENT; Browser.
- **Scenario:** An active SUPERADMIN with the attendance read grant enters through `/attendance`.
- **Preconditions:** Regression SUPERADMIN includes `employees:read`; attendance read routes are stubbed.
- **Input data:** Role SUPERADMIN, active account, `employees:read`, route `/attendance`.
- **Reproducible steps:** Preserve the existing route-entry flows and their assertions.
- **Expected result:** URL becomes `/attendance/time-logs/overview`; no personal attendance `/me/` or `scope=mine` request is made by the tested flow.
- **Existing coverage reference:** `apps/web/e2e/superadmin-attendance.spec.ts:557-561,586-587,680-686` (desktop and 390px generated cases); `apps/web/e2e/superadmin-module-access.spec.ts:38-50,104-120` (Workforce Compliance module case).
- **Coverage gap:** No destination gap for this eligible Superadmin branch. Browser history replacement remains a separate proposed assertion in T009.
- **Priority:** P1; preserve.
- **Recommended test file:** Keep existing assertions in both listed files.
- **Execution environment:** Existing Playwright regression fixtures; tests skip live mode. Execution is unverified in this design phase.
- **Source evidence:** `attendance-entry-page.tsx:11-15`; `permissions.ts:92-100,111-116`.

### PG-003-F001-A003-T006 — signed-in ineligible accounts do not enter attendance

- **Classification / category:** NEW TEST REQUIRED; Browser.
- **Scenario:** Verify the shared route guard sends representative denied accounts to their role destination before PG-003 renders.
- **Preconditions:** Each test row has a session account returned from `/api/auth/me`; regression fixture permits account overrides.
- **Input data:** (1) active USER; (2) inactive STAFF; (3) active SUPERADMIN without `employees:read`. Include inactive ADMIN if it is not already represented by the unit matrix.
- **Reproducible steps:** For each profile, restore the session, navigate directly to `/attendance`, and wait for the redirect.
- **Expected result:** USER goes to `/dashboard`; inactive STAFF and a SUPERADMIN without the read grant go to `/module`. None settles on either attendance destination or renders the entry status as its final state.
- **Existing coverage reference:** `attendance.test.mjs:74-117,166-185` tests neighboring attendance subroutes; current direct PG-003 browser tests cover only the eligible Superadmin branch.
- **Coverage gap:** No exact root-route denied-account browser case; actual portal redirect behavior is unverified for this page.
- **Priority:** P1.
- **Recommended test file:** New `apps/web/e2e/attendance-entry.spec.ts`.
- **Execution environment:** Playwright Chromium with `restoreSession` overrides; no attendance persistence. Use deterministic route stubs if denied or allowed shell mounts trigger shared reads.
- **Source evidence:** `apps/web/src/components/layout/portal-layout.tsx:24-43,54-67`; `route-policy.ts:444-448`; `permissions.ts:92-100`.

### PG-003-F001-A003-T007 — missing session redirects to the login route

- **Classification / category:** NEW TEST REQUIRED; Browser.
- **Scenario:** An unauthenticated visitor opens the protected portal route directly.
- **Preconditions:** No access token or refresh token in session storage; no account is returned.
- **Input data:** No session; path `/attendance`.
- **Reproducible steps:** Start a fresh browser context, navigate to `/attendance`, then wait for the auth provider redirect.
- **Expected result:** The visitor reaches `/login`; the attendance entry component is not rendered and no attendance destination API call is issued.
- **Existing coverage reference:** Auth regressions exercise expired-session handoff on other routes; direct PG-003 root behavior is absent. See `apps/web/e2e/auth/regression.spec.ts:699-716` for the shared-session pattern.
- **Coverage gap:** No direct unauthenticated PG-003 route scenario.
- **Priority:** P1.
- **Recommended test file:** New `apps/web/e2e/attendance-entry.spec.ts`.
- **Execution environment:** Playwright Chromium, clean browser context, local Next app; no backend fixture is needed because no token causes `useAccount` to revoke immediately.
- **Source evidence:** `apps/web/src/features/auth/hooks/use-account.ts:14-35`; `apps/web/src/components/layout/portal-layout.tsx:47-67`.

### PG-003-F001-A004-T008 — entry pending status is accessible

- **Classification / category:** NEW TEST REQUIRED; Browser.
- **Scenario:** Verify the transition state is exposed as a status for assistive technology while an eligible account's route is being replaced.
- **Preconditions:** Active STAFF account is loaded; test can observe the route before the Next navigation completes.
- **Input data:** Role STAFF, active account, path `/attendance`.
- **Reproducible steps:** Navigate to the entry route and capture the DOM status as the component mounts; then allow the route to settle.
- **Expected result:** A status with the exact text “Opening attendance…” is rendered during the transition; the final URL is `/attendance/check-ins`.
- **Existing coverage reference:** No current PG-003 assertion checks the entry status. `dashboard.spec.ts:50-73` checks the separate shared account-loading state, not this component status.
- **Coverage gap:** The only page-owned accessible state is unasserted.
- **Priority:** P2.
- **Recommended test file:** New `apps/web/e2e/attendance-entry.spec.ts`. Use an observer installed before hydration or an equivalent deterministic browser observation; do not depend on fixed sleeps. Avoid adding a DOM-testing dependency solely for this assertion.
- **Execution environment:** Playwright Chromium with controlled account response; no database. Ensure the observer does not alter app behavior and the final route is still asserted.
- **Source evidence:** `apps/web/src/features/attendance/pages/attendance-entry-page.tsx:16-17`.

### PG-003-F001-A001-T009 — replace navigation does not leave the entry route in history

- **Classification / category:** ADDITIONAL ASSERTION REQUIRED; Browser.
- **Scenario:** Verify the existing `router.replace` choice replaces the entry URL in browser history.
- **Preconditions:** Active STAFF or eligible SUPERADMIN session; start on an in-app route distinct from the destination, such as `/module`.
- **Input data:** `/module` then direct navigation to `/attendance`.
- **Reproducible steps:** From `/module`, open `/attendance`, assert the role-specific destination, then use browser Back and assert it returns to `/module` rather than the `/attendance` entry page.
- **Expected result:** The entry redirect replaces its own history entry, consistent with `router.replace`; Back does not reopen PG-003 and trigger another redirect loop.
- **Existing coverage reference:** Existing direct Superadmin tests assert destination URL but do not inspect browser history (`superadmin-module-access.spec.ts:115-119`).
- **Coverage gap:** The source's replace semantics have no browser-history assertion.
- **Priority:** P2.
- **Recommended test file:** Add an isolated flow/assertion to `apps/web/e2e/superadmin-module-access.spec.ts` or the new attendance-entry spec, preserving the existing destination assertion.
- **Execution environment:** Playwright Chromium with regression account fixture; no database. Use URL assertions and Playwright navigation waits, not timing sleeps.
- **Source evidence:** `apps/web/src/features/attendance/pages/attendance-entry-page.tsx:12-15`.

### PG-003-F001-A001-T010 — query/navigation-state destination contract

- **Classification / category:** CONTRACT CLARIFICATION REQUIRED; Browser behavior after clarification.
- **Scenario:** Determine whether an approved query or navigation-state value is meant to select or preserve an attendance destination.
- **Preconditions:** Product/QA owner specifies supported parameter/state names, values, precedence relative to role, and whether the destination retains those values.
- **Input data:** Not defined in the approved source contract; do not invent parameter names or values.
- **Reproducible steps:** Cannot be finalized until the contract is supplied. Afterward, navigate with each approved state and verify the specified destination/preservation behavior.
- **Expected result:** Unresolved. Current source ignores query state and selects by account; Phase 1 mapping says query/navigation state may influence entry.
- **Existing coverage reference:** Current Superadmin route tests do not pass query parameters. Phase 1 component mapping at line 24 is the conflicting documentation.
- **Coverage gap:** Acceptance semantics and supported inputs are unspecified.
- **Priority:** Blocked; excluded from implementable counts.
- **Recommended test file:** `apps/web/e2e/attendance-entry.spec.ts` after clarification.
- **Execution environment:** Playwright Chromium with account fixture, after the expected contract is approved.
- **Source evidence:** `attendance-entry-page.tsx:8-17` has no search-parameter or navigation-state read; `PHASE_1_PAGE_COMPONENT_MAPPING.md:24` mentions those inputs.

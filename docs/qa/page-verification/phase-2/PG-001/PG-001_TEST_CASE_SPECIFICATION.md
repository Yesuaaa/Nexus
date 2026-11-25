# PG-001 Test Case Specification

**Scope:** Design only. These are proposed additive cases; none has been implemented, executed, or marked passed.  
**Page:** `PG-001`, `/`; parent feature cluster `PG-001-F001`.  
**Test environment and suite-wide assumptions:** Use isolated browser contexts. Browser scenarios run against the configured local web build with mocked same-origin `/api/**` responses. No live credentials or production services are required. Preserve the existing regression assertions listed in [the baseline](PG-001_EXISTING_TEST_BASELINE.md).

## Proposed cases

### `PG-001-F001-A001-T001` — Storage read failure resolves to anonymous

- **Page ID:** `PG-001`
- **Atomic feature ID:** `PG-001-F001-A001`
- **Test type:** Unit
- **Scenario:** `getToken()` returns `null` when accessing `sessionStorage` throws, matching the anonymous branch input consumed by `HomeRedirect`.
- **Preconditions:** Import `getToken` from the auth API test module; save the existing `globalThis.sessionStorage` property descriptor for cleanup.
- **Test data:** A configurable `sessionStorage` getter that throws a deterministic `Error`.
- **Test steps:** Replace the global property with the throwing getter; call `getToken()`; restore the original descriptor in test cleanup.
- **Expected result:** `getToken()` returns `null` without propagating the storage exception. The root component’s source branch for that value selects `/login`.
- **Existing coverage:** `auth-api.test.mjs:208-279` stubs normal storage and asserts a stored token; no storage-read exception assertion was found.
- **Coverage gap:** Failure fallback is source-defined but has no direct helper assertion.
- **Proposed test location:** `apps/web/test/auth-api.test.mjs`
- **Priority:** Medium
- **Evidence:** `apps/web/src/features/auth/api/auth-api.ts:31-37`; `apps/web/src/features/auth/components/home-redirect.tsx:10-12`.

### `PG-001-F001-A001-T002` — Empty session token follows anonymous branch

- **Page ID:** `PG-001`
- **Atomic feature ID:** `PG-001-F001-A001`
- **Test type:** E2E / browser
- **Scenario:** A present storage key whose value is the empty string is falsy and follows the anonymous redirect.
- **Preconditions:** Fresh browser context; local web server available; no API route required for the root decision.
- **Test data:** `sessionStorage["nexus.auth.token"] = ""` before page scripts run.
- **Test steps:** Seed the empty string with `page.addInitScript`; navigate to `/`; wait for the redirect.
- **Expected result:** URL ends at `/login`; the “Welcome Back” heading is visible.
- **Existing coverage:** `regression.spec.ts:390-408` directly checks a missing-token root visit; no explicit empty-string case exists.
- **Coverage gap:** Falsy stored value is not separately asserted.
- **Proposed test location:** `apps/web/e2e/auth/home-redirect.spec.ts`
- **Priority:** Medium
- **Evidence:** `home-redirect.tsx:10-14`; `auth-api.ts:31-37`.

### `PG-001-F001-A001-T003` — Persistent storage alone does not open the portal

- **Page ID:** `PG-001`
- **Atomic feature ID:** `PG-001-F001-A001`
- **Test type:** E2E / browser
- **Scenario:** Tokens stored only in `localStorage` do not satisfy the root token check.
- **Preconditions:** Fresh browser context with no session token; local web server available.
- **Test data:** `nexus.auth.token = "test-session"` and `nexus.auth.refreshToken = "test-refresh"` in `localStorage`; no corresponding `sessionStorage` values.
- **Test steps:** Seed both local-storage values with `page.addInitScript`; navigate to `/`; wait for the redirect.
- **Expected result:** URL ends at `/login` and the “Welcome Back” heading is visible.
- **Existing coverage:** `regression.spec.ts:338-353` performs the same storage setup at `/accounts`, asserts `/login`, and asserts an empty captured `/api/` request list. It does not visit `/`.
- **Coverage gap:** Root-specific behavior for persistent-only credentials is not directly checked.
- **Proposed test location:** `apps/web/e2e/auth/home-redirect.spec.ts`
- **Priority:** High
- **Evidence:** `auth-api.ts:8-9,31-37`; `home-redirect.tsx:10-12`.

### `PG-001-F001-A002-T004` — USER session enters dashboard from root

- **Page ID:** `PG-001`
- **Atomic feature ID:** `PG-001-F001-A002`
- **Test type:** E2E / browser
- **Scenario:** A truthy session token at `/` selects `/dashboard`, and the downstream portal accepts a mocked USER account.
- **Preconditions:** Fresh browser context; install `mockApi(page, "USER")` before navigation.
- **Test data:** Session access token `test-session`; fixture role `USER`; `/api/auth/me` returns the fixture account through `mockApi`.
- **Test steps:** Register the API mock; seed `sessionStorage` with the access token; navigate to `/`; wait for account resolution and final URL.
- **Expected result:** Final URL is `/dashboard`; the portal does not redirect the USER to `/module`.
- **Existing coverage:** Existing root anonymous test covers only the falsy branch. `regression.spec.ts:57-110` tests expired refresh from direct `/dashboard`, not root. Login/registration tests reach dashboard through different routes.
- **Coverage gap:** The root’s truthy branch is not directly exercised.
- **Proposed test location:** `apps/web/e2e/auth/home-redirect.spec.ts`
- **Priority:** High
- **Evidence:** `home-redirect.tsx:10-12`; `regression-support.ts:136-142,332-335`; `portal-layout.tsx:21-33`.

### `PG-001-F001-A002-T005` — Internal roles complete the root handoff to workspace selector

- **Page ID:** `PG-001`
- **Atomic feature ID:** `PG-001-F001-A002`
- **Test type:** E2E / browser (one parameterized scenario with three isolated role examples)
- **Scenario:** STAFF, ADMIN, and SUPERADMIN tokens all take the same root `/dashboard` branch; downstream role resolution sends each internal role to `/module`.
- **Preconditions:** Three fresh browser contexts; install `mockApi(page, role)` before each navigation.
- **Test data:** One `test-session` access token per context; roles `STAFF`, `ADMIN`, and `SUPERADMIN` returned by mocked `/api/auth/me`.
- **Test steps:** For each role, seed session storage, navigate to `/`, and wait for account resolution and redirect.
- **Expected result:** Each example ends at `/module`. This is a composite handoff result; `HomeRedirect` itself only selects `/dashboard` and does not inspect the role.
- **Existing coverage:** `regression.spec.ts:410-438` verifies these role destinations after sign-in from `/internal/login`; no example starts at `/`.
- **Coverage gap:** Root-to-portal-to-role landing sequence is not covered. This case does not replace backend permission tests.
- **Proposed test location:** `apps/web/e2e/auth/home-redirect.spec.ts`
- **Priority:** High
- **Evidence:** `home-redirect.tsx:10-12`; `portal-layout.tsx:26-33,64-88`; `regression-support.ts:136-142,332-335`.

### `PG-001-F001-A002-T006` — Rejected session is denied after root handoff

- **Page ID:** `PG-001`
- **Atomic feature ID:** `PG-001-F001-A002`
- **Test type:** E2E / browser
- **Scenario:** A truthy but invalid/revoked token first enters the dashboard handoff, then the protected account check rejects it.
- **Preconditions:** Fresh browser context; intercept `GET /api/auth/me` with a deterministic 401 that has no refreshable `ACCESS_TOKEN_EXPIRED` code.
- **Test data:** `sessionStorage["nexus.auth.token"] = "invalid-session"`; `/api/auth/me` returns `{ error: "Unauthorized" }` with status 401.
- **Test steps:** Install the 401 route; seed the access token; navigate to `/`; wait for the login redirect.
- **Expected result:** Portal account check clears the rejected session and returns the USER to `/login`; the access token is absent from `sessionStorage`. The root check alone does not validate the credential.
- **Existing coverage:** `regression.spec.ts:699-716` asserts the same 401 clearing outcome when starting at `/dashboard`, not `/`.
- **Coverage gap:** Root-started negative session path is untested.
- **Proposed test location:** `apps/web/e2e/auth/home-redirect.spec.ts`
- **Priority:** High
- **Evidence:** `home-redirect.tsx:10-12`; `auth-api.ts:187-199`; `use-account.ts:22-29,52-64`.

### `PG-001-F001-A002-T007` — Account-service outage is shown without discarding token

- **Page ID:** `PG-001`
- **Atomic feature ID:** `PG-001-F001-A002`
- **Test type:** E2E / browser, downstream handoff adjunct
- **Scenario:** Root accepts a truthy token and hands off; a non-401 account API failure is presented by the portal layout without revoking the token.
- **Preconditions:** Fresh browser context; mock `GET /api/auth/me` with 503 before navigating from `/`.
- **Test data:** `sessionStorage["nexus.auth.token"] = "test-session"`; `/api/auth/me` returns status 503.
- **Test steps:** Install the deterministic 503 response; seed the session token; navigate to `/`; wait for portal error state.
- **Expected result:** URL remains `/dashboard`; a `role="alert"` contains “couldn’t load your account”; the access token remains in session storage. This is downstream recovery behavior, not root error UI.
- **Existing coverage:** `regression.spec.ts:671-697` tests 503 preservation and retry on `/login`; it does not cover the portal layout from root. Source defines a different portal error at `use-account.ts:59-64`.
- **Coverage gap:** Portal account-load failure from a root-originated handoff is not directly checked.
- **Proposed test location:** `apps/web/e2e/auth/home-redirect.spec.ts`
- **Priority:** Medium
- **Evidence:** `use-account.ts:52-64`; `portal-layout.tsx:52-64`; `auth-api.ts:187-199`.

### `PG-001-F001-A003-T008` — Redirect replaces the root history entry

- **Page ID:** `PG-001`
- **Atomic feature ID:** `PG-001-F001-A003`
- **Test type:** E2E / browser
- **Scenario:** Browser Back after a root redirect returns to the page visited before `/`, rather than revisiting `/` as a pushed entry.
- **Preconditions:** Fresh anonymous browser context; `/register` is available; no session token.
- **Test data:** No credential data; route sequence `/register` → `/` → redirect destination.
- **Test steps:** Navigate to `/register`; navigate to `/`; wait for `/login`; invoke browser Back; wait for the prior page.
- **Expected result:** Browser returns to `/register`. The root entry is replaced because its effect uses `router.replace()`.
- **Existing coverage:** No existing assertion for browser history behavior was found.
- **Coverage gap:** `router.replace` semantics are source-visible but untested.
- **Proposed test location:** `apps/web/e2e/auth/home-redirect.spec.ts`
- **Priority:** Medium
- **Evidence:** `home-redirect.tsx:10-12`; `apps/web/src/app/(auth)/register/page.tsx`.

### `PG-001-F001-A002-T009` — Expired access token refreshes after root handoff

- **Page ID:** `PG-001`
- **Atomic feature ID:** `PG-001-F001-A002`
- **Test type:** E2E / browser, downstream handoff adjunct
- **Scenario:** A truthy expired access token selects `/dashboard`; the account request receives `ACCESS_TOKEN_EXPIRED`, refresh succeeds once, and account loading completes with the renewed session.
- **Preconditions:** Fresh browser context; mock `/api/auth/me` and `/api/auth/refresh` with deterministic token rotation and a USER account.
- **Test data:** Access token `expired`, refresh token `original-refresh`; first `/api/auth/me` response is 401 with code `ACCESS_TOKEN_EXPIRED`; refresh response contains `fresh`, `rotated-refresh`, and `expiresIn: 900`; retried `/api/auth/me` returns USER.
- **Test steps:** Install deterministic route handlers; seed both session tokens; navigate to `/`; wait for dashboard account resolution; inspect refresh count and stored tokens.
- **Expected result:** Final URL is `/dashboard`; exactly one refresh occurs; the renewed access and refresh tokens remain in session storage; no login redirect occurs.
- **Existing coverage:** `regression.spec.ts:57-110` and `jwt-session.spec.ts:16-83` cover refresh from `/dashboard` and `/login`, respectively, but not a visit starting at `/`.
- **Coverage gap:** Root-started expired-access recovery is not directly verified.
- **Proposed test location:** `apps/web/e2e/auth/home-redirect.spec.ts`
- **Priority:** High
- **Evidence:** `home-redirect.tsx:10-12`; `auth-api.ts:108-149,187-199`; `use-account.ts:30-50`.

## Deferred contract case (not counted as an executable proposal)

`PG-001-F001-A002-T010` would check a whitespace-only token. Current source treats it as truthy and selects `/dashboard`, but no product contract says whether whitespace should count as an authenticated marker. Record `CONTRACT CLARIFICATION REQUIRED`; do not implement an acceptance assertion until the intended token rule is confirmed. It is excluded from the proposed-case totals below.

## Proposed-case counts and deduplication

There are **9 proposed additive case IDs** (`T001`–`T009`). Each ID is counted once by its primary test type and once by its primary scenario category. The three role values in `T005` are parameter data for one case ID, not three separately counted designs. The existing anonymous root assertion is preserved and excluded from proposed totals; deferred `T010` is also excluded.

| Counting dimension          |                                      Count |
| --------------------------- | -----------------------------------------: |
| Unit                        |                                          1 |
| API                         |                                          0 |
| Browser E2E                 |                                          8 |
| Integration                 |                                          0 |
| Functional primary category |         4 (`T003`, `T004`, `T005`, `T008`) |
| Edge-case primary category  | 5 (`T001`, `T002`, `T006`, `T007`, `T009`) |

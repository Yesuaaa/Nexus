# PG-001 Unit, API, and E2E Plan

**Purpose:** Execution design only. Tests were not implemented or run.  
**Page and feature IDs:** `PG-001`, `PG-001-F001`, and the [atomic feature IDs](PG-001_ATOMIC_FEATURE_INVENTORY.md).

## Unit tests

**Proposed:** One case, `PG-001-F001-A001-T001`.

- **Location:** `apps/web/test/auth-api.test.mjs`.
- **Subject:** `getToken()` fallback when reading `sessionStorage` throws.
- **Isolation:** Override the global `sessionStorage` property with a throwing getter for the case; restore the descriptor in `t.after` cleanup. Do not share mutable storage state across tests.
- **Expected assertion:** `getToken()` returns `null`; the root source branch for that result selects `/login`.
- **Command for the later implementation stage:** `pnpm test:web` runs the web unit suite. Do not run as part of this design pass.

## API and backend tests

**New PG-001 API cases proposed:** 0.

`HomeRedirect` has no direct endpoint, request payload, response contract, persistence operation, or database model. Adding an API case for the component itself would test unrelated functionality. The existing `apps/api/tests/jwt-session.test.ts` suite is relevant downstream evidence: it starts the API against `startPgliteApp`, then checks auth/session behavior including `/api/auth/me`, refresh, replay rejection, logout revocation, expiry, and account status. That suite does not exercise route `/` and remains unchanged.

- **PGlite:** Not required for PG-001 cases; useful only to the existing isolated backend session suite.
- **Isolated API server:** Not required for the proposed cases because browser API responses are intercepted.
- **PostgreSQL:** Not required. Do not connect to a live or production database.
- **API authorization:** Root has no API request to authorize. The downstream test cases do not substitute for the API RBAC suite.

## Browser E2E tests

**Proposed:** Eight cases, `PG-001-F001-A001-T002` through `PG-001-F001-A003-T008`, plus `PG-001-F001-A002-T009` (case IDs are described in [the specification](PG-001_TEST_CASE_SPECIFICATION.md)).

- **Recommended location:** New `apps/web/e2e/auth/home-redirect.spec.ts`, leaving existing regression tests intact.
- **Runtime:** Existing Playwright Chromium project. Without `NEXUS_E2E_BASE_URL`, the config builds and serves the web app at `http://127.0.0.1:5273`.
- **Anonymous cases:** Empty token, localStorage-only token, and history behavior need no backend; keep each browser context isolated.
- **Authenticated handoff cases:** Install `mockApi(page, role)` before navigating for successful USER/internal role cases. For 401, 503, and refresh cases, install deterministic same-origin route handlers for `/api/auth/me` and `/api/auth/refresh`.
- **Assertions:** Final URL, relevant login/dashboard/module state, storage values, API refresh count, and history behavior. Use no live credentials.
- **Live mode:** Existing `regression.spec.ts` skips its entire auth/session describe when `NEXUS_E2E_LIVE=1`. Keep the new mocked-only file independent of real-account live mode and do not enable external access for these cases.
- **Command for the later implementation stage:** `pnpm --filter @nexus/web exec playwright test auth/home-redirect.spec.ts`. The config starts the local built web server if no base URL is supplied. Do not run as part of this design pass.

## Integration tests

**New integrated browser + real API + database cases proposed:** 0.

The page logic is a local storage branch and navigation effect. An integration stack would add no required coverage beyond the mocked browser handoff and existing PGlite session tests. If a later acceptance criterion specifically requires a real browser-to-Express smoke path, use a disposable isolated API/PGlite fixture and cleanup owned by that test harness; never use production data. That is an optional future requirement, not a dependency for this page.

## Other test classes

- **Functional:** Core route outcomes are covered by browser cases `T003`, `T004`, `T005`, and `T008`.
- **Edge cases:** Storage exception, empty token, rejected session, account API outage, and access-token refresh are covered by `T001`, `T002`, `T006`, `T007`, and `T009`.
- **Security:** `T003` checks sessionStorage-only behavior; `T005` checks role landing at the frontend boundary; `T006` checks that the portal rejects an invalid session. Backend permission enforcement remains covered separately by API tests.
- **Input validation:** Not applicable; the route has no inputs.
- **Keyboard/responsive/UI interaction:** Not applicable to a `null`-rendering redirect component. Verify final route/state rather than a nonexistent control layout.
- **External integration access:** None required.

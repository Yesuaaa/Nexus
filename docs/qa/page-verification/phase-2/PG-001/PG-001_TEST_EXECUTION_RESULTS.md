# PG-001 Test Execution Results

**Execution date:** 2026-11-23  
**Page:** `PG-001`, `/`  
**Scope:** Focused PG-001 cases and selected existing authentication regressions only; the repository-wide test suite was not run.

All commands were invoked with `PNPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false`; the Playwright regression command also set `NEXUS_E2E_LIVE=0` so all selected scenarios used mocks.

## Final commands and results

### Unit tests

Command:

```powershell
pnpm --filter @nexus/web exec node --experimental-strip-types --test --test-isolation=none test/auth-api.test.mjs test/auth-portal.test.mjs
```

**Exit code:** 0 — **13 passed, 0 failed, 0 skipped.** This includes T001 and the existing auth API and auth portal unit tests.

### New and existing browser tests

Command (with `NEXUS_E2E_LIVE=0`):

```powershell
pnpm --filter @nexus/web exec playwright test auth/home-redirect.spec.ts auth/regression.spec.ts auth/jwt-session.spec.ts --grep 'PG-001|anonymous home and protected deep links redirect to login|persistent storage cannot restore an authenticated session|sign-in goes directly to the workspace selector|renews an expired access token and signs out both tokens|opening login with an expired token allows sign-in|login session checks preserve the token during a server error and can retry|expired sessions clear the token and return to login|expired access refreshes on login navigation and logout clears both tokens' --workers=1
```

**Exit code:** 0 — **24 passed, 0 failed, 0 skipped** in 34.9 seconds. Playwright used its configured local web-server build and Chromium project; test API calls were intercepted. No production API or database was used.

## Per-case outcomes

| Test ID                 | File and declaration                                                                                                            | Objective, setup, and data                                                                                                   | Expected result                                                                      | Actual result                                        | Status     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------- | ---------- |
| `PG-001-F001-A001-T001` | `apps/web/test/auth-api.test.mjs:17` — `getToken returns null when sessionStorage access throws`                                | Replace the global storage property with a throwing getter; call the exported `getToken()`; restore the previous descriptor. | Return `null` without propagating the exception.                                     | Returned `null`; cleanup restored the descriptor.    | **PASSED** |
| `PG-001-F001-A001-T002` | `apps/web/e2e/auth/home-redirect.spec.ts:6` — `an empty session token follows the anonymous branch`                             | Fresh browser context; seed `sessionStorage` token as `""`; visit `/`.                                                       | Finish at `/login` with “Welcome Back” visible.                                      | URL and heading matched.                             | **PASSED** |
| `PG-001-F001-A001-T003` | `apps/web/e2e/auth/home-redirect.spec.ts:18` — `localStorage-only credentials do not open the portal from root`                 | Seed access and refresh credentials only in `localStorage`; visit `/`.                                                       | Finish at `/login`; no session token is created.                                     | URL matched and session token remained absent.       | **PASSED** |
| `PG-001-F001-A002-T004` | `apps/web/e2e/auth/home-redirect.spec.ts:36` — `a USER session follows the root redirect to dashboard`                          | `mockApi(page, "USER")`; seed `test-session` in session storage; visit `/`.                                                  | Finish at `/dashboard` with the session retained.                                    | URL matched and token remained `test-session`.       | **PASSED** |
| `PG-001-F001-A002-T005` | `apps/web/e2e/auth/home-redirect.spec.ts:52` — role loop for `STAFF`, `ADMIN`, and `SUPERADMIN`                                 | Each role gets an isolated Playwright page, `mockApi` account fixture, and `test-session`; visit `/`.                        | Each portal handoff finishes at `/module` and shows the workspace selector.          | All three role examples matched.                     | **PASSED** |
| `PG-001-F001-A002-T006` | `apps/web/e2e/auth/home-redirect.spec.ts:68` — `a rejected token is cleared after root hands off to the portal`                 | Seed `invalid-session`; mock `/api/auth/me` as ordinary 401; visit `/`.                                                      | Portal rejects the token, clears it, and returns to `/login`.                        | Login URL reached and token became `null`.           | **PASSED** |
| `PG-001-F001-A002-T007` | `apps/web/e2e/auth/home-redirect.spec.ts:85` — `account service failure is shown after root handoff without clearing the token` | USER fixture; mock `/api/auth/me` as 503; seed `test-session`; visit `/`.                                                    | Remain at `/dashboard`, display the portal account-load alert, and retain the token. | Dashboard URL, alert text, and stored token matched. | **PASSED** |
| `PG-001-F001-A003-T008` | `apps/web/e2e/auth/home-redirect.spec.ts:106` — `root redirect replaces its browser history entry`                              | Navigate `/register` → `/` with no token, then use browser Back.                                                             | Redirect to `/login`; Back returns to `/register`.                                   | Both destinations and registration heading matched.  | **PASSED** |
| `PG-001-F001-A002-T009` | `apps/web/e2e/auth/home-redirect.spec.ts:120` — `expired access refreshes after root hands off to dashboard`                    | USER fixture; seed `expired` and `original-refresh`; mock expired `/me`, one refresh, then fresh `/me`.                      | Finish at `/dashboard`; exactly one refresh; store `fresh` and `rotated-refresh`.    | URL, refresh count, and both stored tokens matched.  | **PASSED** |
| `PG-001-F001-A001-T011` | `apps/web/e2e/auth/home-redirect.spec.ts:170` — `repeated anonymous root visits continue to resolve to login`                   | Fresh anonymous context; navigate to `/` twice.                                                                              | Each visit ends at `/login` with “Welcome Back” visible.                             | Both visits matched.                                 | **PASSED** |

T005 has three execution examples, each passed.

## Preserved existing browser assertions

The combined browser run also passed **13 selected existing tests**, including the original anonymous-root loop (`regression.spec.ts:390-408`), persistent-storage restriction, role sign-in landing tests, expired-session handling, refresh cases, server-error recovery, and login-navigation refresh. See [regression preservation](PG-001_REGRESSION_PRESERVATION.md) for declarations and assertions.

## Resolved first-run issues and environment notes

- The first unit command without `--test-isolation=none` stopped before assertions with Node `spawn EPERM`. Running Node’s test runner in-process succeeded.
- Sandbox-only Playwright and Next build attempts stopped at child-process creation with `spawn EPERM`. The authorized local browser run then started the configured build/browser workers and completed successfully.
- The first full run of the new browser spec had 9 passing declarations and 2 failures classified as **FAILED — TEST DEFECT**: a strict-mode alert selector matched both the portal alert and Next’s route announcer; and the mock API expected the original bearer token after refresh. The selector was scoped to `main[role="alert"]`, and the mock’s expected token now advances to `fresh`. Subsequent runs passed.
- These initial failures did not demonstrate an application defect. Final status for every implemented test is **PASSED**.

## Deferred case

`PG-001-F001-A002-T010` is **BLOCKED — CONTRACT CLARIFICATION** and **NOT EXECUTED**. Current source treats whitespace-only token values as truthy; intended product behavior is unspecified. It was not implemented as an acceptance test.

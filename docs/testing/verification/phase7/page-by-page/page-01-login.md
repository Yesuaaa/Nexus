# Phase 7.4.1 — Page 1: Login Regression Enhancement

## 1. Executive Summary

Page: **Login** (`/login`). Result: **complete with verified defects and accepted limitations**.

Three Login-specific Playwright cases were added. The final safe browser group discovered and executed 48 cases: **47 passed, 1 failed, 0 skipped, 0 flaky**, with one worker and zero retries. The failure is a retained security/contract test: a malformed HTTP 200 login body containing `token: null` is persisted by the web client as the string `"null"` in `sessionStorage`. No application source was changed.

The five real-account cases PW-124 through PW-128 remain deferred because this workspace does not provide a verified disposable database and isolated synthetic accounts. A visible “Forgot password?” link also points to an unimplemented `/forgot-password` route; same-HEAD prior diagnostic evidence records HTTP 404. Neither issue was hidden to make the run green.

## 2. Git Baseline

- Branch: `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages`
- Initial and final HEAD: `35614093b45ed701665326b7c89d502f7f9df6b1`
- Initial tracked working tree: clean; no staged or unstaged changes.
- Final worktree changes: modified `apps/web/e2e/auth/login-validation.spec.ts` and added this unstaged report.
- Test evidence was written to the new `test-results/phase7/page-by-page/page-01-login/` directory. The pre-existing `page01-login/` evidence directory was not overwritten.
- No commit or push was made.

## 3. Login Source Inventory

### Components and call chain

- Route: `apps/web/src/app/(auth)/login/page.tsx` renders `AuthPage` with mode `login`.
- Session gate and guest form: `apps/web/src/features/auth/pages/auth-page.tsx`. A stored session is checked with `/api/auth/me`; success redirects to `/dashboard`, a 401 clears the session and shows the guest form, and other failures preserve the token and offer “Try again”.
- Form and fields: `apps/web/src/features/auth/components/auth-form.tsx` and `auth-fields.tsx`; validation: `model/schema.ts`; localized copy: `content/auth-copy.ts`.
- Successful transition and notifications: `providers/auth-provider.tsx`, `hooks/use-login-transition.ts`, and the shared toast viewport.
- Browser API client: `features/auth/api/auth-api.ts` calls same-origin `/api/auth/login` through `lib/api-url.ts`. `next.config.ts` rewrites `/api/*` to `http://localhost:3001` by default.
- API mount: `apps/api/src/app.ts` mounts `authRouter` from `features/auth/auth.controller.ts` at `/api/auth`.
- Login server chain: `auth.controller.ts` → `auth.service.ts` → `auth.schema.ts` email normalization, `auth.limiter.ts`, `auth.repository.ts` user lookup, and `auth.password.ts` password verification. Success calls `issueSession`, signs an access JWT, persists a refresh-token hash/session, and returns `publicUser` with the account's fixed role and derived permissions.
- Authorization: `auth.permissions.ts` defines `USER`, `STAFF`, `ADMIN`, and `SUPERADMIN` permission sets; `auth.middleware.ts` checks the current database session, active/deleted account state, and permissions on protected API routes.

### Actual Login fields and validation

| Field    | Implemented behavior                                                                                                                                                                                                                                                                                      |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email    | Required `type="email"`, `autocomplete="email"`, and `maxLength=254`. Client validation trims for checking, requires a basic email shape and at most 254 characters, and focuses the first invalid field. Submission sends `email.trim()`; the API trims and lowercases it.                               |
| Password | Required `type="password"`, `autocomplete="current-password"`, initially masked, with no login minimum-length rule. Client validation rejects empty input and UTF-8 values over 1,024 bytes. Submission preserves the exact password string, including spaces. A button toggles text/password visibility. |

Both fields have associated labels. Invalid fields expose `aria-invalid` and an error description; field feedback uses `aria-live="polite"`. The form uses custom validation (`noValidate`), blocks duplicate in-flight submits, disables the submit button while pending, and accepts native Enter-key form submission.

### Authentication behavior and account states

The browser sends credentials in a JSON POST body. Tokens are stored in `sessionStorage`; the client does not place auth tokens in cookies or `localStorage`. The login page's success transition routes every role to `/dashboard`; role differences are enforced through returned permissions and protected API checks, not role-specific Login destinations. Query parameters do not drive the successful destination.

The API rejects unknown users, incorrect passwords, inactive accounts, and accounts with `accountDeletedAt` set using the same 401 credential error. It also limits login failures per IP/email and applies an API-level login request limit. No separate suspended, locked, or unverified account state is checked by this Login service. Authentication error mapping covers 400 validation responses, 401 credentials, 429 throttling, server errors, and network `TypeError`; no distinct timeout behavior is implemented. The login client currently trusts the declared response type at runtime, which is the cause of the new malformed-response finding.

## 4. Existing Regression Inventory

The official Page 1 ownership inventory contains 45 offline cases across five specs. Phase 6's accepted mapping reconciles all 45 to historical PW identities; there are **0 pre-existing nonhistorical cases** in those files. Five additional historical identities, PW-124–PW-128, live in `e2e/regression/live-backend.spec.ts` and remain deferred. Thus the pre-existing Page 1 attribution is 50 identities: 45 offline and 5 live.

The five offline specs run as the bounded Page 1 group:

- `apps/web/e2e/auth/login-validation.spec.ts` — client validation, field focus, pending/duplicate submits, localization.
- `apps/web/e2e/auth/regression.spec.ts` — mocked login success/failure, session and role redirects, protected routes, retry, refresh, and logout; also contains shared Registration cases.
- `apps/web/e2e/auth/jwt-session.spec.ts` — refresh on Login navigation, token clearing, and CSP policy.
- `apps/web/e2e/auth/auth-performance.spec.ts` — server-rendered guest form, Login responsive/visual performance, and shared auth visuals.
- `apps/web/e2e/shared/auth-styles.spec.ts` — Login CSP styles and shared auth/portal route styling.

The two original identities in `login-validation.spec.ts` remain unchanged. Their 22 original Playwright `expect` call sites were recorded before editing; final source contains 40 call sites, with all original sites retained and new assertions only. The complete pre-edit identity list and assertion summary are in `test-results/phase7/page-by-page/page-01-login/baseline-discovery.txt` and `historical-preservation-baseline.txt`.

Other route-owned tests in Employee Management and Settings assert their own login-retirement/session-revocation workflows; they were not counted as Login-form cases. The live test file's current titles were independently discovered and are listed under Section 8.

## 5. Implemented Regression Enhancements

Only `apps/web/e2e/auth/login-validation.spec.ts` was changed. The existing `mockApi` and `storedTokens` helpers were reused; no fixture file or dependency changed.

New cases:

1. **`login Enter submission preserves the password and ignores unsafe redirects`** — submits through Enter, checks the exact request contract and session tokens, and confirms a hostile `next`/role query does not override `/dashboard`.
2. **`a network failure retains credentials and permits a successful retry`** — aborts the first mocked request, verifies feedback, retained field values, enabled retry, no session, then a successful mocked retry.
3. **`a malformed successful login response cannot establish a session`** — returns HTTP 200 with null token fields and requires the client to avoid storing a session. It is intentionally retained as a failing application-contract test.

The original validation case also gained additive assertions for default password masking and value preservation through both visibility-toggle states. No existing test title or assertion was changed or removed.

## 6. Feature-to-Test Matrix

`MOCKED_UI_VERIFIED` means the browser assertions ran against deterministic intercepted API responses. `ISOLATED_API_VERIFIED` refers to prior Phase 7.3 API evidence and is not part of the current Playwright count. Live auth is never inferred from a mock.

| ID  | Feature and source                                                                                         | Test and assertion purpose                                                                                                                                                                        | Execution status                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| L01 | Guest Login page and server HTML — `auth-page.tsx`, `auth-performance.spec.ts`                             | `guest login form is visible before JavaScript hydrates`; HTTP 200, labels, initial layout, mobile layout.                                                                                        | `MOCKED_UI_VERIFIED` — pass                                                                                          |
| L02 | Email field and client boundaries — `auth-form.tsx`, `auth-fields.tsx`, `model/schema.ts`                  | `login validates both fields, preserves credentials, and prevents duplicate requests`; required/format/max length/focus/no request for invalid input.                                             | `MOCKED_UI_VERIFIED` — pass                                                                                          |
| L03 | Email normalization — `auth-form.tsx`, API `auth.schema.ts`                                                | Same validation test plus Phase 7.3 `login-validation.test.ts`; client trim and API trim/lowercase contract.                                                                                      | `PARTIALLY_VERIFIED` — source and isolated API verified; browser does not separately assert whitespace normalization |
| L04 | Password required and 1,024-byte boundary — `model/schema.ts`, API `auth.service.ts`                       | Existing validation test and Phase 7.3 login API boundary cases.                                                                                                                                  | `MOCKED_UI_VERIFIED` and prior `ISOLATED_API_VERIFIED` — pass                                                        |
| L05 | Password masking, show/hide, value preservation — `auth-fields.tsx`                                        | Existing validation test, strengthened with default type and value-retention assertions.                                                                                                          | `MOCKED_UI_VERIFIED` — pass                                                                                          |
| L06 | Accessible labels, invalid state, and first-invalid focus — `auth-fields.tsx`, `auth-form.tsx`             | Existing validation test; verifies accessible labels, `aria-invalid`, and focus on email/password.                                                                                                | `PARTIALLY_VERIFIED` — key states pass; live-region announcement is source-inspected, not asserted directly          |
| L07 | Duplicate submit and pending state — `auth-form.tsx`                                                       | Existing validation test dispatches ten submits; one request and disabled/re-enabled button.                                                                                                      | `MOCKED_UI_VERIFIED` — pass                                                                                          |
| L08 | Enter submission, exact password, and safe destination — form and `use-login-transition.ts`                | New `login Enter submission preserves the password and ignores unsafe redirects`; exactly one POST, no password trimming, `/dashboard`, stored mock tokens.                                       | `MOCKED_UI_VERIFIED` — pass                                                                                          |
| L09 | Invalid credentials — `auth-form.tsx`, API `auth.service.ts`                                               | `invalid login credentials show toast error and retain entered email`; no token and remains at Login.                                                                                             | `MOCKED_UI_VERIFIED` — pass; API credential checks have prior PGlite evidence                                        |
| L10 | Network failure and retry — `auth-errors.ts`, `auth-form.tsx`                                              | New network-failure case checks user feedback, retained values, no token, and successful retry.                                                                                                   | `MOCKED_UI_VERIFIED` — pass                                                                                          |
| L11 | HTTP 503 login failure and retry — `auth-errors.ts`, `auth-form.tsx`                                       | `temporary login failure shows a helpful explanation and permits a successful retry`.                                                                                                             | `MOCKED_UI_VERIFIED` — pass                                                                                          |
| L12 | Successful mocked login, loader, toast, storage, logout — provider, transition hook, API client            | `login preserves the loader, session, success toast, and sign-out`; dashboard navigation, sessionStorage-only tokens, no token cookie/localStorage, sign-out clears tokens.                       | `MOCKED_UI_VERIFIED` — pass; not live authentication                                                                 |
| L13 | Existing session redirects away from Login — `AuthPage`, `use-account.ts`                                  | Four role variants of `keeps their session when opening login or registration directly`; session is retained and Login form is absent.                                                            | `MOCKED_UI_VERIFIED` — pass; real role credentials remain deferred                                                   |
| L14 | Refresh and logout/revocation — API client, backend JWT/session services                                   | `expired access refreshes on login navigation and logout clears both tokens`; prior API JWT suite also covers rotation/replay.                                                                    | Browser `MOCKED_UI_VERIFIED` — pass; prior API suite pass                                                            |
| L15 | Expired session and protected route denial — `AuthPage`, `auth.middleware.ts`                              | `expired sessions clear the token and return to login`, `opening login with an expired token allows sign-in`, and anonymous deep-link redirect.                                                   | `MOCKED_UI_VERIFIED` — pass                                                                                          |
| L16 | Current-account service failure and retry — `AuthPage`                                                     | `login session checks preserve the token during a server error and can retry`.                                                                                                                    | `MOCKED_UI_VERIFIED` — pass                                                                                          |
| L17 | Fixed role permissions and account status — `auth.permissions.ts`, `auth.service.ts`, `auth.middleware.ts` | Mocked role sessions and Phase 7.3 account-status/API tests. Active/deleted checks exist; real role login and deactivated-account case remain PW-124–PW-128.                                      | `PARTIALLY_VERIFIED`; live integration `BLOCKED` pending isolated accounts/database                                  |
| L18 | Query/body role and redirect tampering — form, API service                                                 | Existing API test rejects privilege/redirect tampering; new Enter test confirms successful UI login still goes to `/dashboard` with hostile query.                                                | API `ISOLATED_API_VERIFIED` and browser `MOCKED_UI_VERIFIED` — pass                                                  |
| L19 | Registration link from Login — `auth-form.tsx`                                                             | `stored Filipino language hydrates and survives auth navigation` clicks the Login link to `/register`.                                                                                            | `MOCKED_UI_VERIFIED` — pass; destination's Registration features remain Page 2                                       |
| L20 | Forgot-password link destination — `auth-fields.tsx`                                                       | Same-HEAD prior diagnostic in `test-results/phase7/page-by-page/page01-login/forgot-password-link-result.json` records direct 404 and clicked not-found page; `/forgot-password` route is absent. | `VERIFIED_FAIL` — existing application defect; evidence predates this run and was not overwritten                    |
| L21 | Malformed successful login body — `auth-api.ts`                                                            | New `a malformed successful login response cannot establish a session`; asserts malformed 200 must not persist tokens.                                                                            | `VERIFIED_FAIL` — client stores `"null"` as the access token; retained as a defect test                              |
| L22 | Language menu, CSP/styles, responsive auth visuals — auth header/layout/visuals and shared styles          | Existing locale, font, hydration, CSP, photo, breakpoint, and route-style cases.                                                                                                                  | `MOCKED_UI_VERIFIED` — pass                                                                                          |

## 7. Execution Results

### Discovery and final browser run

- Historical baseline discovery: 45 cases in the five Page 1-owned specs.
- Final discovery: 48 offline cases in those same five specs (45 historical + 3 new).
- Final unique cases executed: **48** — 47 passed, 1 failed, 0 skipped, 0 flaky.
- Deferred live cases: **5**, not included in the 48 offline cases.
- Targeted malformed-response probe: 1 case, failed on the same persisted-null-token assertion; this was a confirmation run, not a retry for flakiness.
- Full Login group: one worker, zero retries. The test process had `NEXUS_E2E_LIVE=0` and database/Supabase variables removed. API calls were intercepted by Playwright mocks; no live API/database was accessed.
- The first runner launch returned `spawn EPERM` before starting any cases. That zero-case setup failure is preserved separately; the process-authorized rerun completed. The final command exited 1 only because the intended malformed-response assertion exposed the application defect.

Final command, from `apps/web`:

```text
node node_modules/@playwright/test/cli.js test --config=C:/Users/ADMIN/Documents/Thesis/Nexus/test-results/phase7/page-by-page/page-01-login/playwright.config.mjs --project=chromium --workers=1 --retries=0 --reporter=json e2e/auth/regression.spec.ts e2e/auth/jwt-session.spec.ts e2e/auth/login-validation.spec.ts e2e/auth/auth-performance.spec.ts e2e/shared/auth-styles.spec.ts
```

Final result: `test-results/phase7/page-by-page/page-01-login/playwright-final.json`; exit code 1. The failing assertion and trace are retained under `.../artifacts/auth-login-validation-a-ma-ba8e0--cannot-establish-a-session-chromium/`. The preliminary 47-case run before adding the malformed-response test passed 47/47 and is preserved separately; it is not the final result.

The current `live-backend.spec.ts` discovery lists these five deferred identities exactly:

| ID     | Current title                                        | Handling                                                  |
| ------ | ---------------------------------------------------- | --------------------------------------------------------- |
| PW-124 | SUPERADMIN logs in and validates real feature access | Deferred — no verified disposable DB and isolated account |
| PW-125 | ADMIN logs in and validates real feature access      | Deferred — same prerequisite                              |
| PW-126 | STAFF logs in and validates real feature access      | Deferred — same prerequisite                              |
| PW-127 | USER logs in and validates real feature access       | Deferred — same prerequisite                              |
| PW-128 | deactivated account cannot establish a session       | Deferred — requires a provisioned disposable account      |

They remain guarded by `test.skip(!live, ...)`; no credentials were fabricated or loaded.

### Static quality checks

The known pnpm global store lock prevents root scripts from starting (`ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK`). In accordance with the repository handoff, local installed tools were used instead: Prettier formatted the changed spec and report, then `--check .` was run; ESLint ran with `--max-warnings 0`; web `next typegen` and TypeScript checking ran; API TypeScript checking ran. Exact exit codes are recorded in `test-results/phase7/page-by-page/page-01-login/quality-gate.txt`.

## 8. Defects and Test Limitations

- **P01-DEF-01 — Forgot password destination is missing.** The Login form renders a `/forgot-password` link, but the route is absent and same-HEAD prior runtime evidence shows 404. No page or application change was authorized.
- **P01-DEF-02 — Malformed login success response is persisted.** `auth-api.ts` trusts the `AuthResult` TypeScript cast and calls `storeTokens` without runtime validation. With HTTP 200 and `token: null`, Web Storage stringifies the value to `"null"`. The new deterministic test fails on that exact value; application code remains untouched.
- Mocked browser tests establish UI/client behavior only. They do not establish real password verification, session persistence, server role authorization, or feature access.
- PW-124 through PW-128 remain blocked on safe live prerequisites. No timeout-specific client contract is implemented. User lockout/unverified/suspended states are not separate Login service rules.
- No Login-specific NEX-017 failure occurred. The known project notification failures and Phase 7.3 request-workflow test-contract issue are unrelated and unchanged.

## 9. Historical Preservation

- All 45 pre-edit offline identities match the accepted Phase 6 preservation map; none were removed. Five live identities PW-124–PW-128 are retained separately and remain unexecuted.
- There were 0 pre-existing nonhistorical identities in the five Page 1-owned specs. Three new cases were added; all 48 offline cases appear in final discovery.
- The original two `login-validation.spec.ts` test titles and their existing 22 `expect` call sites remain intact. Final file has 40 call sites after additive assertions and new tests. Diff contains additions only; no old assertion was deleted, weakened, or rewritten.
- The global Phase 6 reconciliation remains 292 historical identities, 1,630 assertion sites, and 4,211 preservation mappings. Phase 7.1–7.4 reports and all pre-existing ignored evidence were preserved.
- No application source, API contract, database record, dependency, or lockfile was changed.

## 10. Page Acceptance Assessment

The Login source and actual backend chain were inspected, all Page 1-owned safe browser cases ran, three missing scenarios were added, the feature matrix is complete, and historical test identities/assertions were reconciled. The page is administratively complete **with one newly verified malformed-response defect and one existing broken recovery link**. Forty-seven of 48 final browser cases passed; the failing security/contract test is intentionally retained. The five real-account cases are separately deferred, not counted as passed.

## 11. Next Page Readiness

Login work is complete for this authorization. Registration shares `AuthContent`, validation, language selection, the API client, and the transition provider; Page 2 should keep registration-only length/profile rules distinct from Login's shorter credential validation. Existing Login evidence and failures remain available for that audit.

**Page 2 was not started. Phase 7.5 was not started.**

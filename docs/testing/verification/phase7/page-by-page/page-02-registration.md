# Phase 7.4.1 — Page 2: Registration

## 1. Executive Summary

Page: **Registration** (`/register`). Status: **complete with two reproducible application defects**. The Registration source and API path were traced, 20 Registration-specific Playwright cases were added, and the final offline browser group executed 37 cases: **35 passed, 2 failed, 0 skipped, 0 flaky**. The two failures expose malformed-success token storage and formatted phone input truncation. Neither defect was fixed because this task authorizes tests and documentation only.

The existing 13 historical route attributions and four NEX-010 cases remain. A separate focused API run passed all 14 tests, including the PGlite JWT/session integration. It did not use a shared database or create a persistent account. No live Registration run was available or attempted.

## 2. Git Baseline

- Branch: `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages`.
- Initial and final HEAD: `ad9f3a005ed82c34fde39979391876ba676dddf3` (`test(login): add E2E login validation tests and phase 7 regression documentation`).
- Initial tracked worktree and index: clean.
- Final tracked changes: `apps/web/e2e/auth/registration-validation.spec.ts` and this report. No changes are staged. Page 2 test results are under the ignored `test-results/` directory.
- No application, API, schema, dependency, or lockfile changes were made. No commit or push was made.
- Page 1 test and report SHA-256 hashes match the pre-task values recorded in `test-results/phase7/page-by-page/page-02-registration/preservation-check.json`.

## 3. Source Inspection

### Route and submission flow

`apps/web/src/app/(auth)/register/page.tsx` renders the shared `AuthPage` with `mode="register"`. `AuthPage` uses `AuthContent` from `apps/web/src/features/auth/components/auth-form.tsx`. The form validates with `features/auth/model/schema.ts`, then calls `features/auth/api/auth-api.ts` with a same-origin `POST /api/auth/register`. The Next rewrite in `apps/web/next.config.ts` forwards `/api/*` to the Express API. A successful response is stored in `sessionStorage`; the shared transition displays the account-opening state and navigates to `/dashboard`.

The form uses `noValidate`, focuses the first invalid field, prevents a second in-flight submit with a ref, and disables the submit button while pending. Field errors are associated with inputs using `aria-invalid`, `aria-describedby`, and a polite live region. Password visibility uses labeled toggle buttons with `aria-pressed`.

### Registration inputs and server validation

| Field            | Client behavior                                                                                                                                                                                                                                  | API behavior                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full name        | Required text; `autocomplete="name"`; raw input limit 100; validates trimmed length 2–100 and allows Unicode letters, spaces, periods, apostrophes, and hyphens. Submission trims it.                                                            | Trims and checks length 2–100. It does not apply the client character allowlist.                                                                                                         |
| Contact number   | Required `tel`; `autocomplete="tel"`; raw `maxLength=11`; `onChange` removes non-digits; validates exactly 11 digits beginning `08` or `09`.                                                                                                     | Accepts a broader trimmed format: optional `+`, then digits, spaces, or hyphens, total pattern length 7–20. The API helper accepts `+63 912 345 6789`, which the client does not accept. |
| Email            | Required `email`; `autocomplete="email"`; `maxLength=254`; validation and submission trim surrounding whitespace. Client regex accepts ASCII local parts and `.com`/`.ph` suffixes, case-insensitively. Client payload preserves letter case.    | Trims, lowercases, caps at 254 characters, and uses a general email shape rather than the client’s `.com`/`.ph` restriction.                                                             |
| Password         | Required, initially masked, `autocomplete="new-password"`, minimum 12 characters. Client checks UTF-8 length ≤1,024 bytes and requires uppercase, lowercase, digit, and non-alphanumeric characters. The exact value is sent; it is not trimmed. | Requires a string of at least 12 JavaScript characters and at most 1,024 UTF-8 bytes. It does not enforce the client’s four character classes. Passwords are hashed with salted scrypt.  |
| Confirm Password | Required, masked, `autocomplete="new-password"`, minimum-length attribute 12. Must exactly equal Password; neither value is trimmed. It is omitted from the API payload.                                                                         | No confirmation field is accepted or checked by the service.                                                                                                                             |

### Account creation and security

The controller in `apps/api/src/features/auth/auth.controller.ts` rate-limits Registration to 10 requests and returns HTTP 201 with the session result. `auth.service.ts` validates normalized email, password, profile, and duplicate email; unique conflicts also map to HTTP 409. It creates the user with `Role.USER`, hashes the password, then creates an initial session and nested refresh-token record. The public response is produced by `publicUser`, which does not include the password hash.

The Prisma `User` model defaults `isActive` to `true` and leaves `accountDeletedAt` null. The Registration path contains no email-verification, pending-approval, or separate activation step. It issues a session immediately; the mocked browser success test verifies the dashboard transition and session storage, not database insertion. User creation and initial session creation are sequential repository operations; failure between them was not fault-injected, so partial-account behavior remains unverified.

## 4. Existing Test Inventory

The pre-change Registration scope contained **13 historical route attributions**:

| Historical ID | Existing test                                                                       | Owner                                                |
| ------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| PW-012        | `/register` preloaded-font request                                                  | `auth/auth-performance.spec.ts`                      |
| PW-015        | Standalone image optimizer                                                          | `auth/auth-performance.spec.ts` (shared auth visual) |
| PW-020        | `/register` styles under CSP                                                        | `shared/auth-styles.spec.ts`                         |
| PW-143        | `/register` email authentication and removed social providers                       | `auth/regression.spec.ts`                            |
| PW-144        | Auth server HTML and unknown-route 404                                              | `auth/regression.spec.ts`                            |
| PW-148        | Invalid Registration input blocks submission                                        | `auth/regression.spec.ts`                            |
| PW-149        | Duplicate email shows inline conflict feedback                                      | `auth/regression.spec.ts`                            |
| PW-150        | Registration request contract and Client dashboard                                  | `auth/regression.spec.ts`                            |
| PW-151        | Filipino language survives auth navigation                                          | `auth/regression.spec.ts`                            |
| PW-152–PW-155 | Existing SUPERADMIN, ADMIN, STAFF, and USER sessions redirect away from auth routes | `auth/regression.spec.ts`                            |

The existing `auth/registration-validation.spec.ts` also had four nonhistorical NEX-010 cases for a 10-digit phone number, malformed email, short password, and mismatched confirmation. These are separate from the 13 historical attributions. The prior Phase 7.2 page row’s `4 / 4` is the focused NEX-010 group count; the bounded Page 2 run here includes all 17 pre-existing applicable identities, with shared route attributions executed once.

The original dedicated spec contained three assertion call sites in its parameterized test body (12 assertion executions across its four cases). Its original test data, test body, and four case identities are unchanged. The full pre-change discovery and source copy are retained in the Page 2 evidence directory.

## 5. New Regression Tests

Only `apps/web/e2e/auth/registration-validation.spec.ts` was extended. It adds 20 cases:

1. `registration renders required fields, password controls, and Login navigation`
2. `empty and whitespace-only registration input focuses each required field without posting`
3. `registration accepts the 100-character full-name boundary`
4. `registration rejects unsupported name punctuation and accepts Unicode names`
5. `registration enforces the contact prefix and email suffix rules`
6. `registration strips separators from a formatted contact number` — retained as a failing defect test
7. `registration accepts the 254-character email boundary`
8. `registration trims profile fields and preserves password whitespace`
9. `registration rejects a password without a capital letter`
10. `registration rejects a password without a lowercase letter`
11. `registration rejects a password without a number`
12. `registration rejects a password without a special character`
13. `registration enforces the 1024-byte password limit and accepts its UTF-8 boundary`
14. `registration confirmation can be corrected after a mismatch`
15. `registration handles HTTP 400 validation responses and permits a corrected retry`
16. `registration server errors retain form values and permit retry`
17. `registration rate limits keep the form open without creating a session`
18. `registration network failures retain values and permit retry`
19. `registration submits with Enter once and blocks repeated in-flight submits`
20. `a malformed successful registration response cannot establish a session` — retained as a failing defect test

The cases use existing regression fixtures and synthetic values. API responses are intercepted; no test submits an account to a live service.

## 6. Input Validation Coverage

| Input          | Verified in the browser group                                                                                                                                                      | Remaining boundary or limitation                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full name      | Empty and whitespace-only, minimum-one rejection through historical coverage, Unicode acceptance, unsupported underscore rejection, trimming, and exactly 100 characters accepted. | The HTML `maxLength=100` prevents entering 101 characters through the rendered field, so no UI test bypasses that browser limit.                         |
| Contact number | Empty, historical 10-digit rejection, unsupported `07` prefix, `08` acceptance, and formatted-input behavior.                                                                      | Formatted paste is truncated before digit stripping; the focused case fails with 9 digits remaining. API phone format is broader than the client format. |
| Email          | Empty, malformed, unsupported `.org`, `.ph` acceptance, surrounding whitespace trimming, case preservation in the browser payload, and exactly 254 characters accepted.            | A value over 254 is blocked by the input limit; the API’s generic suffix rule differs from the client allowlist.                                         |
| Password       | Empty, short, each missing character class, exact 1,024-byte UTF-8 boundary, 1,025-byte rejection, password whitespace preservation, masking, and show/hide value retention.       | API helpers do not enforce the client’s character-class rules. No live password registration was run.                                                    |
| Confirmation   | Empty, mismatch, and correction followed by mocked success.                                                                                                                        | API has no confirmation field, by design.                                                                                                                |

## 7. Feature-to-Test Matrix

| Feature                                                 | Source and test ownership                                                                                      | Result                                                                                                                                                           | Verification level                            |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Registration route, labels, controls, Login link        | `register/page.tsx`, `auth-form.tsx`; new render/navigation case and PW-143/PW-144                             | `VERIFIED_PASS` for rendered UI and navigation                                                                                                                   | `MOCKED_UI_VERIFIED`                          |
| Required fields, first-error focus, accessible feedback | `auth-form.tsx`, `auth-fields.tsx`, `model/schema.ts`; new required-field case and historical validation cases | `VERIFIED_PASS` for tested fields and focus order                                                                                                                | `MOCKED_UI_VERIFIED`                          |
| Full-name rule                                          | `model/schema.ts`, `auth-form.tsx`; new Unicode, punctuation, trim, and 100-character cases; PW-148            | `PARTIALLY_VERIFIED` — tested rules pass; browser `maxLength` blocks an over-limit UI value                                                                      | `MOCKED_UI_VERIFIED`                          |
| Contact format and sanitization                         | `auth-form.tsx`, `model/schema.ts`, API `auth.schema.ts`; NEX-010 plus prefix and formatted-input tests        | `VERIFIED_FAIL` — formatted value loses digits before validation                                                                                                 | `MOCKED_UI_VERIFIED`                          |
| Email format and normalization                          | `model/schema.ts`, API `auth.schema.ts`; new format/boundary/payload cases and API `auth.test.ts`              | `PARTIALLY_VERIFIED` — client rules pass; client/server suffix rules differ                                                                                      | `MOCKED_UI_VERIFIED`, `ISOLATED_API_VERIFIED` |
| Password policy and confirmation                        | `model/schema.ts`, `auth.password.ts`; new policy/boundary/recovery cases and NEX-010                          | `PARTIALLY_VERIFIED` — client policy passes; server does not enforce character classes                                                                           | `MOCKED_UI_VERIFIED`, `ISOLATED_API_VERIFIED` |
| Successful request, session, and dashboard transition   | `auth-form.tsx`, `auth-api.ts`, `use-login-transition.ts`; PW-150 and new payload/pending cases                | `VERIFIED_PASS` for intercepted responses; no real account insertion implied                                                                                     | `MOCKED_UI_VERIFIED`                          |
| Duplicate email conflict                                | API `auth.service.ts`, `auth-errors.ts`; PW-149                                                                | `VERIFIED_PASS` for mocked HTTP 409 handling                                                                                                                     | `MOCKED_UI_VERIFIED`                          |
| 400, 429, 503, and network errors                       | `auth-form.tsx`, `auth-errors.ts`; new recoverable-response cases                                              | `VERIFIED_PASS` for current UI handling; 400 detail is replaced by generic copy and 429 copy says “sign-in attempts”                                             | `MOCKED_UI_VERIFIED`                          |
| Pending/duplicate submit and Enter                      | `auth-form.tsx`; new in-flight case                                                                            | `VERIFIED_PASS` — one POST, disabled control, retry-safe completion                                                                                              | `MOCKED_UI_VERIFIED`                          |
| Fixed role and account status                           | `auth.service.ts`, `schema.prisma`, `users.dto.ts`; source audit and PGlite session flow                       | `PARTIALLY_VERIFIED` — service fixes `USER`; default active state is source/schema verified, role-tampering behavior is not asserted by the existing PGlite test | `SOURCE_ONLY`, `ISOLATED_API_VERIFIED`        |
| Malformed successful response                           | `auth-api.ts`; new malformed-201 test                                                                          | `VERIFIED_FAIL` — null access token is stored as the string `"null"`                                                                                             | `MOCKED_UI_VERIFIED`                          |
| CSP, preloaded font, shared image optimization          | existing PW-012, PW-015, PW-020 cases                                                                          | `VERIFIED_PASS` in the final bounded group                                                                                                                       | `MOCKED_UI_VERIFIED`                          |
| Persistent registration and live account behavior       | API `jwt-session.test.ts`; no live Registration spec                                                           | `PARTIALLY_VERIFIED` by isolated PGlite; live integration not run                                                                                                | `ISOLATED_API_VERIFIED`                       |

## 8. Test Execution Results

### Environment and discovery

- Playwright: `@playwright/test` 1.64.1; installed Chromium executable was present.
- Existing production web server answered `/register` with HTTP 200. Its build ID was `Mrwj1Ivt9h8QngMNWpw9e`, timestamped 2026-11-11 16:15 +0800. The server was reused; no build or server restart was done.
- `NEXUS_E2E_LIVE=0`; database and Supabase URL environment variables were absent. The custom Page 2 config does not load `.env.regression.local`.
- Final discovery: **37 tests in four specs** — 13 historical attributions, four pre-existing NEX-010 cases, and 20 new cases.

### Final browser run

- One worker, zero retries, 45.4 seconds reported by Playwright.
- **37 executed: 35 passed, 2 failed, 0 skipped, 0 flaky.** Both failures are confirmed application defects and are intentionally retained.
- Initial default-sandbox launch returned `spawn EPERM` before any tests executed. The zero-case failure is retained. The authorized process-spawn reruns completed.
- The first 35-case triage run exposed an unreachable 101-character probe (the browser input caps the value at 100) and a formatted-phone flow that never submitted. The first was replaced by a reachable 100-character boundary check; the second was split into a successful payload-normalization case and an explicit truncation reproducer, which confirmed a product defect. The malformed-response failure was also reproduced in a corrected-case probe. These reruns are diagnostics, not additional test identities.
- Final structured results: `playwright-final-run-2.normalized.json`; exact command: `final-command.txt`; failures and screenshots: `artifacts/`. Failure-context files were scrubbed of synthetic password/token literals, and the final config disables trace capture.

### Isolated API run

Command: `node --import tsx --test --test-concurrency=1 --test-reporter=spec src/features/auth/auth.test.ts src/jwt-session.test.ts` from `apps/api`.

Result: **14 passed, 0 failed**. This covered three auth helper tests and the PGlite-backed JWT/session test with ten nested checks (11 tests including its parent). PGlite used an in-memory database; its migration SQL did not touch shared storage. No full API suite was run.

### Static quality checks

The repository’s pnpm wrappers were not retried because the previously recorded global store lock prevents them from starting. The installed local tools were used instead. Final results are recorded in `quality-gate.txt`: Prettier, root ESLint (`--max-warnings 0`), web route type generation and TypeScript, and API TypeScript all must exit 0. The workspace’s full Prettier check was also run after formatting the changed test and report.

## 9. Defect Register

| ID        | Classification and confidence              | Evidence                                                                                                                                                                                                                                                                                                        | Recommended correction                                                                                                                                     |
| --------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R2-DEF-01 | `INPUT_VALIDATION_DEFECT`, high confidence | `registration strips separators from a formatted contact number` expects `08123456789`; Chromium returns `081234567`. The contact input’s raw `maxLength=11` truncates `08-1234 56789` before `onChange` removes separators. Reproduced in a one-case probe and final group.                                    | Permit the supported formatted input length before normalization, then enforce the 11-digit normalized value. No application change was made.              |
| R2-DEF-02 | `APPLICATION_DEFECT`, high confidence      | `a malformed successful registration response cannot establish a session` returns HTTP 201 with `token: null`. Expected storage is `[null, null]`; actual is `["null", null]`. `auth-api.ts` trusts the `AuthResult` cast and `storeTokens` calls `sessionStorage.setItem` without runtime response validation. | Validate the response shape before storing tokens or completing the transition. Same class of defect as known `LOGIN-001`; no application change was made. |

Additional observed copy/contract gaps are not counted as test failures: HTTP 400 details become generic “Something went wrong” feedback; registration HTTP 429 uses shared copy saying “sign-in attempts”; and client/server email, contact, and password constraints differ as documented above. The current tests capture their implemented behavior without asserting an invented contract.

## 10. Integration Limitations

- Browser success/error cases use deterministic mocks. They do not prove live authentication, persisted account creation, real role enforcement, or real database constraints.
- The isolated PGlite flow does perform Registration and session issuance against an in-memory PostgreSQL-compatible database. It does not directly assert privileged-role injection or default status on the newly created user; those rules were verified from `auth.service.ts` and the Prisma model.
- No live Registration browser test exists in the current live-backend spec, and no safe disposable external database/accounts were supplied. No live account was seeded or created.
- The UI password character-class policy is stricter than the API helper’s length/byte checks. Direct callers can pass a password that the UI would reject; whether to align these constraints is a product/security decision outside this test-only authorization.
- User insertion and initial session creation are sequential. The partial-failure case was not fault-injected and is an unverified integration risk, not a confirmed defect.

## 11. Preservation Reconciliation

- All 17 pre-change scoped identities remain discoverable. The final group contains 20 added identities; none replace or rename historical cases.
- The original parameterized NEX-010 body and its three assertion call sites compare equal to the captured pre-change body. The four original NEX-010 cases remain.
- `auth/regression.spec.ts`, `auth/auth-performance.spec.ts`, `shared/auth-styles.spec.ts`, the Login-specific test, and `page-01-login.md` match their initial SHA-256 hashes. The Phase 6 reconciliation and other Phase 7 reports were not edited.
- Only the dedicated Registration test file and this Registration report are tracked changes. Application/API source, database files, dependencies, and historical tests were not changed.

## 12. Acceptance Assessment

The Registration route and server contract were inspected; all five actual inputs and their validation behavior are documented; 20 missing browser cases were added; the full safe Page 2 group and focused PGlite API tests ran; both defects have reproducible evidence; and historical tests and Login work are preserved. Page 2 is administratively complete **with two confirmed defects and documented integration/copy gaps**. The final browser command exits 1 only because those two defect assertions are intentionally retained.

## 13. Next Page Readiness

Registration evidence and handoff are complete. The two defect findings remain open for a separately authorized fix. **Page 3 — Dashboard was not started. Phase 7.5 was not started.**

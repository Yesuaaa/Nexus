# Converyn — Phase 7.5-D1-02 Registration Defect Remediation Report

## Document Control

| Field           | Value                                                                           |
| --------------- | ------------------------------------------------------------------------------- |
| Project         | Converyn (formerly Nexus)                                                       |
| Phase           | 7.5-D1-02 — Registration                                                        |
| Report date     | 2026-11-17                                                                      |
| Route           | `/register`                                                                     |
| Branch          | `263-fixglobal-implement-fixes-for-issue-backlogs(REG-001)`                     |
| Task-start HEAD | `697ab0b3d69ef2b23c91bfb58a4d8e205b9b682a`                                      |
| Source changes  | None in D1-02; verified fixes already exist at task-start HEAD or its ancestors |
| Page status     | PAGE 02 PARTIALLY COMPLETE — DOCUMENTED LIMITATIONS                             |

## 1. Executive Summary

Both documented Registration defects are verified fixed in the current application. APP-REG-001 passes formatted entry, overlength, invalid-length, and actual clipboard-paste checks. APP-AUTH-001 rejects malformed success data before storing credentials; the Registration-specific browser test verifies accessible error feedback, no session, retained input, and a successful retry.

No application source changes were needed. Two narrowly scoped browser regressions and additional assertions in the existing PGlite account-policy test were added. The Registration and Login Playwright files passed 33/33 tests, auth and field-validation unit tests passed 19/19, and the PGlite account-policy test passed 7/7.

The page remains **partially complete** because current frontend and backend acceptance rules differ for full name, email syntax, and contact number. The task directed us to document those differences without changing policy. Administrative review is needed before either side is aligned.

## 2. Repository and Git State

- Repository root: `C:\Users\ADMIN\Documents\Thesis\Nexus`.
- Branch: `263-fixglobal-implement-fixes-for-issue-backlogs(REG-001)`.
- HEAD at task start: `697ab0b3d69ef2b23c91bfb58a4d8e205b9b682a` (`fix: added extra login validation e2e tests and fixed auth api implementation`).
- The task-start worktree and index were clean: no staged, unstaged, or untracked changes.
- The accepted Page 01 correction is part of task-start HEAD and was preserved. No authentication API or Login test file was modified in D1-02.
- D1-02 changes are limited to the Registration browser tests, the PGlite account-policy test, the defect register, and this report. No commit or push was made.
- The D0 inventory is [here](./phase7.5-D0-comprehensive-defect-inventory.md), the Page 01 report is [here](./page-01-login-remediation.md), and the historical Registration audit is [here](../page-by-page/page-02-registration.md).

## 3. Original Registration Findings

| ID           | Historical aliases | Expected behavior                                                           | Historical observation                                                | D1-02 result                                                                  |
| ------------ | ------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| APP-REG-001  | REG-001; R2-DEF-01 | Formatted contact input retains all 11 intended digits after normalization. | Raw `maxLength` truncated formatted input before digit normalization. | Existing development fix verified.                                            |
| APP-AUTH-001 | REG-002; R2-DEF-02 | Malformed successful registration data must not establish a session.        | `token: null` could be stored as the literal string `"null"`.         | Existing shared auth correction verified through Registration-specific tests. |

## 4. APP-REG-001 Investigation

The current Registration field removes non-digits on every input change and then limits the normalized value to 11 digits. It has no raw-character `maxLength`. The Registration schema accepts only an 11-digit Philippine mobile number beginning with `08` or `09`. The correction came from development commit `ec50c9e9ec41a5ab95f14ecfacbbde83e0385614`; that commit is an ancestor of the task-start revision.

Relevant source: [auth-form.tsx](../../../../../apps/web/src/features/auth/components/auth-form.tsx), [auth validation schema](../../../../../apps/web/src/features/auth/model/schema.ts), and [shared web validation](../../../../../apps/web/src/lib/validation.ts).

## 5. APP-REG-001 Verification

Existing browser coverage verifies a formatted 11-digit value (`08-1234 56789`) displays and submits as `08123456789`, and that extra digits are truncated after formatting characters are removed. Existing validation cases reject an invalid 10-digit value, a `07` prefix, and empty input without submitting.

I added a clipboard case that pastes `08-1234 56789abc123` and confirms the field becomes `08123456789`. This exercises actual paste handling, separators, letters, and overlength input together. The full Registration browser file passed. No application code change was required; APP-REG-001 is **VERIFIED FIXED — EXISTING DEVELOPMENT CORRECTION**.

## 6. APP-AUTH-001 Investigation

Registration calls the shared `register()` API client. It parses the successful JSON as unknown, validates token metadata and the full user account shape, then stores credentials. Rejected responses flow through the existing Registration error toast and form `finally` path, which preserves input and re-enables submission.

The shared runtime guard is in [auth-api.ts](../../../../../apps/web/src/features/auth/api/auth-api.ts). Its implementation and original Login-specific regression are documented in the [Page 01 report](./page-01-login-remediation.md).

## 7. APP-AUTH-001 Verification

The retained browser case sends HTTP 201 with null token values and confirms no tokens are stored, the page remains on `/register`, an “Account unavailable” error appears, and submission is enabled. The added Registration-specific case sends valid token fields with `user.id: null`; it confirms server-error feedback, no stored credentials or redirect, retained email, and a successful valid retry to `/dashboard`.

The auth API unit test rejects malformed Login and Registration responses before writing credentials, preserves existing storage on failure, and accepts a valid Registration response after invalid attempts. The original Login behavior also passed its browser and unit smoke tests. APP-AUTH-001 is **VERIFIED FIXED — EXISTING SHARED AUTHENTICATION CORRECTION**.

## 8. Existing Development Corrections

- **APP-REG-001:** the digit-first normalization correction from `ec50c9e9ec41a5ab95f14ecfacbbde83e0385614` is present in current source and passed the defect-specific browser cases.
- **APP-AUTH-001:** the shared runtime authentication response guard from the accepted Page 01 work is present in task-start HEAD `697ab0b3d69ef2b23c91bfb58a4d8e205b9b682a` and passed Registration-specific unit and browser coverage.
- D1-02 changed no application source, auth implementation, recovery functionality, password policy, or account role rule.

## 9. Additional Corrections Implemented

No application correction was needed. I added two focused browser cases to [registration-validation.spec.ts](../../../../../apps/web/e2e/auth/registration-validation.spec.ts): actual clipboard normalization and malformed-user error/retry behavior. I extended the existing PGlite Registration scenario in [account-policy.test.ts](../../../../../apps/api/tests/account-policy.test.ts) to assert invalid contact handling, successful response fields, the forced `USER` role despite a submitted `SUPERADMIN` value, active-by-default status, omission of `passwordHash`, and duplicate-email HTTP 409.

The PGlite additions verify existing endpoint behavior; they do not change its contract.

## 10. Browser Regression Results

| Command                                                                                                        | Result                                            | Environment and limitation                                                                    |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm --filter @nexus/web test:e2e e2e/auth/registration-validation.spec.ts e2e/auth/login-validation.spec.ts` | **33 passed, 0 failed, 0 skipped; 31.2 seconds.** | Chromium, offline API route mocks; production web build and test server started successfully. |

Key cases included:

- `registration strips separators from a formatted contact number`
- `registration limits contact digits after removing formatting`
- `registration normalizes a formatted contact number pasted from the clipboard` (added)
- `[NEX-010] registration shows the contact number error without submitting`
- `a malformed successful registration response cannot establish a session`
- `malformed registration user data shows an error and permits a safe retry` (added)
- Login valid-submit, malformed-response, error, and retry smoke cases

## 11. Unit and API Verification

| Command                                                                                                                                                                                   | Result                                            | Environment and limitation                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @nexus/web exec node --experimental-strip-types --test test/auth-api.test.mjs test/auth-portal.test.mjs test/auth-error-visibility.test.mjs test/auth-validation.test.mjs` | **19 passed, 0 failed, 0 skipped; 0.24 seconds.** | Auth response, registration field-validation, portal, and session unit tests.                                       |
| `pnpm --filter @nexus/api test -- tests/account-policy.test.ts`                                                                                                                           | **7 passed, 0 failed, 0 skipped; 3.89 seconds.**  | Isolated PGlite; no shared or production database. One existing `pg` deprecation warning was emitted; tests passed. |

The PGlite scenario verifies weak-password HTTP 400, invalid-contact HTTP 400, valid registration HTTP 201 and response shape, duplicate-email HTTP 409, the server-assigned `USER` role, active-by-default status, and absence of password hashes from the public response.

**Workspace quality gates:** Root `pnpm format`, `pnpm lint`, and `pnpm typecheck` all passed at final handoff (exit code 0). Formatting left the worktree changes unchanged; ESLint passed with `--max-warnings 0`; API and Web TypeScript checks passed.

## 12. Shared Login Impact

The combined browser run included the Login validation file, and the auth unit run included login parser, session, portal, and retry tests. All passed. No shared auth code was changed in D1-02; the accepted Page 01 implementation remains intact.

## 13. Historical Regression Preservation

- The 292 historical Playwright identities, 1,630 assertion sites, and 4,211 ownership mappings remain unchanged.
- No existing browser identity or assertion was removed, renamed, or weakened. Two new Page 02 browser identities were added.
- The API test change is additive. No immutable baseline, preservation ledger, original page audit, or Page 01 file was modified.

## 14. Remaining Findings

The two documented defects are verified fixed. Current client and backend registration rules still differ:

| Field          | Frontend                                                                                               | Backend                                                                             | Status                        |
| -------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ----------------------------- |
| Full name      | Trimmed length 2–100 plus `NAME_PATTERN` (Unicode letters, spaces, periods, apostrophes, hyphens).     | Trimmed length 2–100; no character allowlist in `validRegistrationProfile`.         | Unresolved policy contract.   |
| Contact number | Exactly 11 digits starting `08` or `09`; input formatting and nondigits are removed.                   | Generic contact pattern: optional `+`, followed by 7–20 digits/spaces/hyphens.      | Unresolved policy contract.   |
| Email          | ASCII address pattern with a dotted 2+ letter suffix, maximum 254 characters.                          | Trimmed/lowercased, maximum 254 characters, and a general dotted-domain pattern.    | Syntax differs at edge cases. |
| Password       | At least 12 characters, at most 1,024 UTF-8 bytes, uppercase, lowercase, digit, and special character. | Same length, byte, and character-class requirements through `assertStrongPassword`. | Aligned.                      |

The API source confirms invalid email/password/profile responses use HTTP 400, duplicate email uses HTTP 409, and successful Registration returns HTTP 201. No email or phone verification workflow exists in the approved flow. No policy was changed. The earlier audit’s statement that the API lacked password character-class checks is no longer current; the present backend uses the shared strong-password policy.

## 15. Administrative Decisions

Before aligning client and server validation, decide the canonical accepted rules for full name, contact number, and email. The APP-REG-001 evidence establishes the client’s 11-digit `08`/`09` behavior; the backend currently accepts a broader generic contact value. The recommended path is to keep the established Registration UI rule and approve a Registration-specific server rule that matches it, while retaining the generic helper for other features. No such change was made in D1-02.

## 16. Final Page Status

**PAGE 02 PARTIALLY COMPLETE — DOCUMENTED LIMITATIONS.** APP-REG-001 and APP-AUTH-001 are both verified fixed. Frontend/backend policy differences remain unresolved and need administrative review before alignment; the page is not being declared defect-free.

## 17. Recommended Next Step

Stop for administrative review of the validation-policy differences and this report. Page 03 — Dashboard is the proposed next page after review. Page 03, Phase 7.5-N2, and Phase 8 have not started.

# Converyn — Phase 7.5-D1-01 Login Defect Remediation Report

## Document Control

| Field           | Value                                                                          |
| --------------- | ------------------------------------------------------------------------------ |
| Project         | Converyn (formerly Nexus)                                                      |
| Phase           | 7.5-D1-01 — Login                                                              |
| Report date     | 2026-11-17                                                                     |
| Route           | `/login`                                                                       |
| Branch          | `263-fixglobal-implement-fixes-for-issue-backlogs(REG-001)`                    |
| Source revision | `379234d26f4fb0e4dee28853c36fe35e379a63a2` plus the uncommitted D1-01 changes  |
| Page status     | PAGE 01 REMEDIATION COMPLETE WITH ACCEPTED DEFERRED FUNCTIONALITY              |
| Authorization   | P01-DEF-02 correction and verification approved; P01-DEF-01 expressly deferred |

## 1. Executive Summary

P01-DEF-02 / LOGIN-001 was not fully fixed by the existing authentication response changes. Those changes rejected invalid token data and null or array users, but accepted an arbitrary user object such as `{ id: null }`. The auth API unit test reproduced this: both Login and Registration accepted the malformed account and wrote tokens.

The shared auth client now validates the required `Account` response fields and supported role, permission, and nested profile shapes before persisting tokens. Invalid login responses return an API error, leave session storage unchanged, keep the user on `/login`, show an error toast, and allow a later valid retry. The original null-token browser regression remains intact and passes.

P01-DEF-01 remains deferred as directed. No password-recovery behavior was added. Targeted auth unit tests passed 13/13; Login and Registration browser tests passed 31/31; the isolated PGlite account-policy API test passed 7/7. Root format, lint, and typecheck passed.

## 2. Repository and Git State

- Repository root: `C:\Users\ADMIN\Documents\Thesis\Nexus`.
- Branch: `263-fixglobal-implement-fixes-for-issue-backlogs(REG-001)`.
- HEAD at task start: `379234d26f4fb0e4dee28853c36fe35e379a63a2` (`feat: add registration validation tests, authentication API, and test inventory docs`).
- The task-start worktree was clean: no staged, unstaged, or untracked changes.
- The three auth changes noted during D0 had since become part of HEAD. They were treated as the existing baseline and preserved.
- D1-01 leaves three modified application/test files and adds this report plus the append-only register checkpoint. No commit or push was made.
- Applicable workspace and web instructions were reviewed. Historical audit evidence is linked at [Page 01 Login audit](../page-by-page/page-01-login.md), and the preceding inventory is [Phase 7.5-D0](./phase7.5-D0-comprehensive-defect-inventory.md).

## 3. Original Login Findings

| ID                                                                    | Expected behavior                                                                          | Historical observation                                                                               | D1-01 disposition                                              |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| P01-DEF-01 — missing `/forgot-password` destination                   | The link should lead to an approved recovery workflow.                                     | The link exists, but the route is unavailable.                                                       | Deferred by the administrator; unchanged.                      |
| P01-DEF-02 / LOGIN-001 — malformed successful authentication response | Reject malformed auth data before storing credentials or establishing authenticated state. | A successful response with `token: null` could store the literal string `"null"` in session storage. | Remaining account-shape validation was corrected and verified. |

## 4. P01-DEF-01 Deferred Functionality

The approved status is **DEFERRED — FUNCTIONALITY NOT YET IMPLEMENTED**. The `/forgot-password` link remains visible and its destination remains unavailable. No recovery page, endpoint, email token flow, database model, or related UI behavior was added or hidden. P01-DEF-01 is not marked fixed and does not block this page’s acceptance because its deferral was explicitly approved.

## 5. P01-DEF-02 Historical Defect

The original defect arose because a TypeScript response cast did not validate JSON at runtime and Web Storage coerces `null` to the string `"null"`. The pre-D1 source already rejected malformed token fields and null/non-object users. It did not verify that an object actually matched the frontend `Account` contract. A user object with a null or blank identifier could therefore pass validation, have tokens persisted, and continue toward the authenticated transition.

## 6. Current Implementation Inspection

The login flow is `AuthContent.handleSubmit` → `signInToPortal` → `signIn` → `apiRequest` → runtime response validation → token persistence. `AuthContent` begins the login transition only after `signInToPortal` succeeds. Rejected responses flow through the existing error toast path; the form’s `finally` block clears the pending state so the user can retry.

The response guard checks token, refresh-token, and expiry values, then validates the user object against required `Account` fields: nonblank identifier and email, nullable name/contact fields, a supported role, active-state boolean, supported permission values, and a nonblank creation timestamp. Present optional account fields and nested team, department, and head summaries are type-checked. Validation completes before `storeTokens` runs. Storage exceptions still clear partially written credentials.

The API contract was checked against `publicUser()` and the login session response in `apps/api/src/features/users/users.dto.ts` and `apps/api/src/features/auth/auth.service.ts`. No backend source change was needed.

## 7. Existing Development Changes

The changes present during D0 were committed in the task-start revision `379234d`. That commit added an initial token/user guard, auth API unit cases, and a malformed-registration browser case. D1-01 preserved those changes and extended the incomplete user check. The current code and focused tests are in [auth-api.ts](../../../../../apps/web/src/features/auth/api/auth-api.ts), [auth-api.test.mjs](../../../../../apps/web/test/auth-api.test.mjs), and [login-validation.spec.ts](../../../../../apps/web/e2e/auth/login-validation.spec.ts).

No unrelated authentication architecture, role policy, API routing, or recovery behavior was changed.

## 8. Root Cause Analysis

The response entered the browser as untrusted JSON, but the old guard treated any non-null, non-array user object as an `Account`. That allowed malformed identity data through a type assertion. Since session tokens were stored before any later route or API check, the client could show authenticated state for a response that did not meet the established account DTO contract.

## 9. Corrections Implemented

- Added runtime validation for the `Account` fields returned by `publicUser()` and for the defined role and permission values.
- Kept validation before session persistence for both login and registration, which share `assertAuthResult`.
- Expanded auth API negative-path coverage for missing user data, null/blank identifiers, unsupported roles/permissions, and invalid token metadata. Test fixtures now reflect the API’s full account DTO.
- Added one separate Playwright case that returns valid token fields with a malformed user identifier, asserts accessible error feedback, no session storage or navigation, retained form values, enabled retry, and successful subsequent login.
- Left the historical malformed-success Playwright test unchanged.

## 10. Regression Verification

| Command                                                                                                                                                     | Coverage and result                                                                                                                                                                                                                                                   | Environment / limitations                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm --filter @nexus/web exec node --experimental-strip-types --test test/auth-api.test.mjs test/auth-portal.test.mjs test/auth-error-visibility.test.mjs` | **13 passed, 0 failed, 0 skipped; 0.23 seconds.** Includes malformed login/registration response rejection, no credential writes, valid login, portal behavior, session concurrency, and auth error handling.                                                         | Focused Node unit tests.                                                                  |
| `pnpm --filter @nexus/web test:e2e e2e/auth/login-validation.spec.ts e2e/auth/registration-validation.spec.ts`                                              | **31 passed, 0 failed, 0 skipped; 26.8 seconds.** Includes `a malformed successful login response cannot establish a session`, `malformed login user data shows an error and permits a safe retry`, the malformed-registration case, and registration smoke coverage. | Chromium; offline route mocks; production web build and test server started successfully. |
| `pnpm --filter @nexus/api test -- tests/account-policy.test.ts`                                                                                             | **7 passed, 0 failed, 0 skipped; 4.02 seconds.** Includes the PGlite test comparing login, `/me`, profile, and user-list DTOs.                                                                                                                                        | Isolated PGlite database; no shared or production database.                               |
| `pnpm format`                                                                                                                                               | Passed.                                                                                                                                                                                                                                                               | Repository formatting completed; no unrelated files changed.                              |
| `pnpm lint`                                                                                                                                                 | Passed with `--max-warnings 0`.                                                                                                                                                                                                                                       | Repository-wide.                                                                          |
| `pnpm typecheck`                                                                                                                                            | Passed for web and API.                                                                                                                                                                                                                                               | Prisma client generation and Next route type generation completed.                        |

The first attempt to run the complete web unit script, `pnpm --filter @nexus/web test`, could not launch Node test workers in the restricted shell (`spawn EPERM`) and yielded no assertion results. The focused auth unit command passed when run with the process access required by Node’s test runner. This is recorded as an environment limitation, not an application test failure.

The malformed-user unit regression first failed against the pre-D1 implementation for both Login and Registration because it did not reject the response. It passed after the account guard was added. No test expectation was weakened or removed.

## 11. Authentication and Session Validation

- Null, missing, empty, non-string, non-finite, and nonpositive token metadata is rejected.
- Missing users, null/array users, malformed identifiers, unsupported roles, and invalid permission data are rejected before credentials are written.
- The unit test verifies both empty storage and an existing stored session remain unchanged after a malformed response.
- The original malformed-success browser case stays on `/login` with both token keys empty.
- The added browser case confirms an error toast appears, credentials remain in the form, submission is re-enabled, no tokens are stored, and retry with a valid response reaches `/dashboard` and stores the valid session.
- Valid login and protected-route behavior passed in the focused browser and auth unit suites.

## 12. Shared Registration Impact

The same response validator is used by `register`. The registration malformed-response unit case and the existing malformed-registration Playwright case passed; the full registration validation browser file also passed. This verifies the shared change did not break Registration. Page 02 remediation and acceptance were not started. APP-REG-001 was not separately investigated or remediated; its contact-number boundary case happened to run and pass as part of the authorized smoke file.

## 13. Historical Preservation Assessment

- The Phase 4 baseline identities, assertion sites, and ownership mappings remain unchanged: 292, 1,630, and 4,211 respectively.
- No immutable historical baseline, preservation ledger, original page audit, or existing Playwright identity was removed or renamed.
- The original malformed-login browser test and its assertions remain intact. One new browser identity was added for malformed account data and safe retry.
- Auth unit fixtures and negative cases were updated additively; the malformed-response rejection expectations were not weakened.

## 14. Remaining Findings

- P01-DEF-01 remains administratively deferred.
- Registration’s broader Page 02 remediation has not started. The shared APP-AUTH-001 path received cross-page regression evidence, recorded in the [defect register](../phase7.5-defect-register.md), without declaring Page 02 complete.
- The full web unit command remains unverified in this environment because its worker processes were blocked. The focused auth unit, browser, API, and static checks passed.

## 15. Administrative Decisions

The approved password-recovery deferral was followed. No further contract approval is required for P01-DEF-02: the correction enforces the existing `Account`/`publicUser` response contract. This report makes no Page 02, N2, or Phase 8 decision.

## 16. Final Page Status

**PAGE 01 REMEDIATION COMPLETE WITH ACCEPTED DEFERRED FUNCTIONALITY.** P01-DEF-02 is verified fixed based on targeted unit, browser, API DTO, and static-check evidence. P01-DEF-01 remains deferred exactly as approved.

## 17. Recommended Next Step

Stop for administrative review of this Page 01 report and the append-only defect-register checkpoint. After review, Page 02 — Registration is the proposed next page. It has not been started. Phase 7.5-N2 and Phase 8 remain not started.

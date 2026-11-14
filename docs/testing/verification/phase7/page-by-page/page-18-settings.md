# Phase 7.4.1 — Page 18: Settings

**Audit status:** Complete with limitations. The Settings implementation and regression coverage were audited, five browser cases and three API cases were added, and the relevant test groups passed in controlled runs. No production defect was confirmed. A parallel cross-page run had two timeouts that did not reproduce serially or in controlled repeats. The historical migration verifier still stops at its documented PW-149 title mismatch.

## A. Overall page status

Settings provides security and session controls, workflow notification preferences, and display preferences to all authenticated portal roles. Source inspection found no confirmed application defect. Page 18 adds coverage for failed-read retry, failed-write recovery, failed session-revocation recovery, password-change error and success behavior, byte-boundary password validation, ownership protection, and responsive layouts.

Known limitations remain: preference updates replace the full preference object without optimistic concurrency; password change and session-revocation endpoints have no endpoint-specific rate limiter; the two-worker full compatibility run had pending mocked DELETE requests; and the historical verifier cannot complete its global reconciliation because of PW-149.

## B. Git baseline

- Branch: `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages`
- Initial and final HEAD: `0c00eeee8976f4997430378a5eaaaae9078e5d83`
- Baseline was clean, branch was up to date, `git diff --check` passed, and no merge was in progress.
- No application source, schema, migration, dependency, accepted test, or historical baseline artifact was changed. No commit, push, merge, rebase, reset, or branch switch was performed.

## C. Complete source inspection

The Settings route, component tree, API clients, auth context, route policy, server routes/controllers/services, middleware, password utilities, session handling, location handling, preference consumer, Prisma models, and related regression tests were inspected.

| Source                                                                                                                                  | Responsibility and interaction                                                                                    | Related coverage                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/web/src/app/(portal)/settings/page.tsx`                                                                                           | Portal route entry for Settings.                                                                                  | Settings browser specs; route-policy unit tests.                         |
| `apps/web/src/features/settings/pages/settings-page.tsx`                                                                                | Loads Settings, renders tabs, preference forms and security/session actions; owns mutation/error states.          | `settings.spec.ts`, `page-18-regression.spec.ts`.                        |
| `apps/web/src/features/settings/components/security-details.tsx`                                                                        | Current-session and device rows, password dialog, per-session and bulk sign-out controls.                         | Settings and session-revocation browser specs.                           |
| `apps/web/src/features/settings/components/password-session-choice.tsx`                                                                 | Post-password-change choice to retain sessions or sign out all devices.                                           | Session-revocation browser specs; Page 18 password case.                 |
| `apps/web/src/features/settings/components/settings-sidebar.tsx`                                                                        | Settings section shortcuts and responsive navigation.                                                             | Settings browser specs.                                                  |
| `apps/web/src/features/settings/providers/preferences-provider.tsx`                                                                     | Shared timezone/date/time formatting and workflow-notification preference context.                                | Preferences and workflow notification coverage.                          |
| `apps/web/src/features/settings/api/settings-api.ts`                                                                                    | Settings read/write and session/password request types and calls.                                                 | Settings browser and API tests.                                          |
| `apps/web/src/components/ui/password-input.tsx`; `confirmation-dialog.tsx`; `dialog.tsx`; `tabs.tsx`                                    | Shared accessible controls used by Settings; preference selects and the workflow switch are rendered in the page. | Page 18 accessibility/control assertions and existing component use.     |
| `apps/web/src/features/profile/api/profile-api.ts`                                                                                      | Self-service password-change request used by the Settings security form.                                          | Auth/password API and Settings browser suites.                           |
| `apps/web/src/features/auth/api/auth-api.ts`; `auth-errors.ts`                                                                          | Same-origin auth calls, token handling, and error presentation.                                                   | Auth unit, JWT/session, and Settings tests.                              |
| `apps/web/src/features/auth/providers/auth-provider.tsx`; `providers/account-context.tsx`; `hooks/use-account.ts`                       | Session refresh, account hydration, role context and protected-route state.                                       | JWT/session, portal regression, route-policy and Settings browser tests. |
| `apps/web/src/features/auth/components/account-menu.tsx`; `apps/web/src/components/layout/portal-layout.tsx`                            | Account navigation, logout, portal shell, and role-aware access.                                                  | Settings tests, portal regression, Billing Logs menu assertion.          |
| `apps/web/src/lib/validation.ts`; `apps/web/src/features/auth/model/roles.ts`; `apps/web/src/features/workspaces/model/route-policy.ts` | Client password validation, role model and route permission rules.                                                | Auth validation and route-policy unit tests.                             |
| `apps/api/src/features/auth/routes.ts`; `settings.controller.ts`; `settings.service.ts`                                                 | Authenticated Settings and session endpoints; owner-scoped persistence and session queries.                       | `settings.test.ts`, `settings-regression.test.ts`, auth/session suites.  |
| `apps/api/src/features/auth/auth.controller.ts`; `auth.service.ts`; `auth.repository.ts`; `auth.schema.ts`                              | Login, password change, user lookup, validation, and persistence orchestration.                                   | Auth, account-password, API-system, profile and session suites.          |
| `apps/api/src/features/auth/auth.middleware.ts`; `auth.permissions.ts`; `auth.limiter.ts`; `login-limiter.ts`                           | Session authentication, authorization, and configured rate limits.                                                | API-system, JWT/session and account-policy tests.                        |
| `apps/api/src/features/auth/auth.password.ts`; `password.ts`; `shared/password-policy.ts`; `session.ts`; `session-location.ts`          | Scrypt password hashing, validation, session issuance/refresh/revocation and approximate location.                | Auth, password, JWT/session, and location tests.                         |
| `apps/api/src/features/request-workflow/workflow.notifications.ts` and web workflow-notification consumers                              | Applies `workflowNotifications` to in-app workflow notifications.                                                 | Workflow notification and Settings coverage.                             |
| `apps/api/src/app.ts`; `apps/api/prisma/schema.prisma`                                                                                  | API mounting and `User`, `Session`, `RefreshToken` persistence model definitions.                                 | PGlite auth/settings/session suites.                                     |

The key API calls use the same-origin `/api/...` route. The web client stores bearer tokens in `sessionStorage`; it does not introduce local storage or cookie-based sessions.

## D. Functionality inventory

| Feature                                   | Availability and behavior                                                                                                                         | Persistence / navigation                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Security and active sessions              | All authenticated roles; shows current and other valid sessions, device label, approximate location and activity dates.                           | `GET /api/auth/settings`; session data is read from `Session`.                    |
| Change password                           | All authenticated roles with the profile password-change permission; verifies current password and validates the new password.                    | `POST /api/auth/change-password`; updates the authenticated user’s password hash. |
| Revoke one other session                  | All authenticated roles; confirmation precedes mutation.                                                                                          | `DELETE /api/auth/sessions/:id`; owner-scoped deletion.                           |
| Revoke other sessions                     | Supported from session security controls with confirmation.                                                                                       | `POST /api/auth/sessions/revoke-others`; current session remains.                 |
| Revoke all sessions after password change | Offered as the post-change choice; selecting No retains sessions.                                                                                 | `POST /api/auth/sessions/revoke-all`; includes the current session.               |
| Workflow notifications                    | One switch controls in-app request/project workflow updates. Security/account messages are not disabled by it.                                    | `PATCH /api/auth/settings`; consumed by backend workflow notifications.           |
| Display preferences                       | Time zone, date format and 12/24-hour time format. Shared formatter reads saved preference context.                                               | Persisted in `User.settings` JSON through `PATCH /api/auth/settings`.             |
| Account navigation                        | Profile, Settings, logout; USER additionally sees Billing Logs.                                                                                   | Account menu; Billing Logs is adjacent navigation, not a Settings section.        |
| Absent features                           | No theme control, email-notification preference, privacy configuration, preference reset button, or billing configuration is present in Settings. | No unsupported features were added or tested as if available.                     |

The Settings content is the same for USER, STAFF, ADMIN and SUPERADMIN. Department-head STAFF has no extra Settings section. A separate account-management password-reset action is not the self-service Settings password form.

## E. Interactive control inventory

| Control                                                    | Roles / initial state                                                 | Handler and API                                            | Success and failure behavior; coverage                                                                                              |
| ---------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Security, Notifications, Preferences tabs                  | All roles; Security is the initial section.                           | Tab state; no API.                                         | Changes visible section. Existing Settings tests and Page 18 responsive case.                                                       |
| Shortcut buttons for password, sessions and notifications  | All roles; focus/activate corresponding section or dialog.            | Local navigation.                                          | No mutation. Existing Settings spec.                                                                                                |
| Current/new/confirm password fields and visibility toggles | All roles; password fields masked initially.                          | Password form; confirmation is client-only.                | Error preserves entered values; reveal toggles field type. Page 18 case.                                                            |
| Update password / close controls                           | All roles; submit disabled while busy or invalid.                     | `POST /api/auth/change-password`.                          | On success opens session choice; on error shows alert and keeps inputs. Existing and Page 18 cases.                                 |
| Post-change Yes / No controls                              | After successful password change.                                     | Yes calls revoke-all; No closes without mutation.          | No preserves token/session; session choice covered by browser suite.                                                                |
| Sign out on a non-current session                          | All roles; current row has no individual sign-out action.             | Confirmation dialog, then `DELETE /api/auth/sessions/:id`. | Success removes row; failure keeps row and allows retry. Page 18 failure/retry test.                                                |
| Revoke-others / revoke-all confirmations                   | All roles where presented; confirmation prevents accidental mutation. | Corresponding POST endpoint.                               | Revoke-others keeps current; revoke-all invalidates it. Existing multi-session tests.                                               |
| Workflow updates switch and Save notifications             | All roles; initial value comes from stored preference.                | Draft state, explicit PATCH save.                          | Failure preserves draft and reports error; success updates shared preference state. Page 18 failure/retry case.                     |
| Time zone, date format, time format selects                | All roles; loaded from saved preferences.                             | Draft state, explicit Save preferences PATCH.              | Cancel restores saved draft; success updates shared formatting; failure keeps draft and surfaces error. Existing Settings coverage. |
| Cancel and Save preferences                                | Preferences section only; Save disabled when clean or busy.           | Local reset or PATCH.                                      | No separate reset-to-default control. Existing Settings coverage.                                                                   |
| Settings read retry                                        | All roles after read failure.                                         | Reissues Settings GET.                                     | Alert clears after recovery; Page 18 test.                                                                                          |
| Account menu and logout confirmation/action                | All roles; Billing Logs is USER-only.                                 | Logout endpoint and token clearing.                        | Role-specific login route; existing auth/portal tests.                                                                              |

Settings uses semantic tabs, labeled inputs and switches, alert/status roles, and accessible Radix dialogs. Dialogs support keyboard dismissal and focus management. The audit found no Settings-only mobile controls beyond responsive navigation/layout behavior.

## F. Account preferences

Defaults are `Asia/Manila`, `MM/DD/YYYY`, `12h`, and `workflowNotifications: true`. Date format is limited to `MM/DD/YYYY`, `DD/MM/YYYY`, or `YYYY-MM-DD`; time format is `12h` or `24h`. Time zone must be a nonempty string of at most 100 code units accepted by `Intl.DateTimeFormat`. Workflow notifications must be boolean. Unknown fields and invalid types are rejected. Empty/invalid stored JSON falls back to defaults.

Changes are explicit-save, not optimistic. The service replaces the full preference object in one `User.settings` JSON update. On successful save the shared preference context updates; failed saves retain the user’s draft and do not show success. Cancel is available for display preferences, not the notification toggle. Existing browser coverage exercises persistence; Page 18 adds failed-save/retry assertions. There is no version check or field-level merge, so concurrent stale drafts are effectively last-write-wins. Cross-device concurrent preference writes have no dedicated regression case.

## G. Password management

- Current password is required and limited to 1,024 UTF-8 bytes.
- New password is at least 12 JavaScript string code units and at most 1,024 UTF-8 bytes; it needs ASCII uppercase, lowercase and digit characters plus at least one character outside ASCII alphanumerics. Unicode special characters count as special. Inputs are not trimmed.
- Confirmation is checked client-side and is not sent to the API.
- Server identifies the user from authenticated session context and does not accept a target-account override. The new API test confirms `targetUserId` injection cannot redirect the update.
- Password hashes use salted scrypt (`scrypt$...`); API responses do not expose `passwordHash` or plaintext credentials.
- Incorrect current password and over-limit input leave the old credential valid. The exact 12-code-unit minimum and exact 1,024-byte Unicode maximum are accepted. After a successful change, the old password no longer authenticates and the new password does.
- Password change updates the authenticated user row. Existing sessions remain valid until the user chooses to revoke all; this behavior is verified in PGlite and browser coverage.
- No endpoint-specific `authRateLimit` is attached to change-password. This is recorded as a hardening/contract question, not a confirmed defect; a valid session and current password are still required.

## H. Active session management

`GET /api/auth/settings` returns the signed-in user’s valid, unexpired sessions ordered newest first, with ID, derived device label, nullable approximate location, creation/last-active dates, and `current`. It omits raw access/refresh tokens, token hashes, raw User-Agent and expiry internals. Device labels derive from User-Agent. Location is null unless `SESSION_GEOLOCATION=ipapi`; only public IPs are considered, the optional lookup has a 1.2-second timeout, and returned city/country values are sanitized. It is approximate, not precise tracking.

The UI marks the current session and does not offer its row-level revoke button. The response is not paginated. Preferences and session reads are fetched in parallel, so the combined response is not a transactional snapshot. Session activity is updated by auth middleware at most every five minutes.

## I. Session revocation and logout

Single-session deletion is scoped by both session ID and authenticated user ID; foreign or absent sessions return 404. Revoked sessions cannot refresh, and a deleted session’s access token fails the next protected request because middleware checks the database session. Refresh-token records cascade with their session. Refresh rotation is transactional, preventing multiple winners.

`revoke-others` preserves the current session; `revoke-all` deletes every session, including current; logout deletes the current session and clears browser token state. The API permits a user to delete their own current session by ID, while the UI hides that action and uses logout instead. Revocation actions do not use an endpoint-specific auth rate limiter. Existing API/session tests cover owner scoping, anonymous access, foreign IDs, expiry, refresh rejection and post-revocation behavior; Page 18 adds failed individual-revoke recovery.

## J. Post-password session behavior

Password change itself leaves sessions active. The follow-up dialog lets the user retain them (No) or revoke all devices (Yes). Page 18 verifies the No path leaves the session token in `sessionStorage` and sends no revoke-all call. Existing multi-browser coverage verifies session retention until the user chooses the sign-out path. API coverage independently confirms the current session remains valid immediately after password change. Revoke-all and logout are separate requests from the password update, so this is intentionally not one transaction.

## K. Authentication and authorization

| Actor/state                                     | Settings page and GET/PATCH                                                              | Password change                                   | Session operations |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------ |
| Anonymous                                       | Protected page redirects to role-appropriate login; API rejects request.                 | Rejected.                                         | Rejected.          |
| Active USER, STAFF, ADMIN, SUPERADMIN           | Allowed; operates only on own settings. Department-head status adds no Settings access.  | Allowed for own password with current credential. | Own sessions only. |
| Inactive, deleted, expired or revoked session   | Auth middleware/account lookup rejects access; Settings cannot remain usable.            | Rejected.                                         | Rejected.          |
| Foreign user/session ID or injected target user | No cross-account preference/password access; foreign session mutation returns not found. | Target ID does not redirect self-service update.  | Owner-scoped.      |

All four roles include the password-change capability and the route policy has no Settings role exclusion. Password reset for another account belongs to separately protected SUPERADMIN account management.

## L. API contract matrix

| Endpoint                                   | Auth / validation                                                                      | Operation and observed contract                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `GET /api/auth/settings`                   | Authenticated active session.                                                          | Own preferences plus safe valid-session summaries; GET failures are retriable in UI. |
| `PATCH /api/auth/settings`                 | Authenticated; strict preference object and timezone/enum/boolean validation.          | Replaces own `User.settings`; invalid values rejected.                               |
| `POST /api/auth/change-password`           | Authenticated; body `currentPassword`, `newPassword`; policy and current hash checked. | `204` on success, `400` for incorrect current/weak/malformed input; no target ID.    |
| `DELETE /api/auth/sessions/:id`            | Authenticated; owner-scoped.                                                           | `204` on deletion; foreign/missing ID is `404`.                                      |
| `POST /api/auth/sessions/revoke-others`    | Authenticated.                                                                         | Deletes other own sessions and preserves current.                                    |
| `POST /api/auth/sessions/revoke-all`       | Authenticated before deletion.                                                         | Deletes all own sessions including current; subsequent protected requests fail.      |
| `DELETE /api/auth/logout`                  | Authenticated current session.                                                         | Deletes current session; client clears both tokens and navigates to login.           |
| `GET /api/request-workflows/notifications` | Authenticated workflow read.                                                           | Returns no workflow notifications when the stored workflow toggle is disabled.       |

Settings controller derives ownership from auth context; Settings has no account-ID parameter. No separate API exists for theme, email notifications, privacy settings, or resetting preferences.

## M. Database and transaction integrity

`User.settings` is a JSON field defaulting to `{}`. Preference persistence is a single `User.update`, atomic at the row-write level but without multi-device optimistic concurrency. Password changes are a single authenticated `User` credential update and are not combined transactionally with the optional session-revocation choice. `Session` owns refresh-token records; deleting a session cascades the linked refresh state. Session listing and user preferences are parallel reads, not one snapshot transaction. Refresh-token rotation uses a database transaction. No schema or migration change was needed.

## N. Existing regression coverage

- `apps/web/e2e/settings/settings.spec.ts`: four role cases for settings, preferences, session controls and USER-only Billing Logs visibility.
- `apps/web/e2e/settings/session-revocation.spec.ts`: multi-browser logout choice and individual revocation behavior.
- `apps/web/e2e/auth/portal-regression.spec.ts`, `jwt-session.spec.ts`, `regression.spec.ts`, and `profile/profile.spec.ts`: role routing, token refresh/clearing, registration/login and adjacent profile flows.
- API coverage in `settings.test.ts`, `api-system-regression.test.ts`, `account-policy.test.ts`, `jwt-session.test.ts`, `profile.test.ts`, `features/users/account-password.test.ts`, `features/auth/auth.test.ts`, `auth.jwt.test.ts`, and `session-location.test.ts`.
- Web unit coverage in `auth-api.test.mjs`, `auth-validation.test.mjs`, `route-policy.test.mjs`, and `workspace-selection.test.mjs`.

Historical tests and accepted assertions were not edited, skipped, or weakened.

## O. Coverage gaps and new browser tests

Added `apps/web/e2e/settings/page-18-regression.spec.ts` with five cases:

1. Failed initial Settings GET displays an accessible error and recovers with Retry.
2. Failed preference PATCH preserves the draft and retries successfully without false success.
3. Failed single-session DELETE preserves the row and retries successfully.
4. Incorrect-current-password response preserves all inputs; reveal toggles work; success sends only current/new password and No retains the authenticated session.
5. Settings has no horizontal overflow at 1440, 1280, 768 and 390 px; the mobile password dialog opens and dismisses.

The new cases use deterministic API mocks and do not skip. Existing tests already cover successful preference persistence, role access, session choices and logout routes, so duplicate happy-path tests were not added.

## P. New API and unit coverage

Added `apps/api/tests/settings-regression.test.ts`, using the repository PGlite fixture and no live database. Three leaf cases verify: wrong current password and a 1,025-byte password preserve the old credential; a 1,024-byte Unicode password is accepted/hashed while the current session remains active and old login fails; and the exact 12-code-unit minimum succeeds without target-user injection changing another account.

No new unit test file was needed. The related web auth/password/route-policy/workspace unit suites were run unchanged.

## Q. Browser execution results

| Run                                                                                | Result                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New Page 18 browser spec                                                           | 5/5 passed.                                                                                                                                                                                               |
| Existing Settings and session-revocation specs                                     | 6/6 passed.                                                                                                                                                                                               |
| Cross-page two-worker selection (Settings, auth/portal, JWT, Profile)              | 20 passed, 2 ADMIN/SUPERADMIN Settings cases timed out waiting for the other-session row to disappear. Trace shows the DELETE request pending with no mocked response recorded; confirmation stayed busy. |
| Controlled ADMIN/SUPERADMIN repeat, two workers                                    | 2/2 passed.                                                                                                                                                                                               |
| Same 22-case cross-page selection, one worker                                      | 22/22 passed.                                                                                                                                                                                             |
| Registration duplicate-email plus account-management password reset at 390/1280 px | 3/3 passed.                                                                                                                                                                                               |

Playwright ran against the production standalone web server at `127.0.0.1:5273`; API routes were mocked. Next compilation and TypeScript succeeded, but the standalone packaging helper stalled during static asset copy; assets were copied manually and the standalone server served the test runs. This is recorded in `web-build.log` and `web-server-preparation.log`.

## R. API and unit execution results

- New PGlite Settings password cases: 3/3 leaf cases passed (4 TAP records including parent).
- Selected auth/Settings/password/session/location/profile API suite: 34 leaf cases passed (38 TAP records including parents).
- Selected web auth/password validation/route-policy/workspace unit suite: 34/34 passed after rerunning outside the sandbox due to Node test-runner `spawn EPERM`.
- Existing PGlite fixture emitted `pg` concurrent-query deprecation warnings; no case failed.

## S. Cross-page compatibility

Login token refresh/logout, role-aware Settings navigation, protected workload routing, Profile at desktop/mobile, registration conflict handling, SUPERADMIN account password reset, and USER Billing Logs navigation were exercised. The serial 22-case suite and the focused 3-case registration/account run passed. Employee account access is not a Settings feature; no Settings access path bypassing the account/auth context was found. The 2-worker timeout is limited to the full mixed workload and is classified below.

## T. Defect register

| ID      | Classification                                        | Finding / status                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P18-001 | Flaky / inconclusive                                  | Two ADMIN/SUPERADMIN legacy Settings cases timed out in the 22-case two-worker mixed run while waiting for a mocked session DELETE to complete. The network trace shows no response/route fulfillment. The same complete selection passed 22/22 serially; a controlled two-worker ADMIN/SUPERADMIN repeat passed 2/2; the existing Settings selection passed 6/6. Most consistent with load-sensitive Playwright/mock scheduling, but root cause is not proven. No accepted test was altered. |
| P18-002 | Contract question / hardening                         | No endpoint-specific auth rate limiter is attached to password-change or session-revocation routes. No product requirement or expected threshold was found, so this is not classified as a confirmed defect.                                                                                                                                                                                                                                                                                  |
| P18-003 | Intentional limitation unless concurrency is required | Preference PATCH replaces the whole object and has no version check; concurrent stale drafts can overwrite one another. No conflict-handling contract or test exists.                                                                                                                                                                                                                                                                                                                         |

No Settings application defect was confirmed. A prior combined Page 17 ADMIN timeout was at the accepted spec’s deferred password-change mock/poll (`settings.spec.ts` around line 280). The Page 18 mixed-run timeout occurred earlier in the session-revocation portion (around line 154), so it is not the same failure stage. Both roles passed repeated controlled and serial checks.

## U. Contract questions and limitations

- Should password change and session-revocation mutations have dedicated rate limits in addition to requiring an authenticated session/current password?
- Should preference writes merge per field or detect stale concurrent writes, or is last-write-wins the desired contract?
- Should direct API callers be allowed to revoke their current session with `DELETE /sessions/:id`, given the UI only exposes logout for that session?
- Session summaries are unpaginated and location is approximate/optional. No pagination or precise-location setting exists.
- No test covered logging out while a Settings mutation is in flight; this remains an unverified interaction.
- The web build wrapper did not exit cleanly because packaging stalled after successful compile; production standalone serving and browser tests did succeed after manual asset placement.

## V. Historical regression preservation

Initial Playwright discovery was **494 tests in 68 files**. Final discovery is **499 tests in 69 files**, exactly the five Page 18 cases in one new spec. The three API cases do not change Playwright discovery. Only two new test files and this report are added; no historical spec, assertion, fixture, or baseline artifact changed. No new skips or duplicate browser identities were introduced.

The immutable Phase 4 inventory remains 292 identities, 1,630 assertion sites and 4,211 mappings, including five intentional live-backend skips. The verifier was rerun and stops at the documented PW-149 missing exact title `duplicate email registration displays inline server error alert`; the current equivalent is `duplicate email registration displays server conflict feedback`. It reported no duplicates or unexpected identities. Its output is `historical-verifier.log`, artifact `test-results/phase4-verification/discovery-peEjQJ`. The known PW-037/PW-001 redirect declaration discrepancies remain recorded in prior accepted reports and were not changed. Findings and unresolved defects recorded in earlier Page 1–17 reports were left untouched and are not claimed resolved by this Settings audit. A clean global identity/assertion/mapping reconciliation is therefore not claimed.

## W. Quality gates and modified files

Required quality gates all passed with exit code 0: `pnpm format`, `pnpm lint`, and `pnpm typecheck`. Final `git diff --check` also passed. Their logs are `quality-format-final.log`, `quality-lint-final.log`, and `quality-typecheck-final.log` in the Page 18 evidence directory. The only authorized workspace additions are:

- `apps/web/e2e/settings/page-18-regression.spec.ts`
- `apps/api/tests/settings-regression.test.ts`
- `docs/testing/verification/phase7/page-by-page/page-18-settings.md`

No production source was changed.

## X. Final recommendation

**Complete with accepted limitations.** Settings behavior, role/ownership boundaries, password rules, persistence and session contracts were inspected; targeted browser, PGlite API and unit coverage passed; cross-page compatibility passed serially; and the Page 17 ADMIN timeout was reassessed. No confirmed application defect remains from this audit. Track P18-001 as an unresolved parallel-load flake and P18-002/P18-003 as contract decisions. The legacy verifier’s known PW-149/PW-037/PW-001 limitations remain explicit.

Evidence is stored under `test-results/phase7/page-by-page/page-18-settings/` (logs, traces, screenshots and browser output). No commit was created.

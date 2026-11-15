# Client creation permission separation (Phase 4B.3)

Developed: 2026-11-15

## Audit and implemented authorization

This phase resolves the permission-design concern in [Phase 4A finding A03](superadmin-comprehensive-authorization-audit.md#a03--client-creation-still-uses-a-read-permission-as-write-authority). The current working tree, Phase 4B.1–4B.2 changes, fixed-role permission catalog, Client router/repository, form/page controls and existing tests were reviewed before changes. All previous uncommitted work is preserved.

The Client router already required an active authenticated session and `clients:read` globally. POST shared that read guard without a create-specific check; PATCH additionally required Superadmin, as did DELETE. Only Admin/Superadmin currently receive Client directory access, so A03 was a least-privilege design gap rather than an existing Staff privilege escalation.

`clients:create` is now an explicit permission in both existing catalogs. The API grants it through the existing Admin permission array, inherited by Superadmin; Staff and Client receive no new permission. No custom roles, per-account grants, permission editor or new capability abstraction was introduced.

| Surface                                              | Effective authorization after this phase                                                                                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client list, detail and related request/project GETs | Existing `requireAuth` + `clients:read`; unchanged scopes and safe DTOs.                                                                                                                          |
| `POST /api/clients`                                  | Existing authenticated/read middleware **plus** `requirePermission(Permission.CLIENTS_CREATE)` before validation or persistence. Both read and create are required.                               |
| Client PATCH/DELETE                                  | Existing authenticated/read middleware and Superadmin role guard; Admin receives no edit/delete privilege.                                                                                        |
| Client Management Create action                      | Existing `hasPermission` checks `clients:create` before rendering Create or mounting the creation dialog. Directory inspection remains available without creation authority.                      |
| Client validation/persistence                        | Unchanged: password policy/hashing, normalized unique email, contact/status validation, Serializable transaction, fixed `USER` role, safe response projection and linked-history/lifecycle rules. |

No public registration, Client onboarding, service-request workflow, account-management permission, assignment, financial decision or department authorization changed. Phase 4B.1 privacy restrictions and Phase 4B.2 observational reads remain intact.

## Tests and read-only configuration

The added API permission test checks that only Admin and Superadmin map to `clients:create`. An isolated native Node child enables module mocking for a test-only catalog with that permission withheld while retaining `clients:read`. It loads the real authenticated Express endpoints and uses the existing offline PGlite harness. Both management roles can still read Client lists, details and related records, but direct POST—including forged permission/role query and header claims—returns 403 with no inserted account. Restoring the ordinary catalog in that same isolated process allows the same authenticated sessions to create Clients; submitted `SUPERADMIN` values still produce `USER` accounts.

The test changes no production permission configuration. The wrapper explicitly removes Node's inherited test-worker marker and asserts that the child reports an executed passing test, avoiding a false pass from a skipped nested runner. An initial launcher run exposed that inherited-marker behavior; it is not counted as endpoint validation. The final executed child verifies the actual direct-API boundary. Initial catalog/unit tests failed against the missing permission before implementation.

Existing `client-integration.test.ts` retains Admin/Superadmin creation, Staff/Client denial, weak-password/contact rejection, duplicate-account handling, fixed role, credential exclusion, unchanged edit/delete privileges, linked records and lifecycle coverage. The fixed-role expectation test adds only the new intended permission. Web units verify read and create are independent. New browser tests cover both management roles with read-only permissions, ordinary Create access and backend-denied creation preserving form input. Existing creation/conflict browser fixtures now supply the explicit permission they require; no assertion is weakened.

## Changed files

- `apps/api/src/features/auth/auth.permissions.ts`: create permission constant and Admin/Superadmin mapping.
- `apps/api/src/features/clients/clients.controller.ts`: POST-specific permission middleware; existing PATCH/DELETE/read behavior retained.
- `apps/web/src/features/auth/model/permissions.ts`: matching permission constant.
- `apps/web/src/features/clients/pages/client-management-page.tsx`: Create button and dialog permission checks through existing account context/utilities.
- `apps/api/tests/features/auth/client-create-permission.test.ts`, `apps/api/tests/support/client-create-readonly.ts`: mapping and isolated real-API read-only tests.
- `apps/api/tests/features/users/role-policy.test.ts`: expected fixed-role mapping.
- `apps/web/test/client-management-access.test.mjs`: independent permission coverage.
- `apps/web/e2e/client-create-permission.spec.ts`: new UI authorization and backend-denial regressions.
- `apps/web/e2e/client-mutations.spec.ts`, `apps/web/e2e/regression-support.ts`: authorized creator fixture permissions.
- `docs/rbac.md`, `docs/features/client-management.md`, `docs/features/module-role-access.md`, the feature index and this report: current contracts and implementation record. Stale Client documentation that excluded Superadmin was corrected to match the already implemented access.

## Validation

| Check                                    | Result                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm format` and final formatting check | PASS, exit 0                                                              |
| `pnpm lint`                              | PASS, exit 0, zero warnings                                               |
| `pnpm typecheck`                         | PASS, exit 0; API/web including tests                                     |
| `pnpm build`                             | PASS, exit 0; API and production standalone web                           |
| `pnpm test:api`                          | PASS, exit 0; all 305 runner-counted tests passed, none skipped/cancelled |
| `pnpm test:web`                          | PASS, exit 0; all 108 web unit tests passed, none skipped/cancelled       |
| Selected Chromium regressions            | 36 passed, 4 pre-existing failures, none skipped; exit 1                  |
| `git diff --check`                       | PASS                                                                      |

The full API run includes the two new permission tests. The second starts and verifies one additional isolated child-process integration test; that child is not added again to the parent runner's 305 count. The child is confirmed executed rather than merely launched. Existing Client create/read/related-record/edit/delete and duplicate/password/lifecycle tests, plus Department, Employee, account and workflow regressions, all passed. No required test was blocked. All backend integration data is offline PGlite; no live database was used.

The 40 selected browser cases covered the six new permission tests, existing desktop/mobile creation validation and conflict retries, Client directory role restrictions, module access and scoped navigation. All new permission and creation tests passed. The four failures are unchanged `apps/web/e2e/clients.spec.ts:61` and `:156`, each at 1280px and 390px. They expect the old heading `Service request submitted for review` to receive focus; the existing success page uses `Request submitted`. These are the same onboarding heading-contract failures recorded in Phase 4A. The spec, success-page source and onboarding workflow were not changed, and no fix is claimed for assertions after those early failures. The full browser backlog and live-account suite were not rerun. Browser API contracts are mocked; the separate direct API test establishes backend enforcement.

Existing `pg` concurrent-query deprecation warnings are non-failing. Native Node module mocking is enabled only for the isolated read-only child; production code and the regular test launcher gain no override hook. The previously documented raw `tsx` host restriction did not block the recovered compiler/native Node test paths and was not retested or changed.

Before/after source/test hashes show changes only in the four production files and four existing test/fixture files listed above, plus the three new test files. Department and unrelated source/test files match their start-of-phase hashes. Logs are under ignored `.ci-tools/phase4b3-{red,web-red,permission-config,focused,format,format-final,lint,typecheck,build,api,web-unit,browser}.log`, with browser failure traces in `.ci-tools/phase4b3-browser-artifacts/`.

## Remaining scope

Client PATCH/DELETE retain their existing Superadmin-only policy. This phase adds no editing interface or permission and does not change public signup. Administrative mutation attribution (A04), the existing broader browser backlog, Diagnostics and System Logs remain separate work. Stop after Phase 4B.3.

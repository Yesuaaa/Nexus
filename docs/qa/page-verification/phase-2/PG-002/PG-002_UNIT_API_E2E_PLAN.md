# PG-002 Unit, API and Browser Plan

**Stage:** Future implementation plan only. Do not treat these commands as run.  
**Scope:** PG-002 tests only; existing tests remain intact.  
**Baseline:** e983bc46cb8b4e8c71238af3158899ea02efae79.

## Proposed test files

| File                                                             | Planned purpose                                                                                                                                                                                                                  |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/api/tests/features/users/account-list.test.ts               | New PGlite/Express suite for A001 users-list filter, sort, pagination, Trash separation, invalid query and public DTO contract. This is additive API case T001.                                                                  |
| apps/web/test/account-management-access.test.mjs                 | Preserve the current three unit declarations. Add no unit case unless future work exposes a pure helper that is already a stable feature contract; do not export private page functions just to manufacture a unit target.       |
| apps/web/e2e/accounts/account-management-regression.spec.ts      | Add the A001/A002 route, response, empty-state, view-toggle, sorting and search-race cases T002–T007, plus mutation UI gaps T012–T015 where they fit the deterministic regression suite. Keep NEX-019 through NEX-023 unchanged. |
| apps/web/e2e/accounts/account-creation.spec.ts                   | Add name/contact boundary and repeated-submit cases T008–T009. Preserve NEX-002 success and server-error retry assertions.                                                                                                       |
| apps/web/e2e/accounts/account-profile-edit.spec.ts               | Recommended focused new browser file for T011: save full profile and role payload, surface a failed response, retry and confirm the refreshed row.                                                                               |
| apps/web/e2e/accounts/account-management-api.integration.spec.ts | Proposed T010 only after an isolated launcher can point the real Next proxy at an Express server backed by fresh PGlite. The current account browser fixture mocks requests and does not provide this cross-layer setup.         |

## Reusable fixtures and mocks

- API tests: use apps/api/tests/support/pglite-app.ts and startPgliteApp(t); issue real sessions; use unique users and departments/teams per fixture; assert only isolated PGlite persistence. Never use the configured development database.
- Browser tests: use configureRegressionTest, restoreSession, accountFor and semantic Playwright locators from apps/web/e2e/regression-support.ts. Intercept only the relevant same-origin /api/users call. For concurrency cases, hold one response and release it deterministically.
- Integration test: create a separate setup that provisions a temporary PGlite-backed Express instance and launches Next with API_PROXY_TARGET directed to that instance. It must also issue a valid isolated SUPERADMIN session. The current Playwright webServer starts Next independently, so this fixture/launcher is a prerequisite; no live API target or saved user account may be used.
- Contract clarification T003 is not included in an executable plan until the user-facing 401/403 destinations are confirmed.

## Layer allocation

| Layer       | Coverage plan                                                                                                                                                                                                         | New case count |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------: |
| Unit        | Keep three current access/password eligibility tests and API role-policy helper tests; no new pure unit case is justified by the uncovered behaviors.                                                                 |              0 |
| API         | PGlite-backed list query contract and projection. Existing PGlite suites continue to own edit, password, status, archive, restore, permanent deletion, authorization, history and rollback.                           |              1 |
| Browser     | Direct route/access behavior, list error/empty/query state, create boundaries and pending state, complete profile edit recovery, status pending state, soft-delete retry and permanent-delete conflict/pending state. |             12 |
| Integration | Browser create through actual Next same-origin proxy to Express/PGlite, then verify persisted data after reload.                                                                                                      |              1 |

## Focused execution commands for the implementation stage

These commands are planned for the authorized test-implementation stage and have not been run here:

1. API list case: pnpm --filter @nexus/api test -- tests/features/users/account-list.test.ts
2. Related API regression preservation: pnpm --filter @nexus/api test -- tests/features/users/account-edit.test.ts tests/features/users/account-password.test.ts tests/features/users/account-restore.test.ts tests/features/users/account-status.test.ts tests/features/users/account-attribution.test.ts tests/features/users/role-policy.test.ts tests/features/users/role-leadership.test.ts
3. Browser account cases: pnpm --filter @nexus/web test:e2e -- accounts/account-creation.spec.ts accounts/account-management-regression.spec.ts accounts/account-profile-edit.spec.ts
4. Integration case: use a dedicated isolated integration launcher/config to start Next and the PGlite-backed API together, then run account-management-api.integration.spec.ts. The current standard mocked browser command alone is not sufficient evidence for real proxy/API integration.
5. Web unit preservation: pnpm --filter @nexus/web test
6. Mandatory repository gates after implementation: pnpm format, pnpm lint, pnpm typecheck.

Do not set live E2E mode or use real accounts for these deterministic tests. Do not run migrations, seeds or database operations against a configured live/development database.

## Regression-preservation and quality procedure

1. Keep every existing assertion listed in the preservation ledger.
2. Add cases without changing existing expected values to make new tests pass.
3. Confirm the account API test fixture uses PGlite and starts an ephemeral Express server; do not treat the legacy mocked-delegate account-status suite as persistence proof.
4. Verify the browser list mocks preserve the actual response shape and inspect method, path, query and request body.
5. Run focused API and browser commands, then the mandated format/lint/typecheck gates.
6. Review git diff and test reports; record execution results separately from the current design artifacts.

## Known implementation risks

- T003 cannot become an acceptance test until role-specific list 401/403 navigation is resolved.
- T010 depends on a separate offline browser-to-API harness; the existing E2E README explicitly separates mocked browser tests and PGlite API tests.
- Create UI and API/edit rules differ on name and phone validation; resolve C1 before adding API-level expectations for those characters or number formats.
- Full Account Management mutation history and permanent-delete workforce effects involve transactions. Preserve the PGlite rollback and referential-integrity cases while adding browser mocks.
- The existing account-status API test mocks Prisma delegates. New API list coverage and any persistence extension must use PGlite per repository guidance.

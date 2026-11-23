# PG-002 Regression Preservation

**Baseline:** branch 293-test-full-system-audit-for-verifying-recent-changes, HEAD e983bc46cb8b4e8c71238af3158899ea02efae79.  
**Task-entry worktree:** contained pre-existing untracked PHASE_2_PROGRESS_LEDGER.md and the seven Phase 2.1 PG-002 design records; no tracked changes were present. Those files were preserved, and the seven design records were not edited.

## Existing tests inspected and preserved

### Web unit — 3 declarations

File: apps/web/test/account-management-access.test.mjs

- account management is limited to the Superadmin role
- a Superadmin still requires the account read permission
- changing listed account passwords requires Superadmin permission and another non-deleted account

Pre-edit execution: 3/3 passed with:

pnpm --filter @nexus/web exec node --experimental-strip-types --test test/account-management-access.test.mjs

Post-implementation execution: same 3 declarations passed. The file was not modified.

### API — 22 declarations across 7 files

| Existing file                                             | Declarations and retained assertions                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| apps/api/tests/features/users/account-attribution.test.ts | Parent all Account Management mutations attribute the authenticated actor atomically, with seven nested transaction/history/authorization/lifecycle cases. Assertions cover actual actor attribution, no-op behavior, validation, rollback of records and sessions, deletion/workforce history effects, stale guards, and retention of attribution for a former administrator. |
| apps/api/tests/features/users/account-edit.test.ts        | account edits enforce authority, validation and atomic role/profile history; covers authorization, profile/role payloads, duplicate email, record state, and atomic history.                                                                                                                                                                                                   |
| apps/api/tests/features/users/account-password.test.ts    | only Superadmins can change other account passwords and revoke their sessions; covers authorization, password change, and session revocation.                                                                                                                                                                                                                                  |
| apps/api/tests/features/users/account-restore.test.ts     | Superadmins restore trashed accounts as inactive while preserving their records; covers role/state restrictions, persistence, membership in active/Trash lists, and DTO redaction.                                                                                                                                                                                             |
| apps/api/tests/features/users/account-status.test.ts      | account status, deletion, and authentication enforce access; legacy mocked-Prisma Express test, not treated as persistence proof.                                                                                                                                                                                                                                              |
| apps/api/tests/features/users/role-policy.test.ts         | Six declarations covering fixed role permissions, permission and role middleware, assignment hierarchy, creation hierarchy, and status hierarchy.                                                                                                                                                                                                                              |
| apps/api/tests/features/users/role-leadership.test.ts     | Parent role changes cannot strand department heads or team leads outside STAFF, with three nested head/lead and reassignment cases.                                                                                                                                                                                                                                            |

Pre-edit execution ran the seven files above and passed 22/22. The same seven files were included unchanged in the final API command; all 22 retained declarations passed again. One additive file, account-list.test.ts, raised the final focused API total to 23/23.

### Playwright — 14 instantiated cases

| Existing file                                               | Existing IDs / declarations and assertion sites                                                                                                                                                                                                                                     |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/web/e2e/accounts/account-creation.spec.ts              | [NEX-002] SUPERADMIN creates an account and sees validation and API errors; auth/body assertions around lines 24–57 and success/required/error/retry assertions around lines 59–111.                                                                                                |
| apps/web/e2e/accounts/account-management-regression.spec.ts | [NEX-019] role filtering/member sorting/pagination and query assertions (11–116); [NEX-020] list failure/retry (118–182); [NEX-021] invalid create fields (184–241); [NEX-022] role/status failure retry (242–341); [NEX-023] canceled mutation confirmations (342–428).            |
| apps/web/e2e/accounts/superadmin.spec.ts                    | Eight instantiated cases: search preview; password change at 390px and 1280px; self-role/status restriction; role/status success; restore at 390px and 1280px; soft and permanent deletion. The suite contains a live-mode skip guard; it was inactive in these deterministic runs. |

Pre-edit execution passed all 14 with:

pnpm --filter @nexus/web test:e2e -- accounts/account-creation.spec.ts accounts/account-management-regression.spec.ts accounts/superadmin.spec.ts

No existing test file, test ID, fixture behavior, skip condition, expected value, or assertion was edited, removed, weakened, or overwritten. The final 3-worker command ran the same 14 plus the 12 additive browser declarations and passed 26/26. A previous 6-worker run had one transient timeout in the existing 1280px password-toast assertion; that assertion passed in isolation and in the final 3-worker run.

## Additive files and shared infrastructure

- apps/api/tests/features/users/account-list.test.ts: adds one test using the existing startPgliteApp(t) harness, migrations, ephemeral Express port, and isolated PGlite database.
- apps/web/e2e/accounts/pg002-account-management.spec.ts: adds 12 browser cases; does not alter regression-support.ts or existing NEX IDs.
- apps/api/tests/support/pg002-browser-fixture.ts: isolated fixture process for the cross-layer test; existing pglite-app.ts remains unchanged.
- apps/web/playwright.pg002-integration.config.ts and apps/web/e2e/accounts/pg002-integration.spec.ts: dedicated local integration setup and one test. The state-inspection endpoint is a separate loopback-only fixture server, not an Express production route.

No production application, API, Prisma schema, migration, package script, or existing test source was changed. Next build/typegen rewrote the tracked apps/web/next-env.d.ts imports to .next/types; that generated-only change was restored to the entry contents before handoff.

## Execution preservation summary

| Suite                             | Before implementation |                              Final focused run |
| --------------------------------- | --------------------: | ---------------------------------------------: |
| Existing API declarations         |             22 passed |           22 passed, included in 23 API passes |
| Existing web unit declarations    |              3 passed |                                       3 passed |
| Existing account Playwright cases |             14 passed |       14 passed, included in 26 browser passes |
| New PG-002 cases                  |           Not present | 14 passed across API, browser, and integration |

Exact invocations and the transient test-only attempts are recorded in PG-002_TEST_EXECUTION_RESULTS.md.

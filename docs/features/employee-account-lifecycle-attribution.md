# Employee account lifecycle actor attribution — Phase 4B.4B.3B

Developed: 2026-11-15.

The four existing Employee login lifecycle routes now retain the authenticated administrator responsible for material account and workforce effects. All four scoped routes are integrated; none is deferred. This follows the [attribution audit](administrative-mutation-attribution-audit.md), [persistence foundation](administrative-attribution-persistence-foundation.md), [Account integration](account-management-actor-attribution.md), and [Client integration](client-management-actor-attribution.md).

This phase does not integrate general Employee creation/profile/status/assignment or Department Head management endpoints. Existing HR validation, synchronization, eligibility, leadership rules, permissions, schema/migrations and frontend contracts remain unchanged. There is no history API/UI, Diagnostics or centralized System Logs.

## Endpoint coverage

Every route retains authentication and `employees:manage`, currently Admin/Superadmin. Staff, Department Heads and Clients gain no management grant. The actor does not need an Employee or Department Head identity; Superadmin is never given one automatically.

| Endpoint                                      | Account history, `EMPLOYEE_MANAGEMENT` origin                                                | Workforce effects and preserved behavior                                                                                                                                                                                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/employees/:id/account`             | `CREATED` with database-read Staff role and active status; approved profile field names only | Existing `createStaffAccount` + `updateEmployee` transaction is retained. Records the actual Employee `userId` link and any actual department/team delta, plus initial membership of the new login where present. Does not claim a new Employee was created |
| `PATCH /api/employees/:id/account/status`     | `STATUS_CHANGED` using observed before and database-read after, with revocation completion   | Staff login only, non-retired and never the actor's own. Employee HR status/assignments do not change. Repeated disable records revocation completion only; identical active activation records no false transition                                         |
| `DELETE /api/employees/:id/account`           | `ARCHIVED` with actual retirement timestamp and revocation completion                        | Requires inactive, non-retired Staff login, never self. Employee link, HR fields and assignments remain intact. No inactive-to-inactive status transition is fabricated                                                                                     |
| `DELETE /api/employees/:id/account/permanent` | `DELETED` with retained account snapshot ID and empty changes                                | Requires inactive archived Staff login, never self. Records actual Employee unlinking, removed login membership, and existing head/temporary-head/team-lead FK clearing. Existing related-history restrictions still block deletion                         |

Login lifecycle still accepts the existing virtual `account:<userId>` directory IDs even without an Employee profile. Provisioning still requires a real existing Employee without a linked account. Virtual rows do not acquire fabricated Employee records. Admin credentials must still use Account Management; no Admin or Superadmin login becomes a manageable Staff target through this phase.

## Trusted actor and transaction integration

Provisioning creates its operation from `request.auth` after the existing password validation. The status/removal services now receive the backend `AuthContext` rather than only an actor ID, derive one operation with `createManagementOperation`, and use its actual account ID for the existing self checks. Role at authentication and operation UUID come from that frozen backend operation, never HTTP body/query/header attribution claims. Returned IDs and status are read from the database.

Account and workforce history share that operation inside the existing Serializable business transaction. Existing public responses remain unchanged: provisioning returns the existing safe Employee DTO with `hasAccount`/`accountIsActive`; status/archive/permanent deletion return 204. Existing password policy, email requirement/duplicates, already-linked and archived-login provisioning denial, role restrictions, lifecycle ordering, foreign-key errors and conflict responses remain.

Status/archive/delete use the existing shared lifecycle helpers. Their conditional guards now explicitly match the Staff/active/retirement state already checked by the service; a failed conditional write reports the existing Employee conflict wording and writes no success history. No lifecycle implementation is duplicated, no retry is introduced and no underlying business rule is broadened.

The existing deletion-effect recorder is reused with an explicit origin argument limited to `ACCOUNT_MANAGEMENT` or `EMPLOYEE_MANAGEMENT`. Its default remains `ACCOUNT_MANAGEMENT`, so existing Account callers and records retain their behavior. Read snapshots, locks, FK effects and history allowlists are not redesigned. Only history origin propagates into the existing Employee/Department/Team effect records when the Employee login deletion route calls it.

## Accurate workforce effects and privacy

Provisioning compares the existing Employee with the database-returned result of the existing link service. It records only actual approved ID changes. The initial login's department/team membership is recorded separately from the Employee's existing assignment, with `affectedAccountId` identifying the login. It does not claim a new HR assignment or change HR status merely because credentials were provisioned. The existing behavior of login activation versus HR `Employee.status` remains separate.

Permanent deletion uses the same in-transaction snapshot/recorder already used by Account Management. It captures Employee `userId` changing to null, physical login membership removal, Department head/original/assigned reference clearing and Team lead clearing caused by existing `SetNull` relationships. The Employee retains its department/team, HR status and title unless the database actually changed them. No replacement Head, staffing action, status handoff, title cleanup or general Department mutation is introduced. Collateral FK effects of these scoped deletions are attributed; unrelated management routes remain unintegrated.

History contains approved IDs, fixed roles/state, lifecycle timestamps and field names. Passwords, hashes, salts, tokens, personal names/contact values/titles and unrestricted record snapshots never enter history payloads. Existing action-specific writers enforce their allowlists unchanged. `sessionsRevoked: true` means the existing revocation step completed, including when there were zero stale sessions; it does not imply a positive count. Personal fields appear only as changed field names in account creation metadata.

If an account history insert fails, all corresponding business changes, links and session/refresh-token revocations roll back. If a workforce history insert fails, the account history and any earlier workforce events also roll back. Tests force the final team-lead history insert to fail after earlier deletion effects/events, verifying there is no partial deletion or history group. Denied, invalid, duplicate, missing, related-history-blocked and failed operations leave no success history.

Attribution retains scalar actor/subject identities after deletion of either account. Existing business-history foreign keys keep their deletion protection. No new identity, permission, model, migration, backfill or synthetic actor is introduced.

## Changed files

- `apps/api/src/features/employees/employees.controller.ts`: scoped provisioning history and authenticated context for the three lifecycle commands; general Employee handlers remain unchanged.
- `apps/api/src/features/employees/employees.service.ts`: context-derived lifecycle attribution using existing helpers and transactions; generic Employee write/synchronization/leadership logic remains unchanged.
- `apps/api/src/features/users/account-workforce-history.ts`: optional closed origin for the existing deletion recorder and its private Employee effect writer, with the previous Account origin as default. No Account transaction or business behavior changes.
- New `apps/api/tests/features/employees/account-lifecycle-attribution.test.ts`: offline authenticated endpoint, privacy, rollback, retention, concurrency and origin regression tests.
- This feature record, its index link, and the dated Employee Management documentation note.

No existing test, Account controller/service/repository, Client code, authorization catalog, lifecycle utility, schema/migration, or frontend source is modified. Unrelated uncommitted changes are preserved.

## Validation

| Executed check                               | Result                                                                                                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Missing-attribution reproduction             | Confirmed failing before implementation                                                                                                                                                                |
| Focused Employee lifecycle attribution suite | PASS, exit 0; all 8 tests                                                                                                                                                                              |
| `pnpm format` and final `pnpm format:check`  | PASS, exit 0                                                                                                                                                                                           |
| `pnpm lint`                                  | PASS, exit 0; zero warnings                                                                                                                                                                            |
| `pnpm typecheck`                             | PASS, exit 0; API/web and tests                                                                                                                                                                        |
| `pnpm build`                                 | PASS, exit 0; API and production standalone web                                                                                                                                                        |
| `pnpm test:api`                              | PASS, exit 0; all 339 tests, none failed/skipped/cancelled                                                                                                                                             |
| `pnpm test:web`                              | PASS, exit 0; 108 unit tests, none failed/skipped/cancelled                                                                                                                                            |
| Selected Chromium regressions                | PASS, exit 0; 27 tests, none failed/skipped                                                                                                                                                            |
| `git diff --check`                           | PASS                                                                                                                                                                                                   |
| Start-of-phase preservation                  | Of 783 existing source/schema/migration/test/documentation files, only the five intended existing files listed above changed; the new lifecycle test and this report are the two new deliverable files |

The new suite first failed on missing history before implementation. An initial fixture used an already-archived Admin target while expecting the normal Staff-target denial; it was corrected to test the intended branch. The existing archived-account error precedence was preserved and separately asserted. Forced history insert failures intentionally produce API 500 log entries; assertions verify complete rollback. They are expected fault-injection output, not unresolved regressions. Existing non-failing `pg` concurrent-query deprecation warnings remain.

The eight new tests (parent plus seven subtests) cover distinct Admin/Superadmin provisioning; forged attribution/role/profile values; existing HR state retention; no automatic Superadmin Employee identity; truthful status no-ops and session revocation; archival; permanent Employee unlinking and all existing FK effects; virtual logins; self/role/permission/status/linked-history/validation denials; account and late-workforce history failure rollback; overlapping provisioning/deletion; secret/profile exclusion; retention after target and administrator deletion; and unchanged Account/Client origins.

The standard offline harness uses a single pool connection. Overlapping HTTP requests and transaction/stale-state assertions do not prove independent PostgreSQL-backend contention or every production deadlock/SSI scenario. Existing Serializable transactions, guards and lock ordering are retained; failed conflicts create no committed success history. Actor role remains the request-authentication snapshot rather than a new transaction-time reauthorization policy. No live database is queried, migrated, seeded or repaired.

The full 339-test run includes the eight new tests, existing Account and Client attribution suites, original Employee integration tests, authorization and leadership checks, and all other backend regressions. Counts are not added again for focused runs or the existing isolated read-only Client-permission child assertion. The compiler/native Node runner executes successfully; raw `tsx` startup was not retested. No required check was blocked.

The 27 selected browser cases are `apps/web/e2e/{employee-login,superadmin-people-hr,staff,superadmin,client-mutations,client-create-permission}.spec.ts`, run with two workers against the local production web build. They cover desktop/mobile Employee login controls, HR permission/identity boundaries, role navigation, Account mutations and Client creation/permission regressions. They use existing mocked API contracts; independent real authenticated Express/PGlite tests verify persistence and backend security. No frontend or browser spec was changed. The temporary server was stopped after the run.

No new regression remains in executed checks. The four unrelated Client onboarding heading failures documented in [Phase 4B.4B.3A](client-management-actor-attribution.md#validation) and the broader [Phase 4A browser backlog](superadmin-comprehensive-authorization-audit.md#full-browser-failures-and-classification) were not selected, modified or claimed resolved. No unrelated workflow or assertion was changed to obtain a pass. Live deployment and multi-connection contention remain untested.

Evidence is retained under ignored `.ci-tools/phase4b4b3b-{red,focused,focused-final,format,format-final,lint,typecheck,build,api,web-unit,browser}.log`, `.ci-tools/phase4b4b3b-browser-artifacts/`, and the start-of-phase hash/status files. Existing tests, Client code, Account controller/service/repository, permission catalogs, shared account lifecycle helpers, schema/migrations and frontend source match their initial hashes. General Employee write/synchronization/leadership code remains unchanged; only the scoped controller handler and two lifecycle service functions gained attribution.

## Remaining boundaries

All four scoped lifecycle operations are attributed for their current material changes. General Employee record creation/profile/status/assignment, standalone Department Head/team management attribution and history viewing/export remain separate work. The existing foundation migration is required at deployment; no new migration is added or deployed here. Database-owner tamper resistance, historical backfill and multi-connection production contention testing remain outside this phase.

Stop after Phase 4B.4B.3B.

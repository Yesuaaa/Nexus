# Account Management actor attribution — Phase 4B.4B.2

Developed: 2026-11-15.

Update (2026-11-16): `PATCH /api/users/:id` supports Superadmin account edits for full name, email, contact number and role. The row-action Edit account panel replaces the inline Access column and bulk save. Profile and role updates share one transaction and operation ID; profile history stores only changed field names. Role changes retain self-role, department-head/team-lead and linked-Employee promotion guards. Trashed accounts cannot be edited. Profile edits do not overwrite existing Employee HR details or change department/team assignment. Password and active-status changes retain their separate guarded actions.

All seven existing `/api/users` mutation endpoints now persist the authenticated Superadmin responsible for material changes. They use the [Phase 4B.4B.1 foundation](administrative-attribution-persistence-foundation.md) and implement the Account Management portion of the [Phase 4B.4A design](administrative-mutation-attribution-audit.md). Account creation/role synchronization and permanent-deletion workforce effects share the root operation ID. **No Account Management endpoint is deferred or left without attribution for its current material effects.** No-op rules and concurrency test limitations are described below.

Client Management and Employee Management endpoints are not integrated. Their shared lifecycle/synchronization services retain their existing signatures and behavior. Department/Team workflows, permissions, frontend contracts, schema and migrations are unchanged. There is no new history API, history UI, Diagnostics, or centralized System Logs.

## Endpoint coverage and records

Every route retains `requireAuth`, the Superadmin role guard, existing permission middleware, target-role policy, and self-protection. Existing statuses, messages, safe response DTOs, validation and duplicate protections remain.

| Endpoint                          | Account history                                                                          | Actual effects and transaction                                                                                                                                                                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/users`                 | `CREATED`; role/isActive null-to-created values, approved profile field names only       | Existing User + Employee-sync transaction also writes history. Derived Employee creation or assignment normalization is recorded with the same operation                                                                                                                  |
| `PATCH /api/users/:id/role`       | `ROLE_CHANGED` only when the persisted role differs from the guarded prior role          | Existing target lock/conditional update and sync retained; Employee lock is acquired before User for the existing Employee → User ordering. Current head/lead, promotion and Employee restrictions remain. Actual sync effects are attributed even on a same-role request |
| `PATCH /api/users/:id/status`     | `STATUS_CHANGED` with guarded before and database-read after, plus revocation completion | Existing conditional status update/session revocation and history are atomic. The inactive-repeat case records revocation only, without a false status transition                                                                                                         |
| `POST /api/users/:id/password`    | `PASSWORD_RESET`, empty changed-field list, `sessionsRevoked: true`                      | Existing expected-hash update and all-target-session revocation share the history transaction. No password/hash/token value enters history                                                                                                                                |
| `DELETE /api/users/:id`           | `ARCHIVED`, null-to-persisted retirement timestamp and revocation completion             | Existing inactive/non-retired conditional update and session revocation are atomic with history                                                                                                                                                                           |
| `POST /api/users/:id/restore`     | `RESTORED`, guarded prior timestamp to database-read null, plus revocation completion    | Existing inactive/trashed/exact-timestamp guards remain. Account stays inactive; its HR assignments are unchanged                                                                                                                                                         |
| `DELETE /api/users/:id/permanent` | `DELETED`, empty changes and changed fields, retained subject snapshot                   | Guarded deletion, actual FK effects and both histories now share an explicit Serializable transaction. Existing related-record deletion blockers remain                                                                                                                   |

`origin` is always the closed `ACCOUNT_MANAGEMENT` value. Records store the actual actor account ID and role at authentication, affected subject, database-default creation time and server-generated operation UUID. These values are not taken from request fields, query parameters or headers other than the existing Bearer authentication flow.

## Authenticated context and safe state

The controller passes `request.auth` to each management service. Services keep their existing actor/target checks and call `createManagementOperation(auth)` after validation, before the repository mutation. The frozen operation is a required repository argument and travels into its transaction and the Account-only workforce wrappers. There is no optional actor fallback, target-as-actor substitution, fabricated Staff identity, new privilege, or client-controlled operation/timestamp.

Before role/status values come from the state checked by the existing conditional update, so a stale expected value returns conflict without history. After values are selected from the database in the same transaction. Archive time is reselected after the successful write; restore compares its exact expected retirement timestamp and reads the resulting account. Creation uses database-returned values. The root account history contains only the writer's approved role/status/lifecycle fields and profile field names.

Role/status conditional updates now also require `accountDeletedAt: null`. This carries the service's existing non-retired-target requirement into the write itself, preventing a retirement between lookup and update from being silently overwritten. It adds no permission and does not change ordinary non-racing responses.

All pre-existing self-role/status/reset/archive/restore/permanent-delete protections remain. Admin, Staff, Client, inactive and retired accounts still cannot use Account Management. The User role requested by a Superadmin during account creation remains subject to existing role policy; no Client Management fixed-role behavior is changed.

## Derived workforce attribution

The new feature-local `users/account-workforce-history.ts` wraps the existing synchronization callback and observes its actual before/after values inside the caller's transaction. It does not replace Employee business logic or add writes to other management entry points.

- New Employee records produce workforce `CREATED` history with approved status/employment-type/assignment/link transitions. Personal/profile attributes appear only as field names.
- Existing Employee department/team/account-link differences produce `ASSIGNMENT_CHANGED`. An actual synchronized position difference produces `PROFILE_UPDATED` with `position` as a changed field and no title value.
- Account assignment repairs performed by existing synchronization produce Department-scoped `ASSIGNMENT_CHANGED` metadata with the affected account ID and actual department/team transitions. This also covers a repair where the Employee assignment was already correct and only the User needed normalization.
- Account creation records any actual initial login membership from absent/null to its database-read department/team IDs. This includes authorized account creation without an Employee profile; history does not create such a profile or grant operational eligibility.
- Permanent User deletion records actual Employee `userId` unlinking, Department `headId` clearing, temporary-head original/assigned clearing, and Team `leadId` clearing caused by existing `SetNull` relationships. It neither chooses replacements nor clears additional titles or assignments.
- Deleted User department/team membership is recorded separately as account-scoped `affectedAccountId` metadata in Department assignment history, including legacy logins without an Employee profile. This does not claim the retained Employee became unassigned: its department/team IDs remain unchanged unless the database actually changed them.
- Department head and temporary tracking changes are grouped per affected Department. Team lead changes and Employee link changes identify their real subjects. All use the initiating administrator and the same operation ID as the account event.

Snapshots select only the IDs/state needed for these current effects, plus position for an in-memory equality comparison. Neither old nor new title text is persisted. No request bodies, personal names, contact values, credentials, raw User/Employee snapshots or unrestricted summaries are serialized into history. This phase does not add new synchronization/cleanup rules or automatically assign Superadmin an Employee record.

## No-op handling and writer compatibility

Unchanged role and already-active activation requests keep their existing responses and business behavior without false account transitions. A same-role request can still cause existing Employee synchronization; only its actual workforce changes are then recorded. Timestamp-only updates are not treated as material domain changes.

Repeated disable commands still execute the existing session-revocation step, including removal of stale sessions. They record `STATUS_CHANGED` with `changedFields: []` and `{ sessionsRevoked: true }`; that boolean means the revocation step completed, not that a previously active status or a positive session count was observed. Ordinary activation records `sessionsRevoked: false`. Password reset is a completed credential operation even if the caller chose the same plaintext password; only completion is recorded.

Two existing writer contracts needed small corrections; no persistence/schema change was required:

1. `STATUS_CHANGED.isActive` is optional for revocation-only completion. A record without an active transition is rejected unless revocation is true. Unknown/credential fields remain rejected.
2. `TEMPORARY_HEAD_CHANGED` accepts the actual changed tracking fields, requiring at least one original/assigned transition. Clearing only an original or assigned reference no longer forces an unchanged-field transition. Existing both-field payloads remain valid.

## Transaction and concurrency guarantees

Creation, role, status, reset, archive and restore continue using their existing business transactions. Permanent deletion gains an explicit Serializable transaction around the guarded delete, Account event, and derived workforce events. Any thrown history error rolls back the entire transaction, including User/Employee changes, FK effects and session/refresh-token revocations. Failed validation, authorization, missing target, linked-history denial and zero-row stale guards create no committed success history.

Role synchronization observes Employee state while the existing target locks are held. Permanent deletion reads affected departments, locks their IDs in sorted order, then locks Employee/User using the existing lock utilities. Team IDs and other FK effects are observed within the same Serializable snapshot. No new lockable-table abstraction or Team locking API is introduced. Concurrent changes that invalidate this transaction must abort rather than leave partial history; existing Prisma conflict handling returns 409. No automatic retry or exactly-once HTTP behavior is added.

The new offline tests exercise stale guards and overlapping HTTP role requests. The standard PGlite fixture uses a one-connection pool, so this is not proof of independent PostgreSQL-backend SSI/deadlock behavior under production contention. No live database or multi-user load test was used. Serializable protection and existing conditional guards are implemented; multi-connection production contention remains an explicit validation limit rather than a claimed passing test. Actor role is the request-authentication snapshot; transaction-time actor reauthorization remains a separate policy decision.

History retains scalar actor/subject IDs after permanent deletion of either the target or a former administrator. Existing business-history foreign keys continue to block deletion where they did before. No additional history foreign key or delete restriction is introduced.

## Changed files

- `apps/api/src/features/users/users.controller.ts`: passes authenticated backend context for seven mutations.
- `apps/api/src/features/users/users.service.ts`: derives operation context and forwards it after existing checks.
- `apps/api/src/features/users/users.repository.ts`: atomic Account history, scoped workforce wrappers, stale-retirement guards, and permanent-deletion transaction.
- New `apps/api/src/features/users/account-workforce-history.ts`: captures current Account-derived synchronization and FK effects only.
- `apps/api/src/features/users/account-management-history.ts` and `apps/api/src/features/employees/workforce-management-history.ts`: the two narrow truthful-payload adjustments described above.
- New `apps/api/tests/features/users/account-attribution.test.ts`: real authenticated Express/PGlite coverage for every endpoint, distinct actors, forged metadata, privacy, no-ops, failures, derived effects, stale/overlapping requests and retention.
- `apps/api/tests/features/users/{account-password,account-restore}.test.ts`: existing direct repository tests now supply a trusted operation; original failure/guard assertions retained.
- `apps/api/tests/features/users/account-status.test.ts`: the existing isolated legacy delegate test supplies stubs for additive history/snapshot calls without opening its fake database URL. Real attribution and rollback tests use PGlite; existing access/authentication assertions remain.
- `apps/api/tests/features/users/management-history-foundation.test.ts`: rejects empty no-effect status/temporary-head payloads and clarifies Department-only dormant-endpoint assertions.
- This record, the feature index and a dated follow-up link in the foundation record.

Existing unrelated uncommitted work is preserved. No shared lifecycle, Employee synchronization implementation, schema, migration, permission catalog, Client controller/repository, Employee controller or frontend source is modified.

## Validation

| Executed check                                             | Result                                                                                                                                                                                                          |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Failing attribution reproduction                           | Confirmed missing history against the pre-integration implementation                                                                                                                                            |
| Initial targeted account/foundation/leadership regressions | PASS, 24 tests; final expanded coverage is included in the full run below                                                                                                                                       |
| `pnpm format` and final `pnpm format:check`                | PASS, exit 0                                                                                                                                                                                                    |
| `pnpm lint`                                                | PASS, exit 0; zero warnings                                                                                                                                                                                     |
| `pnpm typecheck`                                           | PASS, exit 0; API/web and test types                                                                                                                                                                            |
| `pnpm build`                                               | PASS, exit 0; API and production standalone web                                                                                                                                                                 |
| `pnpm test:api`                                            | PASS, exit 0; all 323 tests, none failed/skipped/cancelled; final rerun includes the last account-membership deletion case                                                                                      |
| `pnpm test:web`                                            | PASS, exit 0; 108 unit tests, none failed/skipped/cancelled                                                                                                                                                     |
| Selected Chromium regressions                              | PASS, exit 0; 25 tests, none failed/skipped                                                                                                                                                                     |
| `git diff --check`                                         | PASS                                                                                                                                                                                                            |
| Start-of-phase file preservation                           | Of 778 existing source/schema/migration/test/documentation files, only the 11 intended existing files listed above changed; three new files are the Account workforce wrapper, integration test and this record |

The full API run contains eight tests in the new Account attribution suite (its parent plus seven subtests), the ten foundation tests, existing account status/password/restore/role/leadership tests, and all remaining authorization/Client/Employee/department/Attendance/workflow/messaging regressions. The final focused Account suite also passes all eight tests, including both creation and deletion membership for accounts without Employee profiles; those cases are included in the final full run. Counts are not added together again. The runner also verifies the pre-existing isolated read-only Client-permission child test; that child is not double-counted. Tests use only offline PGlite and real authenticated Express requests where described. No live database was migrated, seeded or queried.

The new tests first failed against the old implementation's missing history. Forced Account and Workforce history failures intentionally return 500 and appear in the API test log; assertions verify complete rollback. They are expected fault-injection output, not unresolved test failures. Existing non-failing `pg` concurrent-query deprecation warnings remain. The standard compiler/native Node path ran successfully; raw `tsx` startup was not retested.

The 25 browser cases are `apps/web/e2e/{superadmin,staff,employee-login,module-scoped-navigation}.spec.ts`, executed against a local production web build with two workers. They cover desktop/mobile password reset and restore, role/status updates, self-protection, archive/permanent deletion, account search, role navigation and unchanged Employee-login controls. They use the existing mocked API contracts; independent authenticated backend/PGlite tests establish persistence and authorization. No frontend or browser spec was changed. The temporary standalone process was stopped after the run. An intermediate rebuild hit Windows `EBUSY` while that process still held its working directory; stopping the owned process resolved the lock and the final build passed, without a source workaround.

No required test was blocked, and no new regression remains in the executed checks. The broader browser backlog documented in [Phase 4A](superadmin-comprehensive-authorization-audit.md#full-browser-failures-and-classification) and [Phase 4B.3](client-creation-permission-separation.md#validation), including unrelated Client success-heading assertions, was not rerun or claimed resolved. No unrelated workflow/assertion was changed to obtain a pass. Multi-connection PostgreSQL contention and live deployment remain untested as described above.

Evidence is retained under ignored `.ci-tools/phase4b4b2-{red,focused,final-focused,format,format-final,lint,typecheck,build,api,web-unit,browser}.log`, `.ci-tools/phase4b4b2-browser-artifacts/`, and the start-of-phase baseline hash/status files. The final preservation check confirms schema/migrations, permission catalogs, shared lifecycle and Employee synchronization implementations, Client/Employee controllers and frontend source all match their initial content.

## Remaining boundaries

All seven Account Management operations are covered for their current material effects. Client, Employee, Department and Team management entry-point attribution remains separate work; only effects caused by the scoped `/api/users` operations are covered here. History reading/export/retention tooling, retrospective backfills, actor reauthorization policy and stronger database-owner tamper resistance remain outside this phase. The foundation migration must be deployed before using these writers; this task performs no live migration or repair.

Stop after Phase 4B.4B.2. Do not proceed to Client or Employee Management integration.

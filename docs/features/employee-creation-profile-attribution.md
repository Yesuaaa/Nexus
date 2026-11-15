# Employee creation and profile attachment attribution — Phase 4B.4B.4A

Developed: 2026-11-15.

Both explicit Employee creation entry points now persist the authenticated administrative actor and their actual account/workforce effects. Neither endpoint is deferred. This follows the [Phase 4B.4A design](administrative-mutation-attribution-audit.md), [persistence foundation](administrative-attribution-persistence-foundation.md), and completed [Account](account-management-actor-attribution.md), [Client](client-management-actor-attribution.md), and [Employee lifecycle](employee-account-lifecycle-attribution.md) attribution integrations.

No general Employee update/status/assignment, Department Head, Department or Team management attribution is added. Existing Employee/User write logic, lifecycle paths, authorization, validation, eligibility, schema/migrations and frontend contracts remain unchanged. No history interface, Diagnostics or centralized System Logs is introduced.

## Endpoint coverage and records

Both endpoints retain authentication and `employees:manage`, currently Admin/Superadmin. Staff, Department Heads and Clients gain no management permission. The actor does not require Employee or Department Head membership. Existing-account eligibility is still a non-retired Admin/Staff account without an Employee profile; Superadmin and Client targets remain excluded. Inactive eligible accounts retain their existing attachment eligibility and inactive login state.

| Endpoint                                          | Account history                                                                                                                 | Workforce history, all with `EMPLOYEE_MANAGEMENT` origin                                                                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/employees`                             | One `CREATED` for the Staff User actually created, using final database-read role/active state and approved profile field names | One Employee `CREATED` with initial status, employment type, User link and department/team IDs. One Department-scoped login membership record when the created login has actual assignments |
| `POST /api/employees/accounts/:accountId/profile` | None: the User already exists; its credentials, role, active status and sessions are not changed                                | One Employee `CREATED` with actual new HR identity/link/assignments. A Department-scoped `ASSIGNMENT_CHANGED` only if synchronization actually changed the existing User department/team    |

The new feature-local `employee-creation.service.ts` is a narrow attribution wrapper around the existing `createEmployee(tx, input)`. It receives the trusted operation and an explicit backend-only creation mode. The existing controller still owns account provisioning, existing-target lookup, eligibility/duplicate checks, transaction boundaries and responses. It derives `createManagementOperation(request.auth!)` after input/password checks and passes the operation into that wrapper. No client field selects creation mode or controls attribution.

The new-Staff path keeps its existing transaction around `createStaffAccount` and Employee creation; attachment keeps its existing Serializable transaction. Related Account and Workforce records use one server-generated operation UUID and the authenticated actor/role. Writer timestamps remain database-generated. Submitted actor IDs, roles-at-time, operation IDs, timestamps, role claims and history payloads are ignored by existing input validation. Explicit submitted `userId` remains rejected.

## Actual effects and duplicate avoidance

The wrapper selects safe User assignment IDs before calling the existing Employee service, then reads final User role/status/assignment IDs after it completes. Employee creation fields come from the returned persisted Employee. Existing User synchronization, locking, protected head/lead checks and validations run unchanged.

- Employee birth is one `CREATED` history row, with null-to-persisted `userId`, department/team, status and employment-type values. Personal profile data and start date are represented by changed field names only.
- Mirrored name/email/contact/title fields are covered by that Employee creation row. The operation does not generate duplicate account-profile events for the same synchronized fields, a fictitious role change, or an extra Employee link event for initial creation.
- A new login's initial membership starts from no User membership and records only its final department/team IDs with `affectedAccountId`. This is separate from the new Employee's assignment: the two actual entities remain distinguishable.
- Attachment compares actual existing User department/team IDs to final IDs. Changed membership is recorded using the resulting department, or the prior department if needed. Explicit `No team` stores only the actual team transition; unchanged department IDs are not falsely reported as transitions.
- If User assignments already match the new profile, there is no additional membership event. Profile-only synchronization still has the Employee `CREATED` record and field names, without retaining old/new personal values.
- The existing API requires a department and start date and permits `teamId: null`. These rules are preserved; attribution does not invent an unassigned-creation workflow. General Employee PUT and Department Head status/handoff logic remain unmodified.

Account creation is decided by the trusted path that just created the User, not inferred from role, timestamps, email matching or frontend claims. Attachment never creates a User or records Account `CREATED`; it continues rejecting supplied passwords. The Staff creation path keeps its fixed Staff/active account defaults even when submitted role or login-status fields claim otherwise. HR status is a separate persisted value.

## Atomicity, privacy and integrity

All events use the existing typed history writers with unchanged allowlists. No schema or history-contract extension is necessary. Account history, Employee birth and related assignment history are appended before the transaction returns. A failed Account history insert rolls back new User/Employee records. A failed later Workforce insert also rolls back earlier history, User profile/assignment synchronization and Employee creation. Failed authorization, input validation, duplicate constraints, target eligibility and transaction conflicts produce no committed success history.

No plaintext password/hash/salt, access or refresh token, personal name/email/contact/title/start-date value, raw request or unrestricted User/Employee snapshot is serialized into history. Before-state queries contain only approved assignment IDs and the fallback department relation; in-memory business/profile objects are never forwarded to history as snapshots. Only the explicit account-role/status, HR fixed states, IDs, and field-name allowlists are serialized.

Existing password hashing, password rejection on attachment, duplicate email/Employee ID and account-profile constraints, required fields, department/team consistency, protected head/lead relationships, lock utilities, isolation levels, transaction conflict handling, error messages, and safe Employee response DTOs remain. Existing sessions are not revoked by attachment, including inactive-account sessions; login activation/retirement behavior stays in its completed lifecycle phase. A Superadmin is not given an Employee identity automatically and cannot be selected as the attachment target.

## Changed files

- `apps/api/src/features/employees/employees.controller.ts`: passes trusted operation context to the two creation paths. The existing login lifecycle handlers and general PUT remain unchanged.
- New `apps/api/src/features/employees/employee-creation.service.ts`: scoped creation wrapper, safe state reads and domain history inserts, reusing the existing Employee service.
- New `apps/api/tests/features/employees/creation-attribution.test.ts`: real authenticated Express/PGlite endpoint, privacy, rollback, eligibility, duplicate, assignment and overlap tests.
- This feature record, its index link, and a dated note in `docs/features/employee-management.md`.

No existing test, shared Employee service/repository/schema, history writer, Account/Client implementation, Employee lifecycle service, permission catalog, schema/migration or frontend source is modified. Unrelated uncommitted changes are preserved.

## Validation

| Executed check                              | Result                                                                                                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Missing-attribution reproduction            | Confirmed failing against the pre-integration implementation                                                                                                                                                 |
| Final focused creation/attachment suite     | PASS, exit 0; 8 tests                                                                                                                                                                                        |
| `pnpm format` and final `pnpm format:check` | PASS, exit 0                                                                                                                                                                                                 |
| `pnpm lint`                                 | PASS, exit 0; zero warnings                                                                                                                                                                                  |
| `pnpm typecheck`                            | PASS, exit 0; API/web and tests                                                                                                                                                                              |
| `pnpm build`                                | PASS, exit 0; API and production standalone web                                                                                                                                                              |
| `pnpm test:api`                             | PASS, exit 0; all 347 tests, none failed/skipped/cancelled                                                                                                                                                   |
| `pnpm test:web`                             | PASS, exit 0; 108 unit tests, none failed/skipped/cancelled                                                                                                                                                  |
| Selected Chromium regressions               | PASS, exit 0; 27 tests, none failed/skipped                                                                                                                                                                  |
| `git diff --check`                          | PASS                                                                                                                                                                                                         |
| Start-of-phase preservation                 | Of 785 existing source/schema/migration/test/documentation files, only the scoped Employee controller and two documentation files changed; three new deliverable files are the wrapper, test and this report |

The new suite first failed against the pre-integration implementation's absent attribution. One initial fixture attempted a null department and expected creation; it was corrected to exercise the existing mandatory-department and explicit `No team` contract. Production validation was not changed. Forced Account and late Workforce history failures intentionally produce API 500 entries; tests assert full transaction rollback rather than treating those responses as successes. Existing non-failing `pg` concurrent-query deprecation warnings remain.

The eight new tests (parent plus seven subtests) cover distinct Admin/Superadmin actors and new targets; role/attribution forgery; fixed Staff creation and actual HR state; shared operation grouping; eligible Staff/Admin attachment without User/account-history creation; inactive eligible targets; password/role/session preservation; profile synchronization; unchanged and changed assignments; explicit `No team`; protected head and ineligible Superadmin/Client/retired targets; unauthorized/missing/invalid/duplicate records; Account and late Workforce insertion failure rollback; overlapping attachments; and secret/profile exclusion.

The normal offline harness uses one pool connection. Overlapping HTTP requests and transaction assertions do not establish independent PostgreSQL-backend contention, deadlock or Serializable behavior under production load. Existing transactions and locks remain; no new retry or HTTP idempotency mechanism is added. Actor role is the request-authentication snapshot. No live database, migration, seed, repair or historical backfill is executed.

The 347-test full backend run includes the eight new creation/attachment tests and existing Account, Client, Employee lifecycle, Employee integration, authorization, leadership and all other regression suites. Focused runs and the existing isolated read-only Client-permission child assertion are not added to the count again. The compiler/native Node runner executed successfully; raw `tsx` startup was not retested. No required check was blocked, and no new regression remains in the executed checks.

The 27 browser cases are `apps/web/e2e/{employee-login,superadmin-people-hr,staff,superadmin,client-mutations,client-create-permission}.spec.ts`, run with two workers against the local production web build. They cover Employee profile/login controls, HR permission/identity boundaries, role navigation, Account mutations and Client creation/permission controls. Browser tests use existing mocked API contracts; independent real authenticated Express/PGlite tests establish persistence and backend authorization. No frontend or browser spec was changed. The temporary server was stopped after the run.

The four unrelated Client onboarding heading failures recorded in [Phase 4B.4B.3A](client-management-actor-attribution.md#validation) and the broader [Phase 4A browser backlog](superadmin-comprehensive-authorization-audit.md#full-browser-failures-and-classification) were not selected, changed or claimed resolved. No unrelated workflow or assertion was modified to obtain a pass. Live deployment and multi-connection production contention remain untested.

Evidence is retained under ignored `.ci-tools/phase4b4b4a-{red,focused,focused-final,format,format-final,lint,typecheck,build,api,web-unit,browser}.log`, `.ci-tools/phase4b4b4a-browser-artifacts/`, and start-of-phase baseline hash/status files. The existing shared Employee service/repository/schema, lifecycle implementation, Account/Client code, history utilities, permission catalogs, Prisma schema/migrations, existing tests and frontend source all match their initial hashes. In the Employee controller, only the two scoped creation paths and their import changed.

## Remaining boundaries

Both scoped creation endpoints are attributed for their actual current effects, without duplicate mirrored-field events. General Employee update/status/assignment and Department Head/Department/Team management attribution remain separate phases. The existing foundation migration is required at deployment; this phase creates or deploys no migration. History viewing/export/retention, retrospective actor reconstruction, database-owner tamper resistance and multi-connection production contention validation remain outside scope.

Stop after Phase 4B.4B.4A.

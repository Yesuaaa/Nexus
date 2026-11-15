# Department creation, updates and leadership actor attribution — Phase 4B.4B.5A

Developed: 2026-11-15.

`POST /api/departments` and `PUT /api/departments/:id` now record their authenticated administrative initiator and actual Department, Employee and User-assignment effects. This bounded integration follows the [attribution design](administrative-mutation-attribution-audit.md), [persistence foundation](administrative-attribution-persistence-foundation.md) and [Employee update integration](employee-update-head-attribution.md).

Department deletion, member-management routes and standalone Team Management remain unattributed by this phase. No schema, permission, workflow, response contract, operational identity or history interface is added. Department reads remain observational and retain the [restricted response contracts](department-data-access-security.md) and [GET integrity rules](department-get-integrity.md).

## Authorization and transaction boundary

Both routes retain `requireAuth` and `departments:manage`, currently Admin/Superadmin. Ordinary Staff, Department Heads and Clients gain no HR-management access. The controller derives `createManagementOperation(request.auth!)` and passes the trusted operation through the existing service/repository path. Body/header actor claims, role, operation IDs, timestamps and history payloads are ignored by existing input projections. Superadmin needs no Employee identity.

All records use the existing `WorkforceManagementChange` model, `DEPARTMENT_MANAGEMENT` origin, the authenticated actor ID/role, one server-generated operation UUID and database-generated timestamps. The unchanged repository transactions contain both the business writes and required history. A writer failure aborts all Department, title, Employee, User and earlier history changes.

## Actual mutation map

| Existing effect                                                                 | Recorded history                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Department creation                                                             | Department `CREATED`, metadata field names, and initial Head ID transition when applicable. Initial appointment is included once, without a duplicate `HEAD_CHANGED` event.                                                                                                                             |
| Metadata edit                                                                   | Department `PROFILE_UPDATED`, only names of actually changed name/code/color/description fields; no submitted text values. Normalized input is compared with persisted state.                                                                                                                           |
| Head assignment, replacement or removal                                         | One Department `HEAD_CHANGED` containing actual current/temporary Head ID transitions. If only temporary tracking changes, the shared writer supports `TEMPORARY_HEAD_CHANGED`; the existing Department PUT only clears reservations when its existing Head-change condition applies.                   |
| New/current Head removed from a sub-team                                        | Actual User membership as Department `ASSIGNMENT_CHANGED` with affected account ID; actual Employee membership as Employee `ASSIGNMENT_CHANGED`. These are separate persistent relationships, not duplicate mirrored profile events.                                                                    |
| Existing Employee assignment/title synchronization                              | Shared Employee effect writer records actual assignment ID transitions and profile field names only.                                                                                                                                                                                                    |
| Displaced current/reserved Head title clearing                                  | Shared title helper records one Employee `TITLE_CLEARED` with the fixed cause `FORMER_DEPARTMENT_HEAD`. Legacy User-only records use a Department subject and affected account ID. The subsequent synchronization snapshot is taken after this correction, avoiding a duplicate profile-position event. |
| Legacy User-only former Head gains an Employee through existing synchronization | Actual Employee `CREATED`, safe link/assignment/status/employment-type transitions. No fabricated Account creation or Employee birth for an existing Employee.                                                                                                                                          |

No Account history is generated: these routes do not create accounts, change login status or credentials, or change roles. HR status and login status remain distinct. No Team leadership row is modified by these paths; Team Lead candidates remain ineligible under existing validation. Former Heads retain their existing department membership unless the pre-existing synchronization rules actually normalize it.

## Locking and business invariants

PUT retains its Department row lock, candidate eligibility checks, sorted former-Head processing and transaction isolation. Candidate validation already locks the User; same-Head normalization now explicitly acquires the same User lock previously acquired by its UPDATE before reading the User before-state. Employee before-state is captured under the same Employee-by-user lock used by synchronization, with the same missing-Employee User fallback. Reentrant helper locks are transaction-local. No actor row lock or new global locking scheme is introduced.

Eligibility, active Staff/Employee requirements, team membership, reservation cleanup, guarded title retention and restoration rules are unchanged. A same-Head request still performs the existing synchronization and may record real normalization effects; repeated requests with no material differences produce no history. Timestamp-only changes produce no transitions. Employee PUT handoff/restoration still uses `EMPLOYEE_MANAGEMENT` and its original helpers/defaults. An explicit Department replacement ends the old reservation without giving the original Head a later takeover right.

The pre-existing candidate User-then-Employee lock sequence remains; this phase does not redesign competing lifecycle/Employee lock acquisition. PGlite serializes through the shared pool, so overlapping-request tests cannot prove independent PostgreSQL-session lock scheduling or deadlock freedom.

## Validation

The new authenticated Express/PGlite suite first reproduced missing history and successful business commits despite a forced history failure. It covers creation with/without a Head, normalized metadata/no-ops, Head/team synchronization, temporary replacement/removal, legacy Employee materialization, forged metadata, direct authorization/eligibility failures, late-insert rollback, repeat GETs, overlapping writes and sensitive-value exclusion.

| Check                                                                                | Result                                                                                                                                 |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm build`                           | PASS, exit 0                                                                                                                           |
| Focused Department attribution, GET integrity, Employee update and foundation suites | PASS, 39 tests, including the 10 new Department tests (parent plus nine subtests)                                                      |
| `pnpm test:api`                                                                      | PASS, 367 tests; includes previous Account/Client/Employee creation/lifecycle/update attribution and backend authorization regressions |
| `pnpm test:web`                                                                      | PASS, 108 tests                                                                                                                        |
| Selected production-browser suites                                                   | PASS, 34 tests; existing isolated frontend fixtures, not database-attribution proof                                                    |
| `git diff --check`                                                                   | PASS                                                                                                                                   |

Browser command: `pnpm --filter @nexus/web exec playwright test employees.spec.ts departments.spec.ts employee-login.spec.ts superadmin-people-hr.spec.ts staff.spec.ts superadmin.spec.ts client-mutations.spec.ts client-create-permission.spec.ts --workers=2 --reporter=line`, using an isolated production server on port 5273, `NEXUS_E2E_LIVE=0` and `NEXUS_E2E_BASE_URL=http://127.0.0.1:5273`. That task-owned server was stopped after validation. Database assertions use authenticated Express requests and real offline PGlite, not mocked writers. Forced database-trigger failures verify rollback of Department creation with/without a Head and replacement with title/Employee/User sub-team effects plus earlier history inserts.

No required check was blocked, and no regression remains in the executed checks. Existing `pg` query/deprecation warnings remain non-fatal. The compiler/native Node runner worked; raw `tsx` startup was not retested. No live database, migration, seed, backfill or repair was run. The existing attribution foundation migration remains a deployment prerequisite.

Historical broad-browser failures documented in the earlier [Employee update report](employee-update-head-attribution.md) remain separate from the selected regression suites; this phase does not modify unrelated Client service-request UI expectations or run against live data.

The full historical browser backlog was not rerun or claimed resolved. It includes previously documented Client onboarding heading mismatches; none of those assertions or workflows was changed. Evidence is retained in ignored `.ci-tools/phase4b4b5a-{red,focused,format,format-final,lint,typecheck,build,api,web-unit,browser}.log` files and browser artifacts. Compared with the initial hashes of 791 existing source/schema/test/documentation files, only the six existing source files, two existing tests and feature index listed below changed; the new helper/test/report and separately captured module-reference update complete this phase. Existing schema/migrations, authorization catalogs, frontend sources and unrelated working changes remain intact.

## Changed files

- `apps/api/src/features/departments/departments.controller.ts`: trusted operation derivation for POST/PUT only.
- `apps/api/src/features/departments/departments.service.ts`: operation propagation with existing validation/errors/responses.
- `apps/api/src/features/departments/departments.repository.ts`: transaction-local attribution for the two scoped mutations.
- `apps/api/src/features/departments/department-management-history.ts`: Department persisted-state comparisons and bounded synchronization observation.
- `apps/api/src/features/employees/employees.service.ts`: optional Department origin on the existing displaced-title helper; existing callers retain Employee origin.
- `apps/api/src/features/employees/employee-update-history.ts`: reuse User-assignment and Department leadership recorders with a closed optional Department origin.
- `apps/api/src/features/users/account-workforce-history.ts`: export the existing Employee effect writer and allow the Department origin; previous lifecycle callers/defaults remain unchanged.
- `apps/api/tests/features/departments/management-attribution.test.ts`: authenticated persisted-state and rollback coverage.
- `apps/api/tests/features/employees/update-attribution.test.ts`: explicit Department replacement now expects its separate attributed operation before testing Employee restoration.
- `apps/api/tests/features/users/management-history-foundation.test.ts`: replace the obsolete Department-dormancy expectation with bounded attribution and unchanged scopes/retention assertions.
- `docs/features/department-creation-update-attribution.md`, `docs/features/README.md`, `.agents/skills/nexus-platform/references/modules.md`: current bounded coverage and validation record.

## Remaining boundaries

No known material effect in these two mutation paths is intentionally omitted. Broader concurrency proof requires independent PostgreSQL sessions. Deletion, member changes and standalone Team Management attribution remain separate work. There is no backfill, generic logging, Diagnostics, centralized System Logs or history UI/API.

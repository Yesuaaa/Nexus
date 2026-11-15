# Team management actor attribution — Phase 4B.4B.5D

Developed: 2026-11-15.

All three existing Team mutation endpoints now attribute their authenticated administrator and actual Team/Employee/User effects within their existing transactions. This follows the [original 26-endpoint audit](administrative-mutation-attribution-audit.md), [foundation](administrative-attribution-persistence-foundation.md), [Employee attribution](employee-update-head-attribution.md), [Department deletion](department-deletion-attribution.md), and [member attribution](department-member-attribution.md).

This implements Team attribution only. No schema, migration, action/origin enum, permission grant, operational identity, account lifecycle feature, new business cascade, history API/UI, Diagnostics or System Logs is introduced. Existing Department/Employee/Account/Client workflows and private records retain their authorization. No broader authorization, concurrency or browser-backlog remediation is attempted.

## Endpoint behavior and actual effects

All three routes retain `requireAuth` and `departments:manage`, currently Admin/Superadmin. Their controller creates `createManagementOperation(request.auth!)`. Actor/role/operation/time/history claims from bodies or headers never control the operation. Every resulting record uses `TEAM_MANAGEMENT`, the actual authenticated actor ID/role, one server-generated UUID and database-generated time. No Account creation/change event is fabricated.

| Endpoint                                    | Existing behavior retained and recorded                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/departments/:id/teams`           | Existing name/member validation, eligible initial Lead selection, Team creation, Lead assignment/synchronization and existing Employee-backed member assignment. Team `CREATED` records its parent department and initial Lead when present, plus metadata field names only. Initial appointment is not duplicated as `LEAD_CHANGED`.                                               |
| `PUT /api/departments/:id/teams/:teamId`    | Existing candidate validation, metadata/Lead update and old/new Lead synchronization. Team `PROFILE_UPDATED` records only actually changed name/description field names. `LEAD_CHANGED` records actual old/new IDs. Old Leads remain members under the existing rules; removal of a Lead does not invent removal of their membership or title.                                      |
| `DELETE /api/departments/:id/teams/:teamId` | Existing User team clearing, Employee team clearing, linked-User synchronization and Team deletion retain their order/predicates. Team `DELETED` records removal of its parent/Lead relationships using the existing bounded deletion contract. Surviving User/Employee changes and actual legacy Employee birth are separately attributed; accounts and Employees are not deleted. |

Metadata-only PUT still runs the existing old-Lead synchronization when `leadId` is omitted. Thus an otherwise unchanged request can record actual Employee position/assignment normalization or missing-Employee creation. A true no-op generates no history. A same-Lead request still validates the candidate and performs existing assignment/synchronization, without a false Lead transition.

Updates retain the preflight scoped 404 check. The attribution before-state is re-read under the Team lock inside the transaction, after existing candidate User validation. The former Lead for synchronization now comes from that protected current row rather than the earlier unlocked preflight object. This is the minimum correction necessary for accurate update attribution; selection rules, metadata normalization, response contracts and isolation are unchanged. Concurrent disappearance still uses existing mapped database-conflict handling.

## Reused history and privacy contracts

The existing member snapshot/effect helpers, `recordEmployeeUpdate`, `recordEmployeeAssignments`, `recordUserSynchronization`, `writeEmployeeEffects` and typed workforce writer are reused. Their origin types add only the already-existing `TEAM_MANAGEMENT` value where needed; previous Employee/Department/Account defaults remain unchanged. The member Employee selector is exported for reuse rather than copying a broader snapshot. No persisted payload allowlist is expanded.

- Existing Employee department/team changes use `ASSIGNMENT_CHANGED` with actual ID transitions.
- Actual User membership changes use Department-scoped `ASSIGNMENT_CHANGED` with affected account ID and actual membership transitions. The existing recorder chooses the retained/current/previous Department as appropriate, including legacy team-only membership.
- Actual Employee position synchronization uses field-name-only `PROFILE_UPDATED`. User/Employee mirrors are represented once.
- A genuinely materialized Employee uses `CREATED` with its final allowed link/assignment/status/employment-type state. Existing Employees and Accounts are never represented as newly created.
- Lead/member identity overlap on creation keeps the first protected subject snapshot and records final state once. Deleted Team relationships belong in the one `DELETED` record; no duplicate Lead-removal event suggests another operation on a surviving Team.

History contains approved identifiers, fixed state values and changed field names. It excludes descriptions, free-form titles, names, emails, contacts, credentials, raw requests and unrestricted snapshots. Existing response projections/layouts are reused without frontend changes or history exposure. Subject/actor snapshots remain deletion-independent through the existing scalar-only history models.

## Transaction and concurrency boundaries

Creation retains its existing candidate User → new Team → synchronized Employee flow and existing per-member Employee → User ordering. Updates acquire their Team lock where UPDATE already acquired it, after candidate User checks, then capture affected old/new Lead states in each existing synchronization order. No parent Department lock, new isolation mode, global lock ordering or retry mechanism is introduced.

Deletion captures and locks its affected Users, Employees, then Team, retaining its existing write acquisition order. The snapshot includes Employees linked to syncing Users even when their prior assignment differs, plus unlinked/Employee-only members. The Team is then re-read within the requested Department under lock. Final scope checks reject new, unlocked membership IDs with `409 Team changed; refresh and retry` before business writes. Its protected Team prevents subsequent incoming membership foreign keys. The code does not acquire a second out-of-order batch of workforce locks.

An Employee whose User is outside the syncing membership set gets Employee history only; no extra User write or lock is invented. User-only Staff can gain an Employee through existing synchronization. Superadmin still receives no Employee identity from synchronization, and legacy Client team-only cleanup does not fabricate one when the original logic skips it.

Required history writes follow successful business writes, final workforce re-reads and, for deletion, confirmation that the Team is absent. Team history is appended after workforce history, so a final Team-history failure rolls back Team/Lead changes, memberships, normalization, Employee birth and earlier history inserts together. Existing responses are released only after commit.

Creation's Department/Head and member prechecks retain their existing placement; candidate/eligibility reads are not universally revalidated under every workforce lock. Other domains retain differing lock orders and legacy precheck differences documented in [Phase 5C](department-member-attribution.md#snapshot-and-transaction-boundary). No broader fix is made. PGlite's single-connection pool cannot certify independent PostgreSQL-session scheduling, deadlock freedom or the real concurrent membership-arrival guard. Overlapping HTTP updates validate actual Lead-transition chains within this infrastructure; a forced SQLSTATE `40001` verifies existing conflict handling and rollback. Stronger concurrency guarantees remain deferred.

## Validation

The new suite ran before implementation and failed on absent history and a successful business mutation despite a forced history failure. The implementation passes targeted Team and earlier-domain tests. A denial fixture initially assumed which overlapping Lead update finished last; it was corrected to select an account known to lead another Team, without modifying production eligibility.

| Check                                                                         | Result                                                                                                                                    |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm build`                    | PASS, exit 0                                                                                                                              |
| Focused Team, member, Department creation/deletion and Employee update suites | PASS, 49 tests; final full run also includes the added Employee-only and Client team-only deletion assertions                             |
| `pnpm test:api`                                                               | PASS, 396 tests, including all 10 new Team tests (parent plus nine subtests) and all previous attribution/authorization regression suites |
| `pnpm test:web`                                                               | PASS, 108 tests                                                                                                                           |
| Selected production-browser regressions                                       | PASS, 34 tests; isolated frontend fixtures, separate from actual backend attribution evidence                                             |
| `git diff --check` and report link checks                                     | PASS; 33 local report links resolve                                                                                                       |

Browser command: `pnpm --filter @nexus/web exec playwright test employees.spec.ts departments.spec.ts employee-login.spec.ts superadmin-people-hr.spec.ts staff.spec.ts superadmin.spec.ts client-mutations.spec.ts client-create-permission.spec.ts --workers=2 --reporter=line`, using a task-owned production server on port 5273, `NEXUS_E2E_LIVE=0` and `NEXUS_E2E_BASE_URL=http://127.0.0.1:5273`. The test server was stopped afterward. Real authenticated Express/PGlite tests assert persisted rows/history and force late Team history insertion failures with a database trigger; no mocked history calls substitute for transaction evidence.

The new real authenticated Express/PGlite suite covers Team creation with/without Lead/members; coalesced Lead/member identities; normalized metadata/no-ops; old-Lead normalization and actual legacy birth; Lead replacement/removal and protected transaction-local transition chains; empty/populated deletion; mismatched Employee/User and unlinked membership; legacy Superadmin/Client cleanup; role/Head/Lead/status/scope/duplicate denials; late rollback; conflicts; privacy; unrelated-row preservation; observational GETs; and actor/subject deletion retention. History writers are not mocked.

Historical broader browser failures are tracked separately in the [Department deletion report](department-deletion-attribution.md#validation). No unrelated Client onboarding expectation or broader browser workflow is modified in this phase. No live database, seed, migration, backfill or repair is run.

No required check was blocked and no new regression remains in executed suites. Existing non-fatal `pg` query/deprecation warnings remain. The compiler/native Node runner executes real-API tests successfully; raw `tsx` startup was not retested. Historical full-browser failures and independent-session contention are not claimed resolved or certified.

Evidence is retained in ignored `.ci-tools/phase4b4b5d-{red,team,focused,format,format-final,lint,typecheck,build,api,web-unit,browser}.log` files and browser artifacts. The final full run supersedes the initial red run and the intermediate denial-fixture failure. Comparing the initial hashes of 803 existing source/schema/test/documentation/reference files shows changes only to five existing source files, the feature index and module reference listed below. The new Team helper, test and report complete this phase's ten changed files. Existing schemas/migrations, permission catalogs, frontend sources, Department creation/deletion/member transaction code, earlier tests and unrelated working changes remain preserved.

## Reconciliation against the original 26 endpoints

The following is an explicit source and test mapping, not a count inferred from phase labels. All previous integrations were re-inspected from controller/auth context through services/repositories or lifecycle helpers into their business transactions, and their authenticated persisted-state suites passed in the final 396-test backend run. **PASS: 26/26 original inventoried endpoints have verified actor attribution; no remaining unattributed path was identified within that inventory.** Repeated methods represent separate inventory paths; no route is counted twice because it has multiple branches. This conclusion covers the existing operations tested, not all possible concurrent interleavings or every API elsewhere in the application.

| #   | Original endpoint                                 | Source attribution chain / persisted-state regression                                                                                                                              |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `POST /api/users`                                 | `usersService.createUser` → repository account/workforce writers; [Account tests](../../apps/api/tests/features/users/account-attribution.test.ts)                                 |
| 2   | `PATCH /api/users/:id/role`                       | `changeRole` → locked role update/synchronization/history; [Account tests](../../apps/api/tests/features/users/account-attribution.test.ts)                                        |
| 3   | `PATCH /api/users/:id/status`                     | `changeStatus` → transactional status/session/history; [Account tests](../../apps/api/tests/features/users/account-attribution.test.ts)                                            |
| 4   | `POST /api/users/:id/password`                    | `changePassword` → conditional reset/session/history; [Account tests](../../apps/api/tests/features/users/account-attribution.test.ts)                                             |
| 5   | `DELETE /api/users/:id`                           | `softDeleteUser` → transactional archival/history; [Account tests](../../apps/api/tests/features/users/account-attribution.test.ts)                                                |
| 6   | `POST /api/users/:id/restore`                     | `restoreUser` → transactional restoration/history; [Account tests](../../apps/api/tests/features/users/account-attribution.test.ts)                                                |
| 7   | `DELETE /api/users/:id/permanent`                 | `permanentlyDeleteUser` → deletion/account/workforce history; [Account tests](../../apps/api/tests/features/users/account-attribution.test.ts)                                     |
| 8   | `POST /api/clients`                               | Authenticated controller → `clientsRepository.save`, fixed User role/account history; [Client tests](../../apps/api/tests/features/clients/actor-attribution.test.ts)              |
| 9   | `PATCH /api/clients/:id`                          | Authenticated controller → transactional profile/status/history; [Client tests](../../apps/api/tests/features/clients/actor-attribution.test.ts)                                   |
| 10  | `DELETE /api/clients/:id`                         | Authenticated controller → archival/session/history; [Client tests](../../apps/api/tests/features/clients/actor-attribution.test.ts)                                               |
| 11  | `POST /api/employees`                             | Authenticated controller → `createEmployeeWithAttribution`, actual account/workforce birth; [Creation tests](../../apps/api/tests/features/employees/creation-attribution.test.ts) |
| 12  | `POST /api/employees/accounts/:accountId/profile` | Authenticated controller → existing-account profile attachment/history; [Creation tests](../../apps/api/tests/features/employees/creation-attribution.test.ts)                     |
| 13  | `PUT /api/employees/:id`                          | Authenticated controller → `updateEmployee` context and derived effect writers; [Update tests](../../apps/api/tests/features/employees/update-attribution.test.ts)                 |
| 14  | `POST /api/employees/:id/account`                 | Authenticated controller → provisioning/link/account/workforce history; [Lifecycle tests](../../apps/api/tests/features/employees/account-lifecycle-attribution.test.ts)           |
| 15  | `PATCH /api/employees/:id/account/status`         | Trusted auth → `setEmployeeLoginStatus`, transactional lifecycle writer; [Lifecycle tests](../../apps/api/tests/features/employees/account-lifecycle-attribution.test.ts)          |
| 16  | `DELETE /api/employees/:id/account`               | Trusted auth → `removeEmployeeLogin`, archival/history; [Lifecycle tests](../../apps/api/tests/features/employees/account-lifecycle-attribution.test.ts)                           |
| 17  | `DELETE /api/employees/:id/account/permanent`     | Trusted auth → permanent lifecycle deletion and actual unlink/workforce history; [Lifecycle tests](../../apps/api/tests/features/employees/account-lifecycle-attribution.test.ts)  |
| 18  | `POST /api/departments`                           | Authenticated controller → service/repository creation and actual workforce effects; [Department tests](../../apps/api/tests/features/departments/management-attribution.test.ts)  |
| 19  | `PUT /api/departments/:id`                        | Authenticated controller → locked Department/Head/Employee/User attribution; [Department tests](../../apps/api/tests/features/departments/management-attribution.test.ts)          |
| 20  | `DELETE /api/departments/:id`                     | Authenticated controller → protected deletion/cascade history; [Deletion tests](../../apps/api/tests/features/departments/deletion-attribution.test.ts)                            |
| 21  | `POST /api/departments/:id/members`               | Authenticated controller → batch snapshots/final workforce effects; [Member tests](../../apps/api/tests/features/departments/member-attribution.test.ts)                           |
| 22  | `PATCH /api/departments/:id/members/:memberId`    | Authenticated controller → Employee/legacy User transaction/effects; [Member tests](../../apps/api/tests/features/departments/member-attribution.test.ts)                          |
| 23  | `DELETE /api/departments/:id/members/:memberId`   | Authenticated controller → protected member removal/synchronization history; [Member tests](../../apps/api/tests/features/departments/member-attribution.test.ts)                  |
| 24  | `POST /api/departments/:id/teams`                 | Authenticated controller → Team creation and coalesced workforce history; [Team tests](../../apps/api/tests/features/departments/team-attribution.test.ts)                         |
| 25  | `PUT /api/departments/:id/teams/:teamId`          | Authenticated controller → protected Team/Lead before-state and actual synchronization; [Team tests](../../apps/api/tests/features/departments/team-attribution.test.ts)           |
| 26  | `DELETE /api/departments/:id/teams/:teamId`       | Authenticated controller → protected membership cleanup/deletion/history; [Team tests](../../apps/api/tests/features/departments/team-attribution.test.ts)                         |

The inventory excludes public registration, self-service, direct Prisma/SQL/seed writes and administrative APIs in other modules. This phase does not claim universal application mutation coverage. Historical successful operations before their integration are not backfilled. A material no-op produces no transition record; an operation with actual derived synchronization remains recorded. These qualifications do not silently treat an unattributed successful state change as a no-op.

## Changed files

- `apps/api/src/features/departments/departments.controller.ts`: trusted context for the three Team routes.
- `apps/api/src/features/departments/teams.service.ts`: transaction-local snapshots, old-Lead before-state correction and Team/workforce history.
- `apps/api/src/features/departments/team-management-history.ts`: bounded Team events, canonical subject coalescing and protected deletion snapshots.
- `apps/api/src/features/departments/department-member-history.ts`: exported bounded selector and optional Team origin; existing Department defaults preserved.
- `apps/api/src/features/employees/employee-update-history.ts`: existing effect recorders accept Team origin; Employee/Department defaults remain unchanged.
- `apps/api/src/features/users/account-workforce-history.ts`: existing Employee effect writer accepts Team origin without widening account lifecycle helpers.
- `apps/api/tests/features/departments/team-attribution.test.ts`: authenticated persisted-state authorization, privacy, synchronization, conflict and rollback tests.
- `docs/features/team-management-attribution.md`, `docs/features/README.md`, `.agents/skills/nexus-platform/references/modules.md`: phase report and current inventory coverage.

Independent-session guarantees, legacy validation differences, historical backfills, direct database tamper resistance and history viewing/export remain outside this work. Stop after Phase 4B.4B.5D.

# Department deletion and cascading workforce attribution — Phase 4B.4B.5B

Developed: 2026-11-15.

`DELETE /api/departments/:id` now records its authenticated administrator and actual Department, Team, Employee and User-assignment effects within the existing business transaction. This follows the [attribution design](administrative-mutation-attribution-audit.md), [foundation](administrative-attribution-persistence-foundation.md) and [Department creation/update integration](department-creation-update-attribution.md).

No account/Employee deletion, new cleanup, handoff, replacement, self-service, permission grant, schema change, migration, history API/UI, Diagnostics or System Logs is introduced. Member management and standalone Team Management attribution remain outside this phase. Existing creation/update, Employee, Account and Client workflows remain unchanged.

## Existing deletion behavior and authorization

The route retains `requireAuth` and `departments:delete`, currently Admin/Superadmin. Ordinary Staff, Department Heads, Clients, inactive and retired accounts cannot execute it. The controller creates `createManagementOperation(request.auth!)`; body/header actor, role, operation, timestamp and history claims never supply attribution.

The service retains its missing-department check and successful `{ message: "Department deleted successfully" }` response. Existing linked-service, accepted-request and conversation checks move into the existing repository transaction under the Department row lock, preserving conditions, service-first precedence and exact conflict messages. This prevents a service association committed between an outside preflight and the write from escaping validation. Projects have no direct Department foreign key: existing protection follows their accepted request, linked service and conversation relationships; no new project-specific deletion policy is invented. Existing database foreign keys remain intact, including request/conversation `Restrict` relations.

The business writes retain their order and predicates:

1. Clear User `departmentId` and `teamId` where its department matches the deleted Department.
2. Clear Employee `departmentId` and `teamId` where its department matches.
3. Run existing `syncEmployeeForUser` only for those linked Users originally assigned to this Department.
4. Delete the Department. Existing foreign keys cascade its Teams and clear remaining User/Employee references to those Teams.

Deletion does not clear free-form Head/Lead job titles or create a replacement/restoration workflow. Actual relational leadership disappears with the deleted rows. Existing synchronization may copy a User title into its Employee or create a missing Employee for a legacy eligible User; those effects are recorded. User/Employee accounts, login and HR statuses, employment type and account links are retained. Team-only members do not acquire new synchronization or Employee provisioning merely because a foreign key clears their team.

## Recorded history and minimal allowlist extension

Every record uses `WorkforceManagementChange`, `DEPARTMENT_MANAGEMENT`, the actual authenticated actor ID/role, one server-generated operation UUID and database-generated time. No Account event is fabricated.

| Actual effect                                      | Record                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Deleted Department                                 | One Department `DELETED`; actual non-null `headId`, `temporaryHeadOriginalId`, `temporaryHeadAssignedId` relationships transition to null. An empty Department has empty fields/changes.                                                                                                                                             |
| Each successfully cascaded Team                    | One Team `DELETED`; its actual `departmentId` and any non-null `leadId` transition to null. Parent association and leadership are retained as scalar snapshots after deletion.                                                                                                                                                       |
| Existing Employee membership removal/normalization | Shared Employee effect writer emits `ASSIGNMENT_CHANGED` only for actual assignment differences, including unlinked Employees and team-only foreign-key effects.                                                                                                                                                                     |
| User membership removal/normalization              | Shared User synchronization recorder emits Department-scoped `ASSIGNMENT_CHANGED` with `affectedAccountId` and actual assignment transitions. A cross-department legacy team-only account retains its department; the existing recorder can anchor this event to that retained department, with the same root deletion operation ID. |
| Material Employee title synchronization            | One Employee `PROFILE_UPDATED` containing only the changed field name, without the title value. Mirrored User profile events are not duplicated.                                                                                                                                                                                     |
| Actual legacy Employee materialization             | One Employee `CREATED` with safe link/assignment/status/employment-type transitions and field names, using the existing writer. No event claims an existing Employee or account was newly created.                                                                                                                                   |

The foundation's `DELETED` payload previously allowed only `{}`. Its existing approved relationship ID fields are now available specifically for deletion: Department head/reservation IDs, Team department/lead IDs. Runtime validators accept only a valid non-null ID **before**, and null **after**. Cross-subject keys, new/reassigned IDs, null-to-null transitions, profile fields, credentials and unknown keys remain rejected. Existing empty deletion payloads remain valid. No action/origin enum or database model changes are needed.

Leadership removal is represented in deletion records, rather than duplicate `HEAD_CHANGED`/`LEAD_CHANGED` events suggesting an additional management action on a surviving row. Team membership is recorded through actual Employee/User assignment rows rather than arrays of people or unrestricted relationship snapshots.

## Snapshot, transaction and concurrency protection

The existing transaction isolation and mutation order remain. Its Department is locked first. Affected User rows are locked in sorted order, followed by Employee rows and the existing Team cascade targets, preserving this deletion path's User → Employee → Team acquisition order. The shared lock utility adds only the closed `Team` table option. Other workflows' lock acquisition is unchanged.

Snapshots include department members, members of the Department's Teams even when their department differs, and Employees linked to Users about to be synchronized. Values are re-read after their locks. Team locks protect both leadership snapshots and incoming team-membership foreign keys. Parent Department locking blocks new department/team references. If the final protected scope includes an ID absent from the acquired lock sets, deletion fails with `409 Department changed; refresh and retry` before business writes; it does not take another out-of-order round of workforce locks or guess the before-state.

After the existing deletion, the writer verifies Department and captured Teams are absent and re-reads surviving User/Employee rows, including Employees actually materialized by synchronization. History is appended only from those states. Required history failure rolls back assignments, title synchronization, Employee birth, Department/Team deletion and earlier history. Concurrent already-deleted targets retain the existing not-found/conflict handling (404 preflight or a database-mapped 409).

Independent PostgreSQL-session contention is not validated by PGlite's single-connection pool. Overlapping HTTP requests test one successful deletion operation without duplicate history, but do not prove deadlock freedom, lock scheduling or the concurrent scope-drift branch across independent sessions. Existing Employee/Team writers have differing acquisition orders; no broader locking redesign or automatic retry policy is introduced. That production contention guarantee remains deferred. Database aborts/timeouts must roll back the whole business/history transaction.

## Validation

The new real authenticated Express/PGlite suite first reproduced missing deletion history and a successful deletion despite a forced history failure. The final targeted deletion suite passes eight tests (parent plus seven subtests), covering empty/populated deletion, direct and team-only membership, actual legacy birth, title synchronization, preserved statuses/titles/accounts, Admin/Superadmin attribution, forged metadata, invalid writer payloads, denial/lifecycle/linked-record cases, late rollback, unchanged unrelated rows, observational GETs, overlapping requests and history surviving actor/subject deletion.

| Check                                                              | Result                                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm build`         | PASS, exit 0                                                                                                  |
| Targeted `tests/features/departments/deletion-attribution.test.ts` | PASS, 8 tests                                                                                                 |
| `pnpm test:api`                                                    | PASS, 375 tests, including the eight new tests and all existing backend authorization/attribution regressions |
| `pnpm test:web`                                                    | PASS, 108 tests                                                                                               |
| Selected production-browser regressions                            | PASS, 34 tests; existing isolated frontend fixtures, separate from real database-attribution evidence         |
| `git diff --check`                                                 | PASS                                                                                                          |

Browser command: `pnpm --filter @nexus/web exec playwright test employees.spec.ts departments.spec.ts employee-login.spec.ts superadmin-people-hr.spec.ts staff.spec.ts superadmin.spec.ts client-mutations.spec.ts client-create-permission.spec.ts --workers=2 --reporter=line`, using an isolated production server on port 5273 with `NEXUS_E2E_LIVE=0` and `NEXUS_E2E_BASE_URL=http://127.0.0.1:5273`. The task-owned server was stopped afterward. The new backend tests assert persisted database rows and history, using actual authenticated Express requests, actual foreign-key cascades and a database trigger forcing the final Department history insert to fail; no mocked writer substitutes are used.

No required check was blocked. Existing `pg` query/deprecation warnings are non-fatal. The compiler/native Node runner executed real-API tests successfully; raw `tsx` startup was not retested. Current passing suites supersede intermediate red/focused logs. Independent-session scope drift/deadlock scheduling remains a coverage limitation rather than a claimed passing concurrency test.

Historical broader browser failures are tracked separately in the earlier [Department integration report](department-creation-update-attribution.md#validation). This phase does not alter unrelated Client onboarding UI assertions or claim those historical failures are resolved. No live database, seed, migration, backfill or repair is run.

The historical full-browser backlog was not rerun. No current executed regression remains unresolved. Evidence is retained in ignored `.ci-tools/phase4b4b5b-{red,focused,deletion,format,format-final,lint,typecheck,build,api,web-unit,browser}.log` files and browser artifacts. Comparing the initial hashes of 797 existing source/schema/test/documentation/reference files shows changes only to five existing source files, the feature index and module reference listed below. The new deletion helper, test and report complete this phase's ten changed files. Existing schema/migrations, permission catalogs, frontend sources, Phase 5A helpers/tests, and unrelated uncommitted changes remain intact.

## Changed files

- `apps/api/src/features/departments/departments.controller.ts`: trusted operation context for DELETE only.
- `apps/api/src/features/departments/departments.service.ts`: context propagation and relocation of existing eligibility guards to the write transaction.
- `apps/api/src/features/departments/departments.repository.ts`: existing DELETE writes plus transaction-local snapshot/history calls; remove unused outside-transaction count helpers.
- `apps/api/src/features/departments/department-deletion-history.ts`: bounded snapshots, row-set protection, actual post-state verification, shared effect writers and deletion events.
- `apps/api/src/features/employees/workforce-management-history.ts`: closed deletion-only relationship-removal payloads; all other action contracts retained.
- `apps/api/src/shared/db/locks.ts`: whitelist Team row locks and document this existing deletion acquisition order.
- `apps/api/tests/features/departments/deletion-attribution.test.ts`: authenticated persisted-state, allowlist, authorization and rollback coverage.
- `docs/features/department-deletion-attribution.md`, `docs/features/README.md`, `.agents/skills/nexus-platform/references/modules.md`: implementation and bounded coverage records.

No known current deletion effect is intentionally omitted. Independent-session concurrency proof, member-management attribution, standalone Team attribution, backfills, tamper-resistant storage and history viewing/export remain separate work. Stopped after Phase 4B.4B.5B.

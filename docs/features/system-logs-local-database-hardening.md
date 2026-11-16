# Management history local database hardening (Phase 2D.1A)

Developed: 2026-11-16

**Implemented locally, not deployed. Production System Logs remains disabled.** A new forward-only migration protects the existing management-history tables against UPDATE, DELETE and TRUNCATE. Existing writers, readers, source records, authorization and API contracts are unchanged. Database-role and browser-access guarantees below were tested in an explicit disposable privilege model, not verified against deployment credentials.

This follows the [Phase 2D.0 readiness audit](system-logs-production-readiness-audit.md), [Phase 1 policies](system-logs-contracts.md) and [endpoint coverage inventory](system-logs-endpoint-coverage.md). It does not implement Phase 2D.1B, durable access evidence, a production activator or another history source.

## Implemented protections

The migration [20261116130000_management_history_immutability](../../apps/api/prisma/migrations/20261116130000_management_history_immutability/migration.sql) adds:

- One `public.reject_management_history_mutation()` trigger function, using an empty search path, a constant safe error message and SQLSTATE `23514`. It uses the default invoker context; no SECURITY DEFINER authority or actor/session-based bypass is introduced. PUBLIC execution is revoked, following the Workflow convention.
- One BEFORE UPDATE OR DELETE OR TRUNCATE statement trigger per table: `account_management_history_immutable` and `workforce_management_history_immutable`.
- `ENABLE ALWAYS` for both guards, so a session's replication-role setting does not suppress them.
- An explicit transaction around the migration, so function/guard installation is atomic.

Statement-level guards reject even zero-row destructive statements. They also reject INSERT ... ON CONFLICT DO UPDATE, including an UPDATE branch that would not change a value; ordinary INSERT and ON CONFLICT DO NOTHING remain valid. Existing writers use append/create, not update/upsert/delete. A TRUNCATE guard is necessary because the older Attendance/Workflow row-level UPDATE/DELETE triggers do not cover TRUNCATE.

These semantics follow PostgreSQL's [CREATE TRIGGER](https://www.postgresql.org/docs/16/sql-createtrigger.html) and [ALTER TABLE](https://www.postgresql.org/docs/16/sql-altertable.html) contracts and were exercised against PostgreSQL 16.15, including replica mode.

No old migration or Prisma model was edited. No table, history row, index, identity reference, retention policy or domain writer was replaced. INSERT and SELECT table grants and RLS settings are deliberately unchanged. There are no guessed `anon`, `authenticated`, runtime or service-role grant changes. The existing scalar actor/subject references retain their lack of foreign keys to live records, so deletion of an actor or subject does not erase history.

## Inspection and compatibility

Both [account](../../apps/api/src/features/users/account-management-history.ts) and [workforce](../../apps/api/src/features/employees/workforce-management-history.ts) writers validate backend-created actor/role/operation context and append using their caller's Prisma transaction. The shared [database client](../../apps/api/src/lib/db.ts) still serves application reads/writes; `DATABASE_URL` falling back to `DIRECT_URL` does not enforce a separate runtime principal. No reader connection or service authorization was changed.

The [Workflow protection migration](../../apps/api/prisma/migrations/20261031010000_request_workflow/migration.sql) supplies a constant-error, empty-search-path function and conditional table-specific browser protections. The [Attendance foundation](../../apps/api/prisma/migrations/20261113150000_attendance_foundation/migration.sql) supplies immutable audit row guards. Their domain-specific RLS/grants were not copied: management history needs legitimate app SELECT/INSERT, and deployed role ownership and bypass behavior remain unknown.

The new offline upgrade test seeds rows through the actual writers before applying hardening and compares complete records afterward. It then verifies normal writer inserts, actor/role/operation preservation, destructive-statement rejection, business/history rollback when a late insert fails, and rollback when an attempted history deletion follows business and history writes. Deleting the original account subjects, actor and team leaves the original history rows and timestamps intact.

Existing System Logs tests previously deleted temporary malformed/mixed-case/scan fixtures. They now retain append-only fixtures: malformed and scan data use explicit separate date windows, the mixed-case scenario runs after the six-event cases, and the performance diagnostic counts retained rows accurately. The original ordering, six-event pagination, redaction, omitted counts, scan bounds, API responses and read-only assertions remain. No guard is disabled to clean up test data; the disposable database is discarded at teardown.

## Tested privilege model versus deployed guarantees

The real PostgreSQL test creates synthetic roles in a fresh container. These names are test identities, not proposed or assumed production role names.

| Principal                                               | Explicit disposable privileges                                                                  | Observed result                                                                                                                                               |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `history_owner`                                         | NOLOGIN owner of both management tables and the guard function                                  | Privileged ownership remains a bypass through DDL; no ordinary application membership is permitted in this role under the proposed model                      |
| `history_writer`                                        | NOLOGIN group with SELECT/INSERT                                                                | Supplies legitimate writer privileges by membership                                                                                                           |
| `history_runtime`                                       | LOGIN, inherits writer group; no owner membership, superuser, CREATEROLE, CREATEDB or BYPASSRLS | SELECT/INSERT succeed; destructive DML/TRUNCATE and attempts to disable/drop guards, replace the function, drop the protected schema or assume the owner fail |
| `history_reader`                                        | LOGIN, SELECT only                                                                              | SELECT succeeds and INSERT fails                                                                                                                              |
| `history_browser_anon`, `history_browser_authenticated` | LOGIN with schema USAGE and no history privileges                                               | Direct SELECT/INSERT/UPDATE/DELETE/TRUNCATE fail independently of Express                                                                                     |
| `history_overgrant`                                     | Non-owner with SELECT/INSERT/UPDATE/DELETE/TRUNCATE                                             | Destructive statements fail with `23514` despite accidentally broad DML grants                                                                                |
| `history_bypass`                                        | Non-owner with those broad grants and BYPASSRLS                                                 | The immutable triggers still reject destructive statements; BYPASSRLS is separate from trigger ownership                                                      |
| `history_bad_membership`                                | NOINHERIT LOGIN with membership allowing SET ROLE to owner                                      | Can assume owner and disable a guard; this demonstrates why NOLOGIN/NOINHERIT alone are insufficient                                                          |
| Container `postgres`                                    | Disposable superuser                                                                            | Replica-mode DELETE still hits ALWAYS guards; a superuser can nevertheless alter/drop them through privileged DDL                                             |

The fixture transfers ownership away from the runtime, revokes PUBLIC table access, restricts schema creation, grants required schema USAGE and supplies an inherited writer group. These ACL/ownership changes are **test setup only**, not part of the forward migration or changes to a local application database. Tests connect through `psql` as the actual named LOGIN principals rather than relying solely on a superuser session impersonation. The two source tables remain RLS-disabled in that fixture, and tests explicitly assert the unchanged RLS flags. Browser denial here is ACL-based; this phase does not claim an implemented management RLS policy.

The test deliberately grants browser membership in the writer group inside a rolled-back transaction and demonstrates that SELECT becomes available. It separately demonstrates an owner-membership DDL bypass, then rolls back to restore the guard. These negative examples are verified limitations, not allowed production configurations. PostgreSQL [privileges](https://www.postgresql.org/docs/16/ddl-priv.html) and [role membership](https://www.postgresql.org/docs/16/role-membership.html) must be evaluated effectively, including SET ROLE paths.

### Proposed ordinary runtime requirements

An ordinary runtime credential must not own the database/schema/history tables/guard function, inherit ownership authority, SET ROLE into a privileged owner, hold superuser/CREATEROLE authority, or invoke an exposed privileged function that can alter/drop the guards. Do not grant ordinary UPDATE/DELETE/TRUNCATE merely because triggers reject them: retain defense in depth with SELECT/INSERT only on these two tables. Preserve all separately needed business-table grants. Browser roles must not gain history privileges through PUBLIC, direct grants, group membership, views or privileged functions.

The migration cannot safely impose that identity model without knowing deployment roles. A runtime that currently owns the tables is **not certified as protected from disabling guards**. Nor does revoking PUBLIC execution of the function remove an explicitly granted privilege on some other privileged function. The trigger is an append-only guard, not cryptographic proof, administrator resistance, a replacement for RLS, or proof that every inserted history row came from an authorized business mutation. A compromised INSERT-capable credential can fabricate new rows; writer validation and read-side redaction remain necessary.

## Database environments and reproducible checks

### Offline application tests

The new [PGlite hardening suite](../../apps/api/tests/features/system-logs/management-history-immutability.test.ts) reuses `tests/support/pglite-app.ts`. It tests a pre-hardening populated schema followed by the new migration, actual Prisma writers and transactional behavior. Neighboring account, client, employee, department, team and System Logs suites apply every migration through their normal offline harness.

From the repository root:

```powershell
pnpm.cmd --filter @nexus/api test tests/features/system-logs/management-history-immutability.test.ts tests/features/system-logs/management-history.test.ts tests/features/system-logs/system-logs-api.test.ts
pnpm.cmd --filter @nexus/api test
```

### Real disposable PostgreSQL

The explicit [PostgreSQL test entry](../../apps/api/tests/support/management-history-postgres.ts) runs through the existing compiler/native-test runner. It is outside default `*.test.ts` discovery to avoid requiring Docker for ordinary offline tests. It has no live database URL input and is not silently skipped in the full suite: it is a separate explicitly executed validation command.

From `apps/api`:

```powershell
node scripts/run-tests.mjs tests/support/management-history-postgres.ts
```

Prerequisites: authorized access to the local Docker engine and a locally available `postgres:16-alpine` image. The runner uses `--pull=never`, a fixed local engine endpoint, a unique container name/ownership label, an isolated Docker client configuration path, `--network none`, no published ports or host mounts, and a tmpfs PostgreSQL data directory. It ignores inherited remote Docker contexts/host overrides. Readiness targets container-local TCP to avoid the image's temporary initialization server; role assertions use the local PostgreSQL socket. All repository migrations are applied to that new cluster. The tested server reported **16.15**. Teardown verifies the unique ownership label and removes the container and volumes. No production credential, application database or cloud service is contacted.

This is real PostgreSQL SQL/role behavior, not certification of a hosted provider, pooled connection, restore workflow, deployed role or production version. PGlite results alone are not used to claim role/grant isolation.

## Changed files

| File                                                                                                           | Purpose                                                                                                             |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [New migration](../../apps/api/prisma/migrations/20261116130000_management_history_immutability/migration.sql) | Atomic immutable statement guards for both existing tables; no role-specific table ACL/RLS change                   |
| [New PGlite suite](../../apps/api/tests/features/system-logs/management-history-immutability.test.ts)          | Upgrade/data preservation, actual writer compatibility, denied destructive operations, rollback and deleted records |
| [Explicit PostgreSQL test entry](../../apps/api/tests/support/management-history-postgres.ts)                  | Isolated real PostgreSQL privilege/ownership/replication/guard validation                                           |
| [Reader tests](../../apps/api/tests/features/system-logs/management-history.test.ts)                           | Append-only fixture lifecycle with original behavioral assertions retained                                          |
| [API tests](../../apps/api/tests/features/system-logs/system-logs-api.test.ts)                                 | Retained malformed/scan fixtures isolated by date, without destructive cleanup                                      |
| This report and [feature index](README.md)                                                                     | Implementation/validation record and Phase 2D.1B prerequisites                                                      |
| [Module reference](../../.agents/skills/nexus-platform/references/modules.md)                                  | Current local history protection and deployment limitation                                                          |

All pre-existing uncommitted work is preserved. No application writer, reader, frontend component, API contract, production activation gate, Prisma model or prior migration is edited by this phase.

## Validation results

| Validation executed                                                               | Actual result                                                                                                                                                                                      |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three focused System Logs/hardening backend suites, command above                 | 28/28 passed; exit 0, none skipped                                                                                                                                                                 |
| Full backend suite, `pnpm.cmd --filter @nexus/api test`                           | 443/443 passed; exit 0, none skipped; includes account/client/employee/department/team, Attendance/Workflow and System Logs regressions                                                            |
| Explicit real PostgreSQL command above, final fresh container                     | 10/10 passed; exit 0, none skipped; PostgreSQL 16.15 with all repository migrations applied; owned test container removed at teardown                                                              |
| Frontend units, `pnpm.cmd --filter @nexus/web test`                               | 129/129 passed; exit 0                                                                                                                                                                             |
| Existing `system-logs.spec.ts` Playwright suite, Chromium with two workers        | 14/14 passed; exit 0; mobile/tablet/laptop/desktop, Shared navigation/coverage, role denial, privacy, details and pagination                                                                       |
| `pnpm.cmd format`, `pnpm.cmd lint`, `pnpm.cmd typecheck`, `pnpm.cmd build`        | All passed with exit 0; real Prisma/Next generation and API/web production builds included                                                                                                         |
| Documentation relative-link checks, `git diff --check`, preserved baseline hashes | Local targets present, no whitespace errors; only the four intended pre-existing files changed (two System Logs tests, feature index, module reference), plus the four new files inventoried above |

Browser validation started the freshly built standalone web server on a controlled ephemeral loopback port, reused that build, forced non-live mode and ran the existing isolated API response fixtures. No live-regression credentials were loaded; the process environment removed database/signing/storage credentials for this run, and the owned web process was terminated afterward. This is frontend fixture regression, **not real browser-to-Express integration**. No production database, hosted role, external logs sink, production pooler, restore/failover or load test was exercised.

No validation failures remain. The full backend run emitted non-failing `pg` client-concurrency deprecation warnings; Playwright emitted a non-failing color-environment warning. Neither required a change to unrelated application behavior. Full-application browser suites beyond the relevant System Logs spec were not run.

The updated read-adapter performance fixture retains 20,512 rows, including its malformed/out-of-window data, rather than deleting temporary rows. Full-suite service samples were approximately 10–66 ms across global/actor/subject/operation filters; every read met the existing five-second offline smoke bound. This is neither an INSERT benchmark nor production capacity evidence. No index was introduced, and the known global sort, scan-cap, malformed-boundary and snapshot limitations remain unchanged.

## Phase 2D.1B deployment verification prerequisites

No deployment, production grant change or Phase 2D.1B work was performed. Before proposing deployment changes, an explicitly authorized operator must:

1. Export sanitized effective database/schema/table/function ownership, grants/default privileges, role memberships including inheritance and SET ROLE, superuser/BYPASSRLS/CREATEROLE flags, parameter privileges, RLS flags/policies, privileged functions and direct REST/view/publication exposure. Identify actual runtime, migration, service and browser-facing principals; do not infer them from template usernames.
2. Verify that runtime credentials meet the non-owner model above. Resolve the shared client's `DIRECT_URL` fallback risk operationally and determine whether migration credentials are available to a running API. Do not rotate/revoke or narrow the shared runtime's unrelated business privileges speculatively.
3. Assess whether ACL revocations, owner separation and/or RLS are required for the actual provider. Any RLS change needs explicit policies and verified SELECT/INSERT behavior under the actual pool/session model. Enabling default-deny RLS blindly could break management writers/readers; a JWT business role is not automatically a database role.
4. Test the approved actual-role model in a disposable environment matching deployed PostgreSQL version, collation, pooler and extensions. Repeat direct browser denial, ordinary DML/DDL denial, ownership/membership and privileged-function checks, domain mutation/rollback and deleted-identity preservation. Separately verify intended migration-owner capabilities.
5. Review migration lock acquisition and concurrent writers, low-traffic/maintenance scheduling, bounded deployment lock timeouts, backup/restore and replication behavior. ALWAYS guards intentionally reject destructive replication operations too. Review any existing cleanup/retention/restore jobs before installation; ordinary purging or upsert-based history restoration will no longer work. No retention exception or guard-disable workflow is introduced here.
6. Review the migration's atomic transaction and failure recovery in the deployment tool. Record actual applied migration/trigger state, enabled-always flags, function ownership/search path and grant evidence. Do not disable the guards as an ad hoc rollback or rewrite an applied migration.
7. Keep migration authorization separate from System Logs release. Durable logs-access evidence, controlled real UI/API integration, performance qualification and the future production release decision remain blocked as described in Phase 2D.0. A successful local migration/test is not production activation approval.

**Stop after Phase 2D.1A.** Production System Logs access remains disabled; no durable logging infrastructure or Phase 2D.1B implementation is included.

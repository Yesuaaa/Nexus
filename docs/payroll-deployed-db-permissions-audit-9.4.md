# Payroll Phase 9.4 — Deployed Database Permissions Audit

**Overall verdict: PARTIALLY VERIFIED.** The read-only audit tooling and its local PostgreSQL role fixtures passed. The deployed runtime role remains **PENDING AUTHORIZATION** because no deployed database connection was selected or authorized for inspection.

## Executive summary

Phase 9.4 adds a reusable, metadata-only PostgreSQL audit for the role actually used by a supplied connection. It checks connection identity, role flags and memberships, Payroll table and schema ownership, effective permissions, RLS state, approved-snapshot triggers and functions, and the recorded guard migration checksum.

The audit requires `PAYROLL_DB_AUDIT_URL`. It does not load `.env`, fall back to `DATABASE_URL` or `DIRECT_URL`, print a connection string, or attempt DML/DDL. It enables a read-only session and transaction with connection, query, statement, lock, and idle-transaction timeouts. Unavailable catalog checks are reported as **UNVERIFIED**.

## Runtime database configuration

| Item                        | Repository evidence                                                                                                                                                                                                          | What remains unknown                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| API runtime connection      | `apps/api/src/lib/db.ts` uses `DATABASE_URL`, falling back to `DIRECT_URL` only when the former is absent. `compose.prod.yaml` requires and passes `DATABASE_URL`.                                                           | The actual deployed value and its database role were not read.                                          |
| Prisma migration connection | `apps/api/prisma.config.ts` loads dotenv and uses `DIRECT_URL`; `docs/prismaGuide.md` documents it for migrations and Studio.                                                                                                | The release environment’s actual migration role was not read.                                           |
| Pooling                     | The API uses Prisma’s PostgreSQL adapter and the existing `pg.Pool` configuration. Repository documentation describes `DATABASE_URL` as the Supabase transaction-pooler URL and `DIRECT_URL` as a direct/session connection. | The deployed endpoint, pool mode, session settings, and credentials are unverified.                     |
| Privilege assumption        | The API executes under the role supplied by its configured PostgreSQL URL; source does not enforce that it is a restricted, non-owner role.                                                                                  | The deployed runtime role, its memberships, ownership, grants, and effective privileges are unverified. |

No environment files or credential values were inspected. No deployed, staging, or shared database was contacted.

## Permissions matrix

| Check                               | Restricted local fixture                                                                                                                               | Intentionally overprivileged local fixture                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Identity and read-only session      | PASS — the audit observed its login/current role, disposable database, PostgreSQL 16.16, and read-only settings.                                       | PASS — same isolated environment and safeguards.                                                                |
| Role attributes                     | PASS — no superuser, BYPASSRLS, CREATEROLE, CREATEDB, or replication flags.                                                                            | FAIL as expected — CREATEDB was granted.                                                                        |
| Membership and owner paths          | PASS — no membership in a privileged role or Payroll object owner.                                                                                     | FAIL as expected — the role could assume a role owning `PayrollRunItem`.                                        |
| Payroll object ownership and grants | PASS — ordinary SELECT/INSERT/UPDATE/DELETE grants were accepted; no TRUNCATE, TRIGGER, schema CREATE, database CREATE, or ownership path was present. | FAIL as expected — TRUNCATE and TRIGGER were granted and the owner path was present.                            |
| Approved-snapshot protection        | PASS — all four required triggers had the expected tables, events, enabled state, and function source matching the checked-in guard migration.         | PASS — the unsafe privileges were reported separately; they did not alter trigger definitions during the audit. |
| Migration state                     | PASS — the recorded guard migration was successful and its SHA-256 checksum matched the checked-in migration.                                          | PASS — same fixture metadata.                                                                                   |
| RLS                                 | NOT APPLICABLE — none of the inspected Payroll tables enabled row-level security; API authorization remains the access boundary.                       | NOT APPLICABLE.                                                                                                 |

The audit does not treat ordinary row-level DML as automatically unsafe because the database guards reject changes to approved snapshots. TRUNCATE, table/schema ownership, trigger-creation rights, elevated role flags, and assumable owner roles are evaluated separately.

## Findings

### Local audit findings

- **PASS — read-only behavior:** audit sessions set `default_transaction_read_only=on`, use `BEGIN READ ONLY`, and issue catalog `SELECT`s. Savepoints only recover from unavailable catalog checks; the transaction ends with `ROLLBACK`.
- **PASS — protected snapshots:** guard triggers and their function bodies were compared with `20261118160000_payroll_approved_snapshot_guard/migration.sql`; the migration ledger checksum was compared with the checked-out SQL file.
- **PASS — least-privilege classification:** a role with Payroll DML but without ownership or structural privileges passed. A role with database creation, TRUNCATE/TRIGGER, and an assumable table-owner role failed as expected.
- **PASS — no audit-side mutations:** fixture snapshots of Payroll record counts, the table owner, and the associated table state matched before and after each audit. Fixture setup and cleanup were confined to the disposable database.
- **PASS — secret handling:** the audit prints neither a URL nor PostgreSQL error text. Its no-catalog-access test confirms that unavailable metadata is marked UNVERIFIED without leaking the injected secret text.

### Deployed environment

No deployed finding is asserted. The runtime role, effective permissions, trigger state, migration ledger, and RLS configuration there are **UNVERIFIED** pending an explicitly authorized connection using the actual runtime role.

## Execution evidence

The complete local command was:

```cmd
powershell.exe -NoProfile -File apps\api\scripts\verify-payroll-postgres.ps1 -RunFullSuite
```

It completed successfully on Docker Engine 29.7.2 using PostgreSQL 16.16. The verification launcher fingerprinted and rebuilt its local `api-dev` image, used network-isolated databases with no published ports, checked the database identity before running tests, and removed its uniquely labeled containers afterward.

| Stage                                                           | Passed | Failed | Skipped |
| --------------------------------------------------------------- | -----: | -----: | ------: |
| Fresh PostgreSQL with 71 repository migrations                  |      5 |      0 |       0 |
| Upgrade PostgreSQL with approved data, then guard migration     |      5 |      0 |       0 |
| PGlite Payroll API/unit regressions, including audit-unit tests |     35 |      0 |       0 |
| **Total**                                                       | **45** |  **0** |   **0** |

The PostgreSQL cases included the restricted and overprivileged role audit, approved financial immutability, independent-session schedule and approval races, lock/statement timeouts, deadlock recovery, rollback, and interrupted payslip request recovery. The upgrade fixture retained its approved payroll snapshot when the guard migration was installed.

Formatting and `git diff --check` passed in the full-suite launcher. The API test-tree TypeScript compilation, focused audit tests (2 passed), and PowerShell parser check also passed. The audit migration marker in this local test is synthetic: the existing launcher applies migration SQL directly rather than running `prisma migrate deploy`; it exists only to exercise the catalog and checksum checks against the already-applied SQL in the disposable database.

The ownership-label container query returned only its header after completion. The run emitted existing non-blocking Prisma PostgreSQL adapter deprecation warnings and expected logs from tests that deliberately trigger rejected approval, constraint, and authorization paths. Migration SQL also emitted existing enum/identifier notices. No shared database was contacted.

## Run the deployed audit later

First explicitly choose and authorize the target environment. Then securely inject the **deployed API runtime role’s** URL into `PAYROLL_DB_AUDIT_URL` in the approved local/release shell (for example, from the deployment secret manager). Do not paste it into chat or put it on a command line. From the repository root, run:

```cmd
pnpm --filter @nexus/api exec tsx scripts/audit-payroll-db-permissions.ts
```

The script refuses to run without `PAYROLL_DB_AUDIT_URL`; it never substitutes `DATABASE_URL` or `DIRECT_URL`. Exit codes are 0 for PASS, 2 for confirmed FAIL, and 3 for UNVERIFIED or an audit connection/setup failure. A passing local fixture is not evidence about a deployed role.

## Outstanding Phase 9.3 risks

- One earlier invalid-payslip-reference attempt produced an unexplained HTTP 500. The final API regression later returned the expected HTTP 400 for all twelve invalid-reference requests, but the original observation cannot be retrospectively attributed from retained evidence.
- Forced lock timeout, statement timeout, deadlock recovery, and interrupted-request retry passed in the isolated PostgreSQL suite. These tests do not prove behavior under deployed network/database failure conditions.
- A recent browser payroll regression run had **28 passed and 12 failed**, including stale/strict locators and pagination/timeouts. Those failures were not changed by this database audit and still need a focused UI rerun/fix.
- Deployed database privileges and RLS remain unverified. The local fixture does not establish what credentials or grants the deployed API actually uses.

## Component and Code Reuse Report

- Reused `databasePoolConfig` from the API PostgreSQL connection setup for identical Supabase CA validation. The existing config was extracted into `apps/api/src/lib/postgres-connection.ts` so both Prisma and the audit use one source; `db.ts` now imports it.
- Reused the existing `pg` driver, PostgreSQL guard migration, independent-session integration fixture, native Node test runner, and `verify-payroll-postgres.ps1` disposable Docker workflow.
- Added `payroll-db-permissions-audit.ts` as the testable read-only catalog auditor and `audit-payroll-db-permissions.ts` as its explicit-URL CLI entrypoint. No new client library, framework, fixture runner, database migration, or UI component was added.
- Added focused unit coverage for explicit URL/no fallback, safe UNVERIFIED behavior, and secret-safe error reporting; extended the existing PostgreSQL fixture for restricted and overprivileged role classifications.

**Phase 9.4 local verdict: PASS. Deployed-role verdict: PENDING AUTHORIZATION. Overall Phase 9.4: PARTIALLY VERIFIED.**

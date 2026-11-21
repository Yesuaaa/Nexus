# Payroll security and financial integrity audit 9.1

## Scope and authorization inventory

The administrative router is mounted at /api/payroll with authenticated Payroll permissions. The Staff router is mounted separately at /api/staff/my-payroll and uses authenticated Staff identity and employee ownership. The browser provides navigation and carries the session but does not authorize database operations. Prisma transactions enforce write boundaries. The local simulator supplies operational evidence only. The PayMongo adapter is disabled and its declaration is not a transfer route.

| Surface                       | Reads                                                                                                                                                              | Writes and grants                                                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview, Reports and exports | GET overview and reports require Payroll read. GET reports/export requires Payroll manage and reads a bounded snapshot.                                            | None. CSV and XLSX are returned to the authorized caller with private no-store headers.                                                                                                                       |
| Compensation and Settings     | GET compensation list, employee details and history, settings, settings/history, settings/preferences, settings/readiness and settings/audit require Payroll read. | POST compensation versions and settings versions, PUT preferences require Payroll manage. Existing advisory locks and preference revision or schedule version checks protect updates.                         |
| Periods and runs              | GET periods, periods/current, runs, approvals, run details, items and approval-history require Payroll read.                                                       | POST periods, runs, calculate, submit, approve and reject require Payroll manage. Run locks serialize calculation and decision changes. Approval checks the current revision and complete inputs.             |
| Admin documents and requests  | GET payslips, details, preview/download, and requests require Payroll read.                                                                                        | Generate, publish, regenerate and request management require Payroll manage. Published PDFs use immutable source evidence and private response headers.                                                       |
| Staff My Payroll              | GET overview, payslips, PDFs and own requests. Staff identity and ownership apply.                                                                                 | Staff may create, edit, withdraw or message on their own requests within existing transition rules.                                                                                                           |
| Disbursements                 | GET batches and batch detail require Payroll read.                                                                                                                 | Prepare, validate, cancel, destination and simulate require Payroll manage. Destination and simulation additionally require local development enablement. Batch locks and unique attempt keys protect replay. |
| Reconciliation                | GET run reconciliation and decision history require Payroll read.                                                                                                  | POST observations and decisions require Payroll manage and revision-scoped evidence. Decision versions, request IDs, and run/batch locks protect persistence.                                                 |

Admin has Payroll read/manage; Superadmin has Payroll read. Staff has no administrative Payroll grant; Clients have neither grant. Search and pagination narrow already authorized datasets. Run-item reads and payout mutations additionally scope child IDs to their parent. Staff PDFs and requests use employee scope, with published-only checks for Staff payslips.

## Findings register before remediation

| ID      | Severity | Evidence and affected boundary                                                                                                                                                                                                                 | Impact                                                                                                              | Remediation and validation                                                                                                                                                                                 |
| ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PAY-901 | High     | The run approval service conditions its preparer/author check on the payout simulator being off. The run view also advertises demo self-approval. Source inspection confirmed that a payout configuration flag governs approval authorization. | An environment using local simulations can record non-independent approvals as ordinary approved financial records. | Remove the simulator from the approval decision and return false for the existing client flag. Verify the normal independent-review regression and verify the approval branch has no simulator dependency. |

## Additional risks requiring validation or policy

- Schedule writes and period generation use distinct advisory locks. A concurrent schedule change and generation merit a disposable database test. The policy for already-generated periods after a schedule boundary changes must be decided before altering effective-date behavior.
- Approval immutability depends on run state, append-oriented services and existing database constraints. The payslip source triggers protect issued-document evidence. Database-level protection against privileged writes to all approved calculation data before a payslip exists is not established here. A policy and migration audit are needed before adding database triggers.
- The configured remote database identity and Phase 7 migration history remain unverified. Local source and historical fixture results cannot establish remote readiness.

## Financial controls reviewed

Approved selections in documents, Overview and Reports require an approved run and complete current revision with the approval event. The calculator uses integer cents and explicit rounding; aggregation uses Decimal and serialized decimal strings. XLSX emits validated numeric cells for money, literal strings for text, and rejects values beyond its precision limit. CSV quoting guards spreadsheet formulas. Exports use bounded report reads and create no stored server file.

Payout preparation uses the approved snapshot. Simulator controls validate the outcome enum, destination and batch linkage, and persist one attempt per item with UUID idempotency. Simulated success is separate from real paid. Reconciliation distinguishes detection from review and records decisions with independent-review restrictions, evidence and stale-version checks. Administrative closure does not rewrite payout evidence or net amounts.

## Component and code reuse

Reuse-components was reviewed. The remediation uses the existing approval service, authenticated actor, run transaction lock, error helper and response shape. There are no new controls, money algorithms, audit writers or authorization layers.

## Phase 9.1 verification and remediation

**Status: PARTIALLY VERIFIED.** PAY-901 remains remediated in source. The closure brief reports a prior isolated regression run with 9 passed, 0 failed and 0 skipped in about 32.8 seconds, including HTTP 403 approval rejections. These are reported results from the brief. This closure review did not reproduce the run or inspect its raw output. Cross-connection concurrency and database-level immutability remain sign-off blockers.

| Check                                   | Evidence                                                                                                                                                                                                                                                                                                                            | Result                                                                                             |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Independent approval                    | The Phase 3 API fixture checks that the preparer and calculation author each receive a denial with the simulator enabled and disabled, and compares persisted run, revision, employee item, component and audit records. The service no longer imports the simulator and evaluates reviewer identity inside the locked transaction. | HTTP 403 rejections reported in the closure brief. No fresh integration run.                       |
| Approval lifecycle and RBAC             | The same fixture covers independent reviewers, competing decisions, repeated approval, stale revisions and Superadmin, Staff and Client denials. Repeated approval, rejection and recalculation after approval are checked against the persisted approved state.                                                                    | Fixture inspected. Case-by-case output from the reported run was unavailable.                      |
| Schedule updates                        | The Phase 2 API fixture expects one creation and one conflict, a continuous two-version timeline and an audit entry for the winner.                                                                                                                                                                                                 | The fixture sets a single Prisma connection. Cross-session locking and rollback remain unverified. |
| Payroll calculator and period generator | Existing database-free unit suites exercised monetary calculation and period boundaries.                                                                                                                                                                                                                                            | Fresh run: 19 passed, 0 failed, 0 skipped. The runner compiled the TypeScript test tree.           |

Closure checks from the repository root:

```powershell
node apps/api/scripts/run-tests.mjs tests/features/payroll/calculator.test.ts tests/features/payroll/periods.test.ts
node node_modules/.pnpm/prettier@3.9.10/node_modules/prettier/bin/prettier.cjs --check apps/api/tests/features/payroll/phase2.test.ts apps/api/tests/features/payroll/phase3.test.ts apps/api/src/features/payroll/payroll-runs.service.ts
git diff --check
```

Formatting and diff checks passed. Migration review was static.

### Schedule concurrency

The schedule writer takes a transaction advisory lock before reading the latest version. Validation, predecessor end-date update, successor insert and audit write share one transaction. The database enforces unique start dates and valid date ordering. The Settings UI supplies the latest-version precondition. API callers may omit it, in which case the service still enforces strictly increasing effective dates. A genuine concurrent PostgreSQL run using separate connections is required to confirm serialization and rollback. Period generation has a separate year-scoped lock, so schedule changes racing generation remain unverified. Acceptance requires proving that generation uses a consistent version timeline and deciding how to handle already-generated periods after a schedule boundary changes.

The lock keys are `(848222, 1)` for schedule updates and `(848223, year)` for period generation. These keys do not coordinate across workflows. Generation reads the schedule in one query and checks overlaps in the candidate set. The database unique key covers configuration ID, start date and end date. It does not prohibit overlapping persisted ranges across schedule versions. A generation run using an older schedule snapshot therefore remains a credible integrity risk. Neither a conflicting result nor a rollback failure was reproduced, so no lock or business-policy change was made.

### Approved revision immutability

Payroll manage authorization precedes supported mutation routes. The run lock serializes approval and recalculation, recalculation appends a revision only in eligible states, and an approved run cannot be recalculated through that service. Approval events are unique per revision and action, and a migration trigger prevents their modification. Foreign keys and uniqueness constrain revision structure. Separate payslip-source triggers protect employee items and components once a payslip references them. The repository migrations reviewed do not establish a general database immutability rule for approved revision totals or pre-payslip item data. Deployed database grants were not inspected. Before accepting this residual risk, verify effective writer permissions and exercise supported mutation paths against the isolated approved fixture. Any future database guard needs compatibility review for calculation creation, payslip generation and draft regeneration, and migration rollout.

| Record                                     | Protection established in source                                                                                                                      | Remaining evidence                                                                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| PayrollRun and PayrollRunCalculation       | Approval updates run status and appends audit evidence in one locked transaction. Gross, deduction and net totals reside on the calculation revision. | Verify writer privileges and database enforcement for approved revision amounts and snapshots before and after payslip generation. |
| PayrollRunItem and PayrollRunItemComponent | The calculation service creates them during eligible revision creation. The payslip-source trigger guards items and components linked to a payslip.   | Verify database enforcement before a payslip exists. The linked-source trigger does not cover calculation-level totals.            |
| PayrollApprovalEvent and workforce audit   | The decision and both audit writes share a transaction. Approval events have a dedicated immutable trigger and uniqueness constraint.                 | Verify effective database permissions and the full audit record lifecycle in the disposable database.                              |

### PostgreSQL client warning

The installed `pg` 8.23.1 JavaScript client emits the reported warning when a query is submitted while another query is already queued outside pipeline mode. This version still appends the query to its queue and processes queued work serially. The warning establishes a future compatibility issue in the observed run. It does not by itself establish concurrent execution or a transaction-integrity failure. The application's Prisma adapter uses a pool, and the fixture limits that pool to one connection. The source of the enqueue call remains unknown without a deprecation stack trace from the isolated run. No driver, pool, or dependency change was made.

### Runtime blocker and reuse

The repository provides an in-memory PGlite fixture with ephemeral localhost sockets and test database credentials. It sets `DATABASE_URL` to its own socket, clears `DIRECT_URL`, and sets `DATABASE_POOL_MAX=1`. This describes the source configuration. The prior run's actual connection was not independently observed. The security-audit skill requires isolated loopback, read-only source and toolchain, scratch-only writes, an allowlisted environment and resource limits for audit integration execution. Docker engine access was denied in this session. No database tests or migrations ran during this closure review. No shared database was contacted. Defer Phase 9.2 and deployment sign-off until separately connected PostgreSQL verification and approved-record enforcement are complete or explicitly accepted with evidence.

The verification extends the existing Phase 2 and Phase 3 fixtures and uses their API request helpers, authentication, Prisma models and audit records. It adds no production infrastructure or schema changes.

## Phase 9.1B isolated PostgreSQL preparation

**Status: PARTIALLY VERIFIED.** Docker engine access was denied during this review. The host script has been prepared for a disposable schema check. PostgreSQL runtime results, independent-session payroll behavior and direct database enforcement remain pending.

From Windows CMD at the repository root:

```cmd
powershell.exe -NoProfile -File apps\api\scripts\verify-payroll-postgres.ps1
```

The script starts PostgreSQL in a uniquely named Docker container with a per-run ownership label and password, no network and no published ports. All database connections are made inside that container over a Unix socket. Readiness waits for the permanent PostgreSQL process and retries transient connection failures. The script verifies the container network mode and the database name, role and socket before applying the repository SQL files in migration-directory order. It lists the resulting Payroll triggers. Cleanup runs even after a failed startup and removes only a container matching both the per-run label and the exact generated name. The script does not read application connection URLs or modify application environment files. SQL application here checks compatibility on an empty database. It does not exercise Prisma deployment bookkeeping or an upgrade from existing business data.

The existing PGlite API suite remains a separate check. On the Windows host, use the existing runner with Node deprecation tracing to locate the first caller behind the driver warning:

```cmd
cmd /d /c "set NODE_OPTIONS=--trace-deprecation&& node apps/api/scripts/run-tests.mjs tests/features/payroll/phase2.test.ts tests/features/payroll/phase3.test.ts"
```

Review the first project or adapter frame above the `pg` call. A stack trace and a PostgreSQL test run are still needed before attributing the warning or changing query behavior. The container script is test-only setup and schema inspection. It does not execute the Payroll concurrency or approved-record mutation scenarios. No production code, locks, migration SQL, or driver dependency changed in Phase 9.1B. Hold Phase 9.2 until the remaining integrity checks are resolved.

## Phase 9.1C PostgreSQL service regressions

**Status: PARTIALLY VERIFIED.** The optional launcher mode runs a native Node integration test against the disposable PostgreSQL database. It reuses the Dockerfile's `api-dev` target, the Prisma connection factory and both Payroll services. The runner joins only the database container's network namespace, which was created with no network or published ports. The launcher passes a fresh test-only connection and cleans up the two labeled containers by exact generated name and container ID.

From Windows CMD at the repository root:

```cmd
docker build --target api-dev -t nexus-payroll-verification:local . && powershell.exe -NoProfile -File apps\api\scripts\verify-payroll-postgres.ps1 -RunConcurrencyTests
docker ps -a --filter label=com.converyn.payroll-verification
```

Expected output is a verified socket identity, applied migration count, two distinct backend PID diagnostics for each contested operation, and one passing TAP test. Its assertions cover conflicting schedule writers, contiguous version boundaries, same-year period idempotency, month boundaries, committed audit counts, and rollback of schedule and period writes after an injected audit constraint failure. The period test accepts the existing serialization-conflict contract only if an immediate retry adds zero rows. A migration, test assertion or Docker command failure exits nonzero and enters ownership-checked cleanup. Share the TAP failure, backend PID diagnostics and any cleanup warning when reporting a failure.

The developer's Windows host log confirms the disposable database identity, PostgreSQL 16.16, 71 applied migrations and one passing test with zero failures, cancellations or skips. PostgreSQL reported backend PIDs 624 and 625 for the schedule-writer check, and 624 and 623 for the same-year period-generation check. The passing test also confirms rollback after the injected audit-write failure. The output contains no cleanup warning. A separate post-run container listing was not supplied.

The host trace places the driver warning at `PgTransaction.performIO` and `PgTransaction.queryRaw` in `@prisma/adapter-pg` 7.10.1. It identifies the immediate caller into `pg`, but the trace does not identify the originating Payroll operation. The regression passed with the warning present. Schedule updates racing period generation and database enforcement for approved records remain open. The production lock and migration logic was left unchanged.

### Cross-operation historical preservation

The suite also queues a future schedule change alongside regeneration of the preceding historical year. The existing lock fixture holds both advisory keys and releases them after PostgreSQL reports two distinct waiting backend sessions. This case expects both operations to commit, the prior schedule to end immediately before the successor starts, and the historical periods to remain byte-for-byte equivalent as returned by Prisma. It exercises compatible concurrent operations. The scenario in which a schedule edit changes the date boundaries of the year being generated remains open, as does approved financial record immutability. The earlier Windows host transcript predates this additional case.

The updated suite ran on disposable PostgreSQL 16.16 after verifying the test database identity and applying all 71 migrations. It passed with zero failures and skips. PostgreSQL reported backend PIDs 609 and 608 for the cross-operation check, 609 and 608 for the schedule writers, and 609 and 607 for the same-year period generators. Docker returned an empty container listing for the verification ownership label after teardown. The Prisma PostgreSQL adapter emitted the existing queued-query deprecation warning.

The existing Phase 2 and Phase 3 API suites also ran in a network-isolated container with their PGlite fixture and passed 9 tests with zero failures and skips. The calculator and period suites passed 19 database-free tests with zero failures and skips, and the native runner compiled the TypeScript test tree. Formatting and diff checks passed. No production change was needed for the compatible case.

## Phase 9.1D approved financial snapshots

The run lifecycle includes `DRAFT`, `CALCULATED`, `PENDING_APPROVAL`, `REJECTED` and `APPROVED`. Payslip generation is a separate document operation that reads the approved revision. The earlier payslip-source trigger protects employee items and components once a document references them. It did not protect calculation totals and did not lock the source rows at approval.

Migration `20261118160000_payroll_approved_snapshot_guard` protects the run's financial identity and status after approval while permitting its `updatedAt` metadata to change. It rejects inserts, updates and deletes of calculation, employee item and financial component rows belonging to an approved run, including pre-payslip records. Snapshot rows retain their original parent. The approval service takes the same run-row lock used by the database guard before reading the revision, in addition to its existing advisory lock. Draft calculation and downstream document operations retain their existing paths. Earlier migrations were preserved.

The disposable PostgreSQL suite creates and calculates a real run, submits it, approves it as a second admin and generates its payslip using the authenticated API. The database checks use harmless same-value SQL updates for revision totals, employee amounts and component amounts and classifications. They require SQLSTATE `23514` and compare the persisted snapshots and approval events. The suite also checks draft updates, payslip bytes and rollback of a permitted metadata update when a protected write fails in the same transaction. Direct insert and delete behavior is covered by trigger declarations. The suite does not run direct insert or delete probes or test a deployed application role.

| Record or operation                            | Verified result on disposable PostgreSQL 16.16                                                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Revision gross, deductions and net totals      | Same-value SQL updates rejected with `23514` before and after generation.                                                                          |
| Employee gross, deductions and net amounts     | Same-value SQL updates rejected with `23514` before and after generation.                                                                          |
| Component amount and classification            | Same-value SQL updates rejected with `23514` before and after generation.                                                                          |
| Run metadata and transaction atomicity         | Permitted metadata update rolled back after a later rejected financial statement. A direct approved run status-change rejection was not exercised. |
| Draft calculation, employee item and component | Real calculation succeeded, including item and component creation. Same-value draft item and component updates affected one row each.              |
| Approval events and generated payslip          | Approval history and stored payslip bytes compared unchanged after rejected writes. Existing independent-review and RBAC regressions passed.       |

The PostgreSQL launcher verified the database identity, applied all 72 migrations and returned 2 passed, 0 failed, 0 skipped. Independent sessions were observed for all three existing contention checks. The ownership-filtered Docker listing was empty afterward. The existing Payroll API suite in isolated PGlite returned 9 passed, 0 failed, 0 skipped. The calculator and period-generator suite returned 19 passed, 0 failed, 0 skipped. TypeScript test compilation, Prettier and `git diff --check` passed. No shared database was contacted. The Prisma adapter emitted the same queued-query deprecation warning in both database suites. The PostgreSQL trace again identified the adapter call, with no demonstrated transaction failure.

Commands from the repository root:

```cmd
docker build --target api-dev -t nexus-payroll-verification:local . && powershell.exe -NoProfile -File apps\api\scripts\verify-payroll-postgres.ps1 -RunConcurrencyTests
docker ps -a --filter "label=com.converyn.payroll-verification"
docker run --rm --network none --memory 2g --cpus 2 --pids-limit 128 --env NODE_ENV=test nexus-payroll-verification:local sh -ec "pnpm exec prisma generate && node scripts/run-tests.mjs tests/features/payroll/phase2.test.ts tests/features/payroll/phase3.test.ts"
node apps/api/scripts/run-tests.mjs tests/features/payroll/calculator.test.ts tests/features/payroll/periods.test.ts
node node_modules/.pnpm/prettier@3.9.10/node_modules/prettier/bin/prettier.cjs --check apps/api/tests/features/payroll/postgres-concurrency.integration.ts apps/api/src/features/payroll/payroll-runs.service.ts
git diff --check
```

**Final Phase 9.1 verdict: PARTIALLY VERIFIED.** Sign-off remains open for an overlapping schedule edit that changes the generation year's boundaries, direct insert/delete coverage, deployed writer privileges, and a dedicated concurrent approval-versus-write check. Migration verification used a clean database, so deployment against existing data was not exercised.

## Unified Phase 9.1 verification

Run from Windows CMD at the repository root:

```cmd
powershell.exe -NoProfile -File apps\api\scripts\verify-payroll-postgres.ps1 -RunFullSuite
```

The launcher reuses the native Node runner, the existing migration order and the existing PostgreSQL and PGlite fixtures. It verifies Docker access, fingerprints the local image inputs, rebuilds only when those inputs change, then reports each test stage and exits nonzero if a stage fails. Fresh and upgrade PostgreSQL stages have separate disposable databases with the same identity and ownership checks as earlier runs. The upgrade stage applies the first 71 migrations, uses the real application workflow to approve a revision, applies migration 72, compares the approved snapshot and approval events, and exercises the installed protections. The PGlite and unit stage runs without a published port or an application database URL. Formatting and diff checks run from the repository root.

The database verification inspects trigger declarations for INSERT, UPDATE and DELETE and executes same-value UPDATE rejection checks. The restricted test writer has DML access to the revision, lacks superuser and table-owner privileges, and is distinct from the deployed application role. Deployment-specific privileges remain unverified.

| Financial integrity check                                | Executed scope                                                                                                                                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Approved revision totals, employee items and components  | Direct same-value UPDATE rejected with `23514` before and after payslip generation. INSERT and DELETE trigger declarations verified in the catalog. Direct execution of those operations remains unverified. |
| Draft operations, approval history, payslip and rollback | Draft calculation and permitted updates succeeded. Rejected writes preserved approval history, financial data and payslip bytes. The transaction rolled back an earlier metadata change.                     |
| Concurrent approval and SQL update                       | Fresh PostgreSQL observed independent PIDs 607 and 608 waiting. The approval was queued first, committed, and the waiting same-value SQL update was rejected.                                                |
| Restricted database role                                 | A non-owner, non-superuser test role with revision UPDATE privileges received `23514` for its direct update.                                                                                                 |

| Concurrency check                  | Executed scope                                                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Competing schedule updates         | One commit and one stale-version rejection, with continuous schedule history and consistent audit data.           |
| Concurrent same-year generation    | Twelve unique monthly periods. A retry following an allowed serialization conflict must add zero rows.            |
| Compatible cross-operation changes | A future schedule update and historical regeneration completed concurrently without changing the historical year. |
| Conflicting schedule boundary      | An edit that changes the year being generated remains unverified.                                                 |

The final unified run exited zero on PostgreSQL 16.16. Fresh install applied all 72 migrations and passed 2 tests. The upgrade applied 71 migrations before creating approved payroll data, then applied the final migration and passed 2 tests with no changes to the approved snapshot or approval events. The isolated API and unit stage passed 28 tests (9 API, 19 unit). Total: 32 passed, 0 failed, 0 skipped. TypeScript compilation, Prettier and `git diff --check` passed. The ownership-filtered Docker listing was empty. The existing Prisma adapter warning recurred. This pass required no changes to production services, financial formulas or migration SQL.

The preceding run left direct INSERT and DELETE execution, a schedule edit affecting the generated year's boundaries, and the deployed database writer role unverified. The test upgrade uses representative disposable records.

## Local sign-off coverage

The PostgreSQL fixture now evaluates INSERT and DELETE alongside UPDATE for approved revisions, employee items and components. It checks for SQLSTATE `23514` from the snapshot guard before and after payslip generation, rolls back each disposable INSERT or DELETE even if it unexpectedly succeeds, and compares the original financial snapshot, approval history and payslip bytes.

Schedule updates and period generation previously took unrelated locks. Generation now takes a shared lock on the existing schedule key before acquiring its year-specific lock. It reads the schedule at READ COMMITTED after both locks have been acquired, so the query can see a schedule version committed while the transaction waited. The writer rejects an effective date that would change already-generated periods. Unrelated years can still generate concurrently.

The same-year regression uses the existing independent-session lock fixture to queue a July cutover and generation for that calendar year. It checks that the resulting periods cover the year without gaps or overlaps, use the correct schedule version, leave the preceding year unchanged, and regenerate idempotently. Generation may commit first, in which case the conflicting schedule update must reject with HTTP 409.

**Deployed database writer-role verification is deferred to Phase 9.3.** The isolated restricted-role test does not establish deployed permissions.

The final local run of `powershell.exe -NoProfile -File apps\api\scripts\verify-payroll-postgres.ps1 -RunFullSuite` passed on PostgreSQL 16.16. The same-year checks observed independent sessions 608 and 609 on the fresh database and 603 and 602 on the upgrade database. Both passed the date coverage, version ownership, historical preservation and idempotency assertions, and both rejected the six direct INSERT and DELETE probes before generation and again afterward.

| Stage                                            | Result    |
| ------------------------------------------------ | --------- |
| Fresh PostgreSQL, all 72 migrations              | 2 passed  |
| PostgreSQL upgrade with approved data            | 2 passed  |
| Isolated PGlite API regressions                  | 9 passed  |
| Calculator and period-generator unit tests       | 19 passed |
| TypeScript compilation, Prettier, and diff check | Passed    |

**Phase 9.1 verdict: VERIFIED for the local test environment.** All 32 tests passed with zero failures and skips. Docker reported no remaining verification containers. The existing Prisma PostgreSQL adapter deprecation warning recurred. This pass required no new migration, formula change, or access to a deployed database.

# Payroll Phase 9.5 — Outstanding Risk Closure & Reliability Hardening

**Overall verdict: PARTIALLY VERIFIED.** The final unified local test and static-check workflow passed. Browser workflows, the original one-off HTTP 500 cause, an after-commit lost-response simulation, the deployed database TLS endpoint, and deployed database permissions remain unverified. No hosted PostgreSQL database was accessed.

## A. Executive Summary

Phase 9.5 investigates the reported invalid payslip reference response, exercises PostgreSQL deadlock and timeout recovery using the existing disposable database fixture, checks interrupted payslip generation and retry behavior, adds a repeated compensation update case, and verifies the shared connection configuration with synthetic connection strings.

No production payroll behavior or financial policy was changed. The old invalid-reference HTTP 500 has not been attributed; the new bounded cases assert the established 400/404 responses. The deadlock test is explicitly a database-level simulation with non-payroll marker rows, not a forced deadlock through an application Payroll endpoint.

No confirmed production defect was reproduced, so no Payroll service, database migration, or financial policy was changed.

## B. Outstanding Risk Closure Matrix

### Invalid-reference request trace

The administrative payslip detail route applies the existing Payroll read permission; the Staff router applies authentication and the Staff role. Both register `recordIdParam`, which accepts the repository's 1–80 character URL-safe record ID format rather than assuming UUIDs and returns 400 for malformed path IDs. Staff detail queries add the published-slip and employee-ownership scope. `getSlip` uses a scoped `findFirst` and returns the established 404 when no row matches; request-body references go through `isRecordId` and the same ownership-scoped lookup. These paths do not cast arbitrary IDs to UUIDs or dereference a missing record. The tests therefore cover malformed IDs as 400, valid-format missing or foreign IDs as 404, plus the existing unauthenticated and wrong-role responses. The original one-off HTTP 500 has no retained trace and remains unattributed.

| Risk                                            | Original severity   | Reproduction and evidence                                                                                                                                                                                                                   | Root cause / fix                                                                                                                                                                 | Status                                                                            |
| ----------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Intermittent invalid payslip reference HTTP 500 | High, cause unknown | New cases plus existing ownership tests passed: malformed, empty, oversized, valid-format missing, cross-employee, repeated and 12 concurrent malformed requests.                                                                           | Source trace ends in existing validation and scoped lookup; the reported original 500 has no retained trace, so its cause cannot be attributed. No production fix was justified. | **NOT REPRODUCED — ROOT CAUSE UNDETERMINED**                                      |
| PostgreSQL deadlock and transaction recovery    | High                | Two independent PostgreSQL backends (distinct backend PIDs) formed a real `40P01` cycle. PostgreSQL aborted one; only the winner's marker persisted; Payroll row counts stayed unchanged; both sessions accepted a subsequent query.        | Test-only database-level deadlock. No Payroll application retry policy is asserted.                                                                                              | **VERIFIED SAFE UNDER TESTED CONDITIONS**                                         |
| Lock and statement timeout rollback             | High                | Independent-session cases induced `55P03` and `57014`, rolled back staged marker updates, and checked recovery.                                                                                                                             | No global production timeout change.                                                                                                                                             | **VERIFIED SAFE UNDER TESTED CONDITIONS**                                         |
| Interrupted payslip generation and retries      | High                | An authenticated request waited on the run lock, the client aborted, then a retry and parallel repeats left exactly one payslip.                                                                                                            | Existing run lock and unique source-item protection are reused. The test does not simulate a response lost after a proven commit.                                                | **VERIFIED SAFE UNDER TESTED CONDITIONS**                                         |
| Duplicate/ambiguous operation handling          | Medium              | Concurrent run creation/calculation, repeat approval, period and payslip generation, plus a repeated effective-dated compensation update were covered by existing and extended API tests.                                                   | Conflicts use the established 409 contract. Recalculation intentionally creates a new revision when allowed and is not universally idempotent.                                   | **VERIFIED SAFE UNDER TESTED CONDITIONS**, with after-commit ambiguity unverified |
| Connection and TLS regression                   | High                | Synthetic local, Supabase-style and external TLS strings passed through the existing pool configuration test. A local `pg.Client` TLS handshake using the Supabase CA settings rejected a runtime-generated self-signed server certificate. | No hosted TLS endpoint or production certificate chain was contacted. The negative case uses loopback and a test certificate.                                                    | **VERIFIED SAFE UNDER TESTED CONDITIONS**; deployed endpoint **UNVERIFIED**       |
| Browser workflows                               | Medium              | The repository has payroll Playwright specs, but this environment has no installed Playwright browser binaries.                                                                                                                             | No framework added.                                                                                                                                                              | **UNVERIFIED** unless a supported browser becomes available during execution.     |

## C. Failure-Recovery Evidence

### Deadlock

The PostgreSQL test uses two `pg.Client` connections and checks their distinct `pg_backend_pid()` values. It waits until PostgreSQL reports the first backend blocked on an advisory lock before starting the second request, avoiding arbitrary timing as the synchronization mechanism. PostgreSQL must reject exactly one transaction with SQLSTATE `40P01`. Both sessions are queried after resolution; marker rows and Payroll row counts are checked.

This establishes transaction rollback and session recovery for a controlled database deadlock. It does **not** establish that a particular Payroll HTTP operation automatically retries or converts a deadlock into a business-level response.

### Timeouts and rollback

The existing isolated integration case uses a lock timeout (`55P03`) and statement timeout (`57014`) with disposable marker updates. It verifies the aborted transaction leaves no partial marker change and that later database operations work. The existing payslip generation failure injection also verifies that an intermediate database constraint failure leaves no payslip/audit row or changed approved snapshot before retry succeeds. Its intentional HTTP 500 is an injected failure, separate from the unexplained invalid-reference observation.

### Interrupted requests and retry safety

The existing PostgreSQL test aborts a real authenticated HTTP client while the generation request is waiting behind a database lock. After releasing the lock, the same operation is retried and concurrent repeats are issued. Expected result: a single persisted payslip and no additional changes from repeats.

Existing API tests distinguish operation contracts:

- Concurrent draft-run creation and calculation are serialized; duplicates receive conflict responses rather than duplicate records.
- Repeated approval is rejected and existing actor separation remains enforced.
- Payslip generation uses the run lock and unique item relationship; retries do not create another document.
- Repeating an effective-dated compensation update is rejected with `409` and does not create a second version.
- Recalculation of an eligible run is a deliberate new calculation revision. A caller must not treat it as a blind idempotent retry.
- The current interruption test aborts the client while the request is waiting, not after a database commit whose response was lost. That ambiguous-after-commit network condition remains unverified.

## D. Database Connection Verification

`databasePoolConfig` and the existing `pg.Pool`/Prisma adapter remain the sole connection setup path. Tests use synthetic connection values and do not connect to a hosted database.

- Local PostgreSQL connection strings retain their original query parameters and receive no forced TLS object.
- Supabase-style hosts remove `sslmode` and `sslrootcert` URL parameters that can override the TLS object. The configured CA set is provided with `rejectUnauthorized: true`.
- A disposable loopback TLS server with a generated self-signed certificate confirmed the actual PostgreSQL client rejects an untrusted certificate when passed the application's Supabase-style CA options.
- Other TLS connection strings retain the driver-supported URL options.
- `pg.Pool` continues to use `DATABASE_POOL_MAX` (default 10) and a 5-second connection timeout. PostgreSQL concurrency tests use a bounded pool and independent direct sessions.
- The permission auditor still requires its explicit `PAYROLL_DB_AUDIT_URL` and does not fall back to runtime or migration credentials.
- The current hosted server certificate, hostname, and TLS handshake remain unverified because external databases were not contacted.

## E. Browser Verification

**UNVERIFIED.** Payroll Playwright specs exist, but no browser binaries were found in the configured Playwright browser cache. No browser framework or browser downloads were added. Future smoke checklist: Payroll navigation; compensation validation; periods and run navigation; calculate/approve; payslip generation/read; loading and error states; Admin/Superadmin/Staff/Client restrictions. Existing prior browser failures (28 passed, 12 failed in the Phase 9.4 report) remain unresolved until a supported browser rerun is available.

## F. Execution Results

**Unified command:**

```powershell
powershell.exe -NoProfile -File apps\api\scripts\verify-payroll-postgres.ps1 -RunFullSuite
```

The expanded entrypoint runs fresh PostgreSQL migrations and concurrency/security tests, the representative upgrade fixture, the PGlite API/unit suite, API and web TypeScript checks, the installed ESLint binary, Prettier, PowerShell syntax parsing, and `git diff --check`. It uses only uniquely named/labeled disposable PostgreSQL containers and preserves existing development containers and databases.

| Stage                                 | Result                                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Fresh PostgreSQL migrations and tests | **PASS** — PostgreSQL 16.16; 72 migrations; 5 passed, 0 failed, 0 skipped                                                       |
| Existing-data upgrade fixture         | **PASS** — 71 migrations before fixture, then the final guard migration; 5 passed, 0 failed, 0 skipped; approved data preserved |
| PGlite API and unit tests             | **PASS** — 37 passed, 0 failed, 0 skipped                                                                                       |
| API TypeScript                        | **PASS**                                                                                                                        |
| Web TypeScript                        | **PASS**                                                                                                                        |
| ESLint                                | **PASS**                                                                                                                        |
| Prettier                              | **PASS** on the final full-suite rerun                                                                                          |
| PowerShell syntax                     | **PASS**                                                                                                                        |
| `git diff --check`                    | **PASS** on the final full-suite rerun                                                                                          |
| Docker cleanup                        | **PASS** — verified after the final run                                                                                         |

**Consolidated automated tests: 47 passed, 0 failed, 0 skipped.** The final full command exited 0. An intermediate TLS-test attempt initially tried to resolve its synthetic hostname; the test was corrected to connect to loopback while retaining the application-generated TLS options, and the focused TLS case plus complete suite then passed.

The run emitted the existing Prisma PostgreSQL adapter deprecation warning about overlapping `client.query()` calls, expected error logs from intentional constraint-failure and authorization tests, and existing migration notices for duplicate enum labels and a truncated identifier. No package-manager signature failure occurred. A separate host-only PGlite attempt was blocked by `EACCES` opening its local test socket; the isolated Docker suite above executed those tests successfully. The final verification-container label query returned no containers.

## G. Remaining Limitations

- The original invalid-reference 500 has no retained request trace and may remain unattributed even if all bounded retries pass.
- Browser workflows remain unverified unless a supported browser runtime is available.
- The exact ambiguous case of a commit succeeding while the HTTP response is lost is not simulated by the current interrupted-request test.
- Deployed runtime writer-role privileges remain deferred to the separately authorized deployment audit; local disposable roles do not establish deployed grants.
- Leave-request pay treatment is unsupported; existing calculation behavior blocks unsupported cases rather than inferring a policy.
- PostgreSQL deadlock recovery coverage is database-level, not an application-endpoint deadlock test.

## H. Component and Code Reuse Report

- **Payroll services and endpoints:** Existing payroll document, run, compensation, approval, period-generation and authorization paths are exercised. No production service or endpoint was added.
- **Validators and authorization:** Existing `isRecordId`, `recordIdParam`, authenticated Staff/Admin fixtures, employee ownership scope and standard 400/404/401/403 error contracts are reused.
- **Database connection:** Existing `databasePoolConfig`, `pg.Pool`, Prisma PostgreSQL adapter, and explicit payroll audit URL are reused; no second connection factory was created.
- **Fixtures and runner:** Existing native `node:test` runner, PGlite app fixture, authenticated API helper, Prisma fixture, `pg` dependency, PostgreSQL migration SQL, concurrency integration test and disposable Docker launcher are extended.
- **New abstractions:** None. The new tests add narrowly scoped assertions to existing fixtures, and the full-suite launcher adds static-check stages without introducing a new framework or helper library.

# Payroll Phase 9.2 regression report

## Workflow inventory and coverage

These are API integration and database tests. Browser UI execution is unverified.

| Implemented workflow                                    | Existing coverage reused                                                                                                                                                                                                                                                           | Remaining evidence                                                                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Settings, schedule versions and periods                 | Phase 2 HTTP settings writes and permission checks; Phase 3 generation and duplicate prevention; PostgreSQL monthly, semi-monthly and boundary races                                                                                                                               | None for the listed API assertions                                                                                                |
| Compensation versions, recurring components and history | Phase 2 HTTP writes, invalid effective dates, concurrent overlapping versions and authorization; Phase 3 calculation snapshot selection and recalculation after an effective-dated future rate change                                                                              | PASS                                                                                                                              |
| Attendance and leave inputs                             | New Phase 3 HTTP calculation reads persisted policy assignments, complete daily attendance, hourly unpaid breaks, missing attendance, open sessions and employee ON_LEAVE status. Calculator unit tests also check overlapping attendance                                          | Leave-request pay treatment is not implemented. Attendance fixtures use persisted records rather than the attendance creation API |
| Draft run, totals and revision history                  | Phase 3 HTTP run creation, calculation, recalculation, complete-only totals, history reads, conflicts and rollback                                                                                                                                                                 | None for the listed API assertions                                                                                                |
| Approval                                                | Phase 3 real HTTP submit, approve, reject, stale revision and role checks; simulator-on and off denials; PostgreSQL approval versus direct SQL                                                                                                                                     | None for the listed API assertions                                                                                                |
| Payslip generation, publication and retrieval           | Phase 5 authenticated generation, injected database failure with financial/audit rollback assertions, repeated generation, preview, draft regeneration, publication and private retrieval; PostgreSQL creates a calculated and independently approved run and generates a document | PASS                                                                                                                              |
| Staff self-service                                      | Phase 5 own published document, other employee, unlinked, inactive, deleted, client and unauthenticated boundaries, request lifecycle                                                                                                                                              | None for the listed API assertions                                                                                                |
| Administrative pages                                    | Existing React pages and hooks call the administrative routes                                                                                                                                                                                                                      | Browser navigation, rendering, keyboard and download interaction remain unverified                                                |

The implementation uses conservative calculation rules. Whole-month monthly pay and fixed components are supported. Daily and hourly earnings depend on stored attendance policies. Unsupported proration, overtime pricing and unresolved inputs produce explicit blocks or review states. Unit results do not establish full HTTP attendance integration.

## Execution

From Windows CMD at the repository root:

```cmd
powershell.exe -NoProfile -File apps\api\scripts\verify-payroll-postgres.ps1 -RunFullSuite
```

The existing entrypoint runs fresh PostgreSQL, an upgrade containing approved payroll, native Node API and unit suites, TypeScript compilation, formatting and diff checks. Phase 5 was added to the existing API stage. Its approval setup now submits and approves through the real authenticated endpoints with a second administrator. The rest of its document and self-service assertions reuse the existing fixture.

Both database environments are disposable. PostgreSQL has no published ports and verifies database identity before applying migrations. PGlite replaces the database connection with an in-memory database and localhost socket. Ownership labels constrain container cleanup.

## Routes and boundaries

Administrative requests use the authenticated `/api/payroll` router. Settings/history/version routes and compensation employee-version routes persist effective-dated configuration. Period routes generate scheduled dates. Run, calculation, item, submission, approval and rejection routes operate on revision snapshots. Document generation, publication, preview and download routes use those approved snapshots. Payroll read permits Admin and Superadmin reads; management writes require Admin management permission.

Staff uses the separate `/api/staff/my-payroll` router and employee ownership for published documents and personal requests. Its identity comes from authentication. The Phase 5 fixture exercises own and other employee documents alongside inactive, deleted, unlinked, client and unauthenticated accounts.

The Payroll feature pages use existing hooks and API clients for settings, compensation, runs, approvals, disbursements and document history. The API regressions do not establish browser rendering or navigation behavior.

## Component and code reuse

Reused the existing Phase 2, Phase 3 and Phase 5 tests, PGlite app fixture, authentication helpers, PostgreSQL regression suite, migration order, Docker target and native Node runner. No new test framework, component, service or helper was introduced.

## Verdict

**VERIFIED for the implemented local API and database workflows listed above.** Approved and unresolved leave requests have no separate Payroll financial treatment in the calculator input adapter. Their financial treatment is NOT IMPLEMENTED; ON_LEAVE employees receive the existing LEAVE_POLICY_UNAVAILABLE blocker. Browser UI execution remains UNVERIFIED. Deployed writer-role verification remains deferred to Phase 9.3.

## Actual results

The final unified run completed on the local Docker Engine with PostgreSQL 16.16:

| Stage                                                                                   | Passed | Failed | Skipped |
| --------------------------------------------------------------------------------------- | ------ | ------ | ------- |
| Fresh PostgreSQL security, concurrency and approved snapshots                           | 2      | 0      | 0       |
| PostgreSQL upgrade preserving approved financial records                                | 2      | 0      | 0       |
| PGlite HTTP integration tests, including persisted attendance and document self-service | 11     | 0      | 0       |
| Calculator and period-generator unit tests                                              | 19     | 0      | 0       |
| Total                                                                                   | 34     | 0      | 0       |

The native runner compiled the TypeScript test tree. Prettier and `git diff --check` passed. All four verification stages printed PASS and the command exited zero. The post-run ownership-label listing contained only its header, confirming cleanup. Phase 9.1's direct approved INSERT/UPDATE/DELETE guards, independent-session contention, upgrade and rollback coverage remained passing.

Expected negative API cases emitted 403 and 409 logs. The new generation failure probe deliberately caused PostgreSQL constraint error 23514 and HTTP 500, verified that no document or audit entry committed and that the approved snapshot stayed unchanged, removed its disposable constraint, then generated successfully. The existing Prisma adapter queued-query deprecation warning recurred. No application defect requiring production changes was found.

An earlier attempt on the host passed the 19 unit cases but could not connect to the PGlite loopback socket (EACCES); it was not counted as a successful API run. Docker Engine was initially stopped. After starting its installed application, the complete workflow ran inside the isolated containers and passed.

The coverage matrix's existing Phase 2/3/API and PostgreSQL assertions are PASS. Persisted attendance daily/hourly amounts, missing attendance, open sessions and leave blocker assertions are PASS. Overlapping attendance and incomplete-workday rules have passing unit coverage. Attendance record creation itself was seeded through Prisma, and its user-facing workflow was not exercised here.

## Files changed

- `apps/api/tests/features/payroll/phase3.test.ts` adds the historical compensation recalculation assertions and persisted-attendance HTTP scenario.
- `apps/api/tests/features/payroll/phase5.test.ts` uses authenticated submit/approve and verifies generation failure rollback.
- `apps/api/scripts/verify-payroll-postgres.ps1` includes Phase 5 in the full existing workflow and formats both changed test files.
- `docs/payroll-regression-9.2.md` records inventory, coverage, execution and scope.

No business formulas or production services changed during Phase 9.2.

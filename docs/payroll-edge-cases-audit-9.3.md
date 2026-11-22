# Payroll edge cases and resilience audit 9.3

## Prioritized risk inventory before new tests

| Scenario and operation                                  | Severity and likelihood               | Impact and existing safeguards                                                                  | Existing evidence                                                | Action                                                                           |
| ------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Invalid or overflowing compensation money               | HIGH, plausible malformed input       | Incorrect financial records. String-only bounded decimal validation and integer-cent calculator | Phase 2 rejects precision errors; calculator exact rounding      | Extend boundary matrix for negative, zero, nonfinite, large and malformed values |
| Deductions exceed earnings or aggregate overflow        | HIGH, plausible configuration         | Incorrect finalized net. Calculator has blocks and bounded totals                               | Ordinary fixed components covered                                | Verify blocks and zero components with exact strings                             |
| Effective-date races and historical mutation            | HIGH, concurrent administration       | Duplicate histories or altered approved evidence. Locks and immutable database snapshots        | PostgreSQL and Phase 2/3 passing regressions                     | Reuse full existing suite                                                        |
| Concurrent document generation/retry                    | HIGH, client retries                  | Duplicate or conflicting PDFs. Run advisory lock, unique item link and atomic generation        | Sequential idempotency and injected failure covered              | Extend existing Phase 5 generation to concurrent requests                        |
| Cross-employee disclosure or self approval              | CRITICAL, malicious request           | Sensitive data exposure or unauthorized approval. Server permission, ownership and actor checks | Phase 3/5 identity and simulator checks                          | Reuse existing suite                                                             |
| Attendance overlap, open sessions and unsupported leave | HIGH, operationally plausible         | Incorrect time-based earnings. Policy snapshots, validation and explicit blockers               | API persisted attendance and unit overlap, break and leave cases | Reuse and inspect remaining unsupported cases                                    |
| Timeout, deadlock and interrupted response              | HIGH, environment-dependent           | Incomplete state or ambiguous retry. Transactions, unique keys and idempotency                  | Constraint failure rollback and independent-session lock tests   | Explicit residual coverage gap for forced deadlock and timeout                   |
| Deployment writer privileges                            | CRITICAL impact, deployment-dependent | Trigger bypass by privileged owner. Local restricted writer check                               | Local role only                                                  | Deployed database access excluded by scope; retain unverified                    |

This register describes risk and test priorities. It does not establish vulnerabilities. No new confirmed production defect was identified at inventory time.

## Existing boundaries

The reused Phase 9.1 report covers direct approved INSERT/UPDATE/DELETE protection, upgrade compatibility, independent approvals and schedule/generation coordination. Phase 9.2 covers API run lifecycle, historical compensation recalculation, persisted daily/hourly attendance, payslip rollback and Staff ownership.

The schema accepts positive string base rates, nonnegative string components, at most two decimal places and at most ten integer digits. The calculator uses integer cents with a separate database-scale aggregate limit. The validator accepts separately identified components with matching names; no business uniqueness rule was found. The product decision is that duplicate names are allowed and remain separate line items; no deduplication is introduced. Leave-request pay treatment is unsupported. ON_LEAVE blocks payroll under the existing contract. Manila calendar dates have no daylight-saving policy in the implemented Payroll contract.

## Execution

Use the existing command from Windows CMD at the repository root:

```cmd
powershell.exe -NoProfile -File apps\api\scripts\verify-payroll-postgres.ps1 -RunFullSuite
```

The first full run passed the new monetary cases and both PostgreSQL stages but failed the Phase 5 fixture when an invalid payslip reference returned HTTP 500 instead of 400. The isolated Phase 5 reproduction then passed all its assertions. The final complete rerun also passed. The cause of the first result remains unattributed; no production fix was justified from that evidence.

New monetary assertions cover negative, zero, nonfinite, numeric rather than string, empty, exponential, over-precision and oversized rates/components. They check the accepted schema maximum and zero component, and exact calculator results at one cent, deductions exceeding gross, and aggregate overflow.

Those monetary assertions passed in the first full run. The final fresh and upgrade PostgreSQL runs also passed the independent-session payslip race. Fresh generation waited on PIDs 631 and 628; upgrade generation waited on 610 and 613. Both returned changed counts [0, 1], exactly one persisted document and unchanged source snapshots.

The Phase 5 fixture now submits two concurrent generation requests and requires exactly one persisted document and changed counts of zero and one. The PostgreSQL fixture additionally queues two real HTTP generation calls behind the existing run advisory lock and requires two distinct waiting backend PIDs before release. This extends the existing helper.

The current final full command exited zero. Fresh PostgreSQL 16.16 applied all 72 migrations and passed 4 tests. The upgrade applied 71 migrations, created approved data, applied migration 72 and passed 4 tests. PGlite API and unit checks passed 33 tests, including cross-midnight payroll with overnight review enabled and disabled, and same-name components counted as separate line items. Total: 41 passed, 0 failed, 0 skipped. TypeScript test compilation, Prettier, PowerShell syntax and `git diff --check` passed. The final ownership-label container listing had only its header. No shared database was contacted. The recurring Prisma adapter queued-query warning remained present, and the intentional generation failure emitted the expected constraint error and HTTP 500 before a successful retry.

The failed earlier full run had 35 passing tests and one failing API fixture across the PostgreSQL and API/unit stages. The isolated reproduction passed 1 test. Those attempts are recorded separately from the final successful counts.

## Component and code reuse

Reused the calculator input fixture, compensation validator, Phase 5 HTTP helper, authentication, PGlite fixture, PostgreSQL guard and concurrency tests, migration SQL, native Node runner and disposable Docker launcher. No UI change or new framework is required.

## Coverage matrix

| Area                      | Existing evidence retained                                                                                                    | New assertion or residual gap                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Monetary representation   | Phase 2 API invalid precision/nonfinite input; exact stored decimal snapshots                                                 | Validator matrix and calculator aggregate boundaries                                                                    |
| Compensation history      | Duplicate dates, concurrent versions, mid-period revision blocker and future-rate historical recalculation                    | Duplicate names are permitted; separately identified allowance and deduction rows are preserved and summed individually |
| Attendance                | Persisted daily/hourly amounts, unpaid breaks, missing/open time, unit overlaps, incomplete days, and overnight review on/off | Corrections racing calculation remain unverified                                                                        |
| Leave                     | ON_LEAVE blocks under LEAVE_POLICY_UNAVAILABLE                                                                                | Approved/pending leave pay formulas unsupported                                                                         |
| Calendar                  | Leap February, cutoffs, effective boundaries, historical preservation and same-year races                                     | Existing generator and PostgreSQL suites reused                                                                         |
| Approval and revisions    | Self-approval, actor/role isolation, stale and competing decisions, direct approved writes                                    | Existing suites reused; forced deadlock and timeout recovery unverified                                                 |
| Documents                 | Approved source generation, immutable bytes, failure rollback, own/cross-user retrieval and inactive accounts                 | Concurrent PGlite retries plus new independent PostgreSQL session test                                                  |
| API validation and errors | Missing, invalid enum/reference/date, unsupported request ordering and safe rejection cases                                   | One unexplained HTTP 500 in first full run; isolated retry passed                                                       |
| UI and deployment         | Source patterns inspected through existing feature usage                                                                      | Playwright not run because host pnpm signature verification is blocked; no deployed database contact                    |

## Confirmed defects

No reproducible production defect was established from the new monetary boundary cases. The first unexpected HTTP 500 is a failed verification observation. Its impact and root cause cannot be classified confidently from the isolated passing rerun. No financial policy or production code was changed to conceal it.

## Files changed in this pass

- `apps/api/tests/features/payroll/calculator.test.ts` extends validator and financial boundary tests, including distinct same-name component totals.
- `apps/api/tests/features/payroll/phase3.test.ts` verifies API payroll results for cross-midnight work with overnight review both disabled and enabled.
- `apps/api/tests/features/payroll/phase5.test.ts` verifies simultaneous document requests and persisted idempotency.
- `apps/api/tests/features/payroll/postgres-concurrency.integration.ts` verifies the same generation race using independent database sessions.
- `apps/api/scripts/verify-payroll-postgres.ps1` includes the changed calculator file in formatting checks.
- `docs/payroll-edge-cases-audit-9.3.md` records the risk inventory, evidence and limitations.

## Limitations and verdict

**Current verdict: PARTIALLY VERIFIED.** The forced deadlock, timeout and interrupted-request checks described below have passed on fresh and upgraded PostgreSQL. Browser UI workflows and deployed writer permissions remain unverified. The isolated loopback fixture does not establish externally deployed permission revocation behavior. The payroll API now verifies cross-midnight work under both overnight-review settings. An attendance correction racing payroll calculation remains untested. Unsupported leave financial policy remains outside implemented formulas. The original single HTTP 500 cannot be conclusively attributed from its retained trace.

## Remaining resilience verification

The existing PostgreSQL fixture has been extended with two focused subtests. The timeout test uses independent sessions, holds the target advisory lock, writes a disposable account marker in another transaction, and requires lock timeout `55P03`. It rolls back and compares the original record, then repeats with a statement timeout `57014`. The deadlock test acquires opposite advisory keys in two sessions, requires exactly one `40P01` victim, rolls back both transactions and verifies both sessions accept subsequent queries. These tests establish PostgreSQL transaction and connection recovery; they do not claim to force a specific Payroll API to deadlock.

The existing payslip test now starts a real authenticated generation request behind its run lock, observes the waiting transaction, aborts the HTTP client and releases the lock. A retry must succeed and leave exactly one payslip. Either the disconnected request or its retry may commit first. Subsequent parallel retries must change zero records. Financial snapshots and document bytes remain checked by the existing assertions.

The invalid-reference regression sends twelve requests in three rounds of four concurrent requests. Every response must be exactly HTTP 400 with `{"error":"Invalid payslip reference"}`, and the persisted request count must remain unchanged. The response body is included in any status assertion failure for diagnosis.

These additions reuse the existing `pg` dependency, native Node subtests, Prisma fixture, run-lock waiter and API authentication. No production helper or bypass was introduced.

The first extended run passed all 8 PostgreSQL cases but the API fixture failed with `Connection terminated unexpectedly`. Disabling idle client retirement did not resolve it, so that attempted change was reverted. PGlite protocol tracing located the next failure at the first database query after a deliberately rejected payslip update. The fixture now encloses each intentional direct immutability violation in an explicit Prisma transaction, requiring rollback before subsequent assertions. No production connection factory or socket settings changed. The earlier single HTTP 500 cannot be conclusively attributed without its original connection trace.

## Final recovery run

After the rollback correction, the isolated Phase 5 reproduction passed. The latest complete `-RunFullSuite` workflow exited zero:

| Stage                                     | Passed | Failed | Skipped |
| ----------------------------------------- | ------ | ------ | ------- |
| Fresh PostgreSQL 16.16, all 72 migrations | 4      | 0      | 0       |
| PostgreSQL upgrade with approved data     | 4      | 0      | 0       |
| PGlite API and unit regressions           | 33     | 0      | 0       |
| Total                                     | 41     | 0      | 0       |

Lock timeout, statement timeout, deadlock recovery and interrupted HTTP retry all passed on fresh and upgraded PostgreSQL. All twelve invalid-reference requests returned exactly the expected 400 body and created no request records. Both original financial immutability and document-byte assertions continued passing. TypeScript compilation, formatting and diff checks passed. The ownership-label Docker listing was empty after cleanup. The existing Prisma adapter queued-query deprecation warning remained present.

The earlier full attempts with the connection failure are retained as failed evidence rather than counted in these final results. Temporary diagnostic logging and the unsuccessful idle-pool modification were removed. The local fixture correction is verified by the isolated reproduction and complete run; the original single HTTP 500 lacks sufficient retained evidence for a conclusive retrospective attribution.

**Phase 9.3 remains PARTIALLY VERIFIED for overall sign-off.** The automated recovery, overnight payroll, and duplicate component checks pass locally. Deployed database permissions and browser workflows remain unverified. The original HTTP 500 and an attendance correction racing payroll calculation remain documented limitations. Duplicate component names are confirmed as allowed and distinct.

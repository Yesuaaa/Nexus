# Payroll edge case verification report

Reviewed on 2026-11-21 at commit `711cf958fc0755829cc081562a737bfdd22e800b`. The local checks confirm that the main Payroll safeguards are still present. Approved leave requests still have no Payroll calculation treatment, and the production Docker web target still fails to build. Three follow-up scenarios remain unverified. The results below follow up on the [Phase 9.3 audit](payroll-edge-cases-audit-9.3.md).

## Verified safeguards

| Scenario                                 | Status at the reviewed commit           | Observed result                                                                                                                                                                                                                                                                                                |
| ---------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid compensation money               | Safeguard present                       | The validator rejected negative and zero base rates, invalid precision, oversized values, and malformed representations. Zero-valued components were accepted.                                                                                                                                                 |
| Excess deductions and amount overflow    | Safeguard present                       | Deductions above gross and employee-level overflow blocked final amounts. A separate API probe used individually valid employee amounts whose combined total exceeded the run limit. The API returned HTTP `422`, and the draft retained zero calculation revisions.                                           |
| Effective dates and approved history     | Safeguard present                       | Concurrent compensation edits did not create overlapping versions. Same-name components remained separate and were counted individually. Fresh and upgraded PostgreSQL rejected direct changes to approved snapshots before and after payslip generation. The upgrade preserved the existing approved records. |
| Duplicate payslip generation and retry   | Safeguard present                       | Concurrent generation left one payslip. An injected write failure rolled back, and retry succeeded. An authenticated request interrupted while waiting on the run lock could be retried without creating a duplicate.                                                                                          |
| Cross-employee access and self-approval  | Safeguard present                       | Staff access was limited to their own published payslips. The run preparer and the calculation author were denied approval of that revision.                                                                                                                                                                   |
| Invalid payslip references               | Historical HTTP `500` not reproduced    | All 12 concurrent malformed-reference requests returned the expected HTTP `400` and created no request records. The original intermittent error remains unattributed.                                                                                                                                          |
| Attendance and calendar boundaries       | Safeguards present for tested inputs    | Missing, open, overlapping, and incomplete attendance triggered the expected review or blocker. Unpaid breaks reduced hourly earnings, and overnight work followed its configured review rule. Leap February, cutoff boundaries, and concurrent period generation passed.                                      |
| PostgreSQL timeout and deadlock recovery | Safeguard present at the database level | Fresh and upgraded PostgreSQL rolled back the timed-out writes, resolved a deadlock with one victim, and accepted subsequent queries. Automatic retry by a Payroll endpoint after a deadlock remains unverified.                                                                                               |
| Restricted writer and TLS handling       | Local safeguards present                | The read-only auditor distinguished restricted and privileged roles in disposable PostgreSQL. The local TLS fixture rejected an untrusted certificate. Deployed grants and TLS require a separate check.                                                                                                       |

The test sources cover [compensation and money](../apps/api/tests/features/payroll/calculator.test.ts), [calculation and approval](../apps/api/tests/features/payroll/phase3.test.ts), [payslips and ownership](../apps/api/tests/features/payroll/phase5.test.ts), and [independent PostgreSQL sessions](../apps/api/tests/features/payroll/postgres-concurrency.integration.ts).

## Issues still present

### Approved leave has no Payroll calculation treatment

An active monthly employee with one approved unpaid leave day and complete attendance on every other scheduled day remained at a provisional gross and net of ₱25,000. The API marked the employee `REVIEW_REQUIRED` and reported `ATTENDANCE_RECORD_MISSING` for the leave day. It recorded no leave-specific blocker or deduction. A control employee with complete attendance was `CALCULATED` at the same amount. A revision with unresolved review items cannot be submitted. The separate `Employee.status = ON_LEAVE` condition still raises `LEAVE_POLICY_UNAVAILABLE`. [Calculation inputs](../apps/api/src/features/payroll/payroll-runs.service.ts) · [Calculator](../apps/api/src/features/payroll/payroll-calculator.ts)

### The production Docker web target fails

`docker build --target web .` failed with TypeScript error `TS2307`. The web build type-checks the Phase 5 browser spec, which imports the API's `payslip-pdf` source. The web build stage copies the shared module registry from the API tree and omits the imported PDF source. A temporary production build with both source trees succeeded. [Dockerfile](../Dockerfile) · [Phase 5 browser spec](../apps/web/e2e/payroll-phase5.spec.ts)

### PDF preview checks fail in the default headless shell

The default Playwright headless shell passed 38 of 40 cases. The Admin and Superadmin preview checks failed while waiting for the PDF frame, although both preview requests returned HTTP `200`. Both cases passed on a focused full Chromium rerun. The complete suite then passed **40 of 40** with `PLAYWRIGHT_CHANNEL=chromium`, production assets, mocked APIs, and zero retries.

## Follow-up scenarios still unverified

| Scenario                                   | What remains open                                                                                                                                                                                                                                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Attendance correction racing a calculation | Existing checks cover pending corrections during calculation and overlapping Payroll calculations. A correction approval and Payroll calculation still need to be raced in independent PostgreSQL sessions with controlled ordering and assertions on the stored revision.                                 |
| Response lost after a confirmed commit     | The tested interruption occurred while the generation transaction waited for its lock. The remaining case requires an independent read to confirm the first request committed before its response is dropped, followed by a retry that preserves the original payslip.                                     |
| Deployed database writer grants and TLS    | No hosted database was contacted, and `PAYROLL_DB_AUDIT_URL` was absent in the audit process. The check requires a selected deployment and secure access using its actual API runtime database role. [Deployed audit procedure](payroll-deployed-db-permissions-audit-9.4.md#run-the-deployed-audit-later) |

## Verification runs

- The disposable PostgreSQL launcher passed **47 checks**. Fresh PostgreSQL 16.16 applied all 79 repository migrations and passed 5 checks. The upgrade applied 78 migrations, created an approved fixture, then applied the snapshot guard and passed 5 checks. The selected PGlite/API/unit suite passed 37 checks.
- The broader Payroll API/unit run passed **42 tests**. It overlaps with the launcher's 37-test selection. The approved-unpaid-leave and run-total-overflow API probes were run separately using synthetic data.
- TypeScript, ESLint, read-only Prettier, PowerShell syntax, and Git diff checks passed. Disposable database and browser containers were removed.

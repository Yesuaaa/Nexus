# Payroll reconciliation 7.1

## Financial lifecycle

- PayrollPeriod.id identifies the scheduled window. PayrollRun.periodId is unique and restricts deletion of the period. A draft can have multiple PayrollRunCalculation rows, uniquely numbered by runId and revision.
- PayrollRunItem.calculationId joins each employee snapshot to its calculation. The unique calculation and employee pair defines one obligation. The approved, complete revision and its item net amounts are the financial source of truth. Approval records use calculationId and action as their unique identity. Approval transitions retain the existing Admin permissions and separation-of-duties checks.
- PayrollDisbursementBatch.calculationId is unique. Preparation uses a transaction and a run-level lock to create the batch, copy approved net amounts into PayrollDisbursementItem rows, and write audit history. Each payrollItemId is unique. Draft, blocked and cancelled batch states describe operations, so they supply no payment evidence.
- PayrollTransferAttempt.itemId and idempotencyKey are unique. Simulation takes the batch lock and checks the idempotency key before writing an attempt and audit history in the same transaction. The persisted outcome supports succeeded, pending and failed. The existing transfer service has no retries or provider-event ingestion. The PayMongo adapter stays disabled.

## Read contract and classification

GET /api/payroll/runs/:runId/reconciliation evaluates the approved revision under one repeatable-read snapshot. The employee and current discrepancy windows use page and exceptionPage respectively, both defaulting to 1. Amounts are Decimal values serialized as two-place PHP strings. Real paid and simulated confirmed amounts are reported separately. Unresolved means the obligation remaining after recorded simulator confirmations, in the simulator context. Zero payable requires no simulation. Counts and totals cover the full revision. The evaluation scans that single revision and pages the response in the API process.

A prepared batch makes a positive obligation eligible for the missing-record check. A failed simulation, an incorrect confirmed amount, and a payout with inconsistent batch or revision linkage each produce structured evidence. Unmatched amounts are excluded from matched totals. Exceptions take precedence over partial and pending statuses. Match describes simulator reconciliation when simulator outcomes are the only evidence. Duplicate stored attempts are prevented by the existing unique constraints. Rejections, stale pending, event ordering and provider conflicts need outcome types, a threshold policy or an event ledger before they can be evaluated.

The route uses payroll read authorization, the existing approved revision resolver, pagination validation and structured HTTP errors. It returns approval, batch, item and attempt references with relevant timestamps and does not include destinations, provider payloads or idempotency keys.

## Persistence

PayrollReconciliationException uses a foreign key to the approved calculation and a composite primary key on calculation, category and subject. The primary key also indexes revision lookups. The subject is the obligation for missing, failed and amount mismatch exceptions, and the payout for unmatched records. The lifecycle enum supports future review and resolution. The internal recorder uses existing run and batch advisory locks and atomically upserts first and last evidence with timestamps. A disappearing discrepancy remains in history. A re-observed discrepancy updates last evidence and preserves lifecycle status. A new category creates a separate record.

The API GET evaluates current discrepancies only. The internal persistence function is callable by backend code and covered by the integration fixture. Recurring execution and historical exception reads belong to the next phase. No UI, resolution endpoint or payout action is part of this change.

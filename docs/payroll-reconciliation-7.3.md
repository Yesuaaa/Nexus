# Payroll reconciliation 7.3

## Review and evidence

Exception identity remains the approved calculation, category, and subject. The first and last observations retain their original purpose. A current or historical detection comes from a fresh evaluation, independently of the administrative review state. Starting review, returning to the queue, administrative resolution or dismissal, and explicit reopening require a reason. Corrective assessments are appended while a case is under review. The assessment records what a reviewer recommends and includes the payout and attempt identifiers available at the time.

A closed case can still be financially outstanding. The resolve classifications are investigation concluded and further action required. This phase has no provider-confirmed correction source, so the endpoint accepts no claim that a real payout occurred. Dismissal requires invalid observation or expected condition. The drawer continues to show a current discrepancy after administrative closure.

The recorder tracks whether a discrepancy was present at the last explicit recording. A discrepancy observed again after an observed absence starts a new Open cycle with the same identity. Material evidence changes also start a new Open cycle for a closed case. This requires recording the new evidence. An ordinary read can surface the recurrence but does not open the cycle or change any records. Previous decisions and first evidence remain available. An absence and recurrence entirely between recordings cannot be proven by the current data model.

## Authorization and API

- GET /api/payroll/runs/:runId/reconciliation/exceptions/:category/:subjectId/decisions returns chronological decisions and safe evidence references for Payroll readers.
- POST /api/payroll/runs/:runId/reconciliation/decisions requires Payroll manage permission. The request carries the category, subject ID, action, version, UUID request ID, reason, and applicable classification or assessment.
- Run and calculation creators, batch preparers, and actors who configured or simulated the associated payout cannot independently finalize their own cases. Unmatched payout cases can be investigated but finalization needs a policy decision for ambiguous attribution. Superadmin remains read-only. Staff and Clients have no reconciliation access.

The decision transaction takes the existing run and batch locks, evaluates the live evidence, validates the observation and decision version, and checks the transition. The composite request ID constraint prevents duplicate writes. Exact replays return the original decision ID. Stale versions or changed financial evidence return a conflict. The append-only decision and exception update are atomic with the workforce audit event, which references the decision ID. Repeated observation recording preserves decisions.

## Migration and reuse

The additive migration introduces observation presence and version fields and adds a decision table linked to the existing composite exception key. Decision uniqueness covers request identity and version within an exception. The table stores decision-specific evidence, actor ID, justification, time, and previous and new review states.

The existing evaluator, exception recorder, Payroll permissions, approval resolver, advisory locks, audit writer, and record/UUID validators are reused. The page extends the existing side panel with the shared confirmation dialog, textarea, FilterSelect, Pill, buttons, async resources, authenticated client, and Sileo. The investigation component keeps form state scoped to the selected exception.

## Phase 8

Use the evaluator totals for financial metrics and the administrative decisions for review metrics. Keep current versus historical detection and review status separate in reporting. A future correction executor requires a verified provider evidence model and a dedicated authorization policy.

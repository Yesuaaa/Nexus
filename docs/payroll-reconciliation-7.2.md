# Payroll reconciliation 7.2

Reconciliation appears under People & HR → Payroll, between Disbursements and Payslips & History. The approved run selector uses the existing paginated payroll runs endpoint with the approved status filter. The selected run is in the URL. The dashboard uses snapshot employee names and identifiers, separates simulator confirmations from real confirmed payment, and includes employee and exception evidence drawers.

## API and evidence

- GET /api/payroll/runs/:runId/reconciliation requires Payroll read permission. It returns revision totals, employees and combined current and historical discrepancies from one repeatable-read snapshot. Employee search and payout status apply before employee pagination. Category and observation filters apply before exception pagination. Approved run selection scopes both lists. Each list defaults to ten rows. Totals always cover the entire approved revision. The service evaluates a full revision in memory; it does not download unpaged employee records into the browser.
- Current discrepancies come from the evaluator. An exception stored under the same identity contributes its timestamps and lifecycle status. Stored exceptions absent from the current evaluation show as historical. A current discrepancy may not yet have a persisted timestamp. API responses expose selected amount and identity fields, not raw provider data or arbitrary stored evidence.
- POST /api/payroll/runs/:runId/reconciliation/observations requires Payroll manage permission. Admins explicitly record observations from the dashboard because Phase 7.1 has no reconciliation scheduler. The existing recorder uses the same transaction locks as payout preparation and simulation. It atomically upserts exception evidence and writes a workforce management audit event. Repeated observations update evidence timestamps, preserve first evidence, and do not create another exception under the same key. Reads never call the recorder.

## Reuse

The page uses the existing Payroll workspace route policy, PageHeader, FilterSelect, SearchField, shared search debounce, async resource hook, authenticated API client, responsive table, skeleton rows, pagination footer, Pill, row action button, empty state, side panel details kit, PHP formatter and toast service. The page-local table composition keeps both tables on the same shared primitives without adding a design-system component. Phase 7.2 reuses the Phase 7.1 schema and migration.

## Phase 7.3

Add separately authorized investigation and resolution decisions with audit events. Define correction and retry workflows against a source that can distinguish real provider evidence from simulator results. A scheduled observer, if needed, should call the same recorder. Database-backed pagination and indexing should be considered if full revision evaluation becomes costly.

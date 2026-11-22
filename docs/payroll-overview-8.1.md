# Payroll Overview 8.1

The existing People & HR → Payroll → Overview route now displays four KPI cards, approved expenditure and composition charts, payout and current exception charts, and up to ten items requiring attention. The filter applies to all sections and selects the latest 3, 6, or 12 payroll periods with a run, ordered by period start. The default is six. Periods with no approved revision have no financial plot point.

## Data contract

| Metric                             | Source and unit                                                                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Approved Payroll                   | Prisma Decimal sum of the net total in each run's current complete revision with an approval event. The run must be approved.                                                                    |
| Confirmed Paid                     | Zero real provider-confirmed payments. The current payout model records local simulator outcomes only.                                                                                           |
| Pending Approvals                  | Runs with the existing pending-approval status within the selected periods.                                                                                                                      |
| Open Exceptions                    | Current discrepancies from the Phase 7 evaluator. Closed administrative decisions do not hide discrepancies and stored observation history does not add to the count.                            |
| Expenditure Trend                  | Approved net by period, using the revision totals directly.                                                                                                                                      |
| Payroll Composition                | Approved gross, deductions, and net by period, each read directly from the approved snapshot.                                                                                                    |
| Disbursement Status                | Counts one persisted payout record per obligation; the unique attempt relationship supplies simulated confirmed, pending, or failed. Records without attempts are blocked or require no payment. |
| Reconciliation Exception Breakdown | Current discrepancies grouped by evaluator category, deduplicated by category and subject.                                                                                                       |
| Items Requiring Attention          | Pending approval runs and current discrepancies in recent-period order. Links open Approvals or the relevant run in Reconciliation.                                                              |

The read-only GET /api/payroll/overview endpoint requires Payroll read permission for Admin and Superadmin. Staff and Clients are denied. It uses one repeatable-read transaction, selects a bounded number of periods, loads revision and payout data in bulk, and returns only aggregate values and a bounded work list. The evaluator reads current evidence without recording observations or changing financial or audit records. Chart geometry uses numbers for rendering only. All displayed money uses the original decimal strings.

## Component and code reuse

The route, workspace policy, PageHeader, KpiCards, KpiDonutChart, FilterSelect, Button, Pill, skeleton, empty state, retry pattern, and responsive table are existing components. The page also uses useAsyncResource, the authenticated client, and the shared exact currency and date formatters. The money formatter accepts the larger integer portion needed for totals across up to twelve revisions.

The chart audit found the existing KPI sparkline and part-to-whole bars. Their encodings cannot compare three related monetary series on a common scale or label a period trend with exact amounts. The trend and grouped horizontal bars are therefore composed locally on the Overview page. There is no new shared chart framework or dependency. Layout direction came from the Moneed and Finexa references.

The backend uses existing Prisma models and Decimal arithmetic, the approved-revision eligibility rules, existing payout-status semantics, and the Phase 7 evaluator. Phase 8.1 adds no schema changes. This first dashboard reads the employee-level evidence server-side for the bounded reporting window because detecting missing and unmatched records requires the evaluator to compare both sides.

## Limitations and Phase 8.2

Real PayMongo confirmations are unavailable in the current payout model. The scoped totals cover periods with runs and the attention table shows the first ten actionable rows. The configured remote database's Phase 7 migration status remains unverified. Phase 8.2 can reuse the approved revision series, payout counts, and current discrepancy groupings for reporting and exports, with explicit date range and pagination contracts.

## Verification

Ten API regressions passed with the disposable PostgreSQL fixture, including Payroll role enforcement, immutable revisions, Phase 7 evaluation and decisions, and the new Overview assertions. Two Web unit tests passed, including the aggregate currency formatter. Three Chromium tests passed against the local app with mock data. The Overview test covers the range selector, chart sections, the Reconciliation link, and 390 px page overflow. Desktop and mobile captures were visually inspected.

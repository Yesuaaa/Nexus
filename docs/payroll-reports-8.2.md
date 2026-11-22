# Payroll Reports 8.2

People & HR → Payroll → Reports has four tabs. All use a common reporting window of the latest 3, 6, or 12 periods with runs, optionally ending on or before a selected date. Use the cutoff to investigate older periods. Search and status filters apply on the server before pagination and export. The initial range is six periods and each page lists up to ten records.

## Financial sources

| Report                    | Sources and semantics                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payroll Summary           | Only the authoritative complete revision of an approved run with an approval event. Gross, deductions and net come from the approved revision. Employee totals count distinct employee identities across matching periods.                                                                                                                                                                                  |
| Compensation & Deductions | Base and allowances come from recorded, calculated snapshot components. An absent category displays as unavailable. Deductions and net come directly from revision totals. Current compensation settings are outside this query.                                                                                                                                                                            |
| Disbursements             | Counts unique payout records linked to approved employee obligations. Expected net comes from the employee calculation. The existing single attempt relationship provides outcome and timestamp. Confirmation is Simulated for a simulator success and None otherwise. Real confirmed count is zero under the current evidence model.                                                                       |
| Reconciliation            | Phase 7 evaluator supplies live detection. Past recorded observations remain historical. Administrative lifecycle is separate, and a current financial discrepancy remains visible when review closes. Recurrence follows the current Phase 7 definition when evidence indicates a new review cycle is required. Historical recurrence counts across cycles cannot be reconstructed from the current model. |

Summary and compensation charts use the entire filtered period series; the payout donut uses filtered unique counts. Details show the source record reference and links to existing screens. Reconciliation links open the selected run. Payroll Runs and Disbursements links open the corresponding workspace lists, which have no report-record URL selection contract.

## Export and protection

GET /api/payroll/reports requires Payroll read permission. GET /api/payroll/reports/export requires Payroll manage permission. Admins may export; Superadmin is read-only because no separate payroll export permission is defined. Staff and Clients cannot access either endpoint. The endpoint uses the same filters for view and export. CSV returns all matching rows up to 5,000 and rejects larger exports with a message to narrow the scope. A UTF-8 BOM supports spreadsheet readers. Quoted fields escape embedded quotes, dates use ISO timestamps, money uses original decimal strings, and possible formulas are prefixed with an apostrophe.

Bulk queries cap selected employee, payout, and exception evidence sets at 10,000 rows each. Large scopes fail explicitly instead of returning partial totals. Comparisons that need live reconciliation evidence evaluate the bounded dataset server-side before choosing the requested page. Destination details, provider payloads, and decision notes are excluded. Employee names are limited to the Admin-only detailed employee payroll exports.

## Component and code reuse

Reused the existing workspace route policy and sidebar, PageHeader, Tabs, FilterSelect, FormInput, SearchField and debounce, pagination footer, responsive table, skeleton rows, EmptyState, Pill, Button, SidePanel detail kit, Sileo, authorized API and download client, date and money formatters, Overview charts, and shared donut. The UI uses one route and a shared filter toolbar. The existing attendance CSV implementation runs client-side against a page of rows, so this report adds a server serializer to use the complete filtered dataset. The reporting query follows the Phase 8.1 approved revision selection and payout semantics and calls the Phase 7 evaluator and recurrence rule instead of reimplementing them. Reports use repeatable-read snapshots and the existing Payroll permission middleware.

## Deployment and handoff

No schema changes. Reconciliation Reports require the existing Phase 7 tables. Remote migration status remains unverified. Phase 8.3 can build on these read-only contracts when reviewing access policy, operational controls, and any future report retention rules.

## Verification

The focused API run passed both the disposable-database integration test and the CSV serialization test. Integration covered draft exclusion, Payroll role checks, exact snapshot values, failed payout semantics, historical detection, and export independent of table pagination. The Chromium suite passed the Reports flow and the Overview regression. Reports browser coverage includes tab selection, employee reference inspection, authenticated download, debounced search and reset, and checks for page overflow at tablet and mobile widths.

## Comprehensive exports

The blue Export Report action offers Export CSV and Export Excel (.xlsx). Both use the same read-only report snapshot, period filter, cutoff, status and search. Export has no table page parameter. Summary and Compensation search selects report periods before expanding to the employee records in each matching period. The CSV request uses format=csv; the Excel request uses format=xlsx. Existing integrations that omit format retain the original aggregated CSV columns and filename.

| Tab                       | Detailed CSV contract                                                                                                                                                                                 | Excel sheets                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Payroll Summary           | Period, run reference, approved calculation ID and revision, approval status and date, employee number and snapshot name, base, allowance, gross, recorded deduction lines, total deductions and net. | Summary, Approved Payroll (run totals and counts), Employee Payroll Details. |
| Compensation & Deductions | The same employee rows with recorded base, allowances and named deduction lines. Amounts come exclusively from the approved snapshot.                                                                 | Summary, Approved Payroll, Compensation & Deductions.                        |
| Disbursements             | Period, run and calculation IDs, employee number, approved expected net, payout and batch references, payout outcome, confirmation type, latest attempt timestamp and attempt ID.                     | Summary, Disbursements.                                                      |
| Reconciliation            | Period, run and calculation IDs, exception reference, classification, employee number or reference, detection, review, observation timestamps, recurrence marker, and latest decision reference.      | Summary, Reconciliation.                                                     |

CSV emits one flat dataset per tab in the documented order. Unknown values are blank. Department and position are not historical snapshot attributes. No other earnings or statutory fields are derived. Real confirmations remain separate from simulator results. Both detailed formats reject scopes with more than 5,000 matching detail rows. The existing 10,000-record evidence limits still apply, including a 10,000 named deduction line limit. Oversize exports return an error without producing a partial file.

The workbook uses a dark title, Converyn blue headers, alternating warm white rows, bold summary labels, frozen headers, AutoFilter, and a two-place PHP number format. Monetary values serialize as numeric cells directly from authoritative decimal strings. Excel values outside the supported numeric precision or cell length fail explicitly with a CSV fallback. Employee names and all other text use literal cells, with no workbook formulas. Dates are ISO strings. Empty Excel exports contain only the Summary sheet.

## Export enhancement reuse and verification

Reused DropdownMenu, Button, the authenticated download helper, Payroll permission middleware, report filters and reconciliation evaluation, Decimal values, and CSV quoting. Export Report uses the shared navy primary Button variant used for Payroll Runs actions. No server XLSX dependency was present. The narrow workbook serializer writes the fixed Open XML parts using the Node runtime's built-in ZIP compression and CRC, with no third-party parser or temporary server file. The export sheet projection is separate from the HTTP route and workbook styling.

The focused API suite passed three tests covering the real download endpoint, legacy and detailed CSV, authorization, formula-safe CSV, numeric and literal Excel cells, and styles. Chromium exercised both export options from desktop and mobile, including opening the menu with Enter. The generated API workbook opened in openpyxl. Its three sheets, numeric PHP net, exact run/employee total match, blank allowance, header colors, freeze pane and AutoFilter were checked.

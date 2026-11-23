# Phase 7.4.1 — Page 19: Billing Logs

Audit date: 2026-11-14

Status: **Complete for Page 19 review; recommend administrative review with P19-001 open.**

Authorization: Page 19 only.

## A. Objective and outcome

Inspected the Billing Logs route, its directly related shell, API, authorization, workflow/payment persistence, and existing regressions. Added three isolated browser cases and one PGlite API case for uncovered source-backed behavior. No product fix was authorized or made.

The page is a client-only, read-only view of workflow payments. The review found a conditional display defect: one booking reference activates fixed demo service, invoice/reference, and due-date text in the due list. The selected payment dialog shows the API-backed service and booking reference instead. See P19-001 in section V.

## B. Safety and change boundaries

Work was limited to source inspection, dedicated Page 19 tests, test evidence, and this report. No application code, API business logic, authorization, schema, migration, dependencies, lockfile, accepted test, or historical baseline artifact was edited. No commit, push, merge, rebase, reset, or branch switch occurred. Page 20 and Phase 7.5 were not started.

## C. Repository baseline

| Checkpoint              | Result                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| Branch                  | 219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages |
| HEAD                    | 93dae95afb94cc23c1acea30edaf40c4d25951ed                                                         |
| Initial working tree    | Clean; branch matched origin                                                                     |
| Initial diff check      | Passed                                                                                           |
| Merge operation         | No MERGE_HEAD                                                                                    |
| Recent history          | Page 18 Settings, Page 17 Profile, development merge, Staff Workload, attendance regression work |
| Billing-related history | 30ce695, b6d9b8a, 1ed2c66, 8e08ff8, 4e98092, and earlier shared-kit/billing work                 |

The baseline evidence is in test-results/phase7/page-by-page/page-19-billing-logs/initial-git-status.log, initial-branch.log, initial-head.log, initial-recent-history.log, initial-diff-check.log, initial-merge-head.log, and billing-related-history.log.

## D. Historical regression preservation

The accepted Page 18 discovery was 499 tests in 69 specification files. The migration baseline remains 292 original test identities, 1,630 assertion sites, 4,211 preservation mappings, and five intentional live-backend skips.

The existing direct spec apps/web/e2e/billing/billing-logs.spec.ts remains present and unchanged. USER Settings navigation still includes Billing Logs; internal roles do not gain access by entering its URL. The new cases are additive.

The historical verifier was run and stopped at its known PW-149 discrepancy: expected title “duplicate email registration displays inline server error alert”; current title is “duplicate email registration displays server conflict feedback.” It reported no duplicate or unexpected identity. The verifier did not reach later mappings; no later mapping pass is claimed. PW-037 and PW-001 remain historical documented discrepancies. Output: historical-verifier.log.

## E. Source inventory and dependencies

| Source                                                                                | Responsibility and Billing behavior                                                                                                                    | API / persistence relationship                                                      | Existing coverage                                   |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------- |
| apps/web/src/app/(portal)/billing-logs/page.tsx                                       | Route and complete list/detail UI; due/history sections, payment summary dialog, status/date/amount display, payment chat link, proof preview/download | GET billing projection; GET associated workflow file                                | Direct Billing Logs spec; new Page 19 browser cases |
| apps/web/src/features/auth/api/auth-api.ts                                            | Same-origin authenticated API requests                                                                                                                 | Bearer token from sessionStorage                                                    | Shared auth/session regressions                     |
| apps/web/src/features/request-workflow/api/workflow-api.ts                            | Workflow proof preview/download URLs                                                                                                                   | /api/request-workflows/:requestId/files/:fileId                                     | Workflow and Billing browser/API coverage           |
| apps/web/src/features/request-workflow/hooks/use-workflow-file-preview.ts             | Image preview lifecycle; PNG/JPEG preview and object URL cleanup                                                                                       | Authenticated file GET                                                              | Workflow E2E coverage                               |
| apps/web/src/features/settings/providers/preferences-provider.tsx                     | Supplies user date preferences to the portal                                                                                                           | Auth/settings reads in the shell                                                    | Settings coverage                                   |
| apps/web/src/features/workspaces/model/route-policy.ts                                | Exact /billing-logs USER route policy                                                                                                                  | No database read                                                                    | Route-policy unit tests                             |
| apps/web/src/components/layout/portal-layout.tsx                                      | Authenticated portal shell and internal-role denial                                                                                                    | Auth/account and settings shell requests                                            | Route and shell tests                               |
| apps/web/src/features/auth/components/account-menu.tsx                                | Shows Billing Logs link to USER                                                                                                                        | No billing read until page entry                                                    | Settings browser test                               |
| apps/web/src/components/ui/* and shared layout controls                               | PageHeader, Alert, Table, Button, Dialog, Pill, action buttons                                                                                         | Shared primitives                                                                   | Shared component/navigation coverage                |
| apps/api/src/features/request-workflow/workflow.controller.ts                         | Authenticated billing and workflow-file routes                                                                                                         | GET /billing and GET file download                                                  | PGlite request-workflow/project-workspace tests     |
| apps/api/src/features/request-workflow/workflow.billing.ts                            | Owner-scoped WorkflowPayment read projection                                                                                                           | WorkflowPayment, ServiceRequest, Service, approval, quotation, events, WorkflowFile | Existing NEX-016; new Page 19 PGlite case           |
| apps/api/src/features/request-workflow/workflow.access.ts and workflow.files.ts       | Request ownership and client-visible proof enforcement                                                                                                 | Request/workflow/file records                                                       | Existing file authorization tests                   |
| apps/api/src/features/auth/auth.middleware.ts                                         | Bearer/session, active-account, expiry and revocation checks                                                                                           | Session and User                                                                    | Auth-session PGlite suite                           |
| apps/api/prisma/schema.prisma                                                         | Workflow payment and related data models                                                                                                               | Decimal(12,2), enum, relations                                                      | PGlite suites                                       |
| apps/api/src/features/request-workflow/workflow.validation.ts and workflow.service.ts | Quote/payment validation and workflow persistence                                                                                                      | Decimal-safe cents and transactions                                                 | Request-workflow PGlite suite                       |

The feature is not arranged as a dedicated billing feature folder: the page lives under the portal route and consumes request-workflow APIs.

## F. Functionality inventory

Implemented:

- Lists positive-value workflow payments belonging to the authenticated USER.
- Separates PENDING payments into a due section; SUBMITTED and VERIFIED records appear in payment history.
- Shows service name, booking reference, amount/currency, status, and available transaction timestamps.
- Opens a summary dialog from Review / View payment / View proof / View receipt row actions.
- Links a pending payment to its existing conversation context; payment submission itself occurs in the workflow conversation, not Billing Logs.
- Downloads an associated client-visible proof file. Sandbox records are labeled as test payments and can download their linked sandbox receipt file.
- Previews eligible PNG/JPEG evidence when the preview loads.

Absent in this implementation: search, search clear, status/date filters, sorting controls, pagination, page refresh/retry control, failed/refund states, invoice records or generation, actual payment-method details, receipt generation, export, and Billing Logs mutations. No project-navigation control is implemented in the billing view. “Due date” is not supplied by the billing API.

## G. Interactive-control inventory

| Control                          | Visibility / enabled state                                                        | Effect and coverage                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Review                           | PENDING due rows                                                                  | Opens summary dialog; new maximum-amount test opens it with keyboard Enter                                         |
| View payment                     | History row without proof action                                                  | Opens summary dialog                                                                                               |
| View proof / View receipt        | History row with client-visible proof file; download state disables repeat action | Opens summary and download action; sandbox download covered                                                        |
| Enlarge / Collapse payment proof | Only when eligible image preview succeeds                                         | Toggles image in dialog; preview errors are silently caught by the preview hook                                    |
| Dialog close/X and Escape        | Open dialog; close blocked during an active download                              | Radix dialog close behavior; new test verifies Escape                                                              |
| Go to chats                      | Summary dialog                                                                    | Navigates to request conversation, no Billing Logs write                                                           |
| Pay {amount}                     | PENDING payment with conversation link                                            | Navigates to workflow payment context; it does not charge from this page                                           |
| Download proof / receipt         | A linked proof file exists; disabled while downloading                            | Authenticated workflow-file GET, browser download; existing error-recovery coverage plus new sandbox download case |

No search/filter/sort/pagination/refresh controls, retry button, or empty-state action exists in this page. There is no page-level duplicate-click mutation because the page has no write action. The download action uses a local busy guard and disables while pending.

## H. Billing model and field mapping

| Displayed field        | Database source                                                                                    | API field / projection                        | Formatting and null behavior                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------- |
| Amount                 | WorkflowPayment.amount, Decimal(12,2)                                                              | amount serialized with toFixed(2) as a string | Intl currency formatter; frontend converts the decimal string to Number for formatting |
| Currency               | WorkflowPayment.currency, three-character value                                                    | currency                                      | en-PH currency formatting                                                              |
| Status                 | WorkflowPaymentStatus enum: PENDING, SUBMITTED, VERIFIED                                           | status                                        | Text/Pill presentation; no FAILED value                                                |
| Payment reference      | WorkflowPayment.reference                                                                          | reference                                     | Omitted or “Not recorded” when absent                                                  |
| Service                | Service.name via ServiceRequest                                                                    | serviceName                                   | List and detail normally use the projection; P19-001 overrides one list row            |
| Booking reference      | ServiceRequest.referenceNumber, nullable/unique                                                    | bookingReference                              | P19-001 uses this value only as a hard-coded demo switch in the due list               |
| Approval timestamp     | WorkflowApproval.approvedAt                                                                        | approvedAt                                    | Pending dialog uses fixed en-US / Asia-Manila formatting                               |
| Submission timestamp   | Latest non-internal PAYMENT_SUBMITTED WorkflowEvent                                                | submittedAt                                   | Uses account date preferences                                                          |
| Verification timestamp | WorkflowPayment.verifiedAt                                                                         | verifiedAt                                    | Uses account date preferences                                                          |
| Quoted line items      | WorkflowQuotation.lineItems JSON; quote total must match payment amount for the pending projection | lineItems                                     | Description, quantity, unit price; details calculate item totals                       |
| Proof metadata         | WorkflowFile, only when clientVisible                                                              | proofFile { id, name, mimeType }              | Hidden/private metadata is not projected                                               |
| Sandbox marker         | Derived from verified state, null verifier, and XENDIT-SANDBOX- reference prefix                   | sandbox                                       | UI adds “Test payment only. No money was charged.”                                     |

WorkflowPayment is unique per request and relates through RequestWorkflow / ServiceRequest. ServiceRequest links the client User and Service. WorkflowApproval and WorkflowQuotation are optional. WorkflowFile stores bytes and visibility; there is no invoice/receipt entity. WorkflowQuotation.validUntil is quote validity, not a payment due date. paymentDue is a quoted amount, not a calendar date.

## I. Monetary accuracy and validation

Prisma stores payment and quote values as Decimal(12,2), with a maximum positive value of 9,999,999,999.99. The API serializes payment amounts to fixed-two-place decimal strings. Workflow input validation accepts one to ten whole digits and zero to two fractional digits; currency is normalized to three uppercase ASCII letters. Quote calculations convert to BigInt cents, sum line totals without binary floating-point arithmetic, and reject a required payment due of zero or an amount above the quote total. WorkflowService creates the WorkflowPayment from the accepted quote paymentDue within the workflow transaction.

Billing Logs itself accepts no monetary input and has no amount mutation endpoint. It filters out zero/negative payment rows. The UI formatter uses Intl.NumberFormat with en-PH and converts the string through Number; the maximum supported value was exercised at 1440, 1280, 768, and 390 pixels and rendered as ₱9,999,999,999.99. No negative, null, or missing amount is part of the Billing API projection (amount is non-null in the model). No claim is made that arbitrary malformed persisted currency values are handled.

The historical Services pricing-boundary defect is not directly shared by this page: Billing Logs reads WorkflowPayment, not the Services list/pricing response. An accepted request’s quote can derive from request pricing, but a successfully persisted workflow quote is validated and is the payment source. No propagation from the Services defect was reproduced here; the accepted Services regression remains unchanged.

## J. Ownership and data isolation

GET billing derives the owner from the authenticated request user ID. The query filters through request.clientId and ignores a clientId query override. It does not take a payment/account ID for detail lookup; the dialog uses the already returned list projection. File reads additionally pass through workflowAccess, which checks active account and request ownership; clients can retrieve only clientVisible files. Foreign, hidden, and missing file identifiers return not found rather than disclosing file content.

The new PGlite case creates independent USER accounts and payments, sends the owner’s token with ?clientId=foreign, verifies only the owner’s row and fixed decimal projection are returned, and compares records before/after to show no mutation. Existing NEX-016 also checks anonymous denial, all internal-role denials, foreign owner isolation, private proof omission, and proof bytes.

## K. Authorization matrix

| Account/session                                          | Page / navigation                                 | Billing API        | Result                        |
| -------------------------------------------------------- | ------------------------------------------------- | ------------------ | ----------------------------- |
| Unauthenticated                                          | Shared portal auth guard; no Billing Logs content | 401                | No billing query              |
| USER, active                                             | Account menu link and route available             | 200, own rows only | Allowed                       |
| STAFF, including department-head STAFF                   | Link absent; direct route denied to /module       | 403                | Denied                        |
| ADMIN                                                    | Link absent; direct route denied to /module       | 403                | Denied                        |
| SUPERADMIN                                               | Link absent; direct route denied to /module       | 403                | Denied                        |
| Inactive/deleted user or invalid/expired/revoked session | Shared auth guard denies access                   | 401                | No authenticated billing read |

The backend router applies requireAuth and the billing handler explicitly requires USER. Shared auth middleware checks a live, non-expired session and active, non-deleted account. Department head is a STAFF permission context, not a distinct persisted role, so it does not bypass the USER-only rule. Existing route policy and browser role tests cover route denial; API PGlite coverage verifies role and owner checks.

## L. API contract matrix

| Method and endpoint                                 | Auth / authorization                    | Validation and ownership                                                                                            | Success / errors observed from source                                                                                                   |
| --------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/request-workflows/billing                  | Bearer session; USER only               | No request body or list parameter; authenticated user ID is the owner                                               | 200 list; 401 missing/invalid session; 403 internal role; generic server failure on query error                                         |
| GET /api/request-workflows/:requestId/files/:fileId | Bearer session; request workflow access | recordIdParam validates IDs; request owner or permitted internal workflow actor; client proof must be clientVisible | 200 file bytes with content disposition, nosniff, sandbox CSP; 400 invalid IDs; 404 foreign/hidden/missing resource; 401 session denial |

There is no separate billing detail, invoice, refund, export, or write route. Billing Logs has no query pagination or filter parameters. Unsupported methods do not map to a Billing Logs handler; no 409/422 financial mutation contract applies to this page. API error statuses are listed only where the route/middleware supports them.

## M. Search, filters, sorting, and pagination

There are no search, status/date filter, user-sort, or pagination inputs in the page or billing endpoint. This is confirmed absent, not an untested feature. The UI sorts due records by approvedAt ascending (null treated as empty) and presents history in backend order: verifiedAt descending, nulls last, then ID descending. There is no control to change that order or a page state to become stale.

## N. Date and reference formatting

The API dates are ISO timestamps. approvedAt in the pending summary is hard-coded to en-US / Asia-Manila. submittedAt and verifiedAt use the account date preferences. Whether all accepted timestamps should honor Settings preferences is a contract question; it was not asserted as a defect because Settings currently documents preferences in the conversations/notifications context.

No invoice number or payment due date is sourced by the API/database. The dialog correctly shows the API booking reference and “Not specified” for payment due date. P19-001 demonstrates that the due-list row diverges from that detail contract for one special reference. Tests use fixed timestamps and a controlled API fixture, not the wall clock.

## O. Loading, error, empty, and recovery

The page uses useAsyncResource. Initial loading, empty data, and a visible error alert are covered by the existing direct spec; the existing recovery test reloads after an error. The page does not expose a retry control or refresh button, even though the underlying resource supports retry. A failed load requires navigation/reload to try again. Proof preview failures are silently caught; file download failure recovery is covered by the accepted direct spec.

This audit did not add cases for malformed API payloads or every HTTP class because the Billing Logs endpoint has no user inputs for those validation branches. No list result is shown on a denied route. Since there is no paginated or filterable list, stale filter/page behavior does not apply.

## P. Read-only boundary

Billing Logs is read-only. It only fetches billing data and linked files, opens a dialog, and navigates to the existing workflow conversation. It cannot change payment status/amount, initiate a charge, issue a refund, generate a receipt, or export financial data. Payment submission and sandbox checkout are workflow conversation actions elsewhere. Repeated billing reads do not create records.

## Q. Persistence and integrity

The billing query requires amount > 0 and scopes records to request.clientId. Verified payments remain visible even when their request is cancelled; non-verified rows on cancelled requests are excluded. It orders verification timestamps descending, then ID descending. Projection joins ServiceRequest / Service and workflow approval, quotation, latest non-internal payment submission event, and client-visible proof metadata. The API does not project verifier identity or internal event data.

The new PGlite fixture validates projection, ownership query-override resistance, exact Decimal maximum serialization, and no-write behavior using the shared isolated PGlite app. Existing project-workspace API coverage validates private proof omission and file isolation. No live financial database was read or changed.

## R. Accessibility

The page uses a page heading, labelled sections, semantic list rows, visible action text, status text in addition to Pill styling, and a labelled dialog. Keyboard Enter opens Review and Escape closes the dialog in the new regression. Existing controls use shared Button/Dialog primitives. No forced clicks were used. There are no search/filter/pagination labels because those controls do not exist. Automated coverage does not establish a full screen-reader audit; loading/error announcements depend on shared Alert/resource behavior and were not manually checked with assistive technology.

## S. Responsive layout

The new browser test checks maximum-value readability and no document-level horizontal overflow at 1440, 1280, 768, and 390 pixels. At 390 pixels it also opens the payment dialog by keyboard and verifies Escape close. The accepted direct spec already covers client list/details and proof preview/download. A mobile screenshot is attached to the new Playwright case output. The page uses responsive grid columns for list rows.

## T. Existing regression coverage

| Suite / identity                                | Existing behavior                                                                                                                                    | Result                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| billing/billing-logs.spec.ts, 5 cases (NEX-018) | USER due/history/details/proof preview and download-error recovery; loading/empty/error recovery; STAFF/ADMIN/SUPERADMIN denial with no billing read | 5 passed                                                       |
| project-workspace API, NEX-016                  | Billing ownership, role denial, proof visibility and byte access                                                                                     | 7 TAP records passed                                           |
| Settings browser, 4 role cases (PW-263–266)     | USER menu includes Billing Logs; internal roles do not                                                                                               | Included in 9-case existing Billing + Settings run; all passed |
| Module-scoped navigation                        | Billing Logs route coexists with module-scoped navigation                                                                                            | 1 passed                                                       |
| Route-policy unit                               | Exact role policy characterization                                                                                                                   | 14 passed                                                      |
| Auth-session API                                | Expired/revoked/deactivated/deleted session and account checks                                                                                       | 11 passed                                                      |
| Request-workflow API                            | Quote/payment workflow including sandbox payment                                                                                                     | 16 of 18 TAP records passed; see API-TEST-001                  |

Existing coverage already covers most role, ownership, list, detail, proof, and failure paths. The focused gaps addressed here were maximum supported money at responsive widths/keyboard interaction, linked sandbox receipt download, the conditional demo projection, and PGlite serialization/query-override/no-write verification.

## U. New regression implementation

Created apps/web/e2e/billing/page-19-regression.spec.ts:

1. Maximum Decimal amount remains readable without horizontal overflow at four supported widths; keyboard opens the summary and Escape closes it.
2. A verified sandbox payment labels the no-charge receipt and downloads the linked file.
3. A record with bookingReference DEMO-BILLING-001 must display source-backed service/reference and no invented invoice/due date, with dialog fields consistent.

Created apps/api/tests/billing-logs-regression.test.ts:

1. Isolated PGlite USER reads only their own record despite a foreign clientId query, receives Decimal(12,2) as a fixed string, and reads leave records unchanged.

The third browser case intentionally remains failing on P19-001 to preserve evidence. A first test implementation had a strict locator matching both the table and dialog amount; it was corrected to use the first dialog match. No accepted test was changed.

## V. Test execution and findings

| Stage                                          | Result                                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| Initial Playwright discovery                   | 499 tests / 69 files                                                                    |
| New Page 19 API PGlite                         | 1 passed                                                                                |
| Existing project-workspace PGlite              | 7 TAP records passed                                                                    |
| Existing auth-session PGlite                   | 11 passed                                                                               |
| Existing request-workflow PGlite               | 16 passed / 18 TAP records; one nested assertion is repeated by its parent suite result |
| New Page 19 browser cases                      | 2 passed, 1 failed by design; four soft row assertions confirm P19-001                  |
| Existing Billing Logs + Settings browser cases | 9 passed                                                                                |
| Module navigation case                         | 1 passed                                                                                |
| Route policy unit tests                        | 14 passed                                                                               |
| Final Playwright discovery                     | 502 tests / 70 files                                                                    |

### P19-001 — Demo billing row substitutes fixed information

Severity: P2, conditional on booking reference. Classification: APPLICATION DEFECT.

- Source: apps/web/src/app/(portal)/billing-logs/page.tsx, lines 196–213.
- Reproduction: supply a valid PENDING billing projection with serviceName “Source-backed Website Redesign”, bookingReference “DEMO-BILLING-001”, and amount “125.00”; open /billing-logs.
- Expected: row and summary show serviceName and bookingReference from the response; no invoice number or payment due date is invented.
- Actual: row shows “Website Development”, “INV-003 · BK-2026-0142”, and “Due Nov 20, 2026”. The dialog shows the actual service/reference and “Not specified”, so the same payment has conflicting presentation.
- Evidence: new-browser-page19-final-dialog.log; screenshot and trace under test-results/billing-page-19-regression-ec279-stead-of-fixed-demo-details-chromium/ and Page 19 browser output directories.
- Data caveat: repository searches found these demo strings only in the Billing page and regression fixture. Presence of such a record in a deployed customer database was not established; the defect is confirmed for any record matching that reference.
- Status: Open and preserved; no product fix authorized.

### API-TEST-001 — Existing workflow test expects a client milestone that is not projected

Classification: TEST IMPLEMENTATION DEFECT; pre-existing and unrelated to Billing Logs. The accepted request-workflow test expects milestones[0].id, while the client project response has milestones: []. The failure occurs in “quotation acceptance satisfies agreement while payment and staffing block premature activation” at request-workflow.test.ts:1359. Prior Phase 7.3 and merge-verification reports document the same issue. The sandbox payment case passes. No accepted test was edited.

The route-policy unit’s first attempt hit process-spawn EPERM and passed on the authorized retry. Historical migration verification hit spawnSync git EPERM in the restricted run, then executed and reported PW-149 only. These are ENVIRONMENT FAILURE / historical verifier limitation, respectively. No current test implementation issue remains.

## W. Historical preservation and quality gates

All accepted Page 1–18 test files and reports remain unchanged. No historical assertion was weakened, no test was removed or newly skipped, and no prior defect is marked fixed. Retained historical findings include Registration input truncation and malformed response token; Services pricing boundary and pagination restoration; Request Inbox decline/delete mismatch; Booked Services reference and waiting-state defects; Messages archive/search obstruction and lifecycle question; Project Details navigation/notification findings; NEX-006 workspace creation; Workspace Details 404/loading and task-limit bypass; Staff Workload pagination; Profile Unicode URL normalization; and Settings timeout, rate-limit, and preference-concurrency questions.

Quality gates (required before handoff):

| Command          | Result                                                                                |
| ---------------- | ------------------------------------------------------------------------------------- |
| pnpm format      | Passed, exit 0; accepted Pages 1–18 and prior verification reports remained unchanged |
| pnpm lint        | Passed, exit 0 with --max-warnings 0                                                  |
| pnpm typecheck   | Passed, exit 0 for web and API; Next route types and Prisma client generated          |
| git diff --check | Passed, exit 0 after final report formatting; new files separately whitespace-checked |

Output logs will be retained in the Page 19 evidence directory.

## X. Files, evidence, and administrative recommendation

Authorized new tracked files:

- apps/web/e2e/billing/page-19-regression.spec.ts
- apps/api/tests/billing-logs-regression.test.ts
- docs/testing/verification/phase7/page-by-page/page-19-billing-logs.md

Execution logs, screenshots, traces, discovery and verifier outputs are under test-results/phase7/page-by-page/page-19-billing-logs/ or the linked Playwright output directory. They are test evidence, not accepted baseline files.

Recommendation: **Send Page 19 for administrative review with P19-001 open and its failing regression retained.** Page 19 work is complete within the authorized audit scope. Stop here pending review; do not repair production code or begin Page 20 / Phase 7.5.

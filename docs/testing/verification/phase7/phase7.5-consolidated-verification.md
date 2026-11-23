# Phase 7.5 — Consolidated Regression Verification

Date: 2026-11-14  
Recommendation: **PARTIALLY COMPLETE — STOP FOR ADMINISTRATIVE REVIEW**

## A. Executive summary

The safe offline regression suites and fresh browser discovery completed. The full browser run found 20 failing cases and five existing live-backend skips; the API run found nine failing unique leaf cases; the web unit suite passed. Six browser timeouts reproduced in a serial rerun. Several failures reproduce known application issues, and one API failure is a confirmed test-contract defect.

Historical reconciliation is not complete. PW-149 remains an unapproved identity alias, and 52 of 1,630 historical assertion sites have no exact mapped-file match or reviewed replacement. The old strict verifier stops at PW-149 before checking assertions or ownership. The correct recommendation is **PARTIALLY COMPLETE**, not full verification. No production fix, test rewrite, baseline edit, ledger approval, commit, push, Phase 8 work, or production-readiness claim was made.

Supporting reports:

- [Execution matrix](phase7.5-execution-matrix.md)
- [Defect register](phase7.5-defect-register.md)
- [Preservation reconciliation](phase7.5-preservation-reconciliation.md)

## B. Repository baseline

| Item                         | Value                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| Branch                       | `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages` |
| HEAD                         | `2e9d01e8ffd4335d1a3e535e0fdda7557c3ca368`                                                         |
| Upstream                     | Branch was up to date with its upstream at the start of the task                                   |
| Starting worktree            | Clean; no staged or unstaged source changes; `git diff --check` clean                              |
| Current tracked task changes | Three new Phase 7.5 reports; no existing file edits                                                |
| Recent merge history         | Captured in `test-results/phase7/phase7.5/baseline.log`                                            |

The task used the existing branch and did not create or switch branches. No other Git operation was active. `git status`, `git branch --show-current`, `git rev-parse HEAD`, `git log -10 --oneline`, and `git diff --check` were recorded before execution.

## C. Browser test inventory

Fresh discovery produced **534 expanded Chromium cases in 74 specification files**, with no duplicate identities. Five existing live-backend tests were skipped under offline mode; the other 529 cases ran. The discovered specs cover Pages 1–23, shared components, attendance, role access, and cross-page workflows. Page-specific ownership is recorded in the accepted page reports and spec paths in `test-results/phase7/phase7.5/discovery/browser-test-list.log`.

The discovery does not encode a separate owner field for every legacy case. The inventory confirms unique identities and spec ownership by file; it does not resolve the historical identity/site gaps described below. No unexpected skips or duplicate titles/identities were found in the current expanded list.

## D. API test inventory

The API runner invoked all **52** `*.test.ts` modules. They comprise 29 root tests and 23 feature/library tests: attendance (6), auth (4), departments (1), employees (1), Request Inbox (1), services (3), users (5), workload (1), and database library (1). The suite uses 42 PGlite/migration-harness modules, four local ephemeral HTTP modules, and six pure/unit/mock modules. The detailed inventory is in the [execution matrix](phase7.5-execution-matrix.md).

`DATABASE_URL` and `DIRECT_URL` were unset. The runner generated the Prisma client, type-checked API tests, and executed the supported API test command without a live database or production data. There is no separate API-only unit runner; API unit cases are included in the aggregate API count.

## E. Historical identity preservation

The Phase 4 baseline contains 292 expanded identities. Current discovery matched 291 exactly. PW-149’s current test has a changed title, and it passed, but its identity alias is not approved. The 292 historical cases executed as 285 passed, two timed out, and five skipped. After matching the PW-149 candidate for counting, the suite has 242 current additions beyond the baseline.

The full identity table and PW-149 evidence are in the [preservation report](phase7.5-preservation-reconciliation.md) and `test-results/phase7/phase7.5/preservation/historical-identities.csv`.

## F. Historical assertion preservation

Of 1,630 baseline assertion sites, 1,559 match exactly in their mapped files, 10 use accepted Phase 6 replacements, and nine have source-verified equivalents recorded in the Phase 7.4.1 append-only ledger. **Fifty-two sites remain unresolved.** A global expression search found 20 elsewhere without verified identity ownership; 32 were not found globally. The 78 additional current mapped-file `expect` sites do not replace or resolve historical coverage.

No historical assertion was weakened by this task. The assertion inventory and unresolved rows are linked from the [preservation report](phase7.5-preservation-reconciliation.md).

## G. Preservation mapping reconciliation

The immutable Phase 4 ownership CSV has **4,211 logical data rows**. The frozen Phase 6 snapshot reports 4,211 edges, zero CSV mismatches and zero invalid site references at its recorded revision. Phase 7.5 did not change the CSV or regenerate a new current mapping snapshot. Because 52 current historical assertion sites are unresolved, the row count alone does not certify current behavioral equivalence for all mappings.

## H. Approved regression deltas

This comparison recognized ten Phase 6 approved assertion replacements and nine Phase 7.4.1 source-verified equivalent sites. No new replacement was approved. The additional 52 unresolved sites, PW-149 title alias, and 78 current assertion additions require individual review. The append-only ledger and immutable baseline remain unchanged.

## I. Historical verifier investigation

`node scripts/verify-playwright-migration.mjs discover` loaded and validated the immutable inputs, created a fresh unique output directory, then stopped on PW-149. The verifier compares project, file, describe path, and exact title before assertion/ownership comparison. Its first identity mismatch therefore prevents later checks in that run.

The current candidate is `apps/web/e2e/auth/regression.spec.ts`, titled `duplicate email registration displays server conflict feedback`; the baseline title is `duplicate email registration displays inline server error alert`. This is an unresolved mapping, not a demonstrated missing behavior. Prior Page 16 evidence also records PW-001 and PW-037 route discrepancies. The accepted ledger contains several identity-specific role-route updates, including PW-037–PW-039, but PW-001’s exact site approval still needs review. The verifier and accepted ledger were not modified.

## J. Full browser execution

Command: `pnpm --filter @nexus/web exec playwright test` with fresh `--list` discovery, `NEXUS_E2E_LIVE=0`, four workers, and zero retries. Result: **509 passed, 20 failed, five skipped**, duration 286,900.554 ms in Playwright statistics. The suite ran against a local standalone web server on port 5274; the preexisting listener on 5273 was left untouched.

The 20 failing cases correspond to the registration contact/session issues, Billing Logs demo data, two Help content issues, four conversation timeouts, NEX-017 project list/notification issues, Page 22 pagination/mobile layout, Page 23 download recovery, Page 13 navigation/notification, Page 15 loading state, Services pagination, the mobile Services menu, and Page 16 workload pagination. The [defect register](phase7.5-defect-register.md) gives case IDs and classifications. Six timeouts were rerun serially; all six reproduced at the same UI interaction points.

## K. Full API execution

Command: `pnpm test:api`. Result: **276 unique leaves: 267 passed, nine failed, zero skipped**. TAP reports 305 entries because 29 parent suites are also reported (24 passing parents and five failing parents). API TypeScript test compilation and Prisma generation succeeded. The nine leaf failures are two BOOK-001 projections, BOOK-002 waiting-state behavior, two P20-001 date parsers, SVC-001 pricing precision, P17-001 Unicode profile URL length, S15-002 task-count enforcement, and API-TEST-001’s incorrect client milestone assumption.

## L. Unit-test execution

Command: `pnpm test:web`. Result: **98 passed, zero failed, zero skipped** across 26 web unit modules. API unit cases share the API runner and are not counted again.

## M. Cross-page workflow verification

The last separately focused workflow run recorded 21 cases in 10 specifications: 19 passed and two known NEX-017 error-notification cases failed. Phase 7.5 reran all current browser tests, including these workflow specs, but did not launch a separate 21-case workflow command. The current complete-run outcomes are included in the browser totals and defect register.

The focused workflow matrix records passing auth/session, client-related-record, inbox-to-message and selected request-thread paths; partial service submission, request-to-project, project-chat and workspace continuity; failed client project/deliverable feedback; and uncovered department/team propagation, payment-to-Billing Logs, and notification click-through. All browser workflow assertions use mocks. They do not establish live authorization, persistence, payment processing, or object storage behavior.

## N. Application defect register

The [defect register](phase7.5-defect-register.md) records the confirmed findings and latest execution. Current reproduced areas include APP-REG-001, APP-AUTH-001, BOOK-001, SVC-001/SVC-002, APP-TABLE-001, APP-CONV-001, P13-001/P13-003, APP-DELIVERABLE-001, S15-001/S15-002, S16-001, P17-001, P19-001, P20-001, P21-WEB-005/006, P22-001, P23-001, and APP-MENU-001. No production code was changed.

## O. Test implementation defects

API-TEST-001 is a confirmed current API test defect: the request workflow test dereferences a client `milestones[0]` that the client response intentionally does not expose. It remains unmodified for separately authorized correction. PW-149 is a historical identity mapping issue, not a confirmed test defect. Earlier page-task fixture/test-harness issues were corrected in their authorized page work and were not newly observed here.

## P. Contract discrepancies

The decline/delete route expectations in Request Inbox, BOOK-002 pre-acceptance waiting behavior, closed/cancelled conversation archive lifecycle, STAFF Projects route/API access, meeting versus consultation timezone rules, NEX-006 wizard/documentation drift, terminal workspace edit behavior, Settings throttling/concurrency, and the workload quarter-hour boundary remain decisions for product/API owners. They are not classified as confirmed application defects until the contract is decided. Details are in the [defect register](phase7.5-defect-register.md).

## Q. Flakiness and reliability

The browser run used zero retries and reported zero flaky cases. Six timed-out cases were rerun with one worker and zero retries; six timed out again. They are reproducible application/UI failures, not evidence of random timing. Previously reported Settings timeout behavior did not fail in this run, but one full-suite pass is insufficient to claim long-run stability. API tests had no skipped cases. A non-blocking `pg` client-query deprecation warning was emitted.

The initial sandbox prevented Playwright workers from starting (`spawn EPERM`). The authorized offline run completed after sandbox review. A preexisting server on port 5273 prevented the configured default web server from starting; the existing process was left alone and a separate standalone server used port 5274. These resolved execution restrictions are retained in the evidence logs.

## R. Fixture independence

Browser API calls were mocked, while API persistence tests used isolated PGlite or local ephemeral servers with database URLs unset. The full parallel browser run showed no new fixture contamination, and the accepted Attendance fixture routing/independence corrections remain in the current source. This single run does not prove live database cleanup or cross-process persistence isolation. No accepted fixture code was edited.

## S. Authorization coverage

| Surface                             | USER                      | STAFF                         | Department-head STAFF                                        | ADMIN                                            | SUPERADMIN                                       | Evidence level / limitation                                                                 |
| ----------------------------------- | ------------------------- | ----------------------------- | ------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| General API role gates              | Covered                   | Covered                       | Included as STAFF with head-specific checks where applicable | Covered                                          | Covered                                          | PGlite backend regression tests exercise all four roles; no production database             |
| Auth/session and protected routes   | Covered                   | Covered                       | Role routes exercised                                        | Covered                                          | Covered                                          | Browser route checks are mocked; five live-backend cases remain skipped                     |
| Request Inbox / workload            | Denial paths covered      | Role/assignment paths covered | Head-scoped operations covered                               | Denial/role paths covered                        | Denial/role paths covered                        | Isolated API tests; UI-to-live authorization not run                                        |
| Client project and deliverable data | Client ownership covered  | Staff/project access covered  | Review role covered where assigned                           | Administrative route coverage varies by endpoint | Administrative route coverage varies by endpoint | PGlite and mocked page checks; STAFF `/projects` route/API mismatch remains a contract item |
| Calendar                            | UI role renderers covered | UI role renderers covered     | UI role renderer covered                                     | UI role renderer covered                         | UI role renderer covered                         | Browser responses are mocked; API read-only and ownership checks use PGlite                 |

The matrix describes exercised coverage, not a universal page policy. Foreign-department, assigned-staff, inactive/deleted-account, expired-session, and revoked-session behavior remains endpoint-specific. The two role-route and Projects API contracts noted above need owner review; no authorization rule was changed.

## T. Validation coverage

| Field or endpoint             | Frontend                                               | API                                        | Database                           | Current finding                                                       |
| ----------------------------- | ------------------------------------------------------ | ------------------------------------------ | ---------------------------------- | --------------------------------------------------------------------- |
| Registration contact number   | Formatted input normalization and length checked       | Registration request validations exercised | N/A                                | APP-REG-001 drops trailing digits after formatting                    |
| Service price                 | Price entry and validation covered                     | Decimal boundary tested                    | `Decimal(12,2)`                    | SVC-001 returns 500 beyond persistence precision instead of 400       |
| Specialist social URL         | URL/raw-length controls covered                        | Normalization and validation tested        | `VarChar(2048)`                    | P17-001 Unicode normalization can exceed storage limit and return 500 |
| Project tasks per phase       | Editor limit exercised                                 | Standalone task POST tested                | PGlite persistence verified        | S15-002 permits task 51 via standalone endpoint                       |
| Calendar appointment date     | Calendar leap-day behavior covered                     | Meeting and consultation parsers tested    | Stored instants use ISO values     | P20-001 accepts normalized impossible date                            |
| Project plan/status and dates | Page 14/15 field boundaries and state controls covered | PGlite boundaries sampled                  | Plan/task rows isolated            | Terminal-state mutation contract remains unresolved                   |
| Staff workload capacity       | Form bounds and retry covered                          | PGlite capacity rules covered              | Decimal/integer persistence tested | Quarter-hour server rule not established                              |

The page reports contain additional field-by-field limits. No new validation requirement was inferred in this consolidation.

## U. Browser/API contract consistency

Browser tests use mocks, so a passing browser case is not proof that an API endpoint exists or accepts the mock. The API run exposed concrete differences: Request Inbox decline/delete routes return 404; pre-acceptance request conversation behavior differs from the waiting-state expectation; Booked Services projections omit `referenceNumber`; STAFF Projects frontend/API access differs; and Calendar meeting/consultation parsers differ on impossible dates and timezone format. Billing Logs displays demo data rather than source booking/payment records. These differences are kept visible in the defect register and contract table.

The cross-page service, Inbox, project and deliverable browser flows prove rendered UI transitions against controlled mocks. No live browser-to-API workflow or live payment/storage integration was certified.

## V. Quality gates

| Command                               | Result                   | Evidence / notes                                                                                                                                                                                                 |
| ------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check` before formatting | Exit 1                   | Only the four new Phase 7.5 reports needed formatting; no protected baseline or accepted artifact was flagged.                                                                                                   |
| `pnpm format`                         | Exit 0                   | Repository-wide Prettier completed. All existing repository files reported unchanged; only the four new reports were formatted.                                                                                  |
| `pnpm lint`                           | Exit 0                   | `eslint . --max-warnings 0` passed.                                                                                                                                                                              |
| `pnpm typecheck`                      | Exit 0                   | Web route type generation/TypeScript and API Prisma generation/test TypeScript passed.                                                                                                                           |
| `pnpm build`                          | Exit 0 on elevated retry | Web optimized production build and API TypeScript build passed. The first sandbox attempt stopped at the Next.js TypeScript worker with `spawn EPERM`; the same build completed after elevated execution review. |
| `git diff --check`                    | Exit 0                   | Clean after report formatting; final status is recorded in the completion message.                                                                                                                               |

The required pnpm commands used `npm_config_manage_package_manager_versions=false` for the process because the pinned pnpm bootstrap had previously hit a global Windows store lock. No package-manager configuration or lockfile was changed. Logs are under `test-results/phase7/phase7.5/quality/`.

## W. Remaining limitations

- 52 historical assertion mappings and PW-149’s renamed identity remain unresolved.
- Five existing live-backend browser cases were skipped; no disposable integrated backend and provisioned accounts were certified.
- Cross-page persistence, department/team propagation, payment-to-Billing Logs, notification click-through, and live storage were not verified.
- The browser suite used mocked API responses; the API suite used offline isolation rather than a live deployment.
- Confirmed browser/API regressions and the API-TEST-001 test defect remain open.
- Settings timeout stability remains inconclusive after a passing full run.
- Cross-page focused matrix results are from Phase 7.4; Phase 7.5 did not rerun those 21 cases as a separate command.

## X. Final recommendation

**PARTIALLY COMPLETE.** Required safe discovery, browser, API and web unit runs completed, but historical identity/assertion reconciliation is not complete and regressions remain. Stop for administrative review. The next actions are to decide PW-149’s identity alias, review all 52 historical assertion rows and the 78 additional assertion sites, clarify unresolved API/UI contracts, and authorize any remediation or accepted-test change separately.

## Explicit scope confirmation

- No accepted Page 1–23 tests were modified in Phase 7.5.
- No historical assertion was weakened; no test was removed; no new skip was introduced.
- No production application code, backend business logic, or Prisma schema was changed.
- No commit or push occurred; Phase 8 was not started.
- No production-readiness claim was made.

## Modified files and evidence

The intended tracked changes are these four new reports only: this report, `phase7.5-execution-matrix.md`, `phase7.5-defect-register.md`, and `phase7.5-preservation-reconciliation.md`. Raw execution, trace, discovery, reconciliation, build, and quality-gate evidence is under `test-results/phase7/phase7.5/`; those outputs are ignored by Git.

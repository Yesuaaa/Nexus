# Converyn Playwright Regression Project Handoff

**Snapshot date:** 2026-11-13 (Asia/Singapore)  
**Repository:** Nexus (product branding: Converyn)  
**Active branch:** 219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages  
**Verified HEAD:** 30ce6951b30dc22e5c40134c319dd5be778a28ed  
**Checkpoint:** Phase 7.4.1; Pages 1–8 accepted; Page 9 awaits explicit user authorization.

This handoff records the inspected repository and its accepted testing evidence. It is a continuity document, not a new verification report. Runtime totals below come from cited reports and execution artifacts; this task did not rerun regression suites.

## SECTION 1 — PROJECT IDENTITY AND OVERVIEW

Converyn is a role-based business operations and service-management platform. The repository and package namespaces still use Nexus names, including the root package and @nexus/web and @nexus/api packages. This handoff uses Converyn for the product and Nexus for repository paths and Git references.

Current manifests describe a Next.js 16 / React 19 / TypeScript web client, Express 5 / Node.js / TypeScript API, Prisma 7 with PostgreSQL, pnpm, Playwright, Node’s built-in test runner, and PGlite for isolated database-backed API tests. Tailwind CSS and Radix-based UI are used in the web application. API tests live under apps/api/tests; feature-owned browser specs live under apps/web/e2e. The development merge added motion@^14.11.0 and updated the lockfile. This handoff makes no claim that a production database, provider integration, or live service was exercised.

The four fixed account roles are SUPERADMIN, ADMIN, STAFF, and USER. The UI labels USER as “Client”. Access also depends on permissions, whether a STAFF account is the current Department Head, project/workspace assignment, resource ownership, and feature-specific policies. Do not infer that an administrative role inherits a Department Head or USER permission. Account Management enforces that users cannot change their own role or active status; password reset for other accounts is restricted to SUPERADMIN.

Useful top-level areas include apps/web/src/features, apps/api/src/features, apps/web/e2e, apps/api/tests, docs/testing, and test-results. The Next.js proxy sends same-origin /api requests to the API, historically defaulting to localhost:3001.

## SECTION 2 — ORIGINAL OBJECTIVES

The initiative began to establish dependable, maintainable regression coverage across the application without losing historical tests or creating expectations for functionality the product does not implement. The intended work was to inventory repository/tests, preserve original Playwright identities and assertions, organize tests by feature/page, identify real coverage gaps from source, add justified browser and API cases, distinguish test defects from application defects, and document what was and was not verified.

A central rule is that mocked browser success proves only UI behavior under the supplied response. It does not prove server authorization, durable persistence, production provider behavior, or a live user journey. API claims require isolated API/PGlite evidence; live claims require a verified disposable integrated environment.

## SECTION 3 — COMPLETE EIGHT-PHASE ROADMAP

| Phase                                             | Objective                                                                                            | Verified status at this checkpoint                                                                                                                                                                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Repository Inspection                          | Inventory repository structure, routes, modules, and existing regression setup.                      | Completed in the historical audit; retained inventory is referenced from Phase 4 baseline artifacts.                                                                                                                                        |
| 2. Regression Coverage Audit                      | Capture original test inventory, identities, assertion sites, coverage, and limitations.             | Completed and preserved. Accepted baseline: 292 identities, 1,630 assertion sites, and 4,211 identity-to-site mappings.                                                                                                                     |
| 3. Modular Regression Architecture Design         | Define feature/page ownership, reusable support, and preservation rules before migration.            | Resulting modular organization is present, but no approved standalone Phase 3/3.9 architecture ledger or destination map was found in the repository during Phase 4.2. Do not represent the later proposed mapping as a recovered approval. |
| 4. Regression Refactoring                         | Move and reconcile tests while preserving historical identities and assertions.                      | Migration/reconciliation work is present and supported by Phase 4/6 evidence. Baseline and CSV ledger remain immutable; approved deltas are append-only.                                                                                    |
| 5. Coverage Planning                              | Assess page behavior, existing coverage, gaps, API reuse, and excluded/blocked behavior.             | Phase 5.1 assessment and Phase 5.2 backlog are documented. Twelve implementable scenarios and three blocked/deferred candidates were recorded; unsupported behavior was excluded.                                                           |
| 6. Page-Specific Regression Implementation        | Implement planned browser/API cases and preserve known limitations.                                  | Completed as an implementation phase with accepted scenario-specific limits and findings. “Complete” does not mean defect-free.                                                                                                             |
| 7. Verification and Reliability                   | Establish discovery baseline, verify pages/API/workflows, then complete sequential page enhancement. | In progress. Phases 7.1–7.4 have reports; Phase 7.4.1 has completed Pages 1–8. Page 9 is next and not yet authorized. Phase 7.5 has not started.                                                                                            |
| 8. Final Documentation and Maintenance Guidelines | Publish final verified coverage, limitations, and maintenance process.                               | Not complete. These handoff files are continuity artifacts, not Phase 8 closeout.                                                                                                                                                           |

Where a formal design artifact or exact later subphase title was absent, that absence is stated instead of reconstructed.

## SECTION 4 — PHASES 1–3 ACCOMPLISHMENTS

### Repository and original test inventory

The preserved Phase 2 baseline describes 35 original Playwright specification files, 157 executable declaration groups, and 292 expanded historical Playwright identities. The browser test tree was inspected and mapped to the original 18 page groups. The later Phase 7.1 inventory established an ordered 23-page matrix after application and development-branch changes.

The Phase 4 U00 report records that 112 original Phase 2 artifacts (25,070,969 bytes) were copied byte-for-byte into docs/testing/migrations/phase4/baseline/artifacts. Required artifacts include report.md, inventory.md, coverage-matrix.md, assertions.md, preservation-map.csv, baseline.json, discovery.json, execution.json, verification.json, command records, and screenshots. They are preserved evidence, not scratch output.

### Historical identity and assertion baseline

The accepted historical counts are distinct measures:

- 292 original Playwright identities.
- 1,630 historical assertion sites.
- 4,211 identity-to-assertion-site ownership mappings.

The preserved baseline JSON, source inventory, AST-derived assertion inventory, discovery/execution records, and CSV mapping provide the evidence. The Phase 4 preservation report records that all 292 expanded identities match saved discovery/execution metadata, and all 4,211 mapping rows match ownership, source expressions, and hashes. Repeated identity ownership across different sites is expected. These totals are not current Playwright discovery counts or new tests.

### Phase 2 audit-tooling lessons

The Phase 4 verification guide records the migration verifier’s final behavior:

- Use Playwright’s supported test-list selection mechanism for exact identity selection; do not rely on unsupported name/filter assumptions.
- Keep discovery, execution, command records, stderr, and reports in a newly allocated directory for each invocation. This avoids overwriting prior evidence and retains failed attempts.
- Treat list-only output as discovery, never as an execution result. List output may count opt-in cases differently from an actual run.
- Compare exact identities, source declarations, assertion expressions/occurrences, and helper/hook context. Missing, changed, duplicated, or extra assertions fail verification rather than receiving a file-wide waiver.

The old Phase 2 build’s source provenance was not verified. Later Phase 4 work built a source-pinned reference; it did not strengthen the historical claim.

### Phase 3 architecture record limitation

The Phase 4.2 guide explicitly says a repository search found no approved Phase 3/3.9 ledger or modular directory specification. It records ownership of cross-page tests and shared helpers as historical decisions that could not be recovered. The present tree demonstrates feature-owned specs and shared specs/support, but this handoff does not claim that the current exact folder layout was an approved Phase 3 design. proposed-mapping.json is marked PROPOSED and is not authorization or proof of the original design.

## SECTION 5 — PHASES 4–5 ACCOMPLISHMENTS

### Phase 4: modular migration and preservation

The current browser tree organizes tests by feature (auth, accounts, clients, employees, services, projects, billing, messages, and other domains) with cross-page behavior under shared/workflows. API cases were brought into the development branch’s apps/api/tests architecture and use an isolated PGlite harness where persistence is tested.

Preservation was checked statically against the immutable Phase 4 inventory. Original IDs and titles remain traceable; approved behavior changes were recorded with exact source sites and replacement assertions. The Phase 6 reconciliation reports 292/292 identities, 1,630/1,630 historical sites, and 4,211/4,211 mapping edges accounted for. Phase 4 baseline files were not regenerated to reflect later changes.

Phase 4 execution evidence includes a source-pinned reference run at the original source revision with 287 passed, 0 failed, and 5 skipped. Later selected migration checks preserved outcomes for approved units. Those results are not the current 440-case suite.

### Phase 5: coverage planning

Phase 5.1 mapped 18 original page groups to existing identities, source behavior, authorization, browser/API ownership, and limitations. Coverage labels separate evidence level from runtime pass rate. The report notes that several apparent backend gaps already had Express/PGlite tests and should be reused rather than duplicated.

Phase 5.2 proposed 12 implementable NEX scenarios, three blocked/deferred candidates, and explicitly excluded unsupported Client editing/deletion and Dashboard widgets. Its scope rule is source-first: add tests only for implemented behavior or an approved product contract. Browser mocks do not replace PGlite/API coverage.

## SECTION 6 — PHASE 6 ACCOMPLISHMENTS

Phase 6 implemented scenario-based regression additions and recorded them separately from original PW identities. The original Phase 5.2 backlog defines NEX-001 through NEX-012; later Phase 6/7 materials attribute NEX-013 through NEX-018 to project, deliverable, team-lead, billing, and notification work. The Phase 7.1 page matrix is the authoritative source for those later route/API ownership links. For NEX-013 through NEX-016, exact historical scenario titles were not recovered in the tracked narrative; use the matrix and actual API test source rather than inventing titles.

| ID      | Scenario represented in the accepted backlog/matrix                      | Outcome or continuing limitation                                                                                                                                                            |
| ------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NEX-001 | SUPERADMIN account API creation and persistence.                         | PGlite/Express account creation is represented in the employee integration module; Phase 7.3 reported that module passing 21/21.                                                            |
| NEX-002 | Account creation dialog and response handling.                           | Existing browser scenario remains separate from original PW history; Page 4’s expanded tests cover additional validation/retry behavior.                                                    |
| NEX-003 | Project Workspace API lifecycle.                                         | API ownership is in the project-workspace module; follow current Department Head/manager authorization and state-transition rules.                                                          |
| NEX-004 | Workspace plan/task API behavior.                                        | Project-workspace API coverage; browser/UI and API persistence are separate claims.                                                                                                         |
| NEX-005 | Deliverable API authorization and lifecycle.                             | Project-workspace API ownership; no real object-storage provider integration is implied.                                                                                                    |
| NEX-006 | Workspace creation wizard.                                               | Accepted limitation: current wizard route is inaccessible/redirected. Do not invent a successful wizard journey.                                                                            |
| NEX-007 | Workspace rename/cancel UI lifecycle.                                    | Existing UI case and row-action tests are retained; scope follows the current workspace manager flow.                                                                                       |
| NEX-008 | Workspace plan/task UI save and recovery.                                | Existing UI case remains; use current row/action controls.                                                                                                                                  |
| NEX-009 | Deliverable UI workflow.                                                 | Existing browser behavior uses mocked state; file persistence/provider behavior is not established.                                                                                         |
| NEX-010 | Registration validation.                                                 | Four original NEX-010 cases remain; Page 2 later added 20 distinct validation/recovery cases.                                                                                               |
| NEX-011 | Department team/member management.                                       | Existing scenario/assertions remain. Selectors were reconciled to the rendered UI; Page 7 added two UI and three isolated API cases.                                                        |
| NEX-012 | Client related records.                                                  | Existing UI/API coverage remains; Page 5 added seven cases and checked related-record rendering with mocked responses.                                                                      |
| NEX-013 | Project Details / project API ownership in the Page 7.1 matrix.          | API ownership is attributed to project-workspace; exact historical title was not recovered in available narrative.                                                                          |
| NEX-014 | Client Deliverable Details API ownership.                                | API ownership is attributed to project-workspace; exact historical title was not recovered in available narrative.                                                                          |
| NEX-015 | Team-lead assignment/removal contract.                                   | Assignment/reassignment is supported. Historical records call removal unsupported, while current API schema/service accept leadId=null. This remains unresolved; no removal test was added. |
| NEX-016 | Billing Logs API ownership in the Page 7.1 matrix.                       | API ownership is attributed to project-workspace; exact historical title was not recovered in available narrative.                                                                          |
| NEX-017 | Client project, brief, request, and deliverable workflows/notifications. | UI behavior remains. Brief-update and deliverable-review error notifications are a known product defect.                                                                                    |
| NEX-018 | Billing Logs UI authorization and client records/proof.                  | Five browser cases remain. Access is USER/client-owned; internal-role denial remains meaningful.                                                                                            |

Other accepted limits established in Phase 5/6 and retained later:

- Dashboard has no implemented widgets, analytics, or dashboard API; the page is an empty labeled main region. This is intentionally unsupported, not a test omission to fill with invented features.
- Client Management is read/create with read-only details; edit/delete remain intentionally unsupported under the accepted F2 contract.
- Request Inbox has no agreed successful decline/delete backend contract/routes. Verify supported head-only reads/acceptance and failure recovery; do not assert unsupported success.
- NEX-017 notification failures, NEX-006 wizard limitation, NEX-015 team-lead discrepancy, and five live-backend identities are not erased by phase completion.
- API PGlite integration and browser mocks prove different layers. Supabase/storage, persistent live state, and live role logins were not verified in these phases.

## SECTION 7 — DEVELOPMENT BRANCH INTEGRATION

The development merge is historically complete. Commit b6d9b8ae4ccdac5341fcff7df2223f3bef47bb23 is present on the active branch with parents f71da7b0835a3cdab043511f8dc4d622b42c3cb8 (regression branch) and 3c5ff4b13fe0bb410947c385c8f8007c695fa7a7 (development). The merge report says development was fetched and merged locally; no push occurred as part of that task.

The merge brought role-specific client/workforce authentication and module selection, updated route/permission policies, account lifecycle helpers, API validation/error/query utilities, updated feature services/controllers, and moved API tests into apps/api/tests. It also changed test runner scripts and introduced modular feature-owned browser specs. No Prisma schema change or migration was part of the incoming diff. motion@^14.11.0 was added and pnpm-lock.yaml updated during the historical merge.

Six conflicts were documented and resolved: apps/api/package.json; auth/regression.spec.ts; services/services.spec.ts; shared/auth-styles.spec.ts; shared/table-interactions.spec.ts; and docs/testing/INPUT_VALIDATION_AUDIT.md. Resolution preserved test behavior and reconciled source-backed changes: internal roles use /module, USER uses /dashboard, current account-menu logout and service controls are asserted, and F2 remains read-only. API tests use the incoming tests/ layout and PGlite harness. No additional development merge is currently recorded as required. The accepted merge is an ancestor of HEAD.

The merge report recorded successful format, lint, typecheck, build, 22/22 Page 5 browser cases, and one unresolved API request-workflow test-contract failure. Those results are historical, not a current run.

## SECTION 8 — PHASE 7 PROGRESS

| Subphase                             | Recorded work and results                                                                                                                                                                                                                    | Status                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 7.1 Test Discovery and Baseline      | 326 discovered cases in 46 spec files, including five opt-in live-backend cases. Chromium and runner environment inventoried; no browser/API cases ran in this phase.                                                                        | Complete as inventory; later discovery supersedes its current count. |
| 7.2 Page Verification                | Existing source-matched offline browser suite assessed all 23 page groups. 321 applicable offline cases ran: 319 passed, 2 failed (NEX-017 notifications), no skips/flakes in those offline batches. Five live cases were not run by design. | Complete with defects/limits.                                        |
| 7.3 API Verification                 | All 28 API modules inventoried/executed; 19 use PGlite. After triage the report records 170 unique leaves: 169 passed and one reproducible request-workflow test-contract defect.                                                            | Complete with one test defect and live integration deferred.         |
| 7.4 Cross-Page Workflow Verification | 14 workflows inventoried (7 P0, 6 P1, 1 P2); 21 unique browser cases in 10 specs: 19 pass, 2 fail. Six workflows fully pass, one fails, four are partial, and three are not covered. Executed cases used mocked API responses.               | Complete with limitations.                                           |
| 7.4.1 Page-by-Page Enhancement       | Eight of 23 pages are accepted at this checkpoint. The 54 browser additions and 7 API additions are documented separately from original history. Regression investigation/reconciliation are complete.                                       | Current subphase; Page 9 awaits explicit authorization.              |
| 7.5 Combined/live verification       | Phase 7.4 calls for a dedicated disposable database and provisioned accounts, safe service lifecycle/cleanup, and independent browser/API counts before combined verification. Five live role cases are deferred here.                       | Not started.                                                         |
| 8. Final documentation               | Final coverage and maintenance instructions after verification.                                                                                                                                                                              | Not started.                                                         |

No later Phase 7.x title or approved sequence beyond Phase 7.5 was located in the available roadmap/report set. Do not invent a Phase 7.6 name. Continue through the 23 page groups sequentially after authorization, then return to documented Phase 7.5 prerequisites and final Phase 8 documentation.

## SECTION 9 — PHASE 7.4.1 PAGE INVENTORY

The ordered inventory comes from docs/testing/verification/phase7/phase7.1-baseline.md and is repeated in Phase 7.2. “Accepted” is the current project checkpoint for Pages 1–8, including documented defects/limits; “not started” means page-specific Phase 7.4.1 enhancement, even when earlier broad Phase 7.2 cases were attributed to that route.

|   # | Page and route                                                         | Phase 7.4.1 status       | Important scope/dependency or limit                                                                                              |
| --: | ---------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Login — /login                                                         | Accepted                 | Public form and session shell; internal landing is /module and USER landing is /dashboard. Five live role cases remain deferred. |
|   2 | Registration — /register                                               | Accepted with defects    | Public USER registration; client/server validation differences and two confirmed browser defects.                                |
|   3 | Dashboard — /dashboard                                                 | Accepted                 | Authenticated portal behavior; dashboard widgets/analytics intentionally unsupported.                                            |
|   4 | Account Management — /accounts                                         | Accepted                 | SUPERADMIN operations; self-role/status changes are denied; UI/API validation differ.                                            |
|   5 | Client Management — /clients                                           | Accepted                 | ADMIN client list/create; details are read-only; edit/delete intentionally unsupported.                                          |
|   6 | Employee Management — /employees                                       | Accepted                 | ADMIN manages Employee and linked STAFF account flows; linked-record transactions and department/team scope matter.              |
|   7 | Department Management — /departments                                   | Accepted with limitation | ADMIN UI; distinct API read/manage/delete permission checks; NEX-015 lead-removal contract unresolved.                           |
|   8 | Services — /services                                                   | Accepted with defects    | ADMIN catalog/pricing and USER service-request journey; three service findings are recorded.                                     |
|   9 | Client Service Requests — /service-requests                            | Not started              | USER-only owner-scoped request history/details/statuses. Next page; API module is client-requests.                               |
|  10 | Request Inbox — /request-inbox                                         | Not started              | Current Department Head STAFF only; successful decline/delete behavior lacks an agreed backend contract.                         |
|  11 | Booked Services — /booked-services                                     | Not started              | USER-owned booking history, filtering, details, deep links, and refresh.                                                         |
|  12 | Messages — /messages                                                   | Not started              | Role/resource-scoped conversations; use ownership and forbidden-actor rules, not role labels alone.                              |
|  13 | Project Details — /projects/[id]                                       | Not started              | USER-owned project view, assigned STAFF view, Department Head request review; NEX-017 notification findings.                     |
|  14 | Project Workspace — /project-workspace                                 | Not started              | STAFF list; Department Head/manager lifecycle; NEX-006 wizard remains inaccessible.                                              |
|  15 | Project Workspace Details — /project-workspace/[id]                    | Not started              | Head actions, assigned STAFF tasks/deliverables, scoped denials; NEX-008/009/015 and conversation dependencies.                  |
|  16 | Staff Workload — /staff-workload                                       | Not started              | Current department-head STAFF and assigned department/project scope; rejected writes must remain covered.                        |
|  17 | Profile — /profile                                                     | Not started              | All roles may manage own profile; STAFF has specialist fields; live storage is unverified.                                       |
|  18 | Settings — /settings                                                   | Not started              | Own preferences/password/session revocation; role-specific account menu.                                                         |
|  19 | Billing Logs — /billing-logs                                           | Not started              | USER-only client-owned billing/proof data; STAFF/ADMIN/SUPERADMIN denied.                                                        |
|  20 | Calendar — /calendar                                                   | Not started              | Role-specific self/team/organization event scope; eight existing cases.                                                          |
|  21 | Help — /help                                                           | Not started              | Authenticated FAQ search/disclosure; no dedicated browser spec in Phase 7.2.                                                     |
|  22 | My Projects — /projects                                                | Not started              | USER-only owned project list and cross-client isolation; NEX-017 route attribution.                                              |
|  23 | Client Deliverable Details — /projects/[id]/deliverables/[milestoneId] | Not started              | USER-owned projects and client-visible files only; internal/cross-client access denied.                                          |

Auxiliary routes / and /project-workspace/new are outside the official 23-page count. The latter redirects to the workspace list; do not invent a functioning wizard journey.

## SECTION 10 — ACCEPTED PAGES 1–8

The reports below are the authoritative source for field-level details and traces. The summaries retain implemented behavior, layer boundaries, test additions, results, and open findings. Page acceptance describes completion of the audit/test task, not absence of defects.

### Page 1 — Login

Report: docs/testing/verification/phase7/page-by-page/page-01-login.md. Three new Login browser cases cover Enter submission and unsafe redirects, network-failure retry, and malformed success responses. Existing coverage checks validation, focus, pending/duplicate submits, masking, token/session refresh, logout, localization, CSP, and responsive layout. Browser requests are mocked. The API schema/service handles email normalization, credential errors, active/deleted account checks, throttling, and persisted refresh-session logic; Phase 7.3 API evidence is separate.

The form validates required email/password, email length/shape, and password UTF-8 byte limit; password content is preserved. The post-merge landing contract is USER to /dashboard and internal roles to /module. Final browser group: 48 cases, 47 passed, 1 failed. LOGIN-001 is the retained malformed-token response failure that stores the string “null” in sessionStorage. LOGIN-002 is a visible Forgot password link whose /forgot-password destination returned 404. Five real-account cases PW-124–PW-128 remain deferred. The new 48px authentication design contract was reconciled after the page report.

### Page 2 — Registration

Report: docs/testing/verification/phase7/page-by-page/page-02-registration.md. Twenty new browser cases cover the form, required-field focus, full-name Unicode/punctuation and length boundaries, contact prefix/formatting, email normalization/bounds, password classes and UTF-8 byte bounds, confirmation recovery, duplicate submission, Enter, and 400/429/503/network retry paths. Browser API responses were mocked. A separate focused auth/PGlite run passed 14 test entries.

The route creates USER/client accounts; server registration fixes the role rather than accepting caller-selected privilege. The UI and API differ in phone/email/password validation breadth. Final offline Page 2 group: 37 cases, 35 passed, 2 failed. REG-001 is formatted contact truncation before normalization; REG-002 is malformed success token “null” persistence. These defects remain. No live account was created.

### Page 3 — Dashboard

Report: docs/testing/verification/phase7/page-by-page/page-03-dashboard.md. Dashboard content is an empty accessible main region inside the portal shell; shared shell features include role navigation, account loading/error states, messages, notifications, and account menu. There is no Dashboard-owned widget/API contract. Nine new cases cover route/role and responsive/navigation behaviors; isolated role-permission API module passed 6/6.

The final bounded set contained 48 unique browser cases, all passed; overlapping role-navigation identities were counted once. No widget tests were fabricated. Live role credentials and persistent state were not used. The page remains accepted with intentionally unsupported content scope.

### Page 4 — Account Management

Report: docs/testing/verification/phase7/page-by-page/page-04-account-management.md. The UI provides a SUPERADMIN-only directory, search/role filtering, sort/pagination, create, role/status change, Trash and permanent-delete confirmation flows, and error/retry behavior. API routes separately enforce permissions, self-change restrictions, account state, and conflict handling. Browser checks use mocks; account creation persistence has separate PGlite evidence.

Five new browser cases NEX-019–NEX-023 cover list query behavior, retry after errors, create validation, role/status failure recovery, and confirmation cancellation. All 16 unique Page 4-attributed browser identities passed after one transient 390px loopback navigation failure passed on focused rerun. Four focused API modules passed 9/9; Phase 7.3 employee integration (including NEX-001 account creation) passed 21/21. Client/server create validation differs for email suffixes, names, phone, and password classes; the report records an unresolved contract question rather than a confirmed defect. Some empty/error UI states remain partial.

### Page 5 — Client Management

Report: docs/testing/verification/phase7/page-by-page/page-05-client-management.md. ADMIN can list/search/filter/sort/page clients, create them, and open read-only details with related service requests/projects. API coverage includes client integration and related records. Client edit/delete remain intentionally unsupported under F2.

Seven new NEX-024–NEX-030 browser cases cover input boundaries, normalized payloads, validation and retry/error behavior. Final Chromium group: 22/22 passed. Focused isolated API module: 10/10 reported entries passed. No product defect was confirmed. Browser responses were mocked; live persistence/provider behavior and unusual Unicode/API-only boundaries remain limited. A stale client-creation statement in docs/rbac.md is also noted.

### Page 6 — Employee Management

Report: docs/testing/verification/phase7/page-by-page/page-06-employee-management.md. ADMIN manages an Employee directory, details, creation/editing, eligible account completion, employment filters, archived views, pagination, login-account actions, and department/team placement. An Employee may exist without a linked User, while the directory relies on eligible User accounts; linked STAFF User and Employee creation is transactional. Account archive/delete and employment status are different state machines.

Three new browser cases cover invalid contact blocking, create conflict recovery/request serialization, and filter/pagination query behavior. Final scoped run: 27/27 passed; the run includes generated shared table cases across routes. Focused PGlite/API modules passed 28/28. No live database was used and no new product defect was confirmed. Employment-status mutation UI is not wired even though API support exists; do not invent it.

### Page 7 — Department Management

Report: docs/testing/verification/phase7/page-by-page/page-07-department-management.md. ADMIN UI supports departments, head selection, teams, member assignment, search/sort/local pagination. API read/manage/delete permissions are separate; eligibility and linked Employee/User synchronization are tested using PGlite. Two new browser cases cover search/sort/pagination and form boundary/error recovery. Three isolated API cases cover uniqueness/normalization/boundaries and team-lead reassignment/linked records.

Final browser selection passed 15/15. Four API modules reported 62 unique leaves passed. No application defect was confirmed. NEX-015 is unresolved: historical docs call team-lead removal unsupported, while current team update schema/service accept leadId=null. No removal assertion was added. Live integration and source-only overview/team deletion behavior remain outside the verified result.

### Page 8 — Services

Report: docs/testing/verification/phase7/page-by-page/page-08-services.md. ADMIN manages catalog/pricing and USER browses offerings and submits service requests. Page tests exercise service CRUD/validation, templates, client request flow, and ownership/auth rules. Five new browser cases and four isolated API cases were added. The original Page 8 focused run recorded 31 browser cases: 28 passed and 3 failed; targeted API coverage recorded 58 unique leaf tests: 57 passed and 1 failed. Do not replace those results with a green aggregate.

Three findings were recorded: SVC-001 pricing validator permits a value above Prisma Decimal(12,2) capacity and produces a database 500; SVC-002 stale pagination remains when clearing search/view state; SVC-003 requirements accepted in the UI are rejected by API validation. The later broader investigation corrected two mistaken client-workflow toast/heading expectations, but did not fix SVC defects. The user subsequently accepted the page with documented defects; the report itself recommends administrative review and says acceptance is the user’s decision.

## SECTION 11 — NEW REGRESSION COVERAGE

Page-specific browser additions are distinct new cases, not historical PW identities:

| Page                    | Added browser cases |
| ----------------------- | ------------------: |
| 1 Login                 |                   3 |
| 2 Registration          |                  20 |
| 3 Dashboard             |                   9 |
| 4 Account Management    |                   5 |
| 5 Client Management     |                   7 |
| 6 Employee Management   |                   3 |
| 7 Department Management |                   2 |
| 8 Services              |                   5 |
| **Total**               |              **54** |

Page 7 added three isolated API cases; Page 8 added four, for seven API additions. Page 1–6 additions reused existing API test modules where applicable; they did not add these seven API cases.

These totals are separate from 292 original Playwright identities, 1,630 assertion sites, and 4,211 preservation mappings. Page reports also contain shared test identities and route attributions; do not sum route rows as unique executions. Phase 7.1’s count of 326 and later 440 discovery are separate snapshots. Available reports do not provide an identity-level bridge explaining the difference between 326 plus 54 and 440; that 60-case arithmetic difference is UNVERIFIED — REQUIRES CONFIRMATION. Use the final discovery artifact for current discovery and preserve 440/58 as the latest recorded inventory.

## SECTION 12 — PAGE 8 SERVICES FINDINGS

Page 8 is reported as an audit/test task complete with verified defects, not as a defect-free application. Its original test run was 31 browser cases with 28 passes and 3 failures; API unique leaves were 58 with 57 passes and 1 failure. One failing API pricing boundary is also the later P1 targeted API failure.

SVC-001: the validator accepts 99,999,999,999.99 although the Prisma Decimal(12,2) maximum is 9,999,999,999.99. PGlite observed P2020/HTTP 500 rather than validation rejection; transaction evidence shows no service/template rows persisted.

SVC-002: returning from a searched/filtered service view restores stale pagination rather than page one. The later broad investigation identifies M3 as the same shared local-table pagination defect (APP-TABLE-001) found by I1 in project pagination.

SVC-003: the client requirements input accepts a value the API validator rejects. Keep the implementation discrepancy visible; no API contract or test expectation was changed to conceal it.

Two original Services client workflow checks incorrectly expected success toast content to be a heading. The investigation corrected those selectors/expectations to the actual Sileo toast in its polite live region, and used the current “Back to services” control. That test correction is separate from the three Services findings. The Page 8 report is docs/testing/verification/phase7/page-by-page/page-08-services.md.

## SECTION 13 — REGRESSION FAILURE INVESTIGATION

After Page 8, a broad run reported 423 passed, 12 failed, and 5 skipped across the 440 discovered browser tests. A bounded investigation reproduced 35 reported browser leaves independently and investigated one API pricing leaf. It was necessary to distinguish incorrect test assumptions from genuine product behavior before proceeding to another page.

The initial investigation documented 23 test-implementation defects. Twenty-two affected cases passed in the later broad run; I1’s wrong “button” locator was corrected to the source-backed project link, but the test still fails on actual stale pagination. The subsequent final reconciliation also corrected F1/F2’s obsolete 40px precondition to the user-approved 48px contract; both passed. The final investigation report therefore counts 25 test implementation defects addressed across the investigation and follow-up. These are test corrections, not product fixes.

A1, the account-password test, passed on independent rerun and three repeats; its original aggregate failure was not reproduced and its originating trace was unavailable. It is classified UNKNOWN-001, not a confirmed application failure. No faulty fixture or mock was established as the cause.

The investigation corrected current contracts while preserving meaningful test intent:

- Internal-role landings use /module; USER uses /dashboard. This applies to auth portal, Billing Logs, Booked Services, Request Inbox, Client Service Requests, and route-denial checks.
- Billing Logs denial continues to assert no protected content/data read; only the expected redirect was aligned.
- Booked Services and Client Service Requests still assert USER-only visibility and no internal-role read.
- Project tests locate the rendered project anchor rather than a nonexistent button.
- Workspace task/project edits use actual row action menus and “Edit task” / “Edit project” items.
- Services client workflows assert current toast content in the Sileo polite live region and current navigation.
- Historical Client Service Requests focus assertions now check the actual “Request submitted” heading; heading focus was preserved.

No application source, backend code, Prisma schema, dependency manifest, lockfile, fixture, or API test was changed by this investigation. Genuine defects remain as listed in Section 18. The full 440-case suite was not rerun after F1/F2; 425/10/5 remains only a projection.

## SECTION 14 — REGRESSION CORRECTIONS

The committed regression correction set touches eleven E2E files:

| File                                                          | Correction                                                                                                            |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| apps/web/e2e/auth/portal-regression.spec.ts                   | Role-specific /module versus /dashboard route assertions; protected-workload checks retained.                         |
| apps/web/e2e/billing/billing-logs.spec.ts                     | Internal role expected landing corrected to /module; protected-data denial remains.                                   |
| apps/web/e2e/booked-services/booked-services.spec.ts          | Internal role expected landing corrected to /module; hidden-content/no-read checks remain.                            |
| apps/web/e2e/request-inbox/request-inbox.spec.ts              | Role/head-specific route expectations corrected while preserving authorization checks.                                |
| apps/web/e2e/service-requests/client-service-requests.spec.ts | Internal landing corrected to /module; USER-only history/no-read assertions remain.                                   |
| apps/web/e2e/form-inputs.spec.ts                              | Authentication uses 48px; helper keeps a 40px default for non-auth forms and retains focus/border checks.             |
| apps/web/e2e/projects/client-project-workflows.spec.ts        | Use rendered project link; I1’s actual pagination failure remains.                                                    |
| apps/web/e2e/projects/workspace-detail-mutations.spec.ts      | Use source-backed task row action menu and “Edit task”.                                                               |
| apps/web/e2e/projects/workspace-mutations.spec.ts             | Use source-backed workspace row action menu and “Edit project”.                                                       |
| apps/web/e2e/services/client.spec.ts                          | Assert rendered Sileo toast in polite live region and current back link.                                              |
| apps/web/e2e/shared/clients.spec.ts                           | Preserve confirmation-heading focus; assert it absent before retry; retain payload/idempotency/navigation assertions. |

## SECTION 15 — ACCESSIBILITY AND DESIGN CONTRACTS

The user explicitly approved 48px for Login and Registration inputs at desktop and mobile sizes. The app’s h-12 classes were left intact. F1 at 1440px and F2 at 390px passed after correcting their precondition. They check input focus, border-only focus treatment, focus visibility, consistent styling, and responsive behavior. The whole form-inputs specification passed 7/7; non-authentication consumers still use the helper’s 40px default.

Historical success-heading focus remains an explicit behavior. The current page focuses the “Request submitted” heading through ClientServicesPage’s headingRef/focus callback and ClientPageHeader’s tabIndex=-1 heading. The toast is separate user feedback: Sileo renders inside a viewport with aria-live="polite". Toast visibility does not substitute for heading focus, and heading focus does not substitute for an accessible toast announcement. The corrected client workflow group (M1/M2/N1–N4) passed 6/6. No artificial focus behavior was added.

## SECTION 16 — HISTORICAL ASSERTION RECONCILIATION

The append-only source-of-truth ledger is docs/testing/migrations/phase6/approved-regression-deltas.md. The immutable Phase 4 baseline, Phase 6 reconciliation JSON/CSV, and accepted Page 1–8 reports remain intact. The final report records nine sites and 22 identity-to-site references, source-verified as equivalent.

| Historical site                        | Owners         | Final assertion intent preserved                                                               |
| -------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------- |
| portal-regression.spec.ts:36:11        | PW-101–PW-104  | USER remains on /dashboard; internal roles land on /module; no-workload-fetch remains checked. |
| booked-services.spec.ts:491:11         | PW-030         | Expect /module; retain hidden booking-content and no-read checks.                              |
| client-service-requests.spec.ts:289:11 | PW-037–PW-039  | Expect /module; retain hidden navigation and no-client-read checks.                            |
| request-inbox.spec.ts:623:11           | PW-215–PW-218  | USER remains on /dashboard; internal roles land on /module; head/role denial remains.          |
| client.spec.ts:545:13                  | PW-050–PW-051  | Exact success toast text is visible inside Sileo’s aria-live polite viewport.                  |
| clients.spec.ts:126:13                 | PW-057, PW-060 | “Request submitted” heading is absent after failed first attempt; retry assertions remain.     |
| clients.spec.ts:135:13                 | PW-057, PW-060 | “Request submitted” heading receives focus after successful retry.                             |
| clients.spec.ts:219:15                 | PW-058, PW-061 | “Request submitted” heading receives focus after successful submission.                        |
| clients.spec.ts:225:15                 | PW-058, PW-061 | Current “View booked requests” link retains /service-requests destination.                     |

The four original preservation measures remain 292 identities, 1,630 sites, and 4,211 ownership mappings, plus prior authorized deltas; these are not re-counted as new coverage. Phase 6.2.5 had already recorded ten superseded sites and 24 identity-to-site edges; the final Phase 7.4.1 ledger separately records the nine requested historical sites and 22 references. Do not combine or overwrite these inventories without the established mapping procedure. The focus requirement at the two clients.spec.ts sites was not obsolete; the visible heading label changed, and current source still explicitly focuses the heading.

## SECTION 17 — CURRENT TEST INVENTORY AND EXECUTION

| Measure                                                               |                                    Latest accepted evidence |
| --------------------------------------------------------------------- | ----------------------------------------------------------: |
| Original historical identities                                        |                                                         292 |
| Historical assertion sites                                            |                                                       1,630 |
| Historical ownership mappings                                         |                                                       4,211 |
| Pre-existing post-baseline browser additions recorded before Page 1–8 |                                                          34 |
| Page 1–8 browser additions                                            |                                                          54 |
| Page 7–8 API additions                                                |                                                           7 |
| Phase 7.1 discovery                                                   | 326 cases / 46 spec files, including five live opt-in cases |
| Latest Playwright discovery                                           |                                   440 cases / 58 spec files |
| Last complete browser execution                                       |              423 passed / 12 failed / 5 skipped; zero unrun |
| Focused form-input file                                               |                                         7 passed / 0 failed |
| Dedicated F1/F2 selection                                             |                                         2 passed / 0 failed |
| Client workflow M1/M2/N1–N4                                           |                                         6 passed / 0 failed |
| Targeted API unique leaves                                            |                                7 total: 6 passed / 1 failed |

The broad browser result predates the approved F1/F2 correction. Suggested 425 passed / 10 failed / 5 skipped is arithmetic projection only and was not executed. Do not present it as the full-suite result. The remaining 10 failures are retained defects, not tests to skip or weaken. API pricing is separate from browser counts.

The 326 baseline plus 54 page additions would be 380 only if all scopes were a simple disjoint identity count. Final evidence does not provide an identity-level bridge explaining the 60-case difference between that arithmetic and later 440 discovery. Page attributions overlap shared specs; revisions differ; therefore this is explicitly UNVERIFIED — REQUIRES CONFIRMATION. Preserve both source-specific counts and do not manufacture reconciliation. Current discovery output: test-results/phase7/regression-failure-investigation/playwright-discovery-final-reconciliation.txt. Current run summary: test-results/phase7/regression-failure-investigation/final-verification-summary.txt.

## SECTION 18 — VERIFIED APPLICATION DEFECTS

The regression report distinguishes ten failing browser leaves from six distinct frontend root defects, plus one API pricing defect. Additional historical defects/limitations follow in Section 19.

| Report ID / affected case    | Confirmed behavior                                                                                                             | Root-cause evidence or relationship                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| APP-REG-001 / C1             | Formatted Registration contact is truncated at maxLength 11 before separators are stripped.                                    | auth-form.tsx and focused reproduction.                                                                  |
| APP-AUTH-001 / C2; LOGIN-001 | HTTP 200/201 malformed auth body with token:null stores the string “null” in sessionStorage.                                   | Auth response shape is trusted and passed to token storage. Login and Registration share this class.     |
| APP-CONV-001 / G1, H1–H3     | Archive action is intercepted by the conversation search input because of header overlap.                                      | One shared UI obstruction explains four failing leaves.                                                  |
| APP-DELIVERABLE-001 / I2     | Failed client deliverable review response is not surfaced; direct Sileo error call has no mounted toast viewport on that page. | Separate from historical NEX-017 page notifications.                                                     |
| APP-TABLE-001 / I1, M3       | Returning to a view restores stale local pagination rather than page one.                                                      | Shared table hook/state defect; I1’s locator was corrected but the application failure remains.          |
| APP-MENU-001 / O1            | At 390×400 the authorized service row menu trigger expands but Edit menu content is unavailable.                               | Mobile dropdown/menu rendering defect.                                                                   |
| API-PRICE-001 / P1           | Amount beyond Decimal(12,2) capacity returns HTTP 500/P2020 instead of a validation rejection.                                 | Schema maximum is 9,999,999,999.99; validator accepts 99,999,999,999.99. PGlite records no partial rows. |

C1, C2, G1, H1, H2, H3, I1, I2, M3, and O1 are the ten leaves in the prior broad browser result that remain failing after test corrections. The six frontend root defects above explain those ten cases. API-PRICE-001 is the one targeted unique API leaf failure.

## SECTION 19 — ACCEPTED LIMITATIONS

Keep these findings visible even if absent from the latest ten browser failures:

- LOGIN-002: the “Forgot password?” destination /forgot-password is missing and returned 404 in same-HEAD diagnostic evidence.
- REG-001 and REG-002: formatted contact truncation and malformed successful Registration token storage. Client and API phone/email/password rules also differ.
- NEX-017-BRIEF-ERROR and NEX-017-DELIVERABLE-ERROR: expected error notifications for brief update and deliverable review are absent; reproduced in Phase 7.2 and again in Phase 7.4. Page 8 client toast-selector corrections are not these project-page defects.
- Request Inbox: there are no approved backend success routes/contract for decline/delete. Keep the limitation and current authorization/acceptance behavior.
- NEX-006: workspace wizard is inaccessible/redirected; no successful wizard journey has been verified.
- NEX-015: historical user-facing team-lead removal is unsupported, while current API null-lead update is accepted. Contract remains unresolved.
- SVC-003: UI accepts requirements the API rejects. Preserve the mismatch until the product contract is resolved.
- Client Management F2: edit/delete stay intentionally unsupported. Dashboard widgets/content behavior is intentionally unsupported.
- Department relationships: team-lead/member assignment synchronizes related User/Employee department/team state; linked records are covered in PGlite. NEX-015 remains the unresolved edge case.
- Employee/User lifecycle: Employee can exist without a linked User; linked account creation is transactional; account archive/delete is distinct from employment status. Current UI does not expose an active employment-status action even where API support exists.
- API request-workflow test defect from Phase 7.3: a test reads a client-hidden milestone from a USER response that deliberately returns no milestones. This is a test-contract defect, not an application defect; it was not corrected during the regression investigation.
- Five live-backend role/auth cases PW-124–PW-128 remain deferred until a dedicated disposable database and synthetic accounts are verified.
- No live Supabase/file-storage provider, production database persistence, or all-role login was established by mocked UI or PGlite alone.
- Page 21 Help had no dedicated browser test in Phase 7.2. Page-by-page enhancement has not reached it.

## SECTION 20 — HISTORICAL PRESERVATION REQUIREMENTS

Treat docs/testing/migrations/phase4/baseline and Phase 6 reconciliation JSON/CSV as immutable accepted evidence. The baseline records 292 identities, 1,630 assertion sites, and 4,211 mappings. Do not regenerate, reformat, replace, or overwrite those files. Phase 4’s original 112-artifact preservation is documented in U00-report.md.

approved-regression-deltas.md is append-only. It carries six prior approved groups, exact replacement assertions, and the later nine-site Phase 7.4.1 reconciliation. The 10 sites/24 edges from the earlier reconciliation and the nine sites/22 references in the latest investigation are separate recorded entries. Any future historical assertion change needs identity-specific source justification, explicit approval when the contract changes, a one-to-one preservation mapping, focused evidence, and an appended record.

Keep original test IDs/titles, assertions, and original identity-to-site ownership traceable. Do not remove tests, add skips to mask defects, weaken denial/ownership checks, or count shared route attributions as separate identities. New page additions remain separate from original history. Browser/API execution evidence is retained under ignored test-results paths; do not overwrite accepted reports or logs.

## SECTION 21 — CURRENT GIT STATE

The live repository was checked before creating these handoff files:

- Branch: 219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages.
- HEAD: 30ce6951b30dc22e5c40134c319dd5be778a28ed.
- The branch’s origin tracking ref is at the same HEAD; the initial worktree was clean.
- Accepted merge b6d9b8ae4ccdac5341fcff7df2223f3bef47bb23 is in the ancestry.
- Commit 30ce695 is titled “test: fixed end-to-end regression test suites and documentation for phase 7 verification”. It contains the 11 E2E corrections, regression report, and historical ledger appendix that the previous report described as uncommitted.
- Therefore the earlier report’s HEAD ea5acbf and “uncommitted corrections” description is stale for this repository snapshot. The correction work is now committed; no prior local edits were discarded.

After these two authorized files are written, the only expected worktree changes are the two new files in docs/testing/handoffs. No application source, API source, tests, dependencies, lockfiles, schemas, or historical evidence are changed by this handoff task. No commit, push, merge, rebase, reset, or branch switch is authorized.

## SECTION 22 — IMPORTANT FILES AND DOCUMENTATION

### Historical baseline and migration

- docs/testing/migrations/phase4/baseline/U00-report.md — preservation procedure, inventory, checksums, immutable scope, and limitations.
- docs/testing/migrations/phase4/baseline/artifacts/report.md — Phase 2 original audit and accepted limitations.
- docs/testing/migrations/phase4/baseline/artifacts/inventory.md — original specification/test inventory.
- docs/testing/migrations/phase4/baseline/artifacts/assertions.md — historical assertion-site inventory.
- docs/testing/migrations/phase4/baseline/artifacts/baseline.json and preservation-map.csv — machine baseline and ownership ledger.
- docs/testing/migrations/phase4/verification.md — migration verifier behavior, evidence isolation, and source-pinned reference.
- docs/testing/migrations/phase6/preservation-reconciliation.md and preservation-reconciliation.json — identity/site/mapping reconciliation snapshot.
- docs/testing/migrations/phase6/approved-regression-deltas.md — append-only exact approved/equivalent assertion records.

### Coverage planning and Phase 7

- docs/testing/coverage/phase5/coverage-assessment.md — 18-page feature and test coverage assessment.
- docs/testing/coverage/phase5/phase6-backlog.md — NEX-001–012 scope, dependencies, and blocked/unsupported decisions.
- docs/testing/verification/phase7/phase7.1-baseline.md — ordered 23-page inventory and Phase 7.1 discovery.
- docs/testing/verification/phase7/phase7.2-page-verification.md — 23-page execution matrix and 321 offline result.
- docs/testing/verification/phase7/phase7.3-api-verification.md — 28 API modules, PGlite model, 170-leaf triage, and live-case deferral.
- docs/testing/verification/phase7/phase7.4-cross-page-verification.md — 14 workflows, 21 cases, outcomes, and Phase 7.5 prerequisites.
- docs/testing/verification/phase7/development-merge-verification.md — merge parents, conflict resolution, development changes, and historical run evidence.
- docs/testing/verification/phase7/page-by-page/page-01-login.md through page-08-services.md — authoritative per-page source, coverage, result, defect and limitation details.
- docs/testing/verification/phase7/regression-failure-investigation.md — 35-case investigation, corrections, latest counts, defects, quality-gate history, and reconciliation.

### Execution evidence

- test-results/phase7/regression-failure-investigation/final-verification-summary.txt — latest summarized discovery/focused outcomes and preservation totals.
- test-results/phase7/regression-failure-investigation/playwright-discovery-final-reconciliation.txt — final discovery output (440 cases, 58 files).
- test-results/phase7/regression-failure-investigation/full-browser-suite-results/ — last full browser run artifacts.
- test-results/phase7/regression-failure-investigation/individual/ — individual reproductions and traces.
- test-results/phase7/regression-failure-investigation/focused-f1-f2-final.log, focused-form-inputs.log, focused-client-workflows.log, and api-targeted-authorization-and-pricing.tap — focused execution evidence.
- test-results/phase7/page-by-page/ and test-results/phase7/phase7.2, phase7.3, phase7.4 — earlier page, API, and workflow records. test-results is ignored by Git; confirm local presence before relying on it in another environment.

## SECTION 23 — PAGE 9 PREPARATION

The authoritative inventory identifies Page 9 as **Client Service Requests**, route **/service-requests**. Page 9 must not begin until the user explicitly authorizes it.

The Phase 7.1 matrix assigns historical identities PW-033–PW-040, PW-287, and PW-292 to this page. Existing spec ownership is apps/web/e2e/service-requests/client-service-requests.spec.ts, shared table interactions, and the client-requests API module. Its contract is USER-only history/details scoped to the authenticated owner, with supported request states. The nine-site reconciliation updates one internal-role redirect assertion to /module while retaining hidden navigation and no-client-read checks; that correction is already committed.

When authorized, start from HEAD 30ce695 unless Git has changed, check worktree status, read this handoff and Page 9/source/API reports, then inspect current source, backend route/service/schema, Prisma relationships, validation, permission policy, existing spec ownership, and API coverage. Only then identify missing behavior. Add tests only for source-backed contracts, use deterministic browser mocks and PGlite for isolated persistence, preserve historical identity mapping, run focused verification, document exact results and defects, and stop for administrative review. Do not fix product defects under test-only authority.

## SECTION 24 — REMAINING PHASES

The immediate sequence is Pages 9–23 in the accepted inventory, one page at a time with administrative review between pages. No page may be skipped without user authorization.

After page-by-page review, the available Phase 7.4 report describes Phase 7.5 as combined-suite verification with prerequisites: a dedicated disposable database, provisioned synthetic accounts, a verified web/API lifecycle and cleanup plan, safe credential handling, and separate browser/API counts. Five opt-in live role/auth cases remain deferred there. Do not run them against an unknown or shared database.

The eight-phase roadmap ends with Phase 8 final documentation and maintenance guidance. No later Phase 7 subphase names or more detailed Phase 8 checklist were found in the tracked source set. Mark additional sequencing UNVERIFIED — REQUIRES CONFIRMATION instead of inventing it.

## SECTION 25 — NON-NEGOTIABLE RESTRICTIONS

- Do not modify application, backend, Prisma schema, fixture, or dependency source to make tests pass under a test-only task.
- Do not remove historical identities/assertions, weaken valid checks, or skip genuine defects.
- Do not describe mocked browser tests as live API/database verification.
- Do not invent HTTP contracts, input validation bounds, unsupported workflows, or product requirements.
- Do not regenerate or overwrite Phase 4 baseline artifacts, accepted Page 1–8 reports, or existing execution evidence.
- Do not run live cases or mutate a shared/production database without an explicitly verified disposable environment and user authorization.
- Do not commit, push, merge, rebase, reset, or switch branches unless separately authorized.
- Do not start Page 9, Phase 7.5, or unrelated remediation until explicitly authorized.
- Report actual execution results; label projections as projections and unresolved historical facts as unverified.

## SECTION 26 — INSTRUCTIONS FOR THE NEXT CODEX SESSION

1. Read this comprehensive handoff and applicable accepted reports before changing any file.
2. Check live branch, HEAD, upstream relation, and worktree. At this handoff snapshot HEAD is 30ce695; preserve the two handoff documents as intentional untracked documentation if present.
3. Treat Phase 4/6 baselines as immutable and use approved-regression-deltas.md only through its append-only process.
4. Do not start Page 9 until the user explicitly requests Page 9 implementation. A handoff or roadmap reference alone is not authorization.
5. Once authorized, use a source-first page audit and inspect frontend, backend/API, validation, permissions, Prisma relations, and existing regression coverage before defining tests.
6. Classify each result as MOCKED_UI_VERIFIED, ISOLATED_API_VERIFIED, LIVE_INTEGRATION_VERIFIED, SOURCE_ONLY, or NOT_VERIFIED. Keep API/PGlite results separate from Playwright counts.
7. Correct a demonstrably wrong test implementation with source evidence, but preserve real application defects and document the reason.
8. Execute focused tests only as authorized; do not rerun the entire suite merely to reconstruct old results.
9. Update the page report/evidence without overwriting accepted artifacts, verify scoped changes, then stop for administrative review.
10. Do not begin Phase 7.5, Phase 8 closeout, defect remediation, or another page without corresponding user authorization.

## SECTION 27 — FINAL CHECKPOINT

As of 2026-11-13, the active project checkpoint is Phase 7.4.1 after completion and reconciliation of Pages 1–8. Historical baseline remains 292 original identities, 1,630 assertion sites, and 4,211 ownership mappings. Page 1–8 contributed 54 browser additions and Pages 7–8 contributed seven isolated API additions. Latest discovery is 440 tests across 58 files; last complete run remains 423 passed, 12 failed, and 5 skipped. Focused F1/F2, form-inputs, client-workflow, and targeted API results are recorded separately. Ten browser application failure leaves and one API pricing failure remain; historical NEX-017, LOGIN/REG, Request Inbox, NEX-006, NEX-015, and API test-contract limits remain documented.

Current verified branch/HEAD are recorded in Section 21. The prior correction set is committed in 30ce695, not uncommitted. These handoff files are the only new worktree changes from this task. Page 9 — Client Service Requests (/service-requests) awaits explicit user authorization. The next session should read this handoff first, inspect current repository state, and wait for that authorization before implementation.

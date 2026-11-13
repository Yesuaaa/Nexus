# Phase 7.4.1 — Page 10: Request Inbox

**Route:** /request-inbox  
**Recommendation:** COMPLETE WITH ACCEPTED LIMITATIONS  
**Administrative acceptance:** Pending  
**Verification date:** 2026-11-13 (Asia/Singapore)  
**Scope:** Page 10 only; no application-source changes

## A. Page status

Recommend **COMPLETE WITH ACCEPTED LIMITATIONS** for administrative review. The route, UI, API, authorization, request lifecycle, database effects, cross-module conversation path, and regression coverage were inspected. Focused browser and isolated PGlite checks passed after correcting one fixture-isolation mistake in the new API tests.

Two visible UI operations remain unresolved: Decline and Delete call paths that are not registered by the current Request Inbox API. Current heads receive 404; the UI reports the failure and keeps the request. Existing project documentation says there is no approved successful decline/delete contract. The report records the observable mismatch without inventing a success contract or changing product code.

The browser tests use mocked API responses; API tests use isolated PGlite. No live frontend/API/database integration was run. The complete 444-case browser suite was discovered but not executed.

## B. Git baseline

- Initial branch: 219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages
- Initial HEAD: 4116b3e34c5f895e442a2a492d51fc9e35d03542
- Initial worktree: clean; no staged, unstaged, or untracked changes.
- Final branch and HEAD: unchanged.
- Final intended changes: one new browser spec, two nested API cases in the existing Request Inbox API test, and this report.
- No commit, push, fetch, pull, branch switch, merge, rebase, cherry-pick, reset, dependency change, or lockfile change was performed.

The Page 9 report's historical HEAD is earlier than this task's actual start. The observed task-start HEAD above is authoritative for this report.

## C. Source inspection

### Frontend

- apps/web/src/app/(portal)/request-inbox/page.tsx
- apps/web/src/features/request-inbox/pages/request-inbox-page.tsx
- apps/web/src/features/request-inbox/components/request-inbox-table.tsx
- apps/web/src/features/request-inbox/api/request-inbox-api.ts
- apps/web/src/features/bookings/components/booking-details-drawer.tsx
- apps/web/src/features/bookings/components/request-details-body.tsx
- apps/web/src/features/request-conversations/components/request-messages-link.tsx
- apps/web/src/features/request-conversations/api/request-conversations-api.ts
- Shared search, filter, pagination, table status, loading, and side-panel components.
- apps/web/src/features/auth/model/permissions.ts
- apps/web/src/features/workspaces/model/route-policy.ts

### Backend, authorization, and workflow

- apps/api/src/app.ts
- apps/api/src/features/request-inbox/request-inbox.controller.ts
- apps/api/src/features/request-inbox/request-inbox.schema.ts
- apps/api/src/features/request-inbox/request-inbox.service.ts
- apps/api/src/features/auth/auth.middleware.ts
- apps/api/src/shared/query/accounts.ts
- apps/api/src/shared/query-helpers.ts
- apps/api/src/shared/query/pagination.ts
- apps/api/src/shared/validation.ts
- apps/api/src/features/request-workflow/workflow.access.ts
- apps/api/src/features/request-conversations/request-conversations.controller.ts and service

### Database and existing verification

- apps/api/prisma/schema.prisma
- apps/api/tests/request-inbox.test.ts
- apps/api/tests/features/request-inbox/request-inbox-visibility.test.ts
- apps/api/tests/support/pglite-app.ts
- apps/web/e2e/request-inbox/request-inbox.spec.ts
- apps/web/e2e/shared/operational-loading.spec.ts
- apps/web/e2e/shared/table-interactions.spec.ts
- apps/web/e2e/messages/request-conversations.spec.ts
- docs/features/department-request-inbox.md
- Phase 7.1–7.4 reports, the Page 9 report, regression handoffs, failure investigation, and approved Phase 6 regression deltas.

The authoritative page inventory and handoff identify Page 10 as Request Inbox at /request-inbox.

## D. Complete functionality inventory

- A current-department request list with ten records per page, total count, oldest-first default sort, stable ID tie-breaking, and server-side pagination.
- Search with immediate local preview while the server-backed query refreshes.
- Status view selection for all statuses, awaiting acceptance, under review, awaiting client information, ready for quotation, closed, and cancelled.
- Sort controls for service, reference, client, status, and request date, each ascending or descending.
- Responsive request rows showing service, reference (or record ID fallback), client name, client email, status, and request date.
- Detail side panel with service/status, client name/email/contact, reference, package, requested and updated dates, expected timeline, preferred specialist, project goals, requirements, additional details, an availability note, and an eligible request-workspace link.
- Loading skeleton, initial error with retry, detail-load error with retry, empty result, no-match result, live pagination summary, and page controls.
- Periodic, focus, visibility, and reconnect refresh through the shared paginated-list hook. Background network/5xx failures retain loaded rows.
- Accept or Start conversation for SUBMITTED requests and unaccepted legacy UNDER_REVIEW requests.
- A decline confirmation for those same unaccepted statuses.
- A Delete confirmation on each list row, without a status-specific visibility condition.
- Per-row chat action. For a request accepted by this department it loads the request conversation and routes to /messages?request=<id>; otherwise it announces that this department must accept first. Conversation access errors are announced.
- Successful acceptance creates the consultation workflow and private request conversation. It does not approve a quote, assign a specialist, create a project, or confirm price/date/specialist availability.

The list does not display contact number, package, or request title. The details response does not expose a full audit log or attachments. Page 10 has no request-body editing, assignment form, date filter, priority field, status-edit form, or decline-reason field. Workflow attachments exist elsewhere in the data model but are not surfaced by this page.

## E. Interactive control inventory

| Control                                        | Visibility and behavior                                                                  | Result / failure behavior                                                                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Search requests                                | Always visible; maxLength 100; arbitrary text; query is trimmed; typing resets to page 1 | Local preview followed by GET list; Clear search appears while the raw input is non-empty                                                  |
| Filter requests                                | Always visible; fixed seven view values                                                  | Updates view and resets page 1; invalid API value returns 400                                                                              |
| Clear search                                   | Visible when search input has a non-empty raw value                                      | Clears search and resets page 1                                                                                                            |
| Five sort buttons                              | Table headers: service, reference, client, status, date requested                        | Toggle ascending/descending for the chosen column and reset page 1                                                                         |
| Numbered pagination                            | Visible only when total is greater than zero                                             | Changes server page; footer announces the shown range                                                                                      |
| Review request {id}                            | One per row                                                                              | Opens the booking details side panel; loading/error/retry are handled                                                                      |
| Go to chat for request {id}                    | One per row                                                                              | Unaccepted or other-department request shows an error notification; accepted current-department request loads conversation then navigates  |
| Delete request {id}                            | One per row                                                                              | Opens permanent-delete confirmation; Cancel closes it; confirmation calls DELETE; failure is announced and row remains                     |
| Side-panel close button, Escape, outside click | Detail panel open; all close paths blocked while acceptance or confirmation is busy      | Restores focus to the opener or page heading                                                                                               |
| Accept request / Start conversation            | Details loaded; status SUBMITTED or unaccepted UNDER_REVIEW                              | POST accept; pending state disables action and close; success refreshes list/details; conflict/access failure refreshes stale data         |
| Decline request                                | Details loaded; status SUBMITTED or unaccepted UNDER_REVIEW                              | Opens confirmation; no reason input; confirmation calls POST decline; failure is announced                                                 |
| Open request workspace link                    | Only when acceptedDepartmentId matches the signed-in current head                        | Navigates to the request conversation in Messages                                                                                          |
| Try again                                      | Visible on initial list/details load failure                                             | Repeats the failed GET                                                                                                                     |
| Confirmation Cancel / confirm                  | Decline or Delete dialog                                                                 | Cancel closes without request; confirm is disabled while pending; network failures leave a retry path, while 403/404/409 close and refresh |

The shared portal navigation link is shown only when the cached account is STAFF with headOf information. The 390px layout exposes the shared navigation-menu open/close controls. No other Page 10 action menu, tab, or custom clickable row control was found.

## F. Input validation audit

| Input                   | Frontend                                                                                                  | Backend / data rule                                                                                                           | Coverage and limits                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Search                  | Optional string, empty default, maxLength 100, trimmed before request and preview; no character allowlist | Scalar string only; shared parser trims; maximum 100 characters after trimming; case-insensitive matching                     | Existing API tests cover a 101-character value and repeated search values returning 400, plus reference/package searches; no minimum length |
| Status view             | Fixed select options; default pending                                                                     | Exact values: pending, under-review, all, awaiting-information, ready-for-quotation, closed, cancelled; default pending       | All six status views and sorting are exercised in PGlite                                                                                    |
| Sort column/direction   | Fixed five columns; direction toggles                                                                     | sortBy is createdAt/reference/service/client/status; sortDir asc/desc; defaults createdAt/asc                                 | All supported columns and stable pagination are covered in API tests                                                                        |
| Page                    | Numbered control; changes page                                                                            | Absent defaults to 1; only plain decimal integer 1–100000 is accepted; page size 10                                           | Existing API tests reject 0, 100001, and decimal values                                                                                     |
| Request ID              | No editable ID field                                                                                      | Registered detail/accept routes require 1–80 URL-safe characters; malformed IDs return 400                                    | Existing API test covers malformed ID                                                                                                       |
| Accept, decline, delete | No editable request body, assignment, status, or note field                                               | Accept controller ignores the body and uses server-side current-head state; decline/delete have no registered route or schema | Existing acceptance test sends forged status/client/department fields; no successful decline/delete contract exists                         |

Whitespace-only search becomes an empty search on both client and server. Unicode is not restricted by source. There are no title, date, department, or priority filters. The client preview also compares request title, while the server search fields do not include title; the placeholder does not promise title search. This is a source-only preview/server breadth difference, not a confirmed contract defect.

## G. API contract matrix

| Operation                           | Registered contract                                                           | Authorization and validation                                                                                                           | Response / persistence                                                                                                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/request-inbox              | List scoped requests with search, page, view, sortBy, sortDir                 | Authenticated current active, undeleted STAFF department head; malformed filters 400                                                   | 200 with department, safe request projection, total, page, pageSize; repeatable-read pagination                                                                                    |
| GET /api/request-inbox/:id          | Detail projection including submitted goals, requirements, additional details | Same head rule; malformed ID 400; unknown or out-of-scope request 404                                                                  | 200; response omits submissionKey and quotedPrice                                                                                                                                  |
| POST /api/request-inbox/:id/accept  | Accept an eligible request; request body not used                             | Same head rule; malformed ID 400; outside route 404; stale/accepted/invalid status 409                                                 | Transaction conditionally updates status and accepted metadata, upserts client/department conversation, links it, initializes workflow/event/notification, returns safe projection |
| POST /api/request-inbox/:id/decline | No route registered                                                           | Router authentication/current-head middleware runs before route match; unauthenticated 401, non-head/other roles 403, current head 404 | No supported transition, schema, response, or persistence effect                                                                                                                   |
| DELETE /api/request-inbox/:id       | No route registered                                                           | Same middleware result as above                                                                                                        | Current head receives 404; no supported delete semantics or persistence effect                                                                                                     |

The router registers GET list, GET detail, and POST accept only. It is mounted under /api/request-inbox. The PGlite tests independently observed 401/403/404 for unsupported decline/delete requests and verified that records and related workflow state remained unchanged.

Acceptance is conditional and transactional: the update rechecks current head and service routing, sets UNDER_REVIEW plus accepted department/by/time, reuses or creates the unique client/department conversation, links the request, and initializes workflow. A competing acceptance cannot win a second time. No price approval or project assignment is performed.

## H. Authorization matrix

| Actor                                                      | UI route/navigation                                                                   | Request Inbox API                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Unauthenticated                                            | Redirects through authentication                                                      | 401                                                                                       |
| USER                                                       | Redirected to /dashboard; link hidden                                                 | 403                                                                                       |
| STAFF without current head status                          | Redirected to /module; link hidden                                                    | 403                                                                                       |
| Active, undeleted STAFF who currently heads a department   | Allowed; Request Inbox link shown                                                     | Allowed within current department/request scope                                           |
| ADMIN                                                      | Redirected to /module; link hidden                                                    | 403; no administrator override                                                            |
| SUPERADMIN                                                 | Redirected to /module; link hidden                                                    | 403; no superadmin override                                                               |
| Current head of another linked department after acceptance | UI may retain cached old account view until refreshed, but no accepted request access | Detail/list privacy enforced; other head receives 404 for the accepted request            |
| Deactivated/deleted or replaced former head                | Cached UI metadata is not the security boundary                                       | Server checks active STAFF and current Department.headId on every request; access revoked |

The browser suite covers role/head route denials. PGlite covers the role matrix, account status/head handoffs, and department isolation. The UI guard uses role plus account.headOf; the API independently verifies current database assignment.

## I. Request lifecycle matrix

| Current request state                                        | Inbox behavior                                                       | Supported transition                                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| SUBMITTED, no accepted department                            | Pending view; details show Accept and Decline                        | Accept → UNDER_REVIEW; decline has no backend route                                            |
| UNDER_REVIEW, no accepted department (legacy)                | Under review view; details show Start conversation and Decline       | Start conversation/accept → UNDER_REVIEW with accepting metadata; decline has no backend route |
| UNDER_REVIEW accepted by current department                  | Visible to the accepting department; workspace link/chat available   | No Page 10 status mutation                                                                     |
| UNDER_REVIEW accepted by another department                  | Other linked department loses access; accepting head retains request | Competing acceptance → 409; wrong department detail → 404                                      |
| AWAITING_CLIENT_INFO, READY_FOR_QUOTATION, CLOSED, CANCELLED | Corresponding filter/status pill; no Accept or Decline detail action | No direct Page 10 transition                                                                   |

Database enum labels are SUBMITTED, UNDER_REVIEW, AWAITING_CLIENT_INFO, READY_FOR_QUOTATION, CLOSED, CANCELLED. There is no DECLINED enum value. The API list handles deployed enum-label differences by checking current PostgreSQL enum labels. Acceptance creates workflow state CONSULTATION (or respects existing workflow) and a CONSULTATION_OPENED event; it is not a quotation approval.

## J. Existing regression coverage before Page 10 changes

- Direct Request Inbox browser spec: 14 cases discovered and passed before edits. It covers refresh/status views, sort, pagination, chat feedback/navigation, delete failure/cancel/retry at desktop and mobile, acceptance/details at desktop and mobile, accept retry/conflict, and role/head route denials.
- Historical Page 10 identities: PW-096, PW-099, PW-168–169, PW-205–218, PW-286, PW-291. Source owners are unchanged.
- Shared Request Inbox browser checks: two operational-loading cases and two search-preview cases at 1440px/390px.
- Messages compatibility: acceptance opens the request conversation at 1440px/390px.
- Isolated API baseline: 12 unique leaf cases in the selected inbox and visibility files (8 inbox, 3 shared-request visibility, 1 co-located workload case); TAP printed 14 test rows including the two parent suites.
- Existing tests already cover status mapping, sorting, pagination, safe response fields, malformed filters, role/head access, handoffs, deactivation/deletion, cross-department privacy, acceptance conflicts/concurrency, and client-visible status.

## K. Coverage gap analysis

### Addressed in this task

- Added a browser failure-path test for the visible decline confirmation and error feedback.
- Added direct PGlite checks for current unsupported decline and delete paths, each across authentication/role gates and persisted-state preservation.
- Kept the historical inbox browser spec unchanged and placed the new browser test in an isolated file.
- Captured discovery identity comparison and final focused execution logs.

### Remaining limitations

- Decline/delete success semantics remain unapproved, so successful behavior is intentionally untested and not mocked.
- No live browser/API/database flow was authorized or executed; browser mutation behavior remains mocked, while API 404 and persistence behavior is isolated PGlite.
- The full browser suite was discovered but not run; only the 21 relevant focused browser cases were executed.
- No exhaustive keyboard traversal, screen-reader audit, automated accessibility scanner, or network-disconnection matrix was run. Accessible names, confirmation dialogs, live error feedback, responsive layouts, and existing busy/Escape behavior were source-checked or covered selectively.
- The title-only quick-preview behavior is broader than server matching; the visible search hint does not promise title matching, so no defect is asserted.
- The legacy preservation verifier is blocked by a pre-existing PW-149 title mismatch before its complete assertion reconciliation can run. Details are in section R.

## L. New browser tests

Added one case in apps/web/e2e/request-inbox/request-inbox-contract-recovery.spec.ts:

- decline failure is announced and preserves the request
- Opens request details and the decline confirmation using accessible role/name locators.
- Confirms the UI sends POST /api/request-inbox/booking-1/decline.
- Uses a mocked 404 (the observed current API response is separately verified with PGlite).
- Asserts the polite Sileo live region announces “Couldn't decline request,” does not announce “Request declined,” closes the stale 404 confirmation, and retains the request row/status.
- New case has no skip, artificial delay, force click, or successful API mock.

The pre-existing apps/web/e2e/request-inbox/request-inbox.spec.ts was not changed.

## M. New API tests

Added two isolated nested cases in apps/api/tests/request-inbox.test.ts:

1. decline route is unsupported and preserves the request for every actor
2. delete route is unsupported and preserves the request for every actor

Each creates an isolated request, checks unauthenticated 401, USER/ordinary STAFF/ADMIN/SUPERADMIN 403, current head 404, then verifies status, acceptedDepartmentId, acceptedById, acceptedAt, conversationId, and RequestWorkflow remain unchanged. The fixture is deleted in a finally block. No API business code or schema changed.

## N. Execution results

Evidence directory: test-results/phase7/page-by-page/page-10-request-inbox/

| Command / selection                                                        | Result                                                                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Baseline Playwright discovery                                              | 443 tests / 59 files                                                                                   |
| Baseline direct inbox discovery and run                                    | 14 discovered; 14 passed                                                                               |
| Baseline shared and conversation checks                                    | 4 + 2 passed                                                                                           |
| Baseline PGlite selection                                                  | 12 unique leaves passed; 14 TAP rows including parent suites                                           |
| Final Request Inbox browser spec plus new recovery spec                    | 15 passed, 0 failed, 0 skipped; exit 0                                                                 |
| Final shared loading/table search and conversation compatibility selection | 6 passed, 0 failed, 0 skipped; exit 0                                                                  |
| Final PGlite selection                                                     | 14 unique leaf cases passed, 0 failed, 0 skipped; Node TAP reports 16 rows including two parent suites |
| Final Playwright discovery                                                 | 444 tests / 60 files                                                                                   |
| Baseline-to-final discovered identity comparison                           | 443 prior leaves, 444 final leaves; 0 missing and 1 new                                                |
| Full 444-case browser run                                                  | Not run                                                                                                |
| Full repository test runner / web unit suite                               | Not run; outside the focused Page 10 selection                                                         |

### Required quality gates

| Command        | Result       | Evidence                              |
| -------------- | ------------ | ------------------------------------- |
| pnpm format    | PASS, exit 0 | quality-format-page10-final-v2.log    |
| pnpm lint      | PASS, exit 0 | quality-lint-page10-final-v2.log      |
| pnpm typecheck | PASS, exit 0 | quality-typecheck-page10-final-v2.log |

Focused evidence: baseline-browser-discovery.log, baseline-browser-inbox.log, baseline-browser-shared.log, baseline-browser-messages.log, baseline-api.tap.txt, focused-browser-after-final-format.log, focused-compatibility.log, focused-api-after-final-format.tap.txt, final-playwright-discovery-after-format.log, identity-diff-after-format.txt, and legacy-preservation-final.log. Initial test-fixture failure details are in initial-api-fixture-failure.md.

The initial default-sandbox attempts hit process-launch restrictions (pnpm store lock access and Node worker spawn EPERM). Approved local-process reruns succeeded. The first API run also exposed a new-test data leak: its two fixtures inflated a later expected inbox total from 2 to 4. The test helper was corrected with finally cleanup; the final API run passed. A short failure investigation note is saved beside the final logs.

## O. Defect register

| ID      | Title / classification                                                                       | Severity and status                                | Preconditions, reproduction, expected and actual                                                                                                                                                                                                                                                                                      | Root cause / evidence / verification                                                                                                                                                                                                                                                         |
| ------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P10-001 | Decline action calls an unregistered endpoint; UNRESOLVED_CONTRACT / potential UI-API defect | Medium user impact; open pending contract decision | Current active STAFF head opens SUBMITTED or unaccepted UNDER_REVIEW details, selects Decline request and confirms. UI text promises the booking will be marked declined. Actual: POST /api/request-inbox/:id/decline returns 404; error toast is shown; request remains unchanged. A successful decline expectation is not approved. | Frontend API client/page call the route; request-inbox.controller.ts registers no decline route; Prisma enum has no DECLINED state. Confirmed by isolated PGlite and mocked browser failure-path test. No persistence change; MOCKED_UI_VERIFIED + ISOLATED_API_VERIFIED + SOURCE_ONLY.      |
| P10-002 | Delete action calls an unregistered endpoint; UNRESOLVED_CONTRACT / potential UI-API defect  | Medium user impact; open pending contract decision | Current head selects Delete request on a row and confirms. UI says it permanently removes the request. Actual: DELETE /api/request-inbox/:id returns 404; error feedback is shown and the request remains. A successful deletion expectation is not approved.                                                                         | Delete API client and confirmation are present, but request-inbox.controller.ts registers no delete route. Confirmed through isolated PGlite and existing mocked desktop/mobile delete failure/retry tests. No persistence change; MOCKED_UI_VERIFIED + ISOLATED_API_VERIFIED + SOURCE_ONLY. |

Severity is provisional because the user-facing controls are real but the intended business contract is unresolved. Neither item is marked resolved or treated as expected successful behavior.

No other confirmed Page 10 application defect was established. The local-preview/server search difference is recorded as source-only and not classified as a defect because title search is not promised by the visible hint or accepted API contract.

## P. Historical Request Inbox finding reconciliation

The decline/delete discrepancy remains open and is independently reconfirmed. Frontend calls still exist; current backend routes do not. The router applies authentication and current-head checks before route matching, so missing-auth and non-head actors are denied before the current head receives 404. Existing handoff and Phase 7 reports explicitly say successful decline/delete has no agreed contract.

No 2xx mock, invented status, reason field, or deletion behavior was introduced. The API failure tests characterize current routing and data preservation only. This does not mark the historical finding resolved.

## Q. Integration and verification limits

- MOCKED_UI_VERIFIED: all 21 focused browser cases used mocked API responses; the new decline case verifies the UI's error path.
- ISOLATED_API_VERIFIED: selected API/PGlite tests exercised actual routing, auth, department scope, acceptance transaction, unsupported routes, and persisted-state preservation without a shared or production database.
- SOURCE_ONLY: details not separately executed include exact accessible control inventory, query trim/maximum rules, schema relationships, route registration, and workflow event/notification creation.
- LIVE_INTEGRATION_VERIFIED: none.
- NOT_VERIFIED: full browser suite, full web unit suite, production/shared database behavior, real browser/API integration, and exhaustive accessibility/network interruption behavior.

The local Next server used only for Playwright remained an isolated local runner. API operations in browser tests were intercepted by Playwright.

## R. Historical preservation

- Immutable Phase 4 baseline and Page 1–9 accepted source/tests were not modified.
- The original Page 10 browser spec remains byte-for-byte unchanged.
- Initial-to-final current discovery comparison: 443 identities to 444; zero removed and exactly one added in the new Page 10 spec.
- Existing authoritative preservation records retain 292 historical identities, 1,630 assertion sites, and 4,211 ownership mappings. The Page 1–9 accepted additions remain the documented 57 browser cases and 8 API cases.
- A final legacy verifier attempt is recorded in test-results/phase7/page-by-page/page-10-request-inbox/legacy-preservation-final.log. It exits at the documented PW-149 identity/title mismatch (“duplicate email registration displays inline server error alert”) before completing global assertion reconciliation. The Page 9 report also records approved redirect deltas for PW-001 and PW-037; this run did not reach those checks.
- Therefore discovery shows no current test identity removed, and accepted reconciliation records remain unchanged, but a clean independent 292-identity / 1,630-site global verifier pass was not established in this task.
- No new skip was introduced. Focused selections report zero skips. The full suite's skip inventory was not rerun.
- The older handoff inventory still marks Page 9 “Not started,” while the current user task states Pages 1–9 were accepted. This report follows the current task instruction and leaves the stale handoff unchanged.

## S. Files changed

Tracked files:

- apps/api/tests/request-inbox.test.ts — two new PGlite cases and isolated cleanup.
- apps/web/e2e/request-inbox/request-inbox-contract-recovery.spec.ts — one new mocked browser failure-path case.
- docs/testing/verification/phase7/page-by-page/page-10-request-inbox.md — this report.

Generated, ignored evidence is stored under test-results/phase7/page-by-page/page-10-request-inbox/. No product source, Prisma schema, migration, dependency, lockfile, Page 1–9 test, or immutable baseline artifact changed.

## T. Final recommendation

Page 10 is ready for administrative review as **COMPLETE WITH ACCEPTED LIMITATIONS**. The supported head-scoped listing, detail, acceptance, conversation handoff, filtering, sorting, pagination, errors, and cross-department protections have source-backed coverage and focused passing tests. The decline/delete controls remain unresolved UI/API contract findings. The live-integration boundary and preservation-verifier mismatch remain explicit. Administrative acceptance is pending; no Page 11, Phase 7.5, commit, or push was started.

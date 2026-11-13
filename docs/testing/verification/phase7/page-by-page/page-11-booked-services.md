# Page 11 — Booked Services (`/booked-services`)

**Phase:** 7.4.1  
**Recommendation:** **COMPLETE WITH VERIFIED DEFECTS** — ready for administrative review; not administratively accepted.  
**Scope:** Regression audit and tests only. No frontend/API business logic, schema, or migrations were changed.

## A. Page status

The handoff inventory identifies Page 11 as Booked Services at `/booked-services`. The route is client-facing and access is limited to `USER`. The page lists the authenticated client's service requests, supports search/status filters and pagination, and opens a read-only details drawer. It has a service-catalog link, refresh/retry behavior, and a request-workspace link.

Two API contract defects were reproduced with isolated PGlite tests: both Booked Services projections omit the stored request reference number, and the request-workspace API returns 404 for an unaccepted request even though the messaging documentation and mocked client UI describe a waiting state. Neither product defect was changed here.

## B. Git baseline

| Measure  | Start                                                                                              | End                                                                                                  |
| -------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Branch   | `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages` | Same                                                                                                 |
| HEAD     | `d9a3d7a52deab1390174df67abc84bdaf50f0c71`                                                         | Same                                                                                                 |
| Worktree | Clean                                                                                              | Only the two new test files and this report are untracked; evidence is ignored under `test-results/` |

No branch or history operation was performed. No commit or push was made.

## C. Source inspection

### Frontend

- `apps/web/src/app/(portal)/booked-services/page.tsx` — parses the optional `booking` deep link; only a single string up to 200 characters is used.
- `apps/web/src/features/workspaces/model/route-policy.ts` and `apps/web/src/features/auth/model/permissions.ts` — route policy delegates to USER-only `canAccessBookedServices`.
- `apps/web/src/components/layout/portal-layout.tsx` — waits for the account, hides denied page content, and routes internal accounts to `/module` (USER denial goes to `/dashboard`).
- `apps/web/src/features/bookings/pages/booked-services-page.tsx` — query state, filters, pagination, refresh, details selection, and empty/error states.
- `apps/web/src/features/bookings/components/booked-services-table.tsx` — responsive table, status pills, date formatting, and one details action per row.
- `apps/web/src/features/bookings/components/booking-details-drawer.tsx` and `request-details-body.tsx` — read-only details, retry/close behavior, and request-workspace link.
- `apps/web/src/features/bookings/api/bookings-api.ts` — Booked Services request/response types and same-origin calls.
- `apps/web/src/features/bookings/model/booking-status.ts` — six status labels and pill tones.
- Shared components: `apps/web/src/components/ui/use-paginated-list.ts`, `table-pagination-footer.tsx`, `numbered-pagination.tsx`, `search-field.tsx`, and `filter-select.tsx`.
- Session transport: `apps/web/src/features/auth/api/auth-api.ts` adds a Bearer token from `sessionStorage` and handles an expired session/refresh failure.

### Backend and database

- `apps/api/src/app.ts` mounts the router at `/api/service-requests`.
- `apps/api/src/features/service-requests/service-requests.controller.ts` applies `requireAuth` and `requireRole(Role.USER)` to this router.
- `apps/api/src/features/service-requests/service-requests.schema.ts` validates list filters and service-request submission input.
- `apps/api/src/features/service-requests/service-requests.service.ts` owns the `bookingSelect`, owner-scoped list/detail reads, and the adjacent request-submission transaction.
- `apps/api/src/features/client-services/client-services.repository.ts` supplies shared search across reference, title, ID, package, and service name.
- `apps/api/src/shared/query/pagination.ts` defines page bounds, page size, and repeatable-read pagination.
- `apps/api/src/features/request-inbox/request-inbox.service.ts` accepts eligible requests and creates/links the conversation and workflow transactionally.
- `apps/api/src/features/request-conversations/request-conversations.controller.ts` and `request-conversations.service.ts` enforce participant visibility for messages and resolve accepted conversations by conversation or booking ID.
- `apps/api/prisma/schema.prisma` defines `ServiceRequest`, `RequestConversation`, and `Project` relationships.

## D. Complete feature inventory

| Area                     | Implemented behavior                                                                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Directory                | Shows the current USER's requests in a responsive table: service name, booking ID, package name (or “Standard service”), status, requested date, expected timeline, and details action. Dates use the user's date preferences.                                           |
| Search                   | Sends a trimmed query to the server. The visible hint says “Search service, package or reference…”. The server search also supports request ID. The local pending-result preview matches title, reference, service, and package.                                         |
| Status filter            | Offers All Statuses plus all six current request statuses. Search and status are server query parameters.                                                                                                                                                                |
| Pagination               | Server page size is 10; the footer announces the visible range and exposes numbered, previous, and next page controls. Changing search/status resets to page one.                                                                                                        |
| Refresh/state            | Manual Refresh and focus/visibility/reconnect refresh are implemented; this page does not poll. A list refresh also increments the open drawer's detail refresh key. Background 5xx/network refresh failures keep the accepted rows visible.                             |
| Details                  | A side panel loads the selected record and shows service name/status, request reference fallback, package, requested/updated dates, expected timeline, preferred specialist, project goals, requirements, and additional details. Empty text fields show “Not provided”. |
| Related navigation       | Browse Services links to `/services`. Details show “Open request workspace”, linking to `/messages?request=<bookingId>`; this is enabled by the drawer's default `showMessagesLink=true`.                                                                                |
| Responsive/accessibility | The table collapses to a two-column mobile layout; controls have accessible names, the table exposes a busy state, loading uses a status role, and the drawer is a dialog with close/Escape handling and focus restoration.                                              |
| Unsupported on this page | No sort controls, date filter, edit, cancel, reschedule, package/specialist change, completion confirmation, document/billing link, project link, status mutation, or delete action is rendered.                                                                         |

The table header is “Service / Reference”, but its secondary row value is `booking.id`. The details view uses `referenceNumber || id`; the backend projection omits `referenceNumber`, so it also falls back to the ID in the actual API flow (finding BOOK-001).

The Prisma model stores pricing, acceptance, conversation, and project relationships, but these are not all projected into this page. The drawer displays the _preferred_ specialist snapshot, not a confirmed assignment. There is no client name because the page is already scoped to the client.

## E. Interactive control inventory

| Control                     | Visibility / enabled state                                                                          | Handler and outcome                                                                                                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Refresh button              | Always shown; disabled while list is loading                                                        | Calls the list retry/reload path for the current search, status, and page.                                                                                                                               |
| Browse Services link        | Always shown                                                                                        | Navigates to `/services`; it is not a booking mutation.                                                                                                                                                  |
| Search field                | Always shown; accessible name “Search booked services”; `maxLength=100`                             | Trims the input, resets page to one, and reloads the list. Whitespace-only input becomes an empty query.                                                                                                 |
| Status combobox             | Always shown; accessible name “Filter bookings by status”                                           | Selects one status or All Statuses, resets page to one, and reloads.                                                                                                                                     |
| Clear filters button        | Shown when search or status is active                                                               | Clears both values and resets page to one.                                                                                                                                                               |
| Pagination                  | Shown only when the settled response has rows; disabled during load or when a page boundary applies | Changes the server page. Page range is announced through a polite live status.                                                                                                                           |
| View booking button         | One per row; accessible name `View booking <id>`                                                    | Selects that booking and loads its detail endpoint in the drawer.                                                                                                                                        |
| Drawer close / Escape       | Shown while details are selected; close paths honor `closeDisabled` (not set by this page)          | Closes the drawer and returns focus to the row opener when present, otherwise the page heading.                                                                                                          |
| Try again in list error     | Shown after a list error                                                                            | Retries the current list query.                                                                                                                                                                          |
| Try again in drawer error   | Shown after a detail error                                                                          | Retries the selected booking detail request.                                                                                                                                                             |
| Open request workspace link | Shown in all details, regardless of request status                                                  | Navigates to `/messages?request=<bookingId>`. Accepted requests can resolve to their linked conversation. Unaccepted requests currently receive API 404 despite the documented waiting state (BOOK-002). |

No per-row action menu or other mutation control is present. The portal's mobile navigation is shared shell behavior rather than a Booked Services action.

## F. Validation audit

| Input                   | Frontend                                                                           | Backend                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search                  | Search input is capped at 100 characters; the page trims before sending.           | `parseQueryString` accepts a scalar string and trims it; values over 100 characters or repeated parameters are invalid (400). Search is case-insensitive. |
| Status                  | Select-only values come from the six `ServiceRequestStatus` labels plus empty/all. | Exact enum value or empty is accepted; invalid/repeated values return 400.                                                                                |
| Page                    | Controlled by numbered pagination.                                                 | Plain decimal integer from 1 to 100,000; absent means 1. Zero, decimals, nonnumeric, and values over 100,000 are invalid (400). Page size is 10.          |
| Deep-link ID            | Next route accepts one `booking` query string of at most 200 characters.           | Detail route accepts only 1–80 ASCII letters, digits, `_`, or `-`; malformed ID returns 400. Unknown and foreign IDs return 404.                          |
| Editable booking fields | None on Booked Services; no edit/cancel form validation applies.                   | No PATCH/DELETE booking route is registered under `/api/service-requests`.                                                                                |

The adjacent `POST /api/service-requests` is the Services submission path, not a Booked Services page control. It trims input; requires a valid service ID, UUIDv4 submission key, goals (max 2,000), requirements (max 5,000), and expected timeline (max 300); optional additional details are capped at 5,000. Optional package/specialist selections are validated against active eligible records. These constraints were inspected but not retested as Page 11 form behavior.

## G. API contract matrix

| Method / route                                              | Auth and validation                                                                                            | Response / persistence                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/service-requests`                                 | Bearer session; USER only. Accepts `page`, `search`, and `status`; invalid filters return 400.                 | 200 `{ serviceRequests, total, page, pageSize }`. Owner-scoped, stable `createdAt desc, id asc` ordering, page size 10, and repeatable-read row/count snapshot. Projection includes ID/title/status/package/timeline/preferred specialist/timestamps/service ID and name, but currently omits `referenceNumber`. |
| `GET /api/service-requests/:id`                             | Bearer session; USER only. Invalid URL-safe record ID returns 400.                                             | 200 `{ serviceRequest }` when ID belongs to authenticated user; unknown and foreign booking both return 404. Returns the booking projection plus goals, requirements, and additional details. Its shared projection also omits `referenceNumber`.                                                                |
| `POST /api/service-requests` (adjacent Services submission) | Bearer session; USER only; submission schema above.                                                            | 201 receipt with ID/reference/status/createdAt. Service/package/specialist eligibility is rechecked in a repeatable-read transaction; stale choices and conflicting idempotency replay return 409. This route is not called by this page.                                                                        |
| `GET /api/request-conversations/:id` (linked Messages API)  | Authenticated participant; current client owner or eligible current department head after conversation exists. | Accepted booking IDs resolve to the participant's conversation. For an unaccepted owned booking, actual response is 404 because acceptance creates/links the conversation; the messaging document instead promises an empty waiting state. This discrepancy is preserved as BOOK-002.                            |

List/database failures flow through the shared Express error handler and the page's retry/error UI. PGlite exercised authentication, role denial, owner filtering, pagination, validation, and missing/foreign detail behavior. Database-failure injection was not added.

## H. Authorization matrix

| Operation                                     | SUPERADMIN                                  | ADMIN                          | STAFF                                                      | USER                                                                |
| --------------------------------------------- | ------------------------------------------- | ------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| Open `/booked-services`                       | Denied; route policy redirects to `/module` | Denied; redirects to `/module` | Denied; redirects to `/module`                             | Allowed                                                             |
| List / view booked-service API                | 403                                         | 403                            | 403                                                        | Allowed for authenticated owner's records                           |
| List another client's records                 | 403 at role middleware                      | 403                            | 403                                                        | Other owner's records are excluded by `clientId` from auth identity |
| View another client's booking ID              | 403 at role middleware                      | 403                            | 403                                                        | 404; same response as missing record                                |
| Open accepted request conversation            | No participant access by role alone; 404    | Same                           | Only current active STAFF department head is a participant | Owning client is a participant                                      |
| Modify/cancel from Booked Services            | Not available                               | Not available                  | Not available                                              | Not available                                                       |
| Access related documents from Booked Services | No page link/action                         | No page link/action            | No page link/action                                        | No page link/action                                                 |

Frontend route denial is independently backed by the API role middleware. The existing PW-030 assertion still verifies the `/module` landing, hidden protected content, and no list/detail API read. The new PGlite case verified unauthenticated 401 and STAFF/ADMIN/SUPERADMIN 403 on list and detail; it also verified cross-client list isolation and 404 on cross-client detail access.

Conversation access is a separate participant-based API. Other clients and unrelated internal accounts are not granted access by knowing a booking ID. The new test specifically verified the documented pre-acceptance contract and found the 404 discrepancy.

## I. Booking lifecycle

The Prisma `ServiceRequestStatus` enum has exactly: `SUBMITTED`, `UNDER_REVIEW`, `AWAITING_CLIENT_INFO`, `READY_FOR_QUOTATION`, `CLOSED`, and `CANCELLED`. The table and drawer render all six status labels; Booked Services itself performs no transition.

| State / event                                  | Source-backed lifecycle behavior                                                                                                                                                                                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial `SUBMITTED`                            | `submitServiceRequest` creates the request with this status.                                                                                                                                                                                                            |
| `UNDER_REVIEW`                                 | A current eligible department head accepts a routed, unaccepted request. The transaction conditionally changes status, writes accepting department/account/time, upserts and links the conversation, and initializes workflow. A repeated/stale acceptance returns 409. |
| `AWAITING_CLIENT_INFO` / `READY_FOR_QUOTATION` | Actual enum values included in filter/status handling. No transition control exists in Booked Services; no transition was asserted by Page 11 tests.                                                                                                                    |
| `CLOSED`                                       | Workflow code closes a request when a client declines a quotation. Closed requests are considered archived for service-conversation history.                                                                                                                            |
| `CANCELLED`                                    | An approved project cancellation updates a linked request; cancelled requests are also archived for service-conversation history.                                                                                                                                       |

The UI is read-only, so it cannot issue an invalid or repeated booking transition. Workflow and cancellation prerequisites/actors belong to Request Inbox, Messages, and Project workflows; they are not represented as Booked Services actions. This report does not claim those other lifecycle paths were exhaustively verified here.

## J. Existing regression coverage

Pre-change discovery was **444 tests / 60 spec files**. The existing Booked Services spec contained nine direct test leaves, retained unchanged:

1. `booking row status refreshes manually and after reconnection without polling`
2. `clients browse, paginate and filter booked services at 1440px`
3. `clients inspect booking details and return focus at 1440px`
4. `clients browse, paginate and filter booked services at 390px`
5. `clients inspect booking details and return focus at 390px`
6. `a booking deep link opens details and closes back to the page`
7. `clients retry unavailable lists and booking details`
8. `client list and detail requests display loading states`
9. `internal roles cannot open client bookings or fetch their data`

These browser tests mock `/api/**`; they verify the UI contract, not persistence. Existing shared coverage adds `/booked-services previews and clears search before responses` at desktop and mobile. The Messages spec's acceptance-to-two-way-conversation flow at desktop/mobile opens Booked Services details as USER; its waiting-state UI response is mocked. `apps/api/tests/request-inbox.test.ts` also confirms the client can read a booking after acceptance, but there was no dedicated test module for the Booked Services list/detail contracts before this task. `apps/api/tests/client-requests.test.ts` targets a different `/api/client/service-requests` API.

## K. Coverage gaps

- Combined server search + status filtering while on a later page, including clearing both filters: addressed by one new mobile browser case.
- Direct API/PGlite coverage of the Booked Services list, detail ownership, role gate, pagination, and filter/ID validation: addressed by seven new API leaf tests.
- Reference-number list/detail projections: missing in source; two regression assertions added and retained as failing findings.
- Documented pre-acceptance request-workspace waiting state: source/API mismatch; one regression assertion added and retained as a failing finding.
- Sorting, date filters, edit/cancel/reschedule, and assignment/project/document actions are unsupported by this page, not coverage gaps.
- No active closed-booking archive-link browser test was discovered; the old matching test text is inside a block comment in the Messages spec. Page 11 uses a generic link and does not render the historical archive-control component.

## L. New browser tests

Added `apps/web/e2e/booked-services/combined-filters.spec.ts`:

- `combined search and status filters reset pagination and clear together` — at 390px, advances to page two, selects Under review, searches Service 10, verifies the combined query uses page one, then clears both filters and verifies the first unfiltered page returns.
- Classification: **MOCKED_UI_VERIFIED**.
- Result: passed. It uses role/name selectors and response-state assertions; no arbitrary delay was added.

## M. New API tests

Added `apps/api/tests/booked-services.test.ts`, using `startPgliteApp` and the repository migration chain; it uses only isolated in-memory PostgreSQL.

| Unique leaf test                                                                            | Result                                        |
| ------------------------------------------------------------------------------------------- | --------------------------------------------- |
| List is authenticated-owner scoped, status/reference searchable, and paginated consistently | Pass                                          |
| Direct list/detail reads require authentication and USER role                               | Pass                                          |
| Details are owner-scoped, safe-projected, and return 404 for foreign/missing IDs            | Pass                                          |
| Invalid filters and malformed IDs return 400                                                | Pass                                          |
| List projection includes generated client-facing reference number                           | **Fail — actual field is absent**             |
| Detail projection includes generated client-facing reference number                         | **Fail — actual field is absent**             |
| Client opens documented waiting state before request acceptance                             | **Fail — actual status is 404, expected 200** |

The API runner reports eight total test nodes because it includes the enclosing suite. Unique leaf count is **4 passed / 3 failed**. The failures are intentionally preserved; no application fix was authorized.

## N. Execution results

| Check                                                     | Result                                                                                                                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Playwright discovery before changes                       | 444 tests / 60 spec files                                                                                                                                          |
| Playwright discovery after addition                       | 445 tests / 61 spec files (exactly one new browser case)                                                                                                           |
| Booked Services direct browser specs                      | 10 passed / 0 failed (the original nine plus the new combined-filter case)                                                                                         |
| Shared table + request-acceptance compatibility selection | 4 passed / 0 failed (desktop/mobile for each group)                                                                                                                |
| New PGlite API module                                     | 7 unique leaves: 4 passed / 3 failed for BOOK-001/002                                                                                                              |
| Closed-booking archive selector                           | No active tests matched; the historical test is block-commented. The attempt is retained in evidence.                                                              |
| Root `pnpm format`                                        | Exit 0; rerun after the one test typing correction also exited 0.                                                                                                  |
| Root `pnpm lint`                                          | Exit 0 after the final test source correction.                                                                                                                     |
| Root `pnpm typecheck`                                     | Initial attempt found an implicit `any[]` inference in the new test; the fixture was explicitly typed as `ServiceRequest[]`. Final web and API typecheck exited 0. |
| Git diff check                                            | `git diff --check` passed; no tracked source or historical artifacts changed.                                                                                      |
| Screenshot evidence                                       | Four mocked-UI captures retained: desktop/mobile list and details drawer.                                                                                          |

Focused Playwright UI cases used the existing standalone Next build at `127.0.0.1:5274`. The supplemental screenshots were captured from the local Next development server after type generation; the development indicator was hidden for the captures. All browser API responses were intercepted/mocked. Browser execution is not live integration.

## O. Defect register

### BOOK-001 — Booked Services omits the request reference number

**Class:** `API_CONTRACT_DEFECT`  
**Evidence:** the Prisma row stores `referenceNumber`; `BookedService` has an optional `referenceNumber`; the UI labels the column “Service / Reference” and the search hint promises reference search. The Booked Services `bookingSelect` omits `referenceNumber`, unlike the shared client-request projection. The PGlite list search finds `SR-BOOKED-001` but returns no reference field; the detail projection also omits it. Two new leaf tests fail on the actual response.  
**User-visible result:** rows show internal ID under the reference heading and details fall back to that ID.  
**Disposition:** preserved for a separately authorized application fix.

### BOOK-002 — Unaccepted booking workspace link returns 404

**Class:** `API_CONTRACT_DEFECT`  
**Evidence:** the Booked Services details drawer always renders its request-workspace link. `request-messaging.md` says the owning client can view a waiting state before acceptance; the browser mock returns `{ conversation: null, canSend: false, messages: [] }`. In source, acceptance is where `RequestConversation` is upserted and linked, and `resolveConversation` only searches existing visible conversations. The isolated USER request to `/api/request-conversations/<unacceptedBookingId>` returns 404. The new PGlite regression assertion fails on that response.  
**User-visible result:** the link navigates to Messages but the actual API cannot serve the documented waiting state.  
**Disposition:** preserved; no messaging or API source was changed.

No additional Booked Services application defect was confirmed. The legacy archive-control overlap concerns the Messages surface; the Booked Services page renders only `RequestMessagesLink` and not that archive-control component.

## P. Historical findings

- PW-030's accepted redirect correction remains `/module` for internal roles, with hidden-content and no-data-read assertions intact.
- Approved PW-001/PW-037 redirect deltas and the known PW-149 title mismatch were not edited.
- The Phase 7 conversation archive-control overlap was inspected. Booked Services does not own or render those controls; it links to Messages. No active closed-booking deep-link browser test was executed because the matching historical test is commented out.
- Existing Page 9/10 reports, immutable Phase 4 baseline artifacts, and accepted deltas were not edited.

## Q. Integration limitations

- **MOCKED_UI_VERIFIED:** browser list, details, combined filters, refresh/error states, role redirects, shared table behavior, and request acceptance handoff.
- **ISOLATED_API_VERIFIED:** PGlite route/auth/owner/query/detail behavior. The three failing expected-contract checks are live API source behavior observed against the isolated database, not mocked assertions.
- **SOURCE_ONLY:** schema relationships, unexercised workflow transitions, data constraints beyond the PGlite fixtures, and authentication/session behavior other than direct API role gates.
- **LIVE_INTEGRATION_VERIFIED:** none. No hosted database or production records were used.
- The legacy archive test selection produced “No tests found” because matching source is block-commented; archive routing from a real Booked Services page was not verified.

## R. Historical preservation

The task-provided accepted inventory is 292 historical identities, 1,630 assertion sites, 4,211 mappings, 58 Page 1–10 browser additions, and 10 Page 7–10 API additions. No prior page test/report/baseline file was modified. The current Chromium collection changed from 444/60 to 445/61, with one new Page 11 leaf and no edits to the existing nine Booked Services leaves.

The repository's legacy verifier was run and failed before global reconciliation at the documented PW-149 title mismatch: “duplicate email registration displays inline server error alert”. Therefore a clean independent verification of 292 identities/1,630 sites/4,211 mappings is **not claimed**. The verifier's evidence is retained; no baseline artifact was rewritten. The Page 10 report also records accepted PW-001/PW-037 corrections and the same limitation.

No skip was added. The focused Playwright runs had zero skips. The expected global discovery count includes the repository's existing test inventory; this task did not execute the full suite.

## S. Files changed

- `apps/web/e2e/booked-services/combined-filters.spec.ts` — one new browser test.
- `apps/api/tests/booked-services.test.ts` — seven isolated API leaf tests, including three preserved contract failures.
- `docs/testing/verification/phase7/page-by-page/page-11-booked-services.md` — this report.
- Ignored, uncommitted execution evidence: `test-results/phase7/page-by-page/page-11-booked-services/`, including desktop/mobile list and detail screenshots.

No application source, API business logic, Prisma schema, migration, dependency manifest, lockfile, or prior-page test was modified.

## T. Final recommendation

Page 11's source audit, coverage review, browser additions, isolated API tests, and required root quality gates are complete. Recommend **COMPLETE WITH VERIFIED DEFECTS** for administrative review. BOOK-001 and BOOK-002 remain visible as failing API regressions. The global preservation verifier limitation and live-integration boundary remain explicit. No Page 12, Phase 7.5, commit, push, or production-readiness claim was started.

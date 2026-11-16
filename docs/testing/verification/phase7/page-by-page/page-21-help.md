# Phase 7.4.1 — Page 21: Help

**Audit status:** Complete for the authorized Page 21 scope, with two open documentation defects and an evidence-capture limitation. The page source, role boundary, static content, browser behavior, existing route coverage, and relevant integration behavior were inspected. The focused production-like run passed 10 of 12 new cases; the two retained failures reproduce the content defects below. No product source was changed.

**Recommendation:** Ready for administrative review with P21-001 and P21-002 open. Supply a real support contact and complete the client-facing status guide in a later authorized product change.

## A. Overall status

Page 21 is a client-only Help center at `/help`. It contains searchable FAQ content and one booking-support panel. No Help-specific backend feature exists. USER access and internal-role denial match the current route policy.

Two actionable content problems are confirmed and preserved as failing regressions:

- **P21-001 — P2, DOCUMENTATION DEFECT:** the support link points to `support@exp.test`, on the reserved `.test` domain.
- **P21-002 — P2, DOCUMENTATION DEFECT:** the status answer only covers 2 of the 6 request statuses presented elsewhere in Booked Requests.

The functional run also passed the main-content, search, disclosure, Messages navigation, role, unauthenticated, and responsive assertions. A later attempt to collect retained screenshot/trace artifacts was blocked by local-server behavior; see Sections S and V.

## B. Git baseline

| Item                       | Initial value                                                                                      | Final value                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Branch                     | `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages` | unchanged                                                           |
| HEAD                       | `cff959f5b259c5f3b58f067cb253d6e6cb55f86d`                                                         | unchanged                                                           |
| Initial working tree       | Clean; up to date with origin                                                                      | Two intended tracked deliverables only: new Page 21 spec and report |
| Active merge               | None; no `MERGE_HEAD`                                                                              | None                                                                |
| Initial `git diff --check` | Pass                                                                                               | Pass after changes                                                  |

Recent history at baseline was the Page 20 Calendar test/report, then Pages 19 Billing Logs, 18 Settings, 17 Profile, and the development merge. Initial evidence is in `initial-git-baseline.log`.

## C. Historical preservation

The accepted historical inventory remains **292 original identities, 1,630 assertion sites, 4,211 preservation mappings, and 5 intentional live-backend skips**. Page 20 recorded **506 tests in 71 files**. This audit added one spec file with 12 cases; final discovery is **518 tests in 72 files**.

The historical verifier was run unchanged. It stopped at the documented PW-149 identity/title difference: the legacy expected title “duplicate email registration displays inline server error alert” is absent because the current test uses server-conflict wording. It reported no duplicate or unexpected identity, but did not reach later mappings. PW-037 and PW-001 redirect discrepancies remain previously documented. No historical reconciliation pass is claimed. See `historical-verifier.log` and the prior [Page 20 report](page-20-calendar.md).

No Page 1–20 test, assertion, skip, or immutable baseline artifact was changed. The new spec contains no skip.

## D. Source inspection

| Source                                                                                                                                   | Responsibility                                  | Help behavior / dependency                                                                                                                                 | Related tests                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `apps/web/src/app/(portal)/help/page.tsx`                                                                                                | `/help` route component                         | Static FAQ data, search state, disclosure state, `/messages` link, fixed `mailto:` destination; no page-specific API                                       | New Page 21 spec                                            |
| `apps/web/src/components/ui/search-field.tsx`                                                                                            | Shared labeled search input                     | Native `type="search"`; label is visually hidden; controlled value                                                                                         | New search case                                             |
| `apps/web/src/components/ui/search-empty-state.tsx`                                                                                      | Search empty state                              | Static text in `role="status"`, `aria-live="polite"`                                                                                                       | New search case                                             |
| `apps/web/src/components/layout/page-header.tsx`, `styles.ts`, `components/ui/button.tsx`                                                | Shared heading, content width/focus tokens, CTA | H1/description, layout styles, CTA focus and button presentation                                                                                           | New rendering/accessibility cases                           |
| `apps/web/src/features/workspaces/model/route-policy.ts`                                                                                 | Route and navigation policy                     | `/help` uses `canAccessServiceCatalog`; footer link label is “Help & Support”                                                                              | `apps/web/test/route-policy.test.mjs`; new role cases       |
| `apps/web/src/components/layout/sidebar.tsx`, `portal-layout.tsx`, `features/auth/hooks/use-account.ts`, `features/auth/api/auth-api.ts` | Portal navigation and shared auth               | Sidebar entry; denied internal routes redirect to `/module`; unauthenticated account lookup returns to `/login`; session lookup uses shared `/api/auth/me` | Navigation, auth, route-policy suites; new role/login cases |
| `apps/web/src/features/services/model/service-request-status.ts`, `service-operations/model/service-request-contracts.ts`                | Request status contract and labels              | Defines the six current statuses and visible labels used by Help and Booked Requests                                                                       | New status-content regression; route/content unit suites    |
| `apps/web/src/features/services/pages/client-service-requests-page.tsx`, `components/client-requests-table.tsx`                          | Client Booked Requests                          | Filters and displays the complete status set; chat action is available once a request has an accepted department                                           | Existing service request coverage; new content comparison   |
| `apps/api/src/features/request-inbox/request-inbox.service.ts` and controller                                                            | Request acceptance                              | Accepting a request records the accepted department and supports the conversation workflow described in Help                                               | Existing request-inbox/API coverage                         |
| `apps/web/src/features/request-conversations/components/request-conversation.tsx`, `conversation-meetings.tsx`, `conversation-tools.tsx` | Booking conversation UI                         | Quotation/consultation workflow and Request reschedule action referenced by FAQ answers                                                                    | Existing request-conversation tests                         |
| `apps/web/e2e/regression-support.ts`                                                                                                     | Isolated browser fixture                        | Seeds a USER session and mocks same-origin API calls                                                                                                       | New Page 21 spec                                            |

Search across `apps/api/src` found no Help controller, route, service, persistence model, or Help-specific endpoint. The Help page itself reads no API data. The containing portal still uses shared authentication and preferences behavior; the Messages destination has its own page/API behavior outside this page.

## E. Functionality inventory

| Feature                             | User purpose                                                 | Roles | Data/API                                             | Expected and failure behavior                                                            | Coverage                                        |
| ----------------------------------- | ------------------------------------------------------------ | ----- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------- |
| FAQ search                          | Find questions by question, answer, or included status label | USER  | In-memory static text; no API or validation request  | Empty query shows all six questions; unmatched query shows an announced no-results state | P21-WEB-002                                     |
| FAQ disclosures                     | Read one answer at a time                                    | USER  | Local React state                                    | First question starts open; button toggles; opening another closes the current one       | P21-WEB-003                                     |
| Booking guidance                    | Learn how to submit and track a service request              | USER  | Static JSX                                           | Directions correspond to Services and Booked Requests                                    | P21-WEB-001; content comparison                 |
| Quotation and consultation guidance | Find a quotation, appointment details, or reschedule action  | USER  | Static JSX; workflow happens in booking conversation | Directions correspond to current conversation workflow                                   | Content comparison; existing conversation suite |
| Contact/support panel               | Continue to Messages or invoke the email client              | USER  | Internal route plus fixed `mailto:`                  | Messages route is usable; email destination is currently a reserved placeholder          | P21-WEB-004/005                                 |

Unsupported on this page: internal-role manuals, troubleshooting tree, ticket/support form, feedback submission, file downloads, videos, external documentation, category filters, status polling, and support-status display. These were not invented or tested as features.

## F. Interactive controls

| Control                                | Visibility / role                          | Handler or destination                | Expected behavior                                                                            | Result                                                                           |
| -------------------------------------- | ------------------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Client sidebar “Help & Support” link   | USER only                                  | `/help`                               | Opens Help within the client portal                                                          | Existing navigation test sees it; direct USER route passed                       |
| Search questions input                 | USER                                       | `onChange` updates local search state | Case-insensitive trimmed filtering; native search input can be cleared                       | P21-WEB-002 passed                                                               |
| Six FAQ buttons                        | USER                                       | `setOpenQuestion`                     | Native keyboard-operable disclosures with `aria-expanded` and `aria-controls`; only one open | P21-WEB-003 passed using Enter and Space                                         |
| “Open messages” CTA                    | USER                                       | `/messages`                           | Opens the shared Messages list; user selects a booking conversation there                    | P21-WEB-004 passed by keyboard activation                                        |
| `support@exp.test` email link          | USER                                       | `mailto:support@exp.test`             | Starts a mail client addressed to support                                                    | Destination is a reserved test-domain placeholder; P21-WEB-005 fails as intended |
| Browser-native search clear affordance | USER, browser-provided for `type="search"` | Clears the input value                | Restores filtered FAQ content                                                                | `fill("")` recovery passed; the page has no separate app clear button            |

No form fields, submit/retry buttons, category controls, download actions, external web links, or Help-specific dialogs are present.

## G. Content structure

The page has a main landmark with one H1, “Help & Support,” and the description “Find answers about booking services and tracking your requests.” It presents two H2 sections:

1. **Bookings and requests:** “How do I book a service?”, “What happens after I book a service?”, and “What does my request status mean?”
2. **Quotations and consultations:** “Where do I review my quotation?”, “Where do I find my consultation details?”, and “How do I request a different time?”

A labeled booking-support aside contains explanatory text, the Messages CTA, and the email link.

## H. Content accuracy

| Help section / claim                                                                          | Current implementation evidence                                                                | Match?                             | Evidence / finding                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Choose a service/package, complete the request form, review and submit                        | Client Services flow at `/services`                                                            | Accurate                           | The client catalog and request flow expose these steps.                                                                                                                            |
| Responsible department reviews the request; track it in Booked Requests                       | `/service-requests`; request acceptance workflow in Request Inbox                              | Accurate                           | Current routes and labels match the user-facing directions.                                                                                                                        |
| Continue the conversation once the team accepts                                               | Accepted request stores an accepted department; client request list exposes chat when accepted | Accurate                           | `client-requests-table.tsx` and request-inbox acceptance flow support this condition.                                                                                              |
| Request status FAQ explains the current request statuses                                      | Status model has six states; answer renders only SUBMITTED and UNDER_REVIEW                    | **Incomplete — P21-002**           | Four statuses are omitted: Awaiting your information, Ready for quotation, Closed, Cancelled. P21-WEB-006 reproduces it.                                                           |
| Quotation appears in the booking conversation after the team sends it                         | Request conversation and quotation workflow                                                    | Accurate                           | No promise of a quote before the team sends one.                                                                                                                                   |
| Consultation date/time and location or meeting link appear once scheduled                     | Conversation meeting card                                                                      | Accurate                           | The conversation is the source of scheduled meeting detail.                                                                                                                        |
| Request a different time using “Request reschedule”; old appointment stays until confirmation | `conversation-meetings.tsx` reschedule control and workflow                                    | Accurate                           | The current UI has the named action; no immediate replacement is claimed.                                                                                                          |
| Email support at `support@exp.test`                                                           | Fixed email anchor in Help page                                                                | **Reserved placeholder — P21-001** | `.test` is reserved for testing under [RFC 2606 §2](https://www.rfc-editor.org/rfc/rfc2606.html#section-2). A live support address is not supplied or inferred. No email was sent. |

The status omission is a documentation defect: the application displays statuses that the Help answer does not explain. It is not evidence that the status model or workflow is incorrect.

## I. Role-specific guidance

Help contains client-oriented language and no internal-role instructions. The route policy grants `/help` to USER accounts and denies internal workforce roles. The new browser suite verified direct routing for STAFF, department-head STAFF, ADMIN, and SUPERADMIN; each was sent to `/module` and did not receive a Help link. USER opened the route and sees the client sidebar entry.

| Account state/role                       | Expected route result | Browser result |
| ---------------------------------------- | --------------------- | -------------- |
| USER                                     | `/help` allowed       | Pass           |
| STAFF without department head assignment | `/module`             | Pass           |
| Department-head STAFF                    | `/module`             | Pass           |
| ADMIN                                    | `/module`             | Pass           |
| SUPERADMIN                               | `/module`             | Pass           |

Department-head status does not grant the client Help route. Help does not mention Request Inbox, Account Management, Staff Workload, Billing Logs, or other internal-only pages.

## J. Internal navigation

| Link label                      | Source href | Authorized roles                                             | Verification                                                                              |
| ------------------------------- | ----------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Help & Support (sidebar footer) | `/help`     | USER                                                         | Route policy and shared navigation coverage; direct Help route passed                     |
| Open messages                   | `/messages` | USER and authorized internal roles, subject to shared policy | P21-WEB-004 keyboard activation reached `/messages`; route is a valid Messages list entry |

The CTA does not pass a request ID or select a specific booking conversation. It opens the list, where the client can select a conversation. No broken route or lost authentication was observed in the production-like test run.

## K. External links and contact destinations

There are no `http:`/`https:` external documentation links, `target="_blank"` links, embedded media, or downloads. The only non-app destination is the fixed `mailto:` link. P21-WEB-005 verifies its basic mailto syntax and intentionally rejects a `.test` suffix; it fails on the actual `mailto:support@exp.test`. The link was inspected only; no mail client or external recipient was contacted.

## L. Search and FAQ functionality

Search trims whitespace and lowercases the query, then matches against each question title, answer text, and the display labels for statuses listed by that question. It is entirely in-memory; there is no debounce or server dependency. Filtering is case-insensitive. An unmatched query renders `SearchEmptyState` with `role="status"` and polite live announcement. Clearing the field restores all six questions.

FAQ state is a single question title or null. The first Bookings and requests question is open initially. Each question is a native button with `aria-expanded` and `aria-controls`; the associated answer container reports `aria-hidden`. Enter and Space behavior passed in P21-WEB-003. No explicit app-owned clear button is implemented.

## M. Support forms and input validation

No support form, feedback form, or ticket-submission control exists. The only text input is search; it is handled locally and does not submit data. There is therefore no Help payload validation, duplicate submission, ownership, or persistence contract to test. No API tests were added.

## N. Authentication and authorization

`PortalLayout` and `useAccount` provide the page's shared authentication boundary. An unauthenticated direct visit was redirected to `/login` in P21-WEB-011. Internal authenticated roles were redirected to `/module`; USER access passed. Shared auth handles account lookup and revoked sessions. Inactive-account and token-refresh behavior are inherited from the shared auth provider and existing authentication coverage; no Help-specific override exists.

## O. API contract matrix

| Operation                                       | Help-specific endpoint | Shared/linked dependency                            | Coverage                                                        |
| ----------------------------------------------- | ---------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| Load FAQ and search                             | None                   | Static JSX/local React state                        | Browser tests                                                   |
| Resolve current account and route authorization | None                   | Shared `GET /api/auth/me` via portal authentication | Existing auth tests and Page 21 role/login cases                |
| Portal preferences                              | None                   | Shared settings provider may load preferences       | Covered by shared Settings/portal behavior, not a Help contract |
| Open booking conversation                       | None from Help itself  | `/messages` page owns conversation APIs             | Existing Messages/request-conversation suites                   |

No Help-specific API route, controller, persistence model, input schema, or error contract was found. PGlite API tests would not add relevant coverage and were not created.

## P. Loading, error, empty, and recovery states

The FAQ content has no remote loading or error state. Search has an explicit no-results state and recovers when the query is cleared. Shared portal auth shows account-loading/error states and handles login routing. Preferences errors are handled by the shared provider; they are not Help-content failures. Messages errors belong to the Messages page. No page-specific retry control exists.

## Q. Content security and safe rendering

Help content is trusted static JSX. It does not parse Markdown, render raw HTML, consume CMS/API/user-provided documentation, or use `dangerouslySetInnerHTML`. Search text is state used for matching and escaped React text in the empty-state message. The only fixed non-app link uses the `mailto:` protocol. No sensitive account data is displayed by this page.

## R. Accessibility

Source review confirmed a main landmark, one H1, ordered H2 sections, a visually hidden search label, native search input, named buttons and links, native keyboard actions, visible focus styles, `aria-expanded`/`aria-controls` disclosure state, `aria-hidden` answers, a labeled aside, and a polite status message. Decorative icons are `aria-hidden`. Static Help text is not conveyed by color alone.

P21-WEB-001–004 and P21-WEB-009 exercised names, semantics, keyboard use, and layout. No automated axe scan or assistive-technology session was run; the accessibility assessment is source review plus browser assertions, not a certification.

## S. Responsive layout and usability

The production-like focused run checked 1440, 1280, 768, and 390 CSS-pixel widths. At each width the H1 and search field remained visible and `documentElement.scrollWidth <= innerWidth`; the test passed. Source styles use a two-column layout at `lg`, stack below it, and full-width search at narrow widths.

The responsive test called Playwright's screenshot capture, but its default output directory was cleared by the subsequent shared-navigation run before the image could be copied into the Page 21 evidence directory. A later retry could not retain a valid screenshot: the production-like web server timed out after 120 seconds, and the already-running development server remained at “Loading your account” despite the attempted local session fixture. Those reruns were not counted as responsive test results. No valid screenshot is included; this is an evidence limitation, not a claimed visual pass beyond the measured assertions.

## T. Existing regression coverage

| Test                                                                            | Existing coverage                                                                                | Gap before Page 21                                                |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `apps/web/e2e/module-scoped-navigation.spec.ts` — client shared navigation case | USER navigation and visibility of “Help & Support” while using Services/Projects                 | No direct Help page behavior or content validation                |
| `apps/web/test/route-policy.test.mjs`                                           | USER route matrix includes `/help`; STAFF, STAFF_HEAD, ADMIN, and SUPERADMIN matrices exclude it | No browser redirect check from Help                               |
| Shared auth/portal suites                                                       | Portal session and role behavior                                                                 | No Help-specific unauthenticated case                             |
| Messages/request-conversation browser and API suites                            | Conversation workflow, quotation and meeting behavior                                            | No Help-to-Messages keyboard link case or FAQ accuracy assertions |
| API tests                                                                       | Request acceptance/conversation behavior                                                         | No Help API exists; no support endpoint coverage applies          |

No pre-existing direct Help page spec or support API spec was found.

## U. New regression coverage

Added `apps/web/e2e/help/page-21-regression.spec.ts` with 12 unique cases:

| Identity    | Scenario                                                                 |
| ----------- | ------------------------------------------------------------------------ |
| P21-WEB-001 | USER Help content and contact/navigation controls render                 |
| P21-WEB-002 | Search trim/case-folding, no-results announcement, and clear recovery    |
| P21-WEB-003 | FAQ disclosure ARIA state and Enter/Space operation                      |
| P21-WEB-004 | Messages CTA opens `/messages` by keyboard                               |
| P21-WEB-005 | Support destination is not a reserved `.test` address (retained failure) |
| P21-WEB-006 | Status FAQ covers all current request labels (retained failure)          |
| P21-WEB-007 | STAFF direct Help denial                                                 |
| P21-WEB-008 | Department-head STAFF direct Help denial                                 |
| P21-WEB-009 | ADMIN direct Help denial                                                 |
| P21-WEB-010 | SUPERADMIN direct Help denial                                            |
| P21-WEB-011 | Unauthenticated Help visit returns to `/login`                           |
| P21-WEB-012 | Help remains readable without horizontal overflow at four widths         |

The four role cases originally shared a provisional label; the new spec was corrected to unique identifiers before final discovery. This was a test-label correction only. No API cases were added because Help has no API contract.

## V. Execution results and defects

| Stage                             | Command / scope                                                                                                                   | Result                                                                                             | Classification                            |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Initial discovery                 | `pnpm --filter @nexus/web exec playwright test --list`                                                                            | 506 tests / 71 files                                                                               | Pass                                      |
| Page 21 browser suite             | `e2e/help/page-21-regression.spec.ts`, production-like Playwright webServer, one worker, trace enabled                            | 12 cases; 10 passed, 2 failed exactly at the expected content assertions                           | P21-001 and P21-002: DOCUMENTATION DEFECT |
| Existing navigation compatibility | `e2e/module-scoped-navigation.spec.ts`, one worker                                                                                | 11 passed                                                                                          | Pass                                      |
| Web units                         | `pnpm --filter @nexus/web test`                                                                                                   | 98 passed, 0 failed, 0 skipped                                                                     | Pass                                      |
| API tests                         | Not run                                                                                                                           | No Help-specific API; not applicable                                                               | INTENTIONAL LIMITATION                    |
| Historical verifier               | `node scripts/verify-playwright-migration.mjs discover`                                                                           | Stopped at documented PW-149 exact-title mismatch; no duplicates or unexpected identities reported | Existing historical limitation            |
| Evidence retry                    | Production webServer timed out after 120 seconds; run against existing port 5173 stayed on the auth loading state and was stopped | Not counted; valid first run remains the functional result                                         | ENVIRONMENT FAILURE                       |

The focused log confirms P21-WEB-005 fails because the received link is `mailto:support@exp.test`. P21-WEB-006 fails because the answer contains only “Pending review” and “Under review”; the first missing label is “Awaiting your information.” Both regressions remain intact and no Help source was changed. The development-server retry produced environment-only traces under `playwright-artifacts/`; it did not reproduce or supersede the production-like result.

## W. Preservation and quality gates

Final checks after report/spec formatting:

| Check                                                             | Result               |
| ----------------------------------------------------------------- | -------------------- |
| `pnpm format`                                                     | Pass (exit 0)        |
| `pnpm lint`                                                       | Pass (exit 0)        |
| `pnpm typecheck`                                                  | Pass (exit 0)        |
| `git diff --check`                                                | Pass (exit 0)        |
| Final Playwright discovery                                        | 518 tests / 72 files |
| Accepted Page 1–20 tests changed                                  | No                   |
| Historical assertions weakened or removed                         | No                   |
| New skips added                                                   | No                   |
| Application/backend/route/auth/schema/dependency/lockfile changes | None                 |
| Commit, push, merge, rebase, reset, or branch switch              | None                 |

Prior findings listed in the Page 21 task prompt are preserved as historical issues and were not revalidated here: registration contact truncation and malformed-success token handling; Services pricing boundary and pagination; Request Inbox decline/delete endpoints; Booked Services reference projections and waiting-state discrepancy; Messages archive pointer and lifecycle question; Project Details navigation/notification; NEX-006 workspace-creation access; Workspace Details loading-after-404 and task-limit bypass; Staff Workload pagination; Profile Unicode URL normalization; Settings timeout/contracts; Billing Logs demo-row details; Calendar impossible-date and timezone issues; and request-workflow API-TEST-001. This report does not claim any of them resolved.

Tracked deliverables are limited to the new Page 21 spec and this report. Logs and artifacts are under `test-results/phase7/page-by-page/page-21-help/` (ignored by Git).

## X. Final recommendation

**Stop for administrative review.** Page 21’s source audit and regression enhancement are complete within scope. Review P21-001 and P21-002 before approving Help content. A live support address must be supplied by the product owner; it was not guessed. No production correction was made. The functional browser result is 10 passing cases plus the two preserved content failures. The screenshot/valid-trace evidence gap is recorded above.

No accepted Page 1–20 test was modified; no historical assertion was weakened; no test was removed or newly skipped; no application/backend source or Prisma schema was modified; no commit or push occurred. Page 22 and Phase 7.5 were not started. No further page work was begun.

# Phase 7.4.1 — Page 22: My Projects

**Audit status:** Complete for the authorized Page 22 scope; ready for administrative review with two Page 22 findings, one unresolved route/API contract discrepancy, and inherited cross-page defects. No product code was changed.

**Recommendation:** Keep APP-TABLE-001 open. Record the narrow-screen list rendering as P22-001. Resolve the STAFF route/list API contract before treating staff access to `/projects` as supported. Do not interpret this report as defect-free product acceptance.

## A. Overall status

The actual My Projects page is the client-facing `/projects` route. It lists authenticated client project summaries, calculates local search/filter/sort and pagination, and links to `/projects/[id]`. The list itself is read-only. It does not have a project editor, archive control, staffing controls, task editor, or deliverable mutation controls.

Ownership is enforced on the API using the authenticated user ID. A PGlite regression verifies selector query parameters cannot change that scope. USER route and API behavior is consistent. STAFF is allowed through the web route policy but rejected by the client-only list API, producing an error on the otherwise accessible page. That mismatch remains unresolved.

The historical stale-pagination issue is still present and is the existing APP-TABLE-001 finding. A separate responsive defect was reproduced: at 768px and 390px the authored mobile list remains hidden while the 920px-minimum desktop table remains visible inside its horizontal scroller.

## B. Git baseline

| Item               | Initial value                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Branch             | `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages`                                    |
| HEAD               | `94bce8910795ef2ae2f028627c4ca7908cd4ef34` (`94bce89 test(help): add E2E help validation tests and phase 7 regression documentation`) |
| Initial worktree   | Clean; up to date with origin                                                                                                         |
| Merge state        | No `MERGE_HEAD`                                                                                                                       |
| `git diff --check` | Clean                                                                                                                                 |
| Recent history     | Page 21 Help, Page 20 Calendar, Page 19 Billing Logs, Page 18 Settings, Page 17 Profile                                               |

The initial status, branch, HEAD, recent history, merge check, and whitespace check are preserved in `initial-git-baseline.log`. The final Git state is recorded in section W and the final evidence summary.

## C. Historical preservation

The immutable Phase 4 baseline remains **292 original Playwright identities, 1,630 assertion sites, 4,211 preservation mappings, and 5 intentional live-backend skips**. The accepted Page 1–21 tests and earlier findings were not edited. Page 22 additions are counted separately.

Initial Playwright discovery was **518 tests in 72 files**. Final discovery is **526 tests in 73 files**: eight Page 22 browser cases in one new spec. The logs are `initial-discovery.log` and `final-discovery.log`.

The unchanged `scripts/verify-playwright-migration.mjs discover` verifier was run. It stopped at the documented PW-149 exact-title mismatch: the legacy title expects “duplicate email registration displays inline server error alert,” while the current test title uses “duplicate email registration displays server conflict feedback.” It reported no duplicate or unexpected identities. It does not reach later mapping checks, so no complete fresh global reconciliation is claimed. PW-037/PW-001 limitations remain those documented in accepted reports. The verifier output is retained as `historical-preservation-verifier.log`.

## D. Source inspection

| Source                                                                                                      | Responsibility and My Projects behavior                                                                                                        | API/database relationship                                                                                                 | Relevant checks                                      |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `apps/web/src/app/(portal)/projects/page.tsx`                                                               | Routes `/projects` to `ClientProjectsPage`.                                                                                                    | Loads the client summary endpoint through the feature page.                                                               | P22-WEB-001–007; NEX-017                             |
| `apps/web/src/features/projects/pages/client-projects-page.tsx`                                             | KPIs, search, status filter, sort, empty/error/loading states, and local pagination.                                                           | Calls `listClientProjects`; navigates to `/services` and project detail.                                                  | P22-WEB-001–007; NEX-017                             |
| `apps/web/src/features/projects/components/client-projects-table.tsx`                                       | Desktop table and intended mobile list; project title and eye-action links; progress/status/date rendering.                                    | Displays `ClientProjectSummary`; links to `/projects/<encoded id>`.                                                       | P22-WEB-001, P22-WEB-007                             |
| `apps/web/src/features/projects/api/projects-api.ts`                                                        | Defines `ClientProjectSummary`; `listClientProjects` sends GET `/api/projects`; `getProject` sends GET `/api/projects/:id`.                    | Summary fields match the project list service projection.                                                                 | P22-WEB-001; NEX-013/014                             |
| `apps/web/src/features/projects/model/project-status.ts`                                                    | Humanizes statuses, selects pill tones, computes the displayed percentage.                                                                     | Consumes API status and completed-task aggregates.                                                                        | P22-WEB-001/002; web unit suite                      |
| `apps/web/src/components/ui/use-local-table.ts`                                                             | Local page state keyed by serialized view. A previous key/page pair is retained when another view is selected.                                 | Shared UI hook; no server paging or URL state.                                                                            | P22-WEB-003; APP-TABLE-001                           |
| `apps/web/src/features/workspaces/model/route-policy.ts`; `apps/web/src/features/auth/model/permissions.ts` | `/projects` and nested project routes use `canAccessProjects`; it accepts USER and STAFF. The My Projects navigation link itself is USER-only. | Route guard is separate from API role checks.                                                                             | P22-WEB-004/005/006; route-policy unit tests         |
| `apps/api/src/app.ts`; `apps/api/src/features/projects/projects.controller.ts`                              | Mounts `/api/projects`; `requireAuth` protects it; GET `/` passes the authenticated ID to `listClientProjects`.                                | Query parameters are not read by the list controller.                                                                     | P22-API-001; NEX-013                                 |
| `apps/api/src/features/projects/projects.service.ts`                                                        | Active USER check, client-owned visibility scope, summary projection, task aggregation, visible deliverable count, deterministic order.        | Queries `Project`, optional `ServiceRequest`, and client-visible milestone/file relation in a RepeatableRead transaction. | P22-API-001; NEX-013/014                             |
| `apps/api/src/features/auth/auth.middleware.ts`; `apps/api/src/shared/query/accounts.ts`                    | Rejects invalid, expired, revoked, inactive, or deleted sessions; `activeAccount` requires active and not deleted.                             | Shared authorization and account scope.                                                                                   | JWT session PGlite suite; source inspection          |
| `apps/api/prisma/schema.prisma`                                                                             | `Project` owns client, status, optional request, work plan, staff, milestones, change requests, and messages.                                  | List query uses client, optional request/service, and milestone/file relations.                                           | P22-API-001; NEX-013/014; project-conversation tests |
| `docs/testing/verification/phase7/page-by-page/page-13-project-details.md`; Page 12 report                  | Prior APP-TABLE-001 and client detail defects; shared archive pointer obstruction.                                                             | Existing findings were retained and cross-checked.                                                                        | Current NEX-017 and compatibility reruns             |

The original source/test/document searches are preserved in `my-projects-source-search.log`, `my-projects-tests-search.log`, `my-projects-docs-search.log`, and `project-api-schema-files.log`.

## E. Functionality inventory

| Feature                   | Current behavior, eligible account, and data source                                                                             | Boundary and regression coverage                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Project directory         | USER sees the authenticated client’s server-scoped summaries; API order starts newest-updated first.                            | No cross-client query is accepted; P22-API-001 and NEX-013.                                                       |
| Summary KPIs              | Counts active (`IN_PROGRESS` or `ON_HOLD`), completed, and summed client-visible deliverables.                                  | No cancelled-project KPI. Counts derive from the fetched list.                                                    |
| Search                    | Local case-insensitive substring search over name, service name, and request reference.                                         | Description, ID, status, dates, department, and assigned staff are not searched. P22-WEB-002.                     |
| Status filter             | All, Active, Completed, Cancelled. Active combines `IN_PROGRESS` and `ON_HOLD`.                                                 | No separate Planned or On Hold option. P22-WEB-002.                                                               |
| Sort                      | Most recently updated (default) or least recently updated, based on `updatedAt`.                                                | No user-selectable name/status/date-range/department sort. P22-WEB-002.                                           |
| Pagination                | Local, 10 rows per page, numbered navigation and previous/next.                                                                 | View-key reactivation restores an earlier page instead of resetting it; APP-TABLE-001 and P22-WEB-003.            |
| Project summary           | Name, request reference or project ID, service, client-visible deliverable count, task progress, status, and last-updated date. | No department, assigned-team, description, or end-date display on this list. P22-WEB-001.                         |
| Project detail navigation | Project title and named eye action link to the same encoded `/projects/[id]` route.                                             | Detail API applies its own owner/contributor visibility scope. P22-WEB-001; NEX-013/014; P13-002.                 |
| New service request       | Header link routes to `/services`; the empty-project CTA routes there as “Book a service.”                                      | It starts a service request flow, not direct project creation.                                                    |
| Loading/error/empty       | Skeleton, alert, no-project empty state with CTA, and no-match state without CTA.                                               | Error state has no inline Retry control; reloading/re-entering the route retries. NEX-017 load/error/reload case. |

The list does not support project creation, renaming, cancellation, archiving, staffing changes, task edits, deliverable edits, or file upload/deletion. Client brief changes, project change/cancellation requests, deliverable review, and staff workspace management belong to detail or other workflows. `/project-workspace` is a separate internal operational area; its archive semantics do not define My Projects visibility.

## F. Interactive control inventory

| Control                      | Visibility / eligible role                                                                  | Handler and destination                                             | Expected result and regression                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| “New Service Request” link   | Header; rendered for the route, normally USER.                                              | Next link to `/services`.                                           | Starts service request flow; source verified.                                                           |
| Search projects              | Rendered while loading, on error, and with data; accessible `searchbox`.                    | Local input state; browser-native search clear/Escape is available. | Filters name/service/reference; P22-WEB-002 and keyboard path in P22-WEB-007.                           |
| Status filter                | Same list-control region; labeled Radix select.                                             | Local filter state.                                                 | ALL/ACTIVE/COMPLETED/CANCELLED; P22-WEB-002.                                                            |
| Sort projects                | Same list-control region; labeled Radix select.                                             | Local sort state.                                                   | Newest/oldest update; P22-WEB-002.                                                                      |
| Project title link           | Only for returned rows.                                                                     | Encoded link to `/projects/<id>`.                                   | Opens matching details; browser back is checked by P22-WEB-001.                                         |
| “View <project>” action link | Only for returned rows; icon has accessible name.                                           | Same detail URL as title.                                           | Opens the same project; source verified.                                                                |
| Previous/numbered/next page  | Only when nonempty rows render. Current page has `aria-current`; boundary controls disable. | `NumberedPagination` calls `table.setPage`.                         | First/last boundary state and page summary checked in P22-WEB-003 before the known restoration failure. |
| “Book a service”             | Only when the user has no projects.                                                         | Link to `/services`.                                                | Starts the service request flow; source verified.                                                       |

There is no explicit refresh/retry button, project action menu, row mutation control, detail drawer, or list-side modal. Search/filter/sort controls remain visible with the error alert. Native and Radix controls are keyboard-operable; focus styling is source-defined. Pointer behavior was exercised for filters and navigation without force-clicking.

## G. Client project ownership — P0

`GET /api/projects` takes no client selector from the browser. The controller calls `listClientProjects(request.auth.user.id)`. The service first requires that ID to identify an active USER, then queries `Project.clientId` using the same ID and an active, nondeleted USER relation. Foreign project IDs, client IDs, user IDs, and request IDs in query parameters do not alter the predicate.

P22-API-001 uses isolated PGlite records for two clients. The owner supplied all four foreign selector parameters and received only their own eligible summaries; the foreign project name, `clientId`, and `workPlan` were absent. The other client received only their own project. Unauthenticated list access returned 401. Existing NEX-013 verifies the default owner list and foreign detail denial; NEX-014 verifies file/deliverable ownership; project-conversation PGlite tests verify current membership scope. These tests touch no shared or live database.

The detail route separately returns 404 for a foreign project. Deliverable file and conversation endpoints are separate from this page’s summary call and enforce their own project/client or participant scope. No foreign navigation link is emitted by the owner-scoped list.

## H. Authorization matrix

| Role/account state           | `/projects` route                                                                 | `GET /api/projects`                         | Detail/data scope                                                                                        | List mutations |
| ---------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------- |
| Unauthenticated              | Redirects to `/login` (P22-WEB-006).                                              | 401.                                        | No data.                                                                                                 | None.          |
| Active USER                  | Allowed. My Projects navigation is visible.                                       | 200; active client’s visible projects only. | Own eligible project; foreign ID returns 404.                                                            | None on list.  |
| Active STAFF, not head       | Route is allowed by `canAccessProjects`; no My Projects nav link.                 | 403 `Client project access required`.       | Detail is only available if `contributorScope` permits; otherwise 404.                                   | None on list.  |
| Active Department Head STAFF | Same route/API mismatch as other STAFF.                                           | 403.                                        | May read/manage only qualifying projects in their accepted department scope; NEX-013 covers head detail. | None on list.  |
| Active ADMIN                 | Redirects to `/module` (P22-WEB-005).                                             | 403.                                        | No client or staff-contributor scope; missing/foreign detail is 404.                                     | None.          |
| Active SUPERADMIN            | Redirects to `/module` (P22-WEB-005).                                             | 403.                                        | No client or staff-contributor scope; missing/foreign detail is 404.                                     | None.          |
| Inactive account             | Auth provider cannot establish an active account; source policy redirects/errors. | 401 from shared middleware.                 | No data.                                                                                                 | None.          |
| Deleted account              | Auth provider cannot establish an active account; source policy redirects/errors. | 401 from shared middleware.                 | No data.                                                                                                 | None.          |
| Expired session              | Auth provider refresh/redirect behavior applies.                                  | 401 for an expired/invalid access token.    | No data without a valid session.                                                                         | None.          |
| Revoked session              | Auth provider refresh/redirect behavior applies.                                  | 401 because the session is missing/revoked. | No data.                                                                                                 | None.          |

The web route/API mismatch is P22-002, a **CONTRACT DISCREPANCY**, not a data leak: the STAFF page receives a 403 and no project rows. Existing `project-pages-regression.spec.ts` verifies the allowed STAFF route while mocking a successful empty list, so it does not cover the actual API response. P22-WEB-004 records the actual 403 behavior. Decide whether the route should be client-only or whether a staff project directory is intended; do not conflate it with `/project-workspace`.

Shared auth-session tests cover logout/revocation, expiration, deactivation, account archival, and permanent deletion. They passed in PGlite. The page-level role route tests do not independently exercise every account state through a browser login.

## I. Project lifecycle and status contracts

The Prisma `ProjectStatus` enum is `PLANNED`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED`, and `CANCELLED`. The UI humanizes the enum; active and on-hold use warning tone, completed success, cancelled danger, and planned neutral. Status text accompanies color.

| Database/API status | UI label    | List visibility from service scope                                                                                       | Filter behavior                                                     |
| ------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `PLANNED`           | Planned     | Requestless planned projects are excluded. A request-linked project requires non-null `startDate`, regardless of status. | Included by All if the API returns it; no dedicated Planned filter. |
| `IN_PROGRESS`       | In progress | Included when requestless, or request-linked with `startDate`.                                                           | Active.                                                             |
| `ON_HOLD`           | On hold     | Same visibility rule.                                                                                                    | Active.                                                             |
| `COMPLETED`         | Completed   | Same visibility rule; completed projects are not automatically archived.                                                 | Completed.                                                          |
| `CANCELLED`         | Cancelled   | Same visibility rule; cancelled projects are not automatically archived.                                                 | Cancelled.                                                          |

P22-API-001 confirms the requestless list includes active, on-hold, completed, and cancelled projects and excludes planned. It also verifies completed-task and task-total projection. No `archived` field exists on `Project`; separate workspace group/archive behavior is not applied to this client list.

## J. Search

Search is local and immediate; there is no debounce or search API parameter. The component trims leading/trailing whitespace, lowercases with `toLocaleLowerCase()`, and checks a concatenated string of project name, optional service name, and optional request reference. The input has `maxLength={100}`. Empty/cleared search restores all currently filtered rows. Description, project ID, status, department, staff, and dates are not searchable.

P22-WEB-002 verifies mixed-case and surrounding-whitespace name search, service search, reference search, and that a phrase found only in description yields “No projects match.” Search/filter view changes interact with local pagination; APP-TABLE-001 is described in L. Keyboard entry is also exercised in P22-WEB-007.

## K. Filtering and sorting

The only list filter is status: All Statuses, Active, Completed, Cancelled. It can be combined with search. The only sort is `updatedAt`, newest first by default or oldest first. `Date` parsing is applied in the client comparator. Equal timestamps compare as equal, retaining the API’s stable order (`updatedAt DESC`, then `id DESC`) under the stable JavaScript sort.

P22-WEB-002 exercises all available status selections, combined search and status transitions, both sort directions, and result order. Radix/native select options prevent a user from submitting arbitrary filter values. The API does not accept or validate status/search/sort values because the page does not send them.

## L. Pagination and APP-TABLE-001 reassessment

`useLocalTable` uses a default page size of 10. It serializes `[filter, sort, query]` as `viewKey` and stores `{viewKey, page}`. The hook’s documentation says the page returns to 1 when `view` changes. The implementation calculates page 1 for a different key but leaves the old key/page stored. When the earlier key returns, its previous page is used again. This is the same shared-hook root and list symptom recorded as **APP-TABLE-001**; no duplicate defect ID was created.

P22-WEB-003 starts on page one of 11, verifies page-one range and disabled/enabled previous/next controls, moves to page two, verifies the last-page range and reversed boundary state, switches to Completed, searches for no match, clears the search and restores All Statuses. It then expects the original page-one project, but only page-two’s Project 11 is visible. The test fails at that final expectation. The accepted NEX-017 rerun independently reaches the same failure at its click on “View Website launch.”

Historical traceability: the accepted Page 13 report records the original NEX-017 `/projects` reproduction and the `Showing 11–11 of 11` state. The older `individual/I1/reproduction.log` copied into this evidence directory is a stale earlier capture that stops on an obsolete button locator before the pagination sequence. The Page 22 fresh NEX-017 run and P22-WEB-003 provide current, direct reproductions; neither changes the accepted NEX-017 test.

Page state is local React state, not URL or browser-storage state. Reload/remount starts a fresh table hook; this audit does not claim filter/page restoration across reload or detail-route back navigation. P22-WEB-001 verifies browser back returns to the list and that list navigation causes no mutating API request.

## M. List/detail consistency

| Field                     | Database/API source                                                                     | List display                                                                | Detail relationship and test                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Project ID                | `Project.id`; list also returns the ID.                                                 | Request reference if present, otherwise ID; encoded into both detail links. | Detail route uses the same ID; P22-WEB-001 checks URL and matching project heading.          |
| Project name              | `Project.name`.                                                                         | Title link and mobile card heading.                                         | Detail heading and brief; P22-WEB-001.                                                       |
| Description               | `Project.description`.                                                                  | Not shown and not searchable.                                               | Detail brief; P22-WEB-001 checks the selected project’s phrase.                              |
| Status                    | `Project.status`.                                                                       | Humanized text pill and status filter input.                                | Returned by detail; API ownership/lifecycle checks.                                          |
| Request/service/reference | Optional unique `Project.requestId` relationship to `ServiceRequest`; service relation. | Reference number fallback to project ID; service fallback “Project.”        | Detail response contains request/service projection. P22-WEB-001 checks reference/service.   |
| Progress                  | Work-plan tasks aggregated into `completedTasks`/`taskCount`.                           | Rounded integer percent and labeled progress meter.                         | Detail maps aggregate to `{completed,total}`. P22-WEB-001 checks 50% in list/detail fixture. |
| Deliverable count         | Related milestones filtered to sent-to-client and client-visible workflow files.        | Count and singular/plural label.                                            | Detail projects the actual visible deliverables; NEX-014 covers access.                      |
| Updated/start date        | `updatedAt` and `startDate`.                                                            | Localized last-updated date; start date is not shown.                       | Detail shows start date; list sorting uses update date.                                      |

The list API excludes `clientId` and `workPlan` from the response; it returns their safe aggregate effects. Response shape is typed, but the browser does not run a runtime schema validator against malformed JSON. Missing optional `request` is handled; malformed required nested fields are not established as safe by this audit.

## N. Progress and metrics

The API walks `workPlan.phases[].tasks`, counts records whose `status === "DONE"`, and returns `completedTasks` and `taskCount`. The list computes `round(completedTasks / taskCount * 100)`, returns 0 when task count is zero, and caps the result at 100. The metric is task completion, not status, milestones, deliverables, or workflow stages. The PGlite case verifies 2/3 tasks and the safe summary projection; P22-WEB-001 verifies the 50% display. The API task walk filters malformed phase/task containers to records; no negative-count case is meaningful for this count-based source.

The deliverables KPI sums `deliverableCount`, where the server counts only milestones in `SENT_TO_CLIENT` with a `clientVisible` workflow file. It is not a count of every milestone or every stored file.

## O. My Projects API contract matrix

| Method / endpoint       | Authentication and authorization                                                                   | Validation/query behavior                                                                                                                    | Response and applicable errors                                                                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/projects`     | `requireAuth`; active USER only in `listClientProjects`; ownership bound to authenticated user ID. | No query parser for search, filters, sort, page, `clientId`, `userId`, `projectId`, or `requestId`; foreign selector parameters are ignored. | 200 array, including `[]`; 401 unauthenticated/invalid/expired/revoked/inactive/deleted session; 403 active non-USER; 503 if auth middleware reports DB unavailable; generic 500 for unexpected server error. |
| `GET /api/projects/:id` | `requireAuth`; owner scope or qualifying active staff contributor scope.                           | `recordIdParam` validates the ID.                                                                                                            | 200 safe project detail; 400 invalid record ID; 404 missing/foreign/out-of-scope project; 401 invalid session.                                                                                                |

My Projects itself calls only the list endpoint. The detail page calls the second endpoint. Change-request, cancellation-request, brief, milestone, review, and file routes are separate detail/workflow contracts and are not list controls. List-level 409/422/404 responses are not part of the current endpoint contract. A browser 503/list-error path is covered through NEX-017; database-down 503 is source-defined but not separately exercised here.

## P. Database relationships and integrity

`Project.clientId` is a required foreign key to `User`; `requestId` is optional and unique to `ServiceRequest`; `workPlan` is optional JSON. Projects also relate to staff assignments, milestones, project change requests, project messages, and conversation reads. The list’s optional request projection returns request ID/reference and service name. Its deliverable count relation includes only client-visible shared files. The detail/conversation APIs enforce their own scope.

The list query uses a single `findMany` projection in a `RepeatableRead` transaction, ordered by `updatedAt DESC, id DESC`; it does not join staff or project conversations and cannot create duplicate project rows through those relations. Its lifecycle predicate includes started request-linked projects, or requestless projects whose status is not PLANNED. P22-API-001 uses isolated PGlite only. No schema, migration, or production database was changed.

## Q. Loading, error, empty, and recovery behavior

- **Loading:** `ClientTableSkeleton` labeled “your projects”; no project rows are rendered until the resource resolves.
- **Error:** an alert shows the request error or fallback “Couldn't load your projects.” There is no inline retry control. Reloading the route repeats the list request.
- **No projects:** “No projects yet” explains that an activated booked service appears here and offers “Book a service.”
- **No search/filter match:** “No projects match” explains that search/status can change; it has no action button.
- **Recovery:** the existing NEX-017 list/deliverable loading, empty, error, and reload test passed. Page error recovery is reload/navigation, not an explicit retry control.
- **Malformed response:** no runtime response validator is used. This audit verified the source-generated API shape and selected optional relationships, but did not inject malformed required fields.
- **Detail failure:** Page 13 and NEX-017 findings remain visible; this task did not alter their mocks or assertions.

## R. Cross-page navigation

The project title and eye action point to `/projects/[id]`; P22-WEB-001 opens the matching project, verifies its details, goes back, and confirms no non-GET `/api/projects` request occurred. The list’s header/empty actions lead to `/services`. Project detail may then link to shared deliverables and the project conversation. P13-002 and the project-conversation browser/API tests cover the matching project ID through Messages. NEX-014 covers client-visible deliverable/file authorization.

The accepted shared STAFF project-route browser case passes but stubs `/api/projects` as a successful empty array; P22-WEB-004 supplies the actual 403 case. The `Project Management separates project messages… at 1440px` compatibility case timed out on an ordinary click of “Archived conversations.” Its trace ends at that pointer click; Page 12 already records the shared search-field hit-target obstruction (G1/H1–H3). The same test at 390px passed. No force-click was used, and the Page 12 defect is not duplicated here.

## S. Accessibility and responsive design

The page exposes a named main landmark, H1 “My Projects,” a labeled search box, labeled filter/sort selects, a captioned table with screen-reader column headers, text status, labeled progress meters, accessible project links, numbered pagination navigation, `aria-current`, and a live `role=status` range summary. The intended mobile list has `role=list` and `aria-label="My projects"`; each card uses headings and definition-list labels. The ordinary keyboard search path passed. Visible focus styles are defined on project links and pagination controls.

At 1440px and 1280px the desktop table is visible. At 768px and 390px, the page has no document/body horizontal overflow, but the desktop table remains visible and the intended mobile list is hidden; its inner wrapper is horizontally scrollable and its table has `min-width: 920px`. All four screenshots are retained under the final browser artifacts. This is **P22-001 (APPLICATION_DEFECT)**. Source inspection found `@max-[900px]` container-query variants on the two `ClientRowTable` wrappers but no `@container` ancestor in the rendered My Projects tree, so those responsive variants do not activate. The normal browser regression demonstrates the outcome. No visual workaround or product-source change was made.

The test verifies page-level overflow and screenshot evidence; it does not claim exhaustive screen-reader testing or a full touch-target audit. Status colors have equivalent visible text.

## T. Existing regression coverage

| Test/source                                                                | Existing contract                                                                                                    | Page 22 result / gap                                                                                                                                                  |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/e2e/projects/client-project-workflows.spec.ts` NEX-017           | Client list/detail, brief and requests; deliverable review; list empty/error/reload; department-head request review. | Current list workflow reproduces APP-TABLE-001; deliverable failure feedback still fails as APP-DELIVERABLE-001; loading/error/reload and department-head cases pass. |
| `apps/web/e2e/projects/project-details-regression.spec.ts` P13-001/002/003 | Detail section navigation, project chat link, brief failure notice.                                                  | P13-001 and P13-003 remain failed as documented; P13-002 passes.                                                                                                      |
| `apps/web/e2e/projects/project-workspace.spec.ts`                          | Client milestone/conversation handoff; failed milestone retry; staff completion/reopen.                              | Selected desktop/mobile compatibility checks pass. This is not the My Projects list.                                                                                  |
| `apps/web/e2e/shared/project-pages-regression.spec.ts`                     | Mixed STAFF project route behavior.                                                                                  | Passes with a mocked empty 200 list; does not prove STAFF API access. P22-WEB-004 covers the actual 403.                                                              |
| `apps/web/e2e/project-conversations.spec.ts`                               | Scoped project message history, archive view, client access.                                                         | Selected tests pass except desktop archive pointer obstruction, already G1/H1–H3; 390px variant passes.                                                               |
| `apps/api/tests/project-workspace.test.ts` NEX-013/NEX-014                 | Owner list/detail, foreign denial, brief/request validation, deliverables and files.                                 | Seven selected parent/leaf tests pass in PGlite. Query-selector manipulation was not previously asserted.                                                             |
| `apps/api/tests/project-conversations.test.ts`                             | Project membership, deliverable cards, message paging, archive/read-only.                                            | Three tests pass in PGlite.                                                                                                                                           |
| `apps/api/tests/jwt-session.test.ts`                                       | Session expiration, revocation, deactivation/archive, permanent deletion.                                            | Eleven tests pass in PGlite.                                                                                                                                          |
| `apps/web/test/route-policy.test.mjs` within web unit suite                | USER/STAFF/STAFF_HEAD/ADMIN/SUPERADMIN route and navigation matrices.                                                | Passes; documents STAFF route allowance but not the list API mismatch.                                                                                                |

No standalone My Projects page spec existed before this task. No new API contract test was needed for ordinary owner listing/foreign detail because NEX-013/NEX-014 already cover them; the selector-parameter and exact response-projection gap justified P22-API-001.

## U. New Page 22 regressions

| Identity    | File                                                | Coverage                                                                                                                                | Result                                                                            |
| ----------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| P22-WEB-001 | `apps/web/e2e/projects/page-22-my-projects.spec.ts` | Summary values, bearer request, matching detail, browser back, no list mutation.                                                        | Pass.                                                                             |
| P22-WEB-002 | Same                                                | Search fields/normalization, status filters, both update sort orders.                                                                   | Pass.                                                                             |
| P22-WEB-003 | Same                                                | Page boundary controls and return to the earlier view.                                                                                  | Fails at final page-one project: APP-TABLE-001.                                   |
| P22-WEB-004 | Same                                                | STAFF route allowed while client-only list returns 403 alert.                                                                           | Pass; records P22-002 contract discrepancy.                                       |
| P22-WEB-005 | Same                                                | ADMIN and SUPERADMIN redirects to `/module`.                                                                                            | Both pass.                                                                        |
| P22-WEB-006 | Same                                                | Unauthenticated route redirects to `/login`.                                                                                            | Pass.                                                                             |
| P22-WEB-007 | Same                                                | Keyboard search, 1440/1280/768/390 widths, screenshots, overflow and mobile renderer.                                                   | Keyboard and no-overflow checks pass; mobile renderer assertions fail as P22-001. |
| P22-API-001 | `apps/api/tests/client-projects-access.test.ts`     | PGlite owner scoping despite foreign selectors; all list statuses, planned exclusion, aggregates, safe projection, unauthenticated 401. | Pass.                                                                             |

The first browser draft used a desktop-only heading locator for the responsive fixture; that Page 22 test locator was corrected to inspect the responsive output across both renderers. The final responsive failure is not that locator issue: the observed layout data is desktop table visible/mobile list hidden at both narrow widths. No accepted assertion was changed.

## V. Execution and defect classification

| Run                                                                  | Result                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New Page 22 browser spec                                             | 8 tests: 6 passed; P22-WEB-003 and P22-WEB-007 failed on the confirmed pagination and narrow-screen findings.                                                                                                                                                                                                         |
| Accepted NEX-017 list workflow, isolated                             | 1 failed at the expected Website launch link after clearing filters; APP-TABLE-001 reproduced.                                                                                                                                                                                                                        |
| Project/list/detail/deliverable/conversation compatibility selection | 16 tests: 11 passed, 5 failed. Failures: APP-TABLE-001; APP-DELIVERABLE-001; P13-001 missing detail navigation; P13-003 missing brief failure notice; and Page 12 G1/H1–H3 desktop archive pointer obstruction. P13-002, loading/error/reload, staff route, milestone and other selected compatibility checks passed. |
| P22-API-001                                                          | 1 passed, 0 failed/skipped, isolated PGlite.                                                                                                                                                                                                                                                                          |
| Project workspace NEX-003/NEX-013/NEX-014 selection                  | 7 passed, 0 failed/skipped, isolated PGlite (the parent run includes NEX-004/005/015/016 leaves).                                                                                                                                                                                                                     |
| Project conversation API                                             | 3 passed, 0 failed/skipped, isolated PGlite.                                                                                                                                                                                                                                                                          |
| JWT/session API                                                      | 11 passed, 0 failed/skipped, isolated PGlite.                                                                                                                                                                                                                                                                         |
| Web unit suite                                                       | 98 passed, 0 failed/skipped; includes route policy, project status contracts, and navigation.                                                                                                                                                                                                                         |
| Historical migration verifier                                        | Stops at known PW-149 title mismatch; no duplicates/unexpected identities; later mappings not reached.                                                                                                                                                                                                                |

**Defect register:**

| ID                                              | Severity / classification           | Evidence and state                                                                                                                                      |
| ----------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APP-TABLE-001                                   | Medium — `APPLICATION_DEFECT`       | Existing `useLocalTable` stale-page restoration. Reproduced again by P22-WEB-003 and current NEX-017. Keep existing ID; no production fix.              |
| P22-001                                         | Medium — `APPLICATION_DEFECT`       | My Projects responsive breakpoint leaves the desktop table visible and mobile list hidden at 768px/390px. P22-WEB-007 screenshots and trace; preserved. |
| P22-002                                         | Unresolved — `CONTRACT_DISCREPANCY` | STAFF is allowed at `/projects` but `GET /api/projects` is USER-only and returns 403. No record leak; clarify route ownership.                          |
| G1/H1–H3                                        | Existing — `APPLICATION_DEFECT`     | Shared Messages Archived conversations pointer obstruction; repeated in the 1440px project conversation case. Page 12 finding; no duplicate ID.         |
| P13-001, P13-003 / NEX-017, APP-DELIVERABLE-001 | Existing — `APPLICATION_DEFECT`     | Detail section navigation and brief/deliverable error notifications remain as previously documented and were not modified.                              |

The initial Page 22 API and browser launch attempts hit Windows `spawn EPERM`; the same checks were rerun with local process access and completed. They are environment setup failures, not test/product failures. The initial responsive locator mistake was corrected in the new Page 22 test. No existing accepted test was corrected or bypassed.

## W. Preservation, quality gates, and changed files

The final discovery log confirms the new Page 22 file and the updated test count. The accepted baseline inventory and earlier tests remain unchanged. The legacy verifier limitation is explicit in C; its PW-149 stop is not presented as a global pass.

Required quality gates and final checks are retained in the evidence directory:

- `pnpm format` — exit 0; new test files were unchanged, and the report was formatted.
- `pnpm lint` — exit 0 (`eslint . --max-warnings 0`).
- `pnpm typecheck` — exit 0 for web and API; API Prisma client generation completed without schema changes.
- `git diff --check` — exit 0; final branch and HEAD match the initial baseline.
- Fresh final discovery — 526 tests in 73 files, retained in `final-discovery.log`.
- Test logs, PGlite TAP output, browser screenshots, traces, historical verifier output, and `final-verification-summary.md` — `test-results/phase7/page-by-page/page-22-my-projects/`.

The only new worktree files are:

- `apps/web/e2e/projects/page-22-my-projects.spec.ts`
- `apps/api/tests/client-projects-access.test.ts`
- `docs/testing/verification/phase7/page-by-page/page-22-my-projects.md`

The evidence directory is ignored test output. No accepted Page 1–21 test was modified, no historical assertion was weakened, no test was removed or newly skipped, and no production frontend/backend source, Prisma schema/migration, dependency manifest, or lockfile was modified. No commit, push, merge, rebase, reset, or branch switch occurred. Page 23 and Phase 7.5 were not started.

## X. Final recommendation

**Ready for administrative review with open findings.** The page source, list API, owner isolation, role behavior, status lifecycle, filters, sorting, pagination, progress, projections, empty/error states, navigation, accessibility markup, responsive layout, and relevant compatibility were inspected and recorded. The API/unit coverage passed. Browser failures reproduce APP-TABLE-001 and P22-001, while cross-page failures remain the previously recorded Page 12/13/23 findings. P22-002 is an unresolved STAFF route/API contract discrepancy.

No production behavior was changed. Keep the Page 22 regressions and their evidence intact for administrative review, then stop at Page 22.

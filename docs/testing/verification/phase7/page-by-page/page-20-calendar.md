# Phase 7.4.1 — Page 20: Calendar

## A. Overall status and scope

**Recommendation: ready for administrative review with one confirmed application defect open.** The Calendar is a read-only, role-aware schedule assembled from workflow and project records. It does not create or edit calendar events. Page 20 adds four browser regressions, one web unit regression, and three isolated API regressions. Browser and compatibility coverage passes; two API assertions intentionally fail because both linked appointment validators accept an impossible Gregorian date. No production fix is included.

The audit covered /calendar, its event and filter controls, /api/projects/calendar, source records, scheduling workflows, Staff Workload reuse, Attendance boundaries, accessibility and responsive behavior, and historical regression preservation. Work stopped at Page 20 as requested.

## B. Git baseline and working tree

- Branch: 219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages.
- HEAD: 577e81652065229615ae3b3f9314dd8d65558eb0, the accepted Page 19 Billing Logs commit.
- Before changes the working tree was clean and tracked the matching origin branch. git diff --check passed, and no MERGE_HEAD was present.
- Recent history at baseline: Page 19 Billing Logs, Page 18 Settings, Page 17 Profile, the development integration merge, and Page 16 Staff Workload.
- Initial Playwright discovery: **502 tests in 70 files**, matching the Page 19 checkpoint.
- The initial baseline evidence is in test-results/phase7/page-by-page/page-20-calendar/initial-*.log.

## C. Historical regression preservation

The approved historical inventory is 292 original Playwright identities, 1,630 original assertion sites, 4,211 preservation mappings, and five intentionally skipped live-backend cases. Page 20 adds four Playwright cases in one new spec file. The pre-existing calendar spec remains unchanged. No Page 1–19 tests, accepted assertions, skip states, or preservation artifacts were edited or removed.

The final historical verifier run stopped at its known PW-149 identity/title mismatch: the baseline expects “duplicate email registration displays inline server error alert,” while the current test title differs. It reported no duplicate or unexpected identity. The run did not reach later mappings; no complete mapping pass is claimed. PW-037 and PW-001 remain documented historical discrepancies and were not independently reconciled. All previously recorded Page 1–19 issues remain in the historical reports; this Page 20 report preserves the prompt’s specific references below without claiming they were re-tested:

- Registration contact truncation and malformed-response token storage.
- Services pricing limit mismatch and stale pagination.
- Request Inbox missing decline/delete endpoints.
- Booked Services reference projection and waiting-state discrepancy.
- Messages archive pointer obstruction and archive contract question.
- Project Details navigation/notification findings.
- NEX-006 inaccessible workspace wizard.
- Workspace Details 404/loading issue and 50-task limit bypass.
- S16-001 Staff Workload search pagination defect.
- Profile Unicode URL normalization failure.
- Settings intermittent timeout and contract questions.
- P19-001 Billing Logs hard-coded demo-row details.
- Existing request-workflow API-TEST-001 fixture failure.

## D. Source inspection and dependency matrix

The actual route is apps/web/src/app/(portal)/calendar/page.tsx, which renders the feature page. The API is mounted under /api/projects and the Calendar handler is registered as GET /api/projects/calendar. No Calendar event table or migration exists.

| File or module                                                                                                 | Responsibility and Calendar behavior                                                                           | API/database boundary                                     | Related coverage                                                   |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------ |
| apps/web/src/app/(portal)/calendar/page.tsx                                                                    | /calendar route entry                                                                                          | None                                                      | Role route policy and browser tests                                |
| apps/web/src/features/calendar/pages/calendar-page.tsx                                                         | Fetches/sorts events; month state, date selection, filters, agenda, retry, refresh-on-focus, links and summary | GET /api/projects/calendar                                | Calendar E2E and new Page 20 browser tests                         |
| apps/web/src/features/calendar/model/calendar.ts                                                               | Event type, completion/overdue label, strict shared-staff overlap calculation                                  | None                                                      | apps/web/test/calendar.test.mjs and new boundary unit              |
| apps/web/src/components/ui/calendar.tsx                                                                        | Month grid, date buttons, today/previous/next controls, keyboard navigation                                    | None                                                      | Calendar E2E and Page 20 date cases                                |
| apps/web/src/features/auth/model/permissions.ts; apps/web/src/features/workspaces/model/route-policy.ts        | Calendar menu and route permission for portal roles                                                            | None                                                      | Route-policy and workspace characterization tests                  |
| apps/api/src/features/projects/projects.controller.ts; route setup in apps/api/src/app.ts                      | Authenticated Calendar endpoint, query parsing, response selection                                             | Request auth; controller calls client or internal service | apps/api/tests/calendar.test.ts; new PGlite test                   |
| apps/api/src/features/projects/calendar.service.ts                                                             | Internal event aggregation, organization/team/mine scopes, stable event IDs and projections                    | Prisma consultations, meetings, projects and milestones   | Calendar PGlite test                                               |
| apps/api/src/features/projects/client-calendar.service.ts                                                      | Client-owned consultation/meeting/shared-milestone projection                                                  | Prisma owner-linked workflows and projects                | Existing Calendar API coverage; new PGlite isolation test          |
| apps/api/src/features/projects/calendar.queries.ts                                                             | Shared source filters and appointment period/scheduled-only query helpers                                      | Prisma filters                                            | Calendar and Workload API tests                                    |
| apps/api/src/features/request-conversations/conversation-meetings.validation.ts and meeting service/controller | Meeting schedule and lifecycle validation outside Calendar                                                     | Conversation, meeting and booking relations               | Request-conversations API and browser tests; new parser regression |
| apps/api/src/features/request-workflow/workflow.validation.ts and workflow service/controller                  | Consultation lifecycle validation outside Calendar                                                             | Request workflow and consultation relations               | Request-workflow API and browser tests; new parser regression      |
| apps/api/src/features/workload/workload-availability.service.ts                                                | Weekly busy-time projections from the shared queries                                                           | Prisma schedules plus attendance policy context           | apps/api/tests/features/workload/availability.test.ts              |
| apps/api/prisma/schema.prisma and migrations                                                                   | Existing consultation, meeting, project, milestone, workflow relations                                         | DateTime columns are TIMESTAMP(3) in migrations           | PGlite API suites                                                  |
| docs/features/calendar.md                                                                                      | Calendar contract and role overview                                                                            | Describes the same aggregate source model                 | Source-to-document comparison                                      |

The feature documentation dated 2026-11-10 agrees with the current read-only role-aware aggregate, supported event types, links, and retry behavior. Source has no event CRUD, date-range query, pagination, or synchronization endpoint.

## E. Supported functionality inventory

| Feature                                | Roles and behavior                                                                                                                                                                                        | Persistence/API                                                               | Coverage and limitation                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Month overview and selected-day agenda | All four portal roles; month grid, selected-day events, and three upcoming entries                                                                                                                        | Read-only aggregate GET                                                       | Existing role/viewport browser cases; new leap-day and keyboard cases        |
| Month navigation and Today             | Previous month, next month, Today, click a date                                                                                                                                                           | Local page state only                                                         | Existing and new browser coverage                                            |
| Event types                            | Consultation, meeting, shared milestone, task deadline                                                                                                                                                    | Existing workflow/project records                                             | Internal scopes may include tasks; client scope has no tasks                 |
| Role-aware filters                     | Internal staff may select mine/team when authorized; internal views support event type and project; ADMIN/SUPERADMIN additionally get department and staff filters; USER sees a consultation link instead | The API only receives the internal scope; remaining filters run in the client | Existing E2E covers role/filter behavior; no server-side filtering or paging |
| Event status and conflict summary      | Completion/overdue tags, unassigned upcoming consultations, overlapping future appointments with shared staff                                                                                             | Computed from returned events                                                 | Existing unit and API coverage; warnings are informational                   |
| Workflow navigation                    | Accessible meeting/consultation to Messages; shared milestone to Project; internal task/milestone to the accessible Workspace                                                                             | Existing workflow/project routes                                              | Appointment scheduling and rescheduling remain in those workflows            |
| Join meeting                           | For an eligible upcoming meeting, exposes an external join action only for HTTPS URLs without embedded username/password                                                                                  | No Calendar write                                                             | New browser case verifies accepted HTTPS target and rejects unsafe URL cases |
| Retry and automatic refresh            | Retry after a failed read; reload when the tab becomes visible/focused; periodic clock refresh updates date/time labels                                                                                   | Read-only GET, guarded against duplicate in-flight refresh                    | New browser test verifies retry and selected-day retention                   |
| Consultation entry point               | USER gets a link to /services                                                                                                                                                                             | Booking continues through the existing service-request workflow               | Calendar itself does not create a consultation                               |

Unsupported in this page: week/day/agenda view selector, date picker, search, status filter, server-side date range, manual refresh control, event creation/edit/cancel/delete, drag-and-drop, recurrence, calendar sync, and event mutation dialogs.

## F. Interactive control inventory

| Control                      | Visibility/eligibility                                                   | Handler and result                                                                                                           | API effect and coverage                                   |
| ---------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Previous month / Next month  | All roles                                                                | Changes displayed month; selection follows grid behavior                                                                     | No API call; existing and Page 20 month-boundary coverage |
| Today                        | All roles                                                                | Sets visible month and selected date to current Manila date                                                                  | No API call; existing calendar cases                      |
| Calendar date buttons        | All roles                                                                | Select a day; accessible label includes date and event titles; keyboard arrows, Home/End and PageUp/PageDown move focus/date | No API call; Page 20 leap-day and year-boundary tests     |
| Calendar scope selector      | Internal roles only when the response grants team view                   | Switches mine/team and reloads scoped events                                                                                 | GET with scope=mine or team; existing role/filter test    |
| Event type / project filters | Internal roles                                                           | Client-side list/grid filtering                                                                                              | No new API request                                        |
| Department / staff filters   | ADMIN/SUPERADMIN organization view                                       | Client-side filtering                                                                                                        | No new API request                                        |
| Clear filters                | Where internal filters are shown                                         | Resets active filters                                                                                                        | No API request; existing test                             |
| Event row link               | Only if backend supplied an authorized href                              | Opens existing message, project, or workspace page                                                                           | No Calendar write; existing workflow-link test            |
| Join meeting                 | Only when an event is eligible, has an end and has a safe HTTPS location | Opens a new tab with noopener/noreferrer                                                                                     | No Calendar write; P20-WEB-004                            |
| Book a consultation          | USER                                                                     | Opens /services                                                                                                              | No direct Calendar request/mutation                       |
| Try again                    | Error state                                                              | Retries the Calendar GET and retains the selected date                                                                       | P20-WEB-003                                               |

There are no save/cancel or duplicate-submission controls on Calendar because it has no write action. The page does not offer a manual refresh button; refresh-on-focus/visibility is automatic.

## G. Date and time contract

| Data                   | Source/stored representation                                                     | Calendar display/interpretation                      | Validation                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Consultation start/end | Prisma DateTime instants; API JSON ISO timestamps                                | Manila date grouping and Manila time labels          | Workflow parser requires a date-time prefix and finite Date.parse; it accepts zone-less timestamps and normalizes to ISO |
| Meeting start/end      | Prisma DateTime instants; API JSON ISO timestamps                                | Manila date grouping and Manila time labels          | Meeting parser requires explicit Z or numeric offset and finite Date.parse; impossible Gregorian dates are not rejected  |
| Task due date          | Work-plan JSON YYYY-MM-DD date-only value; service constructs midnight at +08:00 | Due day in Manila; no appointment time or end        | Work-plan write validation round-trips calendar dates; read projection structurally parses stored plan values            |
| Shared milestone       | Existing sentToClientAt timestamp                                                | Manila date/time; event means deliverable was shared | No separate milestone due date is modeled for Calendar                                                                   |
| Selected/today date    | YYYY-MM-DD derived by Intl.DateTimeFormat                                        | Hard-coded Asia/Manila                               | Browser tests use fixed clock                                                                                            |
| API response ordering  | ISO start timestamps                                                             | Ascending start time                                 | Backend and client both sort; no paging                                                                                  |

The database migrations use TIMESTAMP(3) columns without a timezone type. API dates serialize as UTC instants, and the UI applies Manila display conversion. The page groups an event by its start date; it does not draw a multi-day span. End times support appointment display, eligibility, and conflict calculations.

## H. Timezone and boundary verification

- New deterministic browser coverage fixes time at 2032-02-29 16:00Z, exactly March 1 at midnight in Manila. It verifies events immediately before and after that boundary land on the correct day; a 23:45-to-00:15 appointment remains associated with its start day.
- The same case checks leap-day navigation and a 390px viewport. A screenshot is stored under the Page 20 evidence directory.
- A pure unit regression checks task deadline status at the last millisecond of Manila leap day, midnight at the next Manila day, and the following day.
- PageUp from January 2031 crosses to December 2030, preserves keyboard focus on the corresponding day, and Enter selects it.
- The month grid uses Monday-first weeks, includes adjacent-month days, and renders six rows. Calendar itself has no week-range calculation; Staff Workload has a separate seven-day half-open weekly range.
- The supported Calendar timezone is hard-coded Asia/Manila, which does not currently require DST transition handling. There is no per-account timezone preference in this page and no user-provided timezone identifier to validate.
- Browser calendar fixtures are mocked; PGlite verifies that stored appointment instants serialize to their exact ISO values. No live database or multi-timezone deployment was exercised.

## I. Authentication and authorization

| Actor/session                                    | Route              | Calendar read scope                                                                                | Mutation from Calendar | Result                                                                                  |
| ------------------------------------------------ | ------------------ | -------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------- |
| Unauthenticated, expired/revoked/invalid session | Portal route / API | No data                                                                                            | None                   | Shell/API authentication denies access; API uses 401                                    |
| USER, active                                     | Allowed            | Own consultations, own conversation meetings, and explicitly shared milestones; no internal tasks  | None                   | API returns a plain event array; foreign query scope/clientId do not expand visibility  |
| STAFF, active                                    | Allowed            | Assigned dated tasks, eligible project milestones, and appointments under current head/team scopes | None                   | Default mine; team scope requires current head/project lead/team lead authorization     |
| ADMIN, active                                    | Allowed            | Organization event metadata and organization filters                                               | None                   | Sensitive meeting location/workflow links are projected only when separately authorized |
| SUPERADMIN, active                               | Allowed            | Organization event metadata and organization filters                                               | None                   | Same independent workflow-link restriction as ADMIN                                     |
| Inactive/deleted account                         | Portal route / API | No data                                                                                            | None                   | Authentication/session middleware denies; API inactive-account case returns 401         |

Current department-head status is rechecked by the backend. A staff role or membership alone does not grant access to unrelated project workspaces or private conversations. Ordinary project membership does not create an arbitrary meeting invitation; the current meeting model uses a department head as the known internal attendee. Admin overview access does not grant workspace/message access. The new PGlite test sends hostile scope and clientId query values for each of two clients and verifies each sees only its own consultations and meetings.

The Calendar endpoint is read-only. Mutation permissions in the linked meeting and consultation workflows are enforced by those workflow endpoints, not by Calendar.

## J. API contract matrix

| Method and route           | Authentication                                            | Input and validation                                                                                                          | Scope and response                                                                                                               | Supported errors                                                                                                                                       |
| -------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET /api/projects/calendar | Required Bearer/session authentication on projects router | Optional internal scope=mine or team; invalid scope rejected. No date range, type, status, paging, clientId, or sort contract | USER receives an array of own events. Internal roles receive { events, canViewTeam, organization }; events are ordered ascending | 401 unauthenticated/inactive; 400 invalid scope; 403 unauthorized team scope or forbidden non-client access. No Calendar-specific 404/409/422 contract |

The endpoint has no create/update/delete or event-detail route. Query parameters for date range, event type, status, pagination, and client override are not Calendar inputs. clientId is ignored by the client path. The client consumes the Calendar API as read-only. A 500 is exercised only as a mocked front-end retry state, not as a claim about a special backend 500 contract.

Related scheduling APIs are not Calendar endpoints:

- Meetings use the request-conversation meeting routes for creation, reschedule request/response, keep schedule, completion, and cancellation. They validate an explicit timezone suffix, future time, positive interval, and maximum eight-hour duration; actions use version/state checks and client action IDs. Existing API tests cover access and idempotency; overlap is not a blocking rule.
- Consultations use request-workflow actions to schedule, request/respond to reschedule, complete, or cancel. Current UI submits ISO values with Z; the parser currently accepts zone-less values too. Existing API/browser tests cover the lifecycle and reschedule.

## K. Event data integrity and persistence

Calendar aggregates existing records:

1. WorkflowConsultation linked through RequestWorkflow and ServiceRequest.
2. ConversationMeeting linked to RequestConversation, optionally with booking relations.
3. Dated tasks from a project work-plan JSON document.
4. ProjectMilestone.sentToClientAt for milestones already shared with a client.

The internal service applies current role, department/head, project assignment/team-lead and project status scopes. Cancelled appointments and cancelled projects are excluded. The client service restricts consultations and meetings through the authenticated client’s own workflow/conversation and only projects already shared with that client. The client milestone query requires a project start date as well as a milestone send timestamp.

Event IDs include the event kind and record identity, avoiding cross-source ID collision. Appointment time and status come from the source row; task dates come from work-plan entries; milestone dates mean shared-at time, not a fabricated due date. Client meeting/consultation context comes from the linked booking/conversation. Internal organization responses can include department, staff, and project metadata while hiding unavailable workflow URLs and private meeting locations.

The endpoint performs reads only. P20-API-001 snapshots consultation and meeting rows before and after both client reads and confirms no row, status, location, version, or time changed. No new event persistence table is implied.

## L. Scheduling conflict behavior

The browser model reports conflicts when two unfinished timed events are still in the future, have strict interval overlap, and share at least one staffMembers ID. Adjacent intervals do not conflict. Events without an end time, completed events, and events ending at or before now are excluded. Calendar’s summary is informational; it does not block scheduling.

The API query excludes cancelled events. Meeting and consultation write services validate time ordering, future scheduling, maximum duration, state and authorization but do not reject overlaps. Consequently, same-time requests may be accepted; Calendar may later surface an overlap if both use the same known staff member. Different known staff IDs do not conflict. Since the models do not represent arbitrary attendee rosters, the audit does not infer attendance for all project employees.

Existing Calendar unit tests cover overlap only for shared assignees, adjacent appointments, and completed records. Staff Workload PGlite tests cover current-head commitments, cancellation/completion treatment and strict overlaps.

## M. Mutation validation

There are no Calendar mutations or editable fields, so Calendar-specific create/edit/delete boundary tests would be fictitious and were not added. Calendar makes no write request for navigation, filtering, event selection, or join-link use.

The linked meeting and consultation workflows are tested at their actual endpoints. They enforce future start, end after start, an eight-hour maximum for a scheduled meeting/consultation, recognized workflow state and authorized participants. Meeting actions include optimistic version/state checks and idempotency identifiers. Neither scheduling path has an overlap rejection rule. The Page 20 API regressions call pure parsers only for the impossible-date cases and do not issue a mutating meeting/consultation request.

## N. Event lifecycle and persistence

Appointments follow their existing consultation/meeting status lifecycle outside Calendar: scheduled, completed, or cancelled; meeting reschedule also has a pending proposed time/version state. Calendar displays completed state, omits cancelled events, and can mark a meeting as pending reschedule while retaining its confirmed schedule. It does not change source rows on display.

Consultation lifecycle actions are part of request workflow; meeting lifecycle actions are part of request conversation. Transaction, actor access, notifications and state updates belong to those services. The Calendar refreshes on focus/visibility and can be retried manually after a read failure; it does not synchronously mutate its own cache in response to workflow actions.

Tasks are read from project work-plan JSON; completion comes from task state. Milestones use their existing sentToClientAt and completedAt timestamps. No recurring calendar record or calendar-owned soft-delete state exists.

## O. Staff Workload integration

Staff Workload imports the same Calendar query helpers. It asks for current-head appointment commitments over a half-open weekly interval [weekStart, weekStart + 7 days), with scheduled-only filtering. Calendar can retain completed history for display, while workload commitments omit completed and cancelled appointments. The known department head is the meeting/consultation participant; project employees are not inferred as attendees.

Existing PGlite availability tests pass 6/6, covering policy-effective dates, current-head busy times, strict overlap, completed history, cancellation and the distinction between planning and actual clock hours. The Page 16 defect S16-001 remains untouched.

## P. Attendance integration

Calendar does not import or query attendance policies, schedules, clock-ins, adjustments, or attendance records. Its entries describe appointments, milestones and tasks. Staff Workload may use HR attendance policy as planning context, but its tests keep policy requirements and actual clock sessions distinct from known Calendar commitments. Calendar does not treat a policy or clock entry as proof of meeting attendance or employee availability.

The attendance-related Page 1–19 regression coverage and fixtures were not modified. No live Attendance compatibility workflow was run for Page 20; the boundary was verified from source and the PGlite Workload availability suite.

## Q. Cross-module workflows and navigation

The portal route policy and sidebar expose Calendar to all four roles. Calendar event links preserve existing resource identifiers:

- A client consultation or service meeting opens Messages with its request/conversation identifier when access is already allowed.
- A shared client milestone opens the project.
- An internal task or milestone opens the matching project workspace when that actor has workspace access.
- Admin/Superadmin organization metadata does not grant a workspace or conversation link.
- The eligible safe meeting URL opens in a new tab with noopener/noreferrer.
- A USER’s Book a consultation entry goes to Services and continues through the existing request workflow.

Calendar does not carry a selected date into another module or accept an event ID in its URL. No inbound cross-page selected-event path was found. Existing meeting and consultation reschedule browser compatibility checks passed in mocked browser runs.

## R. Loading, errors, empty states, and recovery

The page starts in a loading state, then renders the month/event data or an empty message. Failed reads clear stale events, show an alert and a Try again action; selected date and displayed month remain in local state. Focus/visibility refresh is automatic and prevents overlapping requests.

P20-WEB-003 injects an initial HTTP 500 response, confirms the alert and selected-day unavailable message, retries, then confirms the recovered event appears on the same selected date, the request count is two, and the retry control disappears. This is mocked front-end recovery evidence, not a live 500 response test.

## S. Accessibility and responsive behavior

The month grid exposes a named grid and date buttons with full accessible date/event labels. Today is marked; selected-day heading updates through a polite live region. Arrow keys move by day/week, Home/End move within the week, PageUp/PageDown change month, and Enter selects. Error content uses an alert role; event links have descriptive labels. Safe external links declare target=_blank and rel=noopener noreferrer.

The existing browser suite covers STAFF, ADMIN, SUPERADMIN and USER at 1440px and 390px and checks mobile horizontal overflow. New P20-WEB-001 adds a 390px leap-day screenshot and checks the document width; all four new browser cases passed. Browser tests use mocked Calendar responses.

## T. Existing regression coverage and identified gaps

- apps/web/e2e/calendar.spec.ts: eight browser cases across four roles and desktop/mobile widths; role-specific controls, filters, task detail navigation and overflow.
- apps/api/tests/calendar.test.ts: one PGlite top-level scenario covering internal scope, current head/team, project assignments, task/status filtering, ADMIN/SUPERADMIN metadata and client ownership.
- apps/web/test/calendar.test.mjs: two unit cases for Manila deadline boundaries and shared-staff conflict behavior.
- apps/web/test/route-policy.test.mjs and workspace access characterization: role route matrix.
- apps/api/tests/features/workload/availability.test.ts: six PGlite availability cases.
- apps/api/tests/request-conversations.test.ts: 12 API tests including meeting lifecycle, participant scope, idempotency/version and state transitions.
- Existing Messages and Request Workflow browser tests cover meeting scheduling and consultation rescheduling.

Material gaps addressed in Page 20: precise leap-day/Manila boundary behavior, keyboard year rollover, recovery without losing selected date, unsafe meeting URL filtering, client query-parameter ownership isolation, and impossible date parser behavior.

Remaining limits: full dataset retrieval without API period/pagination; no live database was used; no timezone override exists; no real external meeting provider was contacted; Attendance compatibility is source and PGlite based; no Calendar mutation exists to test.

## U. Page 20 additions and execution results

New test files:

- apps/web/e2e/calendar/page-20-regression.spec.ts — four Playwright cases:
  - P20-WEB-001 Manila midnight/leap day and mobile layout.
  - P20-WEB-002 keyboard month/year rollover and Enter selection.
  - P20-WEB-003 error recovery retains selected day.
  - P20-WEB-004 permits a safe HTTPS join URL and rejects non-HTTPS/credentialed URLs.
- apps/web/test/calendar-regression.test.mjs — one deterministic task status boundary case.
- apps/api/tests/calendar-regression.test.ts — P20-API-001 client data isolation/read-only persistence, P20-API-002 meeting impossible-date validation, and P20-API-003 consultation impossible-date validation.

Execution evidence and results:

| Run                                                                           | Result                                                                                                          |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Initial full Playwright discovery                                             | 502 tests in 70 files                                                                                           |
| Final full Playwright discovery                                               | 506 tests in 71 files                                                                                           |
| Existing Calendar API/PGlite                                                  | 1 passed                                                                                                        |
| New API regressions                                                           | P20-API-001 passed; P20-API-002 and P20-API-003 failed as intended and reproduce P20-001                        |
| New web unit boundary                                                         | 1 passed                                                                                                        |
| Full web unit suite                                                           | 98 passed, 0 failed                                                                                             |
| Workload availability PGlite                                                  | 6 passed, 0 failed                                                                                              |
| Meeting/conversation API suite                                                | 12 passed, 0 failed                                                                                             |
| Existing Calendar + first new browser run                                     | 11 passed, 1 new-test locator failure; all eight existing cases passed                                          |
| Corrected Page 20 browser spec, isolated                                      | 4 passed, 0 failed                                                                                              |
| Meeting schedule/reschedule and consultation reschedule browser compatibility | 6 passed, 0 failed                                                                                              |
| Full request-workflow PGlite suite                                            | 16 passed, one known fixture leaf failed; TAP also reports the enclosing suite as failed (18 TAP records total) |
| Final combined existing Calendar + Page 20 browser run                        | 12 passed, 0 failed                                                                                             |

The full request-workflow failure is the pre-existing API-TEST-001 fixture assumption that a project has a first milestone (milestones[0].id) when the fixture has none. It is unrelated to Page 20 and the accepted test was not changed.

Two TEST IMPLEMENTATION DEFECTS were corrected only in the new Page 20 browser test: selected-day “Calendar unavailable” text also appears in the upcoming region, and the app-wide role=alert query also matched Next’s route announcer. The final test scopes these locators to the selected day and Calendar main region. The final combined 12-case run passes.

## V. Defects and contract questions

### P20-001 — Impossible Gregorian appointment dates normalize and pass validation

- **Severity:** P2.
- **Classification:** APPLICATION DEFECT.
- **Affected source:** apps/api/src/features/request-conversations/conversation-meetings.validation.ts and apps/api/src/features/request-workflow/workflow.validation.ts.
- **Reproduction:** Call either parser with startsAt 2032-02-30T10:00:00.000Z and endsAt 2032-02-30T11:00:00.000Z. JavaScript Date.parse normalizes the impossible date to March 1, 2032, so the validators accept a different appointment time than the submitted calendar date. Meeting constraints still see a future positive interval under eight hours.
- **Expected:** Reject a nonexistent Gregorian date with the established 400 validation error.
- **Actual:** Both parsers accept and normalize the date.
- **Regression identity/evidence:** P20-API-002 and P20-API-003 in api-calendar-regression.log; the test output states “Missing expected exception.” No mutating endpoint was called.
- **Status:** Open; preserved as failing regression. Production validation was not changed.

### P20-Q01 — Consultation timestamp timezone contract differs from meeting contract

- **Classification:** CONTRACT DISCREPANCY.
- Meeting validation requires Z or an explicit numeric offset. Consultation validation accepts any YYYY-MM-DDT... string that Date.parse can parse, including timestamps without an offset. Current front-end scheduling controls serialize to ISO with Z, so no present UI regression was reproduced.
- Clarify whether zone-less consultation timestamps are intentionally server-local or should use the meeting API’s explicit-offset contract. Do not silently claim both APIs have the same timezone contract.

### Test implementation corrections — resolved

- **Classification:** TEST IMPLEMENTATION DEFECT.
- **Affected source:** apps/web/e2e/calendar/page-20-regression.spec.ts only.
- **Evidence:** First combined attempt exposed duplicate selected-day/upcoming text; the next attempt exposed an app-wide alert locator matching both the Calendar error and Next route announcer. The new test was scoped to the selected day and main region and the final combined suite passed 12/12.
- No application behavior or accepted Page 1–19 test was changed.

### Intentional design limitations, not defects

The page has no date range or pagination parameters, and all accessible events are loaded then filtered in the browser. Calendar overlap markers are informational and scheduling endpoints do not block overlaps. Neither is classified as a defect without a changed product contract.

## W. Quality gates and preservation evidence

| Gate                        | Result                                            | Evidence                       |
| --------------------------- | ------------------------------------------------- | ------------------------------ |
| pnpm format                 | PASS; final Prettier run left all files unchanged | quality-format-final.log       |
| pnpm lint                   | PASS                                              | quality-lint-final.log         |
| pnpm typecheck              | PASS for web and API                              | quality-typecheck-final.log    |
| git diff --check            | PASS (exit 0; no output)                          | quality-diff-check.log         |
| New Page 20 file whitespace | PASS; no trailing whitespace                      | new-files-whitespace-check.log |

The standard pnpm launcher initially reported access denial opening the package-manager engine lock under user AppData, outside the writable workspace. The required commands later passed with the reviewer-authorized pinned pnpm launcher. The final historical verifier ran unchanged and stopped at the known PW-149 mismatch with no duplicate or unexpected identity. It did not reach later mappings; PW-037 and PW-001 remain historical limitations, not passing checks.

## X. Files, evidence, and final recommendation

Authorized Page 20 source additions are limited to:

- apps/api/tests/calendar-regression.test.ts
- apps/web/test/calendar-regression.test.mjs
- apps/web/e2e/calendar/page-20-regression.spec.ts
- This report: docs/testing/verification/phase7/page-by-page/page-20-calendar.md
- Evidence artifacts under test-results/phase7/page-by-page/page-20-calendar/

The evidence directory contains baseline status/discovery, final 506/71 Playwright discovery, API/PGlite logs, web unit logs, browser logs, compatibility logs, quality-gate output, historical verifier output, a leap-day mobile screenshot, and four successful trace archives from the trace-enabled Page 20 browser run. The verifier log shows the known PW-149 stopping point; it does not claim later mapping verification.

No accepted Page 1–19 test was modified without authorization. No historical assertion was weakened. No test was removed or newly skipped to conceal a defect. No production frontend or backend source changed. No Prisma schema or migration changed. No commit, push, merge, rebase, reset, or branch switch occurred. Page 21 and Phase 7.5 were not started.

**Recommendation:** retain P20-001 as an open validation defect for administrative review. The Page 20 audit, tests, report, and quality gates are complete; the historical verifier limitation is explicit. Stop here pending review.

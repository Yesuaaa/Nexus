# Phase 7.4.1 — Page 13: Project Details (`/projects/[id]`)

**Review status:** Complete with verified defects  
**Administrative status:** Awaiting review; Codex cannot accept the page  
**Scope:** Source audit and regression tests only. No application, API, schema, or database behavior was changed.

## A. Page status

The 23-page handoff identifies Page 13 as Project Details at `/projects/[id]`. This audit is **COMPLETE WITH VERIFIED DEFECTS**. Three new browser cases were added; one passes and two retain verified Page 13 failures. Existing PGlite coverage verifies ownership, request writes, deliverable reviews, and file isolation. Selected project compatibility coverage also passed. No production or live-backend integration was performed.

Confirmed findings:

- Client project section views have no visible navigation controls. The route supports `overview`, `deliverables`, `notes`, and `team`, and a component defining links for these views exists, but that component is not mounted. Direct query-string navigation still works.
- The client project brief failure notification is not presented when the API returns an error (NEX-017).
- The linked Page 23 deliverable review failure notification remains absent (APP-DELIVERABLE-001).
- The existing NEX-017 list-to-detail browser flow also reproduces stale pagination in the separate `/projects` list (Page 22). Page 13’s detail component does not use the table hook.

## B. Git baseline

| Item     | Initial                                                                                            | Final                                                                                                        |
| -------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Branch   | `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages` | Same                                                                                                         |
| HEAD     | `ad8c3e70c0b0ef38101a66093648f4f6e9b1cae6`                                                         | Same                                                                                                         |
| Worktree | Clean                                                                                              | Only the new Page 13 spec and this report are untracked source changes; execution evidence is ignored by Git |

The Page 13 prompt cited an older expected HEAD (`86cd59d…`); the checked-out branch and actual `ad8c3e7` HEAD were retained. No branch or history operation occurred.

## C. Source inspection

Reviewed the 23-page regression handoff, new-chat handoff, Phase 7 failure investigation, Phase 6 approved deltas, Pages 9–12 reports, and the project/workspace characterization documentation. Source inspection covered:

- Route/access: `apps/web/src/app/(portal)/projects/[id]/page.tsx`, `features/projects/pages/project-access-page.tsx`, auth permissions, route policy, and portal routing.
- Client UI: `features/projects/pages/client-project-page.tsx`, `client-projects-page.tsx`, `client-project-sidebar-links.tsx`, and `client-project-forms.tsx`.
- Staff UI: `features/projects/pages/project-page.tsx` and its project/change-review dialog components.
- Client API: `features/projects/api/projects-api.ts`.
- Backend: `apps/api/src/features/projects/projects.controller.ts` and `projects.service.ts`; related lifecycle operations in `project-workspace.service.ts` and `request-workflow/workflow.service.ts`.
- Related messaging and deliverable routes: project-conversation API/UI and `/projects/[id]/deliverables/[milestoneId]`.
- Persistence and validation: `apps/api/prisma/schema.prisma` and `apps/api/src/shared/validation.ts`.
- Regression: project workflow, project workspace, shared project-page, project-conversation, and PGlite project-workspace suites.

The dynamic route awaits `params` and `searchParams`; it does not validate the ID in the Next.js page. It normalizes `tab` to the four supported client views, defaulting unknown values to `overview`, and remounts on project/tab changes. The API validates route record IDs and returns 400 for malformed IDs. Missing, foreign, or out-of-scope project reads are hidden as 404 by the service. The client UI has loading and error states and links back to `/projects` after detail-load failure. There is no separate client-side stale-ID recovery beyond that error state.

`ProjectAccessPage` renders the client view only for USER; STAFF receives the internal project view. `canAccessProjects` permits USER and STAFF in the portal. ADMIN and SUPERADMIN are routed away to `/module`; they do not gain project API detail access by virtue of administrative role.

Prisma models inspected: `Project` has a restricted client FK, optional unique request and quotation links, optional workspace-group relation, and project staff, milestone, request, and message/read relations. `ProjectMilestone.workflowFileId` links the delivered file; `ProjectDeliverableClientReview` records a file-version/client decision with a unique `(workflowFileId, clientId)` constraint. `ProjectChangeRequest` is related to its project, requester, and optional reviewer with restrictive project/user deletion behavior.

Representative interaction traces:

- Brief: Edit brief → `saveBrief` → `updateProjectBrief` → authenticated `PATCH /api/projects/:id/brief` → record-ID validation and owner/status checks → row-locked Prisma transaction → refreshed project response → React project state and success/error feedback.
- Client requests: request dialog validates/normalizes details → create change/cancellation API client → authenticated POST route → owner/status/pending-request checks → transaction creates request and workflow event/timestamp → refreshed detail state and notice.
- Department Head review: review dialog → PATCH review API → authenticated current-head check and decision/note validation → transaction stores review; cancellation approval also updates linked project/request/workflow and pending changes → refreshed detail state.
- Staff milestone: Mark complete/Reopen → `updateMilestone` → PATCH route → current contributor, legacy-project, and IN_PROGRESS checks → milestone timestamp/event transaction → refreshed progress.
- Client file/review: deliverable link → Page 23 detail; file GET checks client ownership and sent/client-visible state before bytes are returned; review POST validates decision/note and stores a version-specific client review.
- Project chat: Open project chat → `/messages?project=<id>` → project conversation client requests the same ID → Messages API applies participant authorization. P13-002 verified the route and ID propagation with mocked API responses.

## D. Functionality inventory

| Area                    | Implemented behavior                                                                                                                                                                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client overview         | Project name, status, service name, request reference, start date, task progress, brief description, request history, “Latest notes” empty placeholder, and team-lead placeholder.                                                                                                                                |
| Client project sections | Four panels exist: overview, shared deliverables, notes/context, and team. The notes panel reuses the project description as brief context; the team panel contains placeholder team cards rather than assigned employee data.                                                                                    |
| Client brief            | Owner can edit project name and description while project is IN_PROGRESS or ON_HOLD, except while a cancellation request is pending.                                                                                                                                                                              |
| Client requests         | Owner can submit a change or cancellation request; request status and Department Head response are shown when present. A cancellation request remains pending while the project stays active.                                                                                                                     |
| Client deliverables     | Detail response includes only SENT_TO_CLIENT files marked client-visible. The page shows title, filename, size, shared date, review status, and a link to the Page 23 deliverable route.                                                                                                                          |
| Staff overview          | Eligible staff see project summary, milestones/delivery states, and project description/reference/start date. Active assigned staff may complete/reopen eligible legacy milestones.                                                                                                                               |
| Department Head review  | Current responsible Department Head may accept or decline pending change/cancellation requests, with a response note on decline.                                                                                                                                                                                  |
| Conversation            | USER sees a floating “Open project chat” link to `/messages?project=<projectId>`. The staff detail has a service-conversation link only where a linked request and Department Head permission allow it.                                                                                                           |
| Unsupported on Page 13  | No project status editor, project deletion, general file upload, arbitrary attachment manager, project archive action, due/completion date, objective/scope editor, or actual client-side team assignment display. Upload and broader workspace status management are in Page 15; file preview/review is Page 23. |

The page does not display client identity, due date, completion date, assigned staff names, project objectives, or a separate requirements/scope field. The backend returns a safe projection and strips internal-only identifiers/plans from client detail.

Controls use descriptive accessible names, dialogs/side panels expose titles, and progress uses a labelled `progressbar`. Responsive styles provide mobile layouts. The missing tab triggers leave the section panels without keyboard or pointer navigation from the page.

## E. Interactive control inventory

| Role/view               | Controls and result                                                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| USER                    | “Edit brief” opens a side panel with Project name, Project brief, Save, Cancel, and Close controls.                                                                                                   |
| USER                    | “New project request” opens a dialog with change/cancellation type selection, details, and Keep project/Send controls. It becomes disabled or shows “Request under review” when a request is pending. |
| USER                    | “View <deliverable>” opens `/projects/<id>/deliverables/<milestoneId>`; file preview/download and review controls are on that route.                                                                  |
| USER                    | “Open project chat” opens `/messages?project=<id>`. The new click-through case verified that the message page fetched that same project ID.                                                           |
| STAFF / Department Head | Pending change/cancellation request controls open accept/decline review dialogs. Decline requires a response note.                                                                                    |
| Assigned STAFF          | “Mark complete” / “Reopen” sends a boolean milestone update and updates progress after success.                                                                                                       |
| All eligible viewers    | Loading/error states; error state includes return-to-project-list navigation.                                                                                                                         |

The client detail renders `Tabs`/`TabsContent` but no `TabsList` or `TabsTrigger`. `ClientProjectSidebarLinks` defines Overview/Deliverables/Notes/Team links, but repository search finds no imports or renders of that component. As a result, URL query parameters can select the panels, but the rendered client detail offers no normal visible control for navigating among them. This is covered by P13-001.

## F. Input validation

| Input                        | UI constraint                                                                              | API constraint                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Project name                 | Required; trimmed length 2–160; input max length 160.                                      | Must be a string; trims whitespace; 2–160 characters.                                                                              |
| Project brief                | Optional; max 6,000 characters; empty text is permitted.                                   | Must be a string of at most 6,000 characters; trim-empty persists as `null`.                                                       |
| Change request details       | Required; trimmed minimum 10, max 4,000; submit disabled below minimum.                    | Trimmed 10–4,000 characters.                                                                                                       |
| Cancellation reason          | Required; trimmed minimum 10, max 2,000; submit disabled below minimum.                    | Trimmed 10–2,000 characters; request also requires a linked request/Department Head and an active project.                         |
| Department Head decline note | Required for decline; minimum 3, maximum 2,000; accept note optional.                      | Trimmed; decline requires at least 3; max 2,000 for either decision.                                                               |
| Deliverable review           | Decision is APPROVED or REVISION_REQUESTED; revision note is required, 3–2,000 characters. | Enforces decision enum, revision note minimum 3/max 2,000; one review per shared file version/client.                              |
| Milestone completion         | Button sends completed boolean.                                                            | `completed` must be boolean; only assigned contributors can update eligible legacy milestones on an IN_PROGRESS project.           |
| Project/nested IDs           | No Next-page format check.                                                                 | Controller `recordIdParam` validates project, milestone, and request IDs as 1–80 URL-safe record IDs; malformed values return 400. |

The reviewed UI/API boundaries are consistent for the validated fields. No API validation or persistence defect was found in the isolated cases executed.

## G. API contracts

All project routes require authentication and use same-origin `/api` routing. The controller is mounted at `/api/projects`.

| Method and path                                                        | Contract and access                                                                           | Validation/persistence                                                                                                                                                                          |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/projects`                                                    | USER-only client list; owner-scoped. Other authenticated roles receive 403.                   | Returns a limited projection with status, service/reference, progress counts, and visible-deliverable count.                                                                                    |
| `GET /api/projects/:id`                                                | Active client owner or eligible current contributor/Department Head; otherwise hidden as 404. | Repeatable-read transaction; strips private fields and restricts client deliverables.                                                                                                           |
| `PATCH /api/projects/:id/brief`                                        | Owning USER only.                                                                             | Validates name/description, locks project row, checks active status and pending cancellation, updates transactionally, returns refreshed detail.                                                |
| `POST /api/projects/:id/change-requests`                               | Owning USER only.                                                                             | 201 on creation; rejects invalid length, duplicate pending change, pending cancellation, or ended project; creates request and updates project timestamp in transaction.                        |
| `POST /api/projects/:id/cancellation-requests`                         | Owning USER only; linked request/Department Head required.                                    | 201 on creation; rejects invalid reason, duplicate pending cancellation, or ended project; creates request, updates timestamp, appends workflow event transactionally.                          |
| `PATCH /api/projects/:id/change-requests/:changeRequestId`             | Current responsible Department Head only.                                                     | Accept/decline pending change; validates note and active project state; persists decision/reviewer/time transactionally.                                                                        |
| `PATCH /api/projects/:id/cancellation-requests/:cancellationRequestId` | Current responsible Department Head only.                                                     | Decline preserves active project. Approval sets project, linked service request, and workflow to CANCELLED; pending change requests are rejected; event and related writes share a transaction. |
| `PATCH /api/projects/:id/milestones/:milestoneId`                      | Assigned active contributor; legacy non-workspace project only.                               | Boolean completion; status must be IN_PROGRESS; persists completion timestamp and workflow event/notifications transactionally.                                                                 |
| `GET /api/projects/:id/deliverables/:milestoneId/file`                 | Owning client only for shared, client-visible delivery.                                       | 404 for private/foreign/unshared file. PDF/PNG/JPEG may be inline; other types are attachment. Response sets `nosniff` and sandbox CSP.                                                         |
| `POST /api/projects/:id/deliverables/:milestoneId/review`              | Owning client only for shared, client-visible delivery.                                       | APPROVED or REVISION_REQUESTED; transactional review keyed to the delivered workflow-file version; duplicate response is 409.                                                                   |

There is no Page 13 endpoint for general project edit/status/delete or file upload. Project workspace lifecycle and staff deliverable upload routes are separate modules.

## H. Authorization matrix

| Operation                              | SUPERADMIN           | ADMIN                | STAFF outside project scope                               | Assigned active STAFF             | Responsible Department Head             | Owning USER                                                               |
| -------------------------------------- | -------------------- | -------------------- | --------------------------------------------------------- | --------------------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| Open `/projects/:id` in portal         | Denied to `/module`  | Denied to `/module`  | Route permitted, API returns 404                          | Allowed                           | Allowed                                 | Allowed                                                                   |
| View detail/brief                      | No project API grant | No project API grant | 404                                                       | Yes, safe internal projection     | Yes, safe internal projection           | Yes, client projection                                                    |
| Edit brief                             | No                   | No                   | No                                                        | No                                | No                                      | Yes, IN_PROGRESS/ON_HOLD and no pending cancellation                      |
| View deliverable data                  | No                   | No                   | 404                                                       | Internal milestone scope only     | Internal milestone scope                | Shared client-visible delivery only                                       |
| Review deliverable                     | No                   | No                   | No                                                        | No                                | No                                      | Yes, shared file version only                                             |
| Submit change/cancellation             | No                   | No                   | No                                                        | No                                | No                                      | Yes, active eligible project; cancellation also needs linked request/head |
| Review change/cancellation             | No                   | No                   | 403                                                       | 403                               | Yes, current accepted department head   | No                                                                        |
| Update milestone                       | No                   | No                   | 404                                                       | Yes, active legacy project        | Yes if eligible contributor             | No                                                                        |
| Open project conversation from Page 13 | No                   | No                   | No detail link; participant check remains in Messages API | No client-facing link unless head | Service conversation link when eligible | Project chat link; participant authorization remains in Messages API      |
| Read related file bytes                | No                   | No                   | 404                                                       | Not through client file route     | 404 through client file route           | Shared/client-visible file only                                           |

There is no separate “project manager” role that overrides project scope. Staff access derives from current Department Head assignment to the accepted department or active project staff assignment/department relationship. Direct API access enforces this independently of frontend routing. PGlite tests verified owner isolation, unassigned staff denial, administrative denial, file privacy, and shared-file access.

## I. Project lifecycle

The Prisma `ProjectStatus` values are `PLANNED`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED`, and `CANCELLED`. There is no Project `ARCHIVED` status; the Project Workspace UI groups completed/cancelled work as archive views.

| Transition/operation                      | Trigger and actor                                                                                           | Page 13 relevance                                                                                             |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Initial `PLANNED`                         | Project is created from accepted request/quotation; schema default is PLANNED.                              | Planned request-linked projects are not yet exposed in the client list/detail scope.                          |
| `PLANNED → IN_PROGRESS`                   | Request workflow activates after staffing prerequisites and records start date.                             | Client detail becomes available after activation/start-date scope.                                            |
| `IN_PROGRESS → ON_HOLD → IN_PROGRESS`     | Authorized workspace manager actions in Project Workspace.                                                  | Page 13 renders status but does not edit it; brief/change/cancellation operations allow both active statuses. |
| `IN_PROGRESS/ON_HOLD → COMPLETED`         | Workspace manager completion after task and deliverable prerequisites.                                      | Read-only status on Page 13.                                                                                  |
| `PLANNED/IN_PROGRESS/ON_HOLD → CANCELLED` | Workspace cancellation by authorized manager, or Department Head approval of a client cancellation request. | Client cancellation stays active while pending; Page 13 supports request and Department Head review.          |
| Invalid/repeated transition               | Workspace/request services check current status and pending state.                                          | APIs return 400/403/404/409 as appropriate; no direct project status editor is rendered here.                 |

The Page 13 cancellation approval path updates related request/workflow state and rejects outstanding pending change requests in the same transaction. A declined cancellation leaves project status active. PGlite verified the accepted and declined paths, resulting records, and no remaining pending change requests after cancellation approval.

## J. Project brief and change requests

The brief is the project name and description; there are no separate Page 13 objectives, requirements, or scope fields. Brief writes use a transaction with a row lock and return refreshed project data. Existing API assertions verified normalization, rejection of short/overlong fields, cross-client denial, and persistence after reread.

Change requests are client-owned, one pending CHANGE per user/project, and unavailable when a cancellation is pending or the project has ended. The current Department Head can accept or decline; decline requires an explanatory response. Cancellation requests follow their own pending guard and require a linked request/current Department Head. Approval updates project/request/workflow status consistently. Existing NEX-013 PGlite coverage verifies these behaviors; the browser NEX-017 workflow covers modal validation and persistence but its list-to-detail sequence is blocked by the Page 22 pagination defect described in Q/R.

## K. Deliverables

Page 13 lists only SENT_TO_CLIENT milestones whose workflow file is client-visible. It exposes a link to the Page 23 deliverable detail route; preview, download, approval, and revision feedback are handled there. Internal-only or not-yet-shared deliverables are omitted. The API file path verifies client ownership and sharing before returning bytes with safe response headers. The API review path validates status/note, persists a review against the exact workflow-file version, and prevents duplicate review for the same client/version.

Existing NEX-014 PGlite tests passed for visible-file filtering, foreign/private-file denial, file bytes, review validation, and persistence. The linked Page 23 NEX-017 browser case still fails its expected error notification on a failed review response; this remains in scope as a cross-page defect only.

## L. Existing regression coverage

Before adding Page 13 tests, Playwright discovery was **447 tests in 61 files**. Relevant existing coverage included:

- `client-project-workflows.spec.ts`: four NEX-017 cases spanning list/detail, brief and client requests, deliverable review/error recovery, loading/error/reload, and Department Head review.
- `project-workspace.spec.ts`: client mobile overview/deliverable/chat href; failed milestone recovery at desktop/mobile; assigned staff milestone completion/reopen.
- `shared/project-pages-regression.spec.ts`: staff route behavior, detail load/reload recovery at desktop/mobile, and separate Page 14 workspace archive cases.
- `project-conversations.spec.ts` and Page 12 coverage: direct project conversation deep links and participant-scoped behavior.
- `apps/api/tests/project-workspace.test.ts`: nested NEX-013 owner/brief/request workflow and NEX-014 deliverable/file authorization and persistence cases.

The existing client mobile test writes to fixed `test-results/project-deliverables-mobile.png` paths already occupied in the workspace. It was not rerun to avoid overwriting existing evidence. Its source assertions and earlier accepted coverage were preserved. The selected staff detail recovery checks did run at 390px.

## M. Coverage gaps

- **Client section navigation:** no visible links or triggers connect the implemented panels. P13-001 was added and fails against the current page. The route’s query selection remains testable directly, but does not provide user navigation.
- **Project chat click-through:** previous Page 13 coverage asserted the link href, while Page 12 tested deep links separately. P13-002 now clicks the Page 13 link, verifies `/messages?project=project-1`, and verifies the same ID reaches the project-conversation API. It passes.
- **Brief failure notification at Page 13:** the existing NEX-017 list route did not reach the detail page because the project-list view restored page 2 after its filter sequence. P13-003 directly opens the detail route and reproduces the missing error toast independently.
- **New API tests:** no API gap justified adding duplicate cases; existing NEX-013/NEX-014 coverage already exercises the core contracts and passed in PGlite.

No new coverage was added for unsupported project status editing, general file upload/deletion, team assignment, or notes CRUD.

## N. New browser tests

Added in `apps/web/e2e/projects/project-details-regression.spec.ts`:

| ID      | Case                                                                | Result                                                                                                                      |
| ------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| P13-001 | Client project details exposes navigation to its section views.     | **Fail — verified UI defect:** the Overview link is absent; the only section-link component is unused.                      |
| P13-002 | Client project chat link opens the matching project conversation.   | **Pass:** link click, destination query, GET detail request, and rendered conversation message all retain `project-1`.      |
| P13-003 | Failed client brief updates present the NEX-017 error notification. | **Fail — verified UI defect:** API returns 503, editor remains usable, but the Sileo error notice is not mounted/presented. |

No API test file was added.

## O. New API tests

None. Existing isolated API cases provide adequate Page 13 coverage, so no duplicate API tests were introduced.

## P. Execution results

The following commands were run; working directories are identified in each item. Full logs and Playwright artifacts are retained in the evidence folder.

- From `apps/web`: `node node_modules/@playwright/test/cli.js test --list` (initial and final discovery).
- From `apps/web`: `node node_modules/@playwright/test/cli.js test e2e/projects/project-details-regression.spec.ts --workers=1 --reporter=list --output=../../test-results/phase7/page-by-page/page-13-project-details/artifacts-browser-focused-final`.
- From `apps/web`: `node node_modules/@playwright/test/cli.js test e2e/projects/client-project-workflows.spec.ts e2e/projects/project-workspace.spec.ts e2e/shared/project-pages-regression.spec.ts --grep='NEX-017|failed milestone updates|assigned staff can complete|staff project routes|projects detail recovers' --reporter=list --output=../../test-results/phase7/page-by-page/page-13-project-details/artifacts-browser-compatibility`.
- From `apps/web`: `node node_modules/@playwright/test/cli.js test e2e/projects/client-project-workflows.spec.ts --grep='client browses projects and edits brief' --workers=1 --reporter=list --output=../../test-results/phase7/page-by-page/page-13-project-details/artifacts-nex017-brief-isolated`.
- From `apps/api`: `node node_modules/tsx/dist/cli.mjs --test --test-name-pattern='NEX-003|NEX-013|NEX-014' tests/project-workspace.test.ts`.
- From the repository root: `pnpm format`, `pnpm lint`, `pnpm typecheck`, and `git diff --check`.

| Command/scope                                                                          | Result                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial Playwright discovery (`node node_modules/@playwright/test/cli.js test --list`) | 447 tests / 61 files. Retained as `initial-discovery.log`.                                                                                                                                                                                                                                                                                                                                                                            |
| Final Playwright discovery                                                             | 450 tests / 62 files (three new browser cases, one new spec file). Retained as `final-discovery.log`.                                                                                                                                                                                                                                                                                                                                 |
| New Page 13 focused run, one worker                                                    | 3 unique cases: 1 passed, 2 failed as confirmed defects. P13-002 passed. P13-001 and P13-003 failed as expected. A first-run missing read-receipt mock caused a fixture-only P13-002 afterEach failure; the fixture was corrected and the final run passed.                                                                                                                                                                           |
| Existing NEX-017 plus selected compatibility run                                       | 10 cases: 8 passed, 2 failed. Failures: the brief/list workflow did not find Website launch after returning from a later page (APP-TABLE-001, reproduced again alone), and the linked deliverable review did not show its expected failure notification (APP-DELIVERABLE-001). Passed cases include department-head review, project load/reload states, staff project routing, and milestone retry/complete/reopen at desktop/mobile. |
| NEX-017 brief/list isolated rerun                                                      | Same page-2 restoration after filter changes. The client list snapshot showed “Showing 11–11 of 11” and only Project 11 after returning to All Statuses; this is the distinct Page 22 list route, not the detail page.                                                                                                                                                                                                                |
| PGlite project-workspace API run                                                       | Six unique nested API leaves passed: NEX-004, NEX-005, NEX-013, NEX-014, NEX-015, and NEX-016. TAP’s total of 7 includes the NEX-003 parent suite. No failed or skipped leaves. The harness used in-memory PGlite only.                                                                                                                                                                                                               |
| First sandboxed browser/API process attempt                                            | Windows returned `spawn EPERM`; the same requested runs were retried with the required process access and completed. No external database was used.                                                                                                                                                                                                                                                                                   |
| `pnpm format`                                                                          | **Pass, exit 0.** The first sandboxed attempt could not open pnpm’s shared operation lock; the required command then completed with process access. Prettier reported the other repository files unchanged.                                                                                                                                                                                                                           |
| `pnpm lint`                                                                            | **Pass, exit 0** (`eslint . --max-warnings 0`).                                                                                                                                                                                                                                                                                                                                                                                       |
| `pnpm typecheck`                                                                       | **Pass, exit 0** for web and API. API Prisma client generation completed; no schema change was made.                                                                                                                                                                                                                                                                                                                                  |
| `git diff --check`                                                                     | **Pass, exit 0.** Final worktree contains only this report and the new browser spec.                                                                                                                                                                                                                                                                                                                                                  |

The selected browser/API runs had zero skipped cases. The focused cases also had zero flaky retries; the one P13-002 fixture failure on the first attempt was fixed before the final run.

Browser traces, error contexts, focused logs, compatibility logs, PGlite TAP output, and discovery lists are retained under `test-results/phase7/page-by-page/page-13-project-details/`.

## Q. Defect register

| ID                               | Classification       | Evidence and impact                                                                                                                                                                                                                                                                                                 |
| -------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P13-001                          | `APPLICATION_DEFECT` | Client route renders four `TabsContent` panels without `TabsList`/`TabsTrigger`; the source-defined `ClientProjectSidebarLinks` is unreferenced. Browser regression cannot find the expected Overview link. The client has no visible way to select Notes or Team and no direct section navigation to Deliverables. |
| NEX-017 / brief feedback         | `APPLICATION_DEFECT` | `client-project-page.tsx` calls direct `sileo.error` after a mocked 503. `auth-provider.tsx` mounts the shared viewport only after a shared toast event (`@/lib/toast`); direct package calls bypass that event. P13-003 confirms no visible “Couldn’t update the brief” notice while the editor remains retryable. |
| APP-DELIVERABLE-001              | `APPLICATION_DEFECT` | Page 23 `client-deliverable-page.tsx` uses the same direct Sileo pattern. Existing NEX-017 browser case returns a failed review response and cannot find “Couldn’t save your response”.                                                                                                                             |
| APP-TABLE-001 (adjacent Page 22) | `APPLICATION_DEFECT` | `/projects` uses `useLocalTable`. Its stored page key survives a filter/search view change; when the original view key returns, page 2 is restored. The NEX-017 sequence reproduced a missing target project after clearing filters. Page 13 detail itself does not use this table hook.                            |

No authorization, API contract, validation, or persistence defect was identified in the project detail contracts exercised. No application fix was authorized or made.

## R. Historical defect reassessment

- **NEX-017 brief notification:** still present and directly reproduced at Page 13 by P13-003. API 503 propagation is correct; the missing user-facing error notice is in the UI notification integration.
- **Deliverable failure notification:** still present on linked Page 23 and reproduced in the existing NEX-017 case. Retained as APP-DELIVERABLE-001.
- **Stale pagination:** the Page 13 detail page does not use `useLocalTable`. The adjacent `/projects` list does use it, and the existing multi-step NEX-017 scenario reproduced stale page restoration. This does not change Page 8’s existing SVC-002 scope or start Page 22’s audit.
- **Project conversation links:** Page 13’s client project ID is preserved through the Messages URL and API call in P13-002. Page 12’s archive/search findings were not re-audited or altered.

## S. Integration limitations

- Browser results are `MOCKED_UI_VERIFIED`; all browser API calls used deterministic Playwright routes. They do not establish a live frontend/API/database integration result.
- Backend results are `ISOLATED_API_VERIFIED`; the existing Node test app used in-memory PGlite. No production/shared database or production records were touched.
- Data projections, route policy, schema relationships, unsupported controls, and unexercised lifecycle branches are `SOURCE_ONLY`.
- No `LIVE_INTEGRATION_VERIFIED` claim is made. The client mobile screenshot test was not rerun due its fixed existing output paths.

## T. Historical preservation

The accepted history remains 292 original Playwright identities, 1,630 historical assertion sites, and 4,211 mappings. The 61 Page 1–12 browser additions and 18 Page 7–12 API additions were preserved. This task added three current browser cases; these counts remain separate from the historical baseline. The initial 447/61 discovery increased to 450/62.

Only a new Page 13 spec and report were created; no earlier test, assertion, mapping, or report was edited. The legacy preservation verifier was not rerun and is not claimed clean; its recorded PW-149 issue and PW-037/PW-001 limitations remain authoritative. No tests were deleted, weakened, or newly skipped.

## U. Files changed

- `apps/web/e2e/projects/project-details-regression.spec.ts` — three new Page 13 browser cases.
- `docs/testing/verification/phase7/page-by-page/page-13-project-details.md` — this audit and verification report.
- `test-results/phase7/page-by-page/page-13-project-details/` — ignored Playwright/API evidence; not tracked source changes.

No application source, backend business logic, Prisma schema/migration, dependency manifest, lockfile, or accepted Pages 1–12 test/report was changed. No commit or push occurred. Page 14 and Phase 7.5 were not started.

## V. Final recommendation

**Ready for administrative review with verified defects.** The ownership/lifecycle/API audit, focused regressions, isolated API evidence, and compatibility checks are complete. P13-001, the NEX-017 brief and deliverable notification defects, and the adjacent Page 22 stale-pagination finding remain visible. Codex does not administratively accept the page or represent the product as defect-free or production-ready.

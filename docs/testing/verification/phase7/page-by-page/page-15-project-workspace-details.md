# Phase 7.4.1 — Page 15: Project Workspace Details (`/project-workspace/[id]`)

**Verification date:** 2026-11-14  
**Status:** COMPLETE WITH VERIFIED DEFECTS  
**Scope:** Page 15 regression audit and tests only. No application, API, schema, migration, dependency, or lockfile changes were made.

## A. Page status

**COMPLETE WITH VERIFIED DEFECTS.** The Page 15 source audit, test additions, focused execution, API compatibility checks, integration checks, and evidence capture are complete. Two reproducible defects remain: a UI detail-load error state (S15-001) and a task API limit bypass (S15-002). Their regressions remain failing so both defects are visible. Codex cannot administratively accept this page; this report is ready for review.

The official 23-page handoff identifies Page 15 as Project Workspace Details, `/project-workspace/[id]`. Page 16 (`/staff-workload`) and Phase 7.5 were not started.

## B. Git baseline and recent integration

| Item                       | Verified value                                                                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Branch                     | `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages`                                        |
| HEAD                       | `b7de804366991ef89a92f0a01a7f58db2075c8e1`                                                                                                |
| HEAD subject               | Merge pull request #256 from `Yesuaaa/development`                                                                                        |
| Merge parents              | Page 14 first parent `8cfea8f65792fee6cb4315c30b626b56efc362a6`; integrated development parent `8da5cc76147cdca7f73b093eb5ebf714da77a414` |
| State before Page 15 edits | Clean; no staged, modified, or untracked files                                                                                            |
| State at report time       | Two new Page 15 test files plus this report; no application source changes                                                                |

The merge added 92 files, mainly Attendance and Workload work. It also refactored calendar queries/services and added availability support. Source/history comparison found no direct changes to the project-workspace feature, project-workspace API service/controller, project plan/task/deliverable models, workspace route policy, or existing Page 15 regressions. No change to the Page 15 contract was identified.

The last accepted Page 14 inventory was 454 Playwright tests in 63 files. The integrated baseline discovered 476 tests in 65 files (+22/+2, attributable to the added Attendance specifications). After Page 15, discovery is 483 tests in 66 files (+7/+1).

No fetch, pull, merge, branch switch, reset, commit, or push was performed.

## C. Source inspection

Inspected the dynamic route `apps/web/src/app/(portal)/project-workspace/[id]/page.tsx`; the page and components under `apps/web/src/features/project-workspace/`; the frontend API client; shared workspace route policy and access predicates; `apps/api/src/features/project-workspace/project-workspace.controller.ts` and `project-workspace.service.ts`; task-plan templates and shared record-ID validation; auth middleware and active-staff query; workflow-file parsing and project-conversation delivery integration; and the relevant Prisma models in `apps/api/prisma/schema.prisma`.

The route awaits `params`, passes its `id` to `WorkspaceDetailPage`, and keys the page by that ID. It does not independently validate the ID. The API router requires authentication for all endpoints and validates `id`, `projectId`, `taskId`, and `deliverableId` as 1–80 character URL-safe record IDs. Invalid IDs return 400; missing or out-of-scope workspace reads return 404. The page fetches its detail through `getProjectWorkspace` and `useAsyncResource`.

The server-side staff scope is authoritative: active STAFF accounts only; department heads can read projects accepted into their headed department(s), while other staff must be assigned through `ProjectStaff`. Out-of-scope projects are hidden as 404. The client route policy redirects USER accounts away from internal workspace routes; ADMIN and SUPERADMIN do not gain API access by navigating directly.

The principal rendered components are `ProjectSummary`, `WorkspaceOverview`, `PlanEditor`, `TaskRowActions`/`TaskDetailsPanel`, `WorkspaceDeliverables`, `WorkspaceTeam`/`TeamMemberPanel`, and `WorkspaceActivity`. Team staffing delegates to the Request Workflow staffing dialog; client-facing delivery cards and chat navigation use Project Conversations. Workspace activity is assembled from workflow events, capped at the latest 100 entries in the detail response.

## D. Complete functionality inventory

| Area          | Implemented Page 15 behavior                                                                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detail        | Loads a workspace group or single project, client, service/workstream, plan, deliverables, assigned staff, permissions, status, activity, and update timestamp. Shows a loading status and an error alert.  |
| Overview      | Shows client, services, status, start date, project scope, task progress, expected deliverables, and assigned staff; shortcuts open Team and Deliverables.                                                  |
| Work          | Shows workstreams and plan phases; expands phase task tables; edits a plan, adds/removes phases and tasks, edits a task, assignment, due date, or status.                                                   |
| Deliverables  | Lists existing deliverable records; department heads edit metadata and review; assigned active staff upload/replace/remove attachments; permitted staff download; approved items can be sent to the client. |
| Team          | Searches staff, filters by service, opens staff details and assigned tasks, launches staffing for eligible heads, and lets the department head appoint/replace a project team lead.                         |
| Activity      | Shows project/work/plan/staffing events and supports text search, category, actor, and chronological-order filters.                                                                                         |
| Conversations | Shows a client-chat link for a workstream when the viewer is an assigned active uploader and the project has started. Submission from the conversation is covered by the shared chat regression.            |
| Lifecycle     | Department heads can put eligible in-progress work on hold, resume on-hold work, or complete a workspace when all workstreams, tasks, and deliverables meet prerequisites.                                  |

There is no standalone milestones timeline: the `ProjectMilestone` records exposed by the workspace are the established deliverables model. There is no separate deliverable-creation control/API on this page; deliverable records already exist when the project is activated. There is no task DELETE endpoint; task removal is a plan edit. Workspace rename/cancel actions are on the Page 14 directory. The detail page has no rename, cancel, archive, or wizard control. Completed/cancelled work is terminal and represented as archived by the directory; no separate archive mutation exists.

## E. Interactive control inventory

| Location           | Controls and effect                                                                                                                                                                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell/header       | Project Workspace breadcrumb returns to the directory. Workspace name and status are shown. The status menu is available to managers on nonterminal workspaces.                                                                                                                                      |
| Status menu        | “Put on hold” appears when at least one workstream is IN_PROGRESS; “Resume project” appears when a workstream is ON_HOLD; “Mark complete” is disabled until its prerequisites pass. Requests update workspace data or show an alert.                                                                 |
| Project chat       | Per-workstream link to `/messages?project=<projectId>` when `canUploadDeliverables` and `startDate` are true.                                                                                                                                                                                        |
| Section navigation | Overview, Work, Deliverables, Team, Activity buttons; `?tab=deliverables` opens Deliverables initially. Overview also has View Team and View Deliverables shortcuts.                                                                                                                                 |
| Work               | “Edit project plan”; phase name, task name and role inputs; Add/Remove phase and task; Save plan and Discard changes. Each task offers View task and Edit task. The edit dialog has task name, role, due date, assigned-staff selector, task-status selector, save, and close/cancel controls.       |
| Deliverables       | View details; Edit; upload/replace attachment; remove attachment with confirmation; download attachment; Approve; Reject with reason dialog; Send to client; submission dialog with optional note. Controls are gated by `canAssign`, `canUploadDeliverables`, attachment state, and delivery state. |
| Team               | Staff search, service filter, Assign staff (Request Workflow dialog), View member details, assigned-task view/edit, and Assign as team lead. Lead assignment replaces the current lead. There is no lead-removal control.                                                                            |
| Activity           | Search; Activity type, Activity author, and Activity order filters; Clear filters in the empty filtered state.                                                                                                                                                                                       |

The page uses labeled navigation/regions, native buttons, `details`/`summary` phase disclosure, labeled inputs, and dialog labels. Focus-visible styling and focus-return behavior are present in the inspected UI. No automated axe or assistive-technology audit was run. Narrow-screen checks are recorded in R.

## F. Plan management

Plans are stored as `Project.workPlan` JSON. The editor supports 1–20 phases and at most 50 tasks per phase. Phase names are required after trimming and limited to 120 characters; task names must be nonblank and at most 180 characters; suggested role is at most 80 characters. The UI exposes matching `maxLength` values but the PlanEditor does not set `required`; the API validates the submitted plan. IDs must be valid record IDs and unique across phases and tasks. Optional employee IDs must be valid record IDs and optional due dates must be real `YYYY-MM-DD` dates.

The page saves the full plan with the workstream's `updatedAt` as `expectedUpdatedAt`. The service validates, checks scope/assignment constraints, locks the accepted Service Request, conditionally updates the project by matching `updatedAt`, and writes an activity event in the same transaction. A stale write returns 409 and does not replace the saved plan. The new P15-API-002 test verifies the persisted current plan remains after a stale attempt.

On save failure, `WorkspaceDetailPage` keeps the editor draft open and displays the API error; task-edit failure keeps the modal/draft available for retry. Existing NEX-008 browser coverage verifies failed-write draft preservation/discard and a successful saved read. The new tests exercise phase/task creation through the full-plan save and task assignment/due-date persistence in the submitted payload.

There is no plan-history UI. Plan removal is not a separate operation; phases/tasks are removed by saving a new plan. A non-head staff member cannot remove an already-assigned task or change task assignments; the department head can.

## G. Task management

The UI task-creation path is adding a task in `PlanEditor` and saving the plan. The web API module also exports standalone `addProjectTask` and `updateProjectTask` functions, and the backend exposes POST task creation and PATCH status routes, but those functions are not called by the current web UI. The task edit modal submits changes through the full-plan PUT.

Task fields are title, suggested project role, optional assigned employee, optional due date, and status. The statuses are `NOT_STARTED`, `IN_PROGRESS`, and `DONE`. Editing is available to in-scope staff; only the department head can change an assignment. Assignable employees are active staff already approved for that project and department. The task status API accepts only the three known statuses. Tasks are stored in the plan JSON, not a task table. There is no task delete API or independent task-detail route; removal occurs through plan editing, subject to the assigned-task guard.

Existing NEX-004 API coverage verifies plan/task updates, persistence, invalid input/status behavior, and project scope. Existing NEX-008 browser coverage verifies task status/edit save and failed-write recovery. P15-003 and P15-004 add direct browser coverage for phase/task addition and task assignment/date changes.

The standalone POST task endpoint does not enforce the editor/full-plan 50-task-per-phase cap. P15-API-003 confirms it accepts and persists a 51st task (200), while full-plan validation rejects more than 50. This is recorded as S15-002.

## H. Deliverables

The detail UI lists `ProjectMilestone` records as deliverables. Department heads can edit title, description, and expected file type before sending to the client; edit is blocked for SENT_TO_CLIENT. Assigned active staff can upload/replace attachments while the project is IN_PROGRESS or ON_HOLD and remove attachments in NOT_SUBMITTED, IN_REVIEW, or REJECTED states. Department heads approve/reject submitted files; rejection requires a trimmed 3–2,000 character reason. Only APPROVED deliverables with an attachment can be sent to the client. Sending marks the related WorkflowFile client-visible, records a Project Message delivery card, and changes status to SENT_TO_CLIENT. Downloading is scoped to project access and returns the related stored WorkflowFile bytes.

Client-visible delivery is not a direct upload-to-client path. The established flow is staff upload → IN_REVIEW → head approval/rejection → approved delivery to the client. Upload notes are optional, up to 2,000 characters, and reject NUL. Upload retries use an upload UUID and content metadata for idempotency. The browser API accepts nonempty files up to 5 MiB and PDF, Word, PNG, JPEG, or plain text; the server uses the shared workflow upload parser. Existing NEX-005 PGlite and NEX-009 browser tests cover upload/replace, remove/review/share, persisted file bytes, ownership, and client visibility. The shared Project Conversations test covers workspace deliverable submission and safe retry at desktop/mobile widths.

No separate deliverable-create endpoint is exposed by the workspace router. NEX-017 notification findings are not duplicated here; Page 15 verification found no new direct notification contract in its detail UI, and the earlier project-notification findings remain carried as historical limitations.

## I. Workspace lifecycle

Actual project statuses are `PLANNED`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED`, and `CANCELLED`.

| Source → target                         | Trigger/actor                                    | Preconditions and persistence                                                                                                                                                                  |
| --------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IN_PROGRESS → ON_HOLD                   | Detail status menu; department head              | At least one in-progress workstream. Updates eligible workstreams in a transaction and writes `WORKSPACE_ON_HOLD` events.                                                                      |
| ON_HOLD → IN_PROGRESS                   | Detail status menu; department head              | At least one on-hold workstream. Updates affected workstreams and writes `WORKSPACE_RESUMED` events.                                                                                           |
| IN_PROGRESS/ON_HOLD → COMPLETED         | Detail status menu; department head              | Every workstream must be started or already completed; no cancelled/planned service; each project needs a plan, all tasks DONE, and all deliverables SENT_TO_CLIENT. Writes completion events. |
| PLANNED/IN_PROGRESS/ON_HOLD → CANCELLED | Page 14 directory cancel action; department head | At least one cancellable workstream. Detail page has no cancel action. Existing NEX-003 verifies persistence and scope.                                                                        |
| COMPLETED/CANCELLED                     | Terminal                                         | Detail status menu is hidden for terminal workspaces. Directory archive presentation is not a separate status/API operation.                                                                   |

Status updates use a transaction, lock group/project rows, re-read scope/state, conditionally update affected projects, and return 409 on invalid or stale state. NEX-003 API coverage exercises hold/resume/complete/cancel and persistence. P15-005 checks hold/resume rendering and no page-level horizontal overflow at 390px. Rename is also Page 14 directory-only, has a trimmed 2–120 character name limit, and is covered by the existing workspace API suite.

Completion archives project conversation history through the existing project-conversation lifecycle behavior. This is covered in the existing conversation API module. No separate Page 15 archive action or status is implemented.

The Work editor and plan/task mutation services do not check for COMPLETED or CANCELLED before saving plan/task changes. Other lifecycle operations treat those statuses as terminal, but the reviewed requirements do not state whether post-completion corrections are permitted. This remains `UNRESOLVED_CONTRACT` / `SOURCE_ONLY`; no expected status response was invented or asserted.

## J. Input validation

| Input                                        | Source-backed contract                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route/workspace/project/task/deliverable IDs | Backend route param predicate: 1–80 URL-safe `[A-Za-z0-9_-]`; invalid values return 400. Workspace/project scope is checked separately.                                                                                                                                                                                                                               |
| Phase name                                   | Required nonblank after trim; maximum 120 characters; maximum 20 phases; at least one phase. The editor limits length but leaves required enforcement to the API.                                                                                                                                                                                                     |
| Task name in plan                            | Required nonblank after trim; maximum 180 characters. The standalone POST task route additionally requires at least 2 trimmed characters; full-plan validation accepts any nonblank length. The UI edit modal marks task name required and limits it to 180.                                                                                                          |
| Standalone task count                        | Plan editor disables Add task at 50 and full-plan validation rejects over 50; standalone POST currently has no equivalent count check and can persist 51. See S15-002.                                                                                                                                                                                                |
| Suggested role                               | Optional in standalone create (defaults to “Project team”); trimmed; maximum 80 characters. Plan validation also enforces maximum 80.                                                                                                                                                                                                                                 |
| Standalone task count                        | Plan editor disables Add task at 50 and full-plan validation rejects over 50; standalone POST currently has no equivalent count check and can persist 51. See S15-002.                                                                                                                                                                                                |
| Assignment                                   | Optional/null or valid record ID. A changed assignment must target an active staff employee approved on the project in the accepted department; otherwise 400/409. Non-head assignment changes return 403.                                                                                                                                                            |
| Due date                                     | Optional/null or strict valid `YYYY-MM-DD`; UI uses a date input with `0001-01-01` through `9999-12-31`. No project-start/deadline relationship is enforced in the inspected API.                                                                                                                                                                                     |
| Task status                                  | Exactly NOT_STARTED, IN_PROGRESS, or DONE. Unknown values return 400.                                                                                                                                                                                                                                                                                                 |
| Deliverable title                            | If updated, string, nonblank after trim, maximum 300; stored trimmed.                                                                                                                                                                                                                                                                                                 |
| Deliverable description                      | Optional when editing; string maximum 4,000; trimmed and empty becomes null.                                                                                                                                                                                                                                                                                          |
| Expected file type                           | Optional string maximum 50; trimmed and empty becomes null.                                                                                                                                                                                                                                                                                                           |
| Plan concurrency token                       | `expectedUpdatedAt` is required and must parse as a date; the update must still match the saved timestamp or returns 409.                                                                                                                                                                                                                                             |
| Upload ID                                    | Required UUID v4 idempotency key. Reusing it for another deliverable/file/note/content combination returns 409.                                                                                                                                                                                                                                                       |
| Upload file metadata/content                 | Nonempty, at most 5 MiB; PDF, Word, PNG, JPEG, or plain text. Name is required, at most 160 characters, excludes path separators, controls, reserved filename characters, and a leading dot, and must match the supported MIME extension. MIME type is required and at most 100 characters. Base64 must be well-formed and file signatures/UTF-8 content are checked. |
| Submission note                              | Optional string, at most 2,000, no NUL; stored trimmed.                                                                                                                                                                                                                                                                                                               |
| Rejection reason                             | Required for reject; trimmed length 3–2,000 characters.                                                                                                                                                                                                                                                                                                               |
| Workspace rename                             | Not editable on Page 15; Page 14 API rule is trimmed 2–120 characters.                                                                                                                                                                                                                                                                                                |

The audit verified validation predicates and available test coverage; it did not add a boundary-case test for every maximum/minimum. The distinct one-character task rule between full-plan save and standalone POST is documented rather than normalized, because the current source implements both contracts.

## K. API contracts

All routes are under `/api/project-workspace`, mounted behind `requireAuth`. Detail mutations return a refreshed detail object where noted; route and service validation use 400/403/404/409 errors. The controller is the authoritative route inventory.

| Method and route                                             | Purpose / access / result                                                                                             |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| GET `/:id`                                                   | Detail read; active STAFF with department-head or project-assignment scope; detail JSON.                              |
| PUT `/:id/projects/:projectId/plan`                          | Full-plan save with `plan` and `expectedUpdatedAt`; scoped STAFF; refreshed detail; stale conflict 409.               |
| POST `/:id/projects/:projectId/tasks`                        | Add task to existing plan/phase; scoped STAFF; refreshed detail. Current UI uses plan editing instead.                |
| PATCH `/:id/projects/:projectId/tasks/:taskId`               | Update task status; scoped STAFF; refreshed detail. Current UI edits through full-plan PUT.                           |
| PUT `/:id/projects/:projectId/team-lead`                     | Set/replace project lead by employee ID; department head for the project department; refreshed detail.                |
| POST `/:id/status`                                           | ON_HOLD, RESUME, or COMPLETE; department head; refreshed detail.                                                      |
| PATCH `/:id/projects/:projectId/deliverables/:deliverableId` | Edit deliverable metadata; department head; refreshed detail.                                                         |
| POST `.../deliverables/:deliverableId/attachment`            | Staff upload/replace; scoped assigned active staff; body parsed by shared upload validator; 201 and refreshed detail. |
| DELETE `.../deliverables/:deliverableId/attachment`          | Remove an eligible existing attachment; assigned active staff; refreshed detail.                                      |
| POST `.../deliverables/:deliverableId/approve` / `reject`    | Department-head review of submitted attachment; reject includes reason; refreshed detail.                             |
| POST `.../deliverables/:deliverableId/send`                  | Department head sends approved deliverable to client; refreshed detail.                                               |
| GET `.../deliverables/:deliverableId/attachment`             | Authorized attachment download; bytes and safe content headers.                                                       |

PATCH `/:id` (rename) and POST `/:id/cancel` exist on the same router but are directory actions, not Page 15 detail controls. No workspace archive, task DELETE, or deliverable-create route exists. API tests were isolated with PGlite; no live service/database was used.

## L. Authorization matrix

| Operation                            | SUPERADMIN                        | ADMIN                             | STAFF department head                                | STAFF assigned member                                        | STAFF unassigned/cross-department | USER                   |
| ------------------------------------ | --------------------------------- | --------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------ | --------------------------------- | ---------------------- |
| Open detail                          | API 403; internal route redirects | API 403; internal route redirects | Read in headed department                            | Read when assigned                                           | 404 out of scope                  | Redirect away; API 403 |
| Read plan/team/activity              | Same access scope as detail       | Same                              | Yes                                                  | Yes, scoped data                                             | No                                | No                     |
| Edit plan/task fields/status         | API 403                           | API 403                           | Yes                                                  | Yes, except assignment changes and removal of assigned tasks | No                                | No                     |
| Assign task / set team lead          | API 403                           | API 403                           | Yes, subject to active approved project-member rules | Cannot change assignments/lead                               | No                                | No                     |
| Upload/remove deliverable attachment | API 403                           | API 403                           | Head review role is denied staff upload              | Assigned active staff, subject to project/deliverable state  | No                                | No                     |
| Edit/review/send deliverable         | API 403                           | API 403                           | Yes, headed department scope                         | Not department-head review                                   | No                                | No                     |
| Hold/resume/complete                 | API 403                           | API 403                           | Yes, if lifecycle preconditions pass                 | No                                                           | No                                | No                     |
| Rename/cancel                        | API 403                           | API 403                           | Yes from directory, with lifecycle rules             | No                                                           | No                                | No                     |

The P15-API-001 test verifies unauthenticated 401, USER/ADMIN/SUPERADMIN 403, department-head and assigned-staff 200, unassigned and foreign-department 404, malformed ID 400, `canManage` behavior, assigned staff upload permission, and omission of employee `userId` from the response. The P15-002 browser case verifies a client is redirected without issuing a workspace detail request. Backend enforcement remains decisive; browser redirects are not treated as a security boundary.

## M. Database integrity

`Project.workPlan` is nullable JSON containing phase/task IDs and values; there is no ProjectTask table. A project belongs to a client and service request and may belong to a `ProjectWorkspaceGroup`; a group composes multiple Project workstreams. `ProjectStaff` joins project and employee, tracks approval, allocation, and `isTeamLead`. `ProjectMilestone` stores deliverable status/metadata and a unique optional `workflowFileId`; WorkflowFile belongs to the request and carries uploader/visibility/content. Client review records relate a milestone, client, version, and optional file. Project chat/read records are separately related to Project.

Plan, lifecycle, lead, and deliverable mutations use Prisma transactions and lock/recheck relevant ServiceRequest, workspace-group, project, milestone, or related file rows. Plan saves use an optimistic `updatedAt` comparison. Workflow events are written with supported mutations. The new API test creates the required RequestWorkflow relation, proves detail scoping, performs one valid plan save, submits a stale plan, and compares the final PGlite JSON plan to the first saved value. Existing NEX-003/004/005/015 and project-conversation tests verify lifecycle, plan/task, file/review, team lead, and conversation persistence.

No Prisma schema or migrations were modified. Recent development integration did not change these project relations.

## N. Existing regression coverage

Pre-existing Page 15-relevant coverage:

- `apps/web/e2e/projects/workspace-detail-mutations.spec.ts` — NEX-008 saved reads, successful plan/task changes, failed-save draft preservation and discard.
- `apps/web/e2e/projects/workspace-deliverables.spec.ts` — NEX-009 staff upload/replace, head review/share, and client visibility.
- `apps/web/e2e/shared/project-pages-regression.spec.ts` — detail-load error and reload recovery at 1440px and 390px, section navigation, and non-manager status-control absence.
- `apps/web/e2e/project-conversations.spec.ts` — workspace deliverable submission from project chat and safe retry at 1440px and 390px.
- `apps/api/tests/project-workspace.test.ts` — NEX-003 lifecycle; NEX-004 plan/task; NEX-005 deliverable files/review; NEX-015 lead replacement. Other tests in the module cover their own pages and are not counted as Page 15 coverage.
- `apps/api/tests/project-conversations.test.ts` — workspace submissions publish scoped deliverable cards and message pagination stays within authorized project access.

The existing page tests were not weakened or edited. The old shared detail recovery assertions intentionally remain compatible and do not claim the loading status is cleared after a failed read.

## O. Coverage gaps

The new browser cases address missing direct coverage for settled detail-error state, client detail-route denial, phase/task creation through the editor, assigned task member/date editing, detail hold/resume behavior at mobile width, team lead replacement rendering, and activity text/category filters. The new API cases address detail read scope and stale plan conflict/persistence.

Remaining verification limits are explicit: full-plan field boundaries are source-audited but not exhaustively exercised at every boundary; standalone POST/PATCH task endpoints are not called by the current UI; the new API regression confirms the standalone POST count-limit bypass (S15-002); and there is no browser test for every deliverable state/error permutation or keyboard/screen-reader audit. Post-terminal plan/task mutation remains an unresolved contract. No detail-page rename, cancel, archive, task-delete, or deliverable-create coverage was added because those controls/endpoints are unsupported on this page. NEX-006 remains the previously documented inaccessible creation wizard and is outside Page 15 detail scope.

The failing P15-001 case is a confirmed product defect, not an unresolved test expectation. The remaining new browser/API cases and compatibility checks passed.

## P. New browser tests

Added `apps/web/e2e/projects/workspace-details.spec.ts` with seven mocked-API browser cases:

| ID      | Assertion                                                                          | Result                    |
| ------- | ---------------------------------------------------------------------------------- | ------------------------- |
| P15-001 | After a 404 settles, show the error and clear the loading status                   | Fails; reproduces S15-001 |
| P15-002 | USER is redirected from a direct detail URL and detail data is not requested       | Pass                      |
| P15-003 | Add a plan phase/task, save, and observe saved plan values                         | Pass                      |
| P15-004 | Department head assigns an approved project member and due date to a task          | Pass                      |
| P15-005 | Hold/resume controls update status at 390px without page-level horizontal overflow | Pass                      |
| P15-006 | Replacing the project team lead updates the team row                               | Pass                      |
| P15-007 | Activity search and type filters return only matching events                       | Pass                      |

These cases use mock responses and are classified `MOCKED_UI_VERIFIED`; they do not claim live frontend/backend/database integration. The error-state assertion is deliberately retained as a failing regression for administrative review.

## Q. New API tests

Added `apps/api/tests/project-workspace-details.test.ts`, using `tests/support/pglite-app.ts`:

- **P15-API-001:** role access, head/assignment scope, 404 cross-scope isolation, malformed-ID 400, read permission flags, and response sanitization.
- **P15-API-002:** valid plan persistence followed by a stale `expectedUpdatedAt` write; stale request returns 409 and the persisted JSON remains the accepted version.
- **P15-API-003:** create a phase with 50 tasks, then call the standalone task endpoint. It expected a 400 count-limit rejection but received 200 and observed 51 persisted tasks, confirming S15-002.

P15-API-001/002 pass and are classified `ISOLATED_API_VERIFIED`. P15-API-003 is an isolated, failing validation regression. The test file has one top-level suite and three nested cases.

## R. Execution results

| Check                                                    | Result                                                                                                                                                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial discovery after merge                            | 476 tests / 65 files, exit 0                                                                                                                                                           |
| Final Playwright discovery                               | 483 tests / 66 files, exit 0                                                                                                                                                           |
| New Page 15 browser file                                 | 6 passed / 1 failed; the failure is P15-001/S15-001                                                                                                                                    |
| Existing Page 15 and compatibility browser selections    | 8 passed / 0 failed: NEX-008, NEX-009, shared detail recovery at 1440px/390px for Project Details and Project Workspace, and project-chat deliverable submission/retry at 1440px/390px |
| New Page 15 PGlite API test                              | 2 nested cases passed and P15-API-003 failed (4 runner tests including parent suite); failure confirms a 51-task persisted plan                                                        |
| Existing workspace + project-conversation PGlite modules | 10 runner tests passed, 0 failed; includes NEX-003/004/005/015 and workspace conversation delivery/pagination cases                                                                    |
| Browser live integration                                 | Not run; browser cases mock API responses                                                                                                                                              |
| Isolated API test environment                            | PGlite in-memory; no shared or live database                                                                                                                                           |
| `pnpm format`                                            | Passed, exit 0                                                                                                                                                                         |
| `pnpm lint`                                              | Passed, exit 0; `--max-warnings 0`                                                                                                                                                     |
| `pnpm typecheck`                                         | Passed, exit 0 for web and API                                                                                                                                                         |

The initial API test attempt exposed a missing RequestWorkflow relation in the new test fixture; the fixture was corrected, and P15-API-001/002 passed. P15-API-003 then confirmed the standalone task-count validation bypass. Initial browser iteration also exposed selector/test-harness issues (collapsed new phase, lower-case status labels, and a missing mock for the staffing workflow read); those test-only issues were corrected. The updated web typecheck passed before browser rerun. The pnpm store lock and test-worker launch were blocked by sandbox restrictions on first attempts; the same workspace commands passed after sandbox review. Detailed logs are in the evidence folder.

## S. Defect register

| ID      | Classification     | Finding and evidence                                                                                                                                                                                                                                                | Disposition                                                                                     |
| ------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| S15-001 | APPLICATION_DEFECT | A settled 404 displays “Project workspace not found” and still leaves `<p role="status">Loading project…</p>` visible. Rendering keys only on `!workspace`, not the async resource loading/error state. P15-001 reproduced twice; trace and error context retained. | Preserved as a failing test. Application code was not changed, per task restrictions.           |
| S15-002 | VALIDATION_DEFECT  | Standalone `POST /:id/projects/:projectId/tasks` adds and persists a 51st task to one phase (HTTP 200), bypassing the 50-task limit enforced by the editor and full-plan validator. Confirmed by P15-API-003 in PGlite.                                             | Preserved as a failing API regression. Application code was not changed, per task restrictions. |

No authorization or persistence defect was found in the tested Page 15 paths. The earlier missing-workflow fixture and browser selector failures were test implementation defects and were corrected; they are not product defects. The PGlite client emitted a deprecation warning during runs.

## T. Historical defect reassessment

- NEX-003, NEX-004, NEX-005, NEX-008, NEX-009, and NEX-015 were directly re-executed in their relevant API/browser modules and passed.
- NEX-006 remains the previously documented inaccessible creation wizard; it is not a Page 15 detail feature and was not relabeled resolved.
- NEX-007 rename/cancel/archive scope remains on the directory page. Rename/cancel tests in the workspace API module passed; no detail-page controls were invented.
- NEX-011 and the accepted team-lead-removal limitation remain unchanged. Lead replacement is supported and passed; no lead-removal operation exists.
- NEX-017 notification findings and Page 13/14 findings were not marked resolved. No unrelated notification or list-page defects were retested here.

## U. Integration limitations

Playwright verifies UI behavior against route mocks; PGlite verifies backend behavior in isolated PostgreSQL-compatible memory. No live frontend/API/database integration was run. The recent development merge had no direct Page 15 implementation or route-test changes, but its calendar refactor makes no claim here about broad calendar/workload behavior beyond the existing NEX-015 project lead scope test.

The legacy historical verifier was not run. Its documented PW-149, PW-037, and PW-001 discrepancies remain; this report does not claim a clean 292-identity/1,630-site verifier result. Current discovery is distinct from historical identity, assertion-site, and mapping counts.

## V. Historical preservation

The accepted historical inventory remains 292 original Playwright identities, 1,630 assertion sites, and 4,211 ownership mappings. Accepted Pages 1–14 remain intact, including 68 additional browser cases and 19 additional API cases. The pre-Page-15 post-merge discovery was 476 tests/65 files; Page 15 adds seven browser tests in one spec, yielding 483/66. The Page 15 API file adds three nested API cases. No historical mapping or baseline artifact was edited or overwritten. Page 14, its evidence, and accepted reports remain unchanged.

## W. Files changed

| Path                                                                                 | Change                                                        |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `apps/web/e2e/projects/workspace-details.spec.ts`                                    | New seven-case Page 15 browser regression spec                |
| `apps/api/tests/project-workspace-details.test.ts`                                   | New PGlite role/scope, stale-plan, and task-limit regressions |
| `docs/testing/verification/phase7/page-by-page/page-15-project-workspace-details.md` | This Page 15 report                                           |

Evidence logs and the P15-001 trace/error context are under `test-results/phase7/page-by-page/page-15-project-workspace-details/` and are ignored test artifacts. No application source, schema, migration, package manifest, lockfile, accepted Page 1–14 test, or historical baseline file was changed.

## X. Final recommendation

Submit Page 15 for administrative review as **COMPLETE WITH VERIFIED DEFECTS**. S15-001 is the reproducible UI loading-state defect in P15-001; S15-002 is the task-count validation bypass in P15-API-003. Both failing regressions remain visible, and either product fix requires separate authorization to edit application code. Post-terminal plan/task edits also need a documented contract decision. Stop here for review; do not begin Page 16 or Phase 7.5.

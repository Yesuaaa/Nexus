# Phase 7.4.1 — Page 23: Client Deliverable Details

**Audit status:** Complete for the authorized Page 23 scope; ready for administrative review with P23-001 and the inherited APP-DELIVERABLE-001 open. No production fix was authorized or made. This report does not claim production readiness or a passing 23-page suite.

## A. Overall status

The client deliverable detail route is `/projects/[id]/deliverables/[milestoneId]`. It presents a single client-visible milestone file, preview/download choices, a status for the current file version, and client approval or revision-request actions. Ownership and server-side file checks are enforced independently of the frontend route.

One distinct Page 23 application defect was reproduced: failed downloads are not surfaced and result in an uncaught browser error (P23-001). The previously accepted failed-review notification defect remains reproducible as APP-DELIVERABLE-001. The Page 23 browser spec therefore has one intentionally retained failing regression. Focused API, unit, and selected compatibility suites passed.

**Recommendation:** Submit Page 23 for administrative review with both findings visible. Do not interpret this as product readiness or full-suite acceptance.

## B. Git baseline

| Item                         | Initial baseline                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch                       | `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages`                                          |
| HEAD                         | `f66fce5a4cec3306a571e93e9a843180f6a1a68d` — `test(myProjects): add my projects help validation tests and phase 7 regression documentation` |
| Recent commits               | Page 22 My Projects, Page 21 Help, Page 20 Calendar, Page 19 Billing Logs, Page 18 Settings                                                 |
| Initial working tree         | Clean; no staged, modified, or untracked files                                                                                              |
| Merge state                  | No `MERGE_HEAD`                                                                                                                             |
| Initial `git diff --check`   | Clean                                                                                                                                       |
| Initial Playwright discovery | 526 tests in 73 specification files                                                                                                         |

The Page 22 files were already part of the Page 22 checkpoint commit. No branch switch, reset, commit, push, merge, or rebase occurred during this audit.

## C. Historical preservation

The accepted historical baseline remains **292 original Playwright identities, 1,630 assertion sites, 4,211 preservation mappings, and five intentionally skipped live-backend cases**. The accepted Page 1–22 tests and reports were present before this task. Their tests, assertions, skip states, and immutable Phase 4/6 files were not changed.

The unchanged `node scripts/verify-playwright-migration.mjs discover` command stopped at the known PW-149 title mismatch: the baseline expects “duplicate email registration displays inline server error alert,” while the current test uses “duplicate email registration displays server conflict feedback.” It reported no duplicate or unexpected identities. It did not reach later mappings; a new complete global identity/assertion/mapping pass is not claimed. Previously documented PW-001 and PW-037 redirect discrepancies remain historical limitations.

The verifier log and its uniquely named discovery artifact are retained under the Page 23 evidence directory or the verifier’s normal unique Phase 4 output directory. No historical artifact was edited to force a pass.

## D. Source inspection

| Source file                                                                                                  | Responsibility                       | Deliverable behavior / API relationship                                                                                                                                                                                      | Related tests                                                                |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `apps/web/src/app/(portal)/projects/[id]/deliverables/[milestoneId]/page.tsx`                                | Dynamic route entry                  | Passes project ID and milestone ID to `ClientDeliverablePage`; React key includes both IDs.                                                                                                                                  | New P23 browser spec; NEX-017                                                |
| `apps/web/src/features/projects/pages/client-deliverable-page.tsx`                                           | Client detail UI                     | Loads project detail; finds the milestone; previews supported MIME types; exposes download, approve, and revision-request controls.                                                                                          | P23-WEB-001–005; NEX-017                                                     |
| `apps/web/src/features/projects/components/client-project-forms.tsx`                                         | Client project dialogs               | `RequestDeliverableRevisionDialog` provides a required 3–2,000 character note, cancel, and submit controls.                                                                                                                  | P23-WEB-003; NEX-017                                                         |
| `apps/web/src/features/projects/api/projects-api.ts`                                                         | Client project API client            | `GET /api/projects/:id`, `GET /api/projects/:id/deliverables/:milestoneId/file`, and `POST .../review`; file methods create/revoke blob URLs and download using the workflow filename.                                       | P23-WEB-002/004; NEX-017                                                     |
| `apps/web/src/features/projects/pages/client-project-page.tsx`                                               | Project Details integration          | Lists only client-visible shared deliverables and links to the exact project/milestone route. It does not host the detail review controls.                                                                                   | P13 tests; NEX-017; P22-WEB-001                                              |
| `apps/web/src/features/workspaces/model/route-policy.ts`; `apps/web/src/components/layout/portal-layout.tsx` | Frontend route access                | Allows USER and STAFF through the projects route policy; denied roles are redirected to their role home/module.                                                                                                              | Route-policy and workspace-access unit tests; staff route compatibility test |
| `apps/api/src/features/projects/projects.controller.ts`; `projects.service.ts`                               | Authenticated client-facing API      | Scope project and deliverable reads to the authenticated account; file route returns bytes only after project, milestone, sent, visible, and client-scope predicates pass; review persists a version-specific client review. | NEX-014; P23-API-001                                                         |
| `apps/api/src/features/auth/auth.middleware.ts`; `auth.repository.ts`                                        | API session authentication           | Rejects absent/invalid/expired/revoked sessions and inactive or deleted users before route handlers.                                                                                                                         | Existing authentication tests; source audit                                  |
| `apps/api/src/features/project-workspace/project-workspace.controller.ts`; `project-workspace.service.ts`    | Separate internal delivery workflow  | Assigned staff upload/remove files; department heads approve/reject and share approved files. Uses internal workspace routes, events, and message delivery cards.                                                            | NEX-005; NEX-009; project conversation tests                                 |
| `apps/api/prisma/schema.prisma`                                                                              | Persisted relationships              | `ProjectMilestone` references one optional `WorkflowFile`; client reviews reference milestone, file version, and client; file bytes live in `WorkflowFile.data`.                                                             | NEX-005, NEX-014, P23-API-001                                                |
| `apps/web/e2e/projects/client-project-workflows.spec.ts`; `apps/api/tests/project-workspace.test.ts`         | Accepted client workflow regressions | NEX-017 covers linked review/revision and error recovery; NEX-014 covers file authorization, validation, duplicates, and persistence.                                                                                        | Re-run this audit                                                            |

## E. Functionality inventory

| Feature             | Supported behavior                                                                                                         | Inputs / persistence                                                                                   | Scope or limitation                                                                           | Coverage                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Deliverable summary | Shows title, project, filename, extension, shared/created date, MIME type, and optional description.                       | Read-only projection from `ProjectMilestone` and `WorkflowFile`.                                       | No edit, delete, or upload control.                                                           | P23-WEB-001; NEX-014                      |
| File preview        | Uses an iframe for `application/pdf`, `image/png`, `image/jpeg`, and `text/plain`.                                         | Authenticated file endpoint returns a blob; object URL is revoked on abort/unmount.                    | Other MIME types show a download fallback.                                                    | P23-WEB-001/002; NEX-017                  |
| File download       | Downloads a blob using the filename from workflow metadata.                                                                | Same authenticated file endpoint.                                                                      | A failed download currently has no handled UI feedback (P23-001).                             | P23-WEB-002/004; NEX-017 success path     |
| Client review       | Approves the current shared file or requests a revision with a note.                                                       | Review record keyed to client and workflow-file version; project timestamp is updated transactionally. | Only one review per client/file version; no review edit or client rejection action.           | P23-WEB-003/005; NEX-014; NEX-017         |
| Review state        | Shows “Awaiting your review,” “Approved,” or “Revision requested,” plus the saved revision note when present.              | Current review must match the current workflow file ID.                                                | The response projection contains only the newest client review; it is not a complete history. | P23-WEB-003/005; NEX-014                  |
| Navigation          | Returns to the project with `?tab=deliverables`. Project Details and project conversation delivery cards link to the page. | Route carries project and milestone identifiers.                                                       | Page has no direct Messages or conversation link.                                             | P23-WEB-001; selected compatibility tests |

Not supported on this client page: client file upload/deletion, client-side staff rejection, resubmission, revision-number display, multi-file list/expansion, full review history, approval comments, “reject” action, conversation navigation, inline retry, or a separate error-dismiss control. Internal approval/rejection/upload/share operations belong to Project Workspace.

## F. Interactive controls

| Control                           | Visibility                                           | Handler / API effect                                                               | Result and recovery                                                                                                    | Verification                                      |
| --------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Back to project deliverables link | Loaded detail page; named for project                | Link to `/projects/:id?tab=deliverables`                                           | Works by pointer or Enter key.                                                                                         | P23-WEB-001, desktop/tablet/phone                 |
| Download                          | Always shown beside preview                          | Calls `downloadClientDeliverable`; GET file endpoint                               | Browser download named from workflow file metadata. Failure is unhandled and unannounced.                              | P23-WEB-002/004                                   |
| Download file                     | Only for unsupported preview MIME                    | Same download handler and endpoint                                                 | Starts the file download; failure has no recovery UI.                                                                  | P23-WEB-002/004                                   |
| Approve deliverable               | No review for current file and project not CANCELLED | Opens confirmation dialog; confirm posts `{decision:"APPROVED", note:""}`          | On success, action controls disappear and inline “You approved this version.” appears.                                 | P23-WEB-005; NEX-017                              |
| Request a revision                | Same condition as approval                           | Opens labeled textarea dialog; submit posts trimmed note with `REVISION_REQUESTED` | Success replaces actions with revision state/note. API failure leaves the dialog and note usable but misses its toast. | P23-WEB-003; NEX-014; NEX-017                     |
| Cancel / Go back in dialogs       | While respective dialog is open; disabled while busy | Closes without API write                                                           | Revision dialog remounts with a fresh key when reopened.                                                               | Existing NEX-017 and shared Radix dialog behavior |

The preview iframe is not an application edit control; it is titled `Preview: <filename>`. There is no visible retry button. The page uses normal buttons and links, not forced clicks in the new tests.

## G. Client ownership

The route parameter `milestoneId` is validated by the projects router and is not a file ID. The file/review endpoints accept project ID and milestone ID only; no caller-supplied `clientId` or `fileId` can override the authenticated user.

`getClientDeliverableFile` requires all of: milestone ID match, project ID match, `clientProjectScope(authenticatedUserId)`, `SENT_TO_CLIENT`, and a related `WorkflowFile.clientVisible === true`. `reviewClientDeliverable` applies the same project owner scope, then checks the scoped shared milestone/file. A foreign project, mismatched project/milestone pair, private file, unsent file, or non-owner returns not-found rather than bytes or mutation. The project JSON projection omits file bytes and returns only safe file metadata and the authenticated client’s newest review.

PGlite evidence: NEX-014 denies an unauthenticated file request with 401 and foreign-client, STAFF, head, and ADMIN file/review requests with 404; it also denies a private/unsent milestone. P23-API-001 independently exercised unauthenticated, foreign USER, STAFF, ADMIN, and SUPERADMIN access. The owner retrieved isolated bytes and reviewed the owner’s completed-project deliverable. No production storage was used.

The middleware also returns 401 for invalid/expired tokens, deleted sessions, expired sessions, inactive accounts, and deleted accounts. Those session-state branches were verified from auth source; this Page 23 run did not create a separate endpoint test for each state.

## H. Authorization matrix

| Actor / state                           | Frontend route                                                       | Project detail                                                        | Client file preview/download               | Client review                                                     | Scope / response                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Active USER, owning an eligible project | Allowed                                                              | Allowed                                                               | Allowed for sent/client-visible milestones | Allowed once per current file version unless project is CANCELLED | Owner-scoped; foreign/private records return 404                                                   |
| Active USER, foreign project            | Route guard allows the URL                                           | 404                                                                   | 404                                        | 404                                                               | Identifier guessing does not change server scope                                                   |
| Active STAFF contributor                | Route guard allows the URL                                           | Allowed only within contributor scope                                 | 404 through client-only file service       | 404 through client-only review service                            | Project projection has `deliverables: []`; detail route then shows “Shared deliverable not found.” |
| Active department-head STAFF            | Route guard allows the URL                                           | Allowed only for current eligible department/project scope            | 404 through client-only file service       | 404 through client-only review service                            | Internal delivery review/share remains on Project Workspace routes                                 |
| ADMIN / SUPERADMIN                      | Denied by route policy; portal redirects internal users to `/module` | 404 unless a separate visibility rule applies (none for these routes) | 404                                        | 404                                                               | No client-deliverable privilege                                                                    |
| Unauthenticated                         | Portal session flow redirects to sign-in                             | 401 at API                                                            | 401                                        | 401                                                               | `requireAuth` runs before project service                                                          |
| Inactive / deleted user                 | No valid active portal session                                       | 401                                                                   | 401                                        | 401                                                               | Middleware checks `isActive` and `accountDeletedAt`                                                |
| Expired / revoked session               | Portal session is not valid                                          | 401                                                                   | 401                                        | 401                                                               | Middleware checks token/session expiration and session existence                                   |

The STAFF route admission is a documented Phase 0 compatibility irregularity: the route renders the client page, but the API does not return client deliverables to staff. The existing staff-route browser case reproduces the safe “Shared deliverable not found” outcome. This was retained as a contract limitation, not assigned a new Page 23 defect.

## I. Data projections

| Displayed field        | Database source                                                      | API field / frontend mapping                                                | Null handling / test                                      |
| ---------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------- |
| Title                  | `ProjectMilestone.title`                                             | `deliverable.title` → page heading                                          | Required; P23-WEB-001                                     |
| Project                | `Project.name`                                                       | `project.name`                                                              | Required for accessible breadcrumb/back link; P23-WEB-001 |
| File name              | `WorkflowFile.name`                                                  | `workflowFile.name`                                                         | Required schema field; also used for download filename    |
| Extension              | Derived from final `.<suffix>` in filename                           | Regex in component; otherwise “No extension”                                | No database field; P23-WEB-001                            |
| Shared date            | `ProjectMilestone.sentToClientAt`; fallback `WorkflowFile.createdAt` | `sentToClientAt ?? workflowFile.createdAt`, formatted with date preferences | No dedicated empty state; source-backed                   |
| MIME type              | `WorkflowFile.mimeType`                                              | `workflowFile.mimeType`                                                     | Required schema field; selects preview vs fallback        |
| Description            | `ProjectMilestone.description`                                       | `deliverable.description`                                                   | Nullable; omitted when empty                              |
| Review status and note | `ProjectDeliverableClientReview` for current client/file             | `clientReviews`, filtered by `workflowFileId` matching the current file     | Only newest review returned; note shown if nonempty       |

`expectedFileType`, the underlying milestone delivery status, internal reviewer, uploader ID, client-visible flag, file bytes, revision number, and internal rejection reason are not displayed in the client detail projection. The JSON endpoint selects safe file metadata; file bytes are isolated behind the authenticated file route.

## J. Deliverable lifecycle

The persisted internal milestone enum is `NOT_SUBMITTED`, `IN_REVIEW`, `REJECTED`, `APPROVED`, `SENT_TO_CLIENT`. The separate client review enum is `APPROVED`, `REVISION_REQUESTED`; these are not interchangeable states.

| Initial state                           | Action / actor                              | Result                                                                                                  | Persistence and coverage                                         |
| --------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `NOT_SUBMITTED`                         | Assigned staff uploads                      | `IN_REVIEW`; file remains private                                                                       | NEX-005 verifies upload and private file state                   |
| `IN_REVIEW`                             | Department head approves/rejects            | `APPROVED` or `REJECTED`; rejection needs a reason                                                      | NEX-005 verifies authorization and persisted transitions         |
| `APPROVED`                              | Department head shares                      | `SENT_TO_CLIENT`; file becomes client-visible and delivery is recorded in project conversation/workflow | NEX-005, NEX-009, project-conversation tests                     |
| `SENT_TO_CLIENT`                        | Owning client approves/revises current file | Adds client-review row; leaves internal delivery status intact                                          | NEX-014, P23-API-001, P23-WEB-003/005                            |
| `SENT_TO_CLIENT` in a CANCELLED project | Client tries to review                      | 409; no review row added                                                                                | NEX-014                                                          |
| `SENT_TO_CLIENT` in a COMPLETED project | Owning client reviews                       | Allowed unless cancelled; confirmed by P23-API-001 and P23-WEB-005                                      | Completed status is not treated as a terminal review prohibition |

Sharing and internal file replacement are separate from client review. A new workflow file ID is a new review version. Client approval/revision does not approve, reject, re-upload, or resubmit the milestone.

## K. Review and approval

Approval is a two-step client action: open `Approve this deliverable?`, then confirm. No review note, agreement checkbox, or file upload is required. A successful POST returns the updated project; the page refreshes its local project state, closes the dialog, removes the review actions, and shows “You approved this version.” The API creates a record tied to the exact current workflow file and client. A second decision for that version returns 409.

The available decision values are only `APPROVED` and `REVISION_REQUESTED`. There is no client `REJECTED` operation; internal department-head rejection is a separate workspace operation. P23-WEB-005 exercises keyboard activation of the approval button and confirmation on a COMPLETED project; NEX-017 covers pointer approval and the post-save inline state.

## L. Revision requests

The dialog’s label is “What should be revised?”; its textarea is `required`, has HTML `minLength=3` and `maxLength=2000`, displays a count, and disables submission when the trimmed JavaScript string has fewer than three code units. Submission trims the note. The service independently requires `REVISION_REQUESTED`, trims the string, enforces 3–2,000 characters, and rejects an invalid decision or an overlong approval note with 400. Missing/non-string note becomes empty; that is accepted for APPROVED but rejected for a revision.

P23-WEB-003 checks whitespace and two-code-unit emoji notes are disabled, the exact three-code-unit `🙂x` minimum is enabled, and the 2,000-character maximum submits while an extra keyboard character is blocked by the textarea. P23-API-001 confirms the Unicode minimum survives trimming and is persisted. NEX-014 covers a below-minimum note, over-maximum note, invalid decision, and duplicate response. NEX-017 verifies entered revision text remains after a failed response and the user can retry; its expected notification remains failing as recorded in O/V.

## M. File security

Files are stored in `WorkflowFile.data` as database bytes; this route does not use signed URLs or an external object-storage provider. Authentication precedes the project service. The server returns file MIME type, a fixed fallback filename plus RFC 5987 encoded original filename, byte length, `X-Content-Type-Options: nosniff`, and `Content-Security-Policy: sandbox; default-src 'none'`. It uses inline disposition only for PDF, PNG, and JPEG; other types are attachment responses. The browser obtains the response as a blob and uses an iframe for its supported list (including fetched `text/plain`) or a named download.

NEX-014 and P23-API-001 use PGlite data only and validate owner bytes, denied foreign/private records, and safe headers. P23-WEB-001 verifies the authenticated file path and titled iframe; P23-WEB-002 verifies an unsupported `application/zip` file falls back to a download with its Unicode source filename. P23-WEB-004 reproduces the separate failed-download UI defect. No real production storage was used. Empty files, expired signed URLs, missing storage objects, and independent foreign file IDs are not applicable to this DB-byte route or are not separate Page 23 test cases.

## N. Revision history and version consistency

The model associates each review with `milestoneId`, `workflowFileId`, and `clientId`, with a unique constraint on `(workflowFileId, clientId)`. The service locks the project before writing; duplicate review for the same file version returns 409. The page only treats a review as current when its `workflowFileId` equals the currently attached file ID. A new file can therefore be reviewed independently.

There is no client-visible version number, multi-file history, full status timeline, or previous-version review list. The project API returns at most the newest client review, not a review-history collection. The UI does not offer approval of a historical file version. These are current scope limitations, not invented or failing history requirements.

## O. Notifications

The NEX-017 failed review response was rerun independently. Its mocked API returns 503, the revision dialog remains open with the entered note, retry remains usable, and after retry succeeds the inline revision state updates. The expected “Couldn’t save your response” notice is absent. `client-deliverable-page.tsx` imports `sileo` directly, while the mounted toast viewport is requested through `@/lib/toast`; this reproduces the existing **APP-DELIVERABLE-001** root family. It is not a new Page 23 ID and is not resolved.

Successful review provides visible inline confirmation (“You approved this version.” or the revision state/note), confirmed by NEX-017 and P23-WEB-003/005. The component also calls the direct Sileo success API; a distinct toast was not required to verify the inline completion state.

P23-WEB-004 makes the download endpoint return 503. No “Couldn’t download file” notification or accessible error text appears. The rejected promise escapes from `void downloadClientDeliverable(...)` and the browser emits `File temporarily unavailable`. This is distinct from the review toast defect because the download handler has no catch or notification path. See P23-001 in V.

## P. Database integrity and persistence

The project review service validates input, starts a Prisma transaction, locks the Project row, checks active owner scope and project status, checks the exact sent/client-visible milestone, inserts via `createMany({skipDuplicates:true})`, and updates `Project.updatedAt` in the same transaction. Duplicate insert count zero becomes 409. It then calls `getProject` for read-after-write response projection. Failed validation, authorization, cancelled-project review, or duplicate insertion does not add another review.

`ProjectMilestone.workflowFileId` is unique. `ProjectDeliverableClientReview` belongs to a milestone and client and optionally references a file version; its unique `(workflowFileId, clientId)` constraint prevents multiple decisions on that file. P23-API-001 checks persisted note/version identity and duplicate row count; NEX-014 checks failed inputs leave the review table empty, successful read-after-write, duplicate 409, and CANCELLED 409 without extra persistence. A forced database failure after insert was not induced; atomicity follows from the service transaction and was not represented as a separately fault-injected test.

Client review does not append a workflow event, send a project message, or alter internal delivery status in the inspected service. Internal share does record a delivery card and workflow state/event in the separate Project Workspace service.

## Q. Loading, error, empty, and recovery

| Condition                               | Current behavior                                                                               | Coverage / limit                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Initial detail and preview load         | `role="status"` text “Loading deliverable…” persists while project JSON and preview bytes load | P23-WEB-006 gates and verifies both reads    |
| Missing/foreign milestone               | Error alert “Shared deliverable not found” plus Back to project                                | STAFF route case; NEX-017 file 404           |
| Project GET error / network failure     | Error alert with `errorMessage` and Back to project; re-enter/reload retries                   | NEX-017 503 and reload recovery              |
| Supported preview GET error             | Load fails into same error/back state                                                          | NEX-017 file error and reload recovery       |
| Unsupported MIME                        | “Preview unavailable” and “Download file” fallback                                             | P23-WEB-002                                  |
| Revision/approval POST error            | Dialog remains; busy state terminates; revision input stays; direct Sileo error is not visible | NEX-017 reproduces APP-DELIVERABLE-001       |
| Download GET error                      | No handled alert/retry; rejected promise reaches `pageerror`                                   | P23-WEB-004 / P23-001                        |
| No deliverable in response              | Treated as missing shared deliverable, not an empty page                                       | Source-backed; this is a single-record route |
| Optional description/review note absent | Field/note block is omitted                                                                    | Source-backed conditional rendering          |

There is no inline retry button or error dismissal control. Reloading or navigating back and reopening triggers another read. The download action remains visible, but current failure feedback is absent. HTTP 400/401/404/409/503 are covered by the API or focused mocked browser cases described above; 422 is not part of these endpoint contracts, and a separate 500 injection was not performed.

## R. Cross-page integration

| Origin                           | Integration and result                                                                                                                                                                                       | Test evidence                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| My Projects                      | Client list links to the matching project. Its project detail provides the shared deliverable link when present.                                                                                             | P22-WEB-001 passed; NEX-017 list-to-detail sequence remains affected by APP-TABLE-001, outside Page 23 scope |
| Project Details                  | The detail page emits a route using matching project and milestone IDs and the Page 23 back link returns with `?tab=deliverables`. Existing section navigation defect P13-001 remains separately documented. | P23-WEB-001, NEX-017; P13-002 compatibility passed                                                           |
| Project Workspace                | Internal staff upload and head review/share are separate; sharing makes the client link/file available.                                                                                                      | NEX-005 API, NEX-009 browser, client workspace handoff compatibility passed                                  |
| Messages / project conversation  | Delivery cards link to the matching `/projects/:projectId/deliverables/:milestoneId`; Page 23 has no direct Messages link.                                                                                   | Selected client chat and P13-002 conversation tests passed                                                   |
| STAFF direct compatibility route | Route policy admits STAFF, but client projection is empty; page displays safe missing-shared-deliverable state.                                                                                              | Existing staff route regression passed                                                                       |

Selected integration results are not a full project/client/messages suite run. Existing Page 12 and Page 22 findings were not changed or reclassified.

## S. Accessibility and responsiveness

The page uses an `h1` deliverable title, `h2` sections, definition-list metadata, a labeled preview iframe, an explicitly named Back link, semantic buttons, a labeled revision textarea, and shared Radix dialog primitives. Initial loading uses `role="status"`; load errors use the shared `Alert` role. Approval’s confirmation and revision dialog can be opened/submitted with normal keyboard activation; P23-WEB-001 tests Enter on the back link and P23-WEB-005 tests Enter through approval confirmation. Browser interactions use normal pointer clicks, without forced-click bypasses.

The page was run at 1440px, 768px, and 390px. The direct detail regression checks no horizontal document overflow at each width and stores full-page PNGs in the evidence output directory. Unsupported-MIME download and note validation were exercised at 390px. A tablet-specific manual assistive-technology audit was not performed; the controls rely on native HTML and Radix semantics.

## T. Existing regression coverage

| Identity / source                                                  | Existing coverage and current result                                                                                                                                                                                              |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NEX-005 — `apps/api/tests/project-workspace.test.ts`               | Assigned staff upload/remove, internal reviewer access, head approve/reject, share, file visibility, and persisted transitions; passed in selected API run.                                                                       |
| NEX-009 — `apps/web/e2e/projects/workspace-deliverables.spec.ts`   | Internal staff/head deliverable workflow before client sharing; passed.                                                                                                                                                           |
| NEX-014 — `apps/api/tests/project-workspace.test.ts`               | Client ownership, shared/private file access, bytes, review validation, duplicates, persistence, and cancelled-project denial; passed.                                                                                            |
| NEX-017 — `apps/web/e2e/projects/client-project-workflows.spec.ts` | Client project/detail, review/revision, failed-response recovery, list/detail loading and reload, and head request review. Focused detail error/reload passed; the client review notification case failed as APP-DELIVERABLE-001. |
| P13-001/002/003 — `project-details-regression.spec.ts`             | Project section nav/chat/brief feedback. P13-002 passed in compatibility run; P13-001 and P13-003 remain prior findings and were not retested here.                                                                               |
| P22-API-001 / P22-WEB-001 — My Projects                            | Owner filtering and list-to-project links; both selected API/browser regressions passed.                                                                                                                                          |
| `project-conversations` API/browser tests                          | Delivery card route/authorization context and project Messages handoff; selected API and browser cases passed.                                                                                                                    |
| Web unit tests                                                     | Route policy, workspace access characterization, project status contract; selected 21 tests passed.                                                                                                                               |

## U. New regression additions

| Identity                       | File                                                               | Behavior                                                                                                                      | Result / gap                                       |
| ------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| P23-WEB-001 (3 viewport cases) | `apps/web/e2e/projects/page-23-client-deliverable-details.spec.ts` | Detail projection, text preview, project back link by keyboard, no horizontal overflow at 1440/768/390px.                     | Passed; saves responsive screenshots.              |
| P23-WEB-002                    | Same                                                               | Unsupported MIME fallback and Unicode filename download on phone width.                                                       | Passed.                                            |
| P23-WEB-003                    | Same                                                               | Trimmed Unicode min and exact 2,000-character note boundary.                                                                  | Passed.                                            |
| P23-WEB-004                    | Same                                                               | Failed download response should provide accessible recovery feedback.                                                         | Retained failing regression; demonstrates P23-001. |
| P23-WEB-005                    | Same                                                               | Keyboard approval confirmation on a COMPLETED project; verifies one current-file review write and inline success.             | Passed.                                            |
| P23-WEB-006                    | Same                                                               | Loading status remains visible through gated project and file requests, then resolves to the detail.                          | Passed.                                            |
| P23-API-001                    | `apps/api/tests/page-23-client-deliverable-details.test.ts`        | PGlite ownership/role-denial checks, completed-project review, Unicode minimum, version response, persistence, duplicate 409. | Passed.                                            |

The new API test is separate from accepted NEX-014 and uses `tests/support/pglite-app.ts`. No new browser or API test is skipped. Existing accepted cases were not weakened or edited.

## V. Execution and defects

| Execution                         | Result                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Initial Playwright `--list`       | 526 tests / 73 spec files                                                                                                                  |
| Final Page 23 browser spec        | 8 cases: 7 passed, 1 failed (P23-WEB-004)                                                                                                  |
| Accepted NEX-017 deliverable case | 1 failed at expected “Couldn’t save your response” toast (APP-DELIVERABLE-001); retry/persistence sequence otherwise remains usable        |
| Selected browser compatibility    | 6 passed: P22-WEB-001, P13-002, NEX-009, NEX-017 loading/error/reload, client workspace handoff, client chat deliverable link              |
| STAFF route compatibility         | 1 passed; route remains admitted while foreign/client-only data is hidden                                                                  |
| API / PGlite compatibility        | 12 passed, 0 failed/skipped: new P23-API-001, P22-API-001, NEX-003 parent with NEX-004/005/013/014/015/016, and project conversation cases |
| Web unit compatibility            | 21 passed, 0 failed/skipped                                                                                                                |
| Historical verifier               | Stops at known PW-149 title mismatch; no duplicate/unexpected identities; later mappings not reached                                       |

### Confirmed finding: P23-001

- **Title:** Failed client deliverable downloads have no handled feedback and leak a rejected promise.
- **Severity:** Medium.
- **Classification:** `APPLICATION_DEFECT`.
- **Responsible source:** `apps/web/src/features/projects/pages/client-deliverable-page.tsx` invokes `void downloadClientDeliverable(...)` without a rejection handler; `apps/web/src/features/projects/api/projects-api.ts` rejects on non-success file responses and has no download error state.
- **Reproduction:** Open an unsupported-MIME deliverable, return HTTP 503 with `File temporarily unavailable` from its authenticated file GET, and activate “Download file.”
- **Expected:** Accessible failure feedback and a usable retry path; no uncaught browser rejection.
- **Actual:** No “Couldn’t download file” notice or recovery alert appears; the browser records `File temporarily unavailable`. The download button remains visible but does not explain/recover from failure.
- **Regression:** P23-WEB-004, retained failing.
- **Evidence:** `browser-p23-final.log`, its trace and `error-context.md` under `artifacts-browser-page23-final`.
- **Status:** Open; production code intentionally unchanged.
- **Relationship:** Distinct from APP-DELIVERABLE-001; this handler drops a download promise, while APP-DELIVERABLE-001 is the review handler’s direct Sileo notification failing to mount.

### Reassessed existing finding: APP-DELIVERABLE-001

- **Classification:** `APPLICATION_DEFECT`; existing identity retained, no duplicate P23 ID.
- **Source:** `client-deliverable-page.tsx` calls `sileo.error` from the `sileo` package directly; `AuthProvider` mounts the viewport based on the shared `@/lib/toast` event.
- **Reproduction/result:** Focused NEX-017 run returns a review 503 and cannot find the expected error notice. The dialog and note remain available for retry; successful retry updates state.
- **Evidence:** `nex017-deliverable.log`; the existing test was not modified.
- **Status:** Open; no production code changed.

### Other classifications

- The first new-browser run exposed a test fixture defect: `restoreSession` seeded `sessionStorage` in the opaque blob iframe. Replaced that helper with `mockApi` plus a top-frame-only init script; subsequent P23-WEB-001/002/003/005/006 passed. Classification: `TEST_IMPLEMENTATION_DEFECT`, corrected in the new spec only.
- An initial Playwright command’s relative evidence path resolved outside the workspace. It was rerun with absolute output/log paths; this was an invocation/evidence-path issue, not an application result.
- The STAFF route behavior is a documented compatibility limitation, not a new unauthorized-data exposure: the API returned no client deliverable projection and the page showed not found.

## W. Preservation and quality gates

The initial discovery was **526 / 73**. Page 23 adds one spec file with eight Playwright cases; final discovery is **534 / 74**. The accepted historical 292 / 1,630 / 4,211 baseline was not rewritten. Exactly two new test source files and this report are in scope; evidence files are in the requested Page 23 evidence directory.

| Required check             | Result                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm format`              | Passed; the new report was formatted and accepted Page 1–22 reports were unchanged. |
| `pnpm lint`                | Passed with `--max-warnings 0`.                                                     |
| `pnpm typecheck`           | Passed for web and API, including API test types.                                   |
| `git diff --check`         | Passed; clean.                                                                      |
| Final Playwright discovery | 534 tests in 74 specification files.                                                |

The standard sandboxed pnpm launcher initially could not open the package-manager store lock (`ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK`, access denied). Authorized local process retries completed the focused test commands. No approval rejection occurred. Full Playwright suite was not run; live-backend cases were not run; the five historical live-backend skips remain unchanged.

No accepted Page 1–22 test was modified. No historical assertion was weakened. No test was removed or newly skipped to conceal a failure. No production frontend/backend source, Prisma schema, dependency, or lockfile changed. No commit or push occurred. Phase 7.5 and final regression closeout were not started.

## X. Final recommendation

Page 23 source inspection, focused regression additions, API isolation, compatibility selections, and defect reassessment are complete. Recommend administrative review with P23-001 and APP-DELIVERABLE-001 open and the historical verifier limitation stated. The full 23-page suite and production readiness are not claimed. Stop here for administrative review.

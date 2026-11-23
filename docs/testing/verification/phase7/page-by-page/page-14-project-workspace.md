# Phase 7.4.1 — Page 14: Project Workspace (`/project-workspace`)

**Audit status:** COMPLETE WITH ACCEPTED LIMITATIONS  
**Administrative status:** Awaiting review; Codex does not accept pages.  
**Audit date:** 2026-11-14  
**Scope:** Page 14 only. Page 15 and Phase 7.5 were not started.

## A. Page status

Page 14 is ready for administrative review with the NEX-006 wizard limitation preserved. The directory, sorting, status/search/archive behavior, manager row actions, route authorization, and API list scope were inspected. Four browser cases and one isolated PGlite API case were added. No application or backend defect was confirmed.

The official 23-page inventory and the regression handoff both identify Page 14 as `/project-workspace`. The auxiliary `/project-workspace/new` route is outside that inventory and is documented as redirecting to the list. See `docs/testing/verification/phase7/phase7.1-baseline.md:172,194-206` and `docs/testing/handoffs/converyn-playwright-regression-handoff.md:167,178`.

## B. Git baseline

| Checkpoint | Branch                                                                                             | HEAD                                       | Worktree                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Initial    | `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages` | `5624c8b9d4e2d260ee61b725955dd6fb04924f60` | Clean; no staged, modified, or untracked files                                                                  |
| Final      | Same                                                                                               | Same                                       | Three new repository files: this report and two test files; evidence is in the ignored `test-results` directory |

No branch, history, or remote operation occurred. No commit or push occurred. Page 13’s committed baseline was preserved. The Page 14 prompt recorded `ad8c3e7…` as its expected HEAD; the actual HEAD was later at `5624c8b…` and was retained.

## C. Source inspection

### Frontend

- Route entry: `apps/web/src/app/(portal)/project-workspace/page.tsx` renders `ProjectWorkspacePage`.
- Auxiliary creation route: `apps/web/src/app/(portal)/project-workspace/new/page.tsx` calls `redirect("/project-workspace")`.
- Directory: `apps/web/src/features/project-workspace/pages/project-workspace-page.tsx`.
- List rows and detail links: `apps/web/src/features/project-workspace/components/workspace-list-table.tsx`.
- Rename/cancel row actions: `apps/web/src/features/project-workspace/components/workspace-list-row-actions.tsx`.
- The four-step dialog exists in `apps/web/src/features/project-workspace/pages/new-workspace-page.tsx`, but repository search found no import or caller for `NewWorkspaceDialog`.
- Role policy: `apps/web/src/features/auth/model/permissions.ts` and `apps/web/src/features/workspaces/model/route-policy.ts`.
- API client/types: `apps/web/src/features/project-workspace/api/project-workspace-api.ts`.
- Shared loading and table behavior: `apps/web/src/lib/use-async-resource.ts`, `apps/web/src/components/ui/responsive-data-table.tsx`, and `apps/web/src/components/ui/animated-data-row.tsx`.

### Backend and database

- Router: `apps/api/src/features/project-workspace/project-workspace.controller.ts`.
- Business logic, scope, validation, and persistence: `apps/api/src/features/project-workspace/project-workspace.service.ts`.
- Models and enums: `apps/api/prisma/schema.prisma` (`ProjectStatus`, `ProjectWorkspaceStructure`, `Project`, `ProjectWorkspaceGroup`, `ProjectStaff`, `Employee`, `Team`, and `ProjectMilestone`).
- Existing PGlite lifecycle/API tests: `apps/api/tests/project-workspace.test.ts`; new Page 14 list authorization test: `apps/api/tests/project-workspace-directory.test.ts`.

### Documentation

Reviewed the regression handoff, new-chat handoff, Page 7 and Page 13 reports, Phase 7.1 route inventory, regression-failure investigation, Phase 6 approved deltas/reconciliation, Phase 5 workspace backlog, and `docs/features/modular-workspace-characterization.md`. The listed `page-07-departments.md` name does not exist; the accepted equivalent is `page-07-department-management.md`.

## D. Complete feature inventory

| Feature             | Implemented behavior                                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Directory data      | `GET /api/project-workspace`; rows are grouped by `workspaceGroupId`, with ungrouped projects represented as single-project workspaces.                                                                                   |
| Summary             | KPI cards show total projects, in-progress projects, services/workstreams, and completed tasks derived from saved work plans.                                                                                             |
| Row fields          | Project/workspace name, client, service names, aggregate status, last-updated date, and actions. Department, department head, assigned team, project reference, deadline, and project progress are not directory columns. |
| Search              | Local, trimmed, case-insensitive match across workspace name, client name, service name, and workstream name. Search is capped at 100 characters in the input.                                                            |
| Status filter       | Local filter. Active view offers `PLANNED`, `IN_PROGRESS`, and `ON_HOLD`; archive view offers `COMPLETED` and `CANCELLED`.                                                                                                |
| Archive view        | A toggle switches between active and ended projects and clears the current search/status selection. It is a view, not a separate archive mutation.                                                                        |
| Sorting             | `recent` or `most-active` is sent to the list API. `most-active` sorts by activity count, then latest update.                                                                                                             |
| Pagination          | No directory pagination controls or page/cursor state are implemented. API list defaults to 200 projects and clamps a supplied limit to 1–250. No confirmed product defect was established from this limit.               |
| Details navigation  | Workspace-name links encode the workspace ID and navigate to `/project-workspace/[id]`. The directory does not link directly to plans, tasks, deliverables, or conversations.                                             |
| Loading/empty/error | Skeleton rows, active/archive empty states, no-filter-match text, an error alert, and “Try again” are implemented.                                                                                                        |
| Responsive layout   | The table becomes stacked rows at the component’s 900px container breakpoint; controls become full-width on narrow viewports.                                                                                             |
| Creation            | No create/new control is rendered in this directory. The workspace creation dialog is source-present but unmounted.                                                                                                       |

Workspace status aggregation uses the first matching state in this priority: `IN_PROGRESS`, `ON_HOLD`, `PLANNED`, `CANCELLED`, then `COMPLETED` (`project-workspace.service.ts:302-307`).

The table, search, filter, sort, menu, and dialog controls have accessible names in source. Existing regression coverage checks confirmation focus and role-based controls. No standalone automated accessibility scan was run.

## E. Interactive control inventory

| Control                        | Result                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `Search projects`              | Filters the currently loaded rows locally.                                                                    |
| `Filter projects by status`    | Locally filters status within active/archive view.                                                            |
| `Sort projects`                | Reloads the directory with the selected `sort` query value.                                                   |
| `Archive` / `Back to Projects` | Switches view and clears search/status.                                                                       |
| Workspace name                 | Opens the encoded workspace details URL.                                                                      |
| Row action menu                | For active rows with `canManage=true`: View project, Edit project, Cancel project.                            |
| View link                      | For non-manageable or archived rows, provides read-only navigation.                                           |
| Edit project modal             | Project name field, Close, Save name. Failure remains visible in the dialog; success triggers a list refresh. |
| Cancel confirmation            | Keep project or confirm Cancel project. Success refreshes the list and the cancelled row appears in Archive.  |
| Try again                      | Retries the failed list request.                                                                              |

There is no directory control for create, restore, delete, hold/resume, complete, team editing, or project assignment. Status transition actions and plan/task/deliverable controls belong to workspace details (Page 15) and were not audited here.

## F. NEX-006 wizard assessment

**Disposition: STILL BLOCKED — ACCEPTED LIMITATION.**

- `/project-workspace/new` exists as a route file but redirects to `/project-workspace` before rendering the dialog.
- `NewWorkspaceDialog` contains a four-step source implementation (Bookings, Structure, Templates, Review), but no caller mounts it.
- The directory has no visible creation entry point and does not consume its list response’s `canCreate` property.
- The route policy admits STAFF to the auxiliary route; a department head still receives the redirect. USER is denied by the portal route policy and is redirected to `/dashboard`.
- A browser regression verified the head redirect, the absence of a create control/dialog, and the absence of booking/template/create API requests. A separate browser regression verified the USER denial without a workspace request.
- API workspace creation remains available at `POST /api/project-workspace`, restricted to a current department head and eligible approved bookings. Existing NEX-003 PGlite coverage verifies successful API creation and reread persistence. That is not evidence of wizard accessibility.
- Request-workflow project activation is a separate existing flow that activates a project after its workflow prerequisites and links to a workspace. It is not the Page 14 wizard or an equivalent successful NEX-006 browser journey.

The current Phase 7.1 inventory and handoff agree with the source. An older Phase 5 backlog entry (`docs/testing/coverage/phase5/phase6-backlog.md:28`) describes a supported wizard test path; that entry is stale relative to the later approved blocked disposition. Treat this as documentation drift, not proof the wizard works.

## G. Input validation

| Input                                      | Frontend behavior                                                                                                | Backend/database behavior                                                                                                                                                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Directory search                           | Optional string, maximum 100 characters; whitespace is trimmed for matching; no-result state is rendered.        | No search query is sent to the API.                                                                                                                                                                                        |
| Rename name                                | Required input, `minLength=2`, `maxLength=120`; Save is disabled when the trimmed value is under two characters. | Trims input; rejects lengths outside 2–120 with 400. No character whitelist or explicit duplicate-name rule is present. `ProjectWorkspaceGroup.name` has a 200-character database column but no unique constraint.         |
| Wizard booking IDs (source-only)           | Requires at least one booking; selection UI allows at most eight and only one client.                            | One to eight unique URL-safe IDs, each 1–80 characters; must still be eligible, approved, unassigned, and in the head’s department.                                                                                        |
| Wizard structure/name (source-only)        | `SEPARATE` or `MULTI_WORKSTREAM`; multi-workstream name requires at least two characters.                        | Structure enum checked; multi-workstream name is trimmed and must be 2–120 characters.                                                                                                                                     |
| Wizard templates/custom plan (source-only) | Template required per selected booking; custom plan requires at least one named phase and no blank task title.   | Template key must be recognized. Plans allow 1–20 phases, at most 50 tasks per phase, phase title up to 120, task title up to 180, role up to 80, valid unique IDs, record employee IDs, and valid `YYYY-MM-DD` due dates. |

The wizard fields are not reachable through a supported browser path; the source-only wizard constraints are not presented as browser-verified validation.

## H. API contracts

All routes are mounted at `/api/project-workspace` and protected by `requireAuth`. Path IDs are checked by `recordIdParam` (invalid ID: 400). The workspace service then applies active-STAFF, assignment, and Department Head rules.

| Method/route                             | Page 14 relevance             | Authorization and contract                                                                                                                                                                              |
| ---------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /`                                  | Directory                     | STAFF only. `sort` accepts `most-active`; other values fall back to recent. Positive integer `limit` is passed through and service-clamped to 1–250 (default 200). Returns `{ workspaces, canCreate }`. |
| `GET /templates`                         | Wizard API dependency         | Active STAFF; returns the server template catalog.                                                                                                                                                      |
| `GET /approved-bookings`                 | Wizard API dependency         | Department Head only; returns approved, ungrouped, non-ended projects assigned to that head’s department.                                                                                               |
| `POST /`                                 | Wizard API contract           | Department Head only; 201 with `{ workspaces: [{ id, name }] }`. Validates IDs, structure, templates, name/custom plan, one client, approval, and current eligibility in a transaction.                 |
| `GET /:id`                               | Destination of directory link | Active STAFF; head/department scope or assigned-project scope; inaccessible records return 404.                                                                                                         |
| `PATCH /:id`                             | Rename row action             | Department Head for every project in the workspace; trims/validates name; 200 `{ saved: true }`; invalid input 400, unauthorized manager 403, missing/out-of-scope 404, archived rename 409.            |
| `POST /:id/cancel`                       | Cancel row action             | Department Head for every project in the workspace; active/planned/on-hold projects become CANCELLED transactionally; repeated/ended cancellation conflicts with 409; success 200 `{ saved: true }`.    |
| `POST /:id/status`                       | Details-only boundary         | Department Head. Actions are `ON_HOLD`, `RESUME`, and `COMPLETE`; invalid action 400; invalid state/prerequisite or concurrent update 409. Not a Page 14 directory control.                             |
| `PUT /:id/projects/:projectId/team-lead` | Details-only boundary         | Department Head; validates workspace/project scope and an active assigned employee in the accepted department. Assignment/reassignment is supported; no Page 14 team control exists.                    |

Plan/task/deliverable routes in the same controller are Page 15 scope and are not expanded here. The API response shape matches the frontend TypeScript client types. Browser tests mock these responses; the new PGlite test exercises the real list route.

## I. Authorization matrix

| Actor                                           | UI directory/details route                     | API list/details                                                                                                   | Create workspace                                                                                       | Rename/cancel/status/team-lead                                          |
| ----------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `SUPERADMIN`                                    | Denied                                         | 403                                                                                                                | 403                                                                                                    | 403                                                                     |
| `ADMIN`                                         | Denied                                         | 403                                                                                                                | 403                                                                                                    | 403                                                                     |
| `STAFF` without head assignment                 | Allowed                                        | List/detail scope is projects assigned to that STAFF user                                                          | 403                                                                                                    | 403 for mutations; can view but cannot manage                           |
| Department Head (`STAFF` with current `headOf`) | Allowed                                        | Department-scoped list/details; `canManage` is true only for workspaces whose accepted department is one they head | Allowed by API for eligible approved bookings in the headed department; no Page 14 browser entry point | Allowed for workspaces whose projects all belong to a headed department |
| `USER`                                          | Denied; direct route redirects to `/dashboard` | 403                                                                                                                | 403                                                                                                    | 403                                                                     |

Department Head status is derived from the user’s current `headOf` relation, not role name alone. A head’s read scope includes `departmentId` and `headOf` department IDs; mutation scope requires the accepted department in `headOf`. Non-head STAFF list/detail scope uses project assignment (`ProjectStaff.employee.userId`). The added API test verified two departments, head-only department results, assignment-only STAFF results, and 401/403 denial for anonymous, USER, ADMIN, and SUPERADMIN requests.

The matrix is source-backed for all listed operations. P14-API-001 exercises the list endpoint; the existing NEX-003 PGlite lifecycle case covers non-head STAFF versus Department Head creation/rename/cancel behavior.

## J. Workspace lifecycle

Prisma `ProjectStatus` values are `PLANNED`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED`, and `CANCELLED`. The directory treats the first three as active and the last two as archived.

| Operation                | Actor and transition                                                                                                                                                    | Persistence/failure behavior                                                                                                                                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create through API       | Department Head; approved booking project begins in its current/default status; wizard groups one or more projects as separate or multi-workstream.                     | Transaction creates `ProjectWorkspaceGroup`, associates projects, stores template/work plan, and writes workflow events. NEX-003 existing PGlite coverage verifies successful creation/reread and rejected stale/unapproved input without partial state. |
| Rename                   | Department Head; active workspace only.                                                                                                                                 | Group or standalone project name is changed, workflow events are written transactionally; trimmed 2–120 name; archived workspace gives 409.                                                                                                              |
| Cancel                   | Department Head; `PLANNED`, `IN_PROGRESS`, and `ON_HOLD` projects become `CANCELLED`.                                                                                   | Conditional update and event writes are transactional; repeated/ended action gives 409; list refresh moves it to Archive.                                                                                                                                |
| Hold                     | Department Head; `IN_PROGRESS` → `ON_HOLD`.                                                                                                                             | No eligible project gives 409; conditional update and events are transactional. Details-only API action.                                                                                                                                                 |
| Resume                   | Department Head; `ON_HOLD` → `IN_PROGRESS`.                                                                                                                             | No on-hold project gives 409. Details-only API action.                                                                                                                                                                                                   |
| Complete                 | Department Head; active/on-hold projects can complete only after every task is DONE and every deliverable is SENT_TO_CLIENT; cancelled/planned states block completion. | Preconditions and concurrent state are checked; failure returns 409 without a successful completion. Details-only API action.                                                                                                                            |
| Workspace restore/delete | Not implemented as Page 14 actions or workspace API operations.                                                                                                         | The controller has a details-scope deliverable-attachment DELETE route, but no workspace delete/restore route. No restore/delete outcome was invented or tested.                                                                                         |

Page 14 UI exposes rename and cancel only. Lifecycle API behavior is source-inspected; existing NEX-003 PGlite evidence covers creation, rename/cancel, invalid transitions, and persistence. No live database integration was performed.

## K. Team relationships

The directory does not display or edit Department, team, team lead, assigned employees, or staffing. Its row-level manage flag is based on Department Head authority for every project in the grouped workspace. A distinct project team-lead API is used by workspace details.

Prisma derives department scope through `ServiceRequest.acceptedDepartmentId`; `Project` relates to `ServiceRequest`, client `User`, optional `ProjectWorkspaceGroup`, `ProjectStaff`, and milestones. `ProjectStaff` links an `Employee` to a `Project` and is unique per project/employee. `Team` belongs to a Department and contains Employees/Users; it is not the project staffing relation.

NEX-011 and NEX-015 findings remain governed by the accepted Page 7 report. Department team/member assignment is covered there. The historical team-lead removal contract still conflicts with current Department team API acceptance of `leadId: null`; no removal behavior was added or claimed here. This is separate from project lead assignment/reassignment and outside Page 14 UI.

## L. Existing regression coverage

Before Page 14 additions, focused source review found:

- `apps/web/e2e/shared/table-interactions.spec.ts`: workspace status filter, archive toggle/reset, search/no-result/clear, sort selection, desktop/mobile row layout, and navigation into details (the same test continues into Page 15 components; it was not rerun in this Page 14 scope).
- `apps/web/e2e/shared/project-pages-regression.spec.ts`: active/archive separation and search at 1440px and 390px.
- `apps/web/e2e/shared/operational-loading.spec.ts`: list skeleton and loaded row at 1440px and 390px.
- `apps/web/e2e/projects/workspace-mutations.spec.ts` (NEX-007): rename 409 recovery, successful rename, cancel confirmation keep/confirm, and archive refresh.
- `apps/web/test/route-policy.test.mjs` and `workspace-access-characterization.test.mjs`: STAFF-only workspace route policy and create permission model.
- `apps/api/tests/project-workspace.test.ts` (NEX-003 and nested project-workspace cases): PGlite-backed creation/lifecycle, manager denials, validation, persistence, and related project behavior. The previous Page 13 verification records the selected project-workspace API run; the broader nested suite was not rerun here to avoid Page 15 API scope.

Historical identities and accepted tests were left unchanged.

## M. Coverage gaps and classification

| Gap                                                                                   | Result                                                                                                           |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Directory sort selection did not assert query contract/result order                   | Added P14-001; verifies `sort=most-active` is requested and the response order is rendered.                      |
| NEX-006 browser redirect and missing entrypoint had no dedicated browser regression   | Added NEX-006 browser case; verifies redirect and no wizard/dependency/create request.                           |
| Unauthorized USER direct access and workspace API list authorization/department scope | Added P14-002 browser denial and P14-API-001 PGlite list-scope test.                                             |
| List failure recovery through Retry                                                   | Added P14-003; verifies the error message, retry request, and recovered row.                                     |
| List loading, filter/search, archive, rename/cancel recovery                          | Existing coverage is adequate; preserved.                                                                        |
| Pagination                                                                            | Not implemented in the directory; documented, not labeled a defect without a contract or reproduced user impact. |
| Department/team fields and plan/task/deliverable actions                              | Not Page 14 directory features; documented as scope boundary.                                                    |

No tests were removed, weakened, or skipped. No accepted Page 1–13 test was modified.

## N. New browser tests

File: `apps/web/e2e/projects/project-workspace-directory.spec.ts`.

1. **P14-001** — Select Most activity; verify the request carries the selected sort and returned ordering is rendered. Also asserts the workspace link uses the workspace ID.
2. **NEX-006** — As a department head, open `/project-workspace/new`; verify redirect to the directory, no create button/dialog, and no approved-booking/template/create request.
3. **P14-002** — As USER, open the internal creation route; verify denial to `/dashboard` and no workspace API request.
4. **P14-003** — Force the first list request to fail; verify the user-facing error, click Retry, and verify the second response renders the recovered workspace.

All four are `MOCKED_UI_VERIFIED`; they do not prove live persistence.

## O. New API tests

File: `apps/api/tests/project-workspace-directory.test.ts`.

1. **P14-API-001** — PGlite/Express GET-list authorization and scope: anonymous 401; USER/ADMIN/SUPERADMIN 403; Head A sees only Department A projects and can create/manage; ordinary STAFF sees only assigned projects and cannot create/manage; Head B and STAFF B see only their own department/assignment results.

Result: one unique API leaf passed. Classification: `ISOLATED_API_VERIFIED`.

## P. Execution results

### Discovery

- Baseline: 450 Playwright tests in 62 files, copied from Page 13’s final discovery before Page 14 test additions.
- Final: 454 tests in 63 files (+4 tests, +1 spec file).
- The 292 original historical identities, 1,630 assertion sites, and 4,211 ownership mappings are separate historical inventories.

### Browser

- Focused Page 14 selection: seven passed — four new Page 14 cases, the NEX-007 rename/cancel case, and archive/search at 1440px and 390px; final `cmd.exe` run exited 0.
- Loading compatibility: two passed — `/project-workspace` skeleton/loaded states at 1440px and 390px; screenshots are in the evidence folder.
- No full Playwright suite was run.

### API

- New PGlite API test: one unique leaf passed; zero failed/skipped.
- An initial sandbox run stopped at Node worker `spawn EPERM` before the test body. The process-enabled rerun passed.

### Commands

From `apps/web`:

```powershell
node node_modules/@playwright/test/cli.js test --list > ../../test-results/phase7/page-by-page/page-14-project-workspace/final-discovery-confirmation-02.log 2>&1
node node_modules/@playwright/test/cli.js test e2e/projects/project-workspace-directory.spec.ts:48 e2e/projects/project-workspace-directory.spec.ts:100 e2e/projects/project-workspace-directory.spec.ts:140 e2e/projects/project-workspace-directory.spec.ts:156 e2e/projects/workspace-mutations.spec.ts:7 e2e/shared/project-pages-regression.spec.ts:76 --workers=1 --reporter=list --output=../../test-results/phase7/page-by-page/page-14-project-workspace/browser-artifacts-run-10 > ../../test-results/phase7/page-by-page/page-14-project-workspace/browser-run-10.log 2>&1
node node_modules/@playwright/test/cli.js test e2e/shared/operational-loading.spec.ts --grep='/project-workspace shows skeleton rows until data arrives' --workers=1 --reporter=list --output='../../test-results/phase7/page-by-page/page-14-project-workspace/loading-artifacts' *> '../../test-results/phase7/page-by-page/page-14-project-workspace/browser-loading.log'
```

From `apps/api`:

```powershell
node node_modules/tsx/dist/cli.mjs --test tests/project-workspace-directory.test.ts 2>&1 | Tee-Object -FilePath '../../test-results/phase7/page-by-page/page-14-project-workspace/api-run.log'
```

The first browser build attempt stopped before tests due to an unused `accountFor` import in the new spec; that test-only import was removed and web TypeScript checking passed. The first P14-003 run exposed a test selector issue: the broad `role=alert` locator also matched Next.js's empty route announcer. The locator was narrowed to the actual error text and the test passed. An intermediate broad PowerShell grep selected two existing workspace-detail recovery compatibility cases at desktop and mobile; both passed, but no Page 15 source audit or new test work was done. Two subsequent `cmd.exe` attempts mishandled grep alternation, selected an unrelated Service Requests lifecycle test, and omitted some intended Page 14 cases; both runs' five passing tests are retained but are not counted as the final selection. The final Page 14-only run used direct file-and-line selectors and passed exactly seven intended cases with exit 0. All attempts remain in the evidence folder.

### Quality gates

| Command            | Result                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `pnpm format`      | Pass, exit 0. Existing files were reported unchanged; the new report and tests were formatted. |
| `pnpm lint`        | Pass, exit 0; ESLint reported no diagnostics.                                                  |
| `pnpm typecheck`   | Pass, exit 0 for both web and API; Prisma client generation completed with no schema change.   |
| `git diff --check` | Pass, exit 0 at final review.                                                                  |

The quality-gate logs are retained in the Page 14 evidence folder.

## Q. Defect register

| ID      | Finding                                                                                                                                                                     | Classification                              | Disposition                                                                                                                                                                          |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D14-001 | NEX-006 creation wizard is unreachable: route redirects; dialog is unmounted; no Page 14 create entry point.                                                                | `UNSUPPORTED_FEATURE` / accepted limitation | Preserved as STILL BLOCKED. No successful wizard journey or product fix was fabricated.                                                                                              |
| D14-002 | Phase 5 backlog still describes the wizard as a supported browser flow, while the later Phase 7.1 baseline/handoff and current source record a redirect and blocked wizard. | `UNRESOLVED_CONTRACT` (documentation drift) | Current Page 14 disposition follows the later approved baseline and source. Older backlog wording remains an item for documentation reconciliation; no product defect was confirmed. |

No confirmed functional, authorization, validation, API, persistence, or UI defect was reproduced for the Page 14 directory.

## R. Historical defect reassessment

- **NEX-003:** Current service and PGlite source cover creation, role/department manager checks, lifecycle transitions, and persistent rereads. Earlier Page 13 verification records the project-workspace API selection passing. Page 14 added separate list-scope coverage.
- **NEX-006:** Still blocked/accepted limitation; the auxiliary route redirects and has no supported dialog caller. API create support does not resolve browser accessibility.
- **NEX-007:** Current UI rename/cancel behavior and recovery were rerun; focused NEX-007 passed.
- **NEX-008:** Plan/task save/recovery belongs to workspace details (Page 15); no Page 14 control exposes it and no Page 15 audit was started.
- **NEX-011/NEX-015:** Department team/member behavior and the team-lead removal discrepancy remain as recorded in the accepted Page 7 report. No removal test or unsupported behavior was added.
- **Pagination:** The previously documented shared-hook pagination defect was not attributed to Page 14. The workspace directory does not use that table hook or expose local pagination; no Page 14 pagination defect was reproduced.

## S. Integration limitations

- Browser cases use intercepted API responses: `MOCKED_UI_VERIFIED`.
- P14-API-001 uses Express with in-memory PGlite: `ISOLATED_API_VERIFIED`.
- Source behavior not directly exercised is identified above as source inspection/existing coverage.
- No live backend, production/shared database, persistent provider, or storage integration was used. No `LIVE_INTEGRATION_VERIFIED` claim is made.

## T. Historical preservation

The handoff records 292 original Playwright identities, 1,630 historical assertion sites, and 4,211 preservation mappings. Pages 1–13 contributed 64 new browser cases and 18 new API cases; these are separate from the historical inventories and the current 454/63 Playwright discovery.

Page 14 added four browser cases and one API leaf. Accepted tests/reports and immutable preservation artifacts were not modified. The legacy verifier was not rerun and is not claimed clean; its known PW-149, PW-037, and PW-001 limitations remain in force.

## U. Files changed and evidence

### Repository files created

- `apps/web/e2e/projects/project-workspace-directory.spec.ts`
- `apps/api/tests/project-workspace-directory.test.ts`
- `docs/testing/verification/phase7/page-by-page/page-14-project-workspace.md`

No application source, backend business logic, schema, migration, dependency manifest, lockfile, or accepted Page 1–13 test/report was changed.

### Evidence folder

`test-results/phase7/page-by-page/page-14-project-workspace/` contains initial/final discovery, browser and API logs (including the corrected retry selector, selector failure, shell-selection attempts, and initial environment/typecheck attempts), web TypeScript logs, Playwright result folders, and the loading screenshots. Passing tests produced no retained traces; failed pre-test builds and sandbox attempts are captured as logs.

## V. Final recommendation

**COMPLETE WITH ACCEPTED LIMITATIONS — ready for administrative review.** The directory coverage and role/department list isolation are verified at mocked UI and isolated API layers. NEX-006 remains blocked exactly as documented. No application source was modified, no commit/push occurred, and no Page 15 audit or Phase 7.5 work was started. Two existing Page 15 detail-recovery compatibility tests were incidentally selected in an intermediate broad run; they passed and were excluded from the final Page 14-only run.

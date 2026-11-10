# Phase 6 Post-Merge Coverage Backlog Refresh

**Integrated revision:** `f40ed7b468e77f1accec0541327ecd55833b59cc`

**State checked:** expected integration commit; clean working tree; no active merge.

**Scope:** post-merge inventory and backlog status. The original Phase 5 inventory remains unchanged. The P2 execution update below adds only mocked browser regression cases; it used no production/shared database or live API.

This addendum updates the accepted [Phase 6 backlog](../phase5/phase6-backlog.md) using the [Phase 5.1 assessment](../phase5/coverage-assessment.md) and merged implementation. It preserves NEX-001 through NEX-012 and the historical Phase 5 inventory. New NEX-013+ entries below are proposals, not approved implementation work.

## Current page inventory

There are **23 official in-scope page groups**: the original 18 plus the five verified merged routes below. The repository has 25 `page.tsx` route entries; `/` is a root entry, and the pre-existing `/project-workspace/new` wizard is included in the historical Project Workspace group and NEX-006 rather than counted as a new official page.

“Mocked” means browser tests intercept the API; it does not establish server authorization or persistence. The original PW mappings and detailed feature descriptions remain in Phase 5.1.

| Official page | Existing regression coverage | Current coverage and remaining gap |
| --- | --- | --- |
| Login `/login` | `PW-011, 013–019, 021, 087–090, 124–133, 135–137, 142, 144, 146–147, 151–157`; `auth/*` | Extensive mocked UI coverage; real auth/session checks remain unverified. `PW-124–128` remain opt-in. |
| Registration `/register` | `PW-012, 015, 020, 143–144, 148–155`; `auth/regression`; NEX-010 | Field-level contact, email, password, and confirmation errors plus registration-request suppression are now covered by mocked browser cases. Existing valid/duplicate registration cases remain in `auth/regression`. |
| Dashboard `/dashboard` | `PW-021, 087, 124–128, 130–133, 138–139, 145–146, 150, 152–155, 158, 162–163, 269–272, 281–282` | Labeled empty page; no widget/analytics behavior is implemented or expected. |
| Account Management `/accounts` | `PW-001–002, 124–127, 141, 145, 269–280`; NEX-001/002 | NEX-001 covers successful API/PGlite account creation; NEX-002 covers the mocked SUPERADMIN browser journey. Other browser role and account management flows remain mock-backed. |
| Client Management `/clients` | `PW-009–010, 031–032, 053–056, 059, 062, 124–127, 145, 249–250, 283, 288`; NEX-012 | Populated request/project tabs, two-page navigation, close-to-directory, and absence of edit/delete actions are covered by a mocked browser case. API pagination remains covered separately in PGlite tests. Client edit/delete are intentionally unsupported. |
| Employee Management `/employees` | `PW-005–006, 063, 071–076, 124–127, 145, 269–272, 284, 289` | Mocked UI coverage plus existing employee API/PGlite suite; selected form boundaries and transactional employee/login behavior remain outside browser verification. |
| Department Management `/departments` | `PW-003–004, 064–065, 067, 069, 124–127, 145, 269–272`; NEX-011 | Mocked browser coverage now verifies Admin team creation, member assignment, and assignment removal. Existing employee PGlite tests cover server-side team/member behavior and persistence; the existing mocked authorization-error case remains. |
| Services `/services` | `PW-007–008, 041–052, 057–058, 060–061, 066, 068, 070, 106–109, 124–127, 134, 140, 145, 251–260, 269–272` | Broad mocked catalog/request coverage; real catalog and service-request persistence remain unverified. |
| Client Service Requests `/service-requests` | `PW-033–040, 287, 292` | Mocked history/list/detail states; real owner-scoped history remains unverified. |
| Request Inbox `/request-inbox` | `PW-096, 099, 168–169, 205–218, 286, 291` | List/detail/accept and failure recovery covered. Successful decline/delete remains blocked by the absent backend contract. |
| Booked Services `/booked-services` | `PW-022–030, 285, 290` | Mocked list/detail and filtering; backend ownership/persistence remain unverified. |
| Messages `/messages` | `PW-077–086, 091–094, 159–204, 219–248`; 7 new `project-conversations.spec.ts` cases | Project conversation browser cases cover roles, archive, mobile, legacy links, staff submission/retry, and client-visible delivery links using mocks. `project-conversations.test.ts` separately verifies API membership, persistence, submission, review/send, and sharing with PGlite. Live SSE/storage remain unverified. |
| Project Details `/projects/[id]` | `PW-115, 118, 120–123`; shared project loading cases | The route now selects client project details or staff review behavior. Approved PW-120 checks the shared deliverable/conversation handoff; client brief/request/review actions and staff change/cancellation review have no browser coverage. |
| Project Workspace `/project-workspace` | `PW-097, 100, 114, 117, 281–282`; NEX-003, NEX-007 | NEX-003 verifies API lifecycle, rename/cancel, and status persistence with PGlite. NEX-007 now covers mocked rename conflict recovery, confirmation, cancellation, and Archive visibility. The `/project-workspace/new` wizard remains blocked (NEX-006). |
| Project Workspace Details `/project-workspace/[id]` | `PW-116, 119, 281–282`; NEX-003–005, NEX-008, NEX-009, and project-conversation API cases | NEX-004 verifies plan/task API persistence and authorization with PGlite; NEX-008 adds mocked plan/task edits, required-task validation, failed-save recovery, and refreshed read state. NEX-005/009 remain partial: API deliverable lifecycle and mocked staff submission are present; removal/rejection boundaries and workspace review UI remain gaps. |
| Staff Workload `/staff-workload` | `PW-095, 098, 101–105, 267–268` | Existing mocked UI coverage; backend workload tests remain separate from the browser evidence. |
| Profile `/profile` | `PW-110–113` | Existing mocked form/image coverage; real profile and storage persistence remain unverified. |
| Settings `/settings` | `PW-101–104, 110–113, 261–266` | Existing mocked persistence/revocation scenarios; real session and preference integration remains separate. |
| Billing Logs `/billing-logs` **new** | No page-specific browser identity found. `GET /api/request-workflows/billing` is implemented. | USER-only page and server route; billing projection, role denial, owner scoping, proof visibility, and UI loading/error states have no matching API or browser regression case found. Proposed NEX-016/018. |
| Calendar `/calendar` **new** | 8 new cases in `calendar.spec.ts` (four roles × desktop/mobile); `calendar.test.ts` PGlite; `apps/web/test/calendar.test.mjs` | Covered at mocked browser, frontend logic, and API/PGlite layers for role views, filters, calendar scopes, ownership, and current assignment checks. No additional calendar test is proposed. Project-lead *assignment mutation* itself is a separate gap (proposed NEX-015). |
| Help `/help` **new** | No page-specific browser test found. | USER-only static FAQ page has local search and expandable answers. Low-risk UI behavior is untested; optional P3 only, not a blocker. |
| My Projects `/projects` **new** | No browser test for the project list; no project-route API test found. | Client-owned project listing/filtering and empty/error behavior are implemented but unverified at both UI and API layers. Proposed NEX-013/017. |
| Client Deliverable `/projects/[id]/deliverables/[milestoneId]` **new** | PW-120 and project-conversation browser tests assert links; project-conversation PGlite coverage verifies shared-file visibility after send. | Link and API sharing are covered, but the actual page, client approve/revision actions, and the new client review endpoint are not. Proposed NEX-014/017. |

## Accepted NEX-001–NEX-012 status

| ID / priority | Status | Post-merge evidence and remaining work |
| --- | --- | --- |
| NEX-001 / P1 | **ALREADY COVERED** | Account-create success, role denial, safe response, and persistence in `employee-integration.test.ts` with PGlite. |
| NEX-002 / P1 | **ALREADY COVERED** | SUPERADMIN create journey and visible validation/API errors in `accounts/account-creation.spec.ts`; mocked browser boundary. |
| NEX-003 / P1 | **ALREADY COVERED** | Workspace lifecycle API authorization and persisted create/rename/cancel/status transitions in `project-workspace.test.ts` with PGlite. |
| NEX-004 / P2 | **ALREADY COVERED** | `[NEX-004] plan and task API updates persist and enforce project scope` in `apps/api/src/project-workspace.test.ts` verifies department-head plan saves, assigned STAFF task add/status updates, API rereads and PGlite persistence, invalid input/status rejection without mutation, and out-of-scope denial without plan changes. |
| NEX-005 / P1 | **PARTIALLY COVERED** | `project-conversations.test.ts` covers assigned-staff upload, invalid note, idempotent retry, private submission, head approve/send, and client file visibility with PGlite. It does not exercise attachment removal or rejection/reason boundaries. |
| NEX-006 / P1 | **PARTIALLY COVERED — WIZARD BLOCKED** | NEX-003 verifies API creation, department-head STAFF authorization, denial to non-head STAFF, lifecycle transitions, and persistence with PGlite, but does not cover the UI wizard. `NewWorkspaceDialog` has no caller, and `/project-workspace/new` redirects to `/project-workspace`; the current list page exposes no wizard entry point. The approved wizard navigation, booking/template selection, validation, and resulting UI state remain unmet. Keep blocked unless an approved application entry point is restored. |
| NEX-007 / P2 | **ALREADY COVERED** | `[NEX-007]` in `apps/web/e2e/projects/workspace-mutations.spec.ts` covers mocked rename conflict/retry, confirmation cancellation, successful cancellation, and Archive state. NEX-003 separately verifies backend lifecycle persistence with PGlite. |
| NEX-008 / P2 | **ALREADY COVERED** | `[NEX-008]` in `apps/web/e2e/projects/workspace-detail-mutations.spec.ts` covers mocked plan save/reread, task status save, required task-name validation, and failed-save recovery. NEX-004 separately verifies API authorization and persistence with PGlite. |
| NEX-009 / P1 | **PARTIALLY COVERED** | New browser cases cover staff chat submission/retry and client delivery links with mocks; API sharing/review/send is separately PGlite-tested. Workspace review/reject/send UI and client portal approve/revision UI remain uncovered. |
| NEX-010 / P2 | **ALREADY COVERED** | Four `[NEX-010]` cases in `apps/web/e2e/auth/registration-validation.spec.ts` independently cover contact, email, password, and confirmation field feedback and prove invalid submissions send no registration request. Existing valid/duplicate server-response cases remain in `auth/regression.spec.ts`. |
| NEX-011 / P2 | **ALREADY COVERED** | `[NEX-011]` in `apps/web/e2e/shared/department-member-workflows.spec.ts` covers mocked Admin team creation, assignment, and removal. `employee-integration.test.ts` separately covers API/PGlite team/member success and persistence. |
| NEX-012 / P2 | **ALREADY COVERED** | `[NEX-012]` in `apps/web/e2e/clients/related-records.spec.ts` covers populated request/project tabs, page two for each, return to the directory, and read-only actions. `client-integration.test.ts` separately covers API/PGlite related-record pagination. |

## P2 execution update — 2026-11-10

| Scenario | Added browser identities | Browser boundary | Existing backend boundary | Targeted result |
| --- | --- | --- | --- | --- |
| NEX-007 | 1 in `projects/workspace-mutations.spec.ts` | Mocked rename, conflict recovery, confirmation, and Archive view | NEX-003 PGlite lifecycle/persistence | Passed; included in workspace-related run (9/9). |
| NEX-008 | 1 in `projects/workspace-detail-mutations.spec.ts` | Mocked plan save, task status change, required-field validation, failed-write recovery, and reload read | NEX-004 PGlite authorization/persistence | Passed; included in workspace-related run (9/9). |
| NEX-010 | 4 in `auth/registration-validation.spec.ts` | Mocked browser validation; invalid values produce field feedback and zero registration requests | Existing server validation tests are separate; existing browser valid/duplicate cases retained | Passed with related registration regressions (11/11). |
| NEX-011 | 1 in `shared/department-member-workflows.spec.ts` | Mocked Admin UI create/assign/remove workflow | Existing `employee-integration.test.ts` PGlite coverage | Passed with existing department regressions, including authorization error (4/4). |
| NEX-012 | 1 in `clients/related-records.spec.ts` | Mocked populated related records and two-page navigation; no edit/delete controls | Existing `client-integration.test.ts` PGlite pagination coverage | Passed with existing client mutation/table regressions (5/5). |

The four final grouped targeted runs produced **29 passed, 0 failed, 0 skipped** across workspace (9), registration (11), department (4), and client (5) specs. Runs used one Chromium worker, zero retries, the local standalone web app at `127.0.0.1:5274`, and mocked API responses. Evidence is under `apps/web/test-results/phase6-p2-{workspace-related,registration-related,departments-related,clients-retry2}`. A static Playwright listing reports **317 total cases**: 309 before this batch plus eight new NEX browser identities. No API tests were added because the approved scenarios specify browser behavior and the relevant backend/PGlite behavior already has separate coverage. Earlier failed attempts exposed test locator/oracle ambiguities; those were corrected without application changes and their logs remain in adjacent `phase6-p2-*` evidence folders.

The accepted historical reconciliation remains the baseline: 292 original PW identities, 1,630 assertion sites, and 4,211 mappings, including ten approved replacement sites and 24 approved mapping edges. This batch added new spec files only; no original PW test module, Phase 2/4 artifact, or approved delta was changed.

## New post-merge coverage candidates

These candidates reflect new implemented contracts, not assumed product features. Existing source documentation defines the cited behaviors, but these IDs must be accepted into the backlog before implementation.

| Proposed ID / priority | Scenario and layer | Evidence and gap |
| --- | --- | --- |
| **NEX-013 / P1** | Client project brief, change/cancellation request, and Department Head review authorization/persistence. **PGlite API integration.** | `projects.controller.ts` and `projects.service.ts` implement client-scoped reads/brief updates, project change/cancellation requests, and current-head review. [RBAC documentation](../../../../docs/rbac.md) defines owner access, head-only review, decline response notes, and cancellation outcome. No project-route API/PGlite tests or matching UI journeys were found. |
| **NEX-014 / P1** | Client deliverable review and file visibility, including approve/revision decisions against a shared deliverable. **PGlite API integration.** | `POST /api/projects/:id/deliverables/:milestoneId/review` and file access are implemented in `projects.controller.ts`/`projects.service.ts`. The new conversation PGlite case verifies staff publish/send and file access, not the client review endpoint or revision persistence. [RBAC documentation](../../../../docs/rbac.md) specifies owner and shared-file boundaries. |
| **NEX-015 / P1** | Assign/reassign/remove a project team lead through the workspace API and verify persistence plus immediate team-calendar access change. **PGlite API integration.** | `PUT /api/project-workspace/:id/projects/:projectId/team-lead` is head-gated in the workspace service. `calendar.test.ts` toggles `isTeamLead` directly in its fixture and proves calendar scope, but does not exercise this mutation route or its authorization/cleanup. See [calendar rules](../../../../docs/features/calendar.md). |
| **NEX-016 / P1** | Client billing-list authorization and owner-scoped payment/proof response. **PGlite API integration.** | `/api/request-workflows/billing` rejects non-USER roles; `listClientBillingPayments` filters by the authenticated client. No test references this billing endpoint. Sources: `workflow.controller.ts`, `workflow.billing.ts`, and the USER-only route guard in `portal-layout.tsx`. |
| **NEX-017 / P2** | Client My Projects → project details → request/review flow and actual deliverable page states. **Mocked browser.** | Use the current client page forms and API client to assert visible state, payloads, errors, and role-specific controls. Keep backend ownership/persistence claims in NEX-013/014. Existing PW-120 covers only the basic page/link handoff. |
| **NEX-018 / P2** | Billing Logs due/history display, proof preview/download feedback, and empty/loading/error states. **Mocked browser.** | The page is implemented in `app/(portal)/billing-logs/page.tsx`; no browser case navigates to it. NEX-016 remains responsible for API role and owner scope. |
| **Optional P3** | Help FAQ search and answer expansion. **Mocked browser or focused component test.** | `app/(portal)/help/page.tsx` contains client-side filtering and disclosure behavior. No page test exists; defer unless the product owner requires coverage for this low-risk content page. |

## Suggested Phase 6 order

1. **Batch 1 — Finish the related deliverable P1 work:** NEX-005 API gaps (remove/reject/reason and supported invalid transitions) alongside NEX-009 browser review/send workflow. Reuse the existing PGlite project-conversation/workspace suites and modular project E2E ownership. Keep client portal review UI out of NEX-009 unless separately accepted as NEX-017.
2. **NEX-006 — P1, blocked:** do not implement a browser wizard test while the supported UI entry point is inaccessible. NEX-003 API coverage is not equivalent to wizard navigation, booking/template selection, required-step feedback, or list-result UI coverage. Reassess only after an approved wizard entry point exists.
3. **New P1 candidates, after backlog acceptance:** NEX-013 through NEX-016. Start with project owner/head transitions and deliverable visibility; then team-lead assignment/calendar scope and billing owner-scope.
4. **Approved P2 work:** NEX-004 and NEX-007/008/010/011/012 are covered. Any additional NEX-017/018 browser work remains proposed and requires backlog approval.
5. **Optional P3:** Help search/disclosure only if requested. No new framework or per-route test module is needed: project portal routes can share one client-project spec, calendar already has one modular spec, and source-backed API integration belongs in existing PGlite suites.

## Boundaries and clarification

- The `PW-124–128` live-backend cases remain deferred. This batch used only mocked browser tests; it did not execute API/PGlite tests or access production/shared databases. The prior integration report records 33/33 targeted browser and 27/27 isolated API tests passing; those historical results remain separate.
- The new calendar and project-conversation browser cases are mocked. Their associated PGlite suites verify real Express/API behavior against isolated in-memory PostgreSQL; neither layer proves behavior against a live environment.
- Request Inbox decline/delete remains **BLOCKED** by its missing backend contract. Client Management edit/delete and Dashboard widgets remain **INTENTIONALLY UNSUPPORTED**.
- **NEX-006 remains PARTIALLY COVERED — WIZARD BLOCKED** by the inaccessible wizard route and absent component caller. This disposition was verified during Phase 6.2 stabilization; no application change or replacement browser behavior was introduced.
- No behavior ambiguity was found for the existing approved NEX items. Product/backlog approval is needed before implementing proposed NEX-013 through NEX-018, because these post-merge capabilities were not in the accepted Phase 5 backlog. The current RBAC/feature docs are the expected test-oracle sources; no new success contract should be inferred beyond them.

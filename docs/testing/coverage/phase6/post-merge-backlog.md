# Phase 6 Post-Merge Coverage Backlog Refresh

**Integrated revision:** `f40ed7b468e77f1accec0541327ecd55833b59cc`

**State checked:** expected integration commit; clean working tree; no active merge.

**Scope:** planning only. No application or test files changed and no tests or databases were run.

This addendum updates the accepted [Phase 6 backlog](../phase5/phase6-backlog.md) using the [Phase 5.1 assessment](../phase5/coverage-assessment.md) and merged implementation. It preserves NEX-001 through NEX-012 and the historical Phase 5 inventory. New NEX-013+ entries below are proposals, not approved implementation work.

## Current page inventory

There are **23 official in-scope page groups**: the original 18 plus the five verified merged routes below. The repository has 25 `page.tsx` route entries; `/` is a root entry, and the pre-existing `/project-workspace/new` wizard is included in the historical Project Workspace group and NEX-006 rather than counted as a new official page.

“Mocked” means browser tests intercept the API; it does not establish server authorization or persistence. The original PW mappings and detailed feature descriptions remain in Phase 5.1.

| Official page | Existing regression coverage | Current coverage and remaining gap |
| --- | --- | --- |
| Login `/login` | `PW-011, 013–019, 021, 087–090, 124–133, 135–137, 142, 144, 146–147, 151–157`; `auth/*` | Extensive mocked UI coverage; real auth/session checks remain unverified. `PW-124–128` remain opt-in. |
| Registration `/register` | `PW-012, 015, 020, 143–144, 148–155`; `auth/regression` | Mocked success and generic invalid-form coverage; field-specific feedback and request suppression remain open (NEX-010). |
| Dashboard `/dashboard` | `PW-021, 087, 124–128, 130–133, 138–139, 145–146, 150, 152–155, 158, 162–163, 269–272, 281–282` | Labeled empty page; no widget/analytics behavior is implemented or expected. |
| Account Management `/accounts` | `PW-001–002, 124–127, 141, 145, 269–280`; NEX-001/002 | NEX-001 covers successful API/PGlite account creation; NEX-002 covers the mocked SUPERADMIN browser journey. Other browser role and account management flows remain mock-backed. |
| Client Management `/clients` | `PW-009–010, 031–032, 053–056, 059, 062, 124–127, 145, 249–250, 283, 288` | Directory and read-only detail behavior covered; populated related-record pagination remains open (NEX-012). Client edit/delete are intentionally unsupported. |
| Employee Management `/employees` | `PW-005–006, 063, 071–076, 124–127, 145, 269–272, 284, 289` | Mocked UI coverage plus existing employee API/PGlite suite; selected form boundaries and transactional employee/login behavior remain outside browser verification. |
| Department Management `/departments` | `PW-003–004, 064–065, 067, 069, 124–127, 145, 269–272` | Existing employee integration tests cover server-side team/member operations; successful UI create/assign/reassign/remove workflow remains open (NEX-011). |
| Services `/services` | `PW-007–008, 041–052, 057–058, 060–061, 066, 068, 070, 106–109, 124–127, 134, 140, 145, 251–260, 269–272` | Broad mocked catalog/request coverage; real catalog and service-request persistence remain unverified. |
| Client Service Requests `/service-requests` | `PW-033–040, 287, 292` | Mocked history/list/detail states; real owner-scoped history remains unverified. |
| Request Inbox `/request-inbox` | `PW-096, 099, 168–169, 205–218, 286, 291` | List/detail/accept and failure recovery covered. Successful decline/delete remains blocked by the absent backend contract. |
| Booked Services `/booked-services` | `PW-022–030, 285, 290` | Mocked list/detail and filtering; backend ownership/persistence remain unverified. |
| Messages `/messages` | `PW-077–086, 091–094, 159–204, 219–248`; 7 new `project-conversations.spec.ts` cases | Project conversation browser cases cover roles, archive, mobile, legacy links, staff submission/retry, and client-visible delivery links using mocks. `project-conversations.test.ts` separately verifies API membership, persistence, submission, review/send, and sharing with PGlite. Live SSE/storage remain unverified. |
| Project Details `/projects/[id]` | `PW-115, 118, 120–123`; shared project loading cases | The route now selects client project details or staff review behavior. Approved PW-120 checks the shared deliverable/conversation handoff; client brief/request/review actions and staff change/cancellation review have no browser coverage. |
| Project Workspace `/project-workspace` | `PW-097, 100, 114, 117, 281–282`; NEX-003 | NEX-003 verifies API creation, rename/cancel, and status transitions with PGlite. The `/project-workspace/new` wizard and list-row mutation UI remain untested (NEX-006/007). |
| Project Workspace Details `/project-workspace/[id]` | `PW-116, 119, 281–282`; NEX-003 and project-conversation API cases | NEX-005/009 are partially covered: API submit/approve/send and mocked chat submission are present; remove/reject boundaries and the workspace review UI remain gaps. Plan/task API/UI cases remain open (NEX-004/008). |
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
| NEX-004 / P2 | **STILL IMPLEMENTABLE** | No plan-save/task-add/status API test found. `project-workspace.test.ts` currently covers NEX-003 lifecycle, not plan/task mutations. |
| NEX-005 / P1 | **PARTIALLY COVERED** | `project-conversations.test.ts` covers assigned-staff upload, invalid note, idempotent retry, private submission, head approve/send, and client file visibility with PGlite. It does not exercise attachment removal or rejection/reason boundaries. |
| NEX-006 / P1 | **STILL IMPLEMENTABLE** | No browser journey for the booking/template creation wizard. NEX-003 proves API creation separately; no mocked UI submission/validation coverage exists. |
| NEX-007 / P2 | **STILL IMPLEMENTABLE** | NEX-003 covers API rename/cancel persistence; no browser row-action success/failure flow is covered. |
| NEX-008 / P2 | **STILL IMPLEMENTABLE** | No browser plan/task mutation, validation, failed-save recovery, or reread assertion found. |
| NEX-009 / P1 | **PARTIALLY COVERED** | New browser cases cover staff chat submission/retry and client delivery links with mocks; API sharing/review/send is separately PGlite-tested. Workspace review/reject/send UI and client portal approve/revision UI remain uncovered. |
| NEX-010 / P2 | **STILL IMPLEMENTABLE** | No new registration field-level assertions; existing Phase 5 gap is unchanged. |
| NEX-011 / P2 | **STILL IMPLEMENTABLE** | API/PGlite team/member coverage exists in `employee-integration.test.ts`; successful department drawer UI workflow remains absent. |
| NEX-012 / P2 | **PARTIALLY COVERED** | Client API tests cover populated relations; browser details cover empty/read-only states, not populated tabs and pagination. |

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
2. **Batch 2 — NEX-006 P1:** mocked workspace creation wizard, including its supported template/booking path and required-step feedback. Do not duplicate NEX-003 API assertions.
3. **New P1 candidates, after backlog acceptance:** NEX-013 through NEX-016. Start with project owner/head transitions and deliverable visibility; then team-lead assignment/calendar scope and billing owner-scope.
4. **Approved P2 work:** NEX-004 API plan/tasks; NEX-007 workspace row actions; NEX-008 detail plan/task UI; NEX-010 registration field feedback; NEX-011 department team/member UI; NEX-012 populated client details. Then accepted NEX-017/018 browser work.
5. **Optional P3:** Help search/disclosure only if requested. No new framework or per-route test module is needed: project portal routes can share one client-project spec, calendar already has one modular spec, and source-backed API integration belongs in existing PGlite suites.

## Boundaries and clarification

- The `PW-124–128` live-backend cases remain deferred. This refresh did not run tests or access production/shared databases. The prior integration report records 33/33 targeted browser and 27/27 isolated API tests passing; those results are not repeated here.
- The new calendar and project-conversation browser cases are mocked. Their associated PGlite suites verify real Express/API behavior against isolated in-memory PostgreSQL; neither layer proves behavior against a live environment.
- Request Inbox decline/delete remains **BLOCKED** by its missing backend contract. Client Management edit/delete and Dashboard widgets remain **INTENTIONALLY UNSUPPORTED**.
- No behavior ambiguity was found for the existing approved NEX items. Product/backlog approval is needed before implementing proposed NEX-013 through NEX-018, because these post-merge capabilities were not in the accepted Phase 5 backlog. The current RBAC/feature docs are the expected test-oracle sources; no new success contract should be inferred beyond them.

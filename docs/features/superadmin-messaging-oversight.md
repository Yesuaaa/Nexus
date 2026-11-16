# Superadmin messaging authorization and oversight (Phase 3D.1)

Developed: 2026-11-14

Follow-up, 2026-11-15: the browser failures and automated test launcher limitation recorded below are addressed in [Messaging and API test regression recovery](testing-regression-recovery.md). Historical validation results remain below.

[Phase 3D.3 privacy validation](messaging-privacy-validation.md) audits the current metadata/participant boundaries and expands direct endpoint, nested response, private DM and frontend denial coverage.

## Audit before implementation

| Conversation type                                               | Existing model and authorization                                                                                                                                                                                                                                                                                 | Administrative classification                                                                                                         |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Service request conversations                                   | `RequestConversation` is one shared client–department thread, with independently linked bookings. Current active owning Client or current active Staff Department Head only. History, sending, read markers, editing/deleting, meetings and realtime checks retain current relationship checks.                  | Business metadata is suitable for oversight; message history, consultation text and files remain participant-restricted.              |
| Project conversations                                           | A started `Project` supplies the chat. The owning active Client and currently assigned active Staff with active Employee records participate. Merely being a Head or administrator grants no participation. Completed/cancelled chats are archived. Deliverable cards can be Staff-only (`clientVisible=false`). | Started-project business metadata is suitable for oversight; message text, deliverable JSON and attachments remain excluded.          |
| Internal direct messages                                        | `InternalConversation` stores a fixed pair of internal accounts; all history/read/send access checks the pair. Staff, Admin and Superadmin can participate in their own direct chats. Clients cannot use them.                                                                                                   | Private. Exclude the entire category from administrative oversight, including other employees' thread identifiers and activity.       |
| Workflow events, consultation records and notification channels | Existing workflow snapshots, file routes and empty realtime invalidations have their own authorization. They are not another administrative messaging category.                                                                                                                                                  | Preserve existing scopes. Do not expose meeting notes, workflow documents, live streams or notifications through metadata inspection. |

The Phase 2A `BUSINESS_CONVERSATION_INSPECTION` capability already exists, but has no metadata-only conversation endpoint or UI. Existing participant list/detail responses include message previews or bodies, so they cannot be reused as an administrative source. This is the confirmed gap. Participant authorization itself is intentional and must not be widened.

Service conversations currently remain active shared client–department threads even when individual bookings close; administrative status must reflect that implementation rather than infer thread archival from booking status. Projects without a start date do not yet have an accessible project chat and must be excluded. Existing project archive state definitions should be reused.

## Implemented metadata oversight

**Business conversation oversight** is available from Messages at `/messages/oversight`. It is a separate metadata view within the existing messaging feature, not another messaging system. Existing personal/internal chat entry and participant experiences are preserved.

The view supports service/project type selection, department filtering, metadata search and numbered pagination. Details show the associated Client, department and current Head; thread lifecycle and project status; created/updated/start timestamps; the latest shared message timestamp; and paginated linked service request/project references. No employee contact details or HR records are included. Service search uses client/department names and linked booking titles/references; project search uses project/client names and linked request reference/department. It never searches message bodies or private DMs.

Two GET-only endpoints use existing `requireAuth`, current database-role evaluation, `hasAdministrativeCapability`, `readTransaction`, `insensitive`, `parsePage` and `paginate` patterns:

| Endpoint                                                                               | Response                                                              |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `/api/administrative-conversations?kind=service\|project&departmentId=&search=&page=1` | Safe conversation summaries, department filter options and pagination |
| `/api/administrative-conversations/:kind/:id?page=1`                                   | Safe summary and paginated linked business records                    |

Both require **organization-wide read** and **business-conversation inspection** capabilities. Superadmin receives these from the existing Phase 2A mapping; no new permission, hardcoded role exception, module registration or operational identity is introduced. Admin, Staff, Heads and Clients lack these grants and receive `403`. Missing authentication receives `401`; unknown/non-business IDs and unstarted project chats receive `404`. Invalid type, duplicate filter values and invalid pagination receive `400`. Unknown include options cannot expand the explicit response projection. There are no administrative mutation, file, read-marker or realtime routes.

Queries use explicit Prisma `select` allowlists. They select only a message's creation timestamp where needed, never its body, sender, preview, deliverable JSON or attachment metadata. The latest project message timestamp excludes Staff-only (`clientVisible=false`) submissions; deleted service messages are excluded from that timestamp. `updatedAt` is the persisted business/conversation record timestamp, not a participant read receipt or a promise of last message activity. Private DM tables are never queried by these endpoints. Per-participant deletion preferences are neither read nor changed; business metadata oversight is independent of personal inbox deletion.

Responses expose `inspectMetadata: true`, with `readMessages`, `downloadFiles`, `participate` and `markRead` all false. Frontend rows/details honor the inspection capability and include no composer, content viewer, participant-chat deep link, file link or operational action. Frontend visibility does not replace backend enforcement.

The UI reuses `PageHeader`, `SearchField`, `FilterSelect`, shared table components, `TablePaginationFooter`, `RequestDetailsBody`, date preferences and `useAsyncResource`. Existing chat services remain unchanged except for exporting the already-used project archive status constant. No workflow, conversation relationship, storage model or schema change is required.

## Changed files

- API: `apps/api/src/app.ts`; new `request-conversations/administrative-conversations.controller.ts` and `.service.ts`; exported existing archive constant in `project-conversations/project-conversations.service.ts`.
- Web: `auth/model/permissions.ts`, `workspaces/model/route-policy.ts`, `request-conversations/pages/messages-page.tsx`; new `request-conversations/api/administrative-conversations-api.ts`, `request-conversations/pages/administrative-conversations-page.tsx` and `app/(portal)/messages/oversight/page.tsx`.
- Tests: new `apps/api/tests/features/auth/administrative-conversations.test.ts`, `apps/web/test/business-conversation-access.test.mjs` and `apps/web/e2e/administrative-conversations.spec.ts`.
- Documentation: this audit/report and cross-links in the feature index, module-access guide, request-messaging record and RBAC guide.

## Validation

- Before implementation, all 15 existing offline PGlite service/project/internal messaging tests passed.
- After implementation, 35 relevant backend tests passed, including those participant regressions, capability/role-policy coverage and the new metadata authorization suite. New coverage verifies multiple departments, safe projections, request/reference pagination, message-body search exclusion, hidden Staff-only activity, private DM exclusion, file/stream/content protection, rejected mutations and read receipts, no identity creation, no participant state changes, and same-session role/deactivation revocation.
- All 105 web unit tests passed, including capability/route guard and unknown nested-route coverage.
- All 7 new browser tests passed: desktop/mobile metadata inspection, filters, detail navigation, read-only controls, ordinary-role denial, effective-permission revocation, retry and pagination.
- The broader isolated browser run passed 99 of 104 tests. All five failures below were reproduced in a separate production UI build with the Phase 3D.1 frontend additions temporarily removed; the original source files were then restored exactly. They are pre-existing participant-page failures, outside the metadata oversight change.
- Production API/web build, formatting, lint and typecheck passed.

The standard backend `tsx` launcher could not start because this environment reports `uv_os_get_passwd ENOMEM`, reproduced before changes. Backend tests ran successfully using the existing TypeScript-compiled Node/PGlite fallback. These results cover the listed relevant suites, not the entire API suite.

### Pre-existing browser failures

| Spec                             | Failing scenario                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `internal-conversations.spec.ts` | Admin shared thread across modules at 390px: times out selecting Service Operations from the mobile module carousel |
| `project-conversations.spec.ts`  | Scoped Project Management history at 1440px: times out interacting with the archived-conversations control          |
| `project-conversations.spec.ts`  | Client project chat and archived history: times out interacting with the archived-conversations control             |
| `project-conversations.spec.ts`  | Staff project chat and archived history: same archive-control timeout                                               |
| `request-conversations.spec.ts`  | Client ended-booking context: times out interacting with the archived-conversations control                         |

The initial broad run was superseded: a concurrent targeted rerun interfered with its shared Playwright artifact directory. Final regression and baseline runs used isolated output directories sequentially. Missing contact mocks in the new browser fixture were corrected; all new oversight browser tests pass. No participant workflow or shared carousel/archive control was changed to address the baseline failures.

## Deferred capabilities and preserved restrictions

Conversation-content inspection requires a separately designed policy and phase. It is not enabled by this implementation. No new conversation model, participant provisioning, fake operational identity, Diagnostics or centralized System Logs is permitted.

Superadmin may still use its own internal direct chats through existing explicit pair membership. Administrative inspection adds no participants, reads no other private DMs and never sends or marks messages read for anyone. Service thread Head ownership, current project Staff assignments, Client ownership, financial/workflow approval authority and restricted file checks remain intact. Message-content access, attachments, staff-only deliverable cards and administrative messaging mutations are deferred. Existing uncommitted changes from earlier phases were preserved.

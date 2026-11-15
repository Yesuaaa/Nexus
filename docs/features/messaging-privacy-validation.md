# Messaging authorization and privacy validation (Phase 3D.3)

Developed: 2026-11-15

## Scope and audit

Reviewed the current working tree, Phase 2A capabilities, Phase 3D.1 administrative controller/service, all three participant messaging controllers/services, workflow/project attachment authorization, API authentication/cache middleware, frontend route guards, metadata rendering and existing authorization/browser tests. Existing uncommitted implementations and testing recovery work are retained.

| Surface                                 | Verified authorization boundary                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Administrative service/project metadata | Active, non-retired authenticated account with both `organization:read-all` and `conversations:inspect-business`. The existing fixed-role mapping grants these only to Superadmin. No Staff, Employee, Head or project identity is required.                                                                                                       |
| Service conversations                   | Owning active Client or current active Staff Head of the conversation's department. Shared client–department threads remain independent of individual booking closure. History, sending, meetings, read markers and streams retain participant checks; message editing/deletion additionally enforce existing Staff authorship rules.              |
| Project conversations                   | Started project, owning active Client or currently assigned active Staff with an active Employee record. Head/administrative title alone grants no participation. Client history excludes Staff-only deliverable cards. Archived chats remain subject to membership checks and are read-only.                                                      |
| Internal direct messages                | Existing Staff/Admin/Superadmin role eligibility plus explicit account-pair membership. Superadmin may use its own private chats, but cannot inspect other employees' threads. No internal DM table is queried by administrative metadata services.                                                                                                |
| Files and nested resources              | Workflow files retain Client/Head/explicitly assigned financial responsibility and visibility checks; project attachments retain project participation and sharing rules. Metadata authority adds no file authority. Administrative nested message/file/stream/read/participant routes do not exist.                                               |
| Frontend                                | `/messages/oversight` and its Messages link require the same two administrative grants. Ordinary Messages remains separately available. Rows/details honor backend inspection capability; the metadata UI has no composer, private DM view, read receipt operation or attachment link. Backend denial does not fall back to participant endpoints. |

Authentication resolves current role/account state from the database, independently of request role/user claims. All API responses inherit `Cache-Control: no-store`. Administrative response projections select only business references, basic Client/department/Head names and IDs, statuses and allowed timestamps. No message body, preview, sender identity, deliverable JSON, meeting notes, credentials, contact details, file metadata, read markers or unread totals are included. Project latest-shared-message timestamps exclude Staff-only messages; service timestamps exclude deleted messages. Persisted business/conversation `updatedAt` is record metadata, not a read receipt.

## Findings and necessary corrections

No production authorization vulnerability was found in the audited paths, and no production implementation change was necessary. Administrative and participant authorization remain separate; no role grants, workflow, schema, navigation feature or messaging capability was added.

A confirmed **test coverage defect** was corrected: the previous attachment-denial assertion used `/api/request-workflow/...`, while the application mounts `/api/request-workflows/...`. A `404` from that unmounted path did not prove file authorization. The corrected test now reaches the real mounted endpoint, proves the authorized Head can download the seeded file, and verifies that unassigned Superadmin, Admin, Staff, other Heads and Clients cannot obtain that restricted file. This correction changes no production file policy.

## Added validation

Extended the existing offline PGlite fixture rather than creating another messaging implementation:

- Exact top-level and nested metadata allowlists for both service and project lists/details across departments, including linked references and cache headers.
- Message/file/private-DM/meeting-content search exclusion; deleted service message and Staff-only project activity exclusion from latest-shared-message timestamps.
- Direct administrative nested-resource probes and POST/PUT/PATCH/DELETE attempts against message, read, participant and reaction paths, with unchanged persisted participant state.
- Forged user/role/permission claims cannot elevate ordinary accounts. Current database-role authorization remains authoritative.
- Superadmin's own private chat remains explicit normal participation: forged sender fields cannot impersonate another account, forged read-marker subjects cannot update the other participant, and even this owned DM is absent from administrative oversight.
- Head handoff and project assignment removal revoke operational access while organization-wide metadata remains available; deactivation, retirement and role changes revoke administrative access on the existing session.

Browser validation adds both required-grant denial cases, Department Head denial, backend `403` and capability denial, ignored unexpected private payload properties, and private-thread metadata deep-link failure without participant requests. Unit coverage confirms global metadata authority does not create operational inbox/project eligibility or change the normal Messages entry.

## Earlier browser failures

The five failures recorded during Phase 3D.1 were already resolved by [testing regression recovery](testing-regression-recovery.md): four archive clicks were intercepted by an overlapping search label, and a mobile module test clicked an offscreen carousel card. Those fixes are pre-existing working-tree changes for this phase. All five scenarios passed again; no unrelated UI or workflow was changed to make this validation pass.

| Previously failing scenario                          | Phase 3D.3 result |
| ---------------------------------------------------- | ----------------- |
| Admin shared internal thread across modules at 390px | Passed            |
| Project Management scoped project history at 1440px  | Passed            |
| Client project messaging and archived history        | Passed            |
| Staff project messaging and archived history         | Passed            |
| Client ended-booking conversation context            | Passed            |

## Changed files and verification

Phase changes are limited to `apps/api/tests/features/auth/administrative-conversations.test.ts`, `apps/web/e2e/administrative-conversations.spec.ts`, `apps/web/test/business-conversation-access.test.mjs`, this report, `docs/features/README.md` and the link from `docs/features/superadmin-messaging-oversight.md`. No production source file was changed in this phase.

- All 40 selected backend tests passed through the normal API test command: administrative conversation authorization/privacy, service/project/internal participant regressions, Phase 2A capabilities and role-policy tests. This includes all 12 cases in the expanded administrative conversation test.
- All 107 web unit tests passed.
- All 108 selected browser tests passed: administrative metadata oversight/privacy, request/project/internal conversations, message topbar and module-scoped navigation. No selected test was skipped or blocked, and no existing or new selected failure remains. The complete repository-wide browser/API suites were not rerun in this validation phase.
- `pnpm format`, `pnpm lint`, `pnpm typecheck`, API/web production build and `git diff --check` passed.

The recovered compiler/native Node test launcher ran successfully; the earlier `tsx` startup restriction did not block these tests. Initial test-only type/fixture errors were corrected without relaxing production validation or database constraints.

Content inspection, attachments through oversight, administrative messaging mutations, participation grants, Diagnostics and centralized System Logs remain outside scope. Validation uses local offline PGlite and mocked browser contracts; it does not access a live database or constitute a live Storage/Realtime deployment assessment.

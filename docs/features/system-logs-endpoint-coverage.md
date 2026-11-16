# System Logs — mutation endpoint coverage matrix

Inspected: 2026-11-16. Phase 1 documentation only. Companion: [contracts and policies](system-logs-contracts.md).

## Meaning, scope and evidence

This inventories mounted Express mutation routes in [app.ts](../../apps/api/src/app.ts), including loop-generated Client POST/PATCH and Employee DELETE routes, plus the administrative project route outside controller filenames. Re-export `routes.ts` files are not extra endpoints. GETs are excluded from the mutation count; session activity bookkeeping and source readers are discussed separately. No mobile mutation API or unimplemented finance/payroll API is invented.

**Complete** = the scoped committed management effects have authenticated transactional attribution using the existing bounded writers, supported by the prior attribution record and current wiring. It does not mean every failed attempt is security-logged, every concurrency interleaving is certified, or pre-integration history was backfilled.

**Partial** = some durable actor/state/event evidence exists, but transition detail, branches, historical role, operation correlation or preservation is incomplete. **Missing** = no durable audit/security event for the mutation was found; ordinary business ownership alone is insufficient. **Not applicable** = deliberately excluded low-value read/preference bookkeeping; still subject to operational/security diagnostics when warranted. N/A never means an endpoint is public or exempt from authorization.

Statuses describe current audit evidence, not implementation of the future central viewer (none exists). Conservative partial classifications are intentional; they do not demand full personal snapshots. Source/test inspection was performed; behavioral suites were not rerun in Phase 1. Each semicolon-separated method/path is a separate endpoint; prefixes are literal mount paths.

## Original 26 plus Account profile update

All rows below are **Complete** within the original scoped management contract. The [Team reconciliation](team-management-attribution.md#reconciliation-against-the-original-26-endpoints) maps the original 26 to persisted-state suites. Actor/role/operation are backend-owned; history shares business transactions. No-op and derived synchronization semantics remain unchanged.

| #          | Full method/path                                  | Source evidence                                                               |
| ---------- | ------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1          | `POST /api/users`                                 | users controller/service/repository → account/workforce writers               |
| 2          | `PATCH /api/users/:id/role`                       | users service/repository → locked role/synchronization history                |
| 3          | `PATCH /api/users/:id/status`                     | users service/repository → status/session history                             |
| 4          | `POST /api/users/:id/password`                    | users service/repository → reset/session history                              |
| 5          | `DELETE /api/users/:id`                           | users service/repository → archival history                                   |
| 6          | `POST /api/users/:id/restore`                     | users service/repository → restoration history                                |
| 7          | `DELETE /api/users/:id/permanent`                 | users service/repository → deletion/workforce effects                         |
| 8          | `POST /api/clients`                               | clients controller/repository → account history                               |
| 9          | `PATCH /api/clients/:id`                          | clients controller/repository → profile/status history                        |
| 10         | `DELETE /api/clients/:id`                         | clients controller/repository → archival/session history                      |
| 11         | `POST /api/employees`                             | employee creation service → actual account/workforce creation                 |
| 12         | `POST /api/employees/accounts/:accountId/profile` | employee creation service → attachment history                                |
| 13         | `PUT /api/employees/:id`                          | employee update service/effect writers                                        |
| 14         | `POST /api/employees/:id/account`                 | employees controller → transactional account/link effects                     |
| 15         | `PATCH /api/employees/:id/account/status`         | employees lifecycle service → account history                                 |
| 16         | `DELETE /api/employees/:id/account`               | employees lifecycle service → archival history                                |
| 17         | `DELETE /api/employees/:id/account/permanent`     | employees lifecycle service → deletion/unlink history                         |
| 18         | `POST /api/departments`                           | department repository → creation/workforce history                            |
| 19         | `PUT /api/departments/:id`                        | department repository → Department/Head/synchronization effects               |
| 20         | `DELETE /api/departments/:id`                     | department deletion helpers → cascading workforce effects                     |
| 21         | `POST /api/departments/:id/members`               | department member snapshots/final-state writer                                |
| 22         | `PATCH /api/departments/:id/members/:memberId`    | department member snapshots/final-state writer                                |
| 23         | `DELETE /api/departments/:id/members/:memberId`   | department member snapshots/final-state writer                                |
| 24         | `POST /api/departments/:id/teams`                 | Team service/helper → coalesced workforce effects                             |
| 25         | `PUT /api/departments/:id/teams/:teamId`          | Team service/helper → protected before/final state                            |
| 26         | `DELETE /api/departments/:id/teams/:teamId`       | Team service/helper → deletion and surviving membership effects               |
| Additional | `PATCH /api/users/:id`                            | transactional profile/role update and management history; outside original 26 |

Source anchors: [users](../../apps/api/src/features/users/users.repository.ts), [clients](../../apps/api/src/features/clients/clients.repository.ts), [employees](../../apps/api/src/features/employees/employees.controller.ts), [employee services](../../apps/api/src/features/employees/employees.service.ts), [departments](../../apps/api/src/features/departments/departments.repository.ts), [Team service](../../apps/api/src/features/departments/teams.service.ts). Relevant suites live in `apps/api/tests/features/{users,clients,employees,departments}/`; historical passing totals are not a new test run.

## Other mounted mutation routes

### Authentication and settings

Evidence: [auth controller](../../apps/api/src/features/auth/auth.controller.ts), [auth service](../../apps/api/src/features/auth/auth.service.ts), [auth repository](../../apps/api/src/features/auth/auth.repository.ts), [settings controller](../../apps/api/src/features/auth/settings.controller.ts).

| Full method/path                                                                                               | Coverage       | Evidence / gap                                                                                                       |
| -------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/register`                                                                                      | Missing        | Account creation/session issuance, no management/security event; public registration is outside original inventory   |
| `POST /api/auth/login`                                                                                         | Partial        | Session evidence on success, volatile failed-attempt map; no durable outcome stream                                  |
| `POST /api/auth/refresh`                                                                                       | Partial        | Consumed refresh records and reuse-triggered revocation; family deletion removes evidence; no durable incident event |
| `POST /api/auth/logout`                                                                                        | Missing        | Session deleted, no retained logout event                                                                            |
| `POST /api/auth/change-password`                                                                               | Missing        | Password update, no dedicated durable security history                                                               |
| `PATCH /api/auth/profile`; `PUT /api/auth/profile/specialist`; `POST /api/auth/profile/images`                 | Missing        | Self-service updates/uploads have no comparable audit history                                                        |
| `PATCH /api/auth/settings`                                                                                     | Not applicable | Display/notification preferences; exclude normal audit, retain diagnostics for failures                              |
| `POST /api/auth/sessions/revoke-all`; `POST /api/auth/sessions/revoke-others`; `DELETE /api/auth/sessions/:id` | Missing        | Deletions enforce ownership but do not retain revocation events                                                      |

### Catalog and service requests

Evidence: [catalog controller](../../apps/api/src/features/services/services.controller.ts), [catalog repository](../../apps/api/src/features/services/services.repository.ts), [submission service](../../apps/api/src/features/service-requests/service-requests.service.ts), [client routes](../../apps/api/src/features/client-services/client-services.controller.ts), [inbox service](../../apps/api/src/features/request-inbox/request-inbox.service.ts).

| Full method/path                                                                                            | Coverage | Evidence / gap                                                                                         |
| ----------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `POST /api/services`; `PUT /api/services/:id`; `PATCH /api/services/:id/status`; `DELETE /api/services/:id` | Missing  | No actor/history passed through these catalog mutations                                                |
| `PUT /api/services/pricing-templates/:id`; `DELETE /api/services/pricing-templates/:id`                     | Missing  | No comparable attributed history                                                                       |
| `POST /api/service-requests`; `POST /api/client/service-requests`                                           | Partial  | Same submission service; client ownership/createdAt persist, no dedicated creation event/role snapshot |
| `POST /api/client/service-requests/:id/cancel`                                                              | Missing  | Direct scoped status update, no cancellation history append                                            |
| `POST /api/request-inbox/:id/accept`                                                                        | Partial  | acceptedBy/time and transactional workflow initialization events; no common operation/role snapshot    |

### Workflow and workload

Evidence: [workflow controller](../../apps/api/src/features/request-workflow/workflow.controller.ts), [command service](../../apps/api/src/features/request-workflow/workflow.service.ts), [upload service](../../apps/api/src/features/request-workflow/workflow.files.ts), [workload controller](../../apps/api/src/features/workload/workload.controller.ts).

| Full method/path                                                                                             | Coverage       | Evidence / gap                                                                                                              |
| ------------------------------------------------------------------------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/request-workflows/:id/actions`                                                                    | Partial        | Transactional WorkflowEvent and action receipt; no role snapshot/event-to-action link, no universal bounded transition diff |
| `POST /api/request-workflows/:id/files`                                                                      | Partial        | Uploader/file identity; non-contextual branch appends event, contextual branch omits it; never expose filename/content      |
| `PATCH /api/request-workflows/notifications/read-all`; `PATCH /api/request-workflows/notifications/:id/read` | Not applicable | Notification read bookkeeping, not activity counts                                                                          |
| `PUT /api/workload/capacity`                                                                                 | Partial        | Current updatedById only; overwritten history                                                                               |
| `PUT /api/workload/assignment`                                                                               | Partial        | Approval fields; conditional workflow event when request linkage exists; no full transition chain                           |
| `DELETE /api/workload/assignment/:id`                                                                        | Missing        | Scoped deletion without retained removal event                                                                              |

`/:id/actions` command expansion (one endpoint, not additional routes): REQUEST_CONSULTATION_RESCHEDULE, RESPOND_CONSULTATION_RESCHEDULE, REQUEST_REQUIREMENT, SUBMIT_REQUIREMENT, REVIEW_REQUIREMENT, SCHEDULE_CONSULTATION, COMPLETE_CONSULTATION, CANCEL_CONSULTATION, PREPARE_QUOTATION, FIXED_QUOTATION, CREATE_QUOTATION, APPROVE_QUOTATION, RESPOND_QUOTATION, ATTACH_AGREEMENT, SIGN_AGREEMENT, REVIEW_AGREEMENT, COMPLETE_SANDBOX_PAYMENT, SUBMIT_PAYMENT, VERIFY_PAYMENT, ASSIGN_APPROVERS, STAFF_PROJECT, ACTIVATE_PROJECT, HOLD, RESUME, CANCEL, INTERNAL_NOTE. All inherit Partial; receipt replay is not a new action; INTERNAL_NOTE content is excluded from centralized output. Any future completeness claim must validate branches individually.

### Projects and workspaces

Evidence: [workspace controller](../../apps/api/src/features/project-workspace/project-workspace.controller.ts), [workspace service](../../apps/api/src/features/project-workspace/project-workspace.service.ts), [project controller](../../apps/api/src/features/projects/projects.controller.ts), [project service](../../apps/api/src/features/projects/projects.service.ts), [administrative project routes](../../apps/api/src/features/projects/administrative-projects.ts).

| Full method/path                                                                                                                                                                                                                                                            | Coverage | Evidence / gap                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `POST /api/project-workspace`                                                                                                                                                                                                                                               | Partial  | Workspace creator/current relations and workflow events; no uniform role/diff contract |
| `PATCH /api/project-workspace/:id`; `PATCH /api/administrative-projects/:id/workspace-name`                                                                                                                                                                                 | Partial  | Rename events; preserve separate operational/administrative authorization paths        |
| `POST /api/project-workspace/:id/cancel`; `POST /api/project-workspace/:id/status`                                                                                                                                                                                          | Partial  | Workspace lifecycle workflow events; status action expands ON_HOLD/RESUME/COMPLETE     |
| `PUT /api/project-workspace/:id/projects/:projectId/team-lead`                                                                                                                                                                                                              | Missing  | isTeamLead reset/set, no event append in this function                                 |
| `PUT /api/project-workspace/:id/projects/:projectId/plan`                                                                                                                                                                                                                   | Partial  | Plan-updated workflow event, not per-task transition snapshot                          |
| `POST /api/project-workspace/:id/projects/:projectId/tasks`; `PATCH /api/project-workspace/:id/projects/:projectId/tasks/:taskId`                                                                                                                                           | Partial  | Task workflow events; no uniform role-at-time/diff contract                            |
| `PATCH /api/project-workspace/:id/projects/:projectId/deliverables/:deliverableId`                                                                                                                                                                                          | Partial  | Deliverable metadata event, not complete field transition history                      |
| `POST /api/project-workspace/:id/projects/:projectId/deliverables/:deliverableId/attachment`; `DELETE /api/project-workspace/:id/projects/:projectId/deliverables/:deliverableId/attachment`                                                                                | Partial  | Upload/removal workflow events; privacy-sensitive source summaries                     |
| `POST /api/project-workspace/:id/projects/:projectId/deliverables/:deliverableId/approve`; `POST /api/project-workspace/:id/projects/:projectId/deliverables/:deliverableId/reject`; `POST /api/project-workspace/:id/projects/:projectId/deliverables/:deliverableId/send` | Partial  | Review/send workflow events; no role snapshot/common operation                         |
| `PATCH /api/projects/:id/brief`                                                                                                                                                                                                                                             | Missing  | Direct project update in transaction, no history append                                |
| `POST /api/projects/:id/change-requests`; `PATCH /api/projects/:id/change-requests/:changeRequestId`                                                                                                                                                                        | Partial  | Requester/reviewer/status fields; no full immutable transition stream                  |
| `POST /api/projects/:id/cancellation-requests`; `PATCH /api/projects/:id/cancellation-requests/:cancellationRequestId`                                                                                                                                                      | Partial  | Decision fields plus workflow events; role/operation/diff gaps remain                  |
| `POST /api/projects/:id/deliverables/:milestoneId/review`                                                                                                                                                                                                                   | Partial  | Version/file-linked client review rows; not a universal event history                  |
| `PATCH /api/projects/:id/milestones/:milestoneId`                                                                                                                                                                                                                           | Partial  | Conditional request-linked workflow event; no role snapshot                            |

### Attendance

Evidence: [routes](../../apps/api/src/features/attendance/routes.ts), [management service](../../apps/api/src/features/attendance/attendance.management.ts), [self-service](../../apps/api/src/features/attendance/attendance.service.ts), [foundation triggers](../../apps/api/prisma/migrations/20261113150000_attendance_foundation/migration.sql), [adjustment trigger](../../apps/api/prisma/migrations/20261113160000_attendance_adjustments/migration.sql).

| Full method/path                                                                                                                                      | Coverage | Evidence / gap                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `POST /api/attendance/policies`; `PATCH /api/attendance/policies/:policyId`                                                                           | Partial  | Trigger snapshots and service actor/reason; no historical role or common multi-row operation                   |
| `POST /api/attendance/policies/:policyId/archive`; `POST /api/attendance/policies/:policyId/restore`; `DELETE /api/attendance/policies/:policyId`     | Partial  | Trigger-owned lifecycle audit; same correlation/role gaps                                                      |
| `POST /api/attendance/assignments`; `POST /api/attendance/assignments/:assignmentId/unassign`                                                         | Partial  | Assignment trigger snapshots; preserve policy/assignment integrity                                             |
| `POST /api/attendance/adjustments`; `POST /api/attendance/adjustments/:adjustmentId/review`                                                           | Partial  | Adjustment triggers capture requests/stages/decisions; note privacy and per-row action IDs                     |
| `POST /api/attendance/me/clock-in`; `POST /api/attendance/me/clock-out`; `POST /api/attendance/me/breaks/start`; `POST /api/attendance/me/breaks/end` | Partial  | Session/workday/break triggers and transaction-local actor; not missing, but no shared operation/role snapshot |

Partial does not dispute attendance's existing audit behavior. Direct database changes can be captured with unknown actor; do not manufacture authenticated provenance. No second emitter should duplicate trigger records.

### Messaging and meetings

Evidence: [service conversation controller](../../apps/api/src/features/request-conversations/request-conversations.controller.ts), [service](../../apps/api/src/features/request-conversations/request-conversations.service.ts), [project conversation controller](../../apps/api/src/features/project-conversations/project-conversations.controller.ts), [internal conversation controller](../../apps/api/src/features/internal-conversations/internal-conversations.controller.ts), schema message/deletion/meeting models.

| Full method/path                                                                                                        | Coverage       | Evidence / gap                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------- |
| `POST /api/request-conversations/:id/meetings`; `PATCH /api/request-conversations/:id/meetings/:meetingId`              | Partial        | Meeting business state/organizer evidence; no general immutable administrative history          |
| `POST /api/request-conversations/:id/messages`                                                                          | Partial        | Authenticated sender/message row; not a separate audit stream                                   |
| `PATCH /api/request-conversations/:id/messages/:messageId`; `DELETE /api/request-conversations/:id/messages/:messageId` | Partial        | Existing message edit/deletion state; no bounded immutable transition history; content excluded |
| `DELETE /api/request-conversations/:id`                                                                                 | Partial        | Conversation deletion marker, not a common actor/role/operation ledger                          |
| `PATCH /api/request-conversations/:id/read`                                                                             | Not applicable | Private read bookkeeping, excluded                                                              |
| `POST /api/project-conversations/:id/messages`                                                                          | Partial        | Sender/business message evidence only; no new content visibility                                |
| `PATCH /api/project-conversations/:id/read`                                                                             | Not applicable | Read bookkeeping                                                                                |
| `POST /api/internal-conversations`; `POST /api/internal-conversations/:id/messages`                                     | Partial        | Participant/sender business records; centralized exposure prohibited by privacy policy          |
| `PATCH /api/internal-conversations/:id/read`                                                                            | Not applicable | Private read bookkeeping                                                                        |

## Non-route and investigation gaps

Health, module discovery, administrative workload/conversation/request inspection and project-management overview expose reads, not additional mutation endpoints. Auth middleware's session activity touch is excluded routine bookkeeping. File downloads, sensitive reads, denied access and rate limiting need future security/operational coverage even though they are not mutations. Conversation expiry purge, storage compensation/cleanup, process shutdown, seeds and direct SQL are not endpoint rows and do not inherit the 26-path coverage. Inspect them separately before promising application-wide logging.

No aggregate “fully audited application” percentage is claimed: complete scoped management paths, partial business evidence and deliberately private bookkeeping have different contracts. The central feature must display coverage limitations; absence of events is not proof that no action occurred.

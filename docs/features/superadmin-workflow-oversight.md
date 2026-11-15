# Superadmin service request workflow oversight (Phase 3B.3A)

Developed: 2026-11-14

Follow-up, 2026-11-15: [test regression recovery](testing-regression-recovery.md) corrects the Client-milestone expectation and removes the automated test launcher's dependency on `tsx`. The results below describe the earlier phase run.

## Authorization and data audit

The operational `workflowAccess` gate admits only the owning Client, current Staff Department Head, or explicitly assigned Admin/Superadmin quotation approver/payment verifier. The existing snapshot scopes submissions, financial documents, internal events and controls to those responsibilities. Its structured action service separately rechecks authorization, version, stage and business validation. These gates remain unchanged.

Administrative request inspection already requires both Phase 2A module access and organization-wide read capabilities. The detail endpoint is extended with a metadata-only workflow snapshot in the same repeatable-read transaction as request details. It neither calls the participant snapshot nor initializes missing workflows.

## Inspection boundary

Expose current/previous stage, version, timestamps, existing next-step guidance, consultation/linked-meeting statuses and schedules, requirement status metadata, quotation version/publication/internal-approval timestamps, formal Client acceptance, agreement/payment verification status, assigned approvers, personnel and project activation metadata.

Workflow event summaries can contain internal notes, requirement submissions, payment references, private meeting locations or credentials. Administrative history therefore selects only known structured event types, timestamps and actual actors. It replaces raw summaries with neutral event labels, omits entity links and excludes internal-note/payment-review-note events. A payment-verification event is labelled as a review because the existing event type is also emitted for rejected verification; no outcome is invented from its type.

Exclude private conversations, free-text submissions/review notes, quotation financial details, payment references/credentials, file names/identifiers/content/downloads and unrelated HR records. Linked meeting IDs are response-local and reveal no private conversation identifier. Unknown event types are excluded until reviewed for inspection.

Use shared WorkflowProgress, WorkflowCard, WorkflowBadge, SystemStatusUpdate and detail components. The progress component accepts its existing state/previous-state inputs without needing a fabricated participant workflow object. Existing actor permissions and administrative mutation/participation/download/activation flags are all false. Pending guidance describes progress, not permission to execute an action or a replacement for business validation.

Workflow mutations, acceptance, approvals, verification, staffing, activation, private conversations/files, Diagnostics and System Logs remain outside this phase.

## Implementation

`GET /api/administrative-requests/:id` includes `serviceRequest.workflowInspection`. The request list retains its existing lightweight workflow state selection. All administrative route middleware still checks both capabilities against the current account. Operational `/api/request-workflows` access, file authorization, stage transitions and structured actions are unchanged.

The administrative read uses the existing workflow enum/relations and exported `nextAction` guidance. It preserves workflow timestamps, quotation versions, Client acceptance actors, assigned approver identities, requirement statuses, staffing approval timestamps and project start dates. Consultation completion follows the existing rule that either a completed workflow consultation or a completed linked service meeting satisfies completion. Missing workflow history stays missing: reads return the existing pending/cancelled fallback and version zero without creating a workflow or events. No approval, capacity, assignment, notification or action receipt is written by inspection.

The existing request detail page adds a read-only section for current/previous stages, pending-step guidance, consultation/meeting schedules and reschedule proposals, requirements, quotations/approvals, agreement/payment status, staffing/activation and ordered history. Current responsible departments remain in the existing request metadata. The shared progress indicator retains its existing on-hold/prior-stage behavior. No workflow action hooks, participant card controls, meeting join links, private previews or downloads are mounted. Backend denial removes the entire request detail and workflow history.

Known structured internal events such as assigned approvers, quotation approval and staffing are included with neutral labels and actual actors. Private `INTERNAL_NOTE`, `PAYMENT_INTERNAL_REVIEW`, unknown event types, raw summaries and entity identifiers are excluded. Recorded `PAYMENT_VERIFIED` events show that verification was reviewed, while current payment status reflects whether it was actually verified. Pending-step guidance remains descriptive and does not assert action eligibility, infer missing timestamps or recalculate lifecycle readiness.

## Changed files

- Backend: `apps/api/src/features/request-workflow/administrative-workflow.service.ts` (new projection), `workflow.snapshot.ts` (export existing guidance), and `apps/api/src/features/request-inbox/administrative-requests.ts` (detail integration/read transaction).
- Frontend: `apps/web/src/features/request-workflow/model/administrative-workflow.ts`, `components/administrative-workflow-progress.tsx`, `components/workflow-primitives.tsx`, `apps/web/src/features/request-inbox/api/administrative-requests-api.ts`, and `pages/administrative-requests-page.tsx`.
- Tests: `apps/api/tests/features/auth/administrative-workflow.test.ts` and `apps/web/e2e/administrative-workflow.spec.ts`.
- Documentation: this report, `docs/features/README.md`, `docs/features/module-role-access.md`, `docs/features/superadmin-service-request-visibility.md` and `docs/rbac.md`.

## Validation

- `pnpm format`, `pnpm lint`, `pnpm typecheck` and the full production `pnpm build` passed.
- 45 selected offline PGlite backend tests passed: administrative workflow, administrative requests, administrative workload, Request Inbox and backend regression. New coverage checks multiple departments without participation, all workflow enum states, on-hold prior state, history order/actors, statuses/timestamps, private data exclusion, absent workflow preservation, denied mutations, current-role revocation, and unchanged Head/Client/assigned-approver access. Explicit financial assignment still authorizes the existing operational endpoint independently, while the administrative view always reports false operational permissions.
- All 104 web unit tests passed.
- 58 selected browser tests passed: administrative workflow, administrative requests, administrative workload, Request Inbox, operational request workflow and Staff Workload. Oversight tests cover desktop/mobile rendering, progress/history, pending reschedule metadata, absence of operational controls/requests and removal of history after a backend denial.

The existing `request-workflow.test.ts` was also executed: 16 tests passed; the previously documented Client-milestone assertion failed when reading `milestones[0].id` from a Client response that excludes internal milestones (source line 1359). Node reports two failures for the failed child and its parent suite. That unrelated assertion and its workflow code were preserved. No new regression was observed in the selected checks.

The standard `tsx` runner still fails at startup with `uv_os_get_passwd ENOMEM` in this environment. Backend tests were compiled using the existing test TypeScript configuration and executed with `node --test` against the same offline PGlite harness. No live database was used. The full API/browser suites were not run.

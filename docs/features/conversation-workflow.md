# Conversation-centered service requests

Developed: 2026-10-30

After a department head accepts a request for consultation, its existing conversation becomes the workspace for requirements, consultation appointments, quotations, formal client decisions, agreements, payment evidence, and project activation. Booking submission, department routing, and ordinary messages retain their existing records and endpoints.

## Workflow and configuration

The backend owns the workflow state independently of the legacy request status:

`CONSULTATION → QUOTATION_PENDING → CLIENT_APPROVAL → AGREEMENT_PAYMENT_PENDING → READY_FOR_ACTIVATION → ACTIVE_PROJECT`

Revision requests return work to the head. Declined, cancelled, and on-hold states are handled explicitly. The workflow tracker and next-action text reflect persisted state. Chat text cannot approve quotations or complete payment requirements.

Service Management exposes commencement policies for consultation, signed agreement, manual payment verification, and internal quotation approval. Policies are copied when a request is accepted, so changing a catalog service does not remove mandatory requirements from an existing conversation. Fixed-price requests can use their booked pricing without negotiation; the client must still make the formal quotation decision.

## Structured actions

- Requirements have requested, submitted, and completed states. The head reviews submissions before mandatory requirements are satisfied.
- Consultations have a schedule, location, and completion state.
- Quotations retain scope, deliverables, line items, timeline, payment terms, validity, and version history. Only the latest published, unexpired version can be accepted.
- Formal client acceptance stores an immutable approval identifying the account, quotation version, amount, currency, and timestamp. It prepares an agreement, payment requirement, and draft project atomically.
- Agreement review and manual verification of payment evidence complete the commencement checklist. There is no payment gateway integration.
- Staffing selection records the approving head. Availability, specialties, workload, and department scope inform selection; activation rechecks eligibility.
- Activation requires the mandatory checklist and approved staffing, then opens the project workspace with deliverables as milestones. Repeated actions cannot create additional projects.

Files are stored privately with metadata and downloaded through an authenticated, request-scoped endpoint. File uploads, requirement submissions, and formal actions remain separate from ordinary message records. System cards link to the corresponding persisted records.

## Scoped access

Clients see their own conversation, public workflow events, documents, and activated project. They never receive staffing selections, internal notes, approver assignments, or unpublished proposals. Draft projects remain hidden from client-facing project APIs and listings, including cancelled drafts that never started.

The current active head of the accepted department manages the workflow. Reassigning the head revokes the former head's access. Staff members can update project milestones only when actively assigned to that project, still in its accepted department, and backed by an active Staff account.

Administrators do not gain conversation access from their role. The head explicitly assigns quotation approvers and payment verifiers per request. Assigned active Admin or Superadmin accounts use **Workflow Approvals** to review the permitted records. Quotation approval and payment verification are separate grants: a quotation-only approver does not receive payment evidence or signed agreement documents. Assignment changes and internal verification notes are auditable without appearing in client conversation records.

The notification bell links clients and heads to the affected conversation and assigned approvers to the dedicated approval workspace. Notifications are filtered using current record access.

## Implementation and verification

The migration `20261031010000_request_workflow` adds workflow records, private files, consultation schedules, versioned quotations, immutable approvals/events, action receipts, agreements, payments, project assignments, milestones, and notifications. Existing accepted requests are backfilled conservatively; existing service requests and chat history are preserved. Run the migration through the normal deployment process before starting the updated API.

API integration tests use offline PGlite. They verify authoritative transitions, quotation validity/versioning, idempotency, approval history, activation gates, project uniqueness, current-head scope, client data projections, and private downloads. Browser coverage includes quotation review, manual payment evidence review, notifications, project handoff, milestone controls, and mobile layouts.

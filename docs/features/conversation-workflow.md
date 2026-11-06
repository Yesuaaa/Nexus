# Conversation-centered service requests

Developed: 2026-10-30

After a department head accepts a request for consultation, its existing conversation becomes the workspace for requirements, consultation appointments, quotations, formal client decisions, agreements, payment evidence, and project activation. Booking submission, department routing, and ordinary messages retain their existing records and endpoints.

## Workflow and configuration

The backend owns the workflow state independently of the legacy request status:

`CONSULTATION → QUOTATION_PENDING → CLIENT_APPROVAL → AGREEMENT_PAYMENT_PENDING → READY_FOR_ACTIVATION → ACTIVE_PROJECT`

Revision requests return work to the head. Declined, cancelled, and on-hold states are handled explicitly. The workflow tracker and next-action text reflect persisted state. Chat text cannot approve quotations or complete payment requirements.

Service Management exposes commencement policies for consultation, payment verification, and internal quotation approval. Formal client quotation acceptance also confirms the service agreement, including for services with the legacy signed-agreement policy. Policies are copied when a request is accepted, so changing a catalog service does not remove mandatory requirements from an existing conversation. Fixed-price requests can use their booked pricing without negotiation; the client must still make the formal quotation decision.

The conversation tools menu contains only Attach file, Request information, Schedule consultation/meeting, Create quotation, and Project activation. Actions appear only when at least one current booking is at an eligible stage; completed projects retain attachments and meetings. Payment stays in the conversation cards. Staffing is edited in a modal, while chat details shows the assigned team and workflow controls. Approver assignments and private notes are available under Internal tools in chat details.

## Structured actions

- Requirements have requested, submitted, and completed states. Clients can submit a text response or attach 1–5 supporting files (PDF, Word, PNG, JPEG or plain text; up to 5 MB each). Files can be added in batches and removed before submission. Upload and save retries retain the draft and reuse completed uploads. Both participants can open every attachment in the submitted requirement. The head reviews submissions before mandatory requirements are satisfied.
- **Schedule consultation/meeting** opens a conversation-level invitation sheet above the chat composer, using the same frame and actions as Request information and quotation. The message draft remains editable while scheduling. Meetings can be general or optionally linked to one or several booked services, at any booking stage. They appear once in the shared timeline, retain their schedule independently of sidebar selection, and support client reschedule requests plus head confirmation, completion, and cancellation. A completed meeting satisfies the consultation requirement only for its explicitly linked services; a general meeting does not change booking requirements. Existing booking-specific consultation history remains available.
- Quotations retain scope, deliverables, line items, timeline, payment terms, validity, and version history. Only the latest published, unexpired version can be accepted.

  Sent quotation cards show the associated service request's reference number inside the card for clients, department heads and assigned approvers. Older bookings without a reference display their request ID.

  The quotation editor uses the original inline draft frame above the chat composer, preserving its four-step flow, scrolling, size limit and sticky action bar. Opening a quotation leaves the chat layout and details-panel preference unchanged; toggling chat details preserves the quotation draft. Currency and time menus use the shared Radix selects. Amounts show thousands separators while typing and two decimal places on blur; submission retains plain decimal strings. Commencement payment and validity share a row. A custom keyboard-accessible calendar and hour/minute/AM–PM selectors set the validity deadline in the displayed local time zone. Past dates are disabled, and deadlines must fall within the next year.

- Formal client acceptance stores an immutable approval identifying the account, quotation version, amount, currency, and timestamp. It confirms the service agreement, prepares the payment requirement, and creates one draft project with deliverables as milestones atomically. A separate signed agreement is not part of the commencement checklist.
- The prototype card checkout automatically verifies its simulated payment and stores a server-generated receipt and sandbox reference in one transaction. Verified payment makes the service ready for department-head activation once mandatory information requirements are complete. Uploaded payment evidence retains manual verification. There is no live payment gateway integration or real charge.
- Staffing selection records the approving head. Availability, specialties, workload, and department scope inform selection; activation rechecks eligibility. The head can update assignments on active services without creating another project workspace.
- Activation requires formal quotation acceptance, verified mandatory payment, completed information requirements, and approved staffing, then opens the project workspace with deliverables as milestones. **Project activation** is the last conversation tool when a booking is ready. Choosing its booking opens a project setup modal without changing the chat-details preference. The head selects active department employees, approves staffing, and then explicitly activates the project in the same modal. Cancel discards unsaved selections; failed saves retain them for retry. Chat details shows assigned staff and shortcuts to project setup or the staff-management modal, including for active projects. Repeated actions cannot create additional projects.

Files are stored privately with metadata and downloaded through an authenticated, request-scoped endpoint. File uploads, requirement submissions, and formal actions remain separate from ordinary message records. System cards link to the corresponding persisted records.

## Scoped access

Clients see their own conversation, public workflow events, documents, and activated project. They never receive staffing selections, internal notes, approver assignments, or unpublished proposals. Draft projects remain hidden from client-facing project APIs and listings, including cancelled drafts that never started.

The current active head of the accepted department manages the workflow. Reassigning the head revokes the former head's access. Staff members can update project milestones only when actively assigned to that project, still in its accepted department, and backed by an active Staff account.

Administrators do not gain conversation access from their role. The head explicitly assigns quotation approvers and payment verifiers per request. Assigned active Admin or Superadmin accounts use **Workflow Approvals** to review the permitted records. Quotation approval and payment verification are separate grants: a quotation-only approver does not receive payment evidence or signed agreement documents. Assignment changes and internal verification notes are auditable without appearing in client conversation records.

The notification bell links clients and heads to the affected conversation and assigned approvers to the dedicated approval workspace. Notifications are filtered using current record access.

## Implementation and verification

The migration `20261031010000_request_workflow` adds workflow records, private files, consultation schedules, versioned quotations, immutable approvals/events, action receipts, agreements, payments, project assignments, milestones, and notifications. Existing accepted requests are backfilled conservatively; existing service requests and chat history are preserved. `20261102010000_conversation_meetings` adds shared meetings and optional service links, with private conversation invalidations and RLS. `20261106010000_quotation_acceptance_agreement` confirms agreements for existing accepted quotations and releases paid bookings waiting only on the obsolete signature step; held bookings remain on hold. Run pending migrations with `pnpm --filter @nexus/api exec prisma migrate deploy` before starting the updated API.

`20261106000000_requirement_attachments` adds multiple requirement attachments and backfills existing single-file submissions. Requirement snapshots expose `fileIds`; `SUBMIT_REQUIREMENT` accepts 1–5 distinct `fileIds` belonging to the signed-in client and the same request. The legacy `fileId` input remains supported. Rejected submissions replace their attachment selection when resubmitted.

`POST /api/request-conversations/:id/meetings` accepts `clientActionId`, `startsAt`, `endsAt`, `location`, `notes`, and `bookingIds` (an empty list creates a general meeting). Only the current active department head may schedule. Invitation retries reuse their UUID. Conversation history includes persisted `meetings`; `PATCH /api/request-conversations/:id/meetings/:meetingId` accepts an `expectedVersion` and `REQUEST_RESCHEDULE`, `RESCHEDULE`, `KEEP_SCHEDULE`, `COMPLETE`, or `CANCEL` action. Only the client may request rescheduling; the head manages the schedule and status. Closed conversations are read-only, and service links must belong to the same shared conversation.

API integration tests use offline PGlite. They verify authoritative transitions, quotation validity/versioning, idempotency, approval history, activation gates, project uniqueness, current-head scope, client data projections, and private downloads. Browser coverage includes quotation review, manual payment evidence review, notifications, project handoff, milestone controls, and mobile layouts.

Workflow reads retain repeatable-read consistency with a 20-second transaction timeout and a 10-second connection wait budget. Department heads load additional staffing and approval data, which can exceed Prisma's default five-second timeout against a remote database. The selected booking uses the sidebar's workflow controller; background controllers load only the other bookings, avoiding duplicate initial reads and polling. Regression tests cover slow head workflow reads and one poll per booking.

# Leave requests

Developed: 2026-11-17

Status: Implemented. This record preserves the workflow design, edge-case contract, and frontend reuse decisions that guided the shipped feature. Policy defaults describe application behavior, not company policy or legal entitlements.

### Review fixes (2026-11-17)

Department transfers block final approval until the receiving Head explicitly verifies again; that mutation appends a decision and updates routing metadata. If there is no receiving Head, cancel and resubmit through the HR exception route. No GET handler mutates routing. Future approved leave blocks policy edits and reassignment; active future requests block assignment removal. These guards use Employee serialization and policy row locks.

Corrections check every local date touched by their interval, with exclusive end boundaries. Leave approval requires all open sessions to be closed. An already-started shift may still cross into future approved leave: clock-out remains available as a recovery operation, records the conflict in the attendance audit, returns a visible conflict warning, and notifies HR to reverse/reconcile the leave. This is an explicit reconciliation exception; the application cannot predict a shift's eventual end when clocking in.

Calendar leave events carry date-only start and exclusive end values, which the UI uses directly across timezone/DST changes. Cancellation and reversal reuse `ConfirmationDialog`. Request details and inclusive overlap date filters are available through the API, with date controls in the leave list.

The implementation adds immutable leave requests, per-day policy snapshots, audited decisions, staged Head verification and HR approval, cancellation and reversal, scoped notification delivery, and same-origin APIs under `/api/leave`. The Workforce Compliance UI adds a Leave workspace built from the existing attendance shell, modal, date input, filter, responsive table, side panel, feedback, pagination, and status primitives. New leave-specific components were limited to domain compositions whose request fields, table columns, and decision history could not be expressed by the correction/overtime composites.

Approved leave reduces attendance-required minutes without changing `Employee.status`, blocks clock-in and attendance corrections for covered workdays, projects privacy-safe all-day calendar events, and exposes separate workload-planning context without changing manual capacity. PGlite coverage exercises preview calculation, overlap/idempotency safeguards, staged authority, self/scope restrictions, attendance conflicts, cancellation/reversal, notifications, calendar projection, and workload projection.

## Outcome and scope

Employees request dated leave, Department Heads verify it, and HR/Admin makes the final decision. Superadmin can decide at either stage, subject to the same self-review and attendance-integrity restrictions. Approved leave supplies one authoritative source for attendance exceptions and authorized calendar/workload projections.

The first release supports whole-day inclusive date ranges; annual, sick, emergency, unpaid, and other categories; a private reason; decision notes; cancellation before approval; audited reversal after approval; and notifications to the requester and eligible reviewers. Categories classify requests only and do not imply paid entitlement.

Balances, accruals, payroll calculations, partial-day leave, attachments, a holiday calendar, automatic leadership handoffs, and automatic workload-capacity deductions are deferred. Requests cannot use account-only directory identities; a persisted Employee record is required.

## Existing foundations

- `apps/api/prisma/schema.prisma`: Employee identity, attendance policy assignments and immutable workday snapshots, weekly workload capacity, and the shared notification inbox.
- `apps/api/src/features/attendance/attendance.management.ts`: current Head verification and HR decision patterns, review capabilities, pagination, validation, and transaction conventions.
- `apps/api/src/features/attendance/attendance.service.ts`: employee serialization, current account checks, policy attribution, and clock-in guards.
- `apps/api/src/features/attendance/attendance.summary.ts`: worked/required/remaining/excess calculations. It currently uses the workday requirement directly and needs an explicit approved-leave input.
- `apps/api/src/features/projects/calendar.service.ts`: internal calendar composition; leave requires an additional event projection and all-day date semantics.
- `apps/api/src/features/workload/workload-availability.service.ts`: policy context and known commitments. Required hours do not define working time windows.
- `apps/api/src/features/request-workflow/workflow.notifications.ts`: notification visibility must be extended for leave, including current authorization when listing or marking notifications read.
- `apps/web/src/features/attendance/model/navigation.ts` and `apps/web/src/features/workspaces/model/route-policy.ts`: add Leave under Requests & Approvals in the existing Workforce Compliance module.

`Employee.status = ON_LEAVE` represents current HR state and participates in leadership management. A dated leave approval must not change it automatically. `WorkloadCapacity.timeOffHours` remains manually entered; adding leave to it could deduct the same absence twice. See [attendance foundation](attendance-foundation.md) and [workload integration boundaries](staff-workload.md).

## Frontend reuse requirement

Inspect existing components and their contracts before implementing each screen. Reuse a component directly when it satisfies the interaction, accessibility, and visual requirements. Add a small backward-compatible extension when justified by shared needs. Create a new feature component only for a requirement existing components cannot satisfy; record that reason in the implementation handoff.

| Need                      | Existing component or pattern                                                                               | Planned use                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Workspace and tabs        | `AttendanceShell`, attendance navigation, shared route policy                                               | Add a Leave tab at `/attendance/requests/leave`; retain module-scoped navigation.               |
| Header action             | `PageHeaderButton`                                                                                          | Request leave action for eligible employees.                                                    |
| Personal/management scope | `ManagementViewToggle`                                                                                      | My requests and department/organization requests, subject to backend capabilities.              |
| Search and filters        | `SearchField`, `FilterSelect`                                                                               | Authorized employee search, type, status, and bounded date filters.                             |
| Request list              | `ResponsiveDataTable`, `TablePaginationFooter` or existing `AttendancePagination`, `Pill`, `DepartmentPill` | Reuse table mechanics and status presentation; supply leave-specific columns/actions.           |
| Request form              | `Modal` and its header/body/footer, `Form`, form inputs/textarea, `Button`, `Alert`                         | Compose a leave form with type, two dates, reason, and server-calculated duration preview.      |
| Date selection            | `DateInput` using `type="date"`                                                                             | Start/end date inputs with accessible labels and range constraints. No new date-picker library. |
| Details and review        | `SidePanel` family, `DetailList`, `DetailItem`, `useSidePanel`                                              | Compose leave details, per-date calculation, decision history, and review actions.              |
| Cancellation/reversal     | `ConfirmationDialog` or established confirmation flow                                                       | Require explicit confirmation; reversal also requires a reason.                                 |
| Request overview          | `FiguresRow`, `Section`, existing overview primitives                                                       | Extend Requests & Approvals counts with leave and its additional lifecycle states.              |
| Loading and feedback      | `ResourceStatus`, `useAsyncResource`, existing skeletons, `errorMessage`, Sileo                             | Pending/error/retry feedback, stale-response protection, and successful mutation refresh.       |

Existing `AdjustmentDialog` and `AttendanceAdjustmentReviewPanel` contain correction/overtime-specific contracts. Reuse their primitives and interaction conventions; only generalize these composites if their contracts can express leave cleanly. A leave form, table-column composition, and leave review body may belong under `apps/web/src/features/leave/` because their domain fields differ. Keep shared primitives in their current locations.

All screens use established Tailwind v4 tokens, Inter typography, focus restoration, keyboard navigation, accessible validation, disabled pending actions, and responsive table/panel behavior. The authenticated API client continues to use same-origin `/api/...` requests and sessionStorage tokens.

## Lifecycle and authority

| Current state             | Action                                 | Actor and resulting state                                                                                             |
| ------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| New                       | Submit                                 | Eligible linked Staff/Admin employee; `SUBMITTED`.                                                                    |
| `SUBMITTED`               | Verify                                 | Current eligible Staff Department Head for this employee; `VERIFIED`.                                                 |
| `SUBMITTED`               | Reject                                 | Current eligible Head or Superadmin; `REJECTED`.                                                                      |
| `VERIFIED`                | Approve/reject                         | HR/Admin or Superadmin; `APPROVED`/`REJECTED`.                                                                        |
| `SUBMITTED`               | Approve/reject through exception route | HR/Admin only if there is no eligible non-self Head; Superadmin can decide at either stage. Record the bypass reason. |
| `SUBMITTED` or `VERIFIED` | Cancel                                 | Request owner; `CANCELLED`.                                                                                           |
| `APPROVED`                | Reverse entire request                 | Authorized HR/Admin or Superadmin other than the requester/subject; `REVERSED`, mandatory reason.                     |

Rejected, cancelled, and reversed requests are terminal. Submitted dates/type/reason are immutable: cancel and resubmit to change them. Partial cancellation/reversal is deferred; replace the request with an explicitly linked new request when needed. No hard deletion of requests or decision history.

Authority is checked against current active account, Employee ownership, role, and placement inside each transaction. Deny self-review by both requester account and subject Employee identity. Superadmin administrative access supplies no employee self-service identity. Clients receive no leave access. Ordinary Staff read only their own requests; Heads read scoped requests; HR/Admin and Superadmin read organization requests with explicit response projections.

Requests without a department, without an eligible active Head, or submitted by the current Head route to HR. Administrative employee requests use the same non-self rule. A department transfer invalidates old department verification for a request awaiting final approval: append a rerouting event, clear the current verification, and require the new Head or HR exception route. A Head replacement within the same department preserves an already recorded verification, while future actions require current authority. GET handlers must not repair/reroute records; reconcile through an explicit mutation or a transactional placement-change integration.

## Dates and calculation

Store request boundaries as date-only values. Resolve an effective attendance assignment for every covered date and use its named policy timezone. Never parse browser-local midnight into a business date. Missing or ambiguous policy coverage blocks submission/approval with the affected dates; zero required minutes remains a valid rest-day configuration.

Proposed limits: inclusive ranges up to 366 days, reason/decision text 5–2,000 trimmed characters, and no future submission horizon restriction beyond the bounded range. Reject invalid calendar dates and reversed ranges. Permit retrospective requests for legitimate past absence, subject to the same work/conflict checks. A range containing only zero-minute days is rejected as having no leave requirement. A future holiday feature must provide its own explicit source; weekends and holidays are never guessed.

Preview the affected dates, per-date policy, timezone, and required minutes at submission. Store that submitted calculation. At final approval, resolve again and compare with the submitted calculation; if materially changed, return a conflict and require cancel/resubmit. Persist final per-date snapshots atomically with approval. Later policy changes retain those approved snapshots. Schedule edits/assignments affecting future approved leave must either reject with a resolvable conflict or use an explicit audited reconciliation; include these existing writers in the implementation scope.

For each date expose `baseRequiredMinutes`, `approvedLeaveMinutes`, and `effectiveRequiredMinutes = max(0, baseRequiredMinutes - approvedLeaveMinutes)`. Whole-day approval covers the configured working requirement. Snapshots retain provenance even for zero-minute dates within a valid range. Date enumeration uses calendar arithmetic, and all-day calendar events use date-only start and exclusive end boundaries. DST days do not assume a 24-hour duration.

## Conflict and edge-case contract

| Case                         | Required behavior                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Work already recorded        | Block final approval when a covered working date has any session, including an open session. Preserve legitimate work; a whole-day leave request for a worked day must be cancelled/rejected and replaced with an appropriate request. The UI must not suggest deleting valid attendance to obtain approval.              |
| Overnight work               | Check both attributed workdays and intervals spilling into covered local calendar days. Closing a session or approving a correction must not create an overlap with approved leave. Clock-out/break-end recovery remains available for an existing session.                                                               |
| Work after approval          | Clock-in and correction creation/finalization recheck approved leave under the Employee lock. Block conflicting new work until an authorized reversal resolves it. A pending leave request alone does not block work; subsequent approval revalidates.                                                                    |
| Overtime/correction workflow | Block leave approval for affected unresolved corrections/overtime, including missing-session corrections whose proposed interval overlaps the dates. Recheck both sides at finalization; do not generate overtime merely because leave reduced the target.                                                                |
| Overlapping requests         | Reject intersecting ranges for the same Employee when either request is `SUBMITTED`, `VERIFIED`, or `APPROVED`. Cancelled/rejected/reversed ranges may be requested again. Adjacent ranges are allowed.                                                                                                                   |
| Double submit/retry          | Actor-scoped UUID request key plus canonical payload comparison. Exact replay returns the committed result; different payload reuse returns conflict. Decision/cancel/reversal retries also use action receipts and expected version.                                                                                     |
| Competing decisions          | Lock/re-read current request and version. Approve versus cancel/reject/reverse has one committed winner; stale actions return conflict and refresh the UI.                                                                                                                                                                |
| Account lifecycle            | Require an active linked Staff/Admin login and non-inactive Employee for new submissions. `ON_LEAVE` alone does not prevent requesting a later period. Recheck eligibility before approval. Retirement prevents new actions while preserving existing requests/history; approved leave remains until explicitly reversed. |
| Leadership leave             | Approval does not assign a replacement Head or change employee status. Display coverage needs and use the existing authorized leadership workflow separately. Head/HR fallback prevents self-approval and stranded queues.                                                                                                |
| Reversal after leave begins  | Record the entire reversal and its effective event time. Recalculate current derived exceptions for all request dates, including past dates, and show the reversal in history. Preserve base workdays, sessions, original approval snapshots, and prior decisions. Never describe recalculated history as unchanged.      |
| Manual weekly time off       | Show approved leave minutes separately with a possible-overlap explanation; retain current capacity and utilization formulas. Automatic deduction requires a later source/reconciliation decision.                                                                                                                        |
| Scheduled commitments        | Flag relevant known meetings/tasks for review without auto-cancelling meetings, removing assignments, or blocking leave based on incomplete schedule data. Lack of known meetings does not prove availability.                                                                                                            |
| Privacy                      | Calendar/workload show authorized unavailability dates and minimal identity only. Keep reasons, leave type that could disclose health details, and review notes out of scheduling projections, toast previews, shared audit snapshots, and notification summaries.                                                        |

## Persistence, API, and notifications

Add a dedicated API feature under `apps/api/src/features/leave/`, with routing, validation, service and repository responsibilities following neighboring conventions. Proposed records:

- `LeaveRequest`: subject Employee, requester account, category, private reason, inclusive dates, status, version, submitted calculation, department routing/verification metadata, and timestamps.
- `LeaveRequestDay`: approved date, policy/assignment reference, timezone, base minutes and covered minutes; preserve original snapshots after reversal. Approval state determines whether a snapshot contributes an active exception.
- `LeaveDecision`: append-only actor/action/time, status transition, version, routing information, and restricted note. Keep private notes out of broadly readable management history.
- Action receipts and a leave notification source reference with deduplication per recipient and event. Preserve history through account retirement; restrictive references may block permanent deletion rather than erase provenance.

Proposed `/api/leave` endpoints: `POST /preview`, `GET /requests`, `GET /requests/:id`, `GET /overview`, `POST /requests`, and `POST /requests/:id/{verify,approve,reject,cancel,reverse}`. Lists accept explicit personal/department/organization scope, bounded date filters, category/status/search, and pagination. Responses return current action capabilities; mutations authorize independently. Preview is read-only and never reserves dates.

Use the shared Prisma instance and transactions for requests, date snapshots, decisions, receipts, and notifications. Serialize per Employee to protect overlap and approval-versus-attendance checks. Review lock order against existing Department/Employee/User/attendance writers; re-read placement after locks and return conflict if it drifted. Add request locking to the allowlisted lock utility as needed. Use database constraints/triggers for chronology, values, immutable history, and serialized overlap protection where required. Use ReadCommitted or Serializable write transactions compatible with existing attendance triggers; account for serialization conflicts.

Notify the requester after verification/final decision/cancellation/reversal, the current Head on submission, and HR after verification or fallback. Stage-specific queue counts and notifications use the same authorization predicates as lists. Revalidate recipient access when reading/marking notifications and opening deep links; stale notification delivery confers no access. Include only neutral request references and stage summaries.

## Bounded implementation phases

1. **Domain foundation and API:** additive schema/migration, Prisma generation, validation, transitions, authorization, conflict serialization, audit/receipts, notification source. Validate with offline API tests. Stop with documented API contracts and no exposed request-entry UI until attendance write guards exist.
2. **Attendance integrity and projections:** guard punch/correction/overtime/policy writers; preserve base snapshots and add exception inputs to summary calculations. Cover dates with approved leave but no recorded workday through explicit leave projections, without creating synthetic sessions or inferring general absences. Validate competing mutations and historical calculations before dependent UI work.
3. **Frontend request workflow:** reuse the mapped components; add the Leave route, form, list, detail/review composition, overview counts, cancellation/reversal, and notification deep links. Validate desktop/mobile, access policy, focus, pending states, server conflicts, and refresh/retry behavior. This delivers the usable leave workflow.
4. **Calendar and workload:** add authorized all-day leave events and separate weekly approved-leave context; verify privacy and absence of duplicate deductions. Update feature references to distinguish implemented behavior from remaining policy work.

Before each phase, identify its deliverable, dependencies, affected files, checks, and stopping point. Do not expose a workflow that permits approved leave and recorded work to become inconsistent while integration is incomplete.

## Verification and acceptance

API tests live in `apps/api/tests/` using `tests/support/pglite-app.ts` and offline PGlite. Cover fresh/populated migration preservation; owner and cross-department denial; inactive/retired/Client and self-review denial; Head/HR/Superadmin stages and fallback; transfer/replacement; missing policy; rest days; leap dates; timezone/DST; retrospective dates; duplicate/idempotent actions; overlaps; worked and overnight sessions; pending attendance requests; correction/punch/policy conflicts; full reversal; private-field projections; and atomic rollback when history/notifications fail. Exercise concurrency with supported fixtures and explicitly state any real multi-connection PostgreSQL coverage still needed beyond PGlite.

Web unit tests belong in `apps/web/test/`; browser specs in `apps/web/e2e/` with isolated mocks/offline fixtures. Test permitted navigation, form preview and validation, list scopes, statuses/actions, backend denial and conflict recovery, stable submission keys on retry, no actions after access revocation, focus return and keyboard date selection, responsive tables/panels, redacted calendar/workload data, and unchanged manual capacity calculations.

Run relevant behavioral suites, `pnpm build` for runtime changes, and the mandatory `pnpm format`, `pnpm lint`, `pnpm typecheck` gate. Regression coverage includes transfer re-verification, policy/assignment conflicts, detail authorization, date filtering, overnight recovery notification, correction denial, and date-only calendar rendering. Real multi-connection PostgreSQL concurrency and browser interaction coverage remain separate verification work.

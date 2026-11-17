# Module status and business rules

Verified against the working tree on 2026-11-15, including uncommitted implementations. “Implemented” means source wiring exists, not that this audit deployed it or reran every behavioral suite. Paths are repository-relative. Reinspect affected code/tests before editing. This index does not limit future requirements.

## Accounts and module access

Account editing (2026-11-16): Superadmin Account Management uses a row-action edit panel for name, email, contact number and permitted role changes. `PATCH /api/users/:id` saves profile and role atomically with management history; self-role changes and leadership/promotion restrictions remain enforced. Employee HR fields and department/team assignment remain in People & HR. The inline Access column and bulk role save are removed.

Implemented: account administration, JWT/session/refresh handling, fixed permissions, administrative capabilities, module registration, and route policy. Start with API `src/features/auth`, `users`, `modules`, and web `src/features/auth`, `accounts`, `workspaces`.

- `SUPERADMIN` has account-management and global administrative grants. Current `ADMIN` permissions include people/departments/services and separate `clients:read` / `clients:create`, but no `accounts:*`. Feature-specific Employee/Client provisioning has separate authorization.
- `STAFF` operations depend on current assignments/headship and feature conditions. Client maps to `USER`. Role changes, inactivity, and retirement are enforced on subsequent authenticated requests.
- Administrative module access, organization read, management, and business-conversation inspection do not create assigned Staff, Head, Employee self-service, or owning Client identity. Explicit role/workflow checks still apply.
- Preserve self-role/status restrictions, Superadmin-only password resets, session revocation, retirement/restoration/permanent-deletion rules, and history-linked deletion protections.

Read `docs/rbac.md` and these records under `docs/features/`: `module-role-access.md`, `superadmin-authorization-foundation.md`, `superadmin-module-registration.md`, `client-creation-permission-separation.md`. Trace both permission maps and affected controllers/services before changing access.

## People, departments, clients, and attribution

Attendance review update (2026-11-16): overtime and corrections share Head verification → HR final decision. HR organization queues/counts/notifications exclude pending Head reviews; Superadmin can decide at either stage, preserving self-review denials, validation, and audit attribution. Correction verification does not mutate sessions. See migration `20261116120000_attendance_correction_verification` and `docs/features/attendance-interface.md`.

Implemented: HR records distinct from login accounts, account/employee lifecycle, client management, department/team structure and leadership, temporary head handoff/restoration, and scoped management attribution. Sources: API `src/features/employees`, `users`, `departments`, `clients`, and `src/shared/management-history.ts`; schema `AccountManagementChange` / `WorkforceManagementChange`.

- Employee creation supports new Staff provisioning and attaching a profile to an existing account, transactionally. Generic form updates cannot reassign account associations; preserve explicit lifecycle operations.
- `EmploymentType`: `FULL_TIME`, `PART_TIME`, `CONTRACT`, `INTERN`; `EmployeeStatus`: `ACTIVE`, `INACTIVE`, `ON_LEAVE`. HR status and login active/retired state are distinct.
- Teams belong to departments. Preserve assignment integrity, explicit team/“No team” selection, eligible head replacements, and guarded restoration. Department GET handlers must not repair or mutate business records.
- `employees.schema.ts` requires trimmed Employee IDs of 2–40 characters matching `^EXP-[A-Za-z0-9_-]+$`. Employee names use the existing Unicode predicate and 2–100 length. Employee mobile numbers use `^0[89]\d{9}$`; generic account/client/profile contacts allow optional `+`, digits, spaces, and hyphens under the shared predicate.
- API `src/shared/validation.ts` and web `src/lib/validation.ts` are reusable validators, but email predicates differ. Do not assert identical cross-tier acceptance or silently change policy during unrelated work. Password policy remains 12 characters minimum, 1024 bytes maximum, with upper/lower/numeric/special characters.
- Attribution covers scoped Account Management, Client Management, Employee creation/profile attachment/account lifecycle/PUT, Department creation/update/deletion/member routes, and all three Team mutation routes with actual metadata/Lead/membership/synchronization effects. Team updates re-read their before-state under transaction protection; deletion rejects membership scope drift before writes. Member/Lead identity overlap coalesces into final-state history under one actor/operation/transaction. Existing eligibility/precheck placement and per-path lock orders remain without a cross-session concurrency guarantee. Actor/origin come from authenticated backend context. History allows specified IDs/state/field names and excludes secrets/personal field values. Metadata-only Team updates retain old-Lead synchronization, so actual legacy Employee birth or repair is still attributed. Original 26-endpoint coverage is reconciled in the Team report; do not infer universal mutation coverage, backfill, export, or a history viewer.

Read these `docs/features/` records: `employee-management.md`, `client-management.md`, `department-data-access-security.md`, `department-get-integrity.md`, `administrative-attribution-persistence-foundation.md`, `account-management-actor-attribution.md`, `client-management-actor-attribution.md`, `employee-account-lifecycle-attribution.md`, `employee-creation-profile-attribution.md`, `employee-update-head-attribution.md`, `department-creation-update-attribution.md`, `department-deletion-attribution.md`, `department-member-attribution.md`, `team-management-attribution.md`. The earlier `administrative-mutation-attribution-audit.md` predates later integrations; its “not implemented” wording is historical, not current coverage.

## Services, workflow, projects, workload, and messaging

Implemented: catalog/pricing/packages, public active-service discovery at `/api/services/available`, client requests/booked services, Head inbox, conversation-centered requirements/consultation/quotation/agreement/payment workflow, project workspaces/milestones/deliverables/review/change requests, workload, and administrative oversight.

Start with `apps/api/src/app.ts` and mounted controllers in `services`, `client-services`, `service-requests`, `request-inbox`, `request-workflow`, `projects`, `project-workspace`, `workload`, and conversation features. Trace corresponding web features/route entry points and API/PGlite/browser tests.

- Catalog administration retains `services:read` / `services:manage`. Preserve server-side ownership, headship, assignment, state transitions, shared/client visibility, upload/download protections, and idempotency/receipt rules.
- Request lifecycle labels are Pending (`SUBMITTED`), Under Review, Activated, Cancelled, and Concluded. Acceptance sets Under Review, authorized staffed workspace activation sets Activated, and workspace completion sets Concluded in the same transaction. Consultation/quotation stages remain separate workflow state. See `docs/features/department-request-inbox.md` for normalization migrations and compatibility details.
- Service conversations require the owning Client or eligible current Head; project participation requires the owning Client or eligible assigned Staff plus project-state checks. Internal DMs require explicit participant membership. Administrative oversight exposes restricted business metadata, not chat bodies, private DMs, file authority, read markers, or participation.
- `apps/web/src/app/(portal)/billing-logs/page.tsx` calls `/api/request-workflows/billing`. Workflow payments, proof/verification, sandbox flags, and demo-specific presentation exist. This is partial billing functionality, not a complete finance/payroll system or proof of a production payment gateway.

Read records under `docs/features/`: `client-service-requests.md`, `department-request-inbox.md`, `conversation-workflow.md`, `request-messaging.md`, `staff-workload.md`, `messaging-privacy-validation.md`, and applicable `superadmin-project-*`, `superadmin-service-request-visibility.md`, `superadmin-workflow-oversight.md`, `superadmin-workload-oversight.md`, `superadmin-messaging-oversight.md`. Old phase limits describe those tasks, not future product boundaries.

## Attendance and calendar

Implemented: attendance policies/assignments, workdays/sessions/breaks, adjustments/review/audit, whole-day leave requests, attendance web screens, and role-aware calendar composition. Sources: API `src/features/attendance` and `src/features/leave`, web `src/features/attendance`, `leave`, and `calendar`. Trace calendar API composition before assuming a dedicated backend calendar router.

Leave requests (2026-11-17) use immutable request/day records and audited decisions. Linked employees submit annual, sick, emergency, unpaid, or other leave; current eligible Heads verify department requests, HR/Admin decides verified or Headless exception-routed requests, and Superadmin retains organization oversight without gaining Employee self-service identity. Self-review is denied. Approved policy snapshots reduce required attendance minutes, block covered clock-ins/corrections, generate private all-day calendar projections, and appear separately in workload planning without mutating manual capacity or `Employee.status`. See migration `20261117120000_leave_requests` and `docs/features/leave-requests-plan.md`.

Preserve administrative versus Employee self-service/Head review boundaries, eligibility, time/policy rules, audit history, and clock-injection fixtures. Attendance does not imply salary/payroll processing.

Leave review fixes (2026-11-17): transferred verified requests require receiving-Head re-verification before final approval. Future approved leave guards policy edits and assignment replacement/removal. Corrections reject intervals crossing leave dates; clock-out recovery preserves recorded work with an audit reason, employee warning, and HR conflict notification. Calendar leave uses explicit date-only boundaries rather than a fixed timezone offset.

Read `docs/features/attendance-foundation.md`, `attendance-backend.md`, `attendance-interface.md`, `leave-requests-plan.md`, `superadmin-attendance-administration.md`, and `calendar.md` in that folder. `attendance-availability-plan.md` is planning context; verify proposed integrations against current attendance/workload code.

## Planned, partial, and experimental

- The shared registry marks Service Operations, Project Management, People & HR, Attendance & Monitoring, and Administration implemented; Billing & Finance is `implemented: false`. Workflow billing exists independently.
- Payroll/salary processing and a comprehensive analytics/reporting suite were not verified as implemented. Describe existing KPI/overview/calendar/attendance displays at their actual scope.
- Mobile has KMP/Compose targets and starter/demo UI/tests; inspected source does not implement mobile login, attendance, task updates, or payroll viewing.
- Sandbox payments and demo billing presentation retain their test/demo qualification; do not present them as production settlement/accounting.

Support authorized future modules and changed requirements. Extend registration, route/access policy, domain code, tests, and references as needed; this document need not list a feature before implementation starts.

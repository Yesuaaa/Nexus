# Attendance & Availability: Codebase Audit and Implementation Plan

Audited: 2026-11-13

Status: Proposed implementation; awaiting approval.

Attendance can fit at **People & HR → Employees → Attendance**, using `/employees/attendance` and the existing Employees sidebar group. The codebase has employee records, weekly capacity planning, and a shared calendar, but no attendance records, daily work requirements, shifts, or breaks.

This audit covers repository source, migrations, and test definitions. The deployed database was not queried. The initial audit did not modify files or execute tests. Creating this document does not approve application changes or migrations.

## 1. Relevant Existing Files and Architecture

| Area                        | Verified implementation                                                                                                                                                                                                                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace architecture      | [`workspace-modules.ts`](../../apps/web/src/features/dashboard/model/workspace-modules.ts) builds the workforce module catalog. People & HR currently opens `/employees`; its existing access rules make it available to Admin.                                                                                                               |
| Routing and access          | [`route-policy.ts`](../../apps/web/src/features/workspaces/model/route-policy.ts) owns route access, module ownership, and navigation metadata. `/employees` is a prefix policy belonging to `people-hr`. [`portal-layout.tsx`](../../apps/web/src/components/layout/portal-layout.tsx) checks that policy before mounting protected content. |
| Sidebar                     | [`sidebar.tsx`](../../apps/web/src/components/layout/sidebar.tsx) already renders Employees as an expandable group containing **Overview** and **Management**, with a flyout when collapsed.                                                                                                                                                  |
| RBAC                        | [`auth.permissions.ts`](../../apps/api/src/features/auth/auth.permissions.ts) grants `employees:read` and `employees:manage` exclusively to Admin. Superadmin does not inherit these permissions. [`permissions.ts`](../../apps/web/src/features/auth/model/permissions.ts) enforces the same employee-page restriction in the frontend.      |
| Employee management         | [`employees.controller.ts`](../../apps/api/src/features/employees/employees.controller.ts) implements listing, details, creation, updates, profile completion, and login lifecycle actions. Employee and Staff-account provisioning happens inside a transaction.                                                                             |
| Employee directory identity | [`employees.repository.ts`](../../apps/api/src/features/employees/employees.repository.ts) lists Admin and Staff accounts, optionally joined to HR records. Rows without an Employee use synthetic IDs such as `account:<userId>` and expose `hasEmployeeRecord: false`.                                                                      |
| Department relationships    | [`schema.prisma`](../../apps/api/prisma/schema.prisma) separates account membership from employee placement. An employee has optional department/team links; each team belongs to one department. Department heads and team leads reference `User`.                                                                                           |
| Employee assignment rules   | [`employees.service.ts`](../../apps/api/src/features/employees/employees.service.ts) validates department/team consistency, synchronizes account assignments, protects leadership transfers, and handles temporary department-head handoffs.                                                                                                  |
| Weekly workload             | [`workload.controller.ts`](../../apps/api/src/features/workload/workload.controller.ts) provides weekly capacity and project-allocation operations. Access is restricted to the current active Staff department head, scoped to that department.                                                                                              |
| Shared calendar             | [`calendar.service.ts`](../../apps/api/src/features/projects/calendar.service.ts) aggregates consultations, conversation meetings, dated project tasks, and shared deliverables. There is no general calendar-event table.                                                                                                                    |

### Application structure

- The web app uses Next.js App Router. Employee route files are thin wrappers around feature pages: [`employees/page.tsx`](<../../apps/web/src/app/(portal)/employees/page.tsx>) and [`employees/overview/page.tsx`](<../../apps/web/src/app/(portal)/employees/overview/page.tsx>).
- Interactive frontend features are grouped under `apps/web/src/features/<feature>/`, with components, API calls, models, hooks, providers, and pages separated by responsibility.
- The backend is Express with feature routers mounted in [`app.ts`](../../apps/api/src/app.ts). Employee routing and orchestration currently live in `employees.controller.ts`; its `routes.ts` re-exports that controller.
- PostgreSQL access uses Prisma, with the generated client under `apps/api/src/generated/prisma` and the shared accessor in [`db.ts`](../../apps/api/src/lib/db.ts).
- The module selector and module-scoped navigation are already implemented, even though parts of [`modularization.md`](../modularization.md) describe them as roadmap phases. Working source takes precedence when planning this feature.

### Existing data and access distinctions

- `Employee` is the HR identity. Its optional, unique `userId` links authentication. Employee history can outlive its login account.
- `EmployeeStatus` contains `ACTIVE`, `INACTIVE`, and `ON_LEAVE`. These are employment states, not daily attendance.
- `WorkloadCapacity` stores `scheduledHours` and `timeOffHours` per employee and Monday-starting week. Its migration constrains hours and prevents time off from exceeding scheduled hours.
- `ProjectStaff` stores weekly allocation hours and allocation dates. It does not identify daily working intervals.
- Authentication `Session` records track login activity. They are unsuitable as attendance evidence.
- All portal roles can access the shared calendar, but their event projections differ. Clients receive their own events. Staff receive assigned work and permitted team/head views. Admin and Superadmin receive organization schedule metadata without automatically gaining workflow access.
- Calendar task dates come from project work-plan data. Shared deliverables appear at `sentToClientAt`; these are sharing events, not separate deliverable deadlines.

## 2. Reusable Components and Functionality

| Existing asset                                                                                                                                                                                                | Reuse for Attendance                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`employee-management-page.tsx`](../../apps/web/src/features/employees/pages/employee-management-page.tsx) and [`employee-table.tsx`](../../apps/web/src/features/employees/components/employee-table.tsx)    | Follow the established header, filtering, table, drawer, retry, and toast composition. Attendance needs its own columns and actions.                                              |
| Shared layout and UI primitives                                                                                                                                                                               | Reuse `PageHeader`, `SearchField`, `FilterSelect`, `ResponsiveDataTable`, `TablePaginationFooter`, `Pill`, `DepartmentPill`, side panels, dialogs, skeletons, and KPI primitives. |
| [`date-input.tsx`](../../apps/web/src/components/ui/date-input.tsx), [`time-input.tsx`](../../apps/web/src/components/ui/time-input.tsx), and [`calendar.tsx`](../../apps/web/src/components/ui/calendar.tsx) | Supply date/time controls. These do not implement overnight calculations or schedule-policy enforcement.                                                                          |
| [`use-paginated-list.ts`](../../apps/web/src/components/ui/use-paginated-list.ts) and [`use-async-resource.ts`](../../apps/web/src/lib/use-async-resource.ts)                                                 | Reuse cancellation, stale-response protection, loading, pagination, retry, and refresh patterns.                                                                                  |
| [`use-departments.ts`](../../apps/web/src/features/departments/hooks/use-departments.ts)                                                                                                                      | Supply department filters under authorized HR access.                                                                                                                             |
| [`auth-api.ts`](../../apps/web/src/features/auth/api/auth-api.ts)                                                                                                                                             | Reuse Bearer authentication, session-storage token handling, token refresh, cancellation support, and API errors. Requests remain same-origin through `/api/...`.                 |
| Backend authentication and query infrastructure                                                                                                                                                               | Reuse `requireAuth`, `requirePermission`, `HttpError`, validation, snapshot-consistent pagination, and Prisma transactions.                                                       |
| [`locks.ts`](../../apps/api/src/shared/db/locks.ts)                                                                                                                                                           | Lock Employee rows to serialize competing attendance changes, observing existing lock ordering when other records are involved.                                                   |
| [`pglite-app.ts`](../../apps/api/tests/support/pglite-app.ts)                                                                                                                                                 | Apply migrations to an offline PostgreSQL-compatible database and start the API without using the live database.                                                                  |

Existing employee, department-integrity, calendar, route-policy, and module-navigation tests provide regression patterns. Relevant examples include:

- [`employee-integration.test.ts`](../../apps/api/tests/employee-integration.test.ts)
- [`department-integrity.test.ts`](../../apps/api/tests/department-integrity.test.ts)
- [`calendar.test.ts`](../../apps/api/tests/calendar.test.ts)
- [`api-system-regression.test.ts`](../../apps/api/tests/api-system-regression.test.ts), including workload access and capacity checks
- [`route-policy.test.mjs`](../../apps/web/test/route-policy.test.mjs)
- [`module-scoped-navigation.spec.ts`](../../apps/web/e2e/module-scoped-navigation.spec.ts)

Two existing availability views have narrower meanings:

- Employee Overview's **Availability** panel counts employment statuses. See [`employee-overview-page.tsx`](../../apps/web/src/features/employees/pages/employee-overview-page.tsx).
- Workload availability derives from weekly capacity, assignments, and employment status. See [`workload.ts`](../../apps/web/src/features/workload/model/workload.ts).

Neither describes when an employee is available during a day.

## 3. Proposed Database and API Changes

Everything in this section is a proposal, not existing functionality.

### Proposed data models

| Proposed model                           | Purpose                                                                                                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `EmployeeWorkSchedule` and weekday rules | Effective-dated employee schedule with a timezone and configurable required minutes per weekday. Optional planned start/end times support scheduled work; flexible-hours employees need no fixed start time. |
| `EmployeeWorkdayOverride`                | Date-specific required minutes and optional planned-window overrides, including an explicit zero-hour day and a recorded reason.                                                                             |
| `AttendanceDay`                          | One record per employee/work date, preserving the applicable timezone, required-minutes snapshot, and schedule version.                                                                                      |
| `AttendanceSession`                      | Actual start/end instants; multiple sessions may belong to one workday. A session can cross midnight. This is separate from the authentication `Session` model.                                              |
| `AttendanceBreak`                        | Multiple timed breaks within a session, with an explicit paid/unpaid classification.                                                                                                                         |
| `AttendanceChange`                       | Recorded actions and corrections, including actor, reason, before/after values, version, and retry identifier.                                                                                               |

### Duration and work-date rules

- Store required duration as integer minutes. For example, 450 minutes represents 7.5 required hours.
- Store actual timestamps as UTC instants and the business work date separately. Date-only requirements and effective dates need date-only semantics.
- Assign an overnight session to its scheduled start date. Flexible sessions need an explicit, validated work-date rule.
- Capture full dates for start and end timestamps. An overnight interval must not depend on subtracting two time-of-day strings.
- Calculate worked duration from session intervals minus unpaid breaks. Aggregate before rounding.
- Apply a day's requirement once across all sessions belonging to that workday.
- Preserve historical requirements when schedules change.
- Distinguish unconfigured requirements from zero required hours.
- Treat open sessions as provisional. Define how clock-out handles an open break before implementation.
- Lateness requires a configured start time. Payroll overtime requires a separately defined policy.

Example: a Friday 22:00–Saturday 06:00 session with a 30-minute unpaid break produces **7.5 worked hours against Friday's requirement**.

Add uniqueness, chronological checks, employee/date indexes, and transaction-level overlap validation. Breaks must fall within their parent session, and overlapping or duplicate open intervals must be rejected. Serialize mutations against the employee so concurrent requests cannot bypass these rules.

Keep attendance linked to the HR record. Define actor-reference deletion behavior explicitly so login retirement preserves attendance and correction history. If historical department reports are required, capture placement at the time worked instead of deriving all historical reports from current placement.

### Proposed API surface

| Endpoint                                                        | Responsibility                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `GET /api/attendance?from=&to=&departmentId=&employeeId=&page=` | Bounded, paginated attendance overview and calculated totals.            |
| `GET /api/attendance/employees/:employeeId?from=&to=`           | Employee history, requirements, sessions, breaks, and exceptions.        |
| `POST /api/attendance/entries`                                  | Create an authorized manual attendance entry.                            |
| `PATCH /api/attendance/entries/:id`                             | Correct an entry using a reason, expected version, and retry identifier. |
| `GET /api/attendance/employees/:employeeId/schedule`            | Read effective-dated requirements.                                       |
| `PUT /api/attendance/employees/:employeeId/schedule`            | Maintain effective-dated requirements.                                   |
| `PUT /api/attendance/employees/:employeeId/overrides/:workDate` | Maintain a specific day's override.                                      |

Introduce `attendance:read` and `attendance:manage`, initially assigned to Admin to match current HR access. Backend authorization remains authoritative.

Self-clocking is a separate scope decision. If included, add narrowly scoped `/api/attendance/me/...` endpoints for clock-in, clock-out, and break actions. Resolve the employee through the authenticated `userId`; ordinary Staff must not receive employee-management access. Account-only users need HR-profile completion before attendance can be recorded.

For future availability, establish a date-bounded read contract based on explicitly supplied working windows and exceptions. Required hours alone cannot locate availability within a day. Weekly workload can consume a later adapter once its capacity-source rules are approved.

## 4. Potential Conflicts and Missing Dependencies

### Navigation and authorization

- Route policies use first-match lookup. A dedicated attendance rule must precede the broad `/employees` prefix if it has distinct permissions.
- The sidebar's group factory is shared with Departments and Services. Attendance must be added specifically to Employees.
- Staff currently cannot enter People & HR. Self-clocking would require a narrowly scoped route, module entitlement, and permitted Employees-group link while preserving Admin-only Management.
- Superadmin is not an implicit HR administrator under the current permission map.
- Department-head workload privileges do not automatically grant attendance management. Any department-scoped attendance access needs an approved rule and current-assignment checks.

### Identity, history, and placement

- Account-only directory rows need HR-profile completion before recording attendance. Synthetic `account:<userId>` values are not Employee primary keys.
- Attendance history must remain queryable when a login is permanently deleted and the preserved Employee becomes unlinked. The account-based employee list is not an authoritative historical attendance roster.
- Transfers update current placement. Historical attendance needs department/team snapshots if reports must reflect placement at the time worked.
- Employment status and login status are separate concerns. Attendance actions must not implicitly modify either or trigger department-head handoff workflows.

### Workload and calendar integration

- Weekly hours cannot be safely distributed across days without a schedule. Existing project allocations count their full weekly amount in overlapping weeks.
- Attendance actuals, required hours, and planning capacity need separate meanings to avoid double deductions of breaks, leave, or time off.
- Weekly allocations and task due dates do not provide timed busy intervals. Future availability must preserve unknown states when the necessary windows are absent.
- Admin and Superadmin currently receive organization calendar metadata. Adding HR events requires attendance-specific authorization; existing calendar access must not automatically expose attendance history.
- [`calendar-page.tsx`](../../apps/web/src/features/calendar/pages/calendar-page.tsx) groups events by their start date only. Availability spanning midnight needs interval-aware display.
- Working-window overlays need different semantics from overlapping appointment detection in [`calendar.ts`](../../apps/web/src/features/calendar/model/calendar.ts).
- The calendar currently loads its visible aggregate without a date-range query. Attendance history needs bounded queries before it is integrated into a shared calendar view.

### Time handling and supporting workflows

- The calendar uses `Asia/Manila`, while account preferences allow other display zones. Attendance needs an explicit business timezone independent of browser preferences.
- Existing inputs and `Intl` formatters do not constitute a shared schedule-calculation engine. A general date/time arithmetic library is not declared in either app's package dependencies.
- Existing `WorkflowEvent`, `WorkflowNotification`, and action receipts require a service request. Their patterns are reusable; their tables are not general HR infrastructure.
- Daily leave/holiday calendars, attendance corrections, paid-break defaults, missed punches, maximum session duration, absence cutoffs, and overtime approval are not implemented attendance capabilities. These require explicit rules before implementation.
- No default eight-hour requirement, payroll calculation, or availability claim should be inferred from employment type or account activity.

## 5. Step-by-Step Implementation Plan

1. **Approve the initial scope and access matrix.** Settle manual entry versus self-clocking, who is tracked, business timezone, break treatment, overnight work-date attribution, and correction authority. Specify whether department heads receive any attendance access.
2. **Define the contracts and calculation rules.** Separate required duration, planned windows, actual attendance, and projected availability. Include missing configuration and incomplete sessions in response types. Define schedule changes, overrides, interval limits, and rounding.
3. **Add the Prisma models and migration.** Preserve existing records, avoid an assumed eight-hour default, define deletion behavior, and run `pnpm db:generate`. Verify the migration using PGlite before applying it to a deployed database.
4. **Implement the attendance domain service.** Resolve effective schedules and overrides; calculate overnight sessions and breaks; enforce chronological rules, overlap protection, idempotency, and correction history. Use transactions and the existing locking infrastructure.
5. **Implement the protected API feature.** Use `apps/api/src/features/attendance/` with controller, validation, service, and repository responsibilities. Mount it in `app.ts` and add the approved permissions to backend and frontend definitions. Derive self-service identity from authentication if that scope is approved.
6. **Build the Attendance page.** Use `apps/web/src/features/attendance/` and a thin App Router entry at `/employees/attendance`. Append Attendance to Employees' existing disclosure and flyout. Retain Overview, Management, workspace switching, and shared utilities. Reuse existing EXP tokens, Inter typography, and UI primitives.
7. **Prepare availability integration.** Expose schedule/exception reads with explicit unknown states. Define the workload adapter's source precedence and calendar authorization before enabling either integration. Introduce explicit working windows when daily availability is implemented.
8. **Verify behavior and regressions.** Cover all roles, account-only employees, archived/unlinked records, department transfers, simultaneous writes, variable daily requirements, zero-hour days, missing schedules, midnight/week/month boundaries, multiple sessions, and paid/unpaid breaks. Extend route-policy and desktop/mobile navigation tests, including collapsed sidebar behavior and shared-calendar privacy.
9. **Run the required implementation quality gates.** Run relevant offline API tests, web unit tests, and browser tests, followed by `pnpm format`, `pnpm lint`, and `pnpm typecheck`. Resolve failures before implementation handoff.

## Approval Boundary

This document records the audit and proposed plan. Application code, schema changes, migrations, and feature implementation remain pending approval.

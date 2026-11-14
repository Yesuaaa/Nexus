# Attendance & Availability Data Foundation

Implemented: 2026-11-13

Scope: Prisma models, an additive migration, database integrity rules, pure validation helpers, and offline tests. Attendance APIs, UI, permissions, payroll, leave approval, and availability scheduling are outside this change. The original [audit and plan](attendance-availability-plan.md) remains the planning reference for later phases.

## Data ownership

Attendance uses the existing `Employee` identity. Login accounts remain separate; audit actors optionally reference `User`. No employees are provisioned, assigned a default policy, or backfilled by the migration. Existing departments, teams, workload capacities, project allocations, authentication sessions, and calendar sources remain the owners of their current data.

| Model                        | Responsibility                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `AttendancePolicy`           | A named policy version and its business timezone.                                                                                   |
| `AttendancePolicyDay`        | Explicit working-day flags and required minutes for each weekday, with Sunday numbered 0.                                           |
| `AttendancePolicyAssignment` | An employee's effective policy, using an inclusive start and exclusive optional end date.                                           |
| `AttendanceWorkday`          | A unique employee/local-date record with an immutable snapshot of the assignment, timezone, working-day flag, and required minutes. |
| `AttendanceWorkSession`      | Complete clock-in/out instants associated with an employee's workday. Multiple sessions may share that workday.                     |
| `AttendanceBreak`            | Complete break start/end instants and an explicit paid/unpaid flag.                                                                 |
| `AttendanceAudit`            | Append-only entity identity, before/after snapshots, actor, reason, and recorded timestamp.                                         |

All seven weekdays must be configured before assigning a policy. Rest days require zero minutes; a working day may also explicitly have a zero-minute target. Required minutes are integers from 0 through 1,440, allowing fractional hours such as 450 minutes for 7.5 hours. No clock-in window or fixed starting time is assumed.

The policy-management extension allows editing policy names, weekday rules, and break/overnight options while retaining the same policy ID. Assigned timezones remain immutable. Workday snapshots preserve historical names, timezones, targets, and break/overnight rules; new workdays use the edited settings. Policies can be archived and restored; permanent deletion requires an archived policy without assignments. Assignment periods for an employee cannot overlap, and shortening an assignment cannot exclude existing workdays.

## Time and session attribution

Actual instants use PostgreSQL `TIMESTAMPTZ(3)`; policy and workday records preserve the business timezone separately. Date-only effective periods and attendance dates use `DATE`. PostgreSQL validates policy timezone names, and TypeScript validation rejects incomplete or timezone-free timestamp strings.

Creating a session requires an `employeeId` and `startedAt`. When `workdayId` is omitted, a database trigger selects the effective policy using the starting instant in that policy's timezone, finds or creates the corresponding workday, and stores its ID on the session. A missing policy is an error, rather than an assumed schedule. If changing timezones makes policy attribution ambiguous at a boundary, the caller must supply an explicit workday.

For example, Friday 22:00 through Saturday 06:00 in `Asia/Manila` belongs to Friday by default. The original start and end instants remain intact. Ending a session after midnight does not split it or create another workday.

An explicit `workdayId` can attach additional sessions to an existing attendance day, including a continuation after midnight. The employee must match the workday. A session's employee and workday association cannot be changed in place.

## Integrity and totals

- Session intervals must have a positive duration when closed. An open session has a null end, representing an unbounded interval until closed.
- Sessions for the same employee cannot overlap, even when associated with different workdays. Adjacent intervals are permitted.
- Breaks must stay within their session and cannot overlap each other. A session cannot close while a break remains open, or be shortened to exclude a break.
- Pure validation helpers sum closed session durations and deduct only unpaid breaks. They reject overlapping intervals and out-of-session breaks; rounding belongs at the eventual presentation boundary.
- The daily requirement is stored once on the workday, rather than repeated for each session. No cached worked-hours total is maintained.
- Foreign keys preserve HR and workday history instead of cascading it away when a referenced identity is deleted.

Mutations use employee or parent-session row locks to serialize interval checks. Attendance writers must use PostgreSQL **ReadCommitted** or **Serializable** transactions; mutation guards reject **RepeatableRead**, whose stable snapshots could otherwise permit range-check write skew. Serializable failures and deadlock retries remain responsibilities of future mutation orchestration. Read-only queries can still use RepeatableRead.

## Audit context

Database triggers automatically record inserts, updates, and applicable deletions for policies, weekday rules, assignments, workdays, sessions, and breaks. Workday snapshots and audit records cannot be updated; audit records cannot be deleted.

Future authenticated writers can supply actor and reason within the same transaction using parameterized calls to:

```sql
SELECT set_config('app.attendance_actor_id', '<authenticated User.id>', true);
SELECT set_config('app.attendance_reason', '<reason for the change>', true);
```

Without this context, the audit uses a null actor and `Database change` as the reason. The setting is transaction-local. The actor must exist if supplied. The database-generated audit action identifier is unique; this is a history identifier, not an implemented HTTP idempotency contract.

## Future integrations

Employee schedules and approved leave can later introduce dated exceptions linked to the existing employee/workday/assignment identities. Exceptions should retain the original policy snapshot and carry their own provenance. Service Operations can consume explicitly authorized reads from these identities without treating attendance as a service-request workflow event.

Required minutes alone do not describe available time windows. Existing weekly `WorkloadCapacity` and `ProjectStaff` planning values are not changed or derived from attendance in this foundation. Availability-window calculation, leave deduction, calendar projections, and source precedence remain later work.

## Verification

The offline test at `apps/api/tests/features/attendance/foundation.test.ts` uses `tests/support/pglite-app.ts`. It applies existing migrations, seeds existing HR/capacity records, applies the new migration, and checks that those records are unchanged. It also exercises timezone attribution, overnight and split sessions, rest days, policy versioning, invalid records, open breaks, audit context, and elapsed time across a daylight-saving transition.

The migration is stored in `apps/api/prisma/migrations/20261113150000_attendance_foundation/migration.sql`. Deployment has not been performed; this change does not run migrations against a live database.

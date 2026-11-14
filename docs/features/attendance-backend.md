# Attendance Backend

Implemented: 2026-11-13

Update: the [Attendance workspace phase](attendance-interface.md) adds department-scoped management reads, correction approvals, and policy-management endpoints. The original self-service contract below remains the baseline.

This phase adds self-service attendance actions, live daily progress, and employee history on the approved [data foundation](attendance-foundation.md). It adds no frontend components, policy-management endpoints, or payroll approval workflow.

## Authorization and ownership

All routes require the existing Bearer authentication middleware. Self-service attendance is available to active `STAFF` and `ADMIN` accounts linked to an Employee record. Employee identity is always resolved from the authenticated account; request bodies cannot select an employee or supply timestamps.

Only employees with `ACTIVE` HR status can start a new work session. An employee whose HR status changes during a session can still end its break or clock out while the login remains authorized. Disabled, retired, or role-ineligible login accounts lose access through the existing current-account checks.

Admin can read another employee's attendance history using the existing `employees:read` permission. Current Staff Department Heads can read history for employees in their department. Ordinary Staff, clients, and Superadmin do not receive that directory access. Management access does not authorize clocking actions on behalf of another employee.

## Endpoints

| Method | Route                                           | Body / query                                                                         |
| ------ | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| `GET`  | `/api/attendance/me/current`                    | Current open workday, or today's recorded day / unrecorded policy preview.           |
| `POST` | `/api/attendance/me/clock-in`                   | `{}` or `{ "workdayId": "..." }` for an eligible continuation.                       |
| `POST` | `/api/attendance/me/clock-out`                  | `{ "sessionId": "..." }`                                                             |
| `POST` | `/api/attendance/me/breaks/start`               | `{ "sessionId": "..." }`; creates an unpaid break.                                   |
| `POST` | `/api/attendance/me/breaks/end`                 | `{ "sessionId": "...", "breakId": "..." }`                                           |
| `GET`  | `/api/attendance/me/history`                    | Optional `from`, `to`, and `page`.                                                   |
| `GET`  | `/api/attendance/employees/:employeeId/history` | Same history query; Admin employee-read permission or current department-head scope. |

Clock-in returns `201`; other successful actions and reads return `200`. Invalid input returns `400`, unauthenticated requests `401`, insufficient access `403`, inaccessible session/workday IDs `404`, and invalid transitions or missing HR/policy setup `409`.

History dates are inclusive attendance work dates in `YYYY-MM-DD` format, not filters on clock-out timestamps. The maximum inclusive range is 366 days. Defaults cover UTC today minus 30 days through UTC tomorrow, accommodating the local-date boundary. History uses the existing 10-row pagination convention, ordered by work date descending with an ID tie-breaker. Only recorded workdays are returned; missing records are not inferred absences.

## Clock and workday rules

Production action timestamps come from the server, captured once after acquiring the employee lock. The app factory accepts an injectable clock for offline tests; HTTP requests cannot access that option. All mutations use ReadCommitted transactions, lock Employee before User, recheck account/employee ownership after locking, and attach transaction-local actor/reason audit context.

- An open session survives midnight. No timer or read operation ends it or splits it into calendar dates.
- A 20:00 Nov 13 clock-in and 04:00 Nov 14 clock-out in `Asia/Manila` contributes eight hours to Nov 13 when there are no unpaid breaks. It creates no Nov 14 attendance entry.
- With no explicit workday ID, the database uses the effective policy timezone and starting local date. Additional sessions on that date reuse its existing workday and daily requirement.
- For a split shift continuing after midnight, clock-in may explicitly name the latest overnight workday if its last session ended on the current local date. A same-local-date workday is also allowed. Foreign workdays and arbitrary historical workdays are rejected.
- A clock-in without a workday ID after an overnight session has ended starts the current local workday. The caller must explicitly select the previous workday to continue it; the backend cannot infer whether the employee intends a continuation or a new workday.
- Session IDs and break IDs act as transition preconditions. Retrying an already-finished session or break returns a conflict and cannot close a newer session.
- Clock-out during an unpaid break ends both the break and session at the same server timestamp in one transaction. The entire unpaid break remains excluded from worked time. Zero-duration session/break endings and transitions that move backward in time are rejected.

## Daily response and calculation

Action and current-state responses contain `asOf`, `employeeId`, `needsPolicy`, and `workday`. A workday includes its business date and timezone, requirement snapshot, actual sessions/breaks, and calculated progress:

- `workedMilliseconds`, `workedMinutes`, and `workedHours`: elapsed session time minus unpaid breaks, counted once on the attributed workday.
- `requiredMinutes` and `requiredHours`: the immutable daily policy snapshot, applied once across all sessions.
- `remainingMinutes`: the nonnegative remaining target.
- `progressPercent`: capped at 100, or null for a zero-minute target.
- `status`: `NOT_STARTED`, `IN_PROGRESS`, `COMPLETE`, or `NOT_REQUIRED`.
- `isComplete`: whether the daily target has been met, including a zero-minute target.
- `excessMinutes` and `excessRequiresReview`: actual time beyond the target, including work on a zero-target day. These fields do not approve overtime or calculate payroll rates.
- `activeSessionId` and `activeBreakId`: current action targets, or null.

Live durations are calculated as of the response timestamp. An open unpaid break stops increasing worked time until it ends. Completed and active intervals retain their actual timestamps for later payroll and night-work calculations. There is no rounding before summation and no midnight reset or double credit to the following date.

An unrecorded current-day preview has a null workday ID and performs no writes. Without an effective policy, current state returns `needsPolicy: true` and a null workday; clock-in returns a setup conflict. Recorded history remains available even without a currently effective policy. Admin history also supports preserved HR records whose login has been removed.

## Verification and later work

Offline HTTP tests in `apps/api/tests/features/attendance/backend.test.ts` use `tests/support/pglite-app.ts` with a controlled server clock. They cover overnight attribution, live progress, breaks crossing midnight, split sessions, policy-specific requirements/rest days, excess flags, concurrent HTTP actions, ownership, role/status changes, validation, and pagination. The existing foundation tests continue to exercise database constraints and migration preservation.

Policy assignment APIs, corrections, leave/schedule exceptions, paid-break actions, missing-punch recovery, request idempotency/replay responses, and overtime approval remain separate phases. An abandoned open session requires a later authorized correction workflow; it is never silently closed at midnight.

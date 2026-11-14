# Staff Workload

HR planning integration developed: 2026-11-13.

Department Heads open **Staff Workload** from the portal sidebar. Access is limited to the current active STAFF department head; admin roles do not bypass department scope.

Employee Management is the design reference: shared EXP shell, Inter typography, management heading, search field, filter triggers, navy actions and restrained borders/shadows. Keep staffing decisions prominent and use color only for capacity status.

## First working version

- Select a date to review its Monday-starting week. Set scheduled hours and time off (including holidays) separately for each employee and week. No working schedule is assumed.
- Available capacity is scheduled hours minus time off. Utilization is assigned weekly hours divided by capacity. Over-capacity allocations remain permitted and visibly flagged for the department head to resolve.
- Existing assignments without recorded hours are labeled as needing setup, rather than assumed to consume zero capacity.
- The initial view contains the header, KPI cards with graphs, search/filter controls, weekly staff table and pagination. The cards summarize total staff, available staff, capacity-weighted utilization and overloaded staff for the selected week across the department. Graphs show staff status as a donut, active staff availability as a stacked bar, assigned hours against a 100% capacity marker, and ranked excess-hour bars for the three most overloaded staff. Compact graphs sit beside the KPI values, preserving the original card height, spacing and styling. Hover or keyboard focus reveals counts, hours and staff breakdowns; the overload total includes all overloaded staff. Missing capacity data is labeled as unavailable. Utilization and excess hours use active staff with recorded capacity and assignment hours; unrecorded hours are excluded. The eye action opens capacity and assignment details; edit opens weekly scheduled hours and time off; row ellipsis offers Assign to project, Reassign and Unassign; multiple assignments open a project picker. The Assign staff button opens authorized projects awaiting their first allocation. Project choices display the service name and request reference, including after selection. Assignment, capacity and project picker dialogs share the portal modal styling.
- Assign or reassign staff with weekly hours and an end date. An allocation starts on the selected Monday and counts in every overlapping week at its full weekly amount; daily prorating is not modeled. Editing replaces that employee's allocation for the project. Reassignment and unassignment change project access.
- Only active staff with active logins can receive allocations, and only projects whose workflow is ready for activation or already active are available. Unstaffed authorized projects appear under Assign staff. Allocating staff does not activate the project or bypass financial/commencement gates.
- Staffing allocations create workflow audit events and notifications. Existing workflow staffing updates preserve recorded hours for retained staff.

## HR planning integration (2026-11-13)

### Verified sources and supported behavior

The existing route remains `/staff-workload` in Project Management. Service Operations staffing decisions use this existing view; no module, sidebar, staffing authorization, or project activation behavior was moved. Attendance records and policy administration remain in People & HR.

| Existing implementation                                                                             | Integration                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/features/workload/workload.controller.ts`, `WorkloadCapacity`                         | Existing current-head authorization, employee department scope, manual weekly scheduled hours and time off remain authoritative. No data is overwritten.                                                                                                                                  |
| `ProjectStaff`, `apps/web/src/features/workload/model/workload.ts`                                  | Existing weekly allocation overlap rules, full weekly hours, utilization, missing-hours warnings and overload behavior remain unchanged.                                                                                                                                                  |
| `AttendancePolicy`, `AttendancePolicyDay`, `AttendancePolicyAssignment`                             | Workload reads assigned daily required durations for each date in the selected week, including rest days, effective assignment changes, and policy time zones. Missing coverage stays unknown; an explicit rest day has zero required hours.                                              |
| `apps/api/src/features/projects/calendar.service.ts`, `ConversationMeeting`, `WorkflowConsultation` | The shared calendar maps these timed commitments to the current department head. Workload exposes scheduled, non-cancelled commitments for that head only and detects strict interval overlaps. Adjacent commitments do not conflict. Other project staff are not assumed to participate. |
| `Employee.status`                                                                                   | Existing current `ON_LEAVE` and `INACTIVE` indicators remain; these are not dated future leave approvals.                                                                                                                                                                                 |

`GET /api/workload?week=YYYY-MM-DD` adds a read-only `planning` object per scoped employee, assembled by `workload-availability.service.ts` inside the existing repeatable-read transaction:

- `requirement.days`: seven attendance work-date labels with required minutes, working/rest status, policy name, and IANA time zone. Assignment `effectiveUntil` is exclusive. Date labels belong to policy-local attendance dates; they are not inferred clock-in windows.
- `requirement.totalHours`: the sum only when all seven dates have policy coverage; otherwise null. `knownHours` summarizes covered dates only, not a full-week estimate.
- `confirmedAvailableSlots`: null (unknown), never an empty list implying a fully free week.
- `commitments`: known head service meetings/consultations whose actual timestamps overlap the selected Monday-to-Monday **UTC** week, with original timestamp boundaries retained. Pending proposed reschedules do not replace confirmed times. Completed/cancelled events are excluded.
- `overlaps`: pairs of overlapping known timed commitments. Weekly over-capacity warnings remain a separate calculation; weekly project allocations have no timed slots to compare against meetings.

Workload details show daily requirements, current HR status, manual time off, remaining weekly capacity, and timed conflicts. The directory explicitly labels availability as a weekly estimate with unconfirmed time slots. Required hours are planning context, not assigned working schedules. Policy hours do not replace manual capacity, even when capacity is missing. Meetings are not subtracted again from capacity, because their relationship to existing project allocations is not modeled.

Attendance sessions, breaks, clock-in state and actual worked hours are never used by this integration. They cannot establish future availability or project productivity. No migration, new write endpoint, attendance-management interface, payroll behavior, or project-assignment behavior was added.

### Exact deferred dependencies

- **Assigned working schedules:** no employee shift/working-window model or API exists. Attendance policies define required durations and weekdays only. A dated, time-zone-aware employee schedule source is needed to derive confirmed time slots, handle overnight scheduled availability, and test time-of-day task conflicts.
- **Approved leave:** no leave request/approval model or dated leave intervals exist. `WorkloadCapacity.timeOffHours` is manually entered weekly time off/holidays, and `Employee.status = ON_LEAVE` is a current HR status. Neither supplies approved future leave dates. Leave subtraction and dated leave conflicts are deferred pending an authoritative leave source and reconciliation with existing manual time off.
- **Timed employee commitments:** `ProjectStaff` records weekly hours and allocation date ranges, not task durations or busy windows. Work-plan task due dates and milestones are deadlines, not busy intervals. Meetings/consultations currently identify the department head rather than employee attendee lists. Ordinary employee calendar conflict detection needs actual attendee mapping and timed task/resource allocations.
- **Confirmed slots:** remain unknown until the schedule, leave and complete timed-commitment sources exist. An empty known-commitment list is not evidence of free time. Current status cannot predict whether an employee will remain on leave in a later week.

### Reuse cleanup (2026-11-13)

The planning drawer now uses the same `SidePanelSection`, `DetailList`, `DetailItem`, and `Pill` primitives used by Employee and Client Admin drawers. Daily policy requirements and known commitments use shared detail rows instead of feature-specific cards; the no-commitments state uses `EmptyState`. The existing drawer shell, buttons, table, filtering, paging, and staffing controls are retained. This does not create a new attendance-specific UI framework.

Timestamp formatting is shared through `apps/web/src/lib/format.ts`; attendance keeps its existing `attendanceDate` export, while workload uses the same formatter with UTC explicitly. HR status text reuses `humanizeEnum`, already used in Admin pages.

`apps/api/src/features/projects/calendar.queries.ts` centralizes consultation/meeting scope, cancellation rules, and optional interval filtering for the internal calendar, client calendar, and workload. Calendar history still includes completed events; workload still selects scheduled commitments only. The frontend `calendarConflicts` helper remains specialized: it excludes past events and returns event IDs with shared assignees, whereas workload returns overlapping pairs for any selected week, including historical weeks. It cannot be substituted directly without changing behavior; no cross-app package or unrelated refactor was introduced.

## Later iterations

Daily/monthly calendar planning, recurring schedule templates, leave approvals, skill recommendations, cross-department support and allocation history remain outside this phase. Weekly capacity and time off are entered manually, with read-only HR policy context and the limited timed commitments described above.

## Verification

Offline PGlite integration tests cover access boundaries, weekly capacity validation, authorized assignment, reassignment and removal. The browser test covers capacity editing, projected utilization, assignment saving and desktop/mobile layout with isolated fixture data.

The HR integration adds offline PGlite coverage in `apps/api/tests/features/workload/availability.test.ts` for midweek policy changes, flexible daily targets, time zones/rest days, missing coverage, existing allocation/date behavior, overnight timed commitments, interval boundaries, cancellations, department scope, immediate head revocation, and independence from clocked-in/closed attendance sessions. Web unit tests preserve capacity semantics; real-API browser tests in `apps/web/e2e/attendance.spec.ts` inspect the integrated drawer at 390, 820 and 1440 pixels. Existing workload browser tests retain assignment/capacity regression coverage.

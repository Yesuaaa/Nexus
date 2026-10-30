# Staff Workload Management

Developed: 2026-10-30

The `/workload` page gives current department heads a staff directory, weekly or monthly availability calendar, capacity calculations, assignment breakdowns and a cross-department staffing inbox. Search by employee name, ID or position; filter by skills, availability, employment type and workload; sort by name, utilization, remaining capacity or assignments. Department filtering is limited to the manager's authorized department, rather than exposing other departments' employee directories.

## Authorization and responsibility

The existing `Department.headId` relationship identifies the department manager; no new account role is introduced. Active Staff or Admin department heads receive `workload:read` and `workload:manage` in authentication responses. Roles alone do not grant this access. Every API call verifies the current head relationship, and every mutation checks scope again inside its database transaction. Existing temporary-head handoffs therefore transfer workload access. Superadmins, clients and ordinary staff have no workload access.

Managers can view and configure only their department's employees. Service requests belong to the departments linked to their service. Projects have explicit participating departments through `ProjectDepartments`; tasks inherit their project's scope. Admin department managers can establish responsibility for an open project that has no department using the assignment dialog. This action cannot replace existing responsibility. Managers can create a task within an open project they are authorized to staff. Other project lifecycle management remains outside this module.

For cross-department work, the responsible department manager sends a staffing request containing the work, required skills, time block, estimated hours, priority and optional deadline. The receiving manager selects an employee from their own department and explicitly approves, or rejects the request. Approval rechecks the original work, skills, schedule and conflicts before creating an assignment atomically. Pending requests represent departmental demand, not employee assignments, and do not reserve capacity. The requester may withdraw a pending request. Either responsible manager may close an approved assignment; the requester sees the approved employee's name but cannot browse the receiving department's directory or availability records.

Client specialist preferences appear as decision-support information in the assignment dialog. They never create an assignment or preselect personnel. The system never automatically finalizes a personnel decision.

## Capacity and scheduling rules

- All recurring schedules, date filters and calendar displays use **Asia/Manila**. API timestamps require an explicit timezone. Weeks contain seven days from the selected date; month views use the actual calendar month's length.
- Working shifts are stored per employee and weekday, with separate shifts for breaks and flexible arrangements. Employment type never implies default hours. Employees without a schedule have zero configured capacity. Hours before an employee's start date are excluded; inactive or on-leave employees have no available capacity.
- Available capacity is configured working hours minus the union of recorded appointments, consultations, approved leave/absences and temporary unavailability. Overlapping commitments deduct time once; nonworking time is not deducted.
- The repository has no external calendar or leave-management module to integrate. Managers record approved leave and appointments manually here; the UI labels those records as manual. Imported commitment sources can be stored by integrations, but managers cannot remove them through the manual-record endpoint. Recording leave here is not a leave approval workflow.
- Assignments are explicit continuous reserved time blocks linked to exactly one request, project or project task. Blocks must fit within working shifts, cannot overlap commitments or other confirmed blocks, and must start in the future. Split work across separate blocks for breaks or multiple days. Estimated hours must be positive and fit within the block. A deadline cannot precede the block's end. Required skills must match the employee's recorded competencies.
- Utilization is estimated allocated hours divided by available working capacity, multiplied by 100. Estimated effort is prorated by block overlap when a reporting period clips a block. Remaining hours describe estimated effort capacity; the entire scheduled block is reserved, so additional work still requires a free time block.
- Workload bands are Available (under 50%), Moderate (50–under 80%), High (80–under 100%), Fully Allocated (100%), Over Capacity (over 100%), and Unavailable (no capacity and no allocated work). Allocated work with zero capacity is Over Capacity, with `utilization: null` rather than an invalid percentage. Availability has separate Available, Partially Available, Fully Allocated and Unavailable labels.
- Completing or cancelling an assignment releases it from capacity calculations. Completing/cancelling its parent request or project, or completing its task, also releases it. Changing an employee's schedule, absence records or HR status preserves existing work and highlights resulting conflicts and overload for manager review.
- Active assignments are confirmed blocks in progress now; upcoming assignments start later. Pending work counts confirmed blocks whose source request is Pending or source project is Planned; these blocks already reserve capacity and may also be upcoming. Detail views include work overlapping the chosen period and up to 50 assignments after it. The staffing inbox shows the latest 200 incoming/sent requests, including pending departmental demand without an employee.
- Serializable transactions and employee row locks protect assignment decisions, configuration changes and cross-department approvals from concurrent double-booking. Stale decisions return `409`; authorization violations return `403` or a scoped `404`.

## API

All endpoints use authenticated same-origin `/api/workload` requests and the existing sessionStorage Bearer-token flow.

| Method | Path                                       | Purpose                                                                       |
| ------ | ------------------------------------------ | ----------------------------------------------------------------------------- |
| GET    | `/`                                        | Scoped overview, staffing inbox; `start=YYYY-MM-DD`, `days=7\|28\|29\|30\|31` |
| GET    | `/options`                                 | Authorized open requests, projects/tasks and recipient departments            |
| GET    | `/employees/:id`                           | Metrics, calendar, recorded commitments and work breakdown                    |
| PUT    | `/employees/:id/configuration`             | Replace `skills` and `workingSchedule` atomically                             |
| POST   | `/employees/:id/commitments`               | Record a manual appointment, approved absence or unavailability               |
| DELETE | `/employees/:id/commitments/:commitmentId` | Remove a manual commitment                                                    |
| POST   | `/assignments`                             | Explicitly confirm a same-department assignment                               |
| PATCH  | `/assignments/:id`                         | Complete or cancel a confirmed assignment                                     |
| POST   | `/staffing-requests`                       | Request another department's personnel                                        |
| PATCH  | `/staffing-requests/:id`                   | Approve with `employeeId`, reject, or withdraw                                |
| PUT    | `/projects/:id/responsibility`             | Admin manager establishes their department's initial project responsibility   |
| POST   | `/projects/:id/tasks`                      | Create a task within an authorized open project                               |

Configuration accepts `workingSchedule: [{ weekday, startMinute, endMinute }]` (`weekday`: Sunday=0 through Saturday=6; minutes: 0–1440) and `skills: string[]`. Work inputs accept exactly one of `serviceRequestId`, `projectId` or `taskId`, plus `title`, `startsAt`, `endsAt`, `estimatedHours`, `requiredSkills`, `priority` and optional `deadline`. Same-department assignments add `employeeId`; cross-department requests add `recipientDepartmentId`. Skills are normalized case-insensitively.

## Database rollout and verification

The additive migration is `20261030200000_staff_workload`. It adds employee skills, working schedules, commitments, project tasks, project department relationships, assignments and staffing requests, with foreign keys and validation constraints. Existing employees receive no assumed working schedule; managers must configure capacity. Existing projects require explicit departmental responsibility before staffing.

Generate the Prisma client with `pnpm db:generate`. Apply the migration to the intended environment using `pnpm --filter @nexus/api exec prisma migrate deploy` before opening the module. No live database is touched by the tests.

`pnpm --filter @nexus/api test:workload` runs the PGlite integration suite for access boundaries, handoffs, actual capacity, overlapping absences, skills, scheduling, cross-department decisions, project ownership and concurrent assignment attempts. The regular API test command includes this suite. Browser coverage in `apps/web/e2e/workload.spec.ts` exercises desktop/mobile filtering, detail/calendar views, configuration, assignment confirmation, staffing approval and denied access. Required handoff checks are `pnpm format`, `pnpm lint` and `pnpm typecheck`.

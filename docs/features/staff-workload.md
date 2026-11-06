# Staff Workload

Department Heads open **Staff Workload** from the portal sidebar. Access is limited to the current active STAFF department head; admin roles do not bypass department scope.

Employee Management is the design reference: shared EXP shell, Inter typography, management heading, search field, filter triggers, navy actions and restrained borders/shadows. Keep staffing decisions prominent and use color only for capacity status.

## First working version

- Select a date to review its Monday-starting week. Set scheduled hours and time off (including holidays) separately for each employee and week. No working schedule is assumed.
- Available capacity is scheduled hours minus time off. Utilization is assigned weekly hours divided by capacity. Over-capacity allocations remain permitted and visibly flagged for the department head to resolve.
- Existing assignments without recorded hours are labeled as needing setup, rather than assumed to consume zero capacity.
- The initial view contains only the header, search/filter controls, weekly staff table and pagination. The eye action opens capacity and assignment details; edit opens weekly scheduled hours and time off; row ellipsis offers Assign to project, Reassign and Unassign; multiple assignments open a project picker. The header ellipsis opens staffing requests and department-wide assignment.
- Assign or reassign staff with weekly hours and an end date. An allocation starts on the selected Monday and counts in every overlapping week at its full weekly amount; daily prorating is not modeled. Editing replaces that employee's allocation for the project. Reassignment and unassignment change project access.
- Only active staff with active logins can receive allocations, and only projects whose workflow is ready for activation or already active are available. Unstaffed authorized projects appear as staffing requests. Allocating staff does not activate the project or bypass financial/commencement gates.
- Staffing allocations create workflow audit events and notifications. Existing workflow staffing updates preserve recorded hours for retained staff.

## Later iterations

Daily/monthly calendar planning, recurring schedule templates, leave approvals, skill recommendations, cross-department support and allocation history are outside this first version. Weekly capacity and leave are entered here, without an external scheduling integration.

## Verification

Offline PGlite integration tests cover access boundaries, weekly capacity validation, authorized assignment, reassignment and removal. The browser test covers capacity editing, projected utilization, assignment saving and desktop/mobile layout with isolated fixture data.

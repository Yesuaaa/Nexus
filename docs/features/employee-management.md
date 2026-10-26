# Employee Management (Admin)

- Developed: 2026-10-26
- Issue: #37
- Status: Implemented

## Scope and implementation

Employee Management adds `/employees` to the existing Admin portal. Only the `ADMIN` role receives `employees:read` and `employees:manage`; Superadmin, Staff, and User cannot open the page or call its API.

The directory uses the existing EXP admin canvas, Inter typography, navy actions, compact tables, and shadcn/Radix components. These choices keep the page consistent with Account Management and Department Management. Motion is limited to the existing dialog, menu, and drawer transitions.

Admins can search, filter, and page through employee records; add or edit employment details; view an employee drawer; and update employment status. Adding an employee creates an active Staff portal account in the same transaction. Older employee-only records can be provisioned from Edit employee by supplying a password. Employee Management does not expose arbitrary account linking or unlinking.

The Department Management Employees and Teams drawer assigns people to departments and teams without changing portal-account associations or access. Portal-user provisioning and employee synchronization remain managed by their existing flows.

## Data and integration rules

Employees have their own employee ID, personal information, department, position, employment type, status, required start date, and optional team. Employment status is independent of account activation and does not grant permissions. New employee accounts use the Staff role and mirror the employee's name, email, contact number, position, department, and team.

Department and team assignments are validated together. Existing portal-user synchronization retains login identity, password, role, and activation state while mirroring department, team, and position fields for existing account views. Department heads and team leads must be reassigned before an update that would leave them without the required assignment.

## Validation

The form shows an error after a field loses focus or when submission focuses the first invalid field. A reserved message line keeps the layout steady. The API enforces the same rules:

- Employee ID is required, 2 to 40 characters, and limited to letters, numbers, hyphens, and underscores.
- Full name is required, 2 to 100 characters, and accepts Unicode letters, spaces, hyphens, apostrophes, and periods.
- Email is required, must be valid, and must end in `.com` or `.ph`; contact number is required, must have 11 digits, and start with `08` or `09`.
- Position and start date are required. Position is limited to 100 characters and the start date must be a real calendar date.
- Employment type and department are required. Team requires an explicit team selection or the `No team` option.
- A new employee, or an older employee without an account, requires a password and confirmation. Passwords require at least 12 characters with uppercase, lowercase, number, and special character.

Employee and account creation is atomic. A duplicate employee ID or portal-account email rolls back both records. Matching email alone is never used to attach an existing account.

Employment types are Full-time, Part-time, Contract, and Intern. Statuses are Active, Inactive, and On leave. Teams must belong to the selected department.

## UI behavior

The directory supports search, department, employment type, and status filters, plus server pagination. The table scrolls independently within the management card and keeps its desktop column header visible, while the surrounding filters and pagination remain available. Loading, retryable errors, empty results, pending actions, and field errors appear in context.

The detail sheet follows Department Management's overlay, focus restoration, scrolling body, fixed footer, and mobile sizing. Department member removal removes only the assignment. Employment status and department membership changes require confirmation.

## Update — 2026-10-26: Temporary department head handoff

When an Admin changes a current department head to Inactive or On leave, the status dialog selects the longest-serving eligible employee in that department by start date. Employees with no start date are considered after dated employees and ordered by their record creation date. The Admin can choose another active Staff member with an EXP account before confirming. The status change and head reassignment are saved together; if no eligible replacement exists, neither change is applied.

When the original head returns to Active, EXP restores them if the temporary assignment is still in place, then clears the temporary handoff. A permanent head change in Department Management clears the handoff so a later status update will not overwrite that decision.

Employee form validation follows registration's interaction pattern: submitting focuses the first invalid field, blur reveals that field's error, and a reserved message line keeps labels, controls, and errors aligned across each two-column row. Every form field is required; the team field must explicitly select either a team or `No team`.

Migration `20261026110000_temporary_department_head_coverage` adds the handoff tracking fields. It was applied to the configured Supabase database on 2026-10-26, and Prisma confirmed the schema was up to date afterward.

## Update — 2026-10-26: Login account retirement

Employee login removal uses two explicit steps. An active login must first be deactivated, which immediately revokes its sessions and prevents further sign-in. The row action then changes to **Delete login account**. Deleting the login retires its credentials and removes it from Account Management without deleting the employee record or changing department, team, position, employment, department-head, or team-lead assignments.

The retained identity row preserves assignment relationships but cannot authenticate and is not returned by account-directory queries. Editing an employee with a retired login presents the password fields again; saving a new valid password restores the same login identity and assignments rather than creating duplicates.

Migration `20261026120000_soft_delete_login_accounts` adds the login-retirement timestamp. It was applied to the configured Supabase database on 2026-10-26, and Prisma confirmed the schema was up to date afterward.

## Database rollout

Migration `20261026100000_employee_management` was applied to the configured Supabase database on 2026-10-26. It creates employee records for existing Staff/Admin accounts and department or team members without copying login credentials. Migration status confirmed the database was up to date afterward.

Generating the Prisma client alone does not apply migrations. See the [Prisma guide](../prismaGuide.md) for the deployment command and connection settings.

## Verification

The earlier Employee Management implementation passed the API suite (29 tests), web unit suite (11 tests), production web build, TypeScript checks, and browser checks for employee form validation and creation, the directory toolbar, and mobile layout. After removing Employee Management account controls, API and web TypeScript checks, targeted ESLint, and `git diff --check` passed. Test suites were not rerun for this update.

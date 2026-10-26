# Employee Management (Admin)

- Developed: 2026-10-26
- Issue: #37
- Status: Implemented

## Scope and implementation

Employee Management adds `/employees` to the existing Admin portal. Only the `ADMIN` role receives `employees:read` and `employees:manage`; Superadmin, Staff, and User cannot open the page or call its API.

The directory uses the existing EXP admin canvas, Inter typography, navy actions, compact tables, and shadcn/Radix components. These choices keep the page consistent with Account Management and Department Management. Motion is limited to the existing dialog, menu, and drawer transitions.

Admins can search, filter, and page through employee records; add or edit employment details; view an employee drawer; update employment status; and link or unlink an existing account after confirmation. Employee records can exist without portal accounts. Account linking is explicit, one-to-one, and never based on matching email addresses.

The Department Management Employees and Teams drawer also works with employee records that have no linked account. Assigning or removing someone there changes department or team membership without deleting the employee or account.

## Data and integration rules

Employees have their own employee ID, personal information, department, position, employment type, status, and optional start date, team, and portal account. Employment status is independent of account activation and does not grant permissions.

Department and team assignments are validated together. Linked accounts retain their login identity, password, role, and activation state; their department, team, and position fields mirror the associated employee for existing account views. Department heads and team leads must be reassigned before an update that would leave them without the required assignment. Superadmin accounts cannot be linked.

## Validation

The form shows errors beside fields as users type, leave a field, or submit. The API enforces the same rules:

- Employee ID is required, 2 to 40 characters, and limited to letters, numbers, hyphens, and underscores.
- Full name is required, 2 to 100 characters, and accepts Unicode letters, spaces, hyphens, apostrophes, and periods.
- Email and contact number are optional. A supplied email must be valid and end in `.com` or `.ph`; a supplied contact number must have 11 digits and start with `08` or `09`.
- Position is optional and limited to 100 characters. A supplied start date must be a real calendar date.

Employment types are Full-time, Part-time, Contract, and Intern. Statuses are Active, Inactive, and On leave. Teams must belong to the selected department.

## UI behavior

The directory supports search, department, employment type, and status filters, plus server pagination. Loading, retryable errors, empty results, pending actions, and field errors appear in context.

The detail sheet follows Department Management's overlay, focus restoration, scrolling body, fixed footer, and mobile sizing. Department member removal removes only the assignment. Changes to linked accounts, employment status, and department membership require confirmation.

## Database rollout

Migration `20261026100000_employee_management` was applied to the configured Supabase database on 2026-10-26. It creates employee records for existing Staff/Admin accounts and department or team members without copying login credentials. Migration status confirmed the database was up to date afterward.

Generating the Prisma client alone does not apply migrations. See the [Prisma guide](../prismaGuide.md) for the deployment command and connection settings.

## Verification

The API suite passed 29 tests, and the web unit suite passed 11 tests. The production web build and TypeScript checks passed. Browser checks passed for employee form validation and creation, the directory toolbar, and the mobile layout.

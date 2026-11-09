# Role-based access control

Clients (`USER`) track their own requests in **Service Requests** at `/service-requests`. Legacy `/booked-services` links remain available, but no separate navigation entry is shown. The list and detail endpoints under `GET /api/service-requests` require an active client session and derive ownership from that session. Another client's booking returns `404`. Admin, Staff, and Superadmin cannot use these client endpoints. The existing client submission endpoint remains available. See [Client Service Requests](features/client-service-requests.md).

The **Request Inbox** (`/request-inbox`, `/api/request-inbox`) is available only to active `STAFF` accounts currently assigned as `Department.headId`. It shows bookings for services linked to the head's department and permits acceptance from `SUBMITTED` into `UNDER_REVIEW`. Ordinary staff, team leads, clients, Admins, and Superadmins have no override. The API checks the current head assignment on every request, including temporary head handoffs. See [Department Head Request Inbox](features/department-request-inbox.md).

**Staff Workload** (`/staff-workload`, `/api/workload`) is available only to an active `STAFF` account currently assigned as a department's `headId`. The API independently rechecks that assignment and scopes capacity and staffing operations to that department; ordinary staff, team leads, clients, Admins, and Superadmins have no override. The head can read weekly workload, save employee capacity through `PUT /api/workload/capacity`, and manage eligible project allocations through `PUT /api/workload/assignment` and `DELETE /api/workload/assignment/:id`. These allocation operations do not activate projects or bypass workflow gates. The frontend uses the department-head route gate, but API authorization remains authoritative. See [Staff Workload](features/staff-workload.md).

Acceptance records the responsible department and opens [request messaging](features/request-messaging.md). Only the request's owning `USER` and that department's current active `STAFF` head can read or send service-request messages. Other routed heads and administrators have no conversation override. Staff, Admin and Superadmin accounts may use the separate internal direct-chat list to message one another. Head handoffs transfer service-request conversation access; closed or cancelled requests retain readable history but reject messages. Supabase credentials remain server-only, with authenticated same-origin streams delivering change notifications to browsers.

Superadmins can restore soft-deleted accounts through **Account Management → Trash → Actions → Restore account**. `POST /api/users/:id/restore` uses the same `accounts:status-basic` / `accounts:status-privileged` permissions as account status changes. It returns `{ "user": ... }`, clears `accountDeletedAt`, and revokes stale sessions atomically. The account returns to the main list as **inactive**, keeping its existing password, role, details and department/team assignments. Reactivate it separately to allow sign-in. Self-targeting returns `403`, missing or permanently deleted accounts return `404`, and accounts outside Trash or changed concurrently return `409`.

Client Management (`/clients`) and all `/api/clients/:id` details, service-request and project reads require `clients:read` and are available to Admin only. Superadmin, Staff and User cannot access it. The module is read-only; it exposes no client creation, editing or deletion operations. See [Client Management](features/client-management.md) for the read contracts and database relationships.

Roles are fixed in the Prisma `Role` enum. Permissions are assigned by the API in `apps/api/src/features/auth/auth.permissions.ts`; there is no per-account permission table or permission editor. The API returns each account's effective permissions in authentication and user responses. Portal navigation and controls use those values, while the API enforces every protected operation.

The frontend's Department Management page (`/departments`) is available only to Admin accounts with the `departments:read` permission. Superadmin, Staff, and Client accounts have no Departments navigation link and are redirected to the dashboard if they open that URL. This page restriction does not change the backend's department API permissions.

| Permission                                                             | User |        Staff         | Admin | Superadmin |
| ---------------------------------------------------------------------- | :--: | :------------------: | :---: | :--------: |
| View Dashboard                                                         |  ✓   |          ✓           |   ✓   |     ✓      |
| Open Staff Workload and manage department capacity/assignments         |      | Department head only |       |            |
| View own account and change own password                               |  ✓   |          ✓           |   ✓   |     ✓      |
| View client directory, details, requests and projects (`clients:read`) |      |                      |   ✓   |            |
| Open Department Management page                                        |      |                      |   ✓   |            |
| Use Employee Management and Service Management pages and APIs          |      |                      |   ✓   |            |
| Use Account Management and its account APIs                            |      |                      |       |     ✓      |
| View accounts (`accounts:read`)                                        |      |                      |       |     ✓      |
| Change other accounts' passwords (`accounts:reset-password`)           |      |                      |       |     ✓      |
| Create User or Staff accounts (`accounts:create-basic`)                |      |                      |       |     ✓      |
| Change User or Staff roles (`accounts:assign-basic`)                   |      |                      |       |     ✓      |
| Create Admin or Superadmin accounts (`accounts:create-privileged`)     |      |                      |       |     ✓      |
| Change Admin or Superadmin roles (`accounts:assign-privileged`)        |      |                      |       |     ✓      |
| Change User or Staff status (`accounts:status-basic`)                  |      |                      |       |     ✓      |
| Change Admin or Superadmin status (`accounts:status-privileged`)       |      |                      |       |     ✓      |
| Delete inactive accounts                                               |      |                      |       |     ✓      |

Service Management is available to Admin accounts. Viewing the page and its API requires `services:read`; creating, editing, activating, and deactivating services requires `services:manage`. The `/api/services/available` endpoint is available to any authenticated account and returns only active services for new client-request forms.

Client Services (`/services`) and Service Requests (`/service-requests`) use the `/api/client/services` and `/api/client/service-requests` routes, restricted to authenticated `USER` accounts. Admin, Staff and Superadmin accounts cannot access these client routes; opening the request-history page redirects them to the dashboard. Clients can submit requests and read only their own history. Preferred specialists remain preferences for Department Manager review. See [Client Service Requests](features/client-service-requests.md).

Account Management and its API routes are restricted to Superadmin. Admins have no `accounts:*` permissions; their `clients:read` access is read-only and does not grant account-management operations. Superadmin has no `clients:read` permission. A Superadmin may assign any role. No one may change their own role through the account API. The API reads the user's current role from the database on each authenticated request, so a role change affects subsequent requests without changing session tokens.

Account Management supports deactivation, reactivation and deletion of inactive accounts. `accounts:status-basic` applies to User and Staff accounts; `accounts:status-privileged` applies to Admin and Superadmin accounts. Currently, only Superadmin receives these permissions. No one may change their own role or status, or delete their own account.

Superadmins can select **Change password** from another account's Actions menu, including inactive accounts. `POST /api/users/:id/password` requires `accounts:reset-password` and accepts `{ "newPassword": "..." }`. The new password must contain at least 12 characters, including uppercase, lowercase, a number and a special character, and be no more than 1,024 UTF-8 bytes. The current password is not required. A successful change returns `204`, hashes the new password and revokes all sessions for the selected account in one transaction. The Superadmin remains signed in; the target's role and active status are preserved. Self-targeted changes are rejected with `403`; missing or trashed accounts return `404`. The existing `POST /api/auth/change-password` endpoint remains the separate authenticated self-service operation requiring the current password.

`PATCH /api/users/:id/status` accepts `{ "isActive": false }` to deactivate or `{ "isActive": true }` to reactivate and returns `{ "user": ... }`. Deactivation preserves the account and department/team assignments, revokes all its sessions, and blocks login and authenticated requests. Reactivated accounts must sign in again. Account responses include `isActive`; new and existing accounts default to active. Apply the `20261026090000_account_status` migration before deploying these changes with `pnpm --filter @nexus/api exec prisma migrate deploy`.

### Project Workspace

- All active STAFF accounts can view active and archived projects and update work-plan tasks in their department.
- Only the current Department Head for a project's department can set up or rename its workspace, cancel active projects, and approve staff assignments. Cancelled and completed projects appear in the Archive view and are excluded from active workload totals. Assignment continues through the existing STAFF_PROJECT workflow action.
- Clients retain their existing project view; the internal workspace is unavailable to USER, ADMIN, and SUPERADMIN accounts.
- Only active staff assigned to a workstream can upload or remove its deliverable attachment. The Department Head can edit deliverable requirements, approve or reject submissions (a rejection reason is required), and send approved files to the client. Submitted files remain staff-only until sent; clients can access files after that action.

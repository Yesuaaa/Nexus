# Role-based access control

Client Management (`/clients`) and all `/api/clients/:id` details, service-request and project reads require `clients:read` and are available to Admin only. Superadmin, Staff and User cannot access it. The module is read-only; it exposes no client creation, editing or deletion operations. See [Client Management](features/client-management.md) for the read contracts and database relationships.

Roles are fixed in the Prisma `Role` enum. Permissions are assigned by the API in `apps/api/src/features/auth/auth.permissions.ts`; there is no per-account permission table or permission editor. The API returns each account's effective permissions in authentication and user responses. Portal navigation and controls use those values, while the API enforces every protected operation.

The frontend's Department Management page (`/departments`) is available only to Admin accounts with the `departments:read` permission. Superadmin, Staff, and Client accounts have no Departments navigation link and are redirected to the dashboard if they open that URL. This page restriction does not change the backend's department API permissions.

| Permission                                                             | User | Staff | Admin | Superadmin |
| ---------------------------------------------------------------------- | :--: | :---: | :---: | :--------: |
| View Dashboard                                                         |  ✓   |   ✓   |   ✓   |     ✓      |
| View own account and change own password                               |  ✓   |   ✓   |   ✓   |     ✓      |
| View client directory, details, requests and projects (`clients:read`) |      |       |   ✓   |            |
| Open Department Management page                                        |      |       |   ✓   |            |
| Use Employee Management and Service Management pages and APIs          |      |       |   ✓   |            |
| Use Account Management and its account APIs                            |      |       |       |     ✓      |
| View accounts (`accounts:read`)                                        |      |       |       |     ✓      |
| Create User or Staff accounts (`accounts:create-basic`)                |      |       |       |     ✓      |
| Change User or Staff roles (`accounts:assign-basic`)                   |      |       |       |     ✓      |
| Create Admin or Superadmin accounts (`accounts:create-privileged`)     |      |       |       |     ✓      |
| Change Admin or Superadmin roles (`accounts:assign-privileged`)        |      |       |       |     ✓      |
| Change User or Staff status (`accounts:status-basic`)                  |      |       |       |     ✓      |
| Change Admin or Superadmin status (`accounts:status-privileged`)       |      |       |       |     ✓      |
| Delete inactive accounts                                               |      |       |       |     ✓      |

Service Management is available to Admin accounts. Viewing the page and its API requires `services:read`; creating, editing, activating, and deactivating services requires `services:manage`. The `/api/services/available` endpoint is available to any authenticated account and returns only active services for new client-request forms.

Account Management and its API routes are restricted to Superadmin. Admins have no `accounts:*` permissions; their `clients:read` access is read-only and does not grant account-management operations. Superadmin has no `clients:read` permission. A Superadmin may assign any role. No one may change their own role through the account API. The API reads the user's current role from the database on each authenticated request, so a role change affects subsequent requests without changing session tokens.

Account Management supports deactivation, reactivation and deletion of inactive accounts. `accounts:status-basic` applies to User and Staff accounts; `accounts:status-privileged` applies to Admin and Superadmin accounts. Currently, only Superadmin receives these permissions. No one may change their own role or status, or delete their own account.

`PATCH /api/users/:id/status` accepts `{ "isActive": false }` to deactivate or `{ "isActive": true }` to reactivate and returns `{ "user": ... }`. Deactivation preserves the account and department/team assignments, revokes all its sessions, and blocks login and authenticated requests. Reactivated accounts must sign in again. Account responses include `isActive`; new and existing accounts default to active. Apply the `20261026090000_account_status` migration before deploying these changes with `pnpm --filter @nexus/api exec prisma migrate deploy`.

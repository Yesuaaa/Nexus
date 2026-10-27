# Role-based access control

Roles are fixed in the Prisma `Role` enum. Permissions are assigned by the API in `apps/api/src/features/auth/permissions.ts`; there is no per-account permission table or permission editor. The API returns each account's effective permissions in authentication and user responses. Portal navigation and controls use those values, while the API enforces every protected operation.

The frontend's Department Management page (`/departments`) is available only to Admin accounts with the `departments:read` permission. Superadmin, Staff, and Client accounts have no Departments navigation link and are redirected to the dashboard if they open that URL. This page restriction does not change the backend's department API permissions.

| Permission                               | User | Staff | Admin | Superadmin |
| ---------------------------------------- | :--: | :---: | :---: | :--------: |
| View Dashboard                           |  ✓   |   ✓   |   ✓   |     ✓      |
| View own account and change own password |  ✓   |   ✓   |   ✓   |     ✓      |
| View accounts                            |      |       |   ✓   |     ✓      |
| Create User or Staff accounts            |      |       |   ✓   |     ✓      |
| Change User or Staff roles               |      |       |   ✓   |     ✓      |
| Create Admin or Superadmin accounts      |      |       |       |     ✓      |
| Change Admin or Superadmin roles         |      |       |       |     ✓      |

| Reset another account password | | | | âœ“ |

Service Management is available to Admin and Superadmin accounts. Viewing the page and its API requires `services:read`; creating, editing, activating, and deactivating services requires `services:manage`. The `/api/services/available` endpoint is available to any authenticated account and returns only active services for new client-request forms.

Only Superadmins have `accounts:reset-password`. `PATCH /api/users/:id/password` accepts `{ "newPassword": "..." }`; it rejects requests from other roles with 403 and does not permit a Superadmin to reset their own password. The password must be 12–1024 bytes and include uppercase, lowercase, numeric, and special characters. A successful reset is hashed with scrypt, revokes all target sessions, and writes a password-free `PASSWORD_RESET` audit event.

An Admin may change a role only when both the current and requested roles are User or Staff. A Superadmin may assign any role. No one may change their own role through the account API. The API reads the user's current role from the database on each authenticated request, so a role change affects subsequent requests without changing session tokens.

Account Management supports deactivation and reactivation. The `accounts:status-basic` permission lets Admins and Superadmins change User and Staff account status; `accounts:status-privileged` lets Superadmins also change Admin and Superadmin account status. No one may change their own status.

`PATCH /api/users/:id/status` accepts `{ "isActive": false }` to deactivate or `{ "isActive": true }` to reactivate and returns `{ "user": ... }`. Deactivation preserves the account and department/team assignments, revokes all its sessions, and blocks login and authenticated requests. Reactivated accounts must sign in again. Account responses include `isActive`; new and existing accounts default to active. Apply the `20261026090000_account_status` migration before deploying these changes with `pnpm --filter @nexus/api exec prisma migrate deploy`.

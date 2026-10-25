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

An Admin may change a role only when both the current and requested roles are User or Staff. A Superadmin may assign any role. No one may change their own role through the account API. The API reads the user's current role from the database on each authenticated request, so a role change affects subsequent requests without changing session tokens.

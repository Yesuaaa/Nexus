# Role-based access control

Service Operations [Logs](features/service-operation-logs.md) require an active `SUPERADMIN` plus module-access and organization-read capabilities. The viewer grants no workflow mutation, private-message or file access. Logs expire after 30 days.

Superadmin has [Phase 3D.1 business-conversation metadata oversight](features/superadmin-messaging-oversight.md) through the existing organization-read and business-inspection capabilities. Service/project metadata reads grant no message content, files, private DM visibility, participant identity, sending or read-marker authority. Existing personal internal chat participation remains independent.

Superadmin uses existing organization-wide employee, department and team management for [Phase 3C.2 People & HR administration](features/superadmin-people-hr-administration.md), without an Employee or Head identity. Existing feature permissions and target eligibility remain authoritative. Employee mutation controls mirror those permissions; Staff login lifecycle controls exclude Admin credentials and self-targeted actions.

Superadmin uses the existing Attendance dashboard for [Phase 3C.1 organization-wide administration](features/superadmin-attendance-administration.md), with no Employee identity or personal request controls. Backend request capabilities reflect existing Head/HR stages and self-review guards; existing HR approval authority is preserved without a verification bypass.

Superadmin request inspection includes [Phase 3B.3A workflow progress and sanitized history](features/superadmin-workflow-oversight.md). Organization-read capability grants no participant identity, workflow mutations, financial decisions, private conversations or restricted files. Existing explicitly assigned approver permissions remain independent.

Superadmin has [Phase 3B.2 organization-wide workload oversight](features/superadmin-workload-oversight.md) under Service Operations. Administrative reads require module access and organization-read capabilities; capacity and assignment writes remain Department Head operations.

Superadmin can inspect service requests across departments through [Phase 3B.1 administrative reads](features/superadmin-service-request-visibility.md). This does not grant Department Head responsibilities, workflow actions, private conversations or file access.

Superadmin project inspection is implemented through the separate [Phase 3A.1 administrative project views](features/superadmin-project-visibility.md). [Phase 3A.2](features/superadmin-project-management.md) adds only eligible workspace renaming, with actual actor attribution; it does not grant operational participation or general project mutation authority.

The [Phase 2A authorization foundation](features/superadmin-authorization-foundation.md) defines explicit Superadmin administrative capabilities and separate operational eligibility checks. [Phase 2B module registration](features/superadmin-module-registration.md) connects module access to safe administrative entry points for all implemented modules, including Project Management. Operational workflow rules below remain in effect.

For current module availability, entry routes, and role-specific scope, see [Role access by module](features/module-role-access.md), updated 2026-11-14.

Clients (`USER`) track their own requests in **Service Requests** at `/service-requests`. Legacy `/booked-services` links remain available, but no separate navigation entry is shown. The list and detail endpoints under `GET /api/service-requests` require an active client session and derive ownership from that session. Another client's booking returns `404`. Admin, Staff, and Superadmin cannot use these client endpoints. The existing client submission endpoint remains available. See [Client Service Requests](features/client-service-requests.md).

The **Request Inbox** (`/request-inbox`, `/api/request-inbox`) is available only to active `STAFF` accounts currently assigned as `Department.headId`. It shows bookings for services linked to the head's department and permits acceptance from `SUBMITTED` into `UNDER_REVIEW`. Ordinary staff, team leads, clients, Admins, and Superadmins have no override. The API checks the current head assignment on every request, including temporary head handoffs. See [Department Head Request Inbox](features/department-request-inbox.md).

**Staff Workload** (`/staff-workload`, `/api/workload`) is available only to an active `STAFF` account currently assigned as a department's `headId`. The API independently rechecks that assignment and scopes capacity and staffing operations to that department; ordinary staff, team leads, clients, Admins, and Superadmins have no override. The head can read weekly workload, save employee capacity through `PUT /api/workload/capacity`, and manage eligible project allocations through `PUT /api/workload/assignment` and `DELETE /api/workload/assignment/:id`. These allocation operations do not activate projects or bypass workflow gates. The frontend uses the department-head route gate, but API authorization remains authoritative. See [Staff Workload](features/staff-workload.md).

Acceptance records the responsible department and opens [request messaging](features/request-messaging.md). Only the request's owning `USER` and that department's current active `STAFF` head can read or send service-request messages. Other routed heads and administrators have no conversation override. Staff, Admin and Superadmin accounts may use the separate internal direct-chat list to message one another. Head handoffs transfer service-request conversation access; closed or cancelled requests retain readable history but reject messages. Supabase credentials remain server-only, with authenticated same-origin streams delivering change notifications to browsers.

Superadmins can restore soft-deleted accounts through **Account Management → Trash → Actions → Restore account**. `POST /api/users/:id/restore` uses the same `accounts:status-basic` / `accounts:status-privileged` permissions as account status changes. It returns `{ "user": ... }`, clears `accountDeletedAt`, and revokes stale sessions atomically. The account returns to the main list as **inactive**, keeping its existing password, role, details and department/team assignments. Reactivate it separately to allow sign-in. Self-targeting returns `403`, missing or permanently deleted accounts return `404`, and accounts outside Trash or changed concurrently return `409`.

Client Management (`/clients`) and `/api/clients/:id` directory details require `clients:read` and are available to Admin and Superadmin. Creation additionally requires `clients:create`, granted only to these same two roles; read permission alone cannot create clients. Create controls use the new permission. Client updates and deletion retain their Superadmin-only guard. Staff and User cannot access the directory. A client (`USER`) separately sees **My Projects** at `/projects` after a project is activated for their own account. `GET /api/projects` and project detail access are owner-scoped; clients see aggregate progress and only deliverables explicitly sent to them. They can edit the project brief and request a project change while the project is in progress or on hold. They can also submit a cancellation request with a reason; the project remains active until its Department Head approves it. Approval marks the project and its service request cancelled, while declining requires a response note. On each shared deliverable, the client may approve or request a revision with a reason. These client project operations do not grant access to the management client directory or other clients' records. See [Client Management](features/client-management.md) for directory contracts and database relationships.

Project contributors retain staff access to their project workspace. Only the active Department Head assigned to the project's accepted department can accept or decline a client's project change or cancellation request; a decline requires a response note. Approving a cancellation ends the project and service request. Clients can read the resulting decision and note on their own project. Staff milestone details remain hidden from client project responses; clients receive only aggregate progress, project brief information and explicitly shared deliverables. Preview and download endpoints enforce the same project ownership and sharing checks as the deliverable list.

Roles are fixed in the Prisma `Role` enum. Permissions are assigned by the API in `apps/api/src/features/auth/auth.permissions.ts`; there is no per-account permission table or permission editor. The API returns each account's effective permissions in authentication and user responses. Portal navigation and controls use those values, while the API enforces every protected operation.

The frontend's Department Management page (`/departments`) is available to Admin and Superadmin accounts with `departments:read`. Staff and Client accounts cannot open that management page; denied internal navigation returns to `/module`, while clients return to `/dashboard`. The department API independently enforces its permissions.

Department directory reads (`GET /api/departments`) require `departments:read`. Staff and Heads receive only department ID/name/code/color and Head ID/name, including across departments. Rich administrative list fields and full department details additionally require `employees:read`; assignment-candidate searches require `departments:manage`. Department affiliation and Head assignment do not grant general HR contact/account access. Existing department-scoped workload, request-workflow staffing and routed-request coordination remain independently authorized. See [Department data access security](features/department-data-access-security.md).

Department GETs are observational: they do not clean titles, change team assignments or synchronize/provision Employee records. Existing authorized leadership changes maintain those invariants transactionally; unrelated legacy inconsistencies require an explicit management correction. See [Department GET integrity](features/department-get-integrity.md).

| Permission                                                             | User | Staff | Admin | Superadmin |
| ---------------------------------------------------------------------- | :--: | :---: | :---: | :--------: |
| View Dashboard                                                         |  ✓   |   ✓   |   ✓   |     ✓      |
| Open Staff Workload and manage department capacity/assignments         |      | Head  |       |            |
| View own account and change own password                               |  ✓   |   ✓   |   ✓   |     ✓      |
| View client directory, details, requests and projects (`clients:read`) |      |       |   ✓   |     ✓      |
| Create Client accounts (`clients:create`, with directory read access)  |      |       |   ✓   |     ✓      |
| View own activated projects and shared deliverables                    |  ✓   |       |       |            |
| Edit own project brief and request project changes                     |  ✓   |       |       |            |
| Request project cancellation with a reason                             |  ✓   |       |       |            |
| Approve or request revision on own shared deliverables                 |  ✓   |       |       |            |
| Review change requests for the assigned department's projects          |      | Head  |       |            |
| Review project cancellation requests for the assigned department       |      | Head  |       |            |
| Open Department Management page                                        |      |       |   ✓   |     ✓      |
| Use Employee Management and Service Management pages and APIs          |      |       |   ✓   |     ✓      |
| Use Account Management and its account APIs                            |      |       |       |     ✓      |
| View accounts (`accounts:read`)                                        |      |       |       |     ✓      |
| Change other accounts' passwords (`accounts:reset-password`)           |      |       |       |     ✓      |
| Create User or Staff accounts (`accounts:create-basic`)                |      |       |       |     ✓      |
| Change User or Staff roles (`accounts:assign-basic`)                   |      |       |       |     ✓      |
| Create Admin or Superadmin accounts (`accounts:create-privileged`)     |      |       |       |     ✓      |
| Change Admin or Superadmin roles (`accounts:assign-privileged`)        |      |       |       |     ✓      |
| Change User or Staff status (`accounts:status-basic`)                  |      |       |       |     ✓      |
| Change Admin or Superadmin status (`accounts:status-privileged`)       |      |       |       |     ✓      |
| Delete inactive accounts                                               |      |       |       |     ✓      |

Service Management is available to Admin and Superadmin accounts. Viewing the page and its API requires `services:read`; creating, editing, activating, and deactivating services requires `services:manage`. The `/api/services/available` endpoint is available to any authenticated account and returns only active services for new client-request forms.

Client Services (`/services`) and Service Requests (`/service-requests`) use the `/api/client/services` and `/api/client/service-requests` routes, restricted to authenticated `USER` accounts. Admin, Staff and Superadmin accounts cannot access these client routes; opening the request-history page redirects them to the dashboard. Clients can submit requests and read only their own history. Preferred specialists remain preferences for Department Manager review. See [Client Service Requests](features/client-service-requests.md).

Account Management and its API routes are restricted to Superadmin. Admins have no `accounts:*` permissions; their operational permissions do not grant account-management operations. Superadmin inherits Admin's operational permissions, including `clients:read`, alongside `accounts:*`. A Superadmin may assign any role. No one may change their own role through the account API. The API reads the user's current role from the database on each authenticated request, so a role change affects subsequent requests without changing session tokens.

Account Management supports deactivation, reactivation and deletion of inactive accounts. `accounts:status-basic` applies to User and Staff accounts; `accounts:status-privileged` applies to Admin and Superadmin accounts. Currently, only Superadmin receives these permissions. No one may change their own role or status, or delete their own account.

Superadmins can select **Change password** from another account's Actions menu, including inactive accounts. `POST /api/users/:id/password` requires `accounts:reset-password` and accepts `{ "newPassword": "..." }`. The new password must contain at least 12 characters, including uppercase, lowercase, a number and a special character, and be no more than 1,024 UTF-8 bytes. The current password is not required. A successful change returns `204`, hashes the new password and revokes all sessions for the selected account in one transaction. The Superadmin remains signed in; the target's role and active status are preserved. Self-targeted changes are rejected with `403`; missing or trashed accounts return `404`. The existing `POST /api/auth/change-password` endpoint remains the separate authenticated self-service operation requiring the current password.

`PATCH /api/users/:id/status` accepts `{ "isActive": false }` to deactivate or `{ "isActive": true }` to reactivate and returns `{ "user": ... }`. Deactivation preserves the account and department/team assignments, revokes all its sessions, and blocks login and authenticated requests. Reactivated accounts must sign in again. Account responses include `isActive`; new and existing accounts default to active. Apply the `20261026090000_account_status` migration before deploying these changes with `pnpm --filter @nexus/api exec prisma migrate deploy`.

### Calendar

All active portal roles may open `/calendar`. Clients receive only their own calendar events. Staff default to assigned work and their department-head appointments, with a team scope available to current heads and eligible project/team leads within existing project access. Admin and Superadmin receive read-only organization schedule metadata and filters; this does not grant access to staff workspaces, booking conversations, or scheduling mutations. The API rechecks current role and assignments for each calendar request. See [Role-aware calendar](features/calendar.md).

### Project Workspace

- The current Department Head can view active and archived projects for their department. Other active STAFF accounts can view and update work-plan tasks only in project workspaces where they are assigned through the project team.
- Only the current Department Head for a project's department can set up or rename its workspace, cancel active projects, and approve staff assignments. Cancelled and completed projects appear in the Archive view and are excluded from active workload totals. Assignment continues through the existing STAFF_PROJECT workflow action.
- Clients retain their existing project view; the internal workspace is unavailable to USER, ADMIN, and SUPERADMIN accounts.
- Only active staff assigned to a workstream can upload or remove its deliverable attachment. The Department Head can edit deliverable requirements, approve or reject submissions (a rejection reason is required), and send approved files to the client. Submitted files remain staff-only until sent; clients can access files after that action.

### Project conversations

- Started projects automatically provide a chat for the owning client and currently assigned active staff. A single assigned staff member shares a chat with the client; multiple assigned staff members share a group chat with the client. Project staffing determines membership, including when members belong to an assigned team. Membership changes take effect immediately; being a Department Head or administrator alone does not grant access to these chats.
- Project chats share the Messages conversation list with client booking chats, ordered by recent activity, and link from client project details and assigned staff workspaces. They use the existing message panel and conversation row design, support paginated history, message retry IDs, participant names, and per-account unread counts. Completed project chats appear in the list's Archive view.
- Completing or cancelling a project automatically moves its conversation to **Archive** and prevents sending while retaining readable history for authorized participants. An on-hold project retains its chat. Archiving follows the project status rather than an individual task checkbox, so completing one task does not close the team's project conversation.
- `/api/project-conversations` checks the owning client or current staff assignment for every list, history, read, and send request. Booking conversations between clients and Department Heads remain separate.
- Assigned staff can submit a file and optional note to an existing deliverable from project chat, using the workspace upload endpoint and the same file validation. The workspace submission and staff-only chat card commit atomically. Retry upload IDs do not create duplicate files or cards. Private submission cards are excluded from client history, previews, cursors, and unread counts.
- Department Heads retain deliverable review and client-sharing permissions. Sharing an approved deliverable publishes a separate client-visible card linking to the existing deliverable. Clients cannot submit work through the staff tool. Archived projects reject new submissions; existing delivery cards remain readable.

## Guest service inquiry permissions

ADMIN and SUPERADMIN receive service-inquiries:read and service-inquiries:manage. STAFF and USER receive neither. The API enforces these permissions on authenticated, current active accounts; portal visibility mirrors the grants. Read permission exposes visitor contact details and messages in the administrative inbox; manage permission allows status and internal-note review with optimistic version checks.

Public service discovery and guest inquiry submission require no account. Public service data is explicitly projected and private pricing, organization/employee records, and management metadata are omitted. Inquiry review does not grant booking ownership or access to operational conversations. See [public Services and inquiries](features/public-services-inquiries.md).

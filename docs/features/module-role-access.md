# Role access by module

Developed: 2026-11-14

This document describes module access after [Phase 2B registration](superadmin-module-registration.md). Superadmin receives all registered, implemented modules through administrative capability. Roles are fixed: `SUPERADMIN`, `ADMIN`, `STAFF`, and `USER` (Client). A Department Head is a current assignment on a Staff account, not a separate role.

## Module access matrix

The table assumes an active account with its role's normal API permissions. “Placeholder” means a visible card with no destination or finance functionality.

| Module                  | Client (`USER`)                              | Staff                       | Department Head (`STAFF`)                     | Admin                                           | Superadmin                                                |
| ----------------------- | -------------------------------------------- | --------------------------- | --------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------- |
| Service Operations      | Own services and requests, direct navigation | No                          | Department Request Inbox                      | Services and client management                  | Services, clients, global requests and workload oversight |
| Project Management      | Own projects, direct navigation              | Assigned project workspaces | Department projects and workload              | No                                              | Safe administrative entry                                 |
| People & HR             | No                                           | No management module        | No management module                          | Employee and department management              | Employee and department management                        |
| Attendance & Monitoring | No                                           | Personal attendance         | Personal attendance and department monitoring | Organization management and personal attendance | Organization management                                   |
| Administration          | No                                           | No                          | No                                            | No                                              | Account management                                        |
| Billing & Finance       | No selector card                             | Placeholder                 | Placeholder                                   | Placeholder                                     | Placeholder                                               |

Superadmin access to operational modules does not override Staff assignment checks for project workspaces, Request Inbox, Staff Workload, or private conversations.

## Selector and entry routes

Internal users land on `/module`. Clients land on `/dashboard` and navigate directly to their services and projects without choosing a workspace.

| Module                  | Eligible selector users                              | Entry route                                                              |
| ----------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| Service Operations      | Admin, Superadmin                                    | `/services`; `/clients` if only client-directory permission is available |
| Service Operations      | Current Staff Department Head                        | `/request-inbox`                                                         |
| Project Management      | Staff, including Department Heads                    | `/project-workspace`                                                     |
| Project Management      | Superadmin                                           | `/module/project-management`                                             |
| People & HR             | Admin, Superadmin                                    | `/employees`; `/departments` if only department permission is available  |
| Attendance & Monitoring | Ordinary Staff                                       | `/attendance/check-ins`                                                  |
| Attendance & Monitoring | Department Head, Admin                               | `/attendance/overview`                                                   |
| Attendance & Monitoring | Superadmin                                           | `/attendance/dashboard`                                                  |
| Administration          | Superadmin                                           | `/accounts`                                                              |
| Billing & Finance       | Internal users with at least one available workspace | No route; placeholder                                                    |

Cards are derived from effective permissions and current assignments. Accounts without any available workspace see the empty state. Billing & Finance uses the shared radial-fill and typing animations to show “Coming Soon” on hover or keyboard focus; it grants no finance access.

Module selection displays five or fewer cards in a single row, centered when they fit and horizontally scrollable when needed. More than five cards use a carousel. Each module appears once, and carousel navigation stops at either end without looping.

## Permissions and scope

### Service Operations

- Admin and Superadmin require `services:read` to view service management and `services:manage` for service mutations.
- Client Management requires `clients:read`. Both management roles can read the directory; creation additionally requires `clients:create`, granted to Admin and Superadmin. Client update and delete endpoints retain their Superadmin-only guard. Linked records can prevent deletion.
- Clients use the separate `USER`-only service catalog, request submission, and request history endpoints. Ownership is derived from the session.
- Request Inbox requires a current active Staff Department Head assignment and is limited to the assigned department. Admin and Superadmin have no override.
- Superadmin additionally uses [Phase 3B.1 administrative request inspection](superadmin-service-request-visibility.md) at `/module/service-operations`, reached through **Service Requests**. The separate API requires module access and organization read capabilities and grants no head responsibilities, workflow mutations, private conversations or downloads.
- [Phase 3B.3A workflow oversight](superadmin-workflow-oversight.md) extends those request details with stages, requirement/quotation/approval/payment statuses, staffing/activation metadata, pending-step guidance and sanitized history. It grants no operational participation or financial decision authority.
- **Staff Workload** at `/module/service-operations/workload` provides [Phase 3B.2 organization-wide oversight](superadmin-workload-oversight.md) through the same administrative capabilities. Department/employee/availability filters and read-only details reuse existing workload calculations. Capacity and staffing mutations remain Department Head responsibilities on the separate operational route.

### Project Management

- Staff contributors access assigned workspaces. Current Department Heads manage projects in their department and have access to department workload.
- Clients access their own activated projects and explicitly shared deliverables.
- Admin does not receive the Project Management module. Superadmin uses [organization-wide project inspection](superadmin-project-visibility.md) without Staff membership and may [rename eligible workspaces](superadmin-project-management.md). Other administrative mutations remain deferred. Neither module entry nor inspection grants project participation or private project chat access.

### People & HR

- Admin and Superadmin use `employees:read` / `employees:manage` and `departments:read` / `departments:manage` / `departments:delete` for their respective operations.
- Staff retain limited department API access through `departments:read`; this does not grant the People & HR management pages.
- HR records and login accounts have separate lifecycles. Superadmin accounts are not automatically assigned Employee records.
- [Phase 3C.2](superadmin-people-hr-administration.md) verifies existing organization-wide employee, department and team administration without operational identity. Employee mutation controls follow effective feature permissions and target eligibility; Admin credentials remain in Account Management. Existing Staff department API scope is preserved.

### Attendance & Monitoring

- Staff and Admin personal clock actions require a linked Employee record, with applicable status and policy rules.
- Department Heads monitor their current department. Admin and Superadmin use `employees:read` for organization monitoring and `employees:manage` for policy configuration.
- Reviewers cannot approve their own requests. Department Head verification and HR approval retain their workflow checks.
- Superadmin enters the existing management dashboard and can access other employees' history. Its personal overview/check-in routes and personal Attendance navigation group are unavailable; the personal attendance API continues to restrict self-service to Staff and Admin.
- [Phase 3C.1](superadmin-attendance-administration.md) verifies organization-wide check-ins, time logs, corrections, overtime, policies and assignments without an Employee record. Superadmin request screens expose organization scope only; submission and personal toggles are hidden. Review controls use backend per-request capabilities, preserving existing HR authority, Head verification and self-review restrictions.

### Administration

- Account management and `accounts:*` permissions remain exclusive to Superadmin.
- Only Superadmin may reset another account's password.
- No account may change its own role or active status, or delete itself.
- Operational client and employee provisioning does not grant access to the Administration account-management API.

### Billing & Finance

The module is a placeholder only. Existing client Billing Logs at `/billing-logs` remain `USER`-only, and existing quotation/payment workflows keep their own authorization. The placeholder does not change either.

## Shared pages and enforcement

Calendar, Messages, Profile, and Settings are shared pages. Calendar and messaging data retain their own role, ownership, and assignment checks. Internal shared pages retain the selected workspace's navigation context; switching workspaces clears the remembered context. Clients use their direct navigation.

[Phase 3D.1](superadmin-messaging-oversight.md) adds `/messages/oversight` for organization-wide service/project conversation metadata, requiring organization-read and business-conversation inspection capabilities. This shared route preserves workspace context and grants no message, attachment, private DM, read receipt or participant action access. Existing internal direct chats remain available only to their participants.

The API assigns effective permissions from the current database role on authenticated requests. Frontend guards and card visibility reflect those permissions; the API independently authorizes operations. Browser token storage remains in `sessionStorage`, and web requests use the same-origin `/api` proxy.

## Implementation references

- [Central module registry](../../apps/api/src/features/modules/module-registry.json)
- [Administrative module entry API](../../apps/api/src/features/modules/modules.controller.ts)
- [API role permissions](../../apps/api/src/features/auth/auth.permissions.ts)
- [Frontend access helpers](../../apps/web/src/features/auth/model/permissions.ts)
- [Selector module entries](../../apps/web/src/features/dashboard/model/workspace-modules.ts)
- [Route and navigation policies](../../apps/web/src/features/workspaces/model/route-policy.ts)
- [General RBAC guide](../rbac.md)

## Validation

The access change was verified with web unit tests and offline PGlite API authorization, employee, and attendance regressions. Documentation updates also run the workspace format, lint, and typecheck quality gate.

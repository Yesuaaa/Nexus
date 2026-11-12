# Modular Workspace Characterization

Developed: 2026-11-13

This document records the Phase 0 baseline for the modular workspace roadmap. It does not introduce a workspace selector, module navigation, route changes, API changes, or database changes. The current `/dashboard` remains the post-login destination and remains functionally unchanged during this phase.

## Current portal access matrix

Frontend navigation and route guards use the account role, effective permissions returned by the API, and the current `headOf` assignment. Backend authorization remains authoritative for every protected operation.

| Page or route group                                     | Client (`USER`) | Staff | Department head (`STAFF`) | Admin  | Superadmin |
| ------------------------------------------------------- | :-------------: | :---: | :-----------------------: | :----: | :--------: |
| `/dashboard`, `/profile`, `/settings`                   |       Yes       |  Yes  |            Yes            |  Yes   |    Yes     |
| `/messages`                                             |       Yes       |  Yes  |            Yes            |  Yes   |    Yes     |
| `/calendar`                                             |       Yes       |  Yes  |            Yes            |  Yes   |    Yes     |
| `/services`                                             | Client catalog  |       |                           | Manage |            |
| `/service-requests`, legacy `/booked-services`, `/help` |       Yes       |       |                           |        |            |
| `/billing-logs`                                         |       Yes       |       |                           |        |            |
| `/request-inbox`, `/staff-workload`                     |                 |       |            Yes            |        |            |
| `/project-workspace`, `/project-workspace/[id]`         |                 |  Yes  |            Yes            |        |            |
| `/projects`, `/projects/[id]`                           |       Yes       |  Yes  |            Yes            |        |            |
| `/projects/[id]/deliverables/[milestoneId]`             |       Yes       |  Yes  |            Yes            |        |            |
| `/clients`                                              |                 |       |                           |  Yes   |            |
| `/departments`, `/employees`                            |                 |       |                           |  Yes   |            |
| `/accounts`                                             |                 |       |                           |        |    Yes     |

The table describes current frontend behavior. It does not broaden access and must not be treated as a replacement for API authorization.

## Approved module ownership baseline

The module names and entry routes below are planning inputs for later phases. They are not implemented in Phase 0.

| Module             | Current pages and workflows                                                                                                    | Characterized entry route                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Service Operations | Services, client request history, legacy booked services, request inbox, client management, help, and service-request workflow | Client/Admin: `/services`; department head: `/request-inbox` |
| Project Management | Client projects, staff project workspace, project deliverables, project chat, and staff workload                               | Client: `/projects`; Staff: `/project-workspace`             |
| People & HR        | Department and employee management                                                                                             | Admin: `/employees`                                          |
| Administration     | Account management                                                                                                             | Superadmin: `/accounts`                                      |
| Shared platform    | Dashboard, Messages, Calendar, Profile, Settings, notifications, authentication, breadcrumbs, and the common portal shell      | Existing shared routes                                       |
| Finance & Billing  | Client billing logs plus embedded quotation approval and payment verification                                                  | Deferred; no module entry route                              |
| Scheduling         | Role-aware calendar, consultations, meetings, dated project work, deliverable events, and workload capacity                    | Deferred; no module entry route                              |

Characterized module availability is:

- Client: Service Operations and Project Management.
- Staff: Project Management; current department heads also have Service Operations.
- Admin: Service Operations and People & HR.
- Superadmin: Administration.

Calendar, Messages, Profile, and Settings remain shared. Billing Logs remain reachable for clients without creating a Finance & Billing module.

## Intentional compatibility routes and irregularities

Phase 0 freezes these behaviors so later phases must address them explicitly rather than changing them accidentally:

- `/booked-services` remains a client-only compatibility route without a separate sidebar entry.
- The `/projects` guard admits both Client and Staff, but the sidebar exposes **My Projects** only to Client and the route renders `ClientProjectsPage` for both roles.
- `/projects/[id]` selects the client or staff project page based on role.
- `/projects/[id]/deliverables/[milestoneId]` is admitted for both Client and Staff by the `/projects` guard but always renders `ClientDeliverablePage`.
- `/project-workspace/new` redirects to `/project-workspace`.
- `features/project-workspace/pages/new-workspace-page.tsx` currently exports an unreferenced dialog.
- `features/status` contains an unrouted starter diagnostic page.

## Regression-sensitive dependencies

- Successful login, registration, and authenticated root navigation all resolve to `/dashboard`.
- `PortalLayout`, `Sidebar`, and frontend permission helpers currently express overlapping access rules.
- Request conversations combine client service conversations, project chat, and internal chat on `/messages`.
- Calendar combines service meetings, project tasks, and shared deliverables.
- Staff Workload reads employee capacity while changing project staffing.
- Service requests connect request workflow, billing, conversations, and project activation in the shared Prisma schema.
- Department-head access is dynamic and must be recalculated from the current account and rechecked by the API.

## Phase 0 test coverage

- `workspace-access-characterization.test.mjs` locks the effective frontend access matrix for Client, Staff, current department head, Admin, and Superadmin accounts.
- `project-pages-regression.spec.ts` confirms the current Staff behavior on `/projects` and the client deliverable route before later route-policy work.
- Existing management, request inbox, workload, portal, authentication, and role regression suites continue to cover route denial, permission removal, and current-head enforcement.

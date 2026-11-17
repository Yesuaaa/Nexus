# Converyn — Phase 7.5-N1 New Page Discovery and Regression Coverage Impact Assessment

## Document Control

| Field                          | Value                                                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Project                        | Converyn (formerly Nexus)                                                                                              |
| Phase                          | 7.5-N1 — New Page Discovery and Regression Coverage Impact Audit                                                       |
| Report date                    | 2026-11-16                                                                                                             |
| Repository branch              | `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages`                     |
| HEAD commit                    | `86c976db66e4b321a9667d79f0068b2b17c7d499`                                                                             |
| Investigation type             | Read-only source, Git history, documentation, and regression inventory audit                                           |
| Verification scope             | App Router pages, navigation, route policies, feature/API source, Prisma models, existing regression specs and reports |
| Report status                  | AUDIT PARTIALLY COMPLETE — ADDITIONAL CONTRACT VERIFICATION REQUIRED                                                   |
| Administrative approval status | AWAITING ADMINISTRATIVE REVIEW; proposed page IDs are not approved                                                     |
| Runtime status                 | NOT EXECUTED                                                                                                           |

## 1. Executive Summary

The current App Router contains **54 page entry files**. The accepted 23 historical page groups are all still represented. The additional routes comprise **three proposed independent page groups**, **18 functional subpages**, one administrative workload route variant, one dynamic administrative module-entry route, one workforce login variant, five Attendance aliases, one unsupported workspace-creation redirect, and the root role/session dispatcher.

The proposed independent groups are Workforce Compliance/Attendance, Administrative Project Management, and the Workspace Selector. Proposed Page IDs 24–26 are **PROPOSED — AWAITING ADMINISTRATIVE APPROVAL**. The 18 subpages are: 11 Attendance pages below its root, two Project Management pages, three People & HR/Services overview pages, Business Conversation Oversight, and Project Workspace overview.

Seven historical page groups have an identifiable navigation, route-context, or shared-component impact: Pages 03, 06, 07, 08, 12, 14, and 16. This count describes route and feature impact in this audit, not a complete source-file diff since the historical baseline.

Existing browser and API coverage is substantial. Direct E2E coverage for `/services/overview` was not found; some dynamic module-entry destinations render a generic fallback; and Attendance approval stages and several route contracts still require explicit disposition. Browser test files mostly use mocked API responses. No tests or runtime checks were executed for this audit.

**Final classification: NEW PAGES IDENTIFIED — ADDITIONAL CONTRACT VERIFICATION REQUIRED.**

## 2. Repository and Git State

| Check                              | Result                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Repository root                    | `C:/Users/ADMIN/Documents/Thesis/Nexus`                                                                                              |
| Branch                             | `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages`                                   |
| HEAD                               | `86c976db66e4b321a9667d79f0068b2b17c7d499` — `docs: add phase 7.5.1 historical preservation and documentation reconciliation report` |
| Previous handoff revision          | `c42eb25ccac3a1aadcc97d5a0a8c136b991dbc68`, an ancestor of HEAD                                                                      |
| Known development merge            | `461b4466e6a00662f5bc4daa3745380e989204a9`, an ancestor of HEAD                                                                      |
| Working tree before this report    | Clean; no staged, modified, or untracked files                                                                                       |
| Target report before this task     | Absent                                                                                                                               |
| Phase 7.5.1 report                 | Present and tracked in the current checkout                                                                                          |
| Locally known `origin/development` | `02c2a8a0a6080659bc4e0a9996eb92a6d2ea3423`                                                                                           |
| Remote freshness                   | UNVERIFIED; no fetch was performed                                                                                                   |

The local current branch and `origin/development` diverge from common base `461b4466e6a00662f5bc4daa3745380e989204a9`; `git rev-list --left-right --count HEAD...origin/development` returned `2 1`. This is local ref information and does not establish whether the hosted branch has advanced since the last fetch.

Applicable instructions were read from [`AGENTS.md`](../../../../AGENTS.md) and [`apps/web/AGENTS.md`](../../../../apps/web/AGENTS.md). The only authorized repository change for this instruction is this report.

## 3. Historical 23-Page Baseline

The accepted page groups remain numbered as follows. All 23 corresponding Page 7 audit reports exist, and all 23 historical route patterns are present in the current route tree.

| Page | Historical page group      | Baseline route                              | Current presence                              |
| ---- | -------------------------- | ------------------------------------------- | --------------------------------------------- |
| 01   | Login                      | `/login`                                    | Present                                       |
| 02   | Registration               | `/register`                                 | Present                                       |
| 03   | Dashboard                  | `/dashboard`                                | Present; internal roles dispatch to `/module` |
| 04   | Account Management         | `/accounts`                                 | Present                                       |
| 05   | Client Management          | `/clients`                                  | Present                                       |
| 06   | Employee Management        | `/employees`                                | Present; new overview subpage                 |
| 07   | Department Management      | `/departments`                              | Present; new overview subpage                 |
| 08   | Services                   | `/services`                                 | Present; new overview subpage                 |
| 09   | Service Requests           | `/service-requests`                         | Present                                       |
| 10   | Request Inbox              | `/request-inbox`                            | Present                                       |
| 11   | Booked Services            | `/booked-services`                          | Present                                       |
| 12   | Messages                   | `/messages`                                 | Present; new oversight subpage                |
| 13   | Project Details            | `/projects/[id]`                            | Present                                       |
| 14   | Project Workspace          | `/project-workspace`                        | Present; new overview subpage                 |
| 15   | Project Workspace Details  | `/project-workspace/[id]`                   | Present                                       |
| 16   | Staff Workload             | `/staff-workload`                           | Present; new administrative route variant     |
| 17   | Profile                    | `/profile`                                  | Present                                       |
| 18   | Settings                   | `/settings`                                 | Present                                       |
| 19   | Billing Logs               | `/billing-logs`                             | Present                                       |
| 20   | Calendar                   | `/calendar`                                 | Present                                       |
| 21   | Help                       | `/help`                                     | Present                                       |
| 22   | My Projects                | `/projects`                                 | Present                                       |
| 23   | Client Deliverable Details | `/projects/[id]/deliverables/[milestoneId]` | Present                                       |

Page 23’s authoritative route is confirmed in the [Page 23 audit](page-by-page/page-23-client-deliverable-details.md). The historical preservation baseline remains 292 identities, 1,630 assertion sites, and 4,211 ownership mappings. PW-149, 52 assertion sites, and the four approval-pending R1 equivalences remain unresolved; see the [Phase 7.5.1 preservation report](phase7.5.1-historical-preservation-reconciliation.md).

## 4. Current Application Route Inventory

The inventory below covers all 54 current `page.*` route entry files. Route groups `(auth)` and `(portal)` are omitted from public URLs. `not-found.tsx` is a framework fallback, not a `page.*` route. API route handlers are not UI pages.

Role abbreviations: `CL` = USER/client; `ST` = STAFF; `AD` = ADMIN; `SA` = SUPERADMIN; `Head ST` = STAFF with a current department-head assignment. “Capability” means access also depends on the listed feature permission and authenticated account state. Actual role rules are defined in [`roles.ts`](../../../../apps/web/src/features/auth/model/roles.ts) and [`permissions.ts`](../../../../apps/web/src/features/auth/model/permissions.ts); route matching is in [`route-policy.ts`](../../../../apps/web/src/features/workspaces/model/route-policy.ts).

### Table A — Complete Route Inventory

| Route                                                     | Page / Module                     | Existing or New | Classification                                      | Authorized Roles                                                          | Source File                                                                                 |
| --------------------------------------------------------- | --------------------------------- | --------------- | --------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `/`                                                       | Home entry                        | New             | G — session/role dispatcher                         | Public entry; destination depends on session and role                     | `apps/web/src/app/page.tsx`                                                                 |
| `/accounts`                                               | Account Management                | Existing        | A — baseline Page 04                                | SA                                                                        | `apps/web/src/app/(portal)/accounts/page.tsx`                                               |
| `/attendance`                                             | Workforce Compliance              | New             | B — proposed Page 24 root                           | Active ST, AD, SA with employee-read capability                           | `apps/web/src/app/(portal)/attendance/page.tsx`                                             |
| `/attendance/adjustments`                                 | Attendance                        | New             | C — subpage                                         | Active ST, AD, SA with employee-read capability                           | `apps/web/src/app/(portal)/attendance/adjustments/page.tsx`                                 |
| `/attendance/audit`                                       | Attendance Audit                  | New             | C — subpage                                         | Head ST, AD, SA with employee-read capability                             | `apps/web/src/app/(portal)/attendance/audit/page.tsx`                                       |
| `/attendance/check-ins`                                   | Personal Attendance               | New             | C — subpage                                         | Active ST, AD                                                             | `apps/web/src/app/(portal)/attendance/check-ins/page.tsx`                                   |
| `/attendance/my`                                          | Personal Attendance               | New             | G — alias to check-ins                              | Active ST, AD                                                             | `apps/web/src/app/(portal)/attendance/my/page.tsx`                                          |
| `/attendance/overview`                                    | Personal Attendance               | New             | C — subpage                                         | Active ST, AD                                                             | `apps/web/src/app/(portal)/attendance/overview/page.tsx`                                    |
| `/attendance/policies/assignments`                        | Attendance Policies               | New             | G — alias to policy management                      | AD, SA with employee-manage capability                                    | `apps/web/src/app/(portal)/attendance/policies/assignments/page.tsx`                        |
| `/attendance/policies/management`                         | Attendance Policies               | New             | C — subpage                                         | AD, SA with employee-manage capability                                    | `apps/web/src/app/(portal)/attendance/policies/management/page.tsx`                         |
| `/attendance/policies/overview`                           | Attendance Policies               | New             | C — subpage                                         | AD, SA with employee-manage capability                                    | `apps/web/src/app/(portal)/attendance/policies/overview/page.tsx`                           |
| `/attendance/records`                                     | Time Logs                         | New             | G — alias to time-log records                       | Head ST, AD, SA                                                           | `apps/web/src/app/(portal)/attendance/records/page.tsx`                                     |
| `/attendance/requests/corrections`                        | Attendance Requests               | New             | C — subpage                                         | ST, AD, SA; API scope applies                                             | `apps/web/src/app/(portal)/attendance/requests/corrections/page.tsx`                        |
| `/attendance/requests/overtime`                           | Attendance Requests               | New             | C — subpage                                         | ST, AD, SA; API scope applies                                             | `apps/web/src/app/(portal)/attendance/requests/overtime/page.tsx`                           |
| `/attendance/requests/overview`                           | Attendance Requests               | New             | C — subpage                                         | ST, AD, SA; API scope applies                                             | `apps/web/src/app/(portal)/attendance/requests/overview/page.tsx`                           |
| `/attendance/settings`                                    | Attendance Policies               | New             | G — alias to policy management                      | AD, SA with employee-manage capability                                    | `apps/web/src/app/(portal)/attendance/settings/page.tsx`                                    |
| `/attendance/time-logs/audit`                             | Attendance Audit                  | New             | G — alias to `/attendance/audit`                    | Head ST, AD, SA                                                           | `apps/web/src/app/(portal)/attendance/time-logs/audit/page.tsx`                             |
| `/attendance/time-logs/overview`                          | Time Logs                         | New             | C — subpage                                         | Head ST, AD, SA                                                           | `apps/web/src/app/(portal)/attendance/time-logs/overview/page.tsx`                          |
| `/attendance/time-logs/records`                           | Time Logs                         | New             | C — subpage                                         | Head ST, AD, SA                                                           | `apps/web/src/app/(portal)/attendance/time-logs/records/page.tsx`                           |
| `/billing-logs`                                           | Billing Logs                      | Existing        | A — baseline Page 19                                | CL                                                                        | `apps/web/src/app/(portal)/billing-logs/page.tsx`                                           |
| `/booked-services`                                        | Booked Services                   | Existing        | A — baseline Page 11                                | CL                                                                        | `apps/web/src/app/(portal)/booked-services/page.tsx`                                        |
| `/calendar`                                               | Calendar                          | Existing        | A — baseline Page 20                                | All authenticated roles                                                   | `apps/web/src/app/(portal)/calendar/page.tsx`                                               |
| `/clients`                                                | Client Management                 | Existing        | A — baseline Page 05                                | AD, SA with client-read capability                                        | `apps/web/src/app/(portal)/clients/page.tsx`                                                |
| `/dashboard`                                              | Dashboard                         | Existing        | A/F — baseline Page 03; role-specific home behavior | CL content; internal roles redirect to `/module`                          | `apps/web/src/app/(portal)/dashboard/page.tsx`                                              |
| `/departments`                                            | Department Management             | Existing        | A/D — baseline Page 07 with module transition       | AD, SA with department-read capability                                    | `apps/web/src/app/(portal)/departments/page.tsx`                                            |
| `/departments/overview`                                   | Department Overview               | New             | C — subpage of Page 07                              | AD, SA with department-read capability                                    | `apps/web/src/app/(portal)/departments/overview/page.tsx`                                   |
| `/employees`                                              | Employee Management               | Existing        | A/D — baseline Page 06 with module transition       | AD, SA with employee-read capability                                      | `apps/web/src/app/(portal)/employees/page.tsx`                                              |
| `/employees/overview`                                     | Employee Overview                 | New             | C — subpage of Page 06                              | AD, SA with employee-read capability                                      | `apps/web/src/app/(portal)/employees/overview/page.tsx`                                     |
| `/help`                                                   | Help                              | Existing        | A — baseline Page 21                                | CL                                                                        | `apps/web/src/app/(portal)/help/page.tsx`                                                   |
| `/internal/login`                                         | Workforce Login                   | New             | F — login variant                                   | Public login screen                                                       | `apps/web/src/app/(auth)/internal/login/page.tsx`                                           |
| `/login`                                                  | Client Login                      | Existing        | A — baseline Page 01                                | Public login screen                                                       | `apps/web/src/app/(auth)/login/page.tsx`                                                    |
| `/messages`                                               | Messages                          | Existing        | A/D — baseline Page 12 with oversight link          | All four roles; conversation scope applies                                | `apps/web/src/app/(portal)/messages/page.tsx`                                               |
| `/messages/oversight`                                     | Business Conversation Oversight   | New             | C/F — role-specific Page 12 subpage                 | SA with organization-read and conversation-inspect capabilities           | `apps/web/src/app/(portal)/messages/oversight/page.tsx`                                     |
| `/module`                                                 | Workspace Selector                | New             | B — proposed Page 26                                | ST, AD, SA; available cards are permission-dependent                      | `apps/web/src/app/(portal)/module/page.tsx`                                                 |
| `/module/[moduleId]`                                      | Administrative Module Entry       | New             | J — internal dynamic module entry                   | SA by default capability grants; implemented module IDs only              | `apps/web/src/app/(portal)/module/[moduleId]/page.tsx`                                      |
| `/module/service-operations/workload`                     | Administrative Workload           | New             | F — Page 16 route variant                           | SA by default module and organization-read capabilities                   | `apps/web/src/app/(portal)/module/service-operations/workload/page.tsx`                     |
| `/profile`                                                | Profile                           | Existing        | A — baseline Page 17                                | All authenticated roles                                                   | `apps/web/src/app/(portal)/profile/page.tsx`                                                |
| `/project-management`                                     | Administrative Project Management | New             | B — proposed Page 25 root                           | SA by default module, organization-read, and department-read capabilities | `apps/web/src/app/(portal)/project-management/page.tsx`                                     |
| `/project-management/departments/[departmentId]/projects` | Department Project Directory      | New             | C — Page 25 subpage                                 | SA by default module, organization-read, and department-read capabilities | `apps/web/src/app/(portal)/project-management/departments/[departmentId]/projects/page.tsx` |
| `/project-management/overview`                            | Project Overview                  | New             | C — Page 25 subpage                                 | SA by default module and organization-read capabilities                   | `apps/web/src/app/(portal)/project-management/overview/page.tsx`                            |
| `/project-workspace`                                      | Project Workspace                 | Existing        | A/D — baseline Page 14 with overview navigation     | ST; API scope applies                                                     | `apps/web/src/app/(portal)/project-workspace/page.tsx`                                      |
| `/project-workspace/[id]`                                 | Project Workspace Details         | Existing        | A — baseline Page 15                                | ST; API scope applies                                                     | `apps/web/src/app/(portal)/project-workspace/[id]/page.tsx`                                 |
| `/project-workspace/new`                                  | Workspace Creation                | New             | G/H — unsupported route redirects to directory      | ST route then redirect                                                    | `apps/web/src/app/(portal)/project-workspace/new/page.tsx`                                  |
| `/project-workspace/overview`                             | Department Project Overview       | New             | C — subpage of Page 14                              | Head ST                                                                   | `apps/web/src/app/(portal)/project-workspace/overview/page.tsx`                             |
| `/projects`                                               | My Projects                       | Existing        | A — baseline Page 22                                | CL, ST route; API scope applies                                           | `apps/web/src/app/(portal)/projects/page.tsx`                                               |
| `/projects/[id]`                                          | Project Details                   | Existing        | A — baseline Page 13                                | CL, ST route; API scope applies                                           | `apps/web/src/app/(portal)/projects/[id]/page.tsx`                                          |
| `/projects/[id]/deliverables/[milestoneId]`               | Client Deliverable Details        | Existing        | A — baseline Page 23                                | CL, ST route; client visibility/ownership enforced by API                 | `apps/web/src/app/(portal)/projects/[id]/deliverables/[milestoneId]/page.tsx`               |
| `/register`                                               | Registration                      | Existing        | A — baseline Page 02                                | Public                                                                    | `apps/web/src/app/(auth)/register/page.tsx`                                                 |
| `/request-inbox`                                          | Request Inbox                     | Existing        | A — baseline Page 10                                | Head ST                                                                   | `apps/web/src/app/(portal)/request-inbox/page.tsx`                                          |
| `/service-requests`                                       | Service Requests                  | Existing        | A — baseline Page 09                                | CL                                                                        | `apps/web/src/app/(portal)/service-requests/page.tsx`                                       |
| `/services`                                               | Services                          | Existing        | A/D — baseline Page 08 with module transition       | CL catalog; AD/SA management                                              | `apps/web/src/app/(portal)/services/page.tsx`                                               |
| `/services/overview`                                      | Service Overview                  | New             | C — subpage of Page 08                              | AD, SA with service-read capability                                       | `apps/web/src/app/(portal)/services/overview/page.tsx`                                      |
| `/settings`                                               | Settings                          | Existing        | A — baseline Page 18                                | All authenticated roles                                                   | `apps/web/src/app/(portal)/settings/page.tsx`                                               |
| `/staff-workload`                                         | Staff Workload                    | Existing        | A — baseline Page 16                                | Head ST                                                                   | `apps/web/src/app/(portal)/staff-workload/page.tsx`                                         |

## 5. Newly Discovered Independent Pages

The following are the three proposed independent groups. Each is **PROPOSED — AWAITING ADMINISTRATIVE APPROVAL**; none is permanently numbered.

### Table B — New Page Inventory

| Proposed Page ID | Page Name                         | Route                                              | Introduction Commit                                                                                        | Functionality                                                            | Existing Coverage                                                                  | Priority |
| ---------------- | --------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | -------- |
| PROPOSED Page 24 | Workforce Compliance / Attendance | `/attendance` and functional `/attendance/*` pages | `7f8d40bd12c19d6ac258169d751c535008f65c93`; current audit route `6b7aa31f713876d213a06b4bfcad6f9314f979a0` | Personal attendance, requests, time logs, audit, policies, scoped review | Attendance browser specs and PGlite API suites; no current execution in this audit | P0/P1    |
| PROPOSED Page 25 | Administrative Project Management | `/project-management` and subroutes                | `23048b4707e9af360040294deee675ceeaf106d2`; department route `68944b4109903473abdd5c63b29f5f36c5e553b4`    | Organization overview and read-only department/project directories       | E2E module/workspace specs and PGlite API/authorization tests                      | P0/P1    |
| PROPOSED Page 26 | Workspace Selector                | `/module`                                          | `a262a85d5d7e7a28d3d61edb69117d327071acde`                                                                 | Capability-dependent workspace selection and role-specific navigation    | Workspace selector, module access, route-policy, and module-registry coverage      | P0/P2    |

The dynamic `/module/[moduleId]` entry route and `/module/service-operations/workload` are variants/infrastructure associated with these modules, not additional independent groups. The former contains functional Project Management and Service Operations entry views, while some other registered module IDs show generic fallback content.

## 6. Newly Discovered Subpages

There are **18 functional subpages** under the three proposed groups or the historical groups:

- Attendance (11): `/attendance/adjustments`, `/attendance/audit`, `/attendance/check-ins`, `/attendance/overview`, `/attendance/policies/management`, `/attendance/policies/overview`, `/attendance/requests/corrections`, `/attendance/requests/overtime`, `/attendance/requests/overview`, `/attendance/time-logs/overview`, `/attendance/time-logs/records`.
- Administrative Project Management (2): `/project-management/overview`, `/project-management/departments/[departmentId]/projects`.
- Existing Pages 06–08 (3): `/employees/overview`, `/departments/overview`, `/services/overview`.
- Existing Page 12 (1): `/messages/oversight`.
- Existing Page 14 (1): `/project-workspace/overview`.

The workload route `/module/service-operations/workload` is recorded separately as a role-specific Page 16 route variant. `/internal/login` is a workforce login variant. `/module/[moduleId]` is a dynamic internal entry route.

## 7. Modified Existing Pages

Seven historical page groups have identifiable route, navigation, or shared-component impacts relevant to this discovery:

| Historical page                 | Current impact                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| Page 03 — Dashboard             | Internal-role home navigation dispatches to the module selector; clients retain Dashboard. |
| Page 06 — Employee Management   | New overview route and module transition.                                                  |
| Page 07 — Department Management | New overview route and module transition.                                                  |
| Page 08 — Services              | New overview route and module transition.                                                  |
| Page 12 — Messages              | Adds a capability-gated link to Business Conversation Oversight.                           |
| Page 14 — Project Workspace     | Adds a department-level project overview path and navigation.                              |
| Page 16 — Staff Workload        | Shared workload functionality is also mounted at a capability-gated administrative route.  |

This is a route/feature-impact count, not a claim that only seven source files changed since the Phase 7 page audits. Shared layouts and navigation also changed.

## 8. Route Renames, Redirects, and Removals

- **Historical Page 01–23 routes:** No baseline route rename, relocation, or removal was found.
- **Explicit aliases/redirects: six.** Five Attendance aliases redirect to canonical pages: `/attendance/my` → `/attendance/check-ins`; `/attendance/settings` → `/attendance/policies/management`; `/attendance/records` → `/attendance/time-logs/records`; `/attendance/policies/assignments` → `/attendance/policies/management`; `/attendance/time-logs/audit` → `/attendance/audit`. `/project-workspace/new` → `/project-workspace` because the creation wizard remains unsupported.
- **Root dispatcher:** `/` is an additional session/role-aware home dispatcher; it is not included in the six explicit aliases above.
- **Removed non-baseline route:** `/attendance/dashboard` was removed by `6b7aa31f713876d213a06b4bfcad6f9314f979a0`; `/attendance/audit` was added in that commit. The removed route was not part of the historical 23-page inventory.
- **Absent route:** `/forgot-password` remains absent, as documented in the [Page 01 audit](page-by-page/page-01-login.md). P01-DEF-01 remains a documented issue and is not present in the canonical defect register.

## 9. New Page Functionality Inventory

| Page/route                                 | Implemented functionality                                                                                                                                               | Partial, unsupported, or unverified behavior                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Attendance                                 | Clock actions, breaks, history, correction/overtime requests, scoped reviews, time logs, audit views, policy CRUD/archive/restore, assignments, filters and pagination. | Approval-stage contract remains unresolved; source/runtime behavior was not re-executed.           |
| Administrative Project Management          | Read-only project metrics and department/project directories; search, filters, sorting, pagination, project/workspace navigation.                                       | 403-versus-404 and scope disclosure contracts remain subject to existing review; no runtime check. |
| Workspace Selector                         | Lists permitted modules, role-sensitive destinations, responsive carousel/cards, safe empty state.                                                                      | `/module/[moduleId]` generic fallback for some registered modules needs disposition.               |
| People & HR and Services overview subpages | Department, employee, and service overview screens alongside the existing management pages.                                                                             | Direct E2E render/empty/error coverage for `/services/overview` was not found.                     |
| Business Conversation Oversight            | Read-only business conversation listing and detail inspection for service/project conversations.                                                                        | Live integration not verified.                                                                     |
| Project Workspace overview                 | Department-head project/task metrics and navigation into management views.                                                                                              | Workspace creation remains unsupported; no implication of a new wizard.                            |
| Administrative workload variant            | Workload view under the Service Operations module with organization-read capability.                                                                                    | Shared workload defects remain open and no new execution was performed.                            |

## 10. Authentication and Authorization Matrix

`Department Head` is a department assignment on a `STAFF` account (`headOf`), not a fifth role. Administrative module access is capability-based; the default permission map grants global module, organization-read, and business-conversation inspection capabilities to SUPERADMIN. The client-facing project route admits STAFF at the frontend, but server-side project/deliverable scope still applies.

### Table D — Authorization Matrix

| Route                                                                                | USER                         | STAFF                                 | Department Head                            | ADMIN                                   | SUPERADMIN                                                                     |
| ------------------------------------------------------------------------------------ | ---------------------------- | ------------------------------------- | ------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------ |
| `/attendance/overview`, `/attendance/check-ins`, `/attendance/my`                    | DENIED                       | ALLOWED                               | ALLOWED                                    | ALLOWED                                 | DENIED                                                                         |
| `/attendance/requests/*`, `/attendance/adjustments`                                  | DENIED                       | CONDITIONAL — own records             | CONDITIONAL — department scope             | CONDITIONAL — administrative scope      | CONDITIONAL — oversight scope, not self-service                                |
| `/attendance/time-logs/*`, `/attendance/audit`, `/attendance/records`                | DENIED                       | DENIED unless head assignment         | ALLOWED within authorized department scope | ALLOWED with employee-read capability   | ALLOWED with employee-read capability                                          |
| `/attendance/policies/*`, `/attendance/settings`, `/attendance/policies/assignments` | DENIED                       | DENIED                                | DENIED                                     | ALLOWED with employee-manage capability | ALLOWED with employee-manage capability                                        |
| `/project-management/*`                                                              | DENIED                       | DENIED                                | DENIED                                     | DENIED by default                       | ALLOWED with module, organization, and applicable department-read capabilities |
| `/module`                                                                            | DENIED                       | ALLOWED; cards depend on capabilities | ALLOWED; cards depend on capabilities      | ALLOWED; cards depend on capabilities   | ALLOWED                                                                        |
| `/module/[moduleId]`, `/module/service-operations/workload`                          | DENIED                       | DENIED by default                     | DENIED by default                          | DENIED by default                       | ALLOWED for implemented modules with required capabilities                     |
| `/messages/oversight`                                                                | DENIED                       | DENIED                                | DENIED                                     | DENIED by default                       | ALLOWED with organization-read and business-conversation-inspect capabilities  |
| `/departments/overview`, `/employees/overview`, `/services/overview`                 | DENIED                       | DENIED                                | DENIED                                     | ALLOWED with feature-read capability    | ALLOWED with feature-read capability                                           |
| `/project-workspace/overview`                                                        | DENIED                       | DENIED unless head assignment         | ALLOWED                                    | DENIED on this route                    | DENIED on this route                                                           |
| `/project-workspace`, `/project-workspace/[id]`                                      | DENIED                       | ALLOWED; API scope applies            | ALLOWED; API scope applies                 | DENIED on these routes                  | DENIED on these routes                                                         |
| `/messages`                                                                          | ALLOWED, conversation-scoped | ALLOWED, conversation-scoped          | ALLOWED, conversation-scoped               | ALLOWED, conversation-scoped            | ALLOWED, conversation-scoped                                                   |

UI visibility is not treated as authorization. Attendance, modules, project management, and conversation APIs apply backend authentication and feature-specific authorization/scope checks.

## 11. API and Database Dependencies

| Area                              | API dependencies                                                                                                                                                                                            | Database/persistence dependencies                                                                                                                               | Existing API coverage                                                                                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Attendance                        | `/api/attendance/*`: records, overview, policies, assignments, adjustments, audit, personal history, clock actions and breaks. Router requires authentication; service methods apply role and scope checks. | AttendancePolicy, AttendancePolicyAssignment, AttendanceWorkday, AttendanceWorkSession, AttendanceBreak, AttendanceAdjustment, AttendanceAudit, Employee, User. | PGlite suites under `apps/api/tests/features/attendance/` (foundation, backend, management, overtime, policy management, Superadmin, migration).                             |
| Administrative Project Management | `/api/project-management/overview`, department project directory endpoints, and `/api/project-workspace/*` reads.                                                                                           | Project, ProjectWorkspaceGroup, department relations, tasks, staffing/assignments, deliverables.                                                                | `project-management-overview.test.ts`, `admin-project-management-departments.test.ts`, workspace scope/details tests, administrative project-management authorization tests. |
| Workspace Selector/module entry   | Authenticated `/api/modules` and `/api/modules/:id`; module definitions also come from the static registry.                                                                                                 | Static registry; no selector persistence. Other module pages use their own feature data.                                                                        | Module access API tests and web route/module-registry tests.                                                                                                                 |
| Business Conversation Oversight   | `/api/administrative-conversations` list/detail reads with authorization checks.                                                                                                                            | Request/service and project conversation records and messages.                                                                                                  | `apps/api/tests/features/auth/administrative-conversations.test.ts`.                                                                                                         |
| People & HR / Services overview   | Existing department, employee, and service APIs.                                                                                                                                                            | Existing department, employee/user, and service records; overview screens are read-oriented.                                                                    | Existing feature API suites; route-specific persistence behavior was not separately established in this audit.                                                               |
| Workload                          | Existing `/api/workload` and administrative workload API paths.                                                                                                                                             | Workload, project allocations, department/head scope, attendance planning context.                                                                              | PGlite workload availability and administrative workload tests.                                                                                                              |

The [Attendance API router](../../../../apps/api/src/features/attendance/routes.ts), [module registry](../../../../apps/api/src/features/modules/module-registry.json), and [administrative conversation client](../../../../apps/web/src/features/request-conversations/api/administrative-conversations-api.ts) were inspected. No database was modified and no migration was run.

## 12. Existing Regression Coverage

| Page area                                               | Existing browser coverage                                                                                                                       | Existing API/unit coverage                                                                                                         |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Attendance                                              | `attendance.spec.ts`, `superadmin-attendance.spec.ts`, `attendance-policy-assignment.spec.ts`                                                   | PGlite attendance foundation/backend/management/overtime/policy-management/Superadmin/migration suites; web `attendance.test.mjs`  |
| Administrative Project Management                       | `module-scoped-navigation.spec.ts`, `superadmin-module-access.spec.ts`, `projects/project-workspace.spec.ts`, `administrative-projects.spec.ts` | Project overview, department directory, workspace scope/details, administrative authorization tests; web route-policy/module tests |
| Workspace Selector                                      | `workspace-selector.spec.ts`, `module-scoped-navigation.spec.ts`, `superadmin-module-access.spec.ts`                                            | `module-registry.test.mjs`, `route-policy.test.mjs`, `workspace-selection.test.mjs`, module access API tests                       |
| Business Conversation Oversight                         | `administrative-conversations.spec.ts`                                                                                                          | `administrative-conversations.test.ts`, `business-conversation-access.test.mjs`                                                    |
| Employee/Department overviews                           | Direct paths appear in `superadmin-people-hr.spec.ts`; staff navigation links in `auth/staff.spec.ts`                                           | Existing People & HR feature API suites                                                                                            |
| Services overview                                       | Staff navigation link assertion in `auth/staff.spec.ts`                                                                                         | Existing Services feature API suites; no direct route render evidence identified                                                   |
| Project Workspace overview and unsupported create route | `projects/project-workspace.spec.ts`, `projects/project-workspace-directory.spec.ts`                                                            | Project Workspace overview/directory PGlite suites                                                                                 |

Browser coverage is predominantly mocked and must not be described as live frontend/backend integration. Existing test files were inspected but not executed.

## 13. Missing Regression Coverage

### Table C — Regression Coverage Matrix

| Page                                                 | Functionality                                               | Browser Coverage                                                                   | API Coverage                                                                     | Missing Scenarios                                                                                               | Priority |
| ---------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| Attendance / proposed Page 24                        | Clock, breaks, requests, review, time logs, audit, policies | Broad mocked E2E coverage exists                                                   | Broad PGlite coverage exists                                                     | Preserve the role matrix and distinct verification/final approval states; re-execute after contract disposition | P0/P1    |
| Administrative Project Management / proposed Page 25 | Overview, read-only department/project directory            | Module and workspace E2E coverage exists                                           | Overview, directory, workspace scope and auth tests exist                        | Reconfirm department isolation, direct deep-link denial, and 403/404 contract                                   | P0       |
| Workspace Selector / proposed Page 26                | Module cards, role routing, empty state                     | Workspace/module E2E coverage exists                                               | Module access API tests exist                                                    | Define and cover direct entry behavior for registered modules with generic fallback content                     | P1/P2    |
| `/services/overview`                                 | Service overview page                                       | Navigation-link assertions only; no direct route render case found                 | Existing Services API coverage; route-specific overview contract not established | Direct rendering, empty/error recovery, responsive and accessible state                                         | P2       |
| `/employees/overview`, `/departments/overview`       | People & HR summaries                                       | Direct Superadmin navigation/render cases exist                                    | Existing feature API suites                                                      | Broader empty/error/role scope scenarios as needed                                                              | P2       |
| `/messages/oversight`                                | Read-only conversation search/list/detail                   | Dedicated mocked E2E coverage exists                                               | Dedicated authorization API coverage exists                                      | Retain foreign/private-thread denial and error/retry coverage; no live integration evidence                     | P0/P2    |
| Attendance aliases                                   | Canonical redirects with route guards                       | Some direct route checks plus unit coverage exist                                  | Not applicable beyond target API guards                                          | Confirm each legacy alias’s redirect and pre-redirect access behavior                                           | P2       |
| `/project-workspace/new`                             | Unsupported creation route                                  | Page 14 NEX-006 browser regression already verifies redirect and no wizard request | Workspace API tests do not make wizard browser support available                 | Keep unsupported status explicit; no successful wizard expectation                                              | P2       |

## 14. Historical Regression Preservation Impact

The original Page 01–23 inventory and immutable Phase 4 baseline remain intact. This audit changed no historical identity, assertion, ownership mapping, skip state, baseline artifact, or approved-delta ledger.

The newly found routes need additive ownership if new tests are later authorized. Existing tests for Pages 03, 06–08, 12, 14, and 16 remain the historical owners for their original behavior. New subpage/module scenarios should receive separate identities and must not replace historical assertions solely because navigation or implementation changed.

Known preservation issues remain PW-149, 52 unresolved assertion sites, and approval pending for PW-070, PW-273, PW-276, and PW-277. The historical counts are not a current successful preservation verification.

### Table E — Historical Preservation Impact

| Existing Page                        | New Functionality                                     | Historical Test IDs                                                | Existing Assertions                                | Recommended Action                                                                     |
| ------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Page 03 — Dashboard                  | Internal workspace selector/home dispatch             | Historical Page 03 identities remain owned by their existing specs | Unchanged by this audit                            | Preserve client dashboard assertions; add internal module routing additively           |
| Page 06 — Employee Management        | Employee overview route and module transition         | Existing Page 06 specs                                             | Unchanged by this audit                            | Keep management assertions and add overview cases separately                           |
| Page 07 — Department Management      | Department overview route and module transition       | Existing Page 07 specs                                             | Unchanged by this audit                            | Keep department CRUD/member assertions; add overview cases separately                  |
| Page 08 — Services                   | Service overview route and module transition          | Existing Page 08 specs                                             | Unchanged by this audit                            | Preserve pricing, filtering, and mobile menu regressions; add direct overview coverage |
| Page 12 — Messages                   | Business Conversation Oversight link/subpage          | Existing Page 12 identities                                        | Unchanged by this audit; APP-CONV-001 remains open | Preserve conversation/archive assertions; isolate oversight tests additively           |
| Page 14 — Project Workspace          | Department overview; unsupported `/new` alias remains | Existing Page 14 identities and NEX-006                            | Unchanged by this audit                            | Retain the unsupported redirect expectation; do not invent wizard success behavior     |
| Page 16 — Staff Workload             | Administrative workload route variant                 | Existing Page 16 identities                                        | Unchanged by this audit; S16-001 remains open      | Keep department-head workload tests distinct from administrative route coverage        |
| Page 23 — Client Deliverable Details | No new Page 23 route; route reconfirmed               | Existing Page 23 identities                                        | Unchanged by this audit; P23-001 remains open      | Preserve client visibility, ownership, and failed-download assertions                  |

## 15. Existing Defects and Contract Dependencies

The current defect register and historical reports retain the following relevant findings:

- **P01-DEF-01:** `/forgot-password` is missing and is absent from the canonical defect register.
- **Attendance contract:** Department Head verification and HR approval are distinct. Do not equate `VERIFIED` and `APPROVED`. The Phase 7.5.1 report records an attendance assertion discrepancy; the status contract requires disposition.
- **Project/Workspace:** APP-TABLE-001, P13-001, P13-003, S15-001, and S15-002 remain open. New aggregate or directory pages do not establish fixes to old project list, navigation, notification, loading, or task-limit findings.
- **Workload:** S16-001 remains open. The administrative workload route uses shared workload functionality; the alternate route does not establish a fix.
- **Services:** SVC-001/API-PRICE-001, SVC-002, and APP-MENU-001 remain open. The overview route does not disposition pricing, pagination, or mobile menu defects.
- **Messages:** APP-CONV-001 remains open for the implicated archive/search interaction. The administrative oversight page uses a separate read-only viewer in inspected source; that does not resolve the existing defect.
- **Project Workspace creation:** NEX-006 remains unsupported; the `/new` route is a redirect, not an implemented wizard.
- **Canonical defect-register discrepancy:** The current register still labels API-TEST-001 open despite the prior handoff’s reported correction and passing later verification. Preserve the historical record and reconcile status separately.
- **Other unresolved contracts:** Project Management 403-versus-404 behavior, staff frontend route versus API scope, attendance review stages, and request archive/contract limitations remain unresolved where documented.

See the [Phase 7.5 defect register](phase7.5-defect-register.md), [Page 01 audit](page-by-page/page-01-login.md), [Page 14 audit](page-by-page/page-14-project-workspace.md), [Page 16 audit](page-by-page/page-16-staff-workload.md), and [Phase 7.5.1 reconciliation](phase7.5.1-historical-preservation-reconciliation.md). No finding was reclassified as fixed in this audit.

## 16. Proposed Expanded Page Inventory

The accepted Page 01–23 identifiers remain unchanged. The proposal is 26 groups total only if all three new independent groups are approved:

| Proposed ID | Proposed page group               | Included routes                                  | Status                                      |
| ----------- | --------------------------------- | ------------------------------------------------ | ------------------------------------------- |
| Pages 01–23 | Existing accepted groups          | As listed in Section 3                           | Existing identifiers retained               |
| Page 24     | Workforce Compliance / Attendance | `/attendance` and functional Attendance subpages | PROPOSED — AWAITING ADMINISTRATIVE APPROVAL |
| Page 25     | Administrative Project Management | `/project-management` and its subpages           | PROPOSED — AWAITING ADMINISTRATIVE APPROVAL |
| Page 26     | Workspace Selector                | `/module`                                        | PROPOSED — AWAITING ADMINISTRATIVE APPROVAL |

New subpages remain assigned to the historical parent groups listed in Section 6. Message Oversight, the workload route variant, internal login, and dynamic module entry do not receive independent page IDs in this proposal.

## 17. Prioritized Regression Implementation Plan

No regression implementation is authorized by this report. The following are recommendations only.

### Table F — Implementation Recommendations

| Proposed Test ID          | Page            | Scenario                                                                                                                                   | Test Type                      | Priority | Dependencies                                                                       |
| ------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | -------- | ---------------------------------------------------------------------------------- |
| PROPOSED-N1-ATT-AUTH      | Page 24         | Matrix across USER, ordinary STAFF, department-head STAFF, ADMIN, SUPERADMIN, and inactive accounts; own/department/global data boundaries | Playwright + API/PGlite        | P0       | Attendance contract and role fixture approval                                      |
| PROPOSED-N1-ATT-LIFECYCLE | Page 24         | Preserve correction/overtime request stages, verifier versus HR approval, audit history, and persistence                                   | API/PGlite + focused browser   | P0/P1    | Administrative decision on workflow transitions                                    |
| PROPOSED-N1-PM-SCOPE      | Page 25         | Deny unauthorized roles/departments on direct routes and APIs; keep Superadmin directory read-only                                         | Playwright + API/PGlite        | P0       | 403/404 and department-scope contract                                              |
| PROPOSED-N1-PM-DIRECTORY  | Page 25         | Overview, department search/filter/pagination, scoped workspace navigation, loading/error recovery                                         | Playwright + API/PGlite        | P1       | Reuse project/workspace fixtures                                                   |
| PROPOSED-N1-MODULE-ENTRY  | Page 26         | Available/unavailable module selection, capability denial, unknown IDs, and generic fallback destination behavior                          | Playwright + web unit/API      | P0/P2    | Decide status of implemented registry modules that render generic fallback content |
| PROPOSED-N1-SVC-OVERVIEW  | Page 08 subpage | Direct service overview render, empty/error/retry, responsive behavior, and accessible announcements                                       | Playwright                     | P2       | Confirm expected overview contract and fixtures                                    |
| PROPOSED-N1-MSG-OVERSIGHT | Page 12 subpage | Authorized read-only list/detail, non-Superadmin denial, private/foreign thread denial                                                     | Playwright + API/PGlite        | P0       | Preserve conversation ownership and inspection policy                              |
| PROPOSED-N1-ALIASES       | Pages 14 and 24 | Canonical alias redirects and authorization before redirect; maintain NEX-006 unsupported behavior                                         | Playwright + route-policy unit | P2       | Existing route contracts; no wizard implementation assumed                         |

These IDs are planning labels only, not approved Playwright identities. Existing tests may already cover some scenarios; implementation should first reconcile ownership and avoid duplication.

## 18. Administrative Decisions Required

1. Approve or reject proposed independent Page 24–26 groups; IDs remain provisional.
2. Decide whether Workspace Selector is a page group or navigation infrastructure.
3. Confirm Attendance verification and final-approval stages and their role ownership.
4. Decide whether direct dynamic module-entry routes for registered People & HR, Attendance, and Administration modules should redirect, render dedicated pages, or remain explicit placeholders.
5. Confirm Project Management 403-versus-404 and department-scope contracts.
6. Confirm alias support and retention for the five Attendance redirects and unsupported `/project-workspace/new` route.
7. Reconcile API-TEST-001 and P01-DEF-01 in the closeout documentation process; this audit does not change the defect register.

## 19. Verification Limitations

- This is source-level, Git-history, documentation, and test-inventory verification only.
- No local application instance was inspected; browser rendering and live API behavior are UNVERIFIED.
- No Playwright, API, unit, repository-wide format, lint, typecheck, build, or runtime command was executed for the audit. The installed Prettier CLI was applied to this report only and passed a file-scoped `--check`; the `pnpm exec prettier` wrapper could not acquire its package-manager store lock (access denied).
- Existing browser E2E coverage primarily uses mocked API responses; it is not production integration certification.
- PGlite suites are identified from repository source but were not executed here.
- Remote Git freshness is UNVERIFIED because no fetch was performed.
- Regression counts and preservation discrepancies are historical documented values, not newly recomputed in this task.
- No database, migration, or production credentials were used.

## 20. Final Audit Conclusion

**Final status: AUDIT PARTIALLY COMPLETE — MARKDOWN REPORT CREATED, CONTRACT VERIFICATION REQUIRED.**

The audit identifies three candidate independent groups and 18 functional subpages while retaining all original 23 page IDs. Proposed IDs are not approved. Existing coverage is substantial, but direct Services Overview coverage is missing from the inspected browser specs, generic module-entry behavior needs disposition, and documented authorization/workflow contracts remain unresolved. No claim is made that the expanded application is fully regression-tested or production-ready.

## 21. Recommended Next Steps

1. Review the proposed Page 24–26 grouping and the route classifications in Table A.
2. Disposition the Attendance lifecycle and dynamic module-entry contracts before adding expectations.
3. Reconcile the seven recommendations in Table F against current test ownership, then authorize a separate additive test phase if appropriate.
4. Keep PW-149, the 52 historical assertion sites, the R1 equivalences, all open defects, and deferred R2/R3/R4 visible.
5. Stop for administrative review. Do not automatically begin Phase 7.5-C1, regression implementation, or Phase 8.

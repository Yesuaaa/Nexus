Phased roadmap
Current scope correction: Workspace selection and module-scoped navigation apply only to workforce accounts (STAFF, ADMIN, SUPERADMIN). Clients (USER) keep `/dashboard` as their landing page and use direct sidebar links to Services, Booked Requests, My Projects, Calendar, and Help. The historical client selector recommendations below are superseded by this requirement. Existing route policies and permissions still govern access.

Phase 0 — Characterization and safety net
Capture current behavior before changing production code.

Work:

- Encode a role × head-status × route access matrix in frontend tests.
- Add explicit coverage for the project-route irregularities above.
- Record module ownership and module entry routes.
- Confirm whether the selector should be shown to clients or only workforce users. The recommendation is role-aware selection for all authenticated users.
- Do not change RBAC or page behavior in this phase.
  Likely files:
- New apps/web/test/workspace-access.test.mjs.
- New apps/web/e2e/workspace-routing.spec.ts.
- Existing E2E support only if reusable fixtures need extension.
  Validation:
- Existing auth, portal, Admin, Staff, Superadmin, project, request-inbox, and client route tests.
- Direct URL access and browser back/forward behavior.
- Confirm denied routes never mount protected feature content.
  Phase 1 — Minimum viable workspace selector
  Replace the empty dashboard with a selector generated from the current account and existing access helpers.

Work:

- Add a small typed module catalog: module ID, label, description, icon, access predicate, and role-specific entry route.
- Render only accessible modules.
- Suggested entry routes:
  - Service Operations: Client/Admin → /services; department head → /request-inbox.
  - Project Management: Client → /projects; Staff → /project-workspace.
  - People & HR: Admin → /employees.
  - Administration: Superadmin → /accounts.
- Preserve /dashboard as the post-login destination, so authentication code does not need to change.
- Do not add database tables, API endpoints, module permissions, or route prefixes.
  Likely files:
- New apps/web/src/features/workspaces/model/modules.ts.
- New apps/web/src/features/workspaces/pages/workspace-selector-page.tsx.
- New workspace card component if the page warrants it.
- [dashboard route (line 1)](C:/Users/ADMIN/Documents/Visual Studio Code/Nexus/apps/web/src/app/(portal\)/dashboard/page.tsx:1).
- [dashboard feature page (line 1)](C:/Users/ADMIN/Documents/Visual Studio Code/Nexus/apps/web/src/features/dashboard/pages/dashboard-page.tsx:1).
- Selector unit and browser tests.
  Validation:
- Each role sees exactly the modules supported by current access.
- Ordinary Staff versus current department head is tested separately.
- Registration still lands on /dashboard.
- Direct bookmarks to current pages remain unchanged.
- Module cards do not grant authorization; API denials remain authoritative.
  Phase 2 — Single route-policy source
  Remove drift between the sidebar, route denial chain, and module selector without changing behavior.

Work:

- Define route policy metadata containing match rules, access predicates, module ownership, and navigation information.
- Have PortalLayout and the sidebar consume the same policy.
- Preserve exact current restrictions, especially rules narrower than backend permissions. For example, Superadmin receives department permissions from the API but the current frontend intentionally exposes Department Management only to Admin.
- Give dynamic project routes explicit policies instead of relying only on broad startsWith("/projects") checks.
  Likely files:
- New features/workspaces/model/route-policy.ts.
- [permissions.ts (line 33)](C:/Users/ADMIN/Documents/Visual Studio Code/Nexus/apps/web/src/features/auth/model/permissions.ts:33).
- [portal-layout.tsx (line 32)](C:/Users/ADMIN/Documents/Visual Studio Code/Nexus/apps/web/src/components/layout/portal-layout.tsx:32).
- [sidebar.tsx (line 47)](C:/Users/ADMIN/Documents/Visual Studio Code/Nexus/apps/web/src/components/layout/sidebar.tsx:47).
- Route-policy tests.
  Validation:
- Full role/route matrix, including exact versus prefix matching.
- Head handoff or role changes revoke module visibility on the next account refresh.
- Unauthorized routes still return to the selector without triggering feature API calls.
- Legacy /booked-services behavior remains unchanged.
  Phase 3 — Module-scoped navigation
  Make each module feel independent while retaining current URLs.

Work:

- Sidebar displays the active module’s pages instead of one flat list.
- Add “Switch workspace” leading to /dashboard.
- Derive the active module from the current pathname; do not store authorization state in the browser.
- Keep Messages, Calendar, Profile, Settings, notifications, and account actions globally reachable.
- Preserve current query-driven conversation URLs such as /messages?request=... and /messages?project=....
- If remembering the last selected module is desired, store only that cosmetic preference in sessionStorage and revalidate it against the current account.
  Likely files:
- [app-layout.tsx (line 27)](C:/Users/ADMIN/Documents/Visual Studio Code/Nexus/apps/web/src/components/layout/app-layout.tsx:27).
- [sidebar.tsx (line 47)](C:/Users/ADMIN/Documents/Visual Studio Code/Nexus/apps/web/src/components/layout/sidebar.tsx:47).
- [topbar.tsx (line 10)](C:/Users/ADMIN/Documents/Visual Studio Code/Nexus/apps/web/src/components/layout/topbar.tsx:10).
- [breadcrumbs.tsx (line 59)](C:/Users/ADMIN/Documents/Visual Studio Code/Nexus/apps/web/src/components/layout/breadcrumbs.tsx:59).
- [account-menu.tsx (line 17)](C:/Users/ADMIN/Documents/Visual Studio Code/Nexus/apps/web/src/features/auth/components/account-menu.tsx:17).
- Project workspace sidebar-link component.
  Validation:
- Notification, calendar, billing, help, request, project, and conversation deep links.
- Browser refresh on every current route.
- Mobile drawer/collapsed-sidebar behavior.
- Shared utilities remain available regardless of active module.
- No redirect loops when module access changes during a session.
  Phase 4 — Boundary cleanup after stabilization
  Only clean boundaries proven problematic by Phases 1–3.

Good candidates:

- Extract ServiceRequestStatus from the Services API file because bookings, clients, and conversations currently import it across features.
- Extract shared project status/deliverable contracts used by both projects and project-workspace.
- Move shared image-storage concerns out of the backend Services feature only if that code must be touched.
- Treat request-conversations and request-workflow as one Service Operations workflow boundary rather than trying to separate them prematurely.
- Keep departments/employees coupled within People & HR where their transaction and leadership rules require it.
  Avoid:
- Moving every feature folder merely to match the new navigation.
- Creating pnpm packages per module.
- Splitting Prisma schemas or Express services.
- Replacing all current URLs with module-prefixed URLs.
  Validation:
- Full request workflow, project workspace, project chat, staffing, and calendar regression suites.
- No API response-shape changes.
- No Prisma migration unless a separately approved feature genuinely requires one.
  Phase 5 — Finance & Billing and Scheduling later
  These are not greenfield modules; both already have partial functionality.

Finance & Billing should reuse:

- Client /billing-logs.
- Workflow quotation approval, agreements, payment evidence, and verification.
- /api/request-workflows/approvals, which currently has no complete standalone frontend workspace.
  Before exposing a Finance selector card, define how individually assigned Admin/Superadmin approval work is represented in the account/module entitlement response. Role alone is insufficient.

Scheduling should reuse:

- The role-aware /calendar.
- Existing consultations, meetings, dated project tasks, deliverable events, and workload capacity.
- The current calendar intentionally aggregates existing records rather than using a separate event table.
  Neither module should be introduced merely as a new menu label over incomplete workflows.
  Primary risks and dependencies
- Authorization drift: Access rules exist in multiple frontend locations plus the API. Phase 2 is essential before navigation becomes more complex.
- Dynamic head access: Service Operations access can appear or disappear through department-head handoff. Module access must be recalculated from refreshed account data, never cached as authority.
- Hardcoded deep links: Projects, messages, notifications, billing, help, calendar, and breadcrumbs construct current URLs directly. Early route renaming would cause broad breakage.
- Cross-module workflow: A service request becomes a workflow, then a project; payment and staffing gates participate in that handoff. The database relationships should remain intact.
- Messages are inherently shared: The page combines client request conversations, project chat, and internal chat. Assigning it exclusively to one module would break current workflows.
- Calendar is inherently shared: It aggregates service meetings, project tasks, and deliverables with different role projections.
- Workload spans HR and projects: It reads employees and capacity but mutates project staffing. Keeping it under Project Management initially minimizes workflow changes.
- Global shell API activity: Workflow notifications and message unread counts are mounted in the shared topbar. Module scoping must not accidentally disable these background refreshes.
- Existing route anomalies: Project route behavior needs characterization before shared route policies are introduced.
- Branding mismatch: Renaming Nexus/EXP to Converyn is a separate concern and should not be folded into this architecture change without explicit approval.

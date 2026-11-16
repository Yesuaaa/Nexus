# Superadmin Staff Workload oversight (Phase 3B.2)

Developed: 2026-11-14

## Architecture audit and implementation boundary

`/api/workload` checks the current active Staff Department Head inside its transaction. The roster consists of employees with active Staff logins in that department, including employees whose HR status is on leave or inactive. Assignment reads include planned, in-progress and held projects that overlap the selected Monday-to-Sunday week. Capacity and assignment mutations independently recheck department scope and existing eligibility/workflow rules.

`workloadPlanningContext` calculates daily policy duration targets and current heads' known meeting/consultation commitments. It does not infer meeting participation from project membership. `getWorkloadMetrics` calculates assigned hours, net capacity, utilization and availability in the web client; missing capacity/hours remain unknown. Timed commitments are not subtracted again from capacity.

The administrative extension reuses these reads/calculations and the existing WorkloadPage, KPI cards, filters, pagination, row menu and details drawer in an explicit read-only mode. `GET /api/administrative-workload?week=YYYY-MM-DD` requires Phase 2A module access and organization-wide read capabilities against the current authenticated database account. Existing operational gates and mutation services remain unchanged.

Only workload identity, department/team, skills, current eligibility status, allocation metadata, weekly capacity and supported planning information appear in this response. Credentials, contact details, unrelated HR records, approval actor metadata, private conversation identifiers/content and files are excluded through explicit response mapping. Known commitments show generic labels and times with response-local identifiers, without private meeting notes or conversation links.

## Implemented behavior

Superadmin opens **Service Operations → Staff Workload** at `/module/service-operations/workload`. The operational `/staff-workload` route remains restricted to Department Heads in its existing Project Management navigation. Admin, Staff, Department Heads and Clients gain no administrative route or API access. Unknown subroutes remain denied.

The API assembles all departments and an unassigned-department group inside a repeatable-read transaction using the shared `readDepartmentWorkload` query. Departments without a head are supported. The same active Staff-login roster rule applies everywhere: on-leave/inactive employees with active Staff logins remain visible, while inactive/deleted login accounts and non-Staff identities are excluded. Superadmin needs no Employee, Staff, team, project or Department Head membership.

The UI reuses weekly selection, search by name/position/skills, team and availability filters, calculated KPI cards, animated table rows and local pagination. Administrative-only department and employee filters combine with these controls. Filtering and pagination operate on the authorized weekly response, following the existing WorkloadPage pattern; KPI cards describe the full authorized roster rather than the filtered subset. Details reuse the same capacity, allocation, policy requirement and scheduling-conflict components.

Every mutation capability in the response is false. The administrative page honors the backend read capability and clears details on rejected reads. Row menus expose only **View workload**; capacity, staffing, reassignment and removal controls are absent from the drawer and page. A defensive guard also prevents the shared page mutation handler from sending administrative writes. The administrative router has no write handlers. Existing operational endpoints continue to enforce current-head scope, employee eligibility and workflow gates independently.

## Changed files

- API: `apps/api/src/app.ts`; `apps/api/src/features/workload/administrative-workload.controller.ts`; `workload-read.service.ts`; `workload.schema.ts`; `workload.controller.ts`; `workload-availability.service.ts`.
- Web: `apps/web/src/app/(portal)/module/service-operations/workload/page.tsx`; `apps/web/src/features/workspaces/model/route-policy.ts`; `apps/web/src/features/workload/pages/workload-page.tsx`; `components/workload-row-actions.tsx`; `components/workload-details-drawer.tsx`; `model/workload.ts`.
- Tests: `apps/api/tests/features/workload/administrative-workload.test.ts`; `apps/web/e2e/administrative-workload.spec.ts`; `apps/web/test/route-policy.test.mjs`.
- Documentation: this report, `docs/features/README.md`, `docs/features/module-role-access.md`, `docs/features/staff-workload.md` and `docs/rbac.md`.

## Validation

- Format, lint, typecheck and the full production build passed.
- 50 selected API tests passed using compiler-emitted JavaScript and offline PGlite: administrative workload, existing availability planning, Request Inbox/workload mutations, backend regression and administrative request visibility. Tests compare administrative and head responses for identical capacity, allocations, policy targets and commitment times, and cover cross-department scope, missing membership, private fields, denied writes and role revocation.
- All 104 web unit tests passed, including capability-based administrative route checks and unchanged workload metrics.
- 47 selected browser tests passed: administrative workload, existing Staff Workload, administrative requests, Request Inbox, module-scoped navigation and Superadmin module entry. Oversight coverage includes desktop/mobile read-only details, utilization, department/employee/availability filters, search, reload, backend denial and ordinary-role rejection. Existing Department Head capacity editing, allocation/reassignment/removal still pass.

The standard `tsx` runner still cannot start because this environment returns `ENOMEM` from `uv_os_get_passwd`; selected API tests execute through compiled JavaScript with the same offline harness. The previously documented Client-milestone workflow assertion was not rerun and remains separate from these selected checks. Full API/browser suites were not run. No selected test failures remain.

Assignment, reassignment, removal, capacity overrides, availability updates, workflow management, Diagnostics and System Logs remain outside this phase.

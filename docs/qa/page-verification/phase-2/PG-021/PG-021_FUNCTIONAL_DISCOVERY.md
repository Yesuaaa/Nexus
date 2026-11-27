# PG-021 functional discovery

## Baseline and identity

Root `C:/Users/ADMIN/Documents/Thesis/Nexus`, branch `development`, HEAD `bf824f218e3b45a39b1ec68d2ba561abe7cf7052`. Entry index, tracked modifications and untracked files were empty. Merge bf824f21 incorporates the final PG-020 recovery 8bb55c9d. The diff from e4e057e8 also includes services/profile image work and shared PGlite fixture changes; department source paths are unchanged.

[Phase 1 registry](../../PHASE_1_COMPLETE_ROUTE_INVENTORY.md) line 31 identifies People & HR `/departments`, portal group. `apps/web/src/app/(portal)/departments/page.tsx` exports Page, wrapping DepartmentManagementPage in ModuleTransition. `route-policy.ts:581–590` declares navigation, and `auth/model/permissions.ts:56–61` requires ADMIN/SUPERADMIN plus departments:read. USER, STAFF and STAFF Head are excluded from portal management. Head is a relationship.

## UI and transport

`department-management-page.tsx:20–149` loads via useDepartments/useAsyncResource, retains rows during reload and owns form, drawer and confirmation state. `department-table.tsx:74–220` searches name, code and Head name/email, sorts locally and resets pagination. URL-restored state is the separate Project Management variant. No exports or deep-linked panels. View Department opens the drawer. Manage gates create/edit/member/team operations; delete has its own permission.

`department-form-panel.tsx:59–148,173–320` handles presets, custom fields, deterministic automatic color until manual choice, uppercase code, blank-name validation, scoped Head candidates and trimmed submit values. Empty optional fields become null on edit; create omits empty code/description. Failed saves retain inputs. `manage-members-drawer.tsx:83–553` fetches selected detail, searches members, offers applicant paging and team/member actions. Candidate debounce is 250 ms and late results use active/key checks; no request signal is passed to listAssignableStaff. Detail/Head requests use the shared abort-capable hook. Team create requires selections in UI while API allows omitted members. Removal from multiple team members is sequential; a later failure can leave earlier commits. No team edit or lead picker on this page.

`departments-api.ts:156–374` makes bearer-authenticated same-origin requests, forwarded by `apps/web/next.config.ts:62–72`. `departments.controller.ts:10–223` requires authentication. GET list requires departments:read and returns minimal STAFF/Head directory versus broader HR rows. GET detail also requires employees:read. Head/employee options, department POST/PUT, member POST/PATCH/DELETE, and team POST/PUT/DELETE require departments:manage. Department DELETE requires departments:delete. Admin/Superadmin have organization-wide HR rights in the current role model. Phase 1's summary omits the separate staff projection and finer permissions.

## Persistence

`departments.schema.ts` normalizes allowlisted fields. `departments.service.ts` validates/returns DTOs; `departments.repository.ts:303–652` persists Department CRUD and membership, and `teams.service.ts:32–324` handles Team operations. `leadership.policy.ts:169–226` checks active eligible Staff, department placement and reservations. Unique Department name/code/headId and per-department Team name plus relational constraints are in `schema.prisma:451,806,824`. Eligible placement and lead/Head protection are checked server-side. User and Employee assignments are synchronized when appropriate. Delete guards linked services, requests, conversations and indirect projects; cleanup preserves accounts. Request-auth-derived history and domain effects are transactional. Reads are observational. No runtime execution occurred.

# Superadmin module registration (Phase 2B)

Developed: 2026-11-14

[Phase 3A.1 project visibility](superadmin-project-visibility.md) subsequently adds organization-wide, read-only project inspection to the Project Management entry described here. Phase 2B's operational restrictions remain in force.

The shared [module registry](../../apps/api/src/features/modules/module-registry.json) defines module identity, title, description, implementation status, safe administrative destination, and card appearance. The API and web app consume the same JSON; no new workspace package or database schema is needed.

## Registered modules

| Module               | Superadmin destination                 |
| -------------------- | -------------------------------------- |
| Service Operations   | `/services`                            |
| Project Management   | `/module/project-management`           |
| People & HR          | `/employees`                           |
| Workforce Compliance | `/attendance/time-logs/overview`       |
| Administration       | `/accounts`                            |
| Billing & Finance    | Unavailable; disabled placeholder only |

Superadmin inherits every implemented module through Phase 2A's `modules:access-all` capability. No Employee, Staff assignment, Department Head assignment, project membership, or Client identity is required. Ordinary-role selector rules remain unchanged.

Existing safe management destinations are reused. Project Management has a minimal administrative entry page because the operational project workspace requires Staff membership. This page displays only backend-authorized registration metadata, keeps Project Management navigation context through shared utilities, and performs no project reads or mutations. Organization-wide project views and management remain deferred to Phase 3.

## Registering future modules

1. Add a unique kebab-case key to the registry with the same fields as existing entries.
2. Set `implemented: false` while the module is unfinished. Such entries have no administrative route or API entry and cannot be remembered as an active workspace.
3. Set `implemented: true` when the module is implemented. Use `administrativePath: null` to automatically receive `/module/<id>` as its safe administrative entry, selector card, and Overview navigation. No Superadmin role list needs updating.
4. Use a non-null administrative path only for an existing, explicitly authorized management page. Add its normal route policy and backend authorization when implementing that page. Do not point administrative entry at operational self-service, a Staff workspace, or a Client decision screen.
5. Ordinary-role access remains explicit and scoped. Registration does not grant Admin, Staff, or Client additional permissions.

Icon names use the existing card icon lookup with a generic fallback; adding a module does not require updating an exhaustive per-module icon list.

## Enforcement

`GET /api/modules` lists implemented administrative entries. `GET /api/modules/:id` authorizes a specific entry. Both require authentication and the current database account's Phase 2A module-access capability. Unknown IDs, inherited object-property names, and unfinished modules cannot produce an entry. The endpoint returns metadata only and grants no operational access.

Frontend route policies are generated for registered administrative entry paths. Every implemented portal page has an explicit exact or parameterized policy. Unregistered paths and prefix lookalikes fail closed; broad prefix matching remains available only for navigation highlighting. Billing Logs remain a separate Client-only feature and do not implement the Billing & Finance module.

Superadmin attendance entry uses the existing management dashboard. Personal attendance overview/check-in routes are unavailable to Superadmin, and its navigation omits the personal Attendance group. Staff and Admin attendance behavior and all backend attendance rules remain unchanged.

Existing APIs continue to enforce assignments, ownership, approval responsibilities, private conversation membership, workflow stages, and account state. A visible card or remembered workspace never grants API access.

## Validation and deferred work

Unit coverage verifies current and future registration, unavailable modules, explicit route coverage, unknown routes, navigation context, and ordinary-role boundaries. Offline PGlite coverage verifies unassigned Superadmin entry, unknown and unavailable IDs, unchanged operational denials, and immediate effect of role/status changes. Browser coverage exercises module selection and entry, project navigation, and rejection of backend-denied metadata.

Completed validation:

- Workspace format, lint, and typecheck passed; the production web build passed.
- All 103 web unit tests passed.
- All 47 selected API tests passed, covering module entry, Phase 2A capabilities, role policy, and the HTTP backend regression suite. The environment's `tsx` runner cannot start because `uv_os_get_passwd` returns `ENOMEM`; these tests executed from TypeScript compiler output using Node, with the same offline PGlite harness and copied test assets in an ignored directory.
- All 41 selected Playwright tests passed across `superadmin-module-access.spec.ts`, `workspace-selector.spec.ts`, and `module-scoped-navigation.spec.ts`, including responsive navigation. Browser API fixtures and real offline API authorization tests are separate checks.

Phase 3 must explicitly implement organization-wide administrative data views and supported management actions. Project assignments, financial approvals, Client workflows, operational participation, Diagnostics, and System Logs are unchanged.

The existing workflow regression that reads `milestones[0].id` from a Client response was reproduced before Phase 2B and also without the Phase 2A grants. It is unrelated to module registration, was not rerun in the selected Phase 2B suites, and remains outside this phase. No failing selected checks remain.

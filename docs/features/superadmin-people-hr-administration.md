# Superadmin People & HR administrative access (Phase 3C.2)

Developed: 2026-11-14

## Audit and restriction classification

People & HR uses `/employees`, `/employees/overview`, `/departments` and `/departments/overview`. Team management is embedded in the existing department drawer rather than a standalone module. The Phase 2B registry enters `/employees`, with existing permission-based department fallback. All employee, department, member and team endpoints use `requireAuth` and existing feature permissions. No route requires the administrative actor to be an Employee, Staff member, department member or Head. Superadmin already receives organization-wide access without operational membership; no backend access bypass or duplicate administrative page is needed.

| Existing restriction                                                                            | Classification and decision                                                                               |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Employee directory includes Admin/Staff accounts; excludes Superadmin and Client targets        | Intentional workforce directory definition, not an actor-access restriction; preserve                     |
| Department members, team members/leads and Head candidates require eligible Staff identities    | Intentional target eligibility; preserve active-account, HR-status, department, team and leadership rules |
| Superadmin cannot be linked to an Employee or assigned as an ordinary workforce participant     | Intentional administrative/operational separation; preserve                                               |
| People & HR login lifecycle operates only on other Staff accounts                               | Intentional boundary; Admin account login actions belong in Account Management                            |
| Staff retains existing department-read APIs but not management pages or employee directory APIs | Existing scope; do not broaden or redesign                                                                |
| Employee create/edit/login UI renders without checking employee-management permission           | Confirmed frontend authorization mismatch; use existing effective permission utilities                    |
| Admin directory rows offer deactivate/reactivate actions rejected by the backend                | Confirmed frontend mismatch; hide those actions and retain Account Management boundary                    |

Department create/edit/delete controls already respect existing department permissions. Department/team services validate the target identities, not the Superadmin actor. Employee and department overviews reuse the same authorized organization queries; no incorrectly required operational identity was found.

Only the confirmed Employee Management control mismatches were corrected. Backend authorization, role assignment, HR provisioning, head handoff, team eligibility and account lifecycle rules remain unchanged. Diagnostics, System Logs and new HR features are outside this phase.

## Audited routes and authorization

All API paths below are relative to `/api`. Each router requires an authenticated active account, and permissions come from the current database role. Existing feature permissions remain independent of the Phase 2A global administrative grants; adding a global bypass would unnecessarily change established behavior.

| Surface                                                                                                           | Existing authorization and scope                                                                                      |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `/employees`, `/employees/overview`                                                                               | Employee-read permission and existing management route policy; organization-wide account-based directory and overview |
| `/departments`, `/departments/overview`                                                                           | Existing department-management page policy; organization-wide departments and overview                                |
| Teams, members and leadership drawers                                                                             | Embedded in Department Management; existing department permissions control mutations                                  |
| `GET /employees`, `GET /employees/:id`                                                                            | `employees:read`; existing search, department/type/status/archive filters and pagination; no actor membership scope   |
| `POST /employees`, `PUT /employees/:id`, `POST /employees/accounts/:accountId/profile`                            | `employees:manage`; existing transactional provisioning, profile validation and eligible target roles                 |
| `GET /employees/:id/status-options`                                                                               | `employees:manage`; existing eligible temporary Head handoff candidates                                               |
| `POST /employees/:id/account`, `PATCH /employees/:id/account/status`, `DELETE /employees/:id/account[/permanent]` | `employees:manage`; existing password, other-Staff-only lifecycle, deactivation, archive and history guards           |
| `GET /departments`, `GET /departments/:id`, `GET /departments/employee-options`                                   | `departments:read`; existing department data and candidate response projections                                       |
| `GET /departments/eligible-heads`                                                                                 | `departments:manage`; eligible Staff candidates only                                                                  |
| `POST /departments`, `PUT /departments/:id`                                                                       | `departments:manage`; existing Head, name, code and handoff validation                                                |
| `DELETE /departments/:id`                                                                                         | `departments:delete`; existing related-record constraints                                                             |
| `POST /departments/:id/members`, `PATCH/DELETE /departments/:id/members/:memberId`                                | `departments:manage`; existing department, employee, team and leadership constraints                                  |
| `POST /departments/:id/teams`, `PUT/DELETE /departments/:id/teams/:teamId`                                        | `departments:manage`; parent department and eligible Staff member/lead validation                                     |

Services and repositories already query organization-wide records for authorized management callers. No Staff, Employee, Head, department or team identity is required for the Superadmin actor. The module registry and navigation already enter the existing administrative pages, so neither routing nor backend production changes were necessary.

## Implemented corrections and reused components

- `employee-management-page.tsx` checks the effective `employees:manage` permission before exposing Create, opening Edit or login controls, or mounting mutation panels.
- `employee-row-actions.tsx` uses the same permission and server-supplied account role/identity metadata. Admin rows retain HR inspection/editing but no Staff login lifecycle actions. Self-targeted Staff login actions are hidden. Archived accounts do not offer login creation, and deletion still requires an inactive account.
- `employee-details-drawer.tsx` exposes Edit only with employee-management permission.

The existing directory, overview pages, filters, row menu, detail drawer, employee form, login dialogs and department/team interfaces are reused. No duplicate Superadmin interface, new role exception, database change or administrative permission grant was introduced. Frontend checks reflect backend rules; direct API requests remain independently authorized.

## Validation

- `pnpm format`, `pnpm lint`, `pnpm typecheck` and the full API/web production build passed.
- 72 relevant offline PGlite backend tests passed: the new cross-department Superadmin HR test plus employee integration, department integrity/leadership, employee validation/permissions and backend regressions.
- 104 web unit tests passed.
- 40 browser tests passed across the new Superadmin HR suite and existing employee, login, department, Staff, scoped navigation and module access regressions. Coverage checks desktop and mobile entry, cross-department inspection, team navigation, permission-limited controls and unchanged Staff/Client page restrictions.
- The new backend test exercises a Superadmin with no Employee, department or team record; existing administrative writes; target eligibility failures; rejected Admin login lifecycle actions; unchanged Staff/Head/Client API restrictions; credential exclusion; and permission revocation on the same session.

The normal backend `tsx` launcher could not start because this environment reports `uv_os_get_passwd ENOMEM`. Tests instead executed successfully using the existing TypeScript-compiled Node/PGlite fallback. This is a runner limitation, not a passing result for the standard launcher. Only the listed backend regressions were run; no full API suite result is claimed.

The initial new mobile test clicked a row action at the viewport edge, where the existing shared zero-size menu anchor was hidden by clipping. Scrolling the complete row into view before interaction made the test exercise the visible menu normally; the shared menu was not changed in this phase.

## People & HR Logs

Superadmins can inspect recorded employee, department, team, and Staff login changes in the People & HR workspace. See [People & HR Logs](people-hr-logs.md) for access, filters, and history coverage.

## Restrictions and remaining work

Superadmin remains outside ordinary employee self-service and operational participation. Head/team eligibility, employee status transitions, temporary Head coverage, protected department deletion, Staff login lifecycle and account ownership rules remain enforced by existing services. Admin credentials remain in Account Management. Staff and Department Head access to sensitive HR records is not expanded. No HR workflow, permission-management feature, automatic identity provisioning or staffing eligibility override was added. Existing uncommitted changes from earlier phases were preserved.

Phase files: the three Employee Management components above; `apps/api/tests/features/auth/superadmin-people-hr.test.ts`; `apps/web/e2e/superadmin-people-hr.spec.ts`; account metadata corrections in existing `employee-login.spec.ts` and `regression-support.ts` fixtures; this report and its documentation cross-links.

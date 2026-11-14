# Phase 7.1 Source, Inventory, and Environment Baseline

**Baseline date:** 2026-11-11 (Asia/Singapore)  
**Source HEAD:** `9bf9c08d30203cf354530b4f7dca09981aad3c4c`  
**Branch:** `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages`  
**Phase 7.1 disposition:** PARTIALLY READY — WITH IDENTIFIED LIMITATIONS

This records discovery and environment checks only. No browser regression case,
API test, full suite, or live-backend test was executed. The record is separate
from the accepted Phase 2, Phase 4, and Phase 6 artifacts.

## 1. Git and source state

HEAD matches the Phase 6 closeout revision. The working tree contains the
expected preserved Phase 6 work:

| State                   | Files                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| Staged additions        | `docs/testing/coverage/phase6/phase6-closeout.md`; `phase6-final-coverage-assessment.md`              |
| Unstaged modifications  | `apps/api/src/project-workspace.test.ts`; `docs/testing/coverage/phase6/post-merge-backlog.md`        |
| Untracked browser tests | `apps/web/e2e/billing/billing-logs.spec.ts`; `apps/web/e2e/projects/client-project-workflows.spec.ts` |

No application implementation file is modified. The API test addition and two
untracked browser specs are part of the tested source snapshot and must remain
present. The closeout and page assessment exist, as do the approved-delta and
preservation reconciliation records. The current source hashes for the changed
or added test files are:

| File                                                     | SHA-256                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/api/src/project-workspace.test.ts`                 | `DE6558AB34DC7B3F0FDBA73BD67566D6EDCD7302AFAE269F90B793E67D0C4BFA` |
| `apps/web/e2e/billing/billing-logs.spec.ts`              | `5AA42567E388D3AF86F9C6E1F900C54AFEA6CBA76438047202CE0036B0833CFE` |
| `apps/web/e2e/projects/client-project-workflows.spec.ts` | `AEA0CE2612A489E053364E2DC1B13AE07DB3A11CC58ED9778B4AC830732D3AE7` |

The current standalone web build exists at `apps/web/.next`, with build ID
`SFd7Qr7sEgdWcqW6p8ur1`. The standalone server copy has the same build ID.
That ID does not establish which worktree produced the build, so it is not
accepted as source-matched evidence. Phase 7.2 must build from this preserved
worktree and record the resulting build ID. The application source itself has
no Git changes; current test-only changes do not affect the web bundle.

## 2. Browser inventory

Discovery command (run from `apps/web`, through the installed package-local
Playwright CLI):

```text
node .\node_modules\@playwright\test\cli.js test --list --workers=1 --retries=0
```

The discovery process set `NEXUS_E2E_LIVE=0` and
`NEXUS_E2E_BASE_URL=http://127.0.0.1:5273`. Result: **326 tests in 46 spec
files**. The complete list-only output is preserved at
`test-results/phase7/phase7.1/playwright-list-20261111.txt`.

Inventory reconciliation:

- **292 original PW identities** remain covered by the accepted Phase 6
  reconciliation: 292/292 identities, 1,630/1,630 assertion sites, and
  4,211/4,211 mappings accounted for. No original browser spec is modified in
  the current Git status. Playwright list output does not print PW IDs, so the
  identity claim is carried forward from the accepted reconciliation rather
  than claimed as a new verifier run.
- **34 additional browser cases** are present. Discovery titles identify 19
  NEX cases: NEX-002 (1), NEX-007 (1), NEX-008 (1), NEX-009 (1), NEX-010 (4),
  NEX-011 (1), NEX-012 (1), NEX-017 (4), and NEX-018 (5). The remaining 15
  additional cases are development-era browser cases without NEX titles.
- **PW-124 through PW-128** are the five live-backend cases. The current
  `live-backend.spec.ts` has five cases and applies `test.skip(!live, ...)`;
  `NEXUS_E2E_LIVE` is not enabled in the process or local regression env file.
  They remain intentionally skipped and were not executed.

## 3. API/PGlite inventory

The full existing API command is:

```text
pnpm --filter @nexus/api test:regression
```

`test:regression` aliases the API `test` script. It runs Prisma generation,
TypeScript compilation, then Node's test runner against **28 test modules**.
Nineteen modules create PGlite databases; the other nine are unit, policy, or
configuration tests. PGlite-backed Express/Prisma suites use disposable
`PGlite()` instances with `PGLiteSocketServer` on loopback and an ephemeral
port, apply the migrations, point `DATABASE_URL` at that instance, and close
the fixture during cleanup. They do not require a shared or production
database. The project-workspace module in the current tree contains the
Phase 6 NEX-013 through NEX-016 scenarios.

The complete API modules are:

- PGlite-backed: `api-system-regression`, `backend-regression`, `calendar`,
  `client-integration`, `client-requests`, `employee-integration`,
  `features/users/account-password`, `features/users/account-restore`,
  `jwt-session`, `lib/database-read`, `login-validation`, `profile`,
  `project-conversations`, `project-workspace`, `request-conversations`,
  `request-inbox`, `request-workflow`, `service-specialists`, and `settings`.
- Unit/policy/configuration: `app`, `features/auth/auth`,
  `features/auth/auth.jwt`, `features/auth/employee-permissions`,
  `features/auth/session-location`, `features/employees/validation`,
  `features/services/validation`, `features/users/account-status`, and
  `features/users/role-policy`.

The API suite was inventoried but not executed in Phase 7.1. API/PGlite
identities, including NEX-001, NEX-003 through NEX-005, and NEX-013 through
NEX-016, remain separate from the 326 browser-case inventory.

## 4. Runtime environment and execution parameters

| Item                        | Finding                                                                                                                                                                                                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js                     | `v24.16.0`                                                                                                                                                                                                                                                                                               |
| Workspace package manager   | `pnpm@12.7.0` is pinned; installed `pnpm` reports `12.15.0` and warns that it cannot acquire the global store operation lock (`ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK`, access denied).                                                                                                                  |
| Playwright                  | Installed `@playwright/test` version `1.64.1`.                                                                                                                                                                                                                                                           |
| Browser                     | Chromium `156.0.8078.4` launched and closed successfully with process-spawn permission. The default sandbox attempt returned `spawn EPERM`; the successful check opened no page and contacted no service.                                                                                                |
| Expected ports              | No listener found on `3000`, `3001`, `5173`, `5273`, or `5274`; no Node server process was present. No unrelated process was stopped.                                                                                                                                                                    |
| Local env                   | `apps/web/.env.regression.local` exists and contains the five live-account password variable names. It does not set live mode or a base URL. Values were not read into this report. The root `.env` exists; values were not inspected. `DATABASE_URL` and `DIRECT_URL` are unset in the current process. |
| Playwright config           | Chromium project; `fullyParallel: true`; `workers` defaults to Playwright's default except live mode (1); retries are 0 unless `CI` is set, when config uses 2. Current process has no `CI` value. Trace is retained on failure outside live mode.                                                       |
| Phase 7 worker/retry choice | Use `--workers=1 --retries=0` for page-focused runs, preserving failures and reducing worker/process contention. Do not enable retries to conceal instability.                                                                                                                                           |
| Web startup                 | Playwright config normally runs `pnpm build && node scripts/start.mjs`, with `HOSTNAME=127.0.0.1`, `PORT=5273`, and `reuseExistingServer: false`. The start script requires `apps/web/.next/standalone/apps/web/server.js`. These artifacts currently exist, but need a fresh build for Phase 7.2.       |
| API startup                 | Browser fixtures mostly mock `/api/*`; an API server is not required for those cases. API regression modules start Express against isolated PGlite fixtures where integration coverage is needed.                                                                                                        |

Because pnpm currently warns before normal package operations, first try the
workspace command only if it executes cleanly. If it fails before launching the
script, use the already-installed package-local Playwright, Next, Prisma,
TypeScript, Prettier, and ESLint tools and record that fallback. A fresh web
build can be produced from the current app sources, then started on port 5273;
the existing `.next` artifact must not be treated as proven source-matched.

## 5. Workspace quality gate

The repository-required checks were completed through installed local tools
after each corresponding `pnpm` command failed before script execution with
`ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK`:

| Gate          | Local command(s)                                                       | Result                                                        |
| ------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| Format        | `node node_modules/prettier/bin/prettier.cjs --write .`; `--check .`   | PASS; all files were already formatted and reported unchanged |
| Lint          | `node node_modules/eslint/bin/eslint.js . --max-warnings 0`            | PASS                                                          |
| API typecheck | `node node_modules/prisma/build/index.js generate`; API `tsc --noEmit` | PASS                                                          |
| Web typecheck | Next `typegen`; web `tsc --noEmit`                                     | PASS                                                          |

No regression tests were run. The formatter, lint, and typecheck operations did
not add or change tracked source files; the pre-existing Phase 6 status was
preserved.

## 6. Ordered 23-page verification matrix

The page order and accepted Phase 6 coverage disposition are preserved. The
Phase 7 execution column is deliberately `NOT STARTED` for every page.
Shared specs and API modules should execute once and be attributed to each
covered page; do not rerun identical cases just to create multiple page rows.
For page-specific results, retain test identity and route attribution. Browser
tests with mocked API responses do not prove API persistence or authorization.

| # / route                                                                  | Roles and scope to exercise                                                                      | Original PW identities                                                                        | Browser ownership and additional cases                                                                                                    | API/PGlite ownership                                                                                             | Phase 6 coverage                                                     | Phase 7     |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------- |
| 1. Login `/login`                                                          | Public; SUPERADMIN, ADMIN, STAFF, USER session refresh/logout and redirects                      | PW-011, 013–019, 021, 087–090, 124–133, 135–137, 142, 144, 146–147, 151–157                   | `auth/regression`, `auth/jwt-session`, `auth/login-validation`, `shared/auth-styles`                                                      | `login-validation`, `jwt-session`, `features/auth/auth.jwt`                                                      | Adequate                                                             | NOT STARTED |
| 2. Registration `/register`                                                | Public to USER; invalid fields and duplicate identity                                            | PW-012, 015, 020, 143–144, 148–155                                                            | `auth/regression`, `auth/registration-validation` (NEX-010, 4 cases)                                                                      | `jwt-session`, `features/auth/auth`                                                                              | Adequate                                                             | NOT STARTED |
| 3. Dashboard `/dashboard`                                                  | Authenticated portal route for all four roles; no widget behavior is supported                   | PW-021, 087, 124–128, 130–133, 138–139, 145–146, 150, 152–155, 158, 162–163, 269–272, 281–282 | `auth/*`, `shared/project-pages-regression`, `shared/table-interactions`; no widget spec                                                  | No dashboard API                                                                                                 | Intentionally unsupported                                            | NOT STARTED |
| 4. Account Management `/accounts`                                          | SUPERADMIN allowed; ADMIN, STAFF, USER denied for privileged actions                             | PW-001–002, 141, 145, 269–280                                                                 | `accounts/superadmin`, `accounts/account-creation` (NEX-002)                                                                              | `employee-integration` (NEX-001), `features/users/{role-policy,account-status,account-password,account-restore}` | Adequate                                                             | NOT STARTED |
| 5. Client Management `/clients`                                            | ADMIN directory/create; read-only details; edit/delete stay unsupported                          | PW-009–010, 031–032, 053–056, 059, 062, 249–250, 283, 288                                     | `clients/client-mutations`, `clients/related-records` (NEX-012), responsive/shared client and table specs                                 | `client-integration`                                                                                             | Adequate                                                             | NOT STARTED |
| 6. Employee Management `/employees`                                        | ADMIN manage employees; verify linked STAFF accounts and server eligibility/rollback             | PW-005–006, 063, 071–076, 145, 269–272, 284, 289                                              | `employees/employees`, `employees/employee-login`, shared department/table specs                                                          | `employee-integration`, `features/employees/validation`                                                          | Adequate                                                             | NOT STARTED |
| 7. Department Management `/departments`                                    | ADMIN manages teams, heads, and members; verify assigned STAFF scope                             | PW-003–004, 064–065, 067, 069, 269–272                                                        | `shared/departments`, `shared/department-member-workflows` (NEX-011)                                                                      | `employee-integration`                                                                                           | Adequate                                                             | NOT STARTED |
| 8. Services `/services`                                                    | ADMIN catalog/pricing management; USER catalog selection and request submission                  | PW-007–008, 041–052, 057–058, 060–061, 066, 068, 070, 106–109, 134, 140, 251–260, 269–272     | `services/services`, `services/pricing-templates`, `services/client`                                                                      | `employee-integration`, `client-requests`, `service-specialists`, `features/services/validation`                 | Adequate                                                             | NOT STARTED |
| 9. Client Service Requests `/service-requests`                             | USER-only, owner-scoped history/detail and request states                                        | PW-033–040, 287, 292                                                                          | `service-requests/client-service-requests`, shared table spec                                                                             | `client-requests`                                                                                                | Adequate                                                             | NOT STARTED |
| 10. Request Inbox `/request-inbox`                                         | Current Department Head STAFF; reject other roles/non-current heads                              | PW-096, 099, 168–169, 205–218, 286, 291                                                       | `request-inbox/request-inbox`, `messages/request-conversations`, shared loading/table specs                                               | `request-inbox`                                                                                                  | Partial; decline/delete success contract blocked                     | NOT STARTED |
| 11. Booked Services `/booked-services`                                     | USER-owned bookings, filters, details, deep links, and refresh                                   | PW-022–030, 285, 290                                                                          | `booked-services/booked-services`, shared table spec                                                                                      | `client-requests`                                                                                                | Adequate                                                             | NOT STARTED |
| 12. Messages `/messages`                                                   | All four roles with conversation/resource scope; ownership and forbidden actor checks            | PW-077–086, 091–094, 159–204, 219–248                                                         | `messages/request-conversations`, `messages/internal-conversations`, `project-conversations`, `workflows/request-workflow`, shared topbar | `request-conversations`, `project-conversations`, `request-workflow`                                             | Adequate in Phase 6; real API/persistence claims belong to API tests | NOT STARTED |
| 13. Project Details `/projects/[id]`                                       | USER-owned projects; assigned STAFF internal view; current Department Head reviews requests      | PW-115, 118, 120–123                                                                          | `projects/project-workspace`, `shared/project-pages-regression`, `projects/client-project-workflows` (NEX-017)                            | `project-workspace` (NEX-013)                                                                                    | Partial; two NEX-017 error-toast failures remain known               | NOT STARTED |
| 14. Project Workspace `/project-workspace`                                 | STAFF list; Department Head manages supported workspace lifecycle                                | PW-097, 100, 114, 117, 281–282                                                                | `projects/project-workspace`, `projects/workspace-mutations` (NEX-007), shared project/table specs                                        | `project-workspace` (NEX-003)                                                                                    | Partial                                                              | NOT STARTED |
| 15. Project Workspace Details `/project-workspace/[id]`                    | Department Head actions; assigned STAFF tasks/deliverables; scope-denied STAFF                   | PW-116, 119, 281–282                                                                          | `projects/project-workspace`, `workspace-detail-mutations` (NEX-008), `workspace-deliverables` (NEX-009), project conversations           | `project-workspace` (NEX-004/005/015), `project-conversations`, `calendar`                                       | Partial                                                              | NOT STARTED |
| 16. Staff Workload `/staff-workload`                                       | Current department-head STAFF; verify staff/project scope and rejected writes                    | PW-095, 098, 101–105, 267–268                                                                 | `staff-workload/staff-workload`                                                                                                           | `api-system-regression`                                                                                          | Partial                                                              | NOT STARTED |
| 17. Profile `/profile`                                                     | All four roles edit only their own profile/image; STAFF specialist fields                        | PW-110–113                                                                                    | `profile/profile`                                                                                                                         | `profile`                                                                                                        | Adequate                                                             | NOT STARTED |
| 18. Settings `/settings`                                                   | All four roles; own preferences, password/session revocation; role-specific menu                 | PW-101–104, 110–113, 261–266                                                                  | `settings/settings`, `settings/session-revocation`                                                                                        | `settings`, `jwt-session`, `api-system-regression`                                                               | Adequate                                                             | NOT STARTED |
| 19. Billing Logs `/billing-logs`                                           | USER-only, client-owned records/proof; STAFF, ADMIN, SUPERADMIN denied                           | No original PW identity listed                                                                | `billing/billing-logs` (NEX-018, 5 cases)                                                                                                 | `project-workspace` (NEX-016)                                                                                    | Adequate                                                             | NOT STARTED |
| 20. Calendar `/calendar`                                                   | All roles; USER own events, STAFF own/team scope, admin organization scope                       | Eight existing cases; PW mapping not separately itemized in Phase 6 page table                | `calendar.spec.ts` (8 existing cases)                                                                                                     | `calendar`, `project-workspace` (NEX-015)                                                                        | Adequate                                                             | NOT STARTED |
| 21. Help `/help`                                                           | Authenticated portal behavior; source describes FAQ search/disclosure, no role-specific mutation | No original PW identity listed                                                                | No dedicated browser spec                                                                                                                 | Not applicable                                                                                                   | Partial; no dedicated browser case                                   | NOT STARTED |
| 22. My Projects `/projects`                                                | USER-only owned list; cross-client project isolation                                             | No original PW identity listed                                                                | `projects/client-project-workflows` (NEX-017 list states/navigation)                                                                      | `project-workspace` (NEX-013)                                                                                    | Adequate                                                             | NOT STARTED |
| 23. Client Deliverable Details `/projects/[id]/deliverables/[milestoneId]` | USER-owned project and client-visible files only; cross-client/internal access denied            | No original PW identity listed                                                                | `projects/client-project-workflows` (NEX-017 review/preview states)                                                                       | `project-workspace` (NEX-014)                                                                                    | Partial                                                              | NOT STARTED |

The existing API modules `employee-integration`, `client-requests`,
`project-workspace`, `api-system-regression`, and messaging modules own cases
for multiple pages. Execute each module once during page verification and map
its individual test identities to all applicable page rows. The complete API
suite is separately planned for Phase 7.3.

## 7. Auxiliary routes

These remain separate from the official 23-page count:

- `/`: assess the root redirect and its destination independently.
- `/project-workspace/new`: assess the redirect to `/project-workspace` and
  retain NEX-006 as `PARTIALLY COVERED — WIZARD BLOCKED`. Do not expose or
  invent a wizard journey.

## 8. Known risks and accepted limitations

- **NEX-017:** Phase 6 records two preserved failures for brief-save and
  deliverable-review error notifications in fresh sessions. Its diagnosis is
  that affected pages call Sileo directly while rendering is mounted through
  the application notification wrapper. This baseline did not rerun those
  cases or independently validate that runtime diagnosis. Keep assertions and
  failures visible; no application correction was made.
- **NEX-006:** `/project-workspace/new` redirects to the workspace list and the
  wizard has no supported caller. API workspace creation is not an equivalent
  browser journey.
- **Request Inbox:** successful decline/delete remains blocked by the absent
  approved backend contract. Do not invent success expectations.
- **Unsupported scope:** Dashboard widgets/analytics and Client Management
  edit/delete remain unsupported. Help remains partially covered because no
  dedicated browser spec exists.
- **Environment:** pnpm's store-lock warning may prevent workspace scripts from
  starting; the default sandbox blocked Chromium process spawn (`EPERM`), while
  a local launch check succeeded with process-spawn permission. The app build
  must be refreshed from the current worktree before browser execution.
- Historical reports also record worker spawn restrictions, port collisions,
  locked build output, and browser `ERR_NO_BUFFER_SPACE`. These were not
  reproduced in Phase 7.1; ports checked above are currently clear.

## 9. Readiness recommendation

**PARTIALLY READY — WITH IDENTIFIED LIMITATIONS.** Browser discovery is
complete, the case inventory reconciles with accepted Phase 6 evidence, PGlite
isolation is source-confirmed, the expected ports are clear, and local Chromium
startup works when process spawning is permitted. Before page execution, build
the web app from the current worktree, use the local package tools if pnpm
cannot acquire its global lock, and run browser processes with the permission
needed for Chromium startup. Carry NEX-017 failures and all accepted product
limitations forward unchanged.

Phase 7.1 is complete. No Phase 7.2 page suite, Phase 7.3 API suite, cross-page
workflow run, or combined regression run was started.

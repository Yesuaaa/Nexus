# Phase 7.4.1 — Page 7: Department Management

**Route:** `/departments`  
**Status:** COMPLETE — WITH VERIFIED DEFECTS OR ACCEPTED LIMITATIONS  
**Scope:** current merged-source review, two new browser cases, three isolated API cases, existing NEX-011 selector reconciliation, focused execution, and historical preservation. No application changes.

## 1. Executive Summary

The current Department Management page supports department creation, editing, deletion, department-head selection, member assignment, team creation, team membership changes, directory search, sorting, and local pagination. The page itself is Admin-only in the browser route policy. The API has separate read, manage, and delete permissions.

Two new Playwright tests cover directory search/sort/pagination and department form boundary/error recovery. Three nested PGlite cases cover department name/code uniqueness, name/code boundaries and normalization, and team-lead reassignment with linked Employee synchronization. The existing NEX-011 title and behavioral assertions remain; its selectors now match the current team menu and member-removal UI.

The final focused browser run passed **15/15** cases. Four isolated API modules passed **62/62 unique leaf tests**. `pnpm format`, `pnpm lint`, and `pnpm typecheck` passed. No application defect was confirmed. NEX-015 has a source/documentation discrepancy: the accepted historical contract says user-initiated lead removal is unsupported, while the API update schema and service accept `leadId: null`. No removal test was added; the discrepancy is recorded for contract reconciliation.

Browser API calls were intercepted and used synthetic fixtures. API integration tests used PGlite. No live API, shared database, real account, credential, or bearer token was used.

## 2. Git Baseline

| Item         | Initial                                                                                            | Final                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Branch       | `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages` | Same                                                                                          |
| HEAD         | `af40fc8df0834ee3ddeca6f2f7667b2596952e6d`                                                         | Same; no commit                                                                               |
| Worktree     | Clean; no staged, unstaged, or non-ignored untracked files                                         | Two test files changed, one test file and this report added; no application or schema changes |
| Page 6 files | Tracked in initial HEAD                                                                            | Preserved                                                                                     |
| Commit/push  | —                                                                                                  | Neither performed                                                                             |

The configured port `5273` was occupied at first. The local portal returned HTTP 200 and the expected EXP Digital Solutions title. That existing process was not stopped. After it exited, the final post-format browser run used a separate server on port `5274`, started from the repository's existing standalone build; that server was stopped after the run. The web application source has no changes between the merge parent `b6d9b8ae4ccdac5341fcff7df2223f3bef47bb23` and the initial Page 7 HEAD; the differences in that interval are Page 6 tests and documentation. All browser API calls were intercepted. The initial Git inventory is retained in `test-results/phase7/page-by-page/page-07-department-management/initial-git-baseline.txt`.

Authorized changes are limited to Page 7 test code, three Page 7 API test cases, this report, and ignored evidence. No dependency, lockfile, application, authorization, or schema change was made.

## 3. Post-Merge Source Inspection

The route entry is `apps/web/src/app/(portal)/departments/page.tsx`; it renders `DepartmentManagementPage` from `apps/web/src/features/departments/pages/department-management-page.tsx`. The page uses `useDepartments`, `DepartmentTable`, `DepartmentFormPanel`, `DeleteDepartmentDialog`, and `ManageMembersDrawer`. The drawer composes team controls and `EditMemberForm`/`PanelSubview` components. The department API client is `apps/web/src/features/departments/api/departments-api.ts`.

The API router is `apps/api/src/features/departments/departments.controller.ts`, re-exported by `routes.ts`. It delegates department operations to `departments.service.ts` and `departments.repository.ts`, and team operations to `teams.service.ts`. Validation is in `departments.schema.ts`; leadership eligibility is shared through `leadership.policy.ts`. The relevant model definitions are `Department`, `Team`, `Employee`, and `User` in `apps/api/prisma/schema.prisma`.

The development merge is retained. Current differences from the previous merge parent are Page 6 test/report artifacts only; no post-merge application behavior was restored or rewritten for this task.

## 4. Department Feature Inventory

| Feature                          | Source and user action                                                                              | Current result/API                                                                                                        | States and verification                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Department directory             | `DepartmentTable`; open `/departments`                                                              | `GET /api/departments`; displays department, head, team, employee, and service counts                                     | Skeleton, retryable list error, empty state, no-match state; existing and new browser coverage                           |
| Search                           | Directory search input                                                                              | Local case-insensitive substring match across name, code, head name, and head email; 100-character input cap              | New browser case searches by code                                                                                        |
| Sort and pagination              | Department, Teams, Employees, Services sort buttons and footer                                      | Local sorting; name ascending by default, counts descending; ties fall back to name; 10 rows per page                     | New browser case checks count sort, page 2, and search reset                                                             |
| Create/edit department           | Create button or row action                                                                         | POST `/api/departments`; PUT `/api/departments/:id`; name, code, color, description, and head                             | Existing CRUD case plus new whitespace, boundary, 400/409 recovery and serialization case                                |
| Department head                  | Head selector in create/edit panel                                                                  | `GET /api/departments/eligible-heads`; saved through create/update department                                             | UI source inspected; PGlite leadership module covers eligibility and head transitions                                    |
| View members and teams           | Click department row name or View action                                                            | GET `/api/departments/:id`; opens a side drawer with Employees and Teams tabs                                             | Existing Page 7 cases and NEX-011; loading/error paths are source-reviewed                                               |
| Assign/remove department members | Drawer assignment and member controls                                                               | POST `/members`, DELETE `/members/:memberId`, PATCH `/members/:memberId`; updates Employee/User placement transactionally | NEX-011 covers team placement; isolated employee integration cases cover assignment consistency and rejected writes      |
| Create/manage teams              | Teams tab, Create Team, Manage team menu                                                            | POST/PUT/DELETE `/teams`; team creation, member assignment/removal, and deletion controls                                 | NEX-011 covers create, assign, and remove membership; API source and PGlite team-lead tests cover supported API behavior |
| Team-lead controls               | No team-lead editor in current drawer; API client exposes `createTeam` and `updateTeam` lead fields | POST/PUT team endpoints accept lead identifiers                                                                           | API assignment eligibility and new reassignment test; no UI lead workflow exists                                         |
| Delete department                | Row Delete action and confirmation                                                                  | DELETE `/api/departments/:id`; service/history restrictions return 409                                                    | Existing CRUD browser case and PGlite rejection/persistence assertions                                                   |
| Department lifecycle             | No activate, deactivate, archive, or restore control/model field                                    | Permanent deletion only                                                                                                   | `NOT_APPLICABLE` for department status transitions                                                                       |
| Department overview              | Separate `/departments/overview` route                                                              | Not part of `/departments` directory behavior                                                                             | Navigation link only; overview metrics were not tested here                                                              |

Department list errors show Retry. The head option list shows a loading placeholder, but the form reads `heads.data` and `heads.loading` only; a head-list request error has no dedicated message or retry control. This is recorded as a UI coverage/feedback limitation, not a confirmed data defect.

## 5. Department Data and Validation Matrix

The current schema has no Department status field. `name` and nullable `code` are unique. `color` is a string column with a database default; `headId` and temporary head tracking IDs are nullable unique foreign keys. The API service maps unique name/code writes to HTTP 409.

| Input                                     | Client behavior                                                                                        | API/database behavior                                                                                                                                                                    | Result and gap                                                                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Department name                           | Required; trims for submission and blocks whitespace-only values. No client min/max attribute.         | Trimmed; 2–80 characters; unique.                                                                                                                                                        | Browser checks whitespace, 1/81-character server errors, retention, and retry. PGlite checks boundaries and duplicate non-persistence. Server is authoritative for length. |
| Department code                           | Optional; uppercases on typing; `maxLength=20`; blank create value omitted, blank update becomes null. | Trimmed and uppercased; optional; if present 2–20 characters; unique nullable column; no character whitelist.                                                                            | Browser checks submitted uppercase/trimmed value and duplicate recovery. PGlite checks minimum/maximum and duplicate create/update.                                        |
| Color                                     | Picker; name-based default can be changed manually.                                                    | Defaults to `blue` if omitted; otherwise must be one of `blue`, `violet`, `pink`, `orange`, `teal`, `amber`, `slate`, `green`, `red`, `brown`, `cyan`. Database column is `VarChar(16)`. | Existing CRUD browser case and API source; omission/default and invalid palette response were not separately driven in this run.                                           |
| Department head                           | Optional select; empty means unassigned; options are fetched for create or the current department.     | Optional/null; candidate must satisfy shared leadership eligibility; `headId` is unique.                                                                                                 | PGlite leadership tests cover eligible/ineligible candidates and handoff. Head-picker request failure has no visible error/retry state.                                    |
| Description                               | Optional textarea; trimmed; blank omitted on create and sent as null on edit. No client max length.    | Trimmed; blank becomes null; Prisma `String?` has no explicit length cap.                                                                                                                | PGlite checks trimming and empty optional values. No arbitrary length/character rule was added.                                                                            |
| Directory search                          | Search input, maximum 100 characters.                                                                  | Local only; no list query parameter.                                                                                                                                                     | Browser verifies code match and pagination reset; head name/email match is source-only.                                                                                    |
| Team name                                 | Required in create-team form.                                                                          | Trimmed; 2–80 characters; unique within a department.                                                                                                                                    | NEX-011 checks team creation; team boundary API cases were not added.                                                                                                      |
| Team description                          | Optional; no length cap in UI.                                                                         | Trimmed; blank becomes null; no schema length limit.                                                                                                                                     | Source-only.                                                                                                                                                               |
| Team member selection                     | Create-team Save is disabled until at least one active eligible department employee is selected.       | `memberIds` may be omitted by API clients; when present, 1–1000 unique IDs, each 1–80 characters, and the service checks department/staff eligibility.                                   | NEX-011 verifies create and member assignment payloads; PGlite checks eligible staff rules and membership synchronization.                                                 |
| Employee search for department assignment | Search field; debounce and page controls. No explicit input cap.                                       | Employee-options query trims search, allows at most 100 characters, and validates the page.                                                                                              | API boundary and loading/error UI paths are source-reviewed; no specific long-search browser case.                                                                         |
| Team member search                        | Local search in assign/remove subviews; no explicit max length.                                        | No separate API query; results are filtered from department detail.                                                                                                                      | Source-only.                                                                                                                                                               |
| Member job title                          | Optional text input in Edit member details.                                                            | Trimmed/null; Department Head title is guarded by leadership policy; no general length rule in this form.                                                                                | Leadership PGlite tests cover prohibited/stale title cases; no field-boundary browser case.                                                                                |
| Assigned team                             | Optional select; “No specific team” clears assignment.                                                 | Must be a team in the same department; only eligible active Staff can be placed on a sub-team; a department head cannot be placed in a sub-team.                                         | Existing membership workflow and PGlite integration coverage.                                                                                                              |

No explicit Unicode or code-character whitelist is implemented for department name/code. Server validation enforces normalized lengths and database uniqueness. The client does not duplicate the 2–80 name rule or 2-character code minimum; the UI retains submitted values and displays the server response. This is a server-authoritative validation difference, not a confirmed invalid-persistence defect.

## 6. Department Lifecycle Contract

- Create requires a valid unique name; code, description, color, and head are optional or defaulted as described above.
- Edit updates only supported department fields and head assignment. The form serializes the current values; API schema supports partial fields and normalizes empty optional values.
- There is no department activation, archive, restore, or soft-delete state.
- Delete is permanent. The API rejects deletion with HTTP 409 when services remain linked or accepted request/conversation history exists. PGlite checks rejected writes leave the department present.
- Deleting an otherwise eligible department runs cleanup in a repository transaction: linked Users and Employees have department/team placement cleared, team rows cascade with department deletion, and linked Employees are synchronized. User/Employee foreign keys use `SetNull` where applicable.
- Teams have their own create, update, and delete lifecycle. Team deletion clears team placement while retaining department placement, as implemented in the service.

## 7. Employee–Department Relationship Matrix

| Operation                  | Current contract                                                                                                                 | Integrity behavior and evidence                                                                                                                                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Department membership      | Employee and User membership fields are nullable; a User may have one linked Employee through unique nullable `Employee.userId`. | Department APIs accept employee IDs and/or user IDs; repository writes are transactional and synchronize linked records. PGlite employee integration tests cover membership consistency.                                                                |
| Department assignment      | Drawer can assign existing eligible staff and remove a member.                                                                   | Assignment validates active STAFF/account/department scope; removal clears department and team placement and synchronizes the linked Employee. Department Head removal through the member path is rejected and must be changed through Edit Department. |
| Team assignment            | Create-team selection, team Manage menu, and member edit select can set or clear `teamId`.                                       | Team must belong to the same department; active Staff constraints apply. Employee and User placement are synchronized in transactions. NEX-011 checks the mocked request/UI path; PGlite checks API persistence and rejected writes.                    |
| Employee status/leadership | Employee status is managed outside this page.                                                                                    | Inactivation of a Department Head uses temporary-head handoff rules; inactivation of a Team Lead can clear the lead pointer. PGlite department-integrity and leadership tests cover these transitions.                                                  |
| Account retirement         | Account lifecycle is separate from Employee status and assignment.                                                               | Current eligible-head/team-lead rules reject inactive or trashed Staff. Employee integration tests cover role/account eligibility.                                                                                                                      |
| Unlinked Employee          | Employee may have no linked User.                                                                                                | Department detail returns Employee rows; user-facing employee option lists apply their own Staff eligibility rules. No live database was used.                                                                                                          |

## 8. Team Management Matrix

| Capability              | UI/API contract                                                                                                                                         | Verification                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create team             | UI requires a name and at least one selected active department member. API accepts name, description, optional lead ID, and optional unique member IDs. | NEX-011 checks create payload and initial member. PGlite employee integration checks team lead eligibility and create-time User/Employee placement. |
| Assign/reassign members | Manage team menu opens Assign members; member edit also changes assigned team.                                                                          | NEX-011 checks a PATCH assignment; PGlite employee integration checks synchronization and ineligible/rejected assignment behavior.                  |
| Remove members          | Manage team menu opens a selection panel; selected members are PATCHed with `teamId: null`. Employee remains in the department.                         | NEX-011 checks the null payload and that Blake is removed while Avery remains.                                                                      |
| Edit/delete team        | API PUT supports name, description, and lead ID; UI exposes team deletion from Manage team.                                                             | Source-only for team edit/delete in this browser group; delete handler is transactional. No delete-team assertion was added.                        |
| Team uniqueness         | Database unique key is `(departmentId, name)`; API maps unique conflicts to 409.                                                                        | Source reviewed; no new duplicate-team case.                                                                                                        |
| Team scope              | Team requires a department; department deletion cascades teams.                                                                                         | Prisma relation and API source reviewed; PGlite department deletion/history cases verify guarded deletion path.                                     |
| Team lead               | No team lead selection or edit UI is present in this drawer. API create/update accept `leadId`.                                                         | Existing PGlite eligibility test plus new reassignment/synchronization test; NEX-015 reconciliation below.                                          |

## 9. NEX-015 Team-Lead Reconciliation

The accepted Phase 7.2/7.3 contract says team-lead assignment and reassignment are supported, while user-initiated removal is intentionally unsupported. Assignment is exercised by the existing `Team API accepts only eligible staff as Team Leads` PGlite case. The new PGlite case reassigns an existing lead twice and verifies the Team pointer plus both linked User and Employee department/team IDs.

Current UI source has no team-lead control. The current API source does accept `leadId: null`: `validateTeamUpdateInput` maps null/blank to null, and `teamsService.updateTeam` writes a defined `leadId` and synchronizes the previous lead. Therefore the API source can perform explicit removal, despite the accepted documentation saying removal is unsupported. Comparison with the pre-merge team service shows this null-handling behavior predates the development merge’s leadership-policy refactor; it was not introduced by the current Page 7 work.

No test requiring `leadId: null` was added. The source/documentation difference is recorded as an **UNDETERMINED contract discrepancy** pending explicit reconciliation. Automatic lead step-down when a Team Lead becomes inactive is a separate status-driven behavior and remains covered by the existing PGlite test.

## 10. Authorization Matrix

| Actor      | Browser `/departments`                                      | API read                 | Manage/create/update/member/team writes | Department delete          |
| ---------- | ----------------------------------------------------------- | ------------------------ | --------------------------------------- | -------------------------- |
| USER       | Redirected/denied                                           | No                       | No                                      | No                         |
| STAFF      | Redirected/denied                                           | Yes (`DEPARTMENTS_READ`) | No                                      | No                         |
| ADMIN      | Allowed                                                     | Yes                      | Yes (`DEPARTMENTS_MANAGE`)              | Yes (`DEPARTMENTS_DELETE`) |
| SUPERADMIN | Browser route denied by the current Admin-only route policy | Yes                      | Yes                                     | Yes                        |
| Anonymous  | Redirected to login / API auth required                     | No                       | No                                      | No                         |

The role permissions are in `apps/api/src/features/auth/auth.permissions.ts`. Department routes use `DEPARTMENTS_READ` for list/detail/employee options, `DEPARTMENTS_MANAGE` for eligible heads and mutations, and `DEPARTMENTS_DELETE` for department deletion. Browser checks include PW-003/004, PW-145, PW-269–272, and two new-workflow-independent API role checks in `backend-regression.test.ts`. The API test suite also verifies STAFF/USER department mutation rejection. SUPERADMIN’s API permission and the narrower Admin-only browser route policy are distinct current policies; existing role tests preserve that UI contract.

## 11. Existing Regression Inventory

Department-attributed original identities are `PW-003`, `PW-004`, `PW-064`, `PW-065`, `PW-067`, and `PW-069`. They map to 29 unique historical assertion sites and 52 ownership edges in the approved Phase 6 reconciliation. Shared route-attributed identities are `PW-124`–`PW-127` (live backend opt-in, not run), `PW-145`, and `PW-269`–`PW-272`. The union of those department-related IDs maps to 89 unique sites and 307 ownership edges; shared assertions belong to multiple routes/pages and are not represented as Department-only totals.

Other existing coverage includes:

- `[NEX-011] admin creates a team, assigns an employee, and removes the assignment` in `apps/web/e2e/shared/department-member-workflows.spec.ts`.
- Department CRUD, member drawer, team-create 403 recovery, and responsive department preset cases in `shared/departments.spec.ts` and `shared/dropdown-positioning.spec.ts`.
- `department-integrity.test.ts`, `features/departments/leadership.test.ts`, `employee-integration.test.ts`, and `backend-regression.test.ts` for PGlite-backed authorization, eligibility, membership, uniqueness-related data integrity, and linked records.
- PW-063 is in the shared Department spec file but belongs to Page 6 Employee Management. It ran in the selected group and is not counted as a Page 7 case.

The initial gaps were directory search/sort/pagination coverage, direct code/name uniqueness and boundary persistence assertions, and team-lead reassignment persistence. Existing page cases covered normal department CRUD but not all error recovery or real database behavior.

## 12. New Regression Tests

Two new Playwright identities were added in `apps/web/e2e/departments/department-management.spec.ts`:

1. `department directory filters by code, sorts by employee count, and resets pagination` — verifies page size/range, next-page behavior, code search, search reset to page one, and count sort.
2. `department creation reports name boundaries and recovers from validation and uniqueness errors` — verifies whitespace-only client rejection, submitted one/81-character names and server 400 feedback, trimmed/uppercase request serialization, 409 retention, and successful retry.

Three nested isolated API cases were added to `apps/api/tests/department-integrity.test.ts`:

1. `department name and code uniqueness reject conflicting writes without persistence`.
2. `department API enforces name and code length boundaries and normalizes fields`.
3. `team lead reassignment updates the lead and synchronizes employee placement`.

The NEX-011 case title and its POST/PATCH payload and final membership assertions are unchanged. Its selectors were reconciled to the current UI’s Create team heading, Manage team menu, member selection panel, and team-list region. No historical test identity was removed or renamed, and no assertion was weakened. Fixtures use synthetic departments, employees, and PGlite records.

## 13. Feature-to-Test Matrix

| Feature                                            | Source                                                                         | Test ownership/assertion                                                          | Result             | Verification level                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------ | ------------------------------------------ |
| Directory list, loading, empty/error source states | `department-management-page.tsx`, `department-table.tsx`, `use-departments.ts` | Existing department cases; list API module                                        | PARTIALLY_VERIFIED | MOCKED_UI_VERIFIED / ISOLATED_API_VERIFIED |
| Search, sort, pagination                           | `department-table.tsx`, `use-local-table.ts`                                   | New directory test: code match, employee sort, 10-row pages, reset                | VERIFIED_PASS      | MOCKED_UI_VERIFIED                         |
| Create and edit form                               | `department-form-panel.tsx`, API schema/service                                | Existing CRUD; new request serialization and 400/409 recovery; PGlite validation  | VERIFIED_PASS      | MOCKED_UI_VERIFIED / ISOLATED_API_VERIFIED |
| Department name/code uniqueness                    | schema, service, Prisma model                                                  | New PGlite create/update conflict and no-persistence assertions                   | VERIFIED_PASS      | ISOLATED_API_VERIFIED                      |
| Department color                                   | color picker/model, schema                                                     | Existing CRUD color assertion; source enum/default inspection                     | PARTIALLY_VERIFIED | MOCKED_UI_VERIFIED / SOURCE_ONLY           |
| Department head assignment                         | form, eligible-head API, leadership policy                                     | Leadership PGlite eligibility/handoff suite                                       | VERIFIED_PASS      | ISOLATED_API_VERIFIED                      |
| Department lifecycle                               | page, delete dialog, department service/repository                             | Existing delete UI; PGlite service/history rejection and persistence assertions   | PARTIALLY_VERIFIED | MOCKED_UI_VERIFIED / ISOLATED_API_VERIFIED |
| Employee department assignment/synchronization     | department service/repository, employee service                                | NEX-011 mock; employee integration relationship cases                             | VERIFIED_PASS      | MOCKED_UI_VERIFIED / ISOLATED_API_VERIFIED |
| Team creation and membership                       | drawer, `teams.service.ts`, department member routes                           | NEX-011 create/add/remove payloads and member visibility                          | VERIFIED_PASS      | MOCKED_UI_VERIFIED                         |
| Team assignment integrity                          | department service/repository                                                  | Employee integration PGlite membership cases                                      | VERIFIED_PASS      | ISOLATED_API_VERIFIED                      |
| Team-lead assignment                               | team service/schema, leadership policy                                         | Existing eligible-lead PGlite API case                                            | VERIFIED_PASS      | ISOLATED_API_VERIFIED                      |
| Team-lead reassignment                             | team service                                                                   | New reassignment test checks lead, User, and Employee state twice                 | VERIFIED_PASS      | ISOLATED_API_VERIFIED                      |
| Team-lead removal                                  | No UI; API accepts null but historical contract says unsupported               | No removal test added                                                             | UNDETERMINED       | SOURCE_ONLY                                |
| Team deletion                                      | drawer, team service                                                           | Handler and transaction source review only                                        | PARTIALLY_VERIFIED | SOURCE_ONLY                                |
| Role and session gates                             | route policy, API permission middleware                                        | PW-003/004, PW-145, PW-269–272; backend role matrix                               | VERIFIED_PASS      | MOCKED_UI_VERIFIED / ISOLATED_API_VERIFIED |
| Error recovery                                     | department form, delete dialog, API errors                                     | New form 400/409 recovery; existing team 403 and CRUD cases                       | VERIFIED_PASS      | MOCKED_UI_VERIFIED                         |
| Accessibility and responsive layout                | semantic controls, labels, dialogs, mobile table                               | Existing 390px preset and semantic locator cases; limited keyboard/focus coverage | PARTIALLY_VERIFIED | MOCKED_UI_VERIFIED                         |
| Live browser-to-database integration               | External API/database                                                          | Not run; no live account/database was used                                        | NOT_COVERED        | NOT_VERIFIED                               |

## 14. Browser Execution Results

Final command, from `apps/web`, against the isolated standalone server on port 5274:

```powershell
$env:NEXUS_E2E_BASE_URL = 'http://127.0.0.1:5274'
node node_modules/@playwright/test/cli.js test `
  e2e/shared/departments.spec.ts `
  e2e/shared/department-member-workflows.spec.ts `
  e2e/shared/dropdown-positioning.spec.ts `
  e2e/departments/department-management.spec.ts `
  e2e/auth/admin.spec.ts `
  e2e/auth/staff.spec.ts `
  e2e/auth/regression.spec.ts `
  --grep '(department|Department|NEX-011|/departments|restores its layout, navigation, and deep-link permissions|anonymous home and protected deep links redirect to login)' `
  --workers=1 --retries=0 --reporter=line,json `
  --output=../../test-results/phase7/page-by-page/page-07-department-management/playwright-isolated-post-format-output
```

**Final result:** 15 executed, 15 passed, 0 failed, 0 skipped. Fourteen cases are Page 7-attributed; the remaining case is existing Page 6 identity PW-063, included because it shares the department spec. PW-124–127 are live opt-in cases and were not selected. Reruns did not create new identities.

Earlier runs exposed obsolete NEX-011 UI selectors, not a product failure. The selectors were corrected without changing the historical title or request/result assertions. Three focused NEX-011 reruns followed; the final targeted run passed, and the subsequent full 15-case group passed. A post-format attempt against the already-exited 5273 process returned connection refused before page code loaded; the exact selection then passed against the isolated server on 5274. The browser tests intercepted API calls and made no backend writes.

Logs and JSON output are under `test-results/phase7/page-by-page/page-07-department-management/`, including the initial attempts, targeted reruns, final log, JSON result, and failure traces. The directory is Git-ignored.

## 15. Backend/API Execution Results

The focused command, from `apps/api`, was:

```powershell
node node_modules/tsx/dist/cli.mjs --test `
  tests/department-integrity.test.ts `
  tests/features/departments/leadership.test.ts `
  tests/employee-integration.test.ts `
  tests/backend-regression.test.ts
```

**Result:** 62 unique API/policy leaf cases passed, 0 failed, 0 skipped. This is 61 isolated PGlite integration cases plus one pure leadership-title helper case. The four modules cover role reads/writes, department and team provisioning, department history/delete guards, leadership eligibility, assignment synchronization, and rejected-write persistence. TAP parent entries are excluded from the unique leaf count.

The default sandbox attempt stopped before tests because Node worker spawn returned `EPERM`; the same command completed through the authorized local execution path. PGlite emitted an existing `pg` deprecation warning about a query starting while another query was executing; it did not fail a test. No live database was contacted.

## 16. Data Integrity Assessment

- Department name/code uniqueness is enforced by the Prisma unique constraints and API conflict mapping. The new PGlite case verifies duplicate name, duplicate code on create, and duplicate code on update return 409 and leave the intended records unchanged.
- The new boundary case verifies server rejection below/above the department name and code limits, accepted exact minimum/maximum values, trimming, uppercase code normalization, and null conversion for blank optional code/description.
- Team creation and member changes use service/repository transactions. Employee updates synchronize the linked User; existing PGlite employee integration cases assert linked department/team state and rejected-mutation non-persistence.
- Team-lead reassignment uses a transaction and synchronizes both the new lead’s User and Employee placement. The new test checks two reassignments. It does not test direct lead removal.
- Department deletion checks service links and request history before transactionally clearing placement and deleting. PGlite asserts blocked history cases retain the department.
- Evidence is isolated to PGlite plus browser mocks. No production or shared database write is claimed.

## 17. Defect Register

| Finding                                                           | Feature                | Classification                    | Evidence and disposition                                                                                                                                                                                                                                |
| ----------------------------------------------------------------- | ---------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D7-001 — explicit team-lead removal source/documentation mismatch | NEX-015                | UNDETERMINED contract discrepancy | Historical verification records removal as intentionally unsupported; current team update schema/service accept `leadId: null`. No removal test was added. Reconcile the approved contract before adding one.                                           |
| D7-002 — outdated NEX-011 selectors                               | NEX-011                | TEST_DEFECT                       | Initial traces showed the current form is a panel subview and team assignment/removal are under Manage team. Selectors were corrected; original test title, write payload assertions, and membership results remain. Final NEX-011 and full group pass. |
| D7-003 — name/code length is server-enforced                      | Form validation        | ACCEPTED_LIMITATION               | Client blocks empty/whitespace names but does not duplicate server 2–80 name or 2-character code minimum. Server returns errors; the UI retains values and permits retry. PGlite and mocked UI recovery passed. No invalid data persisted.              |
| D7-004 — head-option fetch has no visible failure/retry state     | Head selector          | COVERAGE_GAP                      | Source reads loading/data but does not render the resource error. No browser failure case was added; no confirmed assignment or persistence defect.                                                                                                     |
| D7-005 — no live integration                                      | End-to-end persistence | ACCEPTED_LIMITATION               | Browser uses mocked API and backend uses PGlite. Deployed database/provider behavior is not established.                                                                                                                                                |

No confirmed application, authorization, transaction, team membership, or data integrity defect was found. Initial sandbox startup failures and the occupied port were environment constraints and were resolved for the final executions.

## 18. Integration Limitations

- Browser checks verify UI behavior and request/response handling against mocks; they do not establish persistence.
- PGlite verifies API and transaction behavior in an in-memory PostgreSQL-compatible database; it is not a production database check.
- The final browser run used the repository's existing standalone build on a port isolated for this task. No fresh production build was started; the tested web source files are unchanged from the merge parent.
- No live backend opt-in identities, production credentials, shared database, full WCAG audit, or every possible API failure status were exercised.
- Department overview metrics and every team edit/delete error path remain outside this run.

## 19. Historical Preservation

- The global Phase 6 baseline remains **292 historical identities, 1,630 assertion sites, and 4,211 ownership mappings**. The separate **34 pre-existing additional browser cases** remain outside those totals.
- Page 1–6 additions remain accounted for: Login 3, Registration 20, Dashboard 9, Account Management 5, Client Management 7, Employee Management 3 — **47 total**.
- The six Page 7 direct historical identities and shared route identities remain in place. The historical direct/shared assertion mapping summary is described in Section 11; shared ownership counts are not added to Page-only totals.
- NEX-011 is still present with the same title, operation sequence, API payload checks, and final member assertions. Only stale selectors were reconciled to the current source controls.
- NEX-015’s approved historical contract was preserved; no test asserts removal. The source discrepancy is documented without silently changing the contract.
- Page 1–6 test code and reports were not modified. The merged development source and schema were not reverted or changed.
- Initial HEAD `af40fc8` already contained Page 6’s previously untracked artifacts; they were tracked and preserved at task start.

## 20. Page Acceptance Assessment

Page 7 is administratively complete with documented limitations. The current source, models, roles, validation, lifecycle, Employee/User synchronization, Team membership, lead behavior, and historical coverage were inspected. Two missing browser behaviors and three missing isolated API behaviors were added. All safe focused browser and API cases passed, and the required quality gate passed.

The mandatory `pnpm format`, `pnpm lint`, and `pnpm typecheck` commands all exited 0. Their final logs are retained in the ignored evidence directory.

Remaining items are explicit: reconcile NEX-015’s direct API null behavior against its accepted documentation; consider a visible head-option fetch error state; run live integration only in an authorized disposable environment; and do not interpret source-only Team deletion/overview review as runtime verification. No blocker prevents Page 7’s mocked/isolated acceptance.

## 21. Next Page Readiness

Services relate to departments through the Department–Service relation and department counts. A service association blocks department deletion until it is reassigned or removed; accepted request and conversation history also block deletion. These are relevant inputs for a future Services audit.

Page 8 — Services was not started. Phase 7.5 was not started.

# Department data access security (Phase 4B.1)

Developed: 2026-11-15

## Audit and implementation

This phase addresses [Phase 4A finding A01](superadmin-comprehensive-authorization-audit.md#a01--staff-department-reads-expose-cross-department-workforce-information). The current working tree and department list, detail, candidate, member and team routes were inspected before implementation. Existing uncommitted Phase 2A–3D work is preserved.

The legitimate consumers establish two separate purposes:

| Caller                                          | Existing purpose and fields                                                                                                                                                                          | Decision                                                                                                                                             |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Department Management/Overview                  | Department description, Head contact, member/team/service counts, dates; detailed employee/contact/status/account information in the members drawer                                                  | Preserve the rich response for existing HR readers.                                                                                                  |
| Employee Management/Overview and employee forms | Department filters/pickers and team selections from department details; management members drawer                                                                                                    | Existing authorized Admin/Superadmin consumers retain their current response structures.                                                             |
| Service Management and service forms            | Department options and related service counts; administrative service configuration                                                                                                                  | Existing Admin/Superadmin callers retain their current list response.                                                                                |
| Staff and Department Heads                      | Existing department-read permission permits directory discovery and cross-department identification; no current Staff/Head page calls the generic full department detail or assignment-candidate API | Return only department ID, name, code, color and Head ID/name in the directory. Department affiliation or Head title alone is not HR-read authority. |
| Department Head staffing                        | `/api/workload` and request-workflow snapshots already query the responsible department and eligible employees independently                                                                         | Preserve these existing purpose-scoped queries, calculations and assignment permissions; do not grant generic HR management access.                  |
| Cross-department service coordination           | Heads of linked departments inspect unaccepted shared requests through Request Inbox; the accepting department retains access afterward                                                              | Preserve this existing authorization and routing behavior. Directory summaries remain organization-wide.                                             |

No current web or mobile consumer was found that needs a sensitive generic department response as ordinary Staff. All full-detail and candidate web consumers are existing administrative HR interfaces; candidate fetching in the members drawer already requires `departments:manage`. No frontend implementation change or duplicate directory screen is necessary.

## Enforced API contracts

| API                                     | Required authority                                                 | Response/scope                                                                                                                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/departments`                  | Active, non-retired authenticated account with `departments:read`  | Without `employees:read`: exact directory allowlist `{ id, name, code, color, head: { id, fullName }                                                                                                                            | null }`. No email, phone, HR status, account lifecycle, member/team rosters, management description, timestamps or workforce counts. With HR-read permission: existing administrative list contract. |
| `GET /api/departments/:id`              | Both `departments:read` and `employees:read`                       | Existing organization-wide HR detail response. Ordinary Staff and Heads are denied with 403 before the detail service executes, including for their own department or forged query claims.                                      |
| `GET /api/departments/employee-options` | `departments:manage`                                               | Existing paginated, validated, eligible unassigned Staff search, unchanged target eligibility and response contract. Staff and Heads use scoped operational staffing endpoints rather than this organization-assignment picker. |
| `GET /api/departments/eligible-heads`   | `departments:manage`                                               | Unchanged eligible-Head rules and projections.                                                                                                                                                                                  |
| Department/member/team writes           | Existing `departments:manage` or `departments:delete`              | Unchanged authorization, target eligibility, validation, transactions, leadership and relationship rules.                                                                                                                       |
| Head workload/request-workflow staffing | Existing active Staff Head assignment and department/request scope | Unchanged. A directory permission, query department ID or global inspection capability cannot expand the operational scope.                                                                                                     |

The directory query reuses `departmentSummarySelect` and explicitly selects the Head's ID/name. Sensitive management data is not fetched and then hidden in the UI. Administrative list selection reuses the existing HR permission; there are no hardcoded Superadmin exceptions, wildcard capability checks or new permission grants. Superadmin and Admin retain organization-wide administrative reads and management without needing workforce membership. Client, anonymous, inactive and retired accounts remain denied. Current database-role changes take effect on existing sessions.

## Changed files

- `apps/api/src/features/departments/departments.controller.ts`: passes the authenticated role to list selection, requires HR read for full detail, and department management for assignment candidates.
- `apps/api/src/features/departments/departments.service.ts`: chooses directory versus existing administrative list using `hasPermission` and `employees:read`.
- `apps/api/src/features/departments/departments.repository.ts`: minimal directory query reusing the shared department summary select. Existing cleanup and management queries are retained.
- `apps/api/tests/features/departments/data-access.test.ts`: real Express/PGlite authorization and field-level response regression tests.
- `docs/rbac.md`, `docs/features/README.md`, and this report: current access contract, implementation record and remaining restrictions.

No frontend source, schema, role map, assignments, staffing rules or unrelated module authorization changed.

## Validation

The new tests were executed against the previous implementation first: directory allowlist, direct detail denial and immediate role-revocation assertions failed, reproducing A01. After the authorization correction, all 8 focused tests passed. No production validation was relaxed.

The tests verify exact top-level/nested directory fields for assigned/unassigned Staff and Heads, Head-less departments, denied detail/candidate requests across departments, preserved Admin/Superadmin list/detail/candidate contracts, no Superadmin Employee creation, actual Head workload scope despite a forged department filter, shared-request coordination, unchanged assignment/team mutation denial, anonymous/Client/inactive/retired denial and same-session permission revocation.

| Check                         | Result                                                              |
| ----------------------------- | ------------------------------------------------------------------- |
| `pnpm format`                 | PASS, exit 0                                                        |
| `pnpm lint`                   | PASS, exit 0, zero warnings                                         |
| `pnpm typecheck`              | PASS, exit 0; web and API, including the new tests                  |
| `pnpm build`                  | PASS, exit 0; API and production standalone web                     |
| `pnpm test:api`               | PASS, exit 0; all 294 tests passed, none skipped/cancelled          |
| `pnpm test:web`               | PASS, exit 0; all 107 web unit tests passed, none skipped/cancelled |
| Selected Chromium regressions | 70 passed, 1 pre-existing failure, none skipped; exit 1             |
| `git diff --check`            | PASS                                                                |

The API run includes all department/employee integration and integrity tests, leadership/handoff rules, current scoped Head workload/request-workflow behavior, shared-service routing, existing Superadmin administrative coverage and the new A01 security tests. The existing test that expects authorized department GET cleanup still passes, confirming A02 behavior remains unchanged.

Browser regressions exercised department/team interfaces, employee forms and login controls, services and department selection, Head workload, Request Inbox, Superadmin People & HR/module entries and scoped navigation against the production web build. The `services.spec.ts` filename pattern also selected `booked-services.spec.ts`. Its case at `apps/web/e2e/booked-services.spec.ts:484` fails at `:491` because it expects `/dashboard` for a denied internal-role navigation but receives `/module`. This is the same pre-existing failure recorded by Phase 4A, and both the spec and frontend sources are unchanged. The later no-fetch assertions in that case do not execute; no passing result is claimed for them. All other 70 selected cases passed. The full 443-case browser suite was not rerun; the remaining Phase 4A browser backlog was not modified.

No required test was blocked. API tests executed through the recovered compiler/native Node runner; the previously documented raw `tsx` host limitation was not retested or changed. Existing `pg` concurrent-query deprecation warnings remain non-failing. All backend tests use offline PGlite; browser API contracts are mocked in these selected specs. No live database or live-account verification is claimed.

Before/after hash comparison of existing API/web source and test files found changes only in the three department implementation files listed above; the security test is new. Other existing uncommitted source/test changes were preserved. Logs are in ignored `.ci-tools/phase4b1-{red,focused,format,lint,typecheck,build,api,web-unit,browser}.log`, with browser failure traces in `.ci-tools/phase4b1-browser-artifacts/`.

## Remaining issues and phase boundary

Follow-up, 2026-11-15: [Phase 4B.2](department-get-integrity.md) makes department reads observational and enforces displaced-Head title integrity in authorized writes. The paragraph below records the original Phase 4B.1 boundary.

**A02 remains unresolved for Phase 4B.2.** Authorized HR department detail reads still invoke `getDepartmentDetailsWithCleanup`, which can clear stale Head titles, clear a current Head's team and synchronize Employee records. This implementation does not redesign, relocate or remove that behavior. A01's new authorization guard prevents unauthorized Staff/Head detail requests from reaching it, but an authorized HR GET is still not guaranteed to be observational. Existing department-integrity tests must continue to pass until that separate redesign.

The department directory is intentionally available across departments with minimal identity fields; it does not expose a roster or grant staffing authority. Existing scoped Head workload/workflow responses may include employee status necessary for their authorized responsibility. This phase does not remove those legitimate operational fields or grant HR account/contact access through them.

Client-create permission separation (A03), mutation provenance (A04), the broader browser maintenance backlog, Diagnostics and System Logs remain outside Phase 4B.1. No Phase 4B.2 implementation was performed.

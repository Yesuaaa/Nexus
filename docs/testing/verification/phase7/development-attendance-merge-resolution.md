# Development Attendance Merge Resolution

**Date:** 2026-11-14 (Asia/Singapore)  
**Status:** Conflict resolved and staged; merge remains in progress for review.  
**Scope:** Integrate the existing local `origin/development` commit into the Playwright regression feature branch. No Page 17 or Phase 7.5 work is included.

## A. Merge status and branch

The feature branch is `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages`. Before this task the worktree was clean, no merge/rebase/cherry-pick was active, and `attendance.spec.ts` had no unmerged index entries. The local development ref was one commit ahead of the shared base, so I started the requested integration with `git merge --no-commit --no-ff origin/development` after the read-only comparison. The merge is still active; no merge commit was created.

## B. Commit identities

| Role                                               | Commit                                     |
| -------------------------------------------------- | ------------------------------------------ |
| Common base                                        | `8da5cc76147cdca7f73b093eb5ebf714da77a414` |
| Current feature `HEAD`                             | `ed675cd3ccfd74f2286663ca99b1abc4c3ab6dfe` |
| Incoming local `origin/development` / `MERGE_HEAD` | `7f8d40bd12c19d6ac258169d751c535008f65c93` |

The incoming commit is `feat(attendance): add attendance and monitoring workspace`. No fetch or pull was run; “latest” here means the local `origin/development` ref available in this checkout.

## C. Conflict inventory and cause

The three-way index had five content-conflict hunks, all in `apps/web/e2e/attendance.spec.ts`. The feature branch had committed Page 16 fixture and isolation corrections in `ed675cd`; development changed the same test file while adding grouped Attendance pages and canonical routes. Stage ownership was confirmed after merge (`:2` = feature `HEAD`, `:3` = `origin/development`). No other path conflicted.

## D. Conflict matrix and resolution

| Hunk                                        | Common/feature behavior                                                                                  | Incoming behavior and evidence                                                                                                                                  | Decision                                                                                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request review to records                   | Feature navigated to legacy `/attendance/records`.                                                       | Development adds canonical `/attendance/time-logs/records`; `attendanceNavigation` declares it as Records, with the old path retained as a compatibility route. | **REWRITE FOR CURRENT CONTRACT:** use the canonical path and keep the existing record-opening assertions.                                            |
| Employee table entry                        | Feature navigated to `/attendance/records` and scoped the Employees control to the Attendance workspace. | Development uses `/attendance/time-logs/records`.                                                                                                               | **REWRITE FOR CURRENT CONTRACT:** use the canonical path and preserve the workspace scope, successful-response waits, filters, and table assertions. |
| Denied client check                         | Feature routes the spawned page through the local Attendance API fixture, then visits `/attendance/my`.  | Development visits canonical `/attendance/check-ins`; the route policy denies USER and redirects to `/dashboard`.                                               | **COMBINE BOTH:** keep the fixture route and use `/attendance/check-ins`.                                                                            |
| Approved row in design check                | Feature creates a unique approved correction and selects the row by its unique reason.                   | Development’s locator accepts any Approved row.                                                                                                                 | **COMBINE BOTH:** retain the independent fixture and reason-scoped row assertion; this avoids dependence on an earlier test’s database mutation.     |
| Approved row in responsive management check | Feature creates a viewport-specific correction and targets that row in the named request table.          | Development uses a generic table and Approved label.                                                                                                            | **COMBINE BOTH:** preserve the unique fixture, named table, and exact row target.                                                                    |

The two canonical route changes are supported by the incoming `navigation.ts`, route policy, and route files. The client route is supported by the USER access policy. The unique approval fixtures preserve test independence and do not conflict with the incoming table/API response contract. No product-design clarification was needed.

## E. Current and incoming changes

The feature-side changes included deterministic local API routing, response waits, cleanup, and independently created Attendance corrections with unique request keys/reasons. The incoming commit adds the Attendance & Monitoring workspace, grouped Overview/Check-Ins/Time Logs/Requests & Approvals/Policies/Dashboard routes, API summaries and filters, audit views, policy pages, navigation/authorization updates, and related PGlite, unit, and browser coverage. The incoming `attendance-policy-assignment.spec.ts` now opens `/attendance/policies/management`.

In `module-scoped-navigation.spec.ts`, development retitles “management links are revalidated while personal attendance keeps People & HR accessible” to “management access loss clears People & HR context” and updates the expected module visibility. That is a nonhistorical test-contract change: Attendance is now a separate workspace, and loss of the Admin’s management permissions clears People & HR context. The current module behavior and updated assertions passed the 54-case cross-module browser selection. The test was adapted in place; it was not an accepted Page 1–16 page test or one of the 292 Phase 4 identities.

## F. Page 16 fixture preservation

The resolved spec retains `routeAttendanceApi`, which routes `/api/**` to the local PGlite-backed fixture and stubs unrelated conversations/settings/notification requests. The original page gets the route in `beforeEach` and removes it in `afterEach`; spawned client and department-head pages receive the same route explicitly. The test correction added during this task applies that route to the new department-head page before its canonical Time Logs navigation.

Page 16’s unique approved-correction fixtures, `randomUUID()` request keys, reason-scoped row assertions, workspace-scoped Employees controls, and successful response waits remain present. The correction rows are created per scenario rather than being selected from whichever row a prior serial test left behind. The added head-page routing fixed a test-fixture defect: the first merged run’s new boundary case lacked the fixture, then passed alone (1/1) with the fixture and in the final Attendance run (27/27). This was not an application authorization defect.

## G. Incoming Attendance behavior and coverage

The incoming browser changes include three viewport cases for grouped Attendance pages, a Staff/Department Head boundary case, and a partial-summary-failure/retry case. The related API work adds scoped request summaries, validated status filtering, personal overview behavior, record-only audit filtering/action counts, and policy inventory summaries. Existing clock-in/out, break, overnight, policy lifecycle, request review, records, department scope, and workload policy context scenarios remain in the merged selection.

The new API contracts are exercised by the incoming Attendance management and policy tests. The merge also includes the incoming source files; see Section Q for the complete path list. These are incoming development changes, not application edits made to resolve the test conflict.

## H. Discovery and test preservation

| Checkpoint                                               | Playwright discovery |
| -------------------------------------------------------- | -------------------: |
| Page 16 pre-integration log `final-discovery-run-49.log` | 487 tests / 67 files |
| Post-integration `playwright-discovery.log`              | 492 tests / 67 files |

The direct identity-set comparison found five new Attendance identities, one nonhistorical module-navigation identity retitled/replaced for the separate-module contract, and no other additions or removals. This yields the net increase of five. The incoming E2E diff adds no `test.skip`, `test.fixme`, or skipped describe. No changed E2E path appears in the immutable Phase 4 `test-index.txt`; the 292 identity, 1,630 assertion-site, and 4,211 ownership-mapping artifacts were not edited.

The historical verifier was attempted, not assumed clean. Its full discovery stops at the documented PW-149 exact-title mismatch: expected “duplicate email registration displays inline server error alert”; current equivalent wording is “duplicate email registration displays server conflict feedback.” Its result showed no duplicate or unexpected identities. A supplementary run excluding PW-149 reached the existing `/dashboard` versus `/module` declaration mismatch at PW-001; another selected run reached PW-003/PW-005, which expand the same read-permission declaration. The current `/module` behavior is covered in the Phase 7 Department Management checks and the Phase 6 redirect delta record; `auth/admin.spec.ts` was not changed by this merge. PW-037’s accepted redirect delta remains in the existing ledger. Because the legacy verifier exits on these known identity/declaration differences, this task does **not** claim a clean fresh global 292/1,630/4,211 reconciliation. No baseline artifacts were adjusted to mask them.

## I. Attendance browser results

| Selection                                                                    | Result                  |
| ---------------------------------------------------------------------------- | ----------------------- |
| `attendance.spec.ts` + `attendance-policy-assignment.spec.ts`, `--workers=1` | **27 passed, 0 failed** |
| Focused spawned department-head route recheck                                | **1 passed, 0 failed**  |

The initial merged Attendance attempt had one failure and one dependent case not run because the spawned head page lacked fixture routing. After fixing that test fixture, the complete final selection passed. Its log is `attendance-browser-final.log`; the initial failure and isolated recheck are preserved separately.

## J. API and web unit results

| Selection                                                                                                                                  | Result                  |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| Attendance backend, policy, overtime, migration, management, workload availability, API system regression, and Request Inbox PGlite suites | **69 passed, 0 failed** |
| Calendar API PGlite suite                                                                                                                  | **1 passed, 0 failed**  |
| Attendance, route-policy, workspace, workload, calendar, employee-validation web unit selection                                            | **43 passed, 0 failed** |

All API checks used in-memory PGlite. No live database was used.

## K. Page 16 Staff Workload compatibility

`staff-workload.spec.ts` and `page-16-regression.spec.ts` ran after integration: **5 passed, 1 failed**. The sole failure is the required retained `[P16-WEB-003]` regression for known defect **S16-001**: clearing search after navigating to page 2 displays “Showing 11–12 of 12” instead of returning to page 1. The test was not removed, skipped, or weakened; no product fix was made.

## L. Cross-module browser results

The controlled selection covering portal role authorization, module-scoped navigation, workspace selection, Employee Management, Department Management/team workflows, and Calendar passed **54/54**. Relevant file selection: `module-scoped-navigation.spec.ts`, `workspace-selector.spec.ts`, `auth/portal-regression.spec.ts`, `employees/employees.spec.ts`, `employees/employee-directory.spec.ts`, `departments/department-management.spec.ts`, `shared/departments.spec.ts`, `shared/department-member-workflows.spec.ts`, and `calendar.spec.ts`.

## M. Defect and test-failure classification

- **Incoming boundary-test failure:** test fixture problem (missing route on a spawned `Page`); corrected by calling the existing route helper and verified with a passing focused and full-suite run.
- **S16-001:** existing application defect, intentionally still failing under P16-WEB-003. No source fix was authorized or applied.
- **PW-149/PW-001/PW-003/PW-005 verifier mismatches:** existing historical identity/declaration reconciliation limitations. The merge did not modify their source file or historical records.
- No additional application defect was confirmed in the tested Attendance or workload scenarios.

## N. Historical defects and limitations

Other historical findings were not reassessed or changed. The merge does not conceal S16-001 or claim the legacy verifier passed. Calendar behavior is verified through the selected browser/API suites; this was not a live-system run.

## O. Quality gates

| Command                                | Result                       | Evidence                                |
| -------------------------------------- | ---------------------------- | --------------------------------------- |
| `pnpm format`                          | Exit 0                       | `quality-format-final-after-report.log` |
| `pnpm lint`                            | Exit 0 (`--max-warnings 0`)  | `quality-lint-final.log`                |
| `pnpm typecheck`                       | Exit 0 for API and web       | `quality-typecheck-final.log`           |
| `git diff --check HEAD` / cached check | Exit 0; no whitespace errors | `git-integrity-final.log`               |

Prisma client and Next route types generated successfully as part of typecheck. No schema or migration was changed.

## P. Merge and staging state

All unmerged index entries are cleared. `apps/web/e2e/attendance.spec.ts` was staged to mark the resolved conflict. Git’s merge operation staged the other cleanly merged incoming paths. No unrelated working changes existed before the merge. The verification report is separate and remains unstaged; ignored logs live under `test-results/phase7/development-attendance-merge-resolution/`.

## Q. Complete incoming file list

The merge has 47 staged incoming paths:

```text
apps/api/src/features/attendance/attendance.management.ts
apps/api/src/features/attendance/routes.ts
apps/api/tests/features/attendance/management.test.ts
apps/api/tests/features/attendance/policy-management.test.ts
apps/web/e2e/attendance-policy-assignment.spec.ts
apps/web/e2e/attendance.spec.ts
apps/web/e2e/module-scoped-navigation.spec.ts
apps/web/e2e/workspace-selector.spec.ts
apps/web/src/app/(portal)/attendance/check-ins/page.tsx
apps/web/src/app/(portal)/attendance/dashboard/page.tsx
apps/web/src/app/(portal)/attendance/my/page.tsx
apps/web/src/app/(portal)/attendance/page.tsx
apps/web/src/app/(portal)/attendance/policies/assignments/page.tsx
apps/web/src/app/(portal)/attendance/policies/management/page.tsx
apps/web/src/app/(portal)/attendance/policies/overview/page.tsx
apps/web/src/app/(portal)/attendance/records/page.tsx
apps/web/src/app/(portal)/attendance/requests/corrections/page.tsx
apps/web/src/app/(portal)/attendance/requests/overtime/page.tsx
apps/web/src/app/(portal)/attendance/requests/overview/page.tsx
apps/web/src/app/(portal)/attendance/settings/page.tsx
apps/web/src/app/(portal)/attendance/time-logs/audit/page.tsx
apps/web/src/app/(portal)/attendance/time-logs/overview/page.tsx
apps/web/src/app/(portal)/attendance/time-logs/records/page.tsx
apps/web/src/components/layout/breadcrumbs.tsx
apps/web/src/components/layout/sidebar.tsx
apps/web/src/features/attendance/api/attendance-api.ts
apps/web/src/features/attendance/components/attendance-policy-details-panel.tsx
apps/web/src/features/attendance/components/attendance-shell.tsx
apps/web/src/features/attendance/model/navigation.ts
apps/web/src/features/attendance/pages/attendance-adjustments-page.tsx
apps/web/src/features/attendance/pages/attendance-audit-page.tsx
apps/web/src/features/attendance/pages/attendance-dashboard-page.tsx
apps/web/src/features/attendance/pages/attendance-overview-page.tsx
apps/web/src/features/attendance/pages/attendance-policies-overview-page.tsx
apps/web/src/features/attendance/pages/attendance-policy-assignments-page.tsx
apps/web/src/features/attendance/pages/attendance-requests-overview-page.tsx
apps/web/src/features/attendance/pages/time-logs-overview-page.tsx
apps/web/src/features/dashboard/model/workspace-modules.ts
apps/web/src/features/workload/components/workload-planning-context.tsx
apps/web/src/features/workspaces/model/route-policy.ts
apps/web/test/attendance.test.mjs
apps/web/test/route-policy.test.mjs
apps/web/test/workspace-modules.test.mjs
apps/web/test/workspace-selection.test.mjs
docs/features/attendance-interface.md
docs/features/staff-workload.md
docs/modularization.md
```

This task adds this report as one separate, unstaged documentation file. It did not author independent changes to application source; the staged API/web application changes above are from the requested incoming development commit. Therefore a literal claim that “no application source changed in the merge” would be inaccurate.

## R. Remaining limitations

The historical verifier cannot complete the global assertion-site reconciliation because it exits on pre-existing PW identity/declaration mismatches. The five historical opt-in live-backend cases were not run against a live backend. S16-001 remains open. `origin/development` was not fetched, so any remote commit newer than the local ref was not inspected.

## S. Final Git facts

Expected final review state: branch still `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages`; `HEAD` still `ed675cd3ccfd74f2286663ca99b1abc4c3ab6dfe`; `MERGE_HEAD` remains `7f8d40bd12c19d6ac258169d751c535008f65c93`; `git ls-files -u` is empty. No commit, push, force-push, reset, abort, branch switch, or rebase occurred.

## T. Manual merge completion

Review the staged incoming changes and this report. When ready to create the merge commit, run `git merge --continue` (or the repository’s normal merge-commit flow). Do not continue until your review is complete. This task leaves the merge active and does not commit or push.

## U. Stop condition

Stop at the completed merge-resolution review. Page 17 and Phase 7.5 were not started.

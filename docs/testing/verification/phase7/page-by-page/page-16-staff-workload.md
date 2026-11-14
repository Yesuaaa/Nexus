# Phase 7.4.1 — Page 16: Staff Workload

**Verification date:** 2026-11-14 (Asia/Singapore)  
**Route:** `/staff-workload`  
**Status:** **COMPLETE WITH VERIFIED DEFECTS**  
**Recommendation:** Submit Page 16 for administrative review. Codex does not administratively accept it.

## A. Page status

The source audit, regression coverage review, focused browser/API checks, compatibility run, and required quality gates are complete. One reproducible UI defect remains in local workload pagination and is preserved by failing regression `[P16-WEB-003]`. No application code was changed. This report recommends administrative review with that finding visible.

## B. Git baseline and development integration

At task start, the branch was clean and at `e58c26e603bdfc920c1b0b3205e109cfcae3ea8a`. The current branch remains `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages`, tracking the same upstream commit (`+0/-0`). Current changes are limited to test files and this report; no files are staged.

The recent history includes Page 15 at `e58c26e`, merge #256 at `b7de804`, and the Attendance and monitoring integration at `8da5cc7` (merge #255). The latter introduced Attendance policy/record behavior, workload planning context, calendar query changes, and 22 browser cases across `attendance.spec.ts` and `attendance-policy-assignment.spec.ts`. It also added PGlite Attendance/availability coverage. These contracts were rechecked against the current source rather than assumed from prior test expectations.

## C. Source inspection

- **Frontend route:** `apps/web/src/app/(portal)/staff-workload/page.tsx` renders `WorkloadPage` from `apps/web/src/features/workload/pages/workload-page.tsx`.
- **Frontend components/model:** `workload-week-input.tsx`, `capacity-fields.tsx`, `workload-row-actions.tsx`, `workload-details-drawer.tsx`, `workload-kpi-cards.tsx`, `workload-planning-context.tsx`, and `model/workload.ts`.
- **Frontend data flow:** `useAsyncResource` reads `/api/workload?week=...`; successful mutations retry the current read. Search, team/availability filters, and pagination run in the browser with `useLocalTable`.
- **Backend:** `apps/api/src/features/workload/workload.controller.ts` is mounted at `/api/workload`; it calls current-department-head authorization and `workloadPlanningContext` from `workload-availability.service.ts`.
- **Related sources:** Attendance policy assignments supply daily policy context; shared calendar queries supply limited known head commitments. Project/request relations supply eligible projects and allocations.
- **Feature documentation:** `docs/features/staff-workload.md`, `docs/features/attendance-backend.md`, `docs/features/attendance-availability-plan.md`, and calendar documentation were compared to source. The current KPI component renders four statistics and an assigned-hours progress meter; older chart descriptions in feature documentation are not all present in this component.

## D. Complete feature inventory

- Lists department employees with an active STAFF account, ordered by full name. Employee HR status may be ACTIVE, ON_LEAVE, or INACTIVE.
- Shows total staff, active staff marked Available, capacity-weighted utilization, and overloaded staff. Utilization includes active staff with recorded capacity and no unknown assignment hours.
- Displays specialties, team, assigned/capacity hours, utilization meter, availability label, “Time slots unconfirmed,” and a conflict label when supported known commitments overlap.
- Shows current-week assignments, weekly capacity, daily attendance-policy requirements, known timed commitments, and overlap context in the workload drawer.
- Lists active eligible projects requiring authorized department staffing and supports capacity, assignment, reassignment, and unassignment workflows.
- Provides retryable list errors, loading skeletons, empty-department state, no-filter-match state, and mutation feedback.
- Implements local search, team filtering, availability filtering, and ten-row pagination. The source has no workload sort control.
- Does not aggregate project tasks, task statuses, task due dates, employee shifts, dated leave, or confirmed free-time slots. `Project.workPlan` exists in the schema but is not read by this page.

## E. Interactive control inventory

- **Week selector:** accessible date picker in week mode. Selecting any date normalizes to Monday; changing week clears prior rows and closes the selected employee detail view before reloading.
- **Search:** `Search staff` matches full name, position, and specialties, case-insensitively.
- **Filters:** `Filter by team` (All Teams plus present teams) and `Filter by availability` (All Availability, Available, Near capacity, Overloaded, Needs setup, Unavailable, On leave, Inactive).
- **Staffing attention:** `Assign staff` opens the project attention dialog and count. Projects without allocations can open the assignment form. Ineligible former staff allocations expose Reassign and Remove. Close returns to the directory.
- **Row actions:** View workload, Edit capacity, Assign to project, Reassign, and Unassign. Assignment actions are disabled for non-active staff or when no eligible project is available; reassign/unassign are disabled without allocations.
- **Details drawer:** per-allocation Edit allocation and Unassign controls; Edit capacity, Done, and close controls. The unassign action uses a confirmation dialog.
- **Capacity dialog:** scheduled and time-off hours, live calculation, Cancel, Save capacity, and retryable error alert.
- **Assignment dialog:** Project and Staff selectors, Hours per week, End date, projected utilization/remaining/over-capacity feedback, Cancel, and Confirm assignment. Reassignment preselects and locks the project.
- **Multiple assignment picker:** lists an employee’s projects for selection before reassign/unassign.
- **Pagination:** Previous, numbered-page, and Next controls plus a live “Showing … of …” summary under the workload table.
- **Accessibility/responsive source:** named workload regions, labels for search/date/filter/fields, action labels, dialogs, and pagination navigation. The main table scrolls inside its own horizontal region at narrow widths.

## F. Workload calculations

For an employee with a recorded weekly capacity:

```text
effective capacity = max(0, scheduled hours − time-off hours)
assigned hours = sum(weeklyHours ?? 0) across assignments overlapping the selected week
utilization = round(assigned hours ÷ effective capacity × 100) when capacity > 0
```

Any null assignment hours marks the total as unknown. The row suppresses a numeric utilization and displays unrecorded hours; unknown hours are not treated as free capacity. Missing capacity produces Needs setup for an active employee. An active employee is Overloaded when assigned hours exceed capacity, Near capacity at utilization ≥90%, Unavailable at zero capacity with no assigned hours, and Available below 90%. Non-active HR statuses display On leave or Inactive before capacity thresholds are considered.

KPI utilization is capacity weighted: total assigned hours divided by total recorded effective capacity for active employees with no unknown allocation hours. The average is not the arithmetic mean of each employee’s percentage. Total staff includes all returned staff; Available counts only active employees; Overloaded excludes unrecorded-capacity/unknown-hour cases.

Assignments are counted at the full weekly amount in each week whose date range overlaps the allocation. The backend does not prorate weekly hours by partial allocation dates. Over-capacity allocation is allowed and is surfaced in the UI rather than blocked.

## G. Attendance integration

The weekly planning context reads effective AttendancePolicyAssignment records and each assigned policy’s seven day targets. Work dates are labels for the selected Monday–Sunday week; policy time zones are shown. An explicit rest day contributes zero when configured. `totalHours` is unknown if any day’s required minutes are unknown; `knownHours` sums only known daily targets.

Actual clock-in sessions, completed work hours, breaks, or overnight attendance are not included in workload capacity, assignments, or availability. Existing PGlite tests verify that actual/overnight hours do not change planning or allocations. Attendance is policy context, not task or productivity proof.

## H. Availability integration

Availability is a weekly capacity estimate, not a schedule of confirmed free slots: the API always returns `confirmedAvailableSlots: null`, and the UI says time slots are unconfirmed. There is no employee shift/roster or future-dated leave approval model in this workload feature. Current employee statuses ON_LEAVE/INACTIVE are labels, not date-range availability calculations.

Known consultations and meetings are fetched only for the current department head within the selected week. Project staff membership does not imply meeting attendance; other employees receive no inferred commitments. Meetings are not subtracted from weekly capacity. Strict interval overlap (`a.start < b.end && b.start < a.end`) marks actual overlaps; adjacent intervals do not conflict.

## I. Task/project assignments

The page uses `ProjectStaff` allocations, not task records. Workload assignments are filtered to projects in PLANNED, IN_PROGRESS, or ON_HOLD state whose allocation dates overlap the week. The assignment picker offers projects whose accepted request belongs to the current department, workflow is READY_FOR_ACTIVATION or ACTIVE_PROJECT, and project state is PLANNED or IN_PROGRESS.

New allocations require an ACTIVE employee with an active STAFF login in the department. Stale allocations remain visible in staffing attention as ineligible and can be reassigned or removed. Reassignment upserts the new allocation and deletes the previous employee allocation in one transaction. A successful allocation also records a workflow event and notification where the project has a request.

No task ownership, task status, task distribution, or task completion calculation is present in this route or its API payload. This is an explicit implementation boundary, not an untested assumption of task functionality.

## J. Input validation

| Input                       | Frontend                                                                             | Backend                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Selected week               | Week date picker normalizes selection to Monday                                      | Required valid `YYYY-MM-DD` Monday; malformed/non-Monday date returns 400                                                     |
| Capacity scheduled/time-off | Required numeric inputs, min 0, max 168, step 0.25; time off cannot exceed scheduled | Finite numbers 0–168; `timeOffHours <= scheduledHours`; employee ID required; out-of-department/no active account returns 404 |
| Assignment weekly hours     | Required number, min 0.25, max 168, step 0.25                                        | Finite value greater than 0 and at most 168                                                                                   |
| Assignment end date         | Required date, min selected Monday                                                   | Valid `YYYY-MM-DD`, on or after starting Monday                                                                               |
| Project/staff               | Required selectors; eligible active choices                                          | Project/request must be authorized for department; staff must have active status and active STAFF account                     |

The UI advertises quarter-hour increments, but the backend validates numeric ranges rather than enforcing multiples of 0.25. The source does not establish that the backend must reject other fractions; this was recorded as an API/UI validation boundary, not a confirmed defect. Over-capacity is explicitly permitted and reported.

## K. API contracts

All workload routes require authentication and recheck current department-head status on each request. Mutations use Prisma transactions.

| Method and route                      | Contract and persistence                                                                                                                                                                                                                     | Notable errors                                                                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/workload?week=YYYY-MM-DD`   | Returns department, week, staff, weekly capacity, overlapping assignments, eligible projects, attendance-policy context, and supported current-head commitments. Staff are ordered by full name. Read runs in a repeatable-read transaction. | 401 unauthenticated; 400 invalid/non-Monday week; 403 not current department head                                                                      |
| `PUT /api/workload/capacity`          | Upserts unique employee/week capacity; returns `{ saved: true }`.                                                                                                                                                                            | 400 invalid hours/week/employee input; 404 employee not in head’s department or no active account; 403 unauthorized head                               |
| `PUT /api/workload/assignment`        | Upserts project/employee allocation; optional `previousEmployeeId` transfers the allocation atomically; returns `{ saved: true }`.                                                                                                           | 400 missing IDs, invalid weekly hours/week/date; 404 missing prior assignment; 409 project not authorized or staff not eligible; 403 unauthorized head |
| `DELETE /api/workload/assignment/:id` | Deletes only an assignment whose project request is accepted by the current head’s department; returns `{ saved: true }`.                                                                                                                    | 404 missing/out-of-scope assignment; 403 unauthorized head                                                                                             |

Capacity accepts employees whose active STAFF account remains in the department even if HR status is not ACTIVE; new project assignments require ACTIVE status. No API endpoint writes task assignments or calculates confirmed availability.

## L. Authorization matrix

| Actor                         | Frontend `/staff-workload`                             | Backend `/api/workload`                                                                |
| ----------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Current department-head STAFF | Allowed                                                | Allowed only for the department currently headed; role/headship rechecked each request |
| Other STAFF                   | Redirected/denied; no workload request                 | 403                                                                                    |
| ADMIN                         | Internal route denied; no workload request             | 403; no administrator override                                                         |
| SUPERADMIN                    | Internal route denied; no workload request             | 403; no superadmin override                                                            |
| USER                          | Redirected to client `/dashboard`; no workload request | 403                                                                                    |
| Unauthenticated               | Authentication flow required                           | 401                                                                                    |

Department isolation is applied to staff, project/request, capacity, and delete queries. Cross-department or transferred employees cannot be newly allocated by the current head. Existing former allocations are represented as ineligible for correction.

## M. Database integrity

- `WorkloadCapacity` belongs to Employee, cascades on employee deletion, and has a unique `(employeeId, week)` key. It stores `scheduledHours`, `timeOffHours`, and `updatedById`.
- `ProjectStaff` belongs to Project and Employee with restrictive delete relations, is unique on `(projectId, employeeId)`, and stores nullable `weeklyHours`, allocation dates, and approval metadata.
- `Project` has an optional restrictive ServiceRequest relation, JSON `workPlan`, `staff[]`, and other workspace relations. `workPlan` task data is not aggregated by workload.
- GET aggregation is assembled in a repeatable-read transaction. Capacity upsert, assignment/reassignment side effects, and deletion run transactionally. API regressions cover scoped persistence and idempotent capacity writes.

## N. Existing regression coverage

Before Page 16 additions, Playwright discovery was **483 tests in 66 files**. Page 15’s accepted report records the carried-forward 292 original PW identities, 1,630 assertion sites, and 4,211 ownership mappings.

Existing Page 16-relevant coverage included:

- Two large browser cases in `apps/web/e2e/staff-workload/staff-workload.spec.ts` covering capacity, assignment/reassignment/removal, project staffing, over-capacity indicators, week selection, keyboard/mobile calendar use, empty states, and utilization calculations.
- 22 Attendance/availability browser cases across `attendance.spec.ts` and `attendance-policy-assignment.spec.ts`, including workload planning drawer viewports.
- `apps/web/test/workload.test.mjs` for capacity, unknown assignment hours, and current HR status semantics.
- PGlite tests in `api-system-regression.test.ts`, `request-inbox.test.ts`, and `features/workload/availability.test.ts` for workload scope, role/current-head checks, capacity persistence/validation, allocation rules, policy context, calendar scope, and independence from actual attendance hours.

The workload UI suite had no direct assertions for API read failure/retry, retention of entered values after a rejected capacity write, local team/availability filtering, or the pagination-reset contract. No existing browser assertion was found for restoring the first page after clearing a filtered search.

## O. Coverage gaps

Addressed by this task:

- `[P16-WEB-001]` read failure, visible alert, retry, and recovery.
- `[P16-WEB-002]` rejected capacity mutation retains entered values and permits a successful retry.
- `[P16-WEB-003]` search matches name, position, and specialty; page reset after clearing a narrowed search. This exposes the verified defect below.
- `[P16-WEB-004]` team and availability filters return the expected employee rows.

No sort control exists, so no sort test was added. Existing API tests already cover workload authorization, persistence, and allocation behavior, so duplicate API tests were not added.

## P. New browser tests

Added `apps/web/e2e/staff-workload/page-16-regression.spec.ts`:

| ID          | Coverage                                                                                            | Result            |
| ----------- | --------------------------------------------------------------------------------------------------- | ----------------- |
| P16-WEB-001 | First workload read returns 503; accessible alert and Retry; second GET renders staff               | Pass              |
| P16-WEB-002 | Capacity PUT returns 409 then 200; values stay in dialog and successful retry refreshes calculation | Pass              |
| P16-WEB-003 | Search name/position/specialty on page 2, then clearing search should return to page 1              | **Fail: S16-001** |
| P16-WEB-004 | Team filter and Overloaded availability filter select matching rows                                 | Pass              |

The tests use deterministic route mocks. They verify browser state and payloads, not backend persistence. Existing workload browser tests remain unchanged.

## Q. New API tests

No new API tests were added. The existing isolated PGlite workload, request-inbox, and availability suites already cover the backend authorization, department scoping, capacity persistence/validation, assignments, and planning behavior needed for this page. Their relevant execution is recorded below.

## R. Execution results

| Command / selection                                                                                                                                     |                                                                                                    Result | Evidence                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------: | ----------------------------------------------------- |
| `pnpm --filter @nexus/web exec playwright test e2e/staff-workload/staff-workload.spec.ts e2e/staff-workload/page-16-regression.spec.ts --workers=1`     |                                                                     6 total; 5 passed, 1 failed (S16-001) | `page16-browser-final-run-53.log`                     |
| `pnpm --filter @nexus/api exec tsx --test tests/api-system-regression.test.ts tests/request-inbox.test.ts tests/features/workload/availability.test.ts` | TAP 25 total entries; 22 unique leaf cases passed, 0 failed; three parent suites excluded from leaf count | `page16-api-pglite-run-26.log`                        |
| `pnpm --filter @nexus/web exec node --experimental-strip-types --test test/workload.test.mjs`                                                           |                                                                                        2 passed, 0 failed | `page16-workload-unit-run-27.log`                     |
| Attendance, policy assignment, portal authorization, and calendar compatibility selection (`--workers=1`)                                               |                                                                                       35 passed, 0 failed | `cross-module-browser-final-run-38-single-worker.log` |
| `pnpm --filter @nexus/web exec playwright test --list`                                                                                                  |                                                                487 tests in 67 files after four additions | `final-discovery-run-49.log`                          |
| `pnpm format`                                                                                                                                           |                                                                                                    Exit 0 | `quality-format-final-run-50.log`                     |
| `pnpm lint`                                                                                                                                             |                                                                                     Exit 0; zero warnings | `quality-lint-final-run-51.log`                       |
| `pnpm typecheck`                                                                                                                                        |                                                                                    Exit 0 for web and API | `quality-typecheck-final-run-52.log`                  |

Playwright’s local web server builds the web app and the Attendance browser fixture runs in PGlite. The specific workload route tests use intercepted API responses. The API run uses only in-memory PGlite; no shared or production database was used.

## S. Defect register

| ID      | Severity | Finding                                                                                                                                                                                                                                                                                                                              | Evidence/status                                                                                                                      |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| S16-001 | Medium   | Clearing a search from page 2 restores the previous page 2 (“Showing 11–12 of 12”) instead of resetting to page 1. `useLocalTable` documentation says the page returns to 1 whenever the view changes, but a restored identical prior view reuses its stored page. The Next button remains disabled because page 2 is the last page. | Reproduced in focused and final Page 16 runs; failing regression `[P16-WEB-003]` remains. No application fix was authorized or made. |

No other Page 16 application defect was confirmed. The API/UI quarter-hour validation boundary is recorded in Section J but has no established server-side increment requirement.

## T. Historical defect reassessment

The previously documented legacy verifier discrepancies PW-149, PW-037, and PW-001 remain. The legacy verifier was not rerun, and this report does not claim a fresh identity/assertion/mapping reconciliation. The accepted Page 15 findings S15-001 and S15-002 and other historical issues were not reassessed as resolved by this Page 16 task. Page 7’s team-lead-removal limitation remains outside this route.

The historical shared pagination issue was not assumed to apply. Staff Workload uses `useLocalTable`, not the separate `usePaginatedList` hook. The new test independently reproduced S16-001 in this `useLocalTable` view-restoration path; whether the earlier shared-hook issue is the same defect is not asserted.

## U. Integration limitations

- No live frontend/API/database integration or production data run was performed. Workload page browser tests use mocks; backend tests use PGlite. The Attendance browser compatibility suite routes API calls to its local PGlite fixture.
- Calendar integration is limited to supported known current-head meetings/consultations. It does not infer attendance for project staff or promise free time.
- Tasks, task statuses, dated leave, shifts, and confirmed available time slots are not workload features in the inspected source.
- The legacy migration verifier was not run; historical counts are carried forward from accepted records.

## V. Historical preservation

The accepted historical inventory remains 292 original Playwright identities, 1,630 assertion sites, and 4,211 ownership mappings; these are carried forward, not newly verified here. Page 16’s baseline identities are PW-095, PW-098, PW-101–105, and PW-267–268. The final discovery count is separate from historical identity/mapping counts.

No Page 1–15 feature tests, reports, baseline artifacts, or ownership mappings were changed. The changed Attendance spec is part of the recent development integration, not an accepted Page 1–15 page spec. Earlier Page 15 report and evidence remain intact.

## W. Files changed

| Path                                                                      | Change                                                                                                      |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `apps/web/e2e/staff-workload/page-16-regression.spec.ts`                  | Four new Page 16 browser cases; P16-WEB-003 intentionally remains failing for S16-001                       |
| `apps/web/e2e/attendance.spec.ts`                                         | Test-only fixture routing and independence corrections found during cross-module compatibility verification |
| `docs/testing/verification/phase7/page-by-page/page-16-staff-workload.md` | This A–X verification report                                                                                |

Execution logs and screenshots under `test-results/phase7/page-by-page/page-16-staff-workload/` are ignored evidence artifacts. No app code, API business logic, schema, migration, dependency, lockfile, or generated test artifact was committed.

## X. Final recommendation

Submit Page 16 for administrative review as **COMPLETE WITH VERIFIED DEFECTS**. S16-001 is reproducible and has a retained failing regression. Fixing it requires separate authorization to change application code. Stop at Page 16; do not begin Page 17, Phase 7.5, or production-readiness work.

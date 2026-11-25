# PG-012 Functional Discovery

**Phase:** 2.1 source discovery and test design only  
**Status:** Source discovery complete; test execution not authorized or performed  
**Approved feature anchor:** `PG-012-F001` — Submit/review overtime requests according to the current workflow stage

## Repository baseline and reconciliation

- Branch: `293-test-full-system-audit-for-verifying-recent-changes`
- Task-entry HEAD: `050fbc2b46b3a77d8785cf76a07c8c0a5c498e26`
- Previously reported HEAD: `9b4d3936d425d4c743bea6bc021f0daf10b585d6`
- Task-entry worktree: clean; no staged, unstaged, or untracked files.
- HEAD is one commit after the reported baseline: `test(PAGE-011): add tests, unit tests, and qa documentation`. It contains the intervening PG-011 test and QA report work. That work is committed and was not changed here.
- No branch or commit operation was performed. The current source tree is the implementation baseline.

## Approved identity

| Field                  | PG-012 identity                                                                                                                      | Evidence                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Stable ID              | `PG-012` / `PG-012-F001`                                                                                                             | `docs/qa/page-verification/PHASE_1_COMPLETE_ROUTE_INVENTORY.md:22`; `PHASE_1_PAGE_FUNCTIONALITY_INVENTORY.md:18` |
| Canonical URL          | `/attendance/requests/overtime`                                                                                                      | Phase 1 route inventory row 22                                                                                   |
| Next.js route          | `apps/web/src/app/(portal)/attendance/requests/overtime/page.tsx`                                                                    | Route inventory row 22; current route file:1-16                                                                  |
| Primary component      | `AttendanceAdjustmentsPage`, with `requestType="OVERTIME"`                                                                           | Route file:1-16; `apps/web/src/features/attendance/pages/attendance-adjustments-page.tsx:45-51`                  |
| Module                 | Workforce Compliance / Attendance                                                                                                    | Phase 1 route inventory and component mapping row 33                                                             |
| Feature directory      | `apps/web/src/features/attendance/`                                                                                                  | Current imports from the route and primary component                                                             |
| Navigation             | Attendance navigation item `attendance-overtime`, label `Overtime`                                                                   | `apps/web/src/features/attendance/model/navigation.ts:55-59`                                                     |
| Query navigation       | `?request=<adjustmentId>` opens a typed detail view; notification navigation is covered by an existing real browser/API/PGlite flow  | Route file:2-14; `apps/web/e2e/attendance.spec.ts:4731-4795`; `attendance-adjustments-page.tsx:79-93,123-131`    |
| Redirect aliases       | None identified for PG-012 in the Phase 1 route/alias inventory or current route file. `request` is a query deep link, not an alias. | Phase 1 route inventory; current source route file:1-16                                                          |
| Mapping reconciliation | Phase 1 route, component, module, and feature claims agree with current source. No identity discrepancy found.                       | Phase 1 route/component/functionality inventories; route file and component above                                |

## Layout, account context, and shared components

The route sits below the portal route group and receives the portal account through `usePortalAccount`. The attendance feature shell selects the Overtime tab. The page uses `useAsyncResource`, `SearchField`, `FilterSelect`, `ManagementViewToggle`, `ResourceStatus`, `AttendancePagination`, `AttendanceAdjustmentTable`, `AttendanceAdjustmentReviewPanel`, `RowActionsMenu`, and shared side-panel primitives. `AdjustmentDialog` is imported by the shared page, but its render condition excludes `requestType="OVERTIME"` (`attendance-adjustments-page.tsx:220-228,337-343`).

The page does not define a separate data hook or page-specific API controller. Its `useAsyncResource` callback invokes the attendance API client. The Express attendance router applies `requireAuth`, validates `adjustmentId` route parameters, and delegates adjustment reads/writes directly to the attendance management service (`apps/api/src/features/attendance/routes.ts:11-18,101-128`). Clock-out is a separate path through the attendance controller/service and `submitRecordedOvertime` (`attendance.service.ts:277`; `attendance.overtime.ts:130-245`).

## Access and security boundaries

Phase 1 authorizes active `STAFF` and `ADMIN`, plus `SUPERADMIN` with `employees:read` (`PHASE_1_PAGE_AUTHORIZATION_MATRIX.md:37`). Current attendance navigation marks Overtime as `access: "self"`; route policy and `canAccessPersonalAttendance` provide the frontend gate. The shared component computes `manager` and `selfService` separately. Manager users initially receive team scope; users without management capability use `mine`. A manager who also has personal attendance access can switch between team and personal views (`attendance-adjustments-page.tsx:53-57,276-297`).

Frontend visibility is not backend authorization. The Express router requires authentication (`routes.ts:16`) and the attendance router mounts at `/api/attendance` (`apps/api/src/app.ts:131`). Backend management methods independently resolve self, department, organization permission, current Head, employee ownership, request type, and workflow-stage capability. Hidden out-of-scope records return not-found responses for detail reads; review checks ownership and the current organization/department scope (`attendance.management.ts:358-405,1327-1378,1600-1675`). `SUPERADMIN` organization visibility depends on `employees:read`; `ADMIN` team scope is further constrained by `hrAdjustmentScope`.

## Page initialization and read behavior

1. The route awaits `searchParams`, accepts a string `request`, and remounts the component with `key={requestId}` (`page.tsx:2-14`).
2. With a linked ID, the page requests one detail record and rejects a non-`OVERTIME` record as 404. Without one, it requests the queue using the selected page, settled search, fixed type `OVERTIME`, status, and effective `mine`/`team` scope (`attendance-adjustments-page.tsx:77-119`).
3. Search updates wait 200 ms before the resource fetch; while unsettled the list is disabled and shown as loading (`:58-64,115-122`).
4. The shared table renders five skeleton rows while loading, a retryable error row on failure, a shared empty message when no rows exist, or the result rows (`attendance-adjustment-table.tsx:116-176`).
5. The API allows `scope`, `page`, `search`, `type`, and `status`; validates the status/type enumerations, parsed page/search, and a 100-character search maximum; applies current scope, filters, created-time/ID descending order, and pagination in a RepeatableRead transaction (`attendance.management.ts:1416-1504`).

Controls on the typed Overtime route are search, status, optional manager scope switch, pagination, row-action menu, and detail/review panel. There is no sort control, date filter, upload/download action, or manual request button on this page. The request-type filter is hidden because the route supplies `requestType`; the request button and dialog are also omitted for `OVERTIME` (`attendance-adjustments-page.tsx:220-228,242-257,276-297,337-343`).

## Table and detail presentation

Rows display employee identity, requested overtime minutes, type, start/end timestamps, reason, status, and available actions. Table dates use the browser/device timezone captured with `Intl.DateTimeFormat().resolvedOptions().timeZone`. The responsive grid rearranges fields at container widths up to 1000 px (`attendance-adjustments-page.tsx:145`; `attendance-adjustment-table.tsx:117-139,177-249`).

The read-only or review side panel displays the request title, employee, overtime duration, status, overtime period in the device timezone, reason, review note/reviewer, department verification note, and workflow text. A typed deep link opens that panel when the backend returns a visible Overtime record. Missing, mismatched-type, or out-of-scope records do not expose the requested record details (`attendance-adjustment-review-panel.tsx:58-89,104-167`; `attendance-adjustments-page.tsx:79-93,123-132`).

## Review workflow and state transitions

| Current state / actor                            | Source-defined action                                                                                                                                   | Result                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `PENDING` / current Department Head              | Approve action is labeled “Verify overtime”; backend rechecks current Head, ownership, department, status, attendance session, and overtime calculation | `VERIFIED`, with verifier, timestamp, and verification note; HR notification is created  |
| `PENDING` / current Department Head              | Reject                                                                                                                                                  | `REJECTED`; requester and authorized organization recipients are notified                |
| `VERIFIED` / authorized HR (`ADMIN`)             | Approve                                                                                                                                                 | `APPROVED`, with reviewer, timestamp, and review note                                    |
| `VERIFIED` / authorized HR (`ADMIN`)             | Reject                                                                                                                                                  | `REJECTED`, with reviewer data and notification                                          |
| `PENDING` or `VERIFIED` / permitted `SUPERADMIN` | Approve or reject at either stage                                                                                                                       | Terminal `APPROVED` or `REJECTED`; the Head stage may be bypassed for Superadmin         |
| Own request / any reviewer role                  | Review                                                                                                                                                  | Backend denies the owner; page relies on returned capability flags for action visibility |

The UI permits submission only when the current row’s backend capability matches the manager/team scope and chosen action (`attendance-adjustments-page.tsx:136-144,146-209,320-327`). The panel requires a review note of 5–2000 characters, disables decision controls while pending, offers Cancel/Confirm, shows API errors, and closes after a successful handler result (`attendance-adjustment-review-panel.tsx:92-99,168-213`). Server review accepts only `APPROVED`/`REJECTED` and applies the same minimum note length (`attendance.management.ts:1600-1610`).

On Overtime review conflicts, the page handles 401/403/404 and selected 409 conflicts by reloading detail. It replaces stale content with the current read-only record when still visible; otherwise it clears private detail state and retries the list (`attendance-adjustments-page.tsx:33-43,166-205`). The database review transaction locks the department, employee, user, and adjustment rows, then recalculates scope and lifecycle state before persisting (`attendance.management.ts:1610-1658`).

## API and persistence trace

| Layer              | Source-defined responsibility                                                                                                                                                                         | Evidence                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Web API client     | GET detail, GET filtered list, POST adjustment, POST review; same-origin `/api/attendance` root                                                                                                       | `apps/web/src/features/attendance/api/attendance-api.ts:400-449`                               |
| Express routes     | Authenticated `GET /adjustments/:adjustmentId`, `GET /adjustments`, `POST /adjustments`, `POST /adjustments/:adjustmentId/review`; no separate controller for these management calls                  | `apps/api/src/features/attendance/routes.ts:16-18,101-128`; mount in `apps/api/src/app.ts:131` |
| Management service | Scope/query validation, list/detail projection, request creation/idempotency, overtime calculation, review capability/state checks, transactions, conflict responses                                  | `attendance.management.ts:273-405,1327-1378,1416-1770`                                         |
| Clock-out path     | Completed workday/session calculation; unpaid breaks and previously claimed windows are removed; creates pending overtime when eligible excess exists                                                 | `attendance.service.ts:277`; `attendance.overtime.ts:130-245`                                  |
| Notifications      | Pending-review and lifecycle notices use workflow notifications; current review authority and active-account state affect recipients                                                                  | `attendance.overtime.ts:11-70`; `attendance.pending-notifications.ts`                          |
| Prisma/database    | `AttendanceAdjustment`, `AttendanceWorkSession`, `AttendanceWorkday`, `AttendanceBreak`, `Employee`, `Department`, `User`, `WorkflowNotification`, attendance audit records and related leave records | `apps/api/prisma/schema.prisma:1227-1247,1510-1637`; transaction code above                    |

Manual API submission with `type="OVERTIME"` exists and is covered by API tests; PG-012 itself does not expose a manual form. Clock-out also automatically submits eligible overtime. The product expectation for whether PG-012 should ever offer manual entry is therefore left open; this report does not infer that a button is missing or required.

## Accessibility, responsive behavior, and shared risks

- The list has an accessible table label and `aria-busy`; search/filter controls have labels; each menu trigger has employee-specific accessible names (`attendance-adjustment-table.tsx:117,235-240`; page `:232-274`).
- The review note is labeled and has HTML required/min/max validation. The shared `SidePanel` uses dialog primitives, supports Escape handling, busy/dismissal control, and focus restoration (`side-panel.tsx:66-124`; review panel `:173-183`).
- The shared `RowActionsMenu` is used by the Overtime rows (`attendance-adjustment-table.tsx:13-16,235-249`). It is associated with confirmed defect `PG-004-D-001`, reproduced on PG-004, PG-006, PG-008, PG-010, and PG-011. This is a targeted risk only; no PG-012 reproduction was run.
- PG-006/T024 remains intermittent at 820 px. PG-011 had a route-fetch teardown intermittent and an Edit-menu timeout. These are retained as cross-page reliability context, not attributed to PG-012.

## Discovery limits and contracts

1. **Empty-state wording:** the shared table’s empty copy asks the user to submit “an attendance correction or an overtime request,” while the Overtime route hides the request dialog and says overtime is submitted automatically at clock-out (`attendance-adjustment-table.tsx:171-175`; page `:299-305,337-343`). Product wording is unresolved. Do not assert exact empty text until clarified; this does not establish a PG-012 defect.
2. **Manual Overtime entry:** the backend accepts explicit Overtime submissions, while this route exposes no form. Product intent for UI entry is unresolved; API behavior remains source-testable.
3. **Timezone basis:** UI source explicitly uses the device timezone. The page-level display is testable with a controlled browser timezone; it does not establish an organization-timezone requirement.
4. **Runtime status:** no PG-012 tests were executed in this phase. Source inventory and historical results do not establish current pass/fail behavior.

## Source/documentation reconciliation

Phase 1 maps PG-012 to this exact route, shared page component, Attendance API family, and Workforce Compliance module. Its API-dependency map intentionally groups PG-003–PG-015 at the Attendance domain boundary, so this report expands the route-level calls without treating the grouped Phase 1 record as a mismatch. Phase 1 coverage is `PARTIAL` for the two-stage workflow and boundary input details (`PHASE_1_EXISTING_TEST_COVERAGE.md:42`).

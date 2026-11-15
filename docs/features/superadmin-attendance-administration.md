# Superadmin Attendance & Monitoring administration (Phase 3C.1)

Developed: 2026-11-14

## Audit and confirmed issues

The Phase 2B registry already enters Attendance & Monitoring at `/attendance/dashboard`. Superadmin has organization-wide management reads through the existing `employees:read` permission and policy configuration through `employees:manage`. Management services resolve the active account without requiring an Employee record. Personal endpoints use `selfEmployee`, which independently limits self-service to Staff/Admin and requires their linked Employee. Existing summaries, records, employee history, adjustments, policies and policy assignments already support legitimate Superadmin access; no new page, global bypass or wider scope is needed.

Confirmed UI gaps: correction lists offered **Request correction**, and both request lists and summaries offered **My requests** to Superadmin even though the backend rejects self-service. Review menus also inferred action eligibility from role/status/requester fields rather than backend capabilities, missing the backend's additional employee-ownership guard for legacy/delegated records.

Existing review authority is separate from global administrative capabilities: `managementScope` uses existing employee permissions/current Staff head assignment, forbids self-review, requires Head verification before HR overtime approval, and reserves verified overtime finalization for HR. Policy mutations retain existing configuration permission and validation. Phase 3C.1 does not add approval or policy-management authority.

## Fix boundary

The implementation reuses `canAccessPersonalAttendance` for entry and personal controls. Superadmin request pages remain in organization scope and expose no submission dialog or personal toggle. The list API returns per-request approve/verify/reject eligibility using the same shared eligibility helper as review authorization. These flags describe authorization and stage eligibility only; locks, note/timestamp validation, attendance consistency and all business rules still apply on writes. Backend capabilities control review menu actions and review forms. Self-service eligibility uses Phase 2A operational capability facts from the current account and linked Employee.

Do not change calculations, overnight attribution, policy rules, attendance eligibility, HR approval stages, or existing Admin/Staff/Head scope. Diagnostics and System Logs remain outside this phase.

## Existing access verified

| Function                                 | Existing administrative route/API                                                                   | Result without Superadmin Employee                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Administrative entry/check-in monitoring | `/attendance/dashboard`, `/api/attendance/overview`                                                 | Organization summaries, session statuses and recent activity                                         |
| Time logs and individual history         | `/attendance/time-logs/records`, `/api/attendance/records`, `/api/attendance/employees/:id/history` | Records across departments with existing range/filter/pagination rules                               |
| Attendance corrections                   | `/attendance/requests/corrections`, `/api/attendance/adjustments?scope=team&type=CORRECTION`        | Organization request visibility and existing authorized correction review                            |
| Overtime                                 | `/attendance/requests/overtime`, `/api/attendance/adjustments?scope=team&type=OVERTIME`             | Organization visibility; pending overtime cannot be HR-approved before Head verification             |
| Policies and assignments                 | `/attendance/policies/*`, `/api/attendance/policies`, `/api/attendance/policies/:id/assignments`    | Existing configuration permission supports administrative visibility and existing management actions |
| Attendance record audit                  | `/attendance/time-logs/audit`, `/api/attendance/audit`                                              | Existing attendance-specific audit retained; no centralized Diagnostics/System Logs added            |

The existing module registry destination is retained. `/attendance` now chooses its destination through the existing self-service predicate instead of an explicit Superadmin role branch. Personal overview/check-in aliases remain denied to Superadmin by route policies, and every `/me/*` endpoint plus personal adjustment scope and submission independently rejects that role on the backend. Reads never create/link an Employee or assign a department.

The adjustment list returns top-level `capabilities.requestCorrection` and per-row `capabilities.approve`, `verify`, `reject`. Missing capabilities fail closed in the table. Correction dialogs require both existing frontend self-service eligibility and the backend grant. Review forms recheck the current row's backend capabilities before submitting. A failed list read hides cached request controls/details rather than continuing to show stale authorization.

## Preserved and deferred permissions

- Superadmin/Admin retain their existing employee-permission-based organization reads, policy configuration and HR review authority. No global administrative grant is added to review authorization.
- Current Staff Heads retain department-only monitoring and review; ordinary Staff retain their own requests and attendance. Clients gain no Attendance access.
- Self-review is denied based on both requester identity and employee ownership, including records submitted by a different requester. Pending overtime permits department verification; verified overtime can only be finalized by HR. Existing HR rejection of pending overtime is preserved.
- Extra approval overrides, direct attendance submission on behalf of employees, verification bypasses, new mutation permissions and any ambiguous administrative authority remain deferred. No calculation, overnight, policy, locking, notification or attendance-consistency rule was changed.

## Changed files

- Backend: `apps/api/src/features/attendance/attendance.management.ts` (shared review eligibility and response capabilities).
- Frontend: `apps/web/src/features/attendance/api/attendance-api.ts`; `components/attendance-adjustment-table.tsx`; `pages/attendance-adjustments-page.tsx`; `pages/attendance-requests-overview-page.tsx`; `pages/attendance-entry-page.tsx`.
- Tests: `apps/api/tests/features/attendance/superadmin.test.ts`; `apps/web/e2e/superadmin-attendance.spec.ts`.
- Documentation: this report, `docs/features/README.md`, `docs/features/module-role-access.md`, `docs/features/attendance-interface.md` and `docs/rbac.md`.

## Validation

- `pnpm format`, `pnpm lint`, `pnpm typecheck` and full production `pnpm build` passed.
- All 77 tests in the Attendance API feature suites plus backend regression passed using compiler-emitted JavaScript with offline PGlite. Coverage includes Superadmin without an Employee, multiple departments, policy/assignment reads, overnight values, blocked self-service submissions/reads, per-record capability accuracy, Head/HR stages, actual approval actor attribution, Admin employee-ownership checks, current role revocation, and existing attendance/policy regressions.
- All 104 web unit tests passed.
- 31 selected browser tests passed: Superadmin Attendance administration, policy assignment selection, Superadmin module entry and module-scoped navigation. Tests exercise desktop/mobile records, organization corrections/overtime, policy assignments, personal-route exclusion, absence of personal requests/API calls, backend-denied controls and preserved Admin/Staff/Head personal scopes.

The existing `attendance.spec.ts` real-API browser suite was attempted but its `beforeAll` fixture failed at `tsx` startup (`uv_os_get_passwd ENOMEM`); one test reports the fixture failure and the remaining 23 tests in that file did not run. The command's unanchored filename also matched the three then-existing Superadmin browser tests, which passed; these duplicate passes are not added to the 31-test total. This is the previously observed environment limitation, not an Attendance assertion failure. API tests use the compiled-JavaScript fallback and the same offline harness; no live database was touched.

The previously documented Client-milestone workflow failure was not rerun in this Attendance phase. No new test regressions remain in the executable selected checks. Full repository API/browser suites were not run. All pre-existing uncommitted work is preserved.

# PG-003 Gaps and Dependencies

## Coverage gaps

1. **Role target gap:** Existing direct root-route tests assert the active SUPERADMIN destination. Active STAFF and ADMIN destination selection has no direct browser assertion.
2. **Exact route-policy gap:** Unit coverage checks attendance child routes and navigation links, but not `canAccessRoute(account, "/attendance")` as its own entry gate.
3. **Denial/session gap:** No direct PG-003 browser case was found for USER, inactive accounts, a SUPERADMIN missing `employees:read`, or no session. Shared auth/layout tests on other routes are indirect.
4. **Accessible state gap:** “Opening attendance…” has `role="status"` in source but no current test assertion.
5. **History gap:** Current direct tests assert the final destination, not the `router.replace` history behavior.
6. **Query contract gap (C001):** Approved Phase 1 mapping says query/navigation state may affect the entry decision; current component reads no query/navigation state. The rule is unspecified and requires clarification before an acceptance test can be counted.

## Dependency trace

| Dependency                             | Relationship to PG-003                                                                                                      | Design implication                                                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `PortalLayout` / `useAccount`          | Loads and validates the current signed-in account before the route child renders.                                           | Browser route tests should use the shared regression session fixture; loading, 401, and 503 behavior is shared-shell coverage. |
| `GET /api/auth/me`                     | Supplies the account role, active state, and permissions used by the UI route policy and destination predicate.             | Mock in deterministic browser cases. Do not characterize it as an attendance feature request.                                  |
| `canAccessAttendance` and route policy | Admission rule for exact `/attendance` route.                                                                               | Test the exact URL and role/active/permission matrix at unit and browser layers.                                               |
| `canAccessPersonalAttendance`          | Selects personal destination vs the non-personal destination after route admission.                                         | Unit truth table plus browser role-target checks.                                                                              |
| Attendance API / Prisma models         | No direct dependency from PG-003 source. Used by downstream attendance pages in the broader PG-003–PG-015 Phase 1 grouping. | No PG-003 API/PGlite test; destination internals stay out of scope.                                                            |

## Contract C001 — query/navigation state

- **Source:** Phase 1 component map, `PHASE_1_PAGE_COMPONENT_MAPPING.md:24`, describes a query/attendance-navigation-state redirect.
- **Current implementation:** `AttendanceEntryPage` reads only `usePortalAccount`; its effect selects a fixed path from `canAccessPersonalAttendance` and calls `router.replace`. No `useSearchParams`, query parser, or navigation-state reader exists.
- **Decision needed:** Confirm whether the Phase 1 wording is stale or the page is missing an intended behavior. If behavior is intended, specify accepted keys/values, role precedence, destination and parameter preservation, and behavior for malformed/unknown values.
- **Test treatment:** T010 remains CONTRACT CLARIFICATION REQUIRED and is excluded from implementable case totals. Do not silently write an acceptance test against an invented parameter.

## Implementation readiness

- The source-backed route branches, exact access gate, pending status, and history behavior are sufficiently defined for the eight implementable planned additions/assertions in the test specification.
- T005 is already represented by direct Superadmin E2E source and should be preserved.
- T010 is not implementation-ready until C001 is answered; it does not block the independent cases.
- This assignment authorized design documentation only. Test implementation, test execution, app-source edits, and PG-004 discovery are not part of this handoff.

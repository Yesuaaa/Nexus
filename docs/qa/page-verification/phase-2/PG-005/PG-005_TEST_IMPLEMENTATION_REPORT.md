# PG-005 Test Implementation Report

**Phase:** 2.2 — implementation and focused verification  
**Page:** PG-005, `/attendance/audit`  
**Baseline:** branch `293-test-full-system-audit-for-verifying-recent-changes`, HEAD `64535202df403eb6f3a8e80ff3a7e6385d1dbc2b`  
**Scope:** Implement the 11 approved additions/assertions from the Phase 2.1 inventory. Keep T019/C001 and T020/C002 blocked pending product contracts.

## Implementation status

All 8 `NEW TEST REQUIRED` cases and all 3 `ADDITIONAL ASSERTION REQUIRED` cases were implemented. The seven `EXISTING COVERAGE SUFFICIENT` cases were retained. The two contract-blocked cases were not implemented.

| Case | Change                                                                                                                                                                        | Location                                                                         |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| T002 | Additive route-policy assertions for USER, inactive Head, inactive ADMIN, and ADMIN/SUPERADMIN without `employees:read`; retain positive Head/ADMIN/SUPERADMIN access checks. | `apps/web/test/attendance.test.mjs`, existing U1 declaration                     |
| T003 | Department selection sends `departmentId`, resets pagination to page 1, and displays the filtered response.                                                                   | `apps/web/e2e/attendance.spec.ts`                                                |
| T005 | Date controls submit `from`/`to`, reset pagination, expose native min/max bounds, and identify UTC filtering.                                                                 | `apps/web/e2e/attendance.spec.ts`                                                |
| T008 | Add an initial loading assertion to B2: busy table, loading status, and five skeleton rows while the first response is held.                                                  | `apps/web/e2e/attendance.spec.ts`, existing B2 declaration                       |
| T009 | Department-list 503 error recovers through Retry and displays returned options.                                                                                               | `apps/web/e2e/attendance.spec.ts`                                                |
| T011 | Assert UTC timestamp formatting and actor, employee, entity, and action fallbacks in a non-UTC browser timezone.                                                              | `apps/web/e2e/attendance.spec.ts`                                                |
| T012 | Assert allowlisted snapshot values, previous values, omission of unlisted/private values, safe handling of an array snapshot, and read-only details.                          | `apps/web/e2e/attendance.spec.ts`                                                |
| T013 | At 390 px, Enter opens details, Escape closes them, focus returns to the trigger, and the page has no horizontal overflow.                                                    | `apps/web/e2e/attendance.spec.ts`                                                |
| T015 | Verify anonymous audit access returns 401 and a valid USER session returns 403 without an event list.                                                                         | `apps/api/tests/features/attendance/management.test.ts`, new PGlite case         |
| T016 | Verify malformed audit query values return 400 and maximum valid search/range/page values are accepted; a deleted but well-formed department ID returns 404.                  | `apps/api/tests/features/attendance/management.test.ts`, new PGlite case         |
| T017 | Add UTC boundary inclusion, exclusive next-day boundary, deterministic timestamp tie ordering, and internal/relation projection assertions to A1.                             | `apps/api/tests/features/attendance/management.test.ts`, existing A1 declaration |

## Source reconciliation

T012's Phase 2.1 design discussion referenced display of a boolean snapshot value. The current `AttendanceAuditPage` snapshot allowlist contains no boolean field, although generic primitive formatting exists. The test therefore verifies that an unlisted boolean (`isWorkingDay`) and other unlisted/private fields are omitted. No production allowlist or behavior was changed to make an otherwise unreachable formatter branch testable.

## Scope and preservation

- Changes are limited to the three attendance test files, this execution documentation, and the cumulative Phase 2 ledger.
- No production source, route policy, API behavior, schema, migration, or shared API/browser fixture was changed.
- API scenarios use `tests/support/pglite-app.ts` and migrated in-memory PGlite. Browser cases use the isolated attendance browser fixture or narrowly scoped route mocks; no live database or configured live browser target was used.
- No full repository test suite was run. PG-006 was not started.
- Existing PG-004 defect PG-004-D-001 remains open and unchanged.

## Contract blockers

- **T019 / C001:** Date-clearing display semantics remain undefined.
- **T020 / C002:** Whether selected details close or persist after query/scope changes remains undefined.

Both remain excluded from implemented and passing-test totals.

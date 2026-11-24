# PG-012 Test Implementation Report

## Result

The approved Phase 2.2 PG-012 implementation is complete. All 20 new declarations and seven additive assertion groups are present, and all eight existing-sufficient case records and assertions remain intact. Verification is partial: the Overtime route reproduces the known shared keyboard-menu defect, and the opt-in PostgreSQL case could not satisfy its zero-account precondition. The two approved product-contract cases remain deferred.

## Baseline

- **Branch:** `293-test-full-system-audit-for-verifying-recent-changes`
- **Task-entry HEAD:** `050fbc2b46b3a77d8785cf76a07c8c0a5c498e26`
- **Reported Phase 2.1 HEAD:** same; no intervening commit.
- **Task-entry worktree:** modified cumulative ledger and seven untracked PG-012 Phase 2.1 documents; no staged changes. These were preserved.
- **Authorization:** PG-012 Phase 2.2 only. No PG-013 work began.

## Approved identity

PG-012 is **Overtime Requests**, canonical route `/attendance/requests/overtime`, owned by Workforce Compliance / Attendance. It uses the typed `AttendanceAdjustmentsPage` with `requestType="OVERTIME"` and the shared adjustment table, row-action menu, review panel, and request API. The route does not expose a manual Overtime submission form; automatic clock-out creation and the generic API submission route remain distinct. The seven Phase 2.1 discovery reports were preserved.

## Implementation totals

| Approved disposition            | Approved |                  Implemented or preserved |
| ------------------------------- | -------: | ----------------------------------------: |
| NEW TEST REQUIRED               |       20 |                       20 new declarations |
| ADDITIONAL ASSERTION REQUIRED   |        7 |                         7 additive groups |
| EXISTING COVERAGE SUFFICIENT    |        8 |                               8 preserved |
| CONTRACT CLARIFICATION REQUIRED |        2 |                                2 deferred |
| **Total unique case records**   |   **37** | **35 implementable + 2 contract-blocked** |

The 35 implementable cases comprise one Unit, 16 API/PGlite, 16 Browser, and two Integration records. Their unique case outcomes are 33 passed, one confirmed shared application defect, and one environment-blocked PostgreSQL record. The two contract-blocked records are excluded from execution totals.

## New declarations

| Test ID               | Layer                          | File                                                  |
| --------------------- | ------------------------------ | ----------------------------------------------------- |
| PG-012-F001-A001-T002 | Browser                        | `apps/web/e2e/attendance-overtime.spec.ts`            |
| PG-012-F001-A001-T003 | API/PGlite                     | `apps/api/tests/features/attendance/overtime.test.ts` |
| PG-012-F001-A002-T001 | Browser                        | `apps/web/e2e/attendance-overtime.spec.ts`            |
| PG-012-F001-A003-T001 | Browser                        | `apps/web/e2e/attendance-overtime.spec.ts`            |
| PG-012-F001-A003-T002 | API/PGlite                     | `apps/api/tests/features/attendance/overtime.test.ts` |
| PG-012-F001-A004-T001 | Browser                        | `apps/web/e2e/attendance-overtime.spec.ts`            |
| PG-012-F001-A006-T001 | Browser                        | `apps/web/e2e/attendance-overtime.spec.ts`            |
| PG-012-F001-A007-T001 | Browser                        | `apps/web/e2e/attendance-overtime.spec.ts`            |
| PG-012-F001-A009-T002 | Browser                        | `apps/web/e2e/attendance-overtime.spec.ts`            |
| PG-012-F001-A010-T002 | API/PGlite                     | `apps/api/tests/features/attendance/overtime.test.ts` |
| PG-012-F001-A011-T002 | API/PGlite                     | `apps/api/tests/features/attendance/overtime.test.ts` |
| PG-012-F001-A014-T001 | Browser                        | `apps/web/e2e/attendance-overtime.spec.ts`            |
| PG-012-F001-A014-T002 | Browser                        | `apps/web/e2e/attendance-overtime.spec.ts`            |
| PG-012-F001-A014-T003 | Browser                        | `apps/web/e2e/attendance-overtime.spec.ts`            |
| PG-012-F001-A015-T002 | Browser                        | `apps/web/e2e/attendance-overtime.spec.ts`            |
| PG-012-F001-A017-T001 | API/PGlite                     | `apps/api/tests/features/attendance/overtime.test.ts` |
| PG-012-F001-A018-T002 | API/PGlite                     | `apps/api/tests/features/attendance/overtime.test.ts` |
| PG-012-F001-A019-T002 | Browser/API/PGlite integration | `apps/web/e2e/attendance.spec.ts`                     |
| PG-012-F001-A023-T001 | Browser                        | `apps/web/e2e/attendance-overtime.spec.ts`            |
| PG-012-F001-A023-T002 | Browser                        | `apps/web/e2e/attendance-overtime.spec.ts`            |

`PG-012-F001-A009-T002` intentionally fails when ArrowDown does not expose the `View details` menu item. The declaration checks pointer operation at 390, 820, and 1440 px and retains the keyboard failure as the PG-012-specific reproduction of `PG-004-D-001`.

## Additive assertion groups

| Test ID               | Existing declaration/file                                                                                                 | Added assertion scope                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| PG-012-F001-A001-T001 | `[PG-004-F001-A001-T001]` in `apps/web/test/attendance.test.mjs`                                                          | Overtime route-policy active role, employee-read grant, and inactive role matrix.                   |
| PG-012-F001-A004-T002 | `[PG-004-F001-A002-T009]` in `apps/api/tests/features/attendance/management.test.ts`                                      | Search over reason, employee name and ID, including 100/101-character bounds.                       |
| PG-012-F001-A005-T001 | Same pagination declaration                                                                                               | Overtime status filters for PENDING, VERIFIED, APPROVED, and REJECTED.                              |
| PG-012-F001-A009-T001 | `backend-denied review capabilities override privileged menu assumptions` in `apps/web/e2e/superadmin-attendance.spec.ts` | Overtime route shows only View details when backend capabilities deny review.                       |
| PG-012-F001-A013-T001 | Combined lifecycle declaration in `apps/api/tests/features/attendance/overtime.test.ts`                                   | Superadmin verified-stage approval and rejection while retaining pending-stage override assertions. |
| PG-012-F001-A015-T001 | `overtime conflict recovers a stale HR approval after Superadmin rejection` in `apps/web/e2e/attendance.spec.ts`          | Stale Overtime details are read-only and contain no review-note input.                              |
| PG-012-F001-A016-T001 | `[PG-004-F001-A002-T009]` in `apps/api/tests/features/attendance/management.test.ts`                                      | Overtime response projection and query validation without replacing prior pagination assertions.    |

## Existing-sufficient cases retained

| Test ID               | Existing evidence retained                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| PG-012-F001-A008-T001 | Typed Overtime deep-link, mismatch, unavailable ID, and foreign-scope checks in `apps/web/e2e/attendance.spec.ts`.                                |
| PG-012-F001-A010-T001 | Head verification, HR pre-verification denial, and Superadmin lifecycle checks in `apps/api/tests/features/attendance/overtime.test.ts`.          |
| PG-012-F001-A011-T001 | HR final approval and attendance non-mutation assertions in the same API/PGlite declaration.                                                      |
| PG-012-F001-A018-T001 | Idempotent request-key replay coverage in the same API/PGlite declaration.                                                                        |
| PG-012-F001-A019-T001 | Automatic clock-out eligibility, no-excess, and duplicate-generation coverage in the same API/PGlite declaration.                                 |
| PG-012-F001-A020-T001 | Reviewer notification routing, handoff, and rollback coverage in `apps/api/tests/features/attendance/overtime-notifications.test.ts`.             |
| PG-012-F001-A021-T001 | Approved overtime persistence and source attendance immutability in the same API/PGlite declaration.                                              |
| PG-012-F001-A022-T001 | Existing opt-in `apps/api/tests/features/attendance/overtime-routing.postgres.ts`; execution blocked by its required zero-account database guard. |

## Source changes

Test-only changes are in `apps/api/tests/features/attendance/management.test.ts`, `apps/api/tests/features/attendance/overtime.test.ts`, `apps/web/e2e/attendance.spec.ts`, `apps/web/e2e/superadmin-attendance.spec.ts`, `apps/web/e2e/attendance-overtime.spec.ts`, and `apps/web/test/attendance.test.mjs`. No production code, permissions, Prisma schema, migration, or prior QA report changed. The initial synthetic status rows were corrected to satisfy existing database verification-state constraints; all pre-existing pagination assertions remain.

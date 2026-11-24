# PG-009 Test Implementation Report

## Status

**Implementation complete** for the authorized source-supported PG-009 scope. Ten new browser declarations and seven additive assertion groups are implemented. The existing backend authorization case remains sufficient and unchanged. C001 and C002 remain contract-blocked and have no implementation.

## Repository baseline and scope

- Branch: `293-test-full-system-audit-for-verifying-recent-changes`
- HEAD: `cccf2d5c788f551ba155010973dc32084ed4abf7`
- Task-entry tracked change: the pre-existing `docs/qa/page-verification/PHASE_2_PROGRESS_LEDGER.md` update from Phase 2.1.
- Task-entry untracked files: the seven approved PG-009 Phase 2.1 design reports under this directory.
- No staged changes; no application or test source changes existed at task entry.
- The design reports and ledger update were preserved. Current source was rechecked against the design before implementation.

Only the following test files were changed:

- `apps/web/test/attendance.test.mjs`
- `apps/web/e2e/attendance.spec.ts`
- `apps/api/tests/features/attendance/policy-management.test.ts`

No production source, schema, migration, application fixture, auth policy, or business logic was modified. PG-010 was not started.

## Implemented inventory

The approved inventory contains 20 unique records: 10 new, 7 additive, 1 existing-sufficient, and 2 contract-blocked. The 18 implementable cases retain the planned primary-layer split: 1 unit, 2 API/PGlite, 14 browser, and 1 browser/API/PGlite integration.

### Ten new declarations

All ten new declarations are in `apps/web/e2e/attendance.spec.ts` and carry the approved stable ID in the declaration title:

1. `PG-009-F001-A002-T002` — requests page 1 then page 2 for a 201-policy response, with `size=200` and no status/search parameters.
2. `PG-009-F001-A002-T003` — a failed page 2 prevents partial inventory display; Retry requests pages 1 and 2 again and displays the recovered rows.
3. `PG-009-F001-A003-T002` — maps the four named KPI values to a deterministic response summary.
4. `PG-009-F001-A004-T001` — verifies 3 active / 2 archived rows, rounded 60% / 40% shares, and accessible bar names.
5. `PG-009-F001-A005-T001` — verifies descending assignment counts, alphabetical tie-breaks, accessible bars, and the eight-row cap.
6. `PG-009-F001-A006-T001` — verifies response order, status, timezone, assignment count, eight rendered rows, and the source-defined `9 shown` aside for nine loaded policies.
7. `PG-009-F001-A007-T001` — verifies active zero-history filtering and alphabetical order while excluding assigned and archived rows.
8. `PG-009-F001-A007-T002` — verifies the empty state when no active zero-history policy qualifies.
9. `PG-009-F001-A010-T001` — holds the first request, verifies loading, returns 503, checks error branches and Retry, then verifies successful recovery.
10. `PG-009-F001-A010-T002` — verifies all coordinated zero-inventory figures and empty states.

The mocked response types and builders are local to the existing attendance E2E spec; the page and production API client remain under test. Pagination/error tests intercept only `/api/attendance/policies`.

### Seven additive assertion groups

| Test ID                 | Existing declaration                                                                                                                         | Added assertion                                                                                                                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PG-009-F001-A001-T001` | `all attendance navigation pages preserve module ownership and role boundaries` in `apps/web/test/attendance.test.mjs`                       | Exact PG-009 route decision table for active/inactive ADMIN and SUPERADMIN with/without `employees:manage`, plus STAFF and USER denial. Existing generic and PG-008 assertions are retained.                                                  |
| `PG-009-F001-A001-T002` | `grouped attendance routes enforce staff and department-head boundaries` in `apps/web/e2e/attendance.spec.ts`                                | Permitted Superadmin opens the PG-009 route and remains on it. Existing STAFF and department-head checks are retained.                                                                                                                        |
| `PG-009-F001-A002-T001` | `grouped attendance pages use live scoped data at <width>px`                                                                                 | Records the real initial GET tuple (`page=1`, `size=200`, no `status`/`search`) and the completed KPI loading state.                                                                                                                          |
| `PG-009-F001-A003-T001` | `policy overview totals cover the inventory and remain configuration-only` in `apps/api/tests/features/attendance/policy-management.test.ts` | Seeds active and archived policies, three uncanceled assignments, and one validly scheduled-then-canceled assignment; retains STAFF 403 and summary/database equality while asserting 3 total, 2 active, 1 archived, and 4 aggregate periods. |
| `PG-009-F001-A003-T003` | `grouped attendance pages use live scoped data at <width>px`                                                                                 | Compares all visible KPI values with the real browser response summary through Next proxy, Express, Prisma, and PGlite.                                                                                                                       |
| `PG-009-F001-A008-T001` | Same grouped live page declaration                                                                                                           | Asserts both native links target `/attendance/policies/management`; activates the header link at 1440px and verifies the Policy Management route.                                                                                             |
| `PG-009-F001-A011-T001` | Same grouped live page declaration                                                                                                           | At 390/820/1440px preserves existing overflow/KPI assertions, checks the timezone header breakpoint at 560px, and Tabs to both management links.                                                                                              |

The API fixture follows existing database constraints: policies include all seven configured weekdays; a canceled row is created as a future assignment and then transitioned with `cancelledAt`. Cleanup removes test assignments, policy days, and policies; fixture employees and immutable audit records remain only until the disposable PGlite test instance closes.

The Phase 2.1 example for `A003-T002` paired a summary total of three with one returned policy row. The browser test supplies three valid rows so the response page and total are internally consistent; its assertions remain limited to the four KPI label/value mappings.

## Preserved and deferred records

- `PG-009-F001-A009-T001` remains **EXISTING COVERAGE SUFFICIENT**. The backend route role matrix and PGlite manager/STAFF checks were retained and executed.
- `PG-009-F001-A005-T002` remains **CONTRACT CLARIFICATION REQUIRED** under C002. Current code excludes canceled rows from the aggregate while relation counts include them; intended per-policy count/ranking semantics are unspecified.
- `PG-009-F001-A012-T001` remains **CONTRACT CLARIFICATION REQUIRED** under C001. The client retrieves all pages while copy says “latest 200”; user-facing scope and counter meaning are unspecified.

Blocked cases are not counted as implemented or passed. The page remains read-only in tests; no policy mutation behavior was added.

## Test correction record

Initial focused executions exposed test-only fixture/locator issues. The fixture was corrected to respect configured weekdays, archived-policy assignment restrictions, scheduled cancellation transitions, append-only audit history, and archive-before-delete rules. Browser locators were corrected to select complete table columns, account for three loading skeleton elements, scope repeated error messages to sections, and scope the recovered policy name to inventory. No expected product behavior was weakened, and no production code was changed. Full chronology and results are in `PG-009_TEST_EXECUTION_RESULTS.md`.

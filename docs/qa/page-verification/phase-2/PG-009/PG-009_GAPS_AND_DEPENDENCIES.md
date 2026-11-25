# PG-009 Gaps and Dependencies

## Coverage gaps

| Gap                                   | Current evidence                                                                                                                                                        | Planned coverage                                                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Exact PG-009 frontend allow matrix    | Unit test has generic denied roles and PG-008 allow matrix, but not active manager access for the exact PG-009 route.                                                   | Add exact-route unit assertions and permitted Superadmin browser route (A001-T001/T002).                                 |
| API pagination request/aggregation    | Client sequentially fetches every page, but no browser assertion for a second-page request was found.                                                                   | Mocked browser case for page 1 + page 2 requests (A002-T002).                                                            |
| Later page failure                    | Shared async hook has generic retry coverage, but page's multi-page request and partial result behavior are not directly covered.                                       | Mock page 1 success/page 2 failure and Retry recovery (A002-T003).                                                       |
| Query contract and load transition    | Existing route case waits for 200 and final busy false, but not exact query tuple or skeleton transition.                                                               | Add request tuple and loading transition assertions (A002-T001).                                                         |
| Summary values and status percentages | Existing browser case asserts four KPI labels only. API summary test is fixture-limited. No status breakdown/share assertion found.                                     | Extend PGlite counts, compare actual response to rendered values, and test 60/40 split (A003-T001/T002/T003, A004-T001). |
| History and inventory display         | No direct assertions for ranking, tie-break, max-eight, recent order, status, timezone, counts, or no-history filtering/sort.                                           | Add focused mocked cases (A005-T001, A006-T001, A007-T001/T002).                                                         |
| Management actions                    | Current page case does not assert either link or click-through.                                                                                                         | Assert both hrefs and one PG-008 navigation (A008-T001).                                                                 |
| Page error/empty UI                   | Existing shared hook test is indirect; current route checks successful page only.                                                                                       | Page-level initial failure/retry and empty inventory scenarios (A010-T001/T002).                                         |
| Keyboard and timezone breakpoint      | Existing width matrix checks overall columns/overflow, not keyboard focus or timezone hide/show at 560px.                                                               | Extend width and keyboard assertions (A011-T001).                                                                        |
| Backend policy scope                  | Existing all-role route tests cover authentication and manager access. Endpoint returns org-wide policy data for authorized manager roles; no department filter exists. | Preserve existing API access tests; avoid inventing department-level row scope.                                          |

## Contract blockers

### C001 — “latest 200” scope and “shown” count

`attendancePolicies` loads all pages based on `first.total` and `first.pageSize`. The history and no-history explanatory copy says “latest 200”; both arrays use all loaded policies. Recent inventory displays eight records, while its aside reports `${policies.length} shown`. At 201 or more records, these source facts leave product intent unclear:

- Should history and no-history be limited to the latest 200, or use every loaded policy?
- Should the recent inventory count mean all loaded policies or the eight rendered rows?
- Does “latest” mean the API's `createdAt DESC, id DESC` order, or another business rule?

Current source behavior can be observed, but it does not establish the intended visible contract. A012-T001 is blocked and excluded from implementable totals. The sequential second-page request itself remains a separate source-defined browser case A002-T002.

### C002 — canceled assignment count semantics

The top-level `assignmentPeriods` summary counts only rows with `cancelledAt: null` (`attendance.management.ts:830-833`). Policy `_count.assignments` includes all related rows because the relation count has no filter (`:851-858`). The history table and recent inventory use `_count.assignments`, so a canceled assignment affects displayed count/ranking while not affecting the aggregate KPI. The existing API test's Prisma assignment count includes all rows, but the fixture has no canceled row and therefore does not resolve the mismatch.

Clarify whether canceled rows should be excluded from the per-policy history count and whether a relationship/reconciliation between KPI and row counts is required. A003-T001 may assert the current top-level query filter. A005-T002 remains contract-blocked and excluded from implementable totals.

## Shared-component risk review

| Prior item                                   | PG-009 relationship                                                                                                 | Treatment                                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| PG-004-D-001 keyboard row-action menu defect | PG-009 contains no `RowActionsMenu`; it uses native links and tables.                                               | No exposure found; do not attribute the defect to PG-009. Keep existing regression finding open.                                    |
| PG-006 T018 shared menu reproduction         | Same unrelated menu control is absent.                                                                              | Preserve prior reproduction; no PG-009 defect claim.                                                                                |
| PG-006 T024 intermittent at 820px            | PG-009 has its own responsive grouped route assertions at 390/820/1440, but no observed PG-009 failure is recorded. | Preserve width assertions and add specific breakpoint checks; do not attribute T024 to PG-009.                                      |
| Shared async resource / ResourceStatus       | PG-009 uses both. Generic retry coverage is indirect and the shared test skips live mode.                           | Add page-specific initial failure, pagination failure, and retry coverage. Do not claim runtime stability from source inspection.   |
| `overview-panel` primitives                  | PG-009 uses `FiguresRow`, `Section`, `InlineBar`, and `RowsSkeleton`.                                               | Validate labels, counts, loading, and layout on this page. No confirmed defect is attached to these components by current evidence. |

## Dependencies and environment

- Use existing isolated PGlite and browser fixture infrastructure. Do not use a developer or shared PostgreSQL database.
- API summary boundary additions need policy fixtures in both archived and active states, plus canceled and non-canceled assignments.
- Browser mock responses must satisfy the current attendance policy response type and should intercept only the policy endpoint after test authentication.
- Real integration assertions must use the app's same-origin `/api` proxy and attendance browser fixture; a mocked Playwright response cannot establish persistence.
- The attendance browser spec is serial and owns fixture startup/teardown. Run focused future selections with one worker to avoid fixture concurrency risks.
- No database migration, production API change, page source change, permission change, or new Docker/PostgreSQL service is needed for the source-backed cases.
- C001/C002 require product clarification before final user-facing expected values are written. Their case records are excluded from the 18 implementable cases.

## Prior findings retained

This PG-009 report does not alter prior status: PG-001 whitespace token contract; PG-002 validation and 401/403 behavior differences; PG-003 query/navigation state contract; PG-004-D-001 confirmed keyboard menu defect; PG-005 date/detail contracts; PG-006 implementation complete with partial verification, T018, intermittent T024, T025/C001, timezone and profileless-ADMIN limits; PG-007 source-supported scope complete with two contracts; PG-008 implementation complete with verification partially complete, shared-menu reproduction, 390px fixture failure, PostgreSQL blocker, and nonworking-days contract.

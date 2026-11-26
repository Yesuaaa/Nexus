# PG-009 Test Case Specification

## Counting and disposition

There are **20 unique case records**: 10 `NEW TEST REQUIRED`, 7 `ADDITIONAL ASSERTION REQUIRED`, 1 `EXISTING COVERAGE SUFFICIENT`, and 2 `CONTRACT CLARIFICATION REQUIRED`. The 18 implementable records exclude both contract-blocked cases. The counts are case records, not test declarations or execution results.

| Primary test layer                                           | Unique cases | Implementable |
| ------------------------------------------------------------ | -----------: | ------------: |
| Unit                                                         |            1 |             1 |
| API                                                          |            2 |             2 |
| Browser                                                      |           15 |            14 |
| Integration (browser → Next proxy → Express → Prisma/PGlite) |            2 |             1 |
| **Total**                                                    |       **20** |        **18** |

Priorities refer to future Phase 2.2 coverage order, not severity of a known product defect. Each case has one primary layer; browser-to-API persistence cases are counted as Integration.

## Cases

### PG-009-F001-A001-T001 — route permission decision table

- **Type / priority / disposition:** Unit / High / ADDITIONAL ASSERTION REQUIRED.
- **Environment and preconditions:** Node web unit test; use production `canAccessRoute` with `attendanceNavigation`/permissions helpers.
- **Test data:** active ADMIN and SUPERADMIN each with `employees:manage`; same roles without permission; inactive versions with permission; active STAFF and USER with permission.
- **Steps:** Add assertions to the existing navigation boundary declaration for exact path `/attendance/policies/overview`, exercising each actor.
- **Expected:** Only active ADMIN/SUPERADMIN with `employees:manage` can access this route; every other listed actor is denied.
- **Existing coverage:** `apps/web/test/attendance.test.mjs:251-298` covers generic denied navigation and the same permission matrix for PG-008 management, but not PG-009's allowed path.
- **Proposed action:** Add the exact PG-009 path assertions without weakening the existing generic and PG-008 assertions.
- **Evidence:** `features/attendance/model/navigation.ts:78-91`; `features/auth/model/permissions.ts:118-124`; `features/workspaces/model/route-policy.ts:350-380`.

### PG-009-F001-A001-T002 — permitted Superadmin browser route

- **Type / priority / disposition:** Browser / High / ADDITIONAL ASSERTION REQUIRED.
- **Environment and preconditions:** Attendance Playwright fixture; active SUPERADMIN actor with `employees:manage`; login helper available.
- **Test data:** Existing `fixture.actors.superadmin` account, if its fixture grants the permission used by the policy.
- **Steps:** Sign in as Superadmin, open `/attendance/policies/overview`, and wait for the `Policies Overview` heading and policy request to settle.
- **Expected:** Route remains at PG-009 and renders its heading; it is not redirected to `/module`.
- **Existing coverage:** `attendance.spec.ts:2217-2247` directly asserts STAFF denial; grouped route pages use ADMIN, but no explicit permitted PG-009 Superadmin visit is present.
- **Proposed action:** Add an additive role assertion; if the current actor fixture lacks the permission, extend only under Phase 2.2 authorization and preserve fixture setup isolation.
- **Evidence:** route policy and permission references above; `apps/web/e2e/attendance.spec.ts:2217`.

### PG-009-F001-A002-T001 — initial request tuple and loading completion

- **Type / priority / disposition:** Browser / High / ADDITIONAL ASSERTION REQUIRED.
- **Environment and preconditions:** Existing PGlite-backed grouped route case at 390, 820, and 1440px; active ADMIN.
- **Test data:** Capture the first GET to `/api/attendance/policies` and its query parameters.
- **Steps:** Navigate to PG-009, record the request URL/method, then wait for response and figures busy state to clear.
- **Expected:** One initial GET uses `page=1` and `size=200`, has no `status` or `search`, returns 200, and the loading state settles.
- **Existing coverage:** `attendance.spec.ts:1931-2043` waits for endpoint status 200, no Retry button, and `dl[aria-busy=false]`; it does not assert the query or loading skeleton transition.
- **Proposed action:** Add query and transition assertions to the existing route case.
- **Evidence:** `attendance-api.ts:283-320`; `attendance-policies-overview-page.tsx:19-22,62-83`; existing declaration at `attendance.spec.ts:1931`.

### PG-009-F001-A002-T002 — page requests all policy result pages

- **Type / priority / disposition:** Browser / High / NEW TEST REQUIRED.
- **Environment and preconditions:** Existing attendance Playwright spec with authenticated ADMIN; intercept only `/api/attendance/policies` responses.
- **Test data:** Page 1 response `{total:201,page:1,pageSize:200,policies:[200 rows]}` and page 2 `{total:201,page:2,pageSize:200,policies:[1 row]}`; each response includes a valid summary.
- **Steps:** Navigate to PG-009 and record policy GET URLs and request order until the page resource settles.
- **Expected:** GET page 1 then page 2, both with size 200 and no search/status. Do not assert the user-facing “latest 200” scope or counter meaning; those remain C001.
- **Existing coverage:** Existing grouped route case observes the initial request only; no assertion for a second page was found.
- **Proposed action:** Add one browser declaration around the production client wired through the page; avoid importing the client directly in Node unit tests because its auth API dependency uses the `@/` alias.
- **Evidence:** `apps/web/src/features/attendance/api/attendance-api.ts:283-320`; `attendance-policies-overview-page.tsx:19-22`.

### PG-009-F001-A002-T003 — later-page failure rejects the resource and Retry reloads

- **Type / priority / disposition:** Browser / High / NEW TEST REQUIRED.
- **Environment and preconditions:** Add a mocked case to `apps/web/e2e/attendance.spec.ts`; authenticate with existing fixture, intercept only policy GETs.
- **Test data:** Page 1 returns one policy with `total=201,pageSize=200`; page 2 first returns 503, then returns the remaining page successfully after Retry.
- **Steps:** Open PG-009; allow page 1 and fail page 2; inspect error state; click Retry; allow both pages; inspect content.
- **Expected:** No partial successful policy list is presented for the failed collection; retry requests page 1 and page 2 again, clears the error, and renders recovered data.
- **Existing coverage:** Shared hook error/retry case in `async-resource.spec.ts:21` is indirect and skipped in live mode; current PG-009 route case has no failed request path.
- **Proposed action:** Add one page-level mocked browser case to verify the pagination helper is wired to the page resource.
- **Evidence:** `attendance-api.ts:309-320`; `attendance-policies-overview-page.tsx:20-30,143-299`; `async-resource.spec.ts:21`.

### PG-009-F001-A003-T001 — global summary values including canceled exclusion

- **Type / priority / disposition:** API / High / ADDITIONAL ASSERTION REQUIRED.
- **Environment and preconditions:** Existing PGlite policy API declaration in `apps/api/tests/features/attendance/policy-management.test.ts:187`; manager and staff tokens.
- **Test data:** Three policies (2 active, 1 archived); four non-canceled assignments and one canceled assignment.
- **Steps:** Seed in isolated PGlite; request GET `/policies` as manager; compare summary with direct Prisma counts using the service's explicit canceled filter; retain STAFF 403 assertion. Update the existing assignment-count expectation to filter `cancelledAt: null` so equality remains meaningful after adding a canceled fixture; do not remove or weaken the summary equality.
- **Expected:** `totalPolicies=3`, `activePolicies=2`, `archivedPolicies=1`, `assignmentPeriods=4`; the canceled row is excluded from the summary aggregate.
- **Existing coverage:** Existing test compares all summary fields to database counts, but fixture is a single active policy and has no canceled assignment to distinguish filters.
- **Proposed action:** Add fixtures/assertions to the existing PGlite declaration and align only the assignment aggregate's expected query with the current source filter; preserve the other summary and STAFF-denial assertions.
- **Evidence:** `attendance.management.ts:826-845`; schema models at `schema.prisma:1474-1517`; existing test at `policy-management.test.ts:187-215`.

### PG-009-F001-A003-T002 — summary KPI labels map to response summary

- **Type / priority / disposition:** Browser / High / NEW TEST REQUIRED.
- **Environment and preconditions:** Mocked policy API response in the attendance Playwright spec; logged-in ADMIN.
- **Test data:** `summary={totalPolicies:3,activePolicies:2,archivedPolicies:1,assignmentPeriods:4}`; one valid policy row.
- **Steps:** Navigate to PG-009 and inspect the named `Policy figures` definition list after loading.
- **Expected:** Policies 3, Active 2, Archived 1, Assignment periods 4 are visibly paired with their labels; `aria-busy` becomes false.
- **Existing coverage:** Existing grouped route test asserts four `dt` terms and busy false, not exact values or label-value mapping.
- **Proposed action:** New mocked page case; keep its focus on KPI mapping, not duplicate API totals.
- **Evidence:** `attendance-policies-overview-page.tsx:62-83`; `overview-panel.tsx` `FiguresRow`; existing route case `attendance.spec.ts:1931`.

### PG-009-F001-A003-T003 — rendered KPIs agree with real PGlite API response

- **Type / priority / disposition:** Integration / High / ADDITIONAL ASSERTION REQUIRED.
- **Environment and preconditions:** Existing browser fixture, real Next proxy, Express API, Prisma, and PGlite database; active ADMIN.
- **Test data:** Use the fixture's persisted policy data; read the real GET response from the browser request and its summary.
- **Steps:** Visit PG-009 through the app, capture the real GET JSON, and compare the four visible figure values to its summary.
- **Expected:** Each displayed KPI equals the corresponding real response summary value; request and page both succeed.
- **Existing coverage:** Existing route integration at `attendance.spec.ts:1931-2043` waits for response 200 and checks four KPI terms; it does not compare values.
- **Proposed action:** Add an additive real-persistence assertion to the grouped page route case.
- **Evidence:** `attendance.spec.ts:1931-2005`; route/API chain in `PG-009_FUNCTIONAL_DISCOVERY.md`; service summary `attendance.management.ts:826-845`.

### PG-009-F001-A004-T001 — active/archive counts and rounded percentages

- **Type / priority / disposition:** Browser / Medium / NEW TEST REQUIRED.
- **Environment and preconditions:** Mocked browser response with total > 0.
- **Test data:** Five policies; active=3 and archived=2; matching `summary` and rows.
- **Steps:** Load page and inspect the Policy status table's Active and Archived rows, counts, and percentage text.
- **Expected:** Active displays 3 and 60%; Archived displays 2 and 40%; rows use the source's rounded-share calculation.
- **Existing coverage:** No existing PG-009 status table count/share assertion found.
- **Proposed action:** Add one mocked browser declaration.
- **Evidence:** `attendance-policies-overview-page.tsx:85-141`.

### PG-009-F001-A005-T001 — assignment history sort, tie-break, bars, and eight-row cap

- **Type / priority / disposition:** Browser / High / NEW TEST REQUIRED.
- **Environment and preconditions:** Mocked browser response; all policies authorized and loaded.
- **Test data:** Nine policies with positive assignment counts, including two ties; e.g. `Alpha=5`, `Zulu=5`, `Beta=4`, and six lower counts with unique names.
- **Steps:** Load page; inspect Assignment history table order, row count, counts, and `InlineBar` accessible labels.
- **Expected:** Counts descend, equal counts sort by name ascending, only the first eight sorted policies render, and labels match each rendered policy and count.
- **Existing coverage:** No page-specific history ranking/count/bar assertion found.
- **Proposed action:** Add one focused mocked browser case; do not test C002's canceled semantics here.
- **Evidence:** `attendance-policies-overview-page.tsx:29-34,143-208`.

### PG-009-F001-A005-T002 — canceled relation count meaning

- **Type / priority / disposition:** Integration / Medium / CONTRACT CLARIFICATION REQUIRED.
- **Environment and preconditions:** Isolated PGlite policy data; active manager; contract clarification required before expected-value assertion.
- **Test data:** A policy with one non-canceled and one canceled assignment; another policy with only a canceled assignment.
- **Steps:** After product decision, request GET `/policies` and inspect summary `assignmentPeriods` and each policy `_count.assignments`; compare behavior to the approved meaning.
- **Expected:** **Blocked.** Current source counts only non-canceled rows in the aggregate and all related rows in each policy relation count. The intended per-policy display/ranking rule and reconciliation requirement are unspecified.
- **Existing coverage:** `policy-management.test.ts:187-215` compares summary with all-row count but has no canceled row; it cannot establish this contract.
- **Proposed action:** Obtain product contract first; exclude from implementable cases and pass totals until then.
- **Evidence:** `attendance.management.ts:826-858`; `schema.prisma:1500-1517`; contract C002.

### PG-009-F001-A006-T001 — recent inventory order, status, timezone, count, and row cap

- **Type / priority / disposition:** Browser / Medium / NEW TEST REQUIRED.
- **Environment and preconditions:** Mocked response preserving server order; viewport above 560px for timezone visibility.
- **Test data:** Nine rows in descending server order, mixed `archivedAt`, distinct time zones, and history counts.
- **Steps:** Load page and inspect Recent policy inventory rows and aside.
- **Expected:** First eight response rows appear in response order; status derives from `archivedAt`; timezone and relation count match data; table has eight rows; aside reports the full loaded collection length (9) as currently implemented.
- **Existing coverage:** Existing direct browser route does not inspect inventory rows or aside.
- **Proposed action:** Add a mocked browser case; keep the source-defined current count assertion separate from C001's product wording question.
- **Evidence:** `attendance-policies-overview-page.tsx:210-266`; `attendance.management.ts:851-859`.

### PG-009-F001-A007-T001 — active unassigned policies filtered and alphabetized

- **Type / priority / disposition:** Browser / Medium / NEW TEST REQUIRED.
- **Environment and preconditions:** Mocked response containing all three membership cases.
- **Test data:** Active `Zulu` with zero assignments, active `Alpha` with zero, active `Assigned` with one, archived `Old` with zero.
- **Steps:** Load page and inspect Active policies without assignment history definition list.
- **Expected:** Only `Alpha` and `Zulu` appear, in that order; archived and assigned policies do not appear.
- **Existing coverage:** No page-specific filter/sort assertion found.
- **Proposed action:** Add one mocked browser declaration.
- **Evidence:** `attendance-policies-overview-page.tsx:36-40,269-299`.

### PG-009-F001-A007-T002 — no eligible active-unassigned policy empty state

- **Type / priority / disposition:** Browser / Low / NEW TEST REQUIRED.
- **Environment and preconditions:** Mocked successful response where no policy satisfies the active-and-zero-history predicate.
- **Test data:** Empty set, or one archived zero-history policy plus one active assigned policy.
- **Steps:** Load page and inspect the no-history section.
- **Expected:** Exact source empty message `No active policies without assignment history in this preview.` is visible and no definition-list policy rows render.
- **Existing coverage:** No PG-009 empty-state assertion found.
- **Proposed action:** Add one mocked browser declaration; a separate general no-policies case is specified under A010.
- **Evidence:** `attendance-policies-overview-page.tsx:281-299`.

### PG-009-F001-A008-T001 — both management links target PG-008

- **Type / priority / disposition:** Browser / Medium / ADDITIONAL ASSERTION REQUIRED.
- **Environment and preconditions:** Existing real PGlite-backed ADMIN route test, page loaded successfully.
- **Test data:** Header link `Manage policies`; section link `Open policy management`.
- **Steps:** Assert each native link href equals `/attendance/policies/management`; activate one and verify navigation reaches the authorized management route/heading.
- **Expected:** Both links target the canonical PG-008 URL, and click navigation renders Policy Management for the manager.
- **Existing coverage:** Grouped PG-009 test does not assert either link; management route is covered elsewhere as PG-008.
- **Proposed action:** Add link assertions and one navigation check to an existing browser scenario, avoiding duplicating PG-008 workflows.
- **Evidence:** `attendance-policies-overview-page.tsx:47-55,150-157`; PG-008 route mapping in `PHASE_1_PAGE_COMPONENT_MAPPING.md:29-30`.

### PG-009-F001-A009-T001 — independent backend authorization matrix

- **Type / priority / disposition:** API / High / EXISTING COVERAGE SUFFICIENT.
- **Environment and preconditions:** Existing isolated backend/PGlite route harness; anonymous, ADMIN, SUPERADMIN, STAFF, USER actors.
- **Test data:** GET `/api/attendance/policies` with no filters; use fixture policy data.
- **Steps:** Preserve the all-four-role/anonymous HTTP matrix and PGlite manager/staff check; retain the existing no-write/summary assertion as present.
- **Expected:** Anonymous 401, ADMIN/SUPERADMIN 200, STAFF/USER 403; only manager scope receives policy data.
- **Existing coverage:** `backend-regression.test.ts:94-125` dynamically declares the `/attendance/policies` all-role and anonymous case; `policy-management.test.ts:187-215` asserts STAFF 403 and ADMIN 200. Current policy service has no writes.
- **Proposed action:** Existing coverage sufficient for the endpoint role boundary; preserve both test declarations. Canceled-count nuance remains C002.
- **Evidence:** `routes.ts:16,35-36`; `attendance.management.ts:82-97,795-860`; API test references above.

### PG-009-F001-A010-T001 — initial loading, failure, and retry recovery

- **Type / priority / disposition:** Browser / High / NEW TEST REQUIRED.
- **Environment and preconditions:** Mock policy GET with a deferred first 503 and a successful retry; authenticated page.
- **Test data:** First response `{error:"Summary temporarily unavailable."}` status 503; retry response with one valid policy and summary.
- **Steps:** Hold the first response; assert loading skeletons and busy state; return 503; assert visible Retry/error and unavailable sections; click Retry; return success.
- **Expected:** Loading branches display while pending; error branches display after failure and no stale data; Retry reissues GET, clears error, and displays returned summary/content.
- **Existing coverage:** Shared `async-resource.spec.ts:21` tests generic recovery but is indirect and skipped in live mode; no page-specific failure assertion exists.
- **Proposed action:** Add a mocked PG-009 browser declaration.
- **Evidence:** `attendance-policies-overview-page.tsx:20-22,47-60,85-299`; `use-async-resource.ts`; `attendance-shared.tsx`.

### PG-009-F001-A010-T002 — empty policy inventory

- **Type / priority / disposition:** Browser / Low / NEW TEST REQUIRED.
- **Environment and preconditions:** Mock successful response with no policy rows and zero summary.
- **Test data:** `total=0`, empty policies, `totalPolicies=0`, `activePolicies=0`, `archivedPolicies=0`, `assignmentPeriods=0`.
- **Steps:** Load PG-009 and inspect figures, Policy status, Recent policy inventory, Assignment history, and no-history section.
- **Expected:** Four figures show zero; Policy status shows `No policies yet.` (and no percentage table); history and inventory show their source empty messages; no-history shows its preview empty message.
- **Existing coverage:** No empty overview response assertion found.
- **Proposed action:** Add one mocked browser declaration spanning the coordinated empty state.
- **Evidence:** `attendance-policies-overview-page.tsx:62-83,85-99,159-168,219-230,281-285`.

### PG-009-F001-A011-T001 — responsive layout and keyboard-reachable actions

- **Type / priority / disposition:** Browser / Medium / ADDITIONAL ASSERTION REQUIRED.
- **Environment and preconditions:** Existing PGlite-backed width matrix at 390, 820, and 1440px; populated page for visible links.
- **Test data:** Existing manager actor and policy fixture; exercise native links using keyboard tab focus.
- **Steps:** Preserve existing `dl`/columns/no-overflow checks; at each width verify timezone column is hidden at 390px and visible above 560px; use Tab navigation to reach both named management links and verify focusable native link roles.
- **Expected:** Existing width layout assertions remain; timezone breakpoint follows source; both management actions can receive keyboard focus without a custom menu interaction.
- **Existing coverage:** `attendance.spec.ts:1931-2043` checks 390/820/1440, four KPI columns, and no overflow, but does not check timezone breakpoint or keyboard focus.
- **Proposed action:** Add responsive visibility and keyboard focus assertions to the existing route case.
- **Evidence:** `attendance-policies-overview-page.tsx:210-266`; `attendance.spec.ts:1931`; `overview-panel.tsx` and `attendance-shell.tsx`.

### PG-009-F001-A012-T001 — population implied by latest-200 labels

- **Type / priority / disposition:** Browser / Medium / CONTRACT CLARIFICATION REQUIRED.
- **Environment and preconditions:** More than 200 persisted policies or deterministic mocked response spanning two pages; product decision required.
- **Test data:** 201 policies with distinguishable records on page 1 and page 2, including assignment-history and active-unassigned examples.
- **Steps:** After clarifying the “latest 200” copy and counter meaning, load the page and assert which population is used for history/no-history plus whether “shown” counts loaded or rendered rows.
- **Expected:** **Blocked.** Current implementation aggregates all 201; history/no-history copy says latest 200; recent inventory shows eight rows but its aside counts all loaded policies. No expected product scope is authorized by current source alone.
- **Existing coverage:** A002-T002 verifies that the client requests page 2; existing browser coverage does not exceed baseline data or assert these labels.
- **Proposed action:** Obtain a product contract before adding user-facing scope expectations; exclude from implementable total.
- **Evidence:** `attendance-api.ts:309-320`; `attendance-policies-overview-page.tsx:143-146,183-184,210-220,269-274`; C001.

## Deduplication notes

- A002-T002 verifies page 2 is requested; A012-T001 is blocked on what the UI labels promise. The request behavior can be checked without asserting the intended user-facing population.
- A003-T001 verifies the source-defined aggregate excluding canceled assignments; A005-T002 is blocked on per-policy canceled relation counts and reconciliation. They test distinct semantics.
- A010-T001 covers request failure and recovery; A002-T003 covers failure after one successful page and ensures partial multi-page data is not shown. The latter exercises a distinct pagination boundary.
- A009-T001 covers backend authorization/read boundary; A001 cases cover frontend route permission and browser navigation.

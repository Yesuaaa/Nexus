# Phase 7.5 Execution Matrix

Date: 2026-11-14

This matrix records Phase 7.5 test discovery and safe offline execution. Browser tests used mocked API responses and a local standalone web build. API tests used PGlite, local ephemeral HTTP applications, or isolated unit fixtures. No production or shared database was used.

## Suite totals

| Suite                             |                                      Discovered |                                                                                         Run |                      Passed |                      Failed | Skipped |         Not run | Evidence                                                                                                              |
| --------------------------------- | ----------------------------------------------: | ------------------------------------------------------------------------------------------: | --------------------------: | --------------------------: | ------: | --------------: | --------------------------------------------------------------------------------------------------------------------- |
| Playwright browser regression     |                      534 cases in 74 spec files |                                                                                         534 |                         509 |                          20 |       5 |               0 | `test-results/phase7/phase7.5/browser/full-browser.log`; `playwright-results.json`                                    |
| API regression, unique leaf cases |                     276 leaves in 52 test files |                                                                                         276 |                         267 |                           9 |       0 |               0 | `test-results/phase7/phase7.5/api/full-api.log`                                                                       |
| API TAP parent suites             |                 29 parents (not additive cases) |                                                                                          29 |                          24 |                           5 |       0 |               0 | Same API log; parent outcomes reflect failing child cases                                                             |
| Web unit tests                    |                          98 cases in 26 modules |                                                                                          98 |                          98 |                           0 |       0 |               0 | `test-results/phase7/phase7.5/unit/web-unit.log`                                                                      |
| API-only unit tests               |                          Included in API runner |                                                                              Included above | Not separately attributable | Not separately attributable |       0 |               0 | API unit and integration cases share the supported runner                                                             |
| Cross-page workflow focus run     | 21 cases in 10 specs, last focused in Phase 7.4 | Not run as a separate Phase 7.5 command; all current discovered tests ran in the full suite |               Prior run: 19 |                Prior run: 2 |       0 | 0 focused cases | `docs/testing/verification/phase7/phase7.4-cross-page-verification.md`; current outcomes are in the full browser JSON |
| Live-backend browser cases        |                                5 existing cases |                                                                                           0 |                           0 |                           0 |       5 |               0 | Intentionally skipped in offline mode; no disposable integrated backend/account environment was certified             |

The browser suite ran with four workers and zero retries. The API run invoked `pnpm test:api`; 305 TAP entries include 29 parent suites and 276 unique leaves. The web unit run invoked `pnpm test:web`. The five skips are existing live-backend cases, not new skips. No retry changed a result.

## Browser inventory and ownership

Fresh Playwright discovery found 534 expanded Chromium cases across 74 files. There were no duplicate expanded identities. The inventory includes legacy regression coverage, attendance and policy tests, shared component tests, workflow tests, and page-specific additions for Pages 1–23. Page ownership is recorded in `docs/testing/verification/phase7/page-by-page/`; the full identity list is `test-results/phase7/phase7.5/discovery/browser-test-list.log`.

| Test group                                  |     Spec files | Discovered cases | Skipped | Owner                                                         |
| ------------------------------------------- | -------------: | ---------------: | ------: | ------------------------------------------------------------- |
| Page-specific and legacy browser regression |             74 |              534 |       5 | Page-by-page reports and the spec paths in the discovery list |
| Live-backend-only cases (subset of the 534) | Included above |                5 |       5 | `regression/live-backend.spec.ts`                             |

The five skipped cases require live role login/access or a deactivated-account session against a real backend. They remained skipped under `NEXUS_E2E_LIVE=0`. The other 529 cases executed. There were no newly introduced skips, retries, or flaky outcomes.

## API inventory and isolation

The API runner discovered 52 `*.test.ts` files. All were invoked by `pnpm test:api`; there is no standalone API unit runner, so unit-only and HTTP/PGlite cases are counted together.

| Test module group           |  Files | Isolation and coverage                                                                                                                                                |
| --------------------------- | -----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root API and workflow tests |     29 | Route, auth, session, workflow, billing, calendar, project, profile, settings, request, and integration coverage; PGlite or local test app as declared by each module |
| Attendance                  |      6 | PGlite and migration harnesses                                                                                                                                        |
| Auth                        |      4 | PGlite or isolated auth/session fixtures                                                                                                                              |
| Departments                 |      1 | Isolated API/PGlite                                                                                                                                                   |
| Employees                   |      1 | Isolated API/PGlite                                                                                                                                                   |
| Request Inbox               |      1 | Isolated API/PGlite                                                                                                                                                   |
| Services                    |      3 | PGlite and pure validation tests                                                                                                                                      |
| Users                       |      5 | PGlite and isolated policy tests                                                                                                                                      |
| Workload                    |      1 | PGlite                                                                                                                                                                |
| Database read library       |      1 | Isolated module test                                                                                                                                                  |
| **Total**                   | **52** | **42 PGlite/migration-harness, 4 local ephemeral HTTP, 6 pure/unit/mock modules**                                                                                     |

`DATABASE_URL` and `DIRECT_URL` were unset for the run. Test code used in-memory PGlite or local ephemeral servers; no live database, production data, or shared credentials were used. The API test TypeScript compile and Prisma client generation passed before test execution. The runner emitted a non-blocking `pg` client-query deprecation warning.

### API leaf failures

| Finding                 | Failing leaf                            | Observed result                                                                                     | Classification                             |
| ----------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| BOOK-001                | Booked Services list projection         | `referenceNumber` absent from list projection                                                       | Application/API defect                     |
| BOOK-001                | Booked Services detail projection       | `referenceNumber` absent from detail projection                                                     | Same projection defect; separate leaf      |
| BOOK-002                | Request conversation before acceptance  | HTTP 404 instead of the expected waiting state                                                      | Contract discrepancy pending decision      |
| P20-001                 | Meeting date parser                     | Impossible Gregorian date accepted after normalization                                              | Application validation defect              |
| P20-001                 | Consultation date parser                | Impossible Gregorian date accepted after normalization                                              | Same date-validation defect; separate leaf |
| SVC-001 / API-PRICE-001 | Service pricing upper boundary          | Value beyond `Decimal(12,2)` limit returns 500 instead of 400                                       | Application validation defect              |
| P17-001                 | Specialist profile URL Unicode boundary | URL normalization expands beyond `VarChar(2048)`; API returns 500 instead of 400                    | Application validation defect              |
| S15-002                 | Standalone project task endpoint        | A 51st task persists with HTTP 200 despite the 50-task limit                                        | Application validation defect              |
| API-TEST-001            | Request workflow test                   | Test indexes `client.milestones[0].id` although the client response intentionally has no milestones | Test implementation defect                 |

The TAP summary was 291 passed / 14 failed entries, but that includes parent suites. The unique leaf result is 267 passed / 9 failed. No test was skipped.

## Cross-page workflows

The latest separately focused cross-page run remains the Phase 7.4 run: 21 cases, 19 passed and 2 failed. Both failures were the known NEX-017 error-notification assertions. Phase 7.5 reran the entire 534-case suite, which includes those workflow specs and additional tests. The current full-suite outcomes include project-list pagination, brief-update/review feedback, Messages archive interactions, and other page regressions; see the defect register for current failures. The Phase 7.4 matrix remains the source for exact workflow boundaries because Phase 7.5 did not invoke a separate 21-case workflow command.

| Workflow                                                                         | Last focused status | Evidence limitation                                                                                                          |
| -------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Auth, role routes, logout; cross-context session revocation                      | Passed              | Mocked browser session state; API role coverage is separately exercised in isolated API tests                                |
| Client related requests/projects; Inbox acceptance to selected Messages thread   | Passed              | Fixture identity and navigation are mocked                                                                                   |
| Dashboard to request Messages thread                                             | Passed              | Mocked UI route and thread identity                                                                                          |
| Service request submission and confirmation                                      | Partial             | Request-history persistence handoff was not asserted                                                                         |
| Active request to related project                                                | Partial             | Correct href asserted; destination not opened in that test                                                                   |
| Client project to project/deliverable details                                    | Failed              | Two NEX-017 error-notification failures; current run also reproduced project-list pagination and deliverable feedback issues |
| Staff upload, head review, client visibility                                     | Passed              | Mocked role/state transitions; not live persistence                                                                          |
| Project conversation links                                                       | Partial             | Hrefs and controls asserted; destinations not followed                                                                       |
| Workspace list/detail same-record continuity                                     | Partial/source-only | Separate fixtures do not prove one record across both routes                                                                 |
| Department/team propagation, payment-to-Billing Logs, notification click-through | Not covered         | No safe same-record live integration path was executed                                                                       |

All 21 focused outcomes and their case identities are in `phase7.4-cross-page-verification.md`. Five live-backend tests remain deferred. No browser workflow result should be interpreted as proof of server authorization or durable persistence.

## Timeout isolation and reliability

The complete browser run had zero retries and zero flaky outcomes. Six timed-out cases were rerun serially with one worker and zero retries; all six timed out again at the same missing/blocked UI interactions. This repeat establishes reproducible regressions, not random infrastructure timeouts:

| Spec and case                                   | Full run | Serial rerun | Observed point                                                          |
| ----------------------------------------------- | -------- | ------------ | ----------------------------------------------------------------------- |
| `messages/request-conversations.spec.ts:2420`   | Timeout  | Timeout      | Ended booking remains in Active but is absent from conversation context |
| `project-conversations.spec.ts:311`             | Timeout  | Timeout      | Project/archive filter interaction                                      |
| `project-conversations.spec.ts:427` USER        | Timeout  | Timeout      | Archived project conversation history                                   |
| `project-conversations.spec.ts:427` STAFF       | Timeout  | Timeout      | Archived project conversation history                                   |
| `projects/client-project-workflows.spec.ts:180` | Timeout  | Timeout      | `View Website launch` is absent after stale page-two state is restored  |
| `shared/dropdown-positioning.spec.ts:52`        | Timeout  | Timeout      | Mobile service `Edit` menu item does not become available               |

The six reruns took 184,892.625 ms total. The existing 5273 listener blocked the default web-server port, so a separate local standalone server was started on 5274. The existing listener was left untouched. An initial sandbox worker launch was denied with `spawn EPERM`; the user-authorized offline run completed after sandbox review. These were invocation/environment restrictions, not test results.

Previously reported Settings timeout behavior was not reproduced as a failed case in this full run. A single passing suite does not establish long-run stability, so that historical concern remains inconclusive. The accepted Attendance fixture corrections remain present; no cross-test contamination was observed in this run. This does not prove all live database cleanup behavior because browser API calls were mocked and the live suite was skipped.

## Evidence files

- Discovery: `test-results/phase7/phase7.5/discovery/browser-test-list.log`
- Browser: `test-results/phase7/phase7.5/browser/full-browser.log`, `playwright-results.json`, `summary.json`, `timeout-isolation.log`
- API: `test-results/phase7/phase7.5/api/full-api.log`
- Web unit: `test-results/phase7/phase7.5/unit/web-unit.log`
- Preservation: `test-results/phase7/phase7.5/preservation/reconciliation-summary.json` and its CSVs
- Historical verifier: `test-results/phase7/phase7.5/preservation/legacy-verifier-discover.log`
- Quality gates: `test-results/phase7/phase7.5/quality/`

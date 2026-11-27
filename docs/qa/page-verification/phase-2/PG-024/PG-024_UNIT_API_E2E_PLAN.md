# PG-024 Unit, API, Browser, and Integration Plan

**Planning only — NOT EXECUTED.** Phase 2.1 did not create test files, import test modules, set up fixtures, launch app/browser/database processes, or run a test command. Commands below are candidates for a separately authorized Phase 2.2 and were checked against the current package scripts and existing runner/config names.

## Layer decision

| Layer       | Unique implementable cases | Plan and boundary                                                                                                                                                                                                                                                                                                                      |
| ----------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser     | 15                         | New mocked-browser declarations for route admission, exact fan-out, abort on exit, metric rendering, loading/error/retry, native semantics/navigation, responsive CSS, and inert text. Fixtures use synthetic actors/data and bounded Playwright route/event/state synchronization. No mock proves backend permissions or persistence. |
| Unit        | 0                          | The rendered ratio and sorting are small page-local calculations; a browser fixture directly proves their displayed results. No exported deterministic transform warrants an artificial standalone unit case. Shared route-policy tests are existing source evidence.                                                                  |
| API/PGlite  | 3                          | One new PGlite case proves totals for all nine query shapes across synthetic account/Employee states. Two cases reuse direct Employee authorization and Department projection/count/no-write declarations. `startPgliteApp` isolates the database; no live URL, seed, notification, or customer data.                                  |
| Integration | 1                          | Existing-sufficient rewrite case only. PG-023 T033 and PG-022 T009 already exercised the actual Employee and Department GET paths through Next→Express→PGlite. No new combined page registration is justified for the currently specified invariant.                                                                                   |
| PostgreSQL  | 0                          | The page performs GETs only; there is no competing mutation, lock, isolation, or provider-specific write invariant. Cross-request snapshot consistency is unresolved in C004 and cannot be converted into a PostgreSQL requirement without a contract.                                                                                 |

## Browser design

Proposed file: `apps/web/e2e/employees/pg024-overview.spec.ts`. Use `restoreSession` for synthetic Admin/Superadmin/Staff/User fixtures and explicit permission overrides; intercept both `/api/employees` and `/api/departments`. `T001` uses bounded actor iterations inside one test registration. `T003` verifies nine query parameter sets and one Department request. `T004` uses route gates, waits for ten request starts, navigates away, then observes request aborts. T013-T015 use controlled successes/errors and settled accessible UI; no arbitrary sleeps, hidden retries, forced focus, `.skip`, `.fixme`, or `.only`.

Run future focused Browser selections with one worker and zero retries:

```text
pnpm --filter @nexus/web exec playwright test e2e/employees/pg024-overview.spec.ts --workers=1 --retries=0
```

The current `apps/web/package.json` script is `test:e2e: playwright test`; the exact `exec` command is a focused selection consistent with prior PG-022/023 reports. Read the current Playwright config and environment again at Phase 2.2 entry before running it. Its default web server may build/launch Next, which this Phase 2.1 authorization forbids.

`T018` has six viewport iterations inside one new Browser registration: 479, 480, 481, 1023, 1024, 1025 CSS px. `T001` role variants are steps, not parameterized runner cases. Existing `superadmin-people-hr.spec.ts` already has two separate 1440/390 registrations, but only checks page-link visibility; those are not Employee Overview responsive assertions.

## API/PGlite design

Proposed file: `apps/api/tests/features/employees/pg024-overview.test.ts`, using `tests/support/pglite-app.ts`, issued synthetic sessions, real Express route handlers, and direct Prisma snapshots. Use Admin/Superadmin for successful list reads; Staff/User for denied access in existing T002 evidence. The new T007 fixture must distinguish:

- linked Employee accounts with each allowed status and employment type;
- an account-only ADMIN/STAFF row with no HR status/type;
- an inactive login whose HR status is still counted;
- an archived account;
- USER and SUPERADMIN accounts excluded from the Employee directory;
- an Employee-only relation excluded from the account-based employee list.

Assert exact totals for all nine request filters, response status and no mutations. API reads are exercised against disposable PGlite; this does not verify browser route admission or Next rewrites. The Department list case is reused unchanged from PG-022 T007; it directly checks relation count and snapshots.

Future focused API selection:

```text
pnpm --filter @nexus/api exec node scripts/run-tests.mjs tests/features/employees/pg024-overview.test.ts
```

`apps/api/package.json` runs Prisma generation before its standard test script; the direct selected runner path follows the documented `scripts/run-tests.mjs` workflow. The Phase 2.2 implementer must confirm the runner's current output/cleanup and available PGlite dependencies before execution.

## Integration reuse and limits

No new integration declaration is planned for T005. PG-022 T009 proved a Department list GET through the actual Next rewrite to Express/PGlite. PG-023 T033 proved Employee list/detail GETs through Next to Express/PGlite, recorded backend receipts, rendered seeded data, and compared persisted snapshots. These prior independent tests cover the actual two read endpoint paths; they do not test the whole overview data join, simultaneous snapshot, or a single combined ten-request page. Browser T003 covers request orchestration; API T007 covers Employee totals; API T010 covers Department projection. If a later approved product contract requires atomic cross-source totals, C004 must determine a new server/API design and honest integration boundary first.

No integration server, port, fixture, or disposable database is established now. Reuse the exact task-owned fixture/config and teardown documented in the two prior execution reports only if Phase 2.2 separately requires it. Do not assume their containers are running.

## Concurrency and persistence decision

No PostgreSQL contention test is justified. The page starts independent read requests and performs no Employee/Department write. Each Employee list query uses the shared paginator, which batches rows/count under its endpoint transaction; that transaction does not span the other eight Employee requests or the Department request. No source or product contract promises one cross-page snapshot. Preserve C004 as a decision dependency rather than inventing a lock, serializable transaction, actor winner, or final-state oracle.

GET routes themselves do not create Employee, User, Department, Team, or management-history records. `requireAuth` can update session activity metadata when due. Later PGlite assertions should snapshot domain and history state, not claim that authentication has no session bookkeeping.

## Isolation and cleanup

Use synthetic account/email/profile/department values only. Browser tests should close their page/context and use configured test teardown. PGlite tests should use the fixture's registered server/database cleanup. No real notification, production connection, live account, uncontrolled load, persistent external service, migration, seed, or local database is included. Resource ownership and exact teardown are reconfirmed before any future process is stopped.

## Required registration reconciliation

| Planned item                                      | Count |
| ------------------------------------------------- | ----: |
| Unique cases                                      |    23 |
| NEW declarations / planned registrations          |    16 |
| Existing declaration extensions                   |     0 |
| Additive assertion groups                         |     0 |
| EXISTING-SUFFICIENT cases                         |     3 |
| Contract-blocked cases                            |     4 |
| New viewport iterations within T018               |     6 |
| Parameterized runner expansions in proposed files |     0 |
| Unit or PostgreSQL registrations                  |     0 |

The 16 new declarations comprise 15 Browser and one API/PGlite registration. Counts do not include shared existing declarations, viewport iterations, previous PG-022/023 execution totals, or contract-blocked work.

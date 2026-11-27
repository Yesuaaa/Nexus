# PG-024 Execution Results

The inspected revision was af31220286f691535a129a8effc674b506572f6a with the uncommitted PG-024 registrations. Browser selections used Chromium, one worker, zero retries, and synthetic sessions and route responses. The default configuration used loopback Next on 5273 and the task-owned public-services upstream on 5274. The Employee responses used the exact nine query keys with distinct totals; Department data had its own envelope. Shared layout and auth mocks were provided by regression-support.

## Browser attempts

- `pnpm --filter @nexus/web exec playwright test e2e/employees/pg024-overview.spec.ts --workers=1 --retries=0` initially exited 1 at the pnpm store lock before registration. The approved rerun exited 1 with 11 passing and four failing runner instances (T001, T004, T016, T018).
- T001 reached the anonymous branch and received /login rather than the initial /internal/login expectation. PortalLayout uses the USER fallback when there is no account. Corrected the anonymous locator; the six actor variants and the eligible refresh/ordering assertions were retained.
- T004 observed ten starts but no matching abort events using full document navigation. Switched to the ordinary Switch Workspace link to exercise component exit within the app and retained the ten abort and no-reappearance assertions.
- T016 initially missed the Full Time chart label because the expression used lowercase "time". Corrected the accessible label to Full Time: 25%. T018's Able cell locator initially also matched the Share cell. Scoped it to the exact cell name.
- `pnpm --filter @nexus/web exec playwright test e2e/employees/pg024-overview.spec.ts --grep 'T001|T004|T016|T018' --workers=1 --retries=0` exited 1. T001, T004 and T016 passed. T018 failed only at 480 CSS px. All viewport iterations ran in one registration.

| CSS px | Department Share expectation | Observed | Grid columns | Outcome |
| -----: | ---------------------------- | -------- | -----------: | ------- |
|    479 | Hidden                       | Hidden   |            1 | PASS    |
|    480 | Hidden                       | Visible  |            1 | FAIL    |
|    481 | Visible                      | Visible  |            1 | PASS    |
|   1023 | Visible                      | Visible  |            1 | PASS    |
|   1024 | Visible                      | Visible  |            2 | PASS    |
|   1025 | Visible                      | Visible  |            2 | PASS    |

The corrected readability checks passed at all six widths. The approved inclusive 480px requirement was retained. T020 passed as a runner instance for literal benign markup and absence of a corresponding DOM node. An executable-event sentinel was not exercised, so the wider hypothesis and case remain partial.

## API attempts

From apps/api, `node scripts/run-tests.mjs tests/features/employees/pg024-overview.test.ts tests/employee-integration.test.ts tests/features/departments/department-overview.test.ts` first exited 1 twice at TS2322 for the unknown JSON body. The first attempted textual correction did not match the formatted declaration. The applied correction narrowed the JSON object and field without changing the totals. The third attempt compiled but exited 1 with spawn EPERM before the three files executed. The approved command rerun exited 0 with 24 passing runner instances. This included the retained Employee guard, retained PG-022 Department projection and the new T007 (two privileged actors, nine query shapes each, domain snapshots). The selection used real Express middleware and disposable PGlite with synthetic records.

## Rewrite attempts

Both `pnpm --filter @nexus/web exec playwright test --config playwright.pg022.config.ts --workers=1 --retries=0` and the same invocation with `playwright.pg023-integration.config.ts` initially exited 1 at the store lock. T005's approved boundary is the two independent same-origin browser GET paths to actual Next, Express and disposable PGlite. It excludes a combined Employee Overview render and cross-request consistency.

The approved repeat of the PG-022 selection exited 0, one runner instance passed. The existing authorized browser fixture drove the Department GET from Next 5283 to Express/PGlite 5284. Its assertions cover actual rewrite receipt, the seeded Department UI and unchanged snapshots.

From apps/api, `node scripts/run-tests.mjs tests/features/employees/pg024-overview.test.ts` exited 0 in the isolated approved environment. Both T007 and the scoped T002 adapter passed. T002 verified 200 for Admin and Superadmin, 403 without a directory array for Staff and User, 401 without a session, and equal checked snapshots. The two T007 executions overlap.

The approved PG-023 rewrite repeat exited 0, one runner instance passed. The existing synthetic fixture used Next 5285 and Express/PGlite 5286. Chromium requested the Employee list through the same origin, Express recorded the GET and the seeded Employee rendered. The same declaration also checked the detail GET and matched before/after persisted snapshots. These two independent integration selections together account for T005.

## Teardown

The two fixture compile directories run-fjripE and run-hNb72J persisted after Playwright exit and were removed after ownership verification. A listener inventory showed no listeners on 5273/5274, 5283/5284 or 5285/5286. The regular PGlite API runner and fixture lifecycle handled synthetic databases. No container was started.

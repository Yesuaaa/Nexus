# PG-018 Unit, API and Browser Implementation Plan

Design only. Phase 2.2 requires separate authorization; no tests or fixtures were implemented/executed. Approved proposed inventory: 22 atoms, 36 unique records, 17 new declaration groups, five additive groups, 13 existing-sufficient and one blocked; 35 implementable (Unit5, API8, Browser21, Integration1). A new declaration group represents one case; role/viewport parameterization may expand runtime test count.

## Source and targets

| Layer       | Future target / action                                                                                                                                                                                            | Boundary                                                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Extend apps/web/test/calendar.test.mjs with A018-T002; preserve calendar-regression.test.mjs and all date/status assertions                                                                                       | Import actual calendarConflicts; do not reproduce algorithm.                                                                        |
| API         | New apps/api/tests/pg018-calendar.test.ts for HTTP inactive, client milestone projection, internal source exclusions, leave window/privacy and query validation; additive A020-T002 in calendar.test.ts           | Reuse offline PGlite app/session support; no live DB. Keep existing direct-service assertions and add explicit controller requests. |
| Browser     | New apps/web/e2e/calendar/pg018-regression.spec.ts for pending/order, refresh/races, grid keyboard/density, upcoming/Join boundaries, filter/reset and metrics; five additive groups in existing calendar.spec.ts | Real page, controlled API fixtures and frozen clock. Keep original eight role/viewport declarations and P20 cases.                  |
| Integration | New apps/web/e2e/calendar/pg018-integration.spec.ts plus directly necessary tests/support/pg018-browser-server.ts                                                                                                 | Real page + intercepted forwarding to real Express/auth/Prisma/PGlite; mock only shell/account bootstrap.                           |

## Fixtures, scope and cleanup

Use synthetic Client A/B with distinct requests, conversations, consultation/meeting IDs and shared/unshared milestones. Internal fixtures need ordinary STAFF, current Head, project lead/team lead, ADMIN/SUPERADMIN, assigned/foreign projects and employees. Add approved leave request/day snapshots with policy assignments and distinct business timezones; migrations must be applied by existing PGlite harness before seed. Verify actual seed data and actor scopes, not assumed preconditions. Preserve no-real-company-data rules. Capture domain snapshots before read-only integration and compare after; allow authentication session bookkeeping separately. Use secret-protected test control endpoint only if inspection cannot otherwise read isolated persistence. Dispose DB/server, route handlers and gated promises in finally; no shared ports or dev systems.

Calendar has one direct endpoint. USER query differs from internal scope/month. Local filters must be asserted as local transformations without copied production logic. Capture actual request/query transitions and deterministic fixture expectations. For async cases hold specific requests and release after the newer response is accepted; prefer explicit response/state barriers, not fixed sleeps. Freeze clock before rendering and advance minute timer to exercise Join boundary. Do not add retries or relax assertions for known failures.

## Integration decision

A019-T003 is justified because current browser cases mock all event data and API cases do not show browser wiring. Browser must show A only, navigate/inspect encoded projection, use B's independent token to establish reciprocal ownership, and verify read-only snapshots. Report actual forwarded endpoints/statuses. Account/preferences/conversation-shell bootstrap is mocked; production Next rewrite is bypassed. There is no source-specific reason for a new production-proxy test. External meeting providers remain outside scope; do not visit arbitrary external URLs. Validate href/target/rel and intercept navigation if activation is required.

## PostgreSQL decision

**NOT JUSTIFIED for this approved page scope.** Calendar is read-only, uses Promise.all across independent source queries, and has no lock, mutation, idempotency operation or specified cross-source transaction snapshot invariant. PGlite verifies real predicates, joins, date fields and projection. A hypothetical concurrent change may yield a mixed cross-source observation because no transaction is promised; do not invent a snapshot-consistency expectation. PG-017 repeatable-read and PG-015 locking cases do not apply. No PostgreSQL declaration, disposable DB or concurrency experiment is required here. If a later product contract mandates an atomic cross-source snapshot, design a separate transaction/concurrency task first.

## Future focused commands (not executed)

- `pnpm --filter @nexus/web exec node --experimental-strip-types --test test/calendar.test.mjs test/calendar-regression.test.mjs`.
- `pnpm --filter @nexus/api test tests/calendar.test.ts tests/calendar-regression.test.ts tests/pg018-calendar.test.ts` after adding the approved file.
- `pnpm --filter @nexus/web exec playwright test e2e/calendar.spec.ts e2e/calendar --workers=1 --retries=0` with live mode disabled and a task-owned local server; verify supported runner argument forwarding.
- Relevant compatibility: P20 validators, NEX-015 project lead/role-scope assertions, workload completed-history test, leaveLifecycle projection and route-policy helper tests. Select exact declarations safely; do not run full project, leave or Attendance suites merely because a shared helper is used.
- New responsive scenarios at390/1440; preserve existing role widths and controlled timezone cases. Add820 only for a demonstrated layout boundary, not as artificial case multiplication. Isolate browser contexts and DB workers; integration one worker, no production credentials.
- Quality gates: pnpm format, pnpm lint, pnpm typecheck, git diff --check. Preserve enabled historical failures and record actual outcomes. No execution readiness blocker was observed in discovery; infrastructure is source-verified only until authorized execution.

# PG-004 Gaps and Dependencies

## Confirmed functional gaps

The current implementation is testable from source; no unresolved contract blocks design. The priority gaps are verification gaps:

1. Exact route authorization is only partially asserted by unit tests for `/attendance/adjustments`; denied/inactive/Superadmin grant cases are not a complete route-specific matrix.
2. The default, untyped mixed queue is not independently tested for both request types, default query parameters, scoped data, filters, pagination, empty/error/retry states, or stale list responses.
3. The PG-004 Request correction action and its correction-only form have no direct browser test. Current real submission starts on `/attendance/check-ins` and later checks only a Pending status on PG-004.
4. PG-004's ordinary row-details action is not directly asserted. Existing detail tests use typed deep links or typed-route list actions.
5. Browser verification reaches Head verification but does not finish an HR correction decision or exercise rejection from the default route. API/PGlite tests already cover these persistence rules.
6. Overtime 409 recovery and access-loss cleanup exist on the typed overtime route, but the same code path has not been asserted on the default mixed route.
7. Default-route keyboard focus and narrow-width behavior are not directly asserted. Related responsive attendance and typed-route tests remain useful shared coverage.

These gaps are test additions, not source defects inferred from the audit.

## Source/mapping discrepancies

- **API grouping:** Phase 1 lists `attendance-api` and `leave-api` where a rendered section requires it. The current PG-004 page and its direct child components import/use attendance endpoints only; they do not call the leave client.
- **Navigation:** the approved inventory gives the direct route, while current sidebar navigation lists the Requests & Approvals overview, typed overtime, typed corrections, and leave links. `/attendance/adjustments` is an exact, guarded route-policy entry but is not emitted as a sidebar link. Direct route access remains source-supported.
- **Shared component:** PG-004, PG-010 and PG-012 use `AttendanceAdjustmentsPage`. PG-004 passes no request type or linked ID; it has a mixed queue/type filter. PG-010/PG-012 route modes must remain separately identified and their regressions preserved.
- **Baseline HEAD:** request-reported `9335f946...` differs from current clean task-entry HEAD `b870c7a2...`. Current source was treated as authoritative; no Git state was reset or changed.

## API, persistence, and role dependencies

- Direct route source calls `GET /api/attendance/adjustments`, `POST /api/attendance/adjustments`, and `POST /api/attendance/adjustments/:id/review`. Ordinary detail-panel opening uses row data; stale overtime reconciliation calls `GET /api/attendance/adjustments/:id`.
- `AttendanceAdjustment` has employee/session/requester/reviewer/verifier and workflow-notification relationships. Correction final approval can create/update attendance sessions; Head verification is intermediate; overtime approval records request state without rewriting attendance timestamps.
- UI role helpers only select visibility/default scope. The API independently applies requester/employee ownership, current Head/department scope, HR organization scope, review stage, and per-row capabilities. Tests must assert both UI and server enforcement where relevant.
- Exact route policy: active STAFF/ADMIN and active SUPERADMIN with `employees:read`. Request creation requires personal self-service plus server `requestCorrection` capability. Review UI additionally requires team scope and response capabilities.

## Test and fixture dependencies

- Web unit runner: Node `node:test`; existing `attendance.test.mjs` imports production attendance/auth/workspace logic.
- Mocked browser plan: `configureRegressionTest`, `restoreSession`, and request handlers from `apps/web/e2e/regression-support.ts`; no database required.
- Full-stack browser plan: existing serial `apps/web/e2e/attendance.spec.ts` owns the process for `apps/api/tests/support/attendance-browser-server.ts` and forwards `/api/**` to Express backed by isolated PGlite.
- API contract plan: `apps/api/tests/support/pglite-app.ts`, issued local sessions, deterministic clock/policy and transaction-safe fixture setup.
- Superadmin regressions use route mocks and skip when `live` mode is active; retain this behavior and do not use live accounts for PG-004.

## Deferred contracts retained from prior pages

- PG-001 whitespace-only token semantics: `PG-001-F001-A002-T010` remains deferred.
- PG-002 contracts C001/C002 and T003 remain documented in PG-002 gap records.
- PG-003 query/navigation-state C001 and T010 remain blocked and excluded from its implementable totals.

These items are unrelated to PG-004 and are preserved unchanged in the progress ledger. PG-004 has zero contract-blocked cases.

## Readiness decision

PG-004 is ready for a separately authorized Phase 2.2 implementation of 14 additions (12 new tests and two additional assertions). No application or test source changes are required to complete this Phase 2.1 design. The seven design records and ledger entry are the complete Phase 2.1 deliverable.

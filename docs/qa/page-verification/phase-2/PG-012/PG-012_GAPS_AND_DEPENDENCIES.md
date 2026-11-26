# PG-012 Gaps and Dependencies

## Coverage gaps

1. The shared queue has existing loading/error/filter/pagination assertions on `/attendance/adjustments`, but no focused suite isolates the canonical `/attendance/requests/overtime` typed mode for normal unlinked listing, scope changes, settled search, status filters, filter reset, responsive layout, and table projection.
2. Backend source tests cover important overtime validation and lifecycle transitions, but gaps remain for an explicit 1-minute rounding boundary, future/reversed intervals, approved-leave overlap, full per-status filter response, current Head rejection, verified HR rejection, and Superadmin verified-stage decisions.
3. No dedicated PG-012 browser form test exists. Review note required/min/max, cancellation, pending duplicate submission, server failure recovery, keyboard controls, and current stale/private-detail reconciliation need page-specific assertions.
4. Existing current-head notifications and typed deep-link tests provide real Browser/API/PGlite evidence. The ordinary queue list after automatic clock-out is not separately asserted through the typed page; add that integration case before claiming page-level persistence coverage complete.
5. Existing unit route-policy coverage iterates attendance navigation links but does not explicitly assert the full Overtime active/inactive/Superadmin grant matrix. Add targeted assertions while preserving shared route tests.
6. Existing API pagination coverage is direct to the shared endpoint, but it does not establish all PG-012 filter combinations, scopes, and status capability projections.

## Contract clarifications required

| Contract ID | Ambiguity                                                                                                                                                               | Source evidence                                                                                                                       | Required decision / blocked coverage                                                                                                                                              |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PG-012-C001 | Empty-state copy says users may submit an Overtime request, while the PG-012 route hides the request control and says Overtime is automatically submitted at clock-out. | `attendance-adjustment-table.tsx:171-175`; `attendance-adjustments-page.tsx:299-305,337-343`; prior PG-010 T036/C001 wording deferral | Product/content owner decides route-specific copy and whether a submission affordance is expected. Block exact empty-message assertion. Keep PG-010 C001 open.                    |
| PG-012-C002 | Generic API accepts `type="OVERTIME"` manual requests, but PG-012 UI exposes no manual form and describes clock-out automation.                                         | `attendance-api.ts:429-440`; `attendance.management.ts:1506-1598`; page `:220-228,337-343`                                            | Product owner confirms whether manual Overtime entry is intended for a user-facing route or API-only path. Block UI presence/absence requirement beyond recording current source. |

These contracts do not block source discovery or unrelated source-defined test design. They are excluded from the 35 implementable case count.

## Authorization and data isolation dependencies

- Frontend route policy and navigation uses attendance self-access eligibility; this is not a backend gate. Verify route matrix and API separately.
- Attendance Express routes all use `requireAuth`; detail/read/review methods then enforce USER denial, own-record denial, current Head department scope, ADMIN HR scope, Superadmin `employees:read`, current lifecycle status, and returned action capabilities.
- A reviewer must not read or act on hidden employee/department data through list query parameters, detail ID, or stale panel state. Test unauthorized response and absence of private projections.
- An actor's own Overtime request is not reviewable. Never infer review permission solely from role or visible route.
- API POST for explicit Overtime uses the authenticated caller's employee record. Clock-out-generated rows use attendance session/workday and same transaction path; tests should not cross employee/department fixtures.
- HEAD/HR recipient changes must follow currently active users and current assignment. Existing notification handoff tests are the primary reusable coverage.

## Shared component and reliability dependencies

| Shared dependency                      | PG-012 usage                                                                     | Prior evidence                                                                                            | PG-012 action                                                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `RowActionsMenu`                       | Overtime table action trigger/menu in `attendance-adjustment-table.tsx:235-249`  | Confirmed `PG-004-D-001`, reproduced on PG-004, PG-006, PG-008, PG-010 and PG-011                         | Add a PG-012-specific keyboard reproduction at 390/820/1440 px. Keep a failing assertion if reproduced; do not pre-label PG-012 defective. |
| Responsive attendance adjustment table | Same table component, responsive grid at <=1000 px                               | PG-006/T024 intermittency at 820 px; PG-008 had a 390 px fixture failure                                  | Verify PG-012 at fixed sizes and record independent outcome. Do not treat a pass as closing those findings.                                |
| `SidePanel`                            | Detail and review forms use shared Dialog/Radix primitives and focus restoration | PG-004 shared panel test includes focus coverage; PG-011 had a separate route-fetch teardown intermittent | Verify labels, keyboard close, pending dismissal and focus on this route; do not conflate intermittent signatures.                         |
| `useAsyncResource`                     | Queue/detail fetch, retry, signal cleanup                                        | PG-011 route-fetch teardown was intermittent in its transfer test                                         | Use deterministic delayed/error responses; no PG-012 reliability result exists yet.                                                        |
| Status/capability projection           | Shared backend adjustment endpoints return per-row review capability             | Existing PG-004/PG-010/PG-011 mixed route tests exercise shared states                                    | Test current typed route and each actor separately; UI capabilities do not substitute for API denial.                                      |

## Integration and database dependencies

- The page has real persistence dependencies: `AttendanceAdjustment` plus work sessions/workdays/breaks, employees, departments/users, workflow notifications, attendance audit, and leave overlap records.
- API/PGlite is sufficient for most deterministic validation, list/detail authorization, transaction, notification, and persistence assertions. Use `apps/api/tests/support/pglite-app.ts`.
- Mocked Playwright verifies UI presentation and request behavior only. The existing real Browser/API/PGlite fixture is needed to prove the typed route renders a persisted automatic clock-out row.
- The existing opt-in PostgreSQL test provides source evidence of an available real-PostgreSQL harness for overtime routing and leadership changes. Reconfirm the disposable environment before execution. Its existence does not prove that the current environment is available or that the test passed during PG-012 discovery.
- PG-008's separate policy-assignment concurrency blocker remains unverified. Neither this page's overtime routing test nor prior PG-010/PG-011 PostgreSQL executions close it.

## Historical QA preservation

This PG-012 design does not change any previous status, failure, contract, or intermittency:

- PG-001 token whitespace remains contract-blocked.
- PG-002 create/edit/API validation and unauthorized list navigation remain documented.
- PG-003 query/navigation state remains contract-blocked.
- PG-004-D-001 remains the confirmed shared keyboard row-action defect.
- PG-005 cleared-date and detail-panel filtering remain contract-blocked.
- PG-006 remains implementation complete with partially complete verification; T018 defect reproduction, T024 intermittent 820 px, T025/C001 cleared-date blocker, unspecified default history timezone basis, and profileless ADMIN HTTP 409 recovery limitation remain.
- PG-007 implementation/focused verification remain complete with cleared-date and suspended-session UI contracts deferred.
- PG-008 remains partially verified with its shared-menu reproduction, separate assignment PostgreSQL blocker, 390 px fixture failure, and seven non-working-days contract.
- PG-009 remains implementation/focused verification complete with reporting scope/counter and canceled-assignment semantics deferred and no confirmed page defect.
- PG-010 remains implementation complete with partially complete verification: 34/35 executable records passed; T035 reproduced PG-004-D-001; T036/C001 empty-copy contract deferred; T032 disposable PostgreSQL race passed. Its run does not resolve PG-008's separate race.
- PG-011 remains implementation complete with partially complete focused verification: 42 records, 40 implementable, 37 passed, one shared keyboard-menu failure, two intermittent cases, and two contract blockers. The route-fetch teardown and Edit-menu timeout remain separate signatures. Prior disposable PostgreSQL execution does not establish PG-012 runtime behavior.

## Dependencies before implementation

1. Confirm the two PG-012 copy/action contracts with the product owner; keep their tests blocked until a decision is recorded.
2. Inspect and preserve each listed existing declaration before adding assertions. Reconcile test IDs without renumbering PG-004/PG-010/PG-011 records.
3. Reconfirm `attendance-browser-server.ts` fixture port/worker lifecycle before adding the ordinary queue persistence integration case.
4. Reconfirm the disposable PostgreSQL URL preconditions for the opt-in existing test if that scenario is included in the authorized Phase 2.2 run.
5. Record focused execution evidence separately from source inventory; no PG-012 result exists yet.

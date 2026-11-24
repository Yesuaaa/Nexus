# PG-011 Gaps and Dependencies

## Coverage gaps

The most material direct page gaps are:

1. Leave request form initialization, native field boundaries, preview progress/failure/recovery, submission feedback, and real browser-to-database persistence.
2. Page-level list states and controls: loading/empty/retry, search debounce, type/status/date filters, paging, and complete row presentation.
3. Page-level cancel/reverse confirmation, normal Head decision UI, and HR decision error handling.
4. Accessible keyboard interaction and responsive Leave row actions, especially the shared keyboard menu at 390/820/1440 px.
5. A competing Leave decision race using independent transactions on real PostgreSQL. Existing PGlite account-disable/approval concurrency and sequential replay do not verify this race.

API coverage is substantially stronger than page-level coverage. Existing API/PGlite cases directly cover staged review, source role/scope behavior, idempotent replay, overlaps, transfer/reverification, attendance conflicts and downstream effects. Preserve them rather than duplicate them with another API implementation.

## Contract blockers

| ID                      | Question                                                                                                                                                         | Source evidence                                                                                                                                                                                                                  | Required resolution                                                                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PG-011-C001 / A002-T003 | Should an active ADMIN with route access but no linked Employee see Request leave, receive a supported recovery path, or follow another product-defined process? | Frontend personal-access predicate accepts ADMIN; page displays the button; backend mine/preview/submit requires Employee and rejects missing profile. PG-006's separate profileless ADMIN 409 is not a PG-011 product contract. | Product owner defines expected button/action behavior and user-facing failure/recovery before page assertion. Independently retain backend no-write authorization coverage. |
| PG-011-C002 / A010-T003 | Should a selected detail panel remain open when a new search/filter/scope response omits its row?                                                                | Page keeps `selection` and falls back to the selected request object even when current list no longer contains it. No authoritative behavior requirement was found.                                                              | Product owner defines whether panel persists, closes, or reloads under the new scope. Do not assert current implementation as desired behavior.                             |

These two records are excluded from the 40 implementable test cases and all test-layer counts.

## Shared-component and reliability dependencies

- PG-011's `LeaveRequestTable` uses shared `RowActionsMenu` (`apps/web/src/components/ui/row-actions-menu.tsx`). PG-004-D-001 is confirmed and PG-010 T035 reproduced the keyboard failure twice at 390, 820 and 1440 px. Add a direct PG-011 reproduction case; do not label PG-011 defective before its own execution evidence.
- PG-006 T024's 820 px result remains intermittent. A single isolated pass does not close it.
- PG-008's 390 px compatibility case had a fixture failure. Preserve the distinction between test fixture failure and application defect.
- PG-010 successfully ran T032 on a fresh disposable PostgreSQL 16 instance. This may support reuse of isolated PostgreSQL infrastructure after reconfirmation; it does not resolve PG-008's separate assignment-concurrency blocker.
- The current real browser/API fixture is serial, shares a local port, and starts an isolated PGlite API. Keep its browser selections at one worker and do not run concurrently against the same fixture.

## Environment and fixture dependencies

| Work                          | Required infrastructure                                                                                                    | Limitation                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Unit route policy             | Web Node unit runner; production route helpers                                                                             | Does not prove Express authorization.                                                                |
| API contract/persistence      | `startPgliteApp` and local synthetic accounts, Employee/Department/Head and AttendancePolicy fixtures                      | Do not point at live/configured database. PGlite does not establish PostgreSQL lock races.           |
| Mocked page browser           | Chromium/Playwright and controlled same-origin route responses                                                             | Establishes rendering/request shape only. No persistence claim.                                      |
| Real request form integration | `attendance-browser-server.ts`, browser-to-Next proxy, API service and PGlite; working policy assignment and Head fixtures | Existing spec owns serial lifecycle/fixed port; use one worker.                                      |
| Concurrent decision race      | Verified disposable PostgreSQL with independent connections and barrier                                                    | Explicit opt-in only; database target must be validated and isolated; no fallback to `DATABASE_URL`. |
| Browser outputs               | Playwright Chromium project and viewport selection                                                                         | Existing intermittent 820 px history and shared menu defect require retaining failures.              |

## Previous QA findings to preserve

PG-011 work did not change earlier statuses. The cumulative ledger remains the authority for full historical evidence. At this baseline, preserve:

- **PG-001:** whitespace-only token behavior remains contract-blocked.
- **PG-002:** create/edit/API validation differences and unauthorized list-response navigation remain unresolved.
- **PG-003:** query/navigation-state contract remains deferred.
- **PG-004:** `PG-004-D-001` is a confirmed keyboard-operated row-action menu defect.
- **PG-005:** cleared-date and detail-panel filter-state behavior remain contract-blocked for PG-005.
- **PG-006:** implementation complete; verification partially complete. T018 reproduces the shared menu defect; T024 remains intermittent at 820 px; T025/C001 cleared-date behavior is blocked; timezone basis unspecified; ADMIN without Employee profile gets HTTP 409 with limited recovery.
- **PG-007:** implementation/focused verification complete for authorized scope; cleared-date and suspended-session UI semantics remain deferred.
- **PG-008:** implementation complete; verification partially complete. Shared menu defect reproduced; a separate policy-assignment PostgreSQL concurrency case remains environment-blocked; 390 px compatibility test had a fixture failure; seven-non-working-days contract remains deferred.
- **PG-009:** implementation/focused verification complete; reporting-scope/counter wording and canceled-assignment count semantics remain deferred; no PG-009 defect confirmed; related PG-006 820 px intermittency was reproduced in compatibility testing.
- **PG-010:** all 12 new declarations and 11 additive assertion groups implemented; 12 existing-sufficient cases retained; implementation complete and verification partially complete. 34/35 executable records passed; T035 reproduced `PG-004-D-001` at 390/820/1440 px twice; T036/C001 empty-state wording is blocked; T032 passed on disposable PostgreSQL 16; quality gates passed. Do not call PG-010 fully passing.

PG-010 T032 disposable PostgreSQL success and PG-008's unrelated assignment-concurrency blocker are distinct facts; one does not close the other.

## PG-011 disposition and readiness

- Approved identity and current route source agree; no renumbering or source discrepancy found.
- Twenty-four source-backed atomic behaviors are inventoried.
- Forty-two unique case records are specified: 15 new declarations, 13 additive assertion groups, 12 existing-sufficient cases, and 2 contract-blocked cases.
- Forty implementable cases span 1 Unit, 15 API, 19 Browser, and 5 Integration cases.
- Existing assertions and shared defects are explicitly preserved. No tests were run for this discovery.
- PG-011 is ready for separately authorized Phase 2.2 on the 40 source-supported cases. A002-T003 and A010-T003 remain blocked pending contract clarification. The optional real PostgreSQL race also requires a verified disposable target before implementation/execution.

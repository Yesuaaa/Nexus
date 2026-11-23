# PG-006 Gaps and Dependencies

**Page:** PG-006, `/attendance/check-ins`  
**Phase:** 2.1 source discovery and design only. No tests were implemented or run.

## Contract needing clarification

### PG-006-C001 — Clearing a history date

When either From or Through becomes blank, the page stops issuing a history request. `useAsyncResource` retains its last successful `data`, which can remain visible. Current source does not define whether the product should clear the table, retain old rows, show validation, or request an open-ended range. T025 is `CONTRACT CLARIFICATION REQUIRED` and excluded from the 24 implementable records. Do not add an acceptance assertion until the behavior is decided.

The default date range also uses the browser's current `Date` and ISO conversion. Product timezone semantics (device calendar, UTC, or employee policy timezone) are not specified. Filter tests should compare request dates with the visible control values, not assert a guessed date basis.

## Source-backed risks and test gaps

- **Route/API profile mismatch:** active ADMIN is allowed through the page route policy but self-service endpoints require a linked Employee and return 409 otherwise. T004 specifies API behavior; the design does not assume all administrators have profiles.
- **Shared row menu:** PG-006 history uses the shared `RowActionsMenu`. Confirmed PG-004-D-001 reports a keyboard menu item missing on `/attendance/adjustments`. Treat that as a regression risk and test PG-006 directly before classifying any manifestation; do not relabel the confirmed PG-004 defect.
- **Client/server validation boundary:** the correction dialog advertises 5–2,000 reason characters and the management service uses `text(input.reason, 5)` whose default maximum is 2,000. T021 adds API-level boundary/persistence assertions.
- **UI versus service state machine:** backend tests already cover self-ownership, server time, action transition validation, concurrent serialization, policy checks, and date/page bounds. Browser cases should verify controls, feedback, rendering, and request wiring rather than copy backend calculations.
- **No direct self-history table coverage:** existing browser flows prove page load, overnight display, and correction entry but do not fully assert filter values, page changes, stale data, empty/error states, row summaries, or detail-panel keyboard behavior.
- **Live mode skips:** `attendance-entry.spec.ts` and `superadmin-attendance.spec.ts` intentionally skip when live regression mode is enabled. Preserve these declarations and use isolated fixtures for focused tests.

## Deferred and preserved prior findings

These remain open exactly as tracked in the cumulative ledger; PG-006 design does not resolve them:

- PG-001 whitespace-only token semantics.
- PG-002 create/edit/API validation differences and list 401/403 navigation behavior.
- PG-003 C001 query/navigation-state contract.
- PG-004-D-001 confirmed keyboard row-action menu defect.
- PG-005 T019/C001 cleared-date behavior and T020/C002 details state during filter changes. PG-005 is complete for its source-supported scope; these two cases remain deferred.
- PG-006-C001 date-clearing behavior described above.

## Dependencies and implementation readiness

- No schema changes, migrations, live PostgreSQL service, or new fixture framework are required by the current inventory.
- Existing PGlite and isolated browser/API attendance fixtures cover all proposed persistence cases.
- T002/T005/T012–T015/T017–T018/T023–T024 can use mocked same-origin API responses for deterministic browser state assertions.
- T003/T004/T016 use PGlite backend app; T021/T022 use the existing management suite; T006 uses existing production helper tests.
- T007/T009 use the existing isolated browser server and controlled attendance clock. T008/T010/T019/T020 are preservation cases already covered end to end.
- Sixteen new/additional assertions are ready for Phase 2.2. Eight existing-sufficient cases require preservation. T025 remains contract-blocked. No implementation authorization is assumed by this plan.

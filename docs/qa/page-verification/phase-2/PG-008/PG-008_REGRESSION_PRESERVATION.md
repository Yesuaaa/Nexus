# PG-008 Regression Preservation

## Preserved earlier findings

No earlier-page test, application, authorization, or defect record was edited. The cumulative ledger continues to preserve the prior findings:

- PG-001 whitespace-only token behavior remains contract-blocked.
- PG-002 create/edit/API validation differences and 401/403 navigation behavior remain documented.
- PG-003 query/navigation-state behavior remains contract-blocked.
- PG-004 `PG-004-D-001` remains the confirmed keyboard-operated shared row-action menu defect.
- PG-005 cleared-date behavior and detail-panel persistence while filtering remain contract-blocked.
- PG-006 remains implementation complete with verification partially complete: T018 reproduces `PG-004-D-001`; T024 remains intermittent at 820 px; T025/C001 and the default history timezone basis remain unresolved; profileless ADMIN recovery remains limited after HTTP 409.
- PG-007 remains complete for its implemented source-supported scope with T006/C001 and T010/C002 unresolved.

## PG-008 regression decisions

The PG-008 keyboard test intentionally retains its failing assertion. It reproduces the same shared `RowActionsMenu` behavior already tracked as `PG-004-D-001`; it is not assigned a new defect identifier. The keyboard test catches the missing item, verifies that pointer opening remains available, then rethrows the original keyboard failure so the regression stays red.

The existing policy directory, assignment, lifecycle, API authorization, unit validation, employee-selection, partial-retry, and responsive declarations were retained. Additions are additive assertions in their original declarations or new uniquely identified cases. No `test.skip`, weakened expectation, renamed regression, or removed assertion was introduced.

The 390 px cross-page responsive failure came from an existing attendance-record first-page fixture assumption and occurred before the policy settings/panel assertions. It is documented in the execution report as a test/fixture failure; no claim is made that PG-008 responsive coverage passed at that viewport. The known PG-006 T024 intermittent result at 820 px remains associated with PG-006 only.

## Scope and source preservation

Modified files are limited to the approved web/API test files, a new opt-in PostgreSQL test, the cumulative QA ledger, and four PG-008 Phase 2.2 reports. No production source, generated Prisma schema, migration, seed behavior, or earlier-page test source was changed. Existing Phase 2.1 PG-008 design documents and task-entry ledger work were preserved.

See [execution results](PG-008_TEST_EXECUTION_RESULTS.md) for command-level outcomes and [final verification](PG-008_FINAL_VERIFICATION.md) for quality gates and repository state.

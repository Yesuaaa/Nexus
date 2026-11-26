# PG-010 Regression Preservation

## Shared menu defect

`PG-004-D-001` remains a confirmed keyboard-operated `RowActionsMenu` defect. PG-010 uses the same shared control. New T035 reproduces the failure at 390px, 820px, and 1440px in both repeated executions: keyboard ArrowDown does not make the `View details` item visible. The pointer path opens the menu and details successfully. The existing PG-004 T011 read-only details/focus assertions passed before its separate keyboard/responsive subcase failed at the same menu item.

This evidence extends the known defect's affected-page list; it does not create a duplicate defect record or indicate a fix. No production component was modified. Keep the failing test enabled.

## Existing PG-010 coverage retained

The 12 cases whose approved disposition was `EXISTING COVERAGE SUFFICIENT` were not replaced or weakened. Focused verification exercised them as follows:

| Test ID | Preserved behavior                                                   | Result                                                                                                               |
| ------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| T010    | Stable ten-row API pagination and ordering                           | Passed in API/PGlite bundle.                                                                                         |
| T011    | Read-only row details and focus restoration                          | Its detail assertions passed; the enclosing declaration later failed in the keyboard subcase tied to `PG-004-D-001`. |
| T012    | Replacement Head notification deep link and read state               | Passed.                                                                                                              |
| T013    | Typed, wrong-type, missing, and out-of-scope linked detail handling  | Passed.                                                                                                              |
| T016    | Device-zone gaps/folds, offsets, and overnight correction timestamps | Passed in four browser cases; pure helper assertions also passed in the unit run.                                    |
| T020    | Request-key replay idempotency and payload conflict                  | Passed in API/PGlite bundle.                                                                                         |
| T023    | Ownership, current department, and HR scope                          | Passed in API/PGlite bundle.                                                                                         |
| T024    | Head verification stage without applying proposed times              | Passed in API/PGlite bundle.                                                                                         |
| T025    | Authorized HR final correction decision                              | Passed in API/PGlite bundle.                                                                                         |
| T026    | Head/HR rejection without applying proposed times                    | Passed in API/PGlite bundle.                                                                                         |
| T028    | SUPERADMIN review rights do not imply personal correction access     | Passed in API/PGlite bundle.                                                                                         |
| T030    | Changed attendance snapshot prevents stale overwrite                 | Passed in API/PGlite bundle.                                                                                         |

The complete command list and raw suite totals are in [test execution results](PG-010_TEST_EXECUTION_RESULTS.md). Existing coverage outcomes are reported from those runs, not inferred from source inspection.

## Historical findings preserved

No previous finding was resolved, downgraded, or rewritten as a result of PG-010. The cumulative [Phase 2 progress ledger](../../PHASE_2_PROGRESS_LEDGER.md) retains the earlier page entries. Explicitly preserved items include:

- **PG-001:** whitespace-only token behavior remains contract-blocked.
- **PG-002:** create/edit/API validation differences and 401/403 navigation behavior remain documented.
- **PG-003:** query/navigation-state behavior remains contract-blocked.
- **PG-004:** `PG-004-D-001` remains confirmed.
- **PG-005:** cleared-date behavior and detail-panel persistence during filtering remain contract-blocked.
- **PG-006:** implementation complete, verification partially complete; T018 menu reproduction, intermittent T024 at 820px, T025/C001 cleared-history date contract, unspecified default history timezone, and profileless ADMIN 409 with limited UI recovery remain open.
- **PG-007:** cleared-date and suspended-session UI contracts remain as recorded.
- **PG-008:** partial verification, shared menu reproduction, prior 390px fixture limitation, PostgreSQL blocker, and C001 remain as recorded.
- **PG-009:** C001/C002 and the recorded 820px intermittent cross-page run remain open.
- **PG-010:** C001/T036 empty-state wording remains contract-blocked. No claim is made that the overtime wording is intended on a corrections-only empty list.

## Test source integrity

- Existing assertions in the modified web/API spec files remain present; additive assertions were inserted around them.
- No test is skipped or quarantined to produce a passing total.
- T035 is intentionally failing and must remain visible until the shared menu defect is fixed in a separately authorized production change and the regression is reverified.
- No PG-011 work was started.

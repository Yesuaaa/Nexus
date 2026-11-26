# PG-015 Final Verification

## Status

Implementation is complete. All 45 implementable case records have execution outcomes. **44 passed and one reproduced PG-004-D-001.** Two product-contract records remain deferred. PG-015 is partially verified with a confirmed defect.

| Measure        | Result                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------- |
| Implementation | 22 new declarations, three additive groups and 20 existing-sufficient cases preserved             |
| Unit           | Three unique records passed; focused runner 15/15                                                 |
| API/PGlite     | Twelve unique records passed; final focused runner 83/83                                          |
| PostgreSQL     | Two unique records passed on verified PostgreSQL 18.4                                             |
| Browser        | 15 unique records passed, one failed. Mocked PG-015 selection 14/15 plus existing coverage.       |
| Integration    | 12 unique records passed across 11 selected persistence-backed declarations                       |
| Compatibility  | Three mocked browser declarations passed; shared assertions also exercised in unit/API selections |
| Deferred       | A007-T003 incomplete range presentation, A020-T003 route-remount state                            |

Record and department scope, search and pagination, current-page CSV escaping, server reconciliation authorization, transaction rollback, audit and workflow effects, scoped replay, dual-write serialization and placement-change conflict were verified. The keyboard regression remains failing by design. At 390, 820 and 1440 CSS pixels, its expanded trigger exposes no accessible View details menu item. Pointer selection worked on the same row. Both final executions reproduced the failure. No additional PG-015 application defect was confirmed.

The prior browser fixture forwards intercepted attendance requests to real Express/Prisma/PGlite while bypassing the Next.js API rewrite. Synthetic requests and timing gates are tracked separately. Both PostgreSQL runs validated disposable identity and empty seed state and observed actual independent lock waits. The task-owned database and cluster were removed after verification.

## Repository and gates

HEAD `ea0b8703fc518ac49151bc81c7ac7744f96a4c9c` on `293-test-full-system-audit-for-verifying-recent-changes`. Task-entry changes were the cumulative ledger and seven untracked design reports, preserved in place. Final changes add approved test code, a synthetic fixture helper, four verification reports and the appended ledger. Nothing was staged. Production, permissions, schema and migrations were untouched.

| Command            | Final exit |
| ------------------ | ---------- |
| `pnpm format`      | 0          |
| `pnpm lint`        | 0          |
| `pnpm typecheck`   | 0          |
| `git diff --check` | 0          |

The [execution results](PG-015_TEST_EXECUTION_RESULTS.md) contain all 47 cases, exact commands and triage. The [regression preservation report](PG-015_REGRESSION_PRESERVATION.md) links to the entry assertions and describes setup repairs.

## Review

Ready for administrative acceptance review with PG-004-D-001 open. The two deferred product questions stay outside executable totals. Independent PG-016 work requires authorization.

# PG-015 Test Implementation Report

## Scope and repository baseline

The branch `293-test-full-system-audit-for-verifying-recent-changes` remained at `ea0b8703fc518ac49151bc81c7ac7744f96a4c9c`. No commits intervened since discovery. The task-entry worktree contained the modified Phase 2 ledger and seven untracked PG-015 Phase 2.1 reports. No files were staged. All seven reports were preserved. The approved canonical route, alias, permission gates, query grammar, CSV source and reconciliation transaction were rechecked against current application source.

| Path                                                                      | PG-015 work                                                                                                                                                                               |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/e2e/time-logs-records.spec.ts`                                  | 15 new real-page mocked Chromium declarations for account bootstrap, directory, filtering, paging, retry, stale reads, details, CSV, reconciliation UI, keyboard and responsive behavior. |
| `apps/api/tests/features/attendance/time-logs-records.test.ts`            | Five new Express/Prisma/PGlite declarations for merged reporting, directory and record grammar, reconciliation validation, and leave-related rollback and commit.                         |
| `apps/api/tests/features/attendance/time-logs-reconciliation.postgres.ts` | Two opt-in PostgreSQL declarations for overlapping writes and placement change while a write is blocked.                                                                                  |
| `apps/api/tests/support/pg015-records.ts`                                 | Shared synthetic actors, departments, employee placements, policies and deterministic workday/session/leave fixtures for the two API environments.                                        |
| `apps/web/test/attendance.test.mjs`                                       | One additive canonical and alias role-policy group.                                                                                                                                       |
| `apps/api/tests/features/attendance/time-logs-overview.test.ts`           | One additive bearer/role group extends PG-014 coverage to the PG-015 read endpoints.                                                                                                      |
| `apps/api/tests/features/attendance/backend.test.ts`                      | One additive temporal/lifecycle group extends the existing reconciliation case.                                                                                                           |

The 22 new declarations and three additive groups use approved stable IDs. The 20 existing-sufficient records retain their original assertions. Programmatic pagination uses stored work dates and deterministic IDs. CSV tests exercise the actual exported bytes and intercept HTTP only. The PostgreSQL tests independently validate cluster ownership/identity, migration ledger, transaction isolation and zero-row preconditions, then observe actual backend lock waits. No production source, permissions, schema or migrations changed.

The [execution matrix](PG-015_TEST_EXECUTION_RESULTS.md) reconciles all 47 cases. The [preservation report](PG-015_REGRESSION_PRESERVATION.md) identifies the three original assertion groups and their extensions.

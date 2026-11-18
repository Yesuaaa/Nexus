# Branch 266 database rollback

Completed: 2026-11-17

The user requested abandonment of branch `266-featsuperadmin-system-logs-diagnostics` and reversal of its database changes. Its WIP commit `1a2128c1` is not in the current `development` ancestry. No branch reset, branch deletion, remote push or application-code revert was needed or performed. Current Service Operations work is preserved.

## Confirmed database change

The branch added only migration `20261116130000_management_history_immutability`. Read-only inspection of the configured API migration database confirmed it was applied on 2026-11-16 and both enabled-always guards were present. This migration created no tables: it added statement-level UPDATE/DELETE/TRUNCATE guards to the existing `AccountManagementChange` and `WorkforceManagementChange` tables.

## Compensation applied

The exact original migration was recovered into the current repository and matched against its deployed checksum. Forward migration `20261117160000_revert_branch266_history_guards` removes only:

- `account_management_history_immutable` on `AccountManagementChange`.
- `workforce_management_history_immutable` on `WorkforceManagementChange`.
- `public.reject_management_history_mutation()` with restrictive dependency handling.

The original ledger entry remains applied; compensation is recorded as a subsequent successful migration. This retains accurate Prisma lineage rather than editing or deleting deployed migration history. Future migration runs will preserve the compensated final state.

Application used a scoped transaction with short lock/statement timeouts, original-checksum and exact-object checks, locks on the two target tables, and before/after row-count verification. The three DDL changes and the compensation ledger row committed atomically. No broad migration deployment or pending migration execution occurred.

All existing history records remained: 0 account-history rows and 4 workforce-history rows at verification. No business, workforce, account, attendance, workflow or Service Operations records were deleted. Table ACLs, RLS, roles and domain writers were not changed. Database-level append-only enforcement from this specific migration is removed; existing application history writers still append.

Final read-only inspection confirmed both guards and their function were absent, compensation was recorded successfully, and both history tables plus `ServiceOperationLog` remained present. The current Service Operations migration was also confirmed already applied on 2026-11-17; future actor/message refinements must use a new migration.

## Verification

Offline PGlite tests apply the original migration to populated history, prove destructive statements are initially denied, apply compensation, verify record preservation in both histories, confirm target removal and current log-table preservation, and rerun the compensation safely. The current Service Operations log suite is run alongside it. These tests do not access the configured database; the explicitly requested operator rollback and its read-only verification are separate operations.

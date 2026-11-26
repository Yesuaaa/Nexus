# PG-012 Regression Preservation

## Entry state preserved

- **Branch:** `293-test-full-system-audit-for-verifying-recent-changes`
- **HEAD:** `050fbc2b46b3a77d8785cf76a07c8c0a5c498e26`
- **Pre-existing tracked change:** `docs/qa/page-verification/PHASE_2_PROGRESS_LEDGER.md`.
- **Pre-existing untracked files:** seven PG-012 Phase 2.1 design reports in `docs/qa/page-verification/phase-2/PG-012/`.
- **Staged files:** none.

The Phase 2.1 reports and prior ledger content were retained. No branch, commit, fetch, reset, merge, rebase, or push operation was performed.

## Preserved assertions

The approved additions were additive. Existing PG-004 pagination, mixed-route correction/overtime, route-policy, correction tests, and stale-review assertions remain. Overtime API status fixtures now satisfy the existing database verification constraints; no prior assertions were weakened, removed, skipped, renamed, or reclassified. Existing notification/handoff and idempotency assertions remain in their original declarations.

The new browser assertion for `PG-012-F001-A009-T002` is intentionally retained as a failing regression. At 390, 820, and 1440 px the row menu reports expanded after ArrowDown but the `View details` item is neither visible nor focused. Pointer activation works at each size. This independently reproduces already confirmed `PG-004-D-001`; PG-012 did not receive a separate defect identifier. No menu code was changed.

## Historical findings unchanged

- **PG-001:** whitespace-only token remains contract-blocked.
- **PG-002:** create/edit/API validation differences and unauthorized list-navigation behavior remain unresolved.
- **PG-003:** query/navigation-state contract remains deferred.
- **PG-004:** `PG-004-D-001` shared keyboard row-action defect remains open.
- **PG-005:** cleared-date and detail-panel filtering contracts remain deferred.
- **PG-006:** implementation complete, verification partially complete; T018 menu reproduction, T024 820 px intermittency, T025/C001 cleared-date contract, timezone basis, and profileless ADMIN 409 recovery remain.
- **PG-007:** implementation/focused verification complete with cleared-date and suspended-session UI contracts deferred.
- **PG-008:** partial verification, shared menu reproduction, separate policy-assignment PostgreSQL blocker, 390 px fixture issue, and seven non-working-days contract remain.
- **PG-009:** implementation/focused verification complete; reporting-scope/counter and canceled-assignment semantics remain deferred; no PG-009 defect was confirmed.
- **PG-010:** implementation complete, verification partial; 34/35 executable cases passed, T035 reproduced `PG-004-D-001`, C001 remains deferred, and T032's PostgreSQL pass does not close PG-008's separate concurrency blocker.
- **PG-011:** implementation complete, verification partial; 37 passed, one shared-menu defect, two intermittent cases, and two contract blockers remain. Its PostgreSQL run does not establish PG-012 behavior.

None of the historical statuses above was changed by this task. PG-012's environment-blocked PostgreSQL execution is not evidence for or against PG-008's separate policy-assignment race.

## PG-012 boundaries and unresolved items

- C001 Overtime empty-state wording remains contract-blocked.
- C002 user-facing manual Overtime submission remains contract-blocked.
- PostgreSQL routing race A022-T001 remains environment-blocked; the task-owned test database never met the zero-account guard.
- `PG-004-D-001` remains open; no application fix was authorized or attempted.
- The new browser integration proves the Overtime list against Express/PGlite while Playwright intercepts API requests; it does not establish the production Next.js API proxy hop.

## Files changed by this implementation

Test-only source changes: `apps/api/tests/features/attendance/management.test.ts`, `apps/api/tests/features/attendance/overtime.test.ts`, `apps/web/e2e/attendance.spec.ts`, `apps/web/e2e/superadmin-attendance.spec.ts`, new `apps/web/e2e/attendance-overtime.spec.ts`, and `apps/web/test/attendance.test.mjs`.

Documentation changes: the four PG-012 Phase 2.2 reports and the appended PG-012 Phase 2.2 ledger section. The seven Phase 2.1 PG-012 files remain unchanged. No production app source, auth/permission code, schema, migration, shared component, or earlier page report was changed.

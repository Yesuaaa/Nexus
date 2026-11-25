# PG-013 Regression Preservation

## Entry state

- Branch: 293-test-full-system-audit-for-verifying-recent-changes.
- Task-entry HEAD: 098dec928ed89271f7af40764854c1d0b1bc72e1.
- Previously reported PG-013 Phase 2.1 HEAD: 03340d6136ec7d6680b9bbc68fa5738370d29398.
- One intervening security-fixture commit changed .gitleaksignore and docs/qa/security/GITLEAKS_CI_INVESTIGATION.md; it did not affect PG-013 source or tests.
- The cumulative ledger was already modified and the seven PG-013 Phase 2.1 reports were untracked at task entry. No staged changes or pre-existing source changes were present.
- Those Phase 2.1 documents and the existing ledger content were retained. HEAD and branch remained unchanged.

## Assertions and test boundaries preserved

- The unit-test route-policy declaration was extended with assertions for the approved exact path. Its other attendance route, permission, and role assertions remain unchanged.
- The Attendance summary PGlite declaration retains the 27-row fixture, pre-Head denials, invalid-scope check, scoped total, and department aggregation. New response projection and query/auth assertions are additive.
- The Leave staged-review PGlite declaration retains its lifecycle, detail visibility, transfer, cancellation, history, and audit assertions. New group-projection and query/auth assertions are additive.
- WC-06-F01 keeps its Head scope-switch behavior, three independent/paired 503 recovery variants, real 401 handling, real Head-revocation response checks, and stale scope response coverage. The retry after Head restoration is additive and does not remove the denial assertions.
- WC-06-F03 keeps its full lifecycle data, all six status/share rows, Leave terminal states, Needs attention calculations, zero-data state, mutation snapshots, and browser write tracking. Sparse-status and per-section empty-state checks are additive.
- Exactly four new Playwright declarations were added. Existing declarations were not removed, renamed, skipped, or weakened. Final focused selected runs reported zero skipped cases.
- A distinct isolated Head/department and policy-assigned Employee was added to the PGlite browser fixture for the one-record boundary scenario only.

## Historical QA findings left unchanged

- PG-001 whitespace-only token behavior remains contract-blocked.
- PG-002 create/edit/API validation differences and unauthorized list-response navigation remain unresolved.
- PG-003 query/navigation-state behavior remains contract-blocked.
- PG-004 defect PG-004-D-001, the shared keyboard-operated row-action menu defect, remains open.
- PG-005 cleared-date and detail-panel persistence during filtering remain contract-blocked.
- PG-006 remains implementation complete with verification partially complete: T018 reproduces the shared menu defect; T024 remains intermittent at 820 px; T025/C001 cleared-date and timezone contracts remain unresolved; profileless ADMIN receives HTTP 409 with limited UI recovery.
- PG-007 implementation and focused verification remain complete with cleared-date and suspended-session UI semantics deferred.
- PG-008 remains partially verified with the shared menu reproduction, separate policy-assignment PostgreSQL concurrency blocker, 390 px fixture failure, and seven-non-working-days contract deferred.
- PG-009 implementation and focused verification remain complete; reporting-scope/counter wording and canceled-assignment semantics remain deferred; no PG-009 defect was confirmed.
- PG-010 remains implementation complete with verification partially complete: 34/35 executable records passed, T035 reproduced PG-004-D-001 at 390/820/1440 px, T036/C001 remains contract-blocked, and T032 passed on disposable PostgreSQL.
- PG-011 remains implementation complete with verification partially complete: its confirmed shared-menu reproduction, two intermittent transfer-workflow cases, and two contract blockers remain. Its PostgreSQL result does not resolve PG-008's separate blocker.
- PG-012 remains implementation complete with verification partially complete: 33/35 executable cases passed, its shared-menu reproduction remains, A022-T001 was environment-blocked before execution, and its two contracts remain deferred. PG-010 disposable PostgreSQL evidence does not resolve PG-008's separate assignment-concurrency blocker.

No status above changed during PG-013. PG-013 does not use the shared row-action menu, so this phase did not attribute PG-004-D-001 to PG-013. PG-013's successful browser API requests reach Express/PGlite through the test fixture, not through the production Next.js proxy.

## PG-013-specific deferred behavior

- PG-013-F001-A003-T005: clarify the expected personal-scope control and recovery when active ADMIN has no Employee profile; Attendance returns 409 and Leave returns 403 from their current APIs.
- PG-013-F001-A007-T002: clarify whether static links to request queues should preserve the overview's selected scope.
- Neither contract was guessed or asserted.

## Changed-file boundary

Test-only changes:

- apps/web/test/attendance.test.mjs
- apps/web/e2e/attendance.spec.ts
- apps/api/tests/features/attendance/management.test.ts
- apps/api/tests/features/leave/leave-requests.test.ts
- apps/api/tests/support/attendance-browser-server.ts

Documentation changes:

- Four PG-013 Phase 2.2 execution reports.
- The PG-013 Phase 2.2 cumulative ledger entry.

No production application code, shared UI component, permission/authentication implementation, Prisma schema, migration, or earlier page report was changed. No full regression suite ran and PG-014 was not started.

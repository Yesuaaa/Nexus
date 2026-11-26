# PG-017 Gaps and Dependencies

Phase 2.1 source discovery and design are complete; the repository-wide gates remain blocked, and Phase 2.2 has not been authorized. No runtime findings can be inferred from source.

The list service uses repeatable-read for a consistent count and rows. PGlite coverage does not by itself prove actual PostgreSQL concurrent snapshot behavior. The separate PostgreSQL concurrency test is optional future shared-infrastructure work, outside the proposed page scope. The question whether ended statuses should be shown needs product/source reconciliation: backend filter schema accepts legacy and current statuses while the displayed status options use shared contract values. No expected visibility policy should be invented.

PG-004-D-001 remains open on previously documented pages; PG-017 attribution requires source and runtime reproduction. PG-016-D-001 remains confirmed with the failing assertion retained; PG-017 SidePanel is different from that proof Dialog. Preserve PG-006 T024, PG-011 intermittent records, and PG-008 and PG-012 PostgreSQL blockers as documented in the cumulative ledger. PG-016 remains 17/18 implementable passed, with one failure and one deferred contract; its previous quality gates were historical only.

The format and typecheck gates encounter a pre-existing syntax error in `apps/web/e2e/attendance.spec.ts:7593`; correcting test source is outside this task. See ledger for current check results. No implementation or test execution has been authorized.

## Current quality checks

- `pnpm format`: exit 2; Prettier cannot parse `apps/web/e2e/attendance.spec.ts:7593` (`}` expected). Initial sandbox attempt exited 1 due to denied pnpm store lock; rerun outside sandbox reached Prettier.
- `pnpm lint`: exit 1; the same parse error and six unused imports in `apps/api/tests/features/attendance/management.test.ts:6`?`:11`.
- `pnpm typecheck`: exit 1; TypeScript TS1005 at `apps/web/e2e/attendance.spec.ts:7593`.
- `git diff --check`: exit 0. No automated tests ran. These failures existed in the clean entry worktree and are outside the authorized documentation scope.

## Recovery disposition

PostgreSQL concurrency is **OPTIONAL / FUTURE**, for the shared RepeatableRead helper rather than a new required PG-017 lock test. A two-client real browser/Express/PGlite read workflow is proposed because browser fixtures currently mock the API. The Next.js rewrite remains outside that boundary.

The heading used as focus fallback may not be focusable, and the helper prefers a still-connected captured opener. Specify expected accessible focus for a deep-link close before treating fallback-to-heading as a passing requirement; ordinary opener/Escape behavior can be tested from source. Another contract question is whether the table should show `referenceNumber` instead of `id`: current table explicitly displays `id`; do not change or assert an unapproved alternate display. The server supports several legacy status enum labels while the UI offers its current lifecycle options; no extra visibility policy is assumed.

Both gate-blocker files match HEAD. The defects are unrelated to the documentation diff, but source inspection does not prove their historical cause. A separately authorized repair of the syntax error and unused imports is needed for normal repository-wide gates. The existing PG-004-D-001 and PG-016-D-001 remain open, as do all historical intermittent and environment-blocked findings in the ledger. No PG-017 runtime defect is confirmed.

## Documentation validation

Targeted `pnpm exec prettier --check docs/qa/page-verification/phase-2/PG-017/*.md docs/qa/page-verification/PHASE_2_PROGRESS_LEDGER.md` exited 0. A read-only Python audit checked seven report headings, local Markdown links, 16 unique atomic IDs, 33 unique case IDs and mappings, dispositions 13/4/15/1, implementable layers 10/21/1, 12 selected source paths and four selected line bounds; it exited 0. `git diff --check` exited 0. These checks do not execute tests or replace repository-wide quality gates.

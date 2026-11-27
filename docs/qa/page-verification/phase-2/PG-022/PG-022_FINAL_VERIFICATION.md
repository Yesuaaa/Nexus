# PG-022 Final Verification

24 PASS, 1 FAIL, 0 partial, 0 environment-blocked and 0 unexecuted out of 25 implementable cases. Two further cases remain contract-blocked. The responsive finding stays open for consolidated review.

Primary layers passed as follows: Unit 1/1, API/PGlite 5/5, Browser 17/18, Integration 1/1. The browser runner counted 19 instances because the retained T003 runs twice. T019's seven widths are steps in one instance. The final T016 focused rerun passed 1/1 and supersedes its earlier fixture evidence. C001 and C002 remain outside the implementable denominator.

| Stable case           | Outcome                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------- |
| PG-022-F001-A001-T001 | PASS. See focused execution evidence and implementation manifest.                            |
| PG-022-F001-A002-T002 | PASS. See focused execution evidence and implementation manifest.                            |
| PG-022-F010-A001-T003 | PASS. See focused execution evidence and implementation manifest.                            |
| PG-022-F011-A001-T004 | PASS. See focused execution evidence and implementation manifest.                            |
| PG-022-F011-A002-T005 | PASS. See focused execution evidence and implementation manifest.                            |
| PG-022-F011-A003-T006 | PASS. See focused execution evidence and implementation manifest.                            |
| PG-022-F011-A004-T007 | PASS. See focused execution evidence and implementation manifest.                            |
| PG-022-F012-A001-T008 | PASS. See focused execution evidence and implementation manifest.                            |
| PG-022-F012-A002-T009 | PASS. Read-only real Next rewrite through Express and PGlite.                                |
| PG-022-F002-A001-T010 | PASS. See focused execution evidence and implementation manifest.                            |
| PG-022-F002-A002-T011 | PASS. See focused execution evidence and implementation manifest.                            |
| PG-022-F003-A001-T012 | PASS. See focused execution evidence and implementation manifest.                            |
| PG-022-F004-A001-T013 | PASS. See focused execution evidence and implementation manifest.                            |
| PG-022-F004-A002-T014 | PASS. See focused execution evidence and implementation manifest.                            |
| PG-022-F005-A001-T015 | PASS. See focused execution evidence and implementation manifest.                            |
| PG-022-F006-A001-T016 | PASS. See focused execution evidence and implementation manifest.                            |
| PG-022-F006-A002-T017 | PASS. See focused execution evidence and implementation manifest.                            |
| PG-022-F007-A001-T018 | PASS. See focused execution evidence and implementation manifest.                            |
| PG-022-F008-A001-T019 | FAIL. Exact 560px, 640px and 1024px cutoffs differ from the approved inclusive expectations. |
| PG-022-F009-A001-T020 | PASS after correcting the skeleton wrapper locator.                                          |
| PG-022-F010-A002-T021 | PASS. See focused execution evidence and implementation manifest.                            |
| PG-022-F002-A003-T022 | PASS. See focused execution evidence and implementation manifest.                            |
| PG-022-F002-A004-T023 | PASS. See focused execution evidence and implementation manifest.                            |
| PG-022-F002-A005-T024 | PASS. See focused execution evidence and implementation manifest.                            |
| PG-022-F014-A001-T025 | PASS. See focused execution evidence and implementation manifest.                            |
| PG-022-F015-A001-T026 | BLOCKED — CONTRACT. PG-022-C001 malformed successful response.                               |
| PG-022-F015-A002-T027 | BLOCKED — CONTRACT. PG-022-C002 supported volume.                                            |

[Exact commands and attempts](PG-022_TEST_EXECUTION_RESULTS.md). [Regression preservation](PG-022_REGRESSION_PRESERVATION.md). [Abuse outcomes](PG-022_ADVERSARIAL_AND_ABUSE_CASE_ASSESSMENT.md#phase-22-execution-addendum).

Both passes of `pnpm format`, `pnpm lint`, and `pnpm typecheck` exited 0. The final pass followed the T016 fixture correction. All `git diff --check` invocations exited 0, including after final report edits. Typecheck used generated production route types. The inherited development route references were restored after it completed.

The final tracked worktree comprises the ledger update and the inherited `apps/web/next-env.d.ts` change. The index remains empty. The untracked paths comprise the eight inherited design reports (with the execution addendum appended to the assessment), four execution reports, and the four test/config paths listed in the implementation report.

The original 18 new-case declarations are accompanied by one separately registered T009 integration adapter. It executes the existing-sufficient read invariant without the membership POST from the original PG-021 spec. Counting all registrations added to the repository yields 19, with 18 mapped to NEW cases. None of the existing declaration bodies was extended.

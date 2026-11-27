# QA Gate Recovery Before PG-017

## Investigation record

Entry branch `293-test-full-system-audit-for-verifying-recent-changes`, HEAD `483511d7e9415e520521fb665df43ec1f1334968`. Entry worktree had seven untracked PG-017 design reports and the modified ledger, with no staged changes; both test files matched HEAD. No intervening commit since the discovery handoff.

The browser file is a conflicted combination of the split test runner and the older monolithic spec. The split runner in commit `794fd396` registers helper groups at top level. The current file retains both the monolithic body and those registrations, with the final monolithic automatic-overtime test truncated after its first queue assertions; the complete copy in `apps/web/e2e/attendance/stale-reviews.ts:84` continues through reload and persistence assertions. Simply closing the partial callback would silently keep a truncated duplicate and leave duplicated fixture hooks and test registrations. Its missing imports and semantic reconciliation require a broader repair than the requested minimal syntax change. No browser source edit is made.

The six unused API imports are split-suite context and group functions, used by the split wrapper in commit `1c835eaf`, but unused in the current HEAD, which instead contains an inlined management test body. This is evidence of incomplete merge reconciliation: the imports are not random unused names. Their imported modules export functions and are not invoked by the current file. Removing the six unused imports only affects presently unused bindings; the gap between split groups and the inlined test still requires a separate coverage reconciliation and is not claimed repaired.

Preservation baseline by textual count: browser 77 `test`/`t.test` calls, 4 describe calls and 934 `expect` calls; API 25 test calls and 273 `assert` method calls. These are textual counts, not discovered test totals. Browser original SHA-256 `94eb88f8a625e3bb121eba6486884ea372044ea00f36c0b22e9af14cc5d2ede1`; API original SHA-256 `8e553aa6f7f3894466534cbc1a83f565ec3b674f816acd6c68ab7bca74f37b78`. Browser final callback is not parseable, so semantic test inventory requires reconciliation rather than a fabricated AST count.

## Results and preservation

**PARTIALLY COMPLETE.** Removed precisely the six unused API import lines. A byte-content comparison after normalizing line endings confirms the current API file equals HEAD minus exactly those imports. Original declarations, titles, assertions, fixture setup, and role/permission scenarios are otherwise unchanged. Textual counts remain API 25 test calls and 273 assert calls; browser 77 test calls, 4 describe calls and 934 expect calls. No tests, skips, expected results, or fixtures were added or removed. Browser SHA-256 remains `94eb88f8a625e3bb121eba6486884ea372044ea00f36c0b22e9af14cc5d2ede1`; modified API SHA-256 is `12fe94cba176238b74b18671ce32db936675aee1a54d276f120aaadd371b8a8b`. The seven PG-017 report hashes match task entry.

## Verification commands

| Command                                                                                                                   | Exit | Outcome                                                                               |
| ------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------- |
| TypeScript `createSourceFile` parser for `apps/web/e2e/attendance.spec.ts`                                                | 1    | TS1005 at 7593:1, `}` expected.                                                       |
| `pnpm exec eslint apps/web/e2e/attendance.spec.ts apps/api/tests/features/attendance/management.test.ts --max-warnings 0` | 1    | Browser parsing error at 7593; no API lint errors.                                    |
| `pnpm exec eslint apps/api/tests/features/attendance/management.test.ts --max-warnings 0`                                 | 0    | API targeted lint passes.                                                             |
| `pnpm exec prettier --check apps/web/e2e/attendance.spec.ts apps/api/tests/features/attendance/management.test.ts`        | 1    | Browser parsing error at 7593.                                                        |
| `pnpm exec prettier --check apps/api/tests/features/attendance/management.test.ts`                                        | 0    | API formatting passes.                                                                |
| `pnpm format`                                                                                                             | 2    | Browser parsing error at 7593.                                                        |
| `pnpm lint`                                                                                                               | 1    | Browser parsing error at 7593; six API unused-import errors are gone.                 |
| `pnpm typecheck`                                                                                                          | 1    | Web TS1005 at 7593.                                                                   |
| `pnpm --filter @nexus/api typecheck`                                                                                      | 1    | TS2304: `Role` is missing in management.test.ts:34 after removal of six import lines. |
| `git diff --check`                                                                                                        | 0    | Passed.                                                                               |

The missing `Role` type was already referenced without an import at HEAD (formerly line 40), and was not introduced by removing the unused imports. It was masked by the earlier failing repository run. Correcting it is not one of the two authorized blockers and the instructions limit fixes for newly exposed independent errors; it remains documented. Browser discovery and focused runtime tests were not run because the required syntax and typecheck preconditions did not pass; no pass is inferred. No full Playwright suite was run.

## Historical findings and readiness

PG-004-D-001, PG-016-D-001, PG-006 and PG-011 intermittency, PG-008 and PG-012 PostgreSQL blockers, PG-015 44/45 and PG-016 17/18 classifications and all deferred contracts remain unchanged. No production code, permissions, schema, migration, fixtures or PG-017 design reports changed. The final worktree contains the six-line API import removal, this new report, the pre-existing seven untracked PG-017 reports and the modified ledger with a short maintenance note; nothing is staged.

PG-017 Phase 2.1 remains complete; Phase 2.2 is not authorized and repository execution is not ready. Resolve the incomplete browser test split/merge with a separately scoped, coverage-preserving reconciliation and address the pre-existing API missing type import before rerunning gates and discovery.

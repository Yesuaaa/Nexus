# PG-023 Execution Results

Continuation baseline: branch 293-test-full-system-audit-for-verifying-recent-changes at 59167cbc03ed10cd52de2a8404e62f4366b13dfb, empty index, inherited ledger, PG-023 documents, and T004/T037 tests.

| Selection                            | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Earlier Employee API and API unit    | 55/55 runner instances. T004 and T037 originally returned 404 because the fixture base already included /api. Removing the redundant prefix preserved the oracles.                                                                                                                                                                                                                                                                                                                                                          |
| Earlier retained Employee Playwright | 11/11 runner instances, one worker, zero retries.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Earlier web validation unit          | Four runner instances passed under Node in-process test isolation.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| New Playwright                       | pnpm --filter @nexus/web exec playwright test e2e/employees/pg023.spec.ts --workers=1 --retries=0. Exit 1. T001 passed. T010 ran all five widths and retained the failure at 1001 CSS pixels, where the row remained 188 px tall instead of 58 px.                                                                                                                                                                                                                                                                          |
| Real rewrite                         | pnpm --filter @nexus/web exec playwright test --config=playwright.pg023-integration.config.ts --output=test-results-pg023-integration. T033 passed, exit 0. Chromium sent list and detail GETs to Next on port 5285. Express on port 5286 recorded both GETs. The seeded Employee rendered and the User, Employee and history snapshots matched.                                                                                                                                                                            |
| Retained PostgreSQL                  | node scripts/run-tests.mjs tests/features/employees/deactivation-concurrency.postgres.ts. T031 passed, exit 0, with 18/18 runner instances. A local postgres:16 image supplied a fresh migrated loopback database after postgres:16-alpine was unavailable. The suite observed independent lock waiters and verified attendance, suspension and rollback.                                                                                                                                                                   |
| New PostgreSQL                       | node scripts/run-tests.mjs tests/features/employees/profile-attachment-concurrency.postgres.ts. First run exited 1 when the direct waiter check saw one backend and transactions exceeded the interactive timeout. The observer was corrected to follow the lock dependency chain. A fresh migrated PG16 database demonstrated two distinct blocked backends. The rerun exited 1: HTTP 201 and 500 against expected 201 and 409. The backend logged SQLSTATE 40001. The early assertion prevented final-state verification. |

Both PostgreSQL reruns used disposable containers with loopback-only port publication. Container removal exited 0 after each started run.

T009 first exited 1 at the Employees button locator after the Archive view
loaded. Scoping the button to the Employee view group preserved the click
and all assertions. The focused rerun with grep T009, one worker, and zero
retries exited 0. Format, lint, typecheck, and diff check exited 0 during
the continuation. The Next generated references were restored to their
continuation-entry contents.

## Browser continuation from 94eb190d

The first selection ran against the committed checkpoint plus the eleven new declarations:

```text
pnpm --filter @nexus/web exec playwright test e2e/employees/pg023.spec.ts --grep 'T007|T008|T011|T013|T014|T021|T023|T034|T035|T036|T038' --workers=1 --retries=0 --output=test-results/pg023-final
```

Exit 1. Six runner instances passed and five failed. T007 initially let the test clock advance during the timing assertion. T008 found the Department picker enabled after the API error. T014 looked for a Retry control labeled Try again. T021 looked for Edit Employee rather than Edit. T038 exposed the linked Employee ID validation message and the initial matcher expected different wording. The updated assertion checks the actual source-defined EXP-prefix guidance. The rerun retains the T008 disabled expectation and uses a soft assertion so independent recovery checks can execute.

All browser fixtures in this selection use synthetic employee and department data, a real Chromium page, mocked API responses and one worker with zero retries. The restricted permission scenario in T034 is a UI fixture. These cases do not provide persistence evidence.

The second focused command used the same browser and flags with grep
T007|T008|T011|T013|T014|T021|T034|T038 and output test-results/pg023-rerun.
Exit 1, six passed and two failed. T008 retained the enabled Department picker.
T021 reached the edit form but client name validation blocked submission
because the reused display name contained digits. The edit fixture now uses
Jordan Reyes and supplies both department and team option responses.

The third selection used grep T008|T014|T021|T034 and output
test-results/pg023-confirm. Exit 1, three passed and one failed. T014 passed
retry, rejected stale detail and restored focus to a surviving row. T021
passed edit, conflict and retry. T034 passed member deletion and directory
refresh plus the reduced-permission UI fixture. T008 still failed the enabled
Department picker assertion. Its subsequent recovery, disabled submit,
department change and team-scope assertions ran successfully.

The three browser launchers were scoped to the local Playwright fixture
and exited. The retained T031 and T032 PostgreSQL container cleanup is
recorded above. Failure traces remain under the ignored Playwright output
directories for review.

## Retained command selections

From apps/api, the focused selection was:

```text
node scripts/run-tests.mjs tests/features/employees/pg023-read.test.ts tests/features/employees/validation.test.ts tests/employee-integration.test.ts tests/features/employees/creation-attribution.test.ts tests/features/employees/update-attribution.test.ts tests/features/employees/account-lifecycle-attribution.test.ts
```

Exit 0, 55/55 instances after the test-path correction. The retained browser
selection used pnpm --filter @nexus/web exec playwright test e2e/employees
--workers=1 --retries=0 before the eleven continuation declarations. Exit 0,
11/11. The web unit selection ran from apps/web using node --test
--test-isolation=none test/employee-validation.test.mjs. Exit 0, 4/4.
These older runs were recorded at the original 59167cbc checkpoint with
Phase 2.2 working changes, before those changes were committed in 94eb190d.

The final focused detail selection used pnpm --filter @nexus/web exec
playwright test e2e/employees/pg023.spec.ts --grep T013 --workers=1
--retries=0 --output=test-results/pg023-t013. Exit 0, one passed. It
included the explicit team and start-date assertions.

## Continuation quality gates

The final test-source selection completed with pnpm format, pnpm lint,
pnpm typecheck and git diff --check each exiting 0. Earlier pnpm store-lock
denials and permitted reruns are retained in the historical implementation
checkpoint. Next type references were restored from the continuation-entry bytes.

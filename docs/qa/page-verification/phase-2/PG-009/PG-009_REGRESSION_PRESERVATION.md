# PG-009 Regression Preservation

## Preservation baseline

At Phase 2.2 task entry:

- Branch and HEAD were `293-test-full-system-audit-for-verifying-recent-changes` / `cccf2d5c788f551ba155010973dc32084ed4abf7`.
- No changes were staged.
- The only pre-existing tracked change was `docs/qa/page-verification/PHASE_2_PROGRESS_LEDGER.md` from PG-009 Phase 2.1.
- The untracked `docs/qa/page-verification/phase-2/PG-009/` directory contained the seven approved Phase 2.1 design reports.
- No application or test source change existed at entry. All seven design reports and the existing ledger work were preserved.

Baseline focused execution before adding PG-009 tests:

| Existing selection                                                                                                                                                                        | Baseline outcome                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm --filter @nexus/web exec node --experimental-strip-types --test test/attendance.test.mjs`                                                                                           | 9/9 passed.                                                                          |
| `pnpm --filter @nexus/api test -- tests/features/attendance/policy-management.test.ts tests/backend-regression.test.ts`                                                                   | 45/45 passed. Existing pg client-query deprecation warning only.                     |
| `pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts --grep "grouped attendance pages use live scoped data                                                               | grouped attendance routes enforce staff and department-head boundaries" --workers=1` | 4/4 passed at the 390/820/1440 widths plus route boundary. |
| `pnpm --filter @nexus/web exec playwright test e2e/async-resource.spec.ts e2e/attendance-policy-assignment.spec.ts --grep "attendance request failures show an error and recover on retry | canonical policy access and settings alias honor the access matrix" --workers=1`     | 2/2 passed.                                                |

These are historical entry-baseline results. Final runs are reported separately in the execution report and do not retroactively change prior page findings.

## Assertions retained

### Web unit and route policy

The existing `all attendance navigation pages preserve module ownership and role boundaries` declaration still contains its generic attendance path checks and PG-008 `/attendance/policies/management` role/permission assertions. PG-009 assertions were appended for the exact `/attendance/policies/overview` route; no prior path or expected result was replaced.

### API/PGlite and backend authorization

The existing `policy overview totals cover the inventory and remain configuration-only` nested declaration still asserts STAFF receives 403 and the manager receives a 200 summary matching the database. The new rows make the active/archive/canceled filters observable; the database equality assertion was updated only so the assignment aggregate compares to the source's `cancelledAt: null` filter. The test still independently asserts exact values 3/2/1/4.

The dynamic `/attendance/policies` anonymous and four-role matrix in `apps/api/tests/backend-regression.test.ts` was not edited. Its final execution remains part of the 45/45 combined API run. No duplicate A009 test was added.

### Browser routes and compatibility

The existing grouped live page test retains its route list, GET 200 check, heading, absence of Retry, four KPI terms, four-column layout, no-overflow check, screenshots, existing functional interactions, and STAFF/head boundary behavior. New PG-009 query, summary equality, links, timezone, and keyboard assertions are conditional on that route only. The existing Superadmin/Staff boundary declaration gained a separate Superadmin page; all existing STAFF denials, request pages, and department-head restrictions remain present.

The shared async-resource retry declaration and PG-008 canonical policy access declaration were run without modification. Both passed in the final compatibility selection.

## Incidental generated files

Playwright `webServer` builds and Next type generation may change `apps/web/next-env.d.ts` from its task-entry references under `.next/dev/types/` to `.next/types/`. This is generated build metadata, not part of PG-009. It is restored to the task-entry contents after the final quality gates. No generated test artifacts are part of the authorized change set.

## Earlier QA findings preserved

No PG-001 through PG-008 test, report, or defect status was changed by this work. In particular:

- PG-004-D-001 remains the confirmed shared keyboard row-action defect.
- PG-006 T018 remains its reproduction; PG-006 T024 remains intermittent at 820px; PG-006 T025/C001 and its timezone/profileless ADMIN limitations remain unchanged.
- PG-007's cleared-date and suspended-session UI contracts remain blocked.
- PG-008 remains implementation complete with verification partially complete; its shared-menu finding, PostgreSQL environment blocker, 390px cross-page fixture result, and C001 remain unchanged.
- PG-009 does not use the shared row-action menu. The 820px failure observed here occurred in the pre-existing Check-Ins portion of a cross-page test before its PG-009 route iteration; one separate rerun passed. It is retained as the already-known PG-006 T024 compatibility intermittency, not attributed to PG-009.

## Scope confirmation

Only the two existing web test files, one API test file, four new PG-009 execution reports, and the cumulative ledger are changed for this phase. The seven Phase 2.1 reports remain intact. No production source, test fixture source, schema, migration, or prior page test was modified. No regression assertion was removed or skipped to obtain a passing result. The full repository suite was not run.

# PG-003 Regression Preservation

## Preservation baseline

Before edits, the worktree contained the Phase 2.1 PG-003 design records and the modified Phase 2 ledger from the preceding authorized phase. HEAD was `9335f946dd09a9870a20222034488e82317ca58c`. Existing attendance and workspace tests were inspected before adding tests.

## Existing route tests retained and executed

| Existing test source                                       | Existing declaration/assertions preserved                                                                                                                                                                                                                                                                          | Outcome                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `apps/web/e2e/superadmin-attendance.spec.ts:14-15,557-561` | File continues to configure the isolated regression fixture and skip in live mode. The generated 1440px and 390px test cases remain. At lines 586-587, both navigate to `/attendance` and expect `/attendance/time-logs/overview`; the no-personal-read and no-write assertions at lines 680-686 remain unchanged. | Both viewport cases passed.                                       |
| `apps/web/e2e/superadmin-module-access.spec.ts:9-10,38-50` | Existing live-mode skip and module-selection loop remain. The Workforce Compliance case still goes to `/attendance` at line 116, expects the time-log destination at line 117, and checks no personal attendance reads at line 119.                                                                                | Existing Workforce Compliance case passed.                        |
| `apps/web/test/attendance.test.mjs:74-117,166-185`         | Existing attendance route-policy and navigation-page declarations and assertions remain intact. No test was renamed, removed, skipped, or weakened.                                                                                                                                                                | Both containing unit files passed with all original declarations. |

The two new unit declarations are appended at `apps/web/test/attendance.test.mjs:191,213`. The six new browser declarations are in `apps/web/e2e/attendance-entry.spec.ts:54,67,83,128,144,193`; no existing browser fixture was modified.

## Preservation checks

- Existing eligible Superadmin entry coverage was not recreated or replaced; T005 is still covered by the existing two files.
- Existing query/route expectations and role boundaries were unchanged. T009 is an additive history test based on the source's `router.replace` call.
- Unit tests import the actual `canAccessPersonalAttendance` and `canAccessRoute` helpers.
- New browser tests seed per-page sessions using existing regression helpers; they use no production credentials and skip when live mode is enabled.
- No application, API, schema, API test, or shared fixture source was modified.

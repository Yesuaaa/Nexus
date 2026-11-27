# PG-024 Regression Preservation

The two PG-024 files are new. Original declarations, assertion call sites, expected outcomes, parameter variants, configuration and shared hooks were not extended. No additive groups were implemented. The scoped T002 adapter covers an approved gap in the mapped retained test and adds no case.

| PG-024 reuse | Original evidence                                                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T002         | employee-integration.test.ts, nested Employee API role test. Retained assertion passed, with exact query, all roles and domain snapshots accounted through the separate scoped adapter. |
| T005         | PG-022 T009 Department GET and PG-023 T033 Employee list/detail GET, each on its own real Next/Express/PGlite harness. The Employee detail checks are retained compatibility evidence.  |
| T010         | PG-022-F011-A004-T007 privileged Department response, memberCount and before/after domain snapshots. Passed in the selected API run.                                                    |

No shared support or config changed. PG-023's 18 planned registrations and 31 PASS, 3 FAIL and 5 PARTIAL remain intact, along with its three deferrals, 17 hypothesis dispositions and distinct API, browser and PostgreSQL runner totals. T008, T010 and T032 remain findings. T032's persisted-state checks remain unreached. The cumulative ledger retains PG-020, PG-021, PG-022, Attendance Stage 3 and pending PG-001–018 assessment history.

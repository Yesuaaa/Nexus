# PG-005 Regression Preservation

**Page:** PG-005, `/attendance/audit`  
**Purpose:** Record additive changes and execution evidence for the Phase 2.1 preservation baseline.

## Existing declarations preserved

| Baseline ref | Preservation result                                                                                                                                   | Focused execution evidence                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| U1 / U2      | Kept existing declaration names, route lists, role fixtures, and navigation assertions. T002 is additive within U1.                                   | Unit command passed 29/29.                                     |
| B1           | Responsive live-fixture declaration retained at all three widths, including its existing pointer details flow.                                        | Final Playwright selection passed B1 at 390, 820, and 1440 px. |
| B2           | Existing page-2, debounced search, stale response, clear, empty, error, and retry assertions retained. T008 adds the gated first-load skeleton check. | Final Playwright selection passed B2 and T008.                 |
| B3           | Existing staff and department-head route boundary declaration retained.                                                                               | Final Playwright selection passed B3.                          |
| A1           | Existing search, paging, counts, projection, scope, and no-match assertions retained. T017 adds boundary/order/projection checks.                     | API/PGlite command passed as part of 20/20.                    |
| A2 / A3      | Existing department/organization scope and records-only/action-count behavior retained without weakening assertions.                                  | API/PGlite command passed as part of 20/20.                    |
| A4           | Existing Superadmin successful audit endpoint coverage retained.                                                                                      | API/PGlite command passed as part of 20/20.                    |
| X1           | Existing real transfer-to-audit browser/API/PGlite workflow retained; no mock replaced the integration.                                               | Final Playwright selection passed X1.                          |
| X2           | Existing persisted transfer attribution API coverage retained.                                                                                        | API/PGlite command passed as part of 20/20.                    |

The seven `EXISTING COVERAGE SUFFICIENT` case records T001, T004, T006, T007, T010, T014, and T018 remain represented by their original declarations/assertions. All were included in the focused execution commands above. No declaration was removed, renamed, skipped, or weakened to obtain a pass.

## New case boundaries

The six new browser cases use narrowly scoped department/audit route responses; authentication and the real page remain in the test flow. T015 and T016 use the isolated PGlite Express application. No case writes to a live database. T019/T020 remain out of the suite because their product expectations are still undefined.

## Carried-forward item

PG-004-D-001 remains open: at 390 px on `/attendance/adjustments`, ArrowDown marks a row-action trigger expanded while the accessible View details menu item is absent. This separate defect was not changed, retested, or reclassified as part of PG-005.

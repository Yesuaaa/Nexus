# PG-016 Test Implementation Report

## Entry baseline and implementation mapping

Branch `293-test-full-system-audit-for-verifying-recent-changes`, HEAD `81edb92d0e78f387eca6297430679c0b7628dfd3`. No intervening commits or staged files. Entry contains the modified ledger and seven untracked PG-016 design files, preserved in place. Current billing page, request-workflow services and protected-file sources match the discovery baseline.

| Cases                                                                | Intended declaration or assertion target                                                                                   |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| A001-T001                                                            | New source-policy unit declaration in apps/web/test/billing-logs.test.mjs                                                  |
| A004-T001, A010-T002                                                 | Two new API/PGlite declarations in apps/api/tests/pg016-billing.test.ts                                                    |
| A007-T001, A008-T002, A009-T002, A012-T001, A002-T002                | Five new mocked Chromium declarations in apps/web/e2e/billing/pg016-regression.spec.ts                                     |
| A011-T002                                                            | New real browser/Express/PGlite declaration in apps/web/e2e/billing/pg016-integration.spec.ts with an isolated API fixture |
| A003-T001                                                            | Add due ordering assertions to existing NEX-018 first browser declaration                                                  |
| A006-T002                                                            | Add conditional fields/line-item assertions to existing authorized booking browser declaration                             |
| A011-T001                                                            | Add protected bytes, headers and cross-client assertions to existing workflow private-file declaration                     |
| Existing A002-T001,A005-T001,A006-T001,A008-T001,A009-T001,A010-T001 | Preserve existing declarations and assertion oracles                                                                       |
| A008-T003                                                            | Deferred preview-error UX contract                                                                                         |

All IDs use prefix PG-016-F001-. Unit imports real route logic. API uses migrated PGlite, actual bearer middleware and Prisma. Mocked browsers render the actual page. Integration forwards billing and file HTTP to actual Express/PGlite, bypassing the Next rewrite. No production payment transaction or payment provider call is required.

Implementation results and exact final case outcomes are recorded in the execution report.

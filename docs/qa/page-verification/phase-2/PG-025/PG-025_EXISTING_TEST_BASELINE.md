# PG-025 Existing Test Baseline

`apps/web/e2e/help/page-21-regression.spec.ts` has twelve declarations. `configureRegressionTest` registers shared error checks; `openHelp` sets a viewport and restores synthetic USER. The role loop declares four independent registrations. The responsive loop uses one registration for four widths. No opt-in applies in the default mock selection.

| Original ID and behavior                           | Mapped case           | Original assertions and actions                                                                                                                                                                                                                         |
| -------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P21-WEB-001 — Portal shell and initial FAQ         | PG-025-F001-A001-T001 | USER; assert H1, both FAQ regions, searchbox, booking aside, both exact hrefs and footer visibility.                                                                                                                                                    |
| P21-WEB-002 — Local search normalization and reset | PG-025-F002-A001-T002 | USER; six buttons initially, padded uppercase QUOTATION gives the one named result, miss yields visible polite status, empty input restores six and removes status.                                                                                     |
| P21-WEB-003 — FAQ disclosure keyboard state        | PG-025-F003-A001-T003 | USER; both panel references exist; first expanded and exposed, Enter collapses first, Space expands/exposes second with first still collapsed. Preserve programmatic focus in this legacy check.                                                        |
| P21-WEB-004 — Messages navigation                  | PG-025-F004-A001-T004 | USER; focus actual Open messages anchor, press Enter and assert /messages. Treat destination network and record scope separately.                                                                                                                       |
| P21-WEB-005 — Support destination correctness      | PG-025-F005-A001-T005 | USER; inspect href against mailto address syntax and reject .test suffix. Retain historical fail P21-001. Never activate mailto.                                                                                                                        |
| P21-WEB-006 — Status FAQ completeness              | PG-025-F006-A001-T006 | USER; open status question, obtain controlled panel text, require every label from the current shared map including repeated labels per legacy loop. Retain P21-002. Report independent missing labels for diagnosis without changing legacy assertion. |
| P21-WEB-007 — Portal admission                     | PG-025-F007-A001-T007 | STAFF; direct /help redirects to /module and Help footer count is zero.                                                                                                                                                                                 |
| P21-WEB-008 — Portal admission                     | PG-025-F007-A001-T008 | STAFF with synthetic headOf; same direct redirect and absent footer. Head is a relationship, not a role.                                                                                                                                                |
| P21-WEB-009 — Portal admission                     | PG-025-F007-A001-T009 | ADMIN; direct /help redirects to /module and Help footer count is zero.                                                                                                                                                                                 |
| P21-WEB-010 — Portal admission                     | PG-025-F007-A001-T010 | SUPERADMIN; direct /help redirects to /module and Help footer count is zero.                                                                                                                                                                            |
| P21-WEB-011 — Portal admission                     | PG-025-F007-A001-T011 | Anonymous with clean browser context; direct /help settles on /login.                                                                                                                                                                                   |
| P21-WEB-012 — Responsive containment               | PG-025-F008-A001-T012 | USER; widths 1440, 1280, 768 and 390; each asserts visible H1 and searchbox and document scrollWidth <= innerWidth. Keep mobile screenshot action and historical artifact caveat.                                                                       |

Preserve all original titles, role variants, conditions, helpers and assertions, including focus calls and mobile screenshot. T006 loops over all current status-map entries including duplicate alias labels; do not reduce it to the number of distinct labels. Route-policy.test.mjs lines 92, 167 and 178 include Help in shared policy assertions. Navigation and session specs cover shared behaviors, with no identical Help lifecycle case. No dedicated Help unit, backend, rewrite or PostgreSQL declaration was located. The retained Messages case uses actual navigation with mocked API traffic.

Phase 7 Page 21 report lines 191–222 records a production-like Playwright run, one worker, 10 passing and two failing. P21-WEB-005 failed on the reserved .test suffix; P21-WEB-006 failed on missing status labels. The retained screenshots were lost and subsequent startup timeout/pending auth did not replace them. Exact historical revision is not established here. The current design runs no tests.

## Original declaration titles

- [P21-WEB-001] USER can read Help and reach the booking support links
- [P21-WEB-002] Help search trims and folds case, announces no results, and restores questions when cleared
- [P21-WEB-003] FAQ disclosures expose state and support Enter and Space
- [P21-WEB-004] the booking support call to action opens Messages by keyboard
- [P21-WEB-005] the support email destination is not a reserved test address
- [P21-WEB-006] the request status answer explains every status shown in Booked Requests
- [P21-WEB-007] STAFF is routed away from USER Help
- [P21-WEB-008] department-head STAFF is routed away from USER Help
- [P21-WEB-009] ADMIN is routed away from USER Help
- [P21-WEB-010] SUPERADMIN is routed away from USER Help
- [P21-WEB-011] unauthenticated Help access returns to the client login
- [P21-WEB-012] Help stays readable without horizontal overflow at desktop, tablet, and mobile widths

# PG-023 Regression Preservation

The previous implementation is committed at continuation entry 94eb190deea91197e53bc94c9ade149d8487d687. This continuation appends browser declarations to pg023.spec.ts. Existing declarations, widths, hooks and shared helpers retain their assertions. T012 and T025 each retain 1440 and 390 CSS pixels as separately registered instances. T010 retains five viewport iterations within one declaration.

| Approved case         | Selected declaration source                                                                                                         | Recorded selection        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| PG-023-F002-A001-T002 | API/PGlite / EXISTING / employee-integration.test.ts:633; creation-attribution.test.ts                                              | 55/55 API and API unit    |
| PG-023-F003-A001-T003 | API/PGlite / EXISTING / employee-integration.test.ts:1303                                                                           | 55/55 API and API unit    |
| PG-023-F004-A002-T005 | API/PGlite / EXISTING / employee-integration.test.ts:739, :1471                                                                     | 55/55 API and API unit    |
| PG-023-F004-A003-T006 | Browser / EXISTING / employee-directory.spec.ts:7                                                                                   | 11/11 retained Playwright |
| PG-023-F009-A002-T012 | Browser / EXISTING / employees.spec.ts:206                                                                                          | 11/11 retained Playwright |
| PG-023-F011-A001-T015 | Unit / EXISTING / employee-validation.test.mjs:22-109                                                                               | 4/4 web unit              |
| PG-023-F011-A002-T016 | Unit / EXISTING / features/employees/validation.test.ts:5-140                                                                       | 55/55 API and API unit    |
| PG-023-F011-A003-T017 | Browser / EXISTING / employee-form.spec.ts:36-140                                                                                   | 11/11 retained Playwright |
| PG-023-F012-A001-T018 | API/PGlite / EXISTING / creation-attribution.test.ts:138, :485                                                                      | 55/55 API and API unit    |
| PG-023-F013-A001-T019 | API/PGlite / EXISTING / creation-attribution.test.ts:217, :359                                                                      | 55/55 API and API unit    |
| PG-023-F014-A001-T020 | API/PGlite / EXISTING / update-attribution.test.ts:166, :600, :676, :741                                                            | 55/55 API and API unit    |
| PG-023-F015-A001-T022 | API/PGlite / EXISTING / employee-integration.test.ts:797, :870, :1042; update-attribution.test.ts                                   | 55/55 API and API unit    |
| PG-023-F016-A002-T024 | API/PGlite / EXISTING / account-lifecycle-attribution.test.ts:136                                                                   | 55/55 API and API unit    |
| PG-023-F017-A001-T025 | Browser / EXISTING / employee-login.spec.ts:4                                                                                       | 11/11 retained Playwright |
| PG-023-F017-A002-T026 | API/PGlite / EXISTING / account-lifecycle-attribution.test.ts:242, :488                                                             | 55/55 API and API unit    |
| PG-023-F018-A001-T027 | API/PGlite / EXISTING / account-lifecycle-attribution.test.ts:242                                                                   | 55/55 API and API unit    |
| PG-023-F019-A001-T028 | API/PGlite / EXISTING / account-lifecycle-attribution.test.ts:395                                                                   | 55/55 API and API unit    |
| PG-023-F020-A001-T029 | API/PGlite / EXISTING / creation-attribution.test.ts:485; update-attribution.test.ts:676; account-lifecycle-attribution.test.ts:615 | 55/55 API and API unit    |
| PG-023-F020-A002-T030 | API/PGlite / EXISTING / creation-attribution.test.ts:568; update-attribution.test.ts:600; account-lifecycle-attribution.test.ts:713 | 55/55 API and API unit    |
| PG-023-F023-A001-T031 | PostgreSQL / EXISTING / deactivation-concurrency.postgres.ts:13-590                                                                 | 18/18 PostgreSQL          |
| PG-023-F006-A003-T042 | Browser / EXISTING / employees.spec.ts:120                                                                                          | 11/11 retained Playwright |

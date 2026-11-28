# PG-026 Atomic Feature Inventory

Each atomic ID identifies an independent assertion boundary, with its actor and prerequisites specified in the case manifest. No role inheritance beyond the explicit portal predicate is assumed.

| Atomic ID        | Behavior                                             | Primary layer | Category tags                                             | Questions | Case                  |
| ---------------- | ---------------------------------------------------- | ------------- | --------------------------------------------------------- | --------- | --------------------- |
| PG-026-F001-A001 | Public workforce form and role landing               | Browser       | Functional                                                | Q6        | PG-026-F001-A001-T001 |
| PG-026-F002-A001 | Token placement and logout UI                        | Browser       | Security, Recovery                                        | Q3/Q5     | PG-026-F002-A001-T002 |
| PG-026-F003-A001 | Portal decision helper                               | Unit          | Functional, Security                                      | Q2/Q6     | PG-026-F003-A001-T003 |
| PG-026-F004-A001 | Credential form validation and submission lock       | Browser       | Negative, Edge-case, Concurrency, Recovery, Accessibility | Q1/Q4/Q5  | PG-026-F004-A001-T004 |
| PG-026-F005-A001 | Password visibility and language                     | Browser       | Functional, Accessibility                                 | Q3/Q5     | PG-026-F005-A001-T005 |
| PG-026-F006-A001 | Workforce responsive form                            | Browser       | Edge-case, Accessibility                                  | Q5        | PG-026-F006-A001-T006 |
| PG-026-F007-A001 | Wrong-portal cleanup success                         | Unit          | Security, Abuse-case, Data-integrity                      | Q2/Q5/Q6  | PG-026-F007-A001-T007 |
| PG-026-F008-A001 | Wrong-portal logout unavailable                      | Browser       | Security, Recovery, Data-integrity                        | Q2/Q4/Q5  | PG-026-F008-A001-T008 |
| PG-026-F009-A001 | Existing account check and retry                     | Browser       | Recovery, Negative, Concurrency                           | Q5/Q6     | PG-026-F009-A001-T009 |
| PG-026-F010-A001 | Malformed login response                             | Unit          | Negative, Edge-case, Data-integrity                       | Q3/Q4/Q5  | PG-026-F010-A001-T010 |
| PG-026-F011-A001 | Obsolete auth response protection                    | Unit          | Concurrency, Security, Data-integrity                     | Q4/Q5     | PG-026-F011-A001-T011 |
| PG-026-F012-A001 | Credential input boundaries                          | API/PGlite    | Negative, Edge-case, Data-integrity                       | Q2/Q4     | PG-026-F012-A001-T012 |
| PG-026-F013-A001 | Account denial and persisted attribution             | API/PGlite    | Negative, Security, Data-integrity                        | Q2/Q3/Q4  | PG-026-F013-A001-T013 |
| PG-026-F014-A001 | Local limiter boundaries                             | API/PGlite    | Abuse-case, Negative, Data-integrity                      | Q1/Q2/Q4  | PG-026-F014-A001-T014 |
| PG-026-F015-A001 | Refresh, invalidation and replay boundary            | API/PGlite    | Concurrency, Recovery, Security                           | Q3/Q4/Q5  | PG-026-F015-A001-T015 |
| PG-026-F016-A001 | Real workforce sign-in transport                     | Integration   | Integration, Functional, Data-integrity                   | Q2/Q3/Q6  | PG-026-F016-A001-T016 |
| PG-026-F017-A001 | Independent refresh transaction overlap              | PostgreSQL    | Concurrency, Data-integrity                               | Q4/Q5     | PG-026-F017-A001-T017 |
| PG-026-F018-A001 | Authoritative portal and wrong-portal cleanup policy | Deferred      | Security, Recovery                                        | Q2/Q5/Q6  | PG-026-F018-A001-T018 |
| PG-026-F019-A001 | Preexisting client session on workforce URL          | Deferred      | Functional, Security                                      | Q2/Q6     | PG-026-F019-A001-T019 |

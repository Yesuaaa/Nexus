# PG-027 Atomic Feature Inventory

| Atomic ID        | Boundary                                                | Case                  | Categories                                                                  | Misuse                    |
| ---------------- | ------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------- | ------------------------- |
| PG-027-F001-A001 | Public client form                                      | PG-027-F001-A001-T001 | Functional, Accessibility                                                   | Q5 (control reachability) |
| PG-027-F002-A001 | Credential validation, pending and duplicate submission | PG-027-F002-A001-T002 | Negative, Edge-case, Abuse-case, Data-integrity, Concurrency, Accessibility | Q1, Q4                    |
| PG-027-F003-A001 | Language choice                                         | PG-027-F003-A001-T003 | Accessibility                                                               | Q5 (control reachability) |
| PG-027-F004-A001 | Default landing and credential transport                | PG-027-F004-A001-T004 | Functional, Security                                                        | Q2, Q3, Q6                |
| PG-027-F005-A001 | Service context validation                              | PG-027-F005-A001-T005 | Edge-case, Security, Abuse-case                                             | Q2                        |
| PG-027-F006-A001 | Service context after submit                            | PG-027-F006-A001-T006 | Functional, Abuse-case, Data-integrity, Integration                         | Q1, Q4, Q6                |
| PG-027-F007-A001 | Service context with existing session                   | PG-027-F007-A001-T007 | Functional, Concurrency, Integration                                        | Q5, Q6                    |
| PG-027-F008-A001 | Client wrong-role handling                              | PG-027-F008-A001-T008 | Negative, Security, Abuse-case                                              | Q1, Q2, Q3, Q5, Q6        |
| PG-027-F009-A001 | Credential transport recovery                           | PG-027-F009-A001-T009 | Recovery                                                                    | Q5                        |
| PG-027-F010-A001 | Malformed successful response UI                        | PG-027-F010-A001-T010 | Negative, Edge-case, Security, Data-integrity                               | Q3                        |
| PG-027-F011-A001 | Existing session lookup retry                           | PG-027-F011-A001-T011 | Recovery                                                                    | Q5                        |
| PG-027-F012-A001 | Expired account check                                   | PG-027-F012-A001-T012 | Negative, Recovery                                                          | Q5                        |
| PG-027-F013-A001 | Credential validation and protected ownership           | PG-027-F013-A001-T013 | Negative, Security, Abuse-case, Data-integrity                              | Q1, Q2, Q3, Q4            |
| PG-027-F014-A001 | Input/transport bounds                                  | PG-027-F014-A001-T014 | Negative, Edge-case, Data-integrity                                         | Q5 (control reachability) |
| PG-027-F015-A001 | Token response ordering                                 | PG-027-F015-A001-T015 | Security, Data-integrity, Concurrency                                       | Q4, Q5                    |
| PG-027-F016-A001 | Refresh and replay lifecycle                            | PG-027-F016-A001-T016 | Security, Abuse-case, Data-integrity, Concurrency, Recovery                 | Q4, Q5                    |
| PG-027-F017-A001 | Client split layout and keyboard access                 | PG-027-F017-A001-T017 | Edge-case, Accessibility                                                    | Q5 (control reachability) |
| PG-027-F018-A001 | Real client inquiry login handoff                       | PG-027-F018-A001-T018 | Data-integrity, Integration                                                 | Q4, Q6                    |
| PG-027-F019-A001 | Recovery link destination                               | PG-027-F019-A001-T019 | Recovery, Accessibility                                                     | Q5                        |
| PG-027-F020-A001 | Server portal policy and remote compensation            | PG-027-F020-A001-T020 | Security, Abuse-case, Recovery                                              | Q2, Q5                    |
| PG-027-F021-A001 | Existing session on client entry                        | PG-027-F021-A001-T021 | Functional, Security                                                        | Q6                        |

Actors and triggers resolve to the case specification. The inventory separates public form, synthetic eligible and denied sign-in, existing sessions, local controls, and actual credential and lifecycle persistence. No separate attack inventory is counted.

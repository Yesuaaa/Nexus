# PG-014 Edge Case Matrix

Case IDs below omit the common PG-014-F001 prefix. See the [test specification](PG-014_TEST_CASE_SPECIFICATION.md) for steps, fixtures and oracles.

| Condition                                                     | Source-defined behavior and verification                                                                                                                          |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No session, invalid session, inactive or deleted account      | API rejects before management reads. Portal checks account before mounting. A001-T001, A013-T001.                                                                 |
| Plain STAFF, USER, missing privileged entitlement             | Keep synthetic UI role/permission checks independent of backend role grants. A001-T002, A013-T001/T002.                                                           |
| Current Head, foreign/unknown department, profileless manager | Head scope wins, foreign IDs receive 403. Privileged missing ID yields 404 and linked employee is unnecessary. A014-T002, A015-T002.                              |
| Blank or malformed values and repeated keys                   | Blank department equals permitted scope. Blank explicit date and repeated filters fail validation at API; omitted dates get defaults. A005-T002, A015-T001.       |
| UTC midnight and inclusive day range                          | Clock-derived UTC defaults; range endpoints match stored work dates. Verify one day, leap day, reversed, max 366 and one beyond. A003-T001/T002, A015-T001.       |
| Cleared field and rapid reversals                             | No request with either empty date; stale responses are discarded; current screen output upon clear needs a contract. A004-T002/T003, A011-T001.                   |
| Same filter choice, no choices, or escaped popup              | React state keys drive reads; Escape commits no choice; All remains meaningful with no departments. A012-T001/T002, A014-T002.                                    |
| Zero/one/many rows                                            | Zero status rows with empty message, one suspended with 100% share, mixed categories rounded independently, 10,000 merged records cap. A007-T001/T002, A018-T001. |
| No check-ins with approved leave or sessionless recorded day  | Coverage may be positive and status empty, ratio dash. A008-T001, A017-T001.                                                                                      |
| Paid/unpaid, suspended, split and overnight sessions          | Only open unpaid breaks move working to on-break; unfinished suspended excluded from open; classify by stored work date. A006-T001, A016-T001/T002.               |
| Pending, reversed, zero-minute, overlapping and foreign leave | Only positive current approved dates in scope count; shared employee/date stays a single reporting row. A017-T001.                                                |
| Single or double source failure, network interruption         | Retain successful sibling and retry failed source. Use genuine 200 siblings and synthetic 503 separately from network abort. A009-T001/T002, A010-T001/T002/T003. |
| Out-of-order, teardown and auth refresh                       | Latest resource key governs, abort obsolete request, expired bearer follows managed refresh/session policy. A011-T001/T002.                                       |
| Transfer or headship loss between reads, reconciliation       | Fresh summary follows committed data. A019-T001/T002. Additional in-flight policy is deferred under A019-T003.                                                    |
| Keyboard and small viewport                                   | Focus, dialog/select escape, external navigation and alert Retry with scoped locators. A002-T002, A012-T001/T002.                                                 |
| Unsupported interactions                                      | Bulk/edit/save, duplicate submission, writes, sort, pagination, upload/download and records export belong outside this page.                                      |

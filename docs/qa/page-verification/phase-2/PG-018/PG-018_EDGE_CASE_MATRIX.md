# PG-018 Edge Case Matrix

| Category             | Deterministic edge / expected contract                                                                              | Case mapping                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Initialization       | USER array versus internal envelope, reversed timestamps and pending response                                       | A002-T001                                                 |
| Error/recovery       | Initial failure clears events; retry preserves day; background failure also clears (unlike paginated-list pages)    | A003-T001, A004-T001                                      |
| Async                | Old scope/month response released after later response; unmount/revisit; in-flight focus suppression                | A004-T002                                                 |
| Calendar/date        | Year crossing, leap month clamp, arrows/week boundaries, Today, Manila midnight, all-day business dates             | A005-T001, A006-T001/T002, A007-T001, A017-T001/T002/T003 |
| Density              | Zero events, dense day >3 markers, title wrapping, milestone-first agenda and mobile dots                           | A007-T002                                                 |
| Upcoming             | First three only; exclude selected date/milestone/completed, end=now inclusive for upcoming but exclusive for Join  | A008-T001, A009-T002                                      |
| External link        | HTTPS only, no credentials; missing endsAt/location cannot Join; new-tab isolation                                  | A009-T001/T002                                            |
| Local filters        | Project IDs deduplicated and sorted; department/staff/type AND; filter action does not create backend query filters | A012-T001, A013-T001, A014-T001                           |
| Reset                | Scope resets project/staff/department but retains type; Clear resets four local filters only                        | A011-T002, A015-T001                                      |
| Metrics              | Count filtered events; conflicts computed against allEvents, completed/deadline precedence                          | A016-T001, A017-T001, A018-T001                           |
| Leave conflicts      | Business timezone, shared assignee, unfinished work, half-open midnight boundaries                                  | A018-T002                                                 |
| Client privacy       | Spoofed clientId/scope ignored, no tasks/leave; shared milestone belongs to client/startDate project                | A019-T001/T002/T003                                       |
| Internal scope       | Current head/project/team leadership and assignments, org metadata without automatic private URLs                   | A020-T001/T002/T003                                       |
| Leave privacy/window | Pending and zero-minute days excluded; month spillovers and team/own/org scope, no reason/type                      | A021-T001                                                 |
| Query validation     | Invalid/repeated month/scope and valid defaults; USER branch has no calendar query contract                         | A022-T001                                                 |
| Contract             | Whether KPI labels represent visible month versus all fetched/filtered records                                      | A016-T002 deferred                                        |

No creation/editing/deletion, file upload/download, row-action menu, proof modal, form validation, payment, event pagination or scheduling transaction exists on PG-018. These are NOT APPLICABLE and are outside the case count. Calendar model helpers receive valid event contracts; malformed server event fallback behavior is not invented.

The same Calendar primitive supports min/max and week modes elsewhere; PG-018 uses month without bounds, so consumer-only min/max/week rules are not expanded into page cases. Shared keyboard row-action defect PG-004-D-001 is not attributed to this native grid. Billing proof Dialog PG-016-D-001 is not used. New page-specific runtime defects, if found later, need new evidence rather than inherited attribution.

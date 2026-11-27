# PG-022 Gaps and Dependencies

## Coverage status

Phase 1 marks PG-022 coverage PARTIAL: no page-specific unit declaration was identified; shared department and management tests indirectly cover API/route behavior, but overview UI is not separated. Static review confirms no PG-022-specific declaration.

Existing assertions cover route policy, direct Superadmin visibility of the Manage departments link, API authorization/projection, read-only GET behavior and the shared Next rewrite path. They do not check computed figures, sort/fallback cells, employee-share bars, gap groups, date preferences, responsive columns, accessible values, loading/error recovery or page request lifecycle. ADMIN/SUPERADMIN list assertions check selected values, not the full list allowlist or every count; T007 is NEW TEST REQUIRED for that gap.

No source defect or security vulnerability was confirmed by this static review. PG-021 failures do not block PG-022 discovery or its later authorized cycle.

## Product/API decisions

| ID          | Competing interpretations and evidence                                                                                                                                                                                                                                                                                                                  | Affected case | Decision needed                                                                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PG-022-C001 | The typed client has no runtime response validation. A missing `departments` property becomes undefined and `useDepartments` substitutes an empty list; a non-array value passes through as `Department[]` and reaches page `.reduce`/`.map` operations without a recoverable error state. Neither behavior is an approved malformed-response contract. | T026          | Define one safe, explicit malformed-success outcome (including both missing and wrong-type fields), separate from a valid empty list. This source discrepancy is a robustness gap, not a confirmed product defect. |
| PG-022-C002 | Department list uses findMany without pagination/cap; overview renders every row. Phase 1 describes every department, but no maximum count, response-size budget or performance target is recorded.                                                                                                                                                     | T027          | Define supported cardinality and whether all rows, pagination or a cap is required. Then define a bounded synthetic test; no uncontrolled load.                                                                    |

These are CONTRACT BLOCKED, not environment failures. No browser/API environment was set up or found unavailable. Affected cases remain in the unique inventory.

## Authorization, privacy and persistence

Page route is ADMIN/SUPERADMIN plus departments:read. API GET is independently requireAuth plus departments:read: STAFF/Head may read a narrow cross-department projection although page route denies them; USER and anonymous are denied. ADMIN/SUPERADMIN list projection includes counts and Head email.

The page is read-only. It has no mutation endpoint, body, ownership selector or client-side department filter. No PostgreSQL concurrency, rollback, audit-attribution, duplicate-write or relationship-conflict case is justified. The list is unpaginated; scale expectation remains C002.

## Historical findings and boundaries

PG-021 is Department Management at /departments. Its implementation cycle is complete and focused verification remains partial at 26/30: A005 reproduces PG-004-D-001; A015, A017 and A019 remain failed and are classified in PG-021 final verification as PG-021-D-001, D-002 and D-003 respectively. PG-021-C001 remains deferred. Nine abuse hypotheses have verified controls and two are partial within their evidence boundaries. Sequential mocked team removal does not establish real partial database commits or resolve C001. See PG-021 final verification, execution results and adversarial assessment.

Earlier defects, intermittency, environment/build blockers and deferred contracts remain in the cumulative ledger. PG-004-D-001 is not exposed by this page because it renders no DepartmentRowActions trigger. PG-016-D-001 and unrelated attendance, calendar, billing, PostgreSQL and build findings were not reopened. PG-020’s 29/29 checkpoint and bounded asynchronous evidence remain as recorded. Stage 3 Attendance hooks/declarations remain preserved. PG-001–PG-018 standalone adversarial backfill remains pending.

## Execution dependencies

- T007 needs current schema/migrations in disposable PGlite and synthetic relations; the harness provides cleanup.
- Browser cases need the existing Chromium installation and isolated Next app. Mocked API behavior is not server authorization evidence.
- T009 reuses historical rewrite evidence; no new integration process is needed.
- T026/T027 need product decisions, not infrastructure.
- No external notification, production/customer data, live database, migration command, security probe or uncontrolled performance run is needed.

No tests, remediation, later-page work or security verification are authorized by this Phase 2.1 package.

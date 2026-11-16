# Department GET integrity and read-only enforcement (Phase 4B.2)

Developed: 2026-11-15

## Root cause and read-path audit

This phase resolves [Phase 4A finding A02](superadmin-comprehensive-authorization-audit.md#a02--department-get-can-perform-hr-writes-with-read-permission), preserving [Phase 4B.1 department data access security](department-data-access-security.md) and the current uncommitted implementations.

The department detail service called `getDepartmentDetailsWithCleanup` for an ordinary GET. Before selecting the response, that repository method scanned Users for stale Head titles, cleared a current Head's team assignment, and invoked `syncEmployeeForUser`. Synchronization could update linked Employee position/department/team fields, normalize inconsistent User assignments, or provision a missing Employee. This made a read an implicit repair transaction and could change timestamps, row counts and HR relationships.

The other department reads—directory summaries, administrative lists/counts, eligible Heads and assignment candidates—already used only queries. Employee status-option reads and nested team/member retrieval were also reviewed. No repair was moved into another GET. Authentication may continue its existing Session activity bookkeeping; department reads do not write persistent HR data.

The replacement `getDepartmentDetails` performs only a query through the existing `readTransaction` utility. Department/member/team relations share a repeatable-read snapshot. The existing DTO and Phase 4B.1 permission guards remain unchanged; persisted legacy values are returned accurately rather than silently repaired or cosmetically masked.

## Where invariants are enforced

| Invariant or previous cleanup                                               | Authorized write path and resulting behavior                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A former Head must not retain a Head-like job title                         | Explicit Department update changing/removing `headId` clears titles for the displaced current Head and any original Head whose temporary reservation was ended. Existing synchronization remains inside that transaction.                                                               |
| The on-leave original Head retains their unchanged reserved title           | Existing Employee status handoff retains `temporaryHeadOriginalId`; title correction checks current Head and reserved-original relationships before clearing anything.                                                                                                                  |
| Restoring the original Head displaces the temporary Head                    | Existing Employee status restoration now clears the displaced deputy's Head title on both User and linked Employee before committing.                                                                                                                                                   |
| A temporary Head also takes leave                                           | Existing replacement selection, eligibility checks and handoff remain. The displaced temporary Head loses a Head-like title; the original Head's reservation remains. The returned Employee response reflects the corrected persisted title.                                            |
| A Head cannot belong to a sub-team                                          | Existing department create/explicit Head save clears User `teamId` and synchronizes Employee. Existing temporary-head handoff clears both records. Employee/member/team writes continue rejecting invalid Head team membership, and original restoration still rejects an invalid team. |
| User and Employee position/assignments remain synchronized                  | Existing management writers retain `writeEmployee` and `syncEmployeeForUser`. The new narrowly scoped title helper updates only the displaced title and never creates HR records. No synchronization is invoked by department GET.                                                      |
| Arbitrary legacy stale titles, missing profiles or inconsistent assignments | Reads leave them unchanged. Existing authorized Employee edits can set a valid non-Head position; an explicit Head save can correct that Head's team/synchronization. No bulk backfill, new repair endpoint or background normalization is introduced.                                  |

`clearFormerDepartmentHeadTitle` is a small helper in the existing Employee service, called only after the leadership relationship has changed in an authorized Department or Employee transaction. It uses the existing Employee/User row-lock utilities and checks current persisted Head/reserved-original relationships. It leaves ordinary job titles and valid reserved titles intact, updates linked Employee position with User position, and does not enroll Staff, create identities or repair unrelated employees.

Existing department locks, candidate validation, status-transition checks, temporary-head tracking, team-lead eligibility and protected assignment rules are retained. No permission map, controller guard, Employee eligibility, Attendance workflow or organization access scope was broadened.

## Files changed in this phase

- `apps/api/src/features/departments/departments.repository.ts`: removes cleanup from detail retrieval, reuses snapshot reads, and handles displaced/reserved former Heads in explicit Head changes.
- `apps/api/src/features/departments/departments.service.ts`: calls the observational detail method.
- `apps/api/src/features/employees/employees.service.ts`: adds the scoped displaced-title helper and invokes it during existing temporary handoff/restoration writes.
- `apps/api/tests/features/departments/read-integrity.test.ts`: new offline Express/PGlite read-only, leadership, rollback and concurrent-request tests.
- `apps/api/tests/department-integrity.test.ts`, `apps/api/tests/features/departments/leadership.test.ts`: replace old GET-cleanup expectations with unchanged stored data and explicit authorized correction assertions.
- This report, the Phase 4B.1 follow-up note, `docs/features/README.md` and `docs/rbac.md`: current behavior and phase boundary.

Phase 4B.1 controller protections, the shared module registry/Docker fix, frontend components and other pre-existing uncommitted work are preserved. No schema change, new repair operation or new UI was needed.

## Validation

The new tests ran before production changes. Stored-row snapshots and database write-rejection triggers demonstrated the GET side effects; tests also exposed displaced titles left behind by restoration/manual/nested handoff and missing rollback on an unattempted title correction. The first executable run failed 7 of 8 counted tests (including the parent); the concurrent-request case already passed. After implementation, the expanded focused department run passed all 29 tests across the new suite, Phase 4B.1 access tests, department integrity and leadership policy.

Focused coverage includes:

- Repeated Admin/Superadmin list/detail/candidate GETs with stale Head titles, invalid Head team membership and a missing Employee. All User, Employee, Department and Team rows—including timestamps and counts—remain identical.
- Database triggers that reject every INSERT/UPDATE/DELETE on HR tables while valid GETs still return 200; missing details return 404 and unauthorized Staff details remain 403.
- Permanent replacement/removal, original restoration and nested temporary handoff correct only displaced titles within the responsible write transaction.
- Explicit Head saves synchronize User/Employee teams; invalid Head team assignments remain rejected.
- Injected failures during deputy-title clearing and new Head Employee synchronization roll back the complete HR transaction.
- Concurrent HTTP reads and two Head replacements finish with valid Head/User/Employee assignments; subsequent reads remain observational.

The PGlite harness uses its existing single-connection pool. Concurrent HTTP requests validate queued transaction behavior and final integrity, not multi-connection production deadlock/load behavior. That broader stress test is not claimed.

| Check                                    | Result                                                              |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `pnpm format` and final formatting check | PASS, exit 0                                                        |
| `pnpm lint`                              | PASS, exit 0, zero warnings                                         |
| `pnpm typecheck`                         | PASS, exit 0; API/web and test types                                |
| `pnpm build`                             | PASS, exit 0; API and production standalone web                     |
| `pnpm test:api`                          | PASS, exit 0; all 303 backend tests passed, none skipped/cancelled  |
| `pnpm test:web`                          | PASS, exit 0; all 107 web unit tests passed, none skipped/cancelled |
| Selected Chromium regressions            | PASS, exit 0; all 52 passed, none skipped                           |
| `git diff --check`                       | PASS                                                                |

The full API run includes existing Employee integration, leadership, account, Attendance, project, workflow and messaging regressions alongside Phase 4B.1 and the new read-integrity coverage. Browser cases cover Department/team management, Employee forms/login controls, scoped Head workload, Request Inbox, Superadmin HR/module entry and module navigation against the production web build. There were no new failures in these executed suites, and no required test was blocked.

The pre-existing 33 full-browser failures documented in Phase 4A remain a separate maintenance backlog. In particular, the obsolete `/dashboard` expectation in `booked-services.spec.ts` reproduced in Phase 4B.1 is outside this phase's selected suites; it was not changed or claimed fixed. The complete 443-case browser suite and live-account tests were not rerun. These browser regressions use mocked API contracts; direct backend enforcement was tested independently through real Express/PGlite. No live database verification is claimed.

Injected rollback failures intentionally produce API 500/error logs while the tests verify complete rollback. Existing `pg` concurrent-query deprecation warnings remain non-failing. The recovered compiler/native Node test launcher executed successfully; no raw `tsx` startup test or unrelated tooling change was required.

Source/test hash comparison against the start of this phase found changes only in the three production files and two existing test files listed above, plus the new test. Other existing uncommitted source/tests, including Phase 4B.1 guards and the shared-registry Docker fix, were preserved. Logs are under ignored `.ci-tools/phase4b2-{red,focused,departments,format,lint,typecheck,build,api,web-unit,browser}.log`; browser artifacts and the baseline snapshot use the same prefix.

## Deferred risks and phase boundary

Historical inconsistencies are no longer automatically repaired merely by being viewed. They remain visible to authorized HR readers until explicitly corrected through existing management operations. A bulk inventory/backfill or repair mechanism for orphaned/inconsistent records requires separate scope and design; none is added here.

Existing request-history deletion constraints, workforce/leadership eligibility, login identity separation and Staff data restrictions remain. No change is made to Client-create permission separation, general mutation provenance, unrelated Attendance behavior, private records, Diagnostics or System Logs. Stop at Phase 4B.2.

# PG-021 final verification

Department Management at `/departments`, branch `development`, HEAD `bf824f218e3b45a39b1ec68d2ba561abe7cf7052`. All 19 approved declarations and the single additive group are implemented. All ten retained cases were exercised. Verification is partial at 26 PASS and four FAIL among 30 implementable cases. There are no unexecuted or environment-blocked implementable cases. C001 is separately deferred.

## Case outcomes

| Case                  | Primary layer | Outcome             | Evidence                                                                                                                                                                      |
| --------------------- | ------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PG-021-F001-A001-T001 | Browser       | PASS                | Portal entry                                                                                                                                                                  |
| PG-021-F001-A002-T001 | Browser       | PASS                | Directory state                                                                                                                                                               |
| PG-021-F001-A003-T001 | Browser       | PASS                | Directory filter, sort and pagination                                                                                                                                         |
| PG-021-F001-A004-T001 | Browser       | PASS                | Additional table and URL boundaries                                                                                                                                           |
| PG-021-F001-A005-T001 | Browser       | FAIL                | PG-004-D-001 · Enter expanded the trigger at both 1440 and 390 px; View Department was absent, so dialog focus steps could not run.                                           |
| PG-021-F001-A006-T001 | Browser       | PASS                | Create form validation and retry                                                                                                                                              |
| PG-021-F001-A007-T001 | Browser       | PASS                | Preset, color and edit form                                                                                                                                                   |
| PG-021-F001-A008-T001 | Browser       | PASS                | Head options and unavailable state                                                                                                                                            |
| PG-021-F001-A009-T001 | Unit          | PASS                | Department normalization and field allowlist                                                                                                                                  |
| PG-021-F001-A010-T001 | API/PGlite    | PASS                | Directory and HR detail projections                                                                                                                                           |
| PG-021-F001-A011-T001 | API/PGlite    | PASS                | Session and role lifecycle                                                                                                                                                    |
| PG-021-F001-A012-T001 | API/PGlite    | PASS                | Head eligibility and replacement                                                                                                                                              |
| PG-021-F001-A013-T001 | API/PGlite    | PASS                | Department create/update and history atomicity                                                                                                                                |
| PG-021-F001-A014-T001 | Browser       | PASS                | Members detail and local search                                                                                                                                               |
| PG-021-F001-A015-T001 | Browser       | FAIL                | PG-021-D-001 · Mocked stale candidate data exposed a current member as an Assign control. Obsolete response suppression and retry were observed separately.                   |
| PG-021-F001-A016-T001 | API/PGlite    | PASS                | Employee options bounds and observational reads                                                                                                                               |
| PG-021-F001-A017-T001 | Browser       | FAIL                | PG-021-D-002 · A failed assignment reached the UI but no inline error was visible while the picker stayed open. Assign success and independent removal checks were exercised. |
| PG-021-F001-A018-T001 | API/PGlite    | PASS                | Member placement, replay and rollback                                                                                                                                         |
| PG-021-F001-A019-T001 | Browser       | FAIL                | PG-021-D-003 · The edited position rendered after retry, but focus did not return to the Edit opener.                                                                         |
| PG-021-F001-A020-T001 | Browser       | PASS                | Team create, assignment and removal                                                                                                                                           |
| PG-021-F001-A021-T001 | Browser       | PASS                | Team selection, failure and delete                                                                                                                                            |
| PG-021-F001-A022-T001 | API/PGlite    | PASS                | Team validation and related writes                                                                                                                                            |
| PG-021-F001-A023-T001 | Browser       | PASS                | Deletion confirmation and recovery                                                                                                                                            |
| PG-021-F001-A024-T001 | API/PGlite    | PASS                | Department deletion relationships                                                                                                                                             |
| PG-021-F001-A025-T001 | Integration   | PASS                | Real rewrite and membership round trip                                                                                                                                        |
| PG-021-F001-A026-T001 | PostgreSQL    | PASS                | Competing Head selection                                                                                                                                                      |
| PG-021-F001-A027-T001 | Browser       | DEFERRED — CONTRACT | PG-021-C001 · Batch policy remains undecided.                                                                                                                                 |
| PG-021-F001-A028-T001 | Unit          | PASS                | Team and member identifier limits                                                                                                                                             |
| PG-021-F001-A029-T001 | API/PGlite    | PASS                | Backend permission matrix and attribution                                                                                                                                     |
| PG-021-F001-A030-T001 | Browser       | PASS                | Text is rendered literally                                                                                                                                                    |
| PG-021-F001-A031-T001 | Browser       | PASS                | Successful create refetch count                                                                                                                                               |

## Confirmed boundaries

- **PG-004-D-001** is the shared keyboard row-action defect. Mouse actions in other tests do not provide the missing keyboard and focus evidence.
- **PG-021-D-001** affects rendered candidate choices with a synthetic stale payload. The component displays `displayedCandidates` even though `availableStaffToAssign` excludes current members before authorizing the UI action. API membership and authorization tests remain separate.
- **PG-021-D-002** affects assignment failure feedback. The handler sets `actionError` while the assignment subview remains open. That subview does not render the error, and the parent only renders it when no subview is open.
- **PG-021-D-003** affects keyboard continuity after member edit succeeds and the member list refreshes. Data rendered correctly; the opener failed the focus-return assertion.
- **C001** remains a product decision. The browser confirmed sequential removal requests and a refreshed mock reflecting the successful prefix after the later error. This establishes the browser contract exercised by A021; it supplies no database batch atomicity evidence.

The isolated Next rewrite and PostgreSQL contention case both passed. Nine abuse hypotheses have verified controls under the documented boundaries. ABUSE-009 is partial; ABUSE-010 is partial with its atomicity portion contract-blocked. No production security certification is implied.

## Handoff

Task entry and final revision are identical, with an empty index. Entry was one modified tracked ledger and eight untracked approved design reports. Handoff includes three modified tracked files (ledger and two existing browser specs) and 19 untracked files (eight inherited design files, four execution reports, seven new test/configuration files). See [implementation report](PG-021_TEST_IMPLEMENTATION_REPORT.md) for test change locations. The assessment addendum is the only eligible edit to inherited design text.

## Quality gates and cleanup

| Gate               | Final exit | Evidence                                                                                                                                                                                                                                                        |
| ------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format`      | 0          | Workspace formatting completed. The seven preserved design files were all reported unchanged.                                                                                                                                                                   |
| `pnpm lint`        | 0          | Workspace ESLint with zero warnings allowed.                                                                                                                                                                                                                    |
| `pnpm typecheck`   | 0          | Web route type generation and TypeScript, plus API Prisma generation and test TypeScript. An earlier exit 1 was corrected in test source (TS2724 wrong color helper import and TS2550 unsupported promise helper). The first post-correction run also exited 0. |
| `git diff --check` | 0          | Final tracked diff passed after recording the gates.                                                                                                                                                                                                            |

The targeted Markdown format check also exited 0. No task-owned listeners remained on the browser/rewrite ports or the disposable PostgreSQL port. Docker reported no remaining container matching the task's unique name. No production, schema, authentication, dependency or CI files changed.

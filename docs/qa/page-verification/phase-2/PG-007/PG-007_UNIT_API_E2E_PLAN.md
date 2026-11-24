# PG-007 Unit, API, E2E, and Integration Plan

**Phase:** 2.1 discovery/design only. No tests were implemented or executed.  
**Authorized future scope:** PG-007 `/attendance/overview` Phase 2.2 after separate authorization.

## Proposed files

| File                                                    | Planned cases                        | Change type                                                                                              | Test boundary                                                                                                                                                                |
| ------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/test/attendance.test.mjs`                     | T003                                 | Add unit declaration                                                                                     | Production `defaultRange()` with fixed Date; no copied implementation.                                                                                                       |
| `apps/web/e2e/attendance-overview.spec.ts`              | T004, T005, T008, T009, T011-T014    | New browser spec                                                                                         | Actual page component and same-origin API interceptions with deterministic payloads. Use the established regression auth helper; mark the mocked suite to skip in live mode. |
| `apps/web/e2e/attendance.spec.ts`                       | T002, T007, T020, preserve T021      | New route/integration declaration and additive assertions                                                | Existing serial local Next/Express/PGlite browser fixture. Use actual portal routing and real API for integration; no route interception in T020.                            |
| `apps/web/e2e/async-resource.spec.ts`                   | T015                                 | Add assertions                                                                                           | Preserve current 503/503/success route interception and intentional live-mode skip.                                                                                          |
| `apps/api/tests/features/attendance/management.test.ts` | T016-T019                            | Add assertions and PGlite cases under the existing isolated attendance reporting fixture where practical | Authenticated Express route, Prisma, PGlite persistence, explicit fixture assertions.                                                                                        |
| `apps/api/tests/support/attendance-browser-server.ts`   | T020 fixture identity only if needed | Test-only fixture addition                                                                               | A dedicated `pg007-overview` actor/Employee with assigned policy, isolated from shared `admin`/`staff` state. No production fixture or policy changes.                       |

No source changes are required for testability. Do not change `AttendanceOverviewPage`, permissions, the API, service/report implementation, database schema, migrations, attendance calculations, or product behavior.

## Unit plan

- **T003:** Test the existing `defaultRange()` output against a fixed instant using the repository's Node test clock support. Assert the two ISO UTC date strings only. If the current Node runner cannot freeze `Date` reliably, retain T003 as a browser-clock assertion within T004 instead of adding a production clock seam.
- **T001:** Keep current route-policy assertions. Do not duplicate the production permission predicate in test code.
- Do not add a unit test around JSX arithmetic copied into a test helper; UI mapping is better checked against the actual component in T009/T011/T012.

## API/PGlite plan

- Use `apps/api/tests/support/pglite-app.ts` and `startPgliteApp(t)` for an offline migrated in-memory database. No live PostgreSQL or Supabase.
- Place T016 with or adjacent to the existing nested personal overview scenario so STAFF, ADMIN, SUPERADMIN, USER, and anonymous assertions remain together. Preserve the current personal identity, override, and Superadmin checks.
- T017 should seed an active ADMIN with no Employee row and verify the source-defined 409 and unchanged Employee/attendance counts.
- T018 should call the actual `/me/overview` route for invalid calendar dates, reversed bounds, the accepted 366-inclusive-date boundary, the first rejected larger span, and unknown query fields. Use fixed `attendanceClock`; do not test blank UI dates in this case.
- T019 should create only fixture-owned Users, Employees, assignments, workdays/sessions/breaks, and approved leave records. Compare the response to direct Prisma counts; cover personal scope, leave overlap/leave-only report dates, session state counts, recent event ownership/order/cap. Use a named attendance timezone and fixed instants.
- Avoid PostgreSQL-only assertions. PGlite validates the source query/data-path behavior supported by its compatibility; it does not prove external PostgreSQL concurrency or extension behavior.

## Mocked browser plan

- New `attendance-overview.spec.ts` uses the actual `AttendanceOverviewPage`; intercept only `/api/attendance/me/overview?*` for controlled state transitions.
- T004/T005 use deferred route handlers rather than fixed sleeps. Verify request parameters, input min/max, loading semantics, and stale-response handling.
- T008 holds the refresh GET and verifies button disabled/pending behavior and duplicate suppression.
- T009/T011/T012/T013/T014 use small complete `AttendanceOverview` payloads. Keep suspended count zero for assertions about the current three-row display until C002 is clarified.
- T015 extends the current async-resource spec. Keep `test.skip(live, ...)` because its purpose is deterministic failure interception.
- Use named inputs, headings, figure regions, status rows, accessible `InlineBar` labels, and visible error/empty messages. Do not introduce arbitrary waits or permissive “either state” assertions.

## Real browser/API/PGlite plan

- T002 uses the existing attendance browser fixture's active STAFF, ADMIN, USER, and SUPERADMIN identities to visit the exact route and verify route decisions. Keep page-level policy behavior separate from API role assertions in T016.
- T020 adds a dedicated STAFF fixture actor with linked Employee and assigned policy to `attendance-browser-server.ts`. Set the server attendance clock to fixed instants; create one clock-in and clock-out through the real API, then navigate the actual page through the same-origin Next route and real API proxy. Assert returned data in the UI and re-read the overview after refresh. No API route stubbing in this case.
- The read-only overview must not create additional workdays or sessions; the setup writes should be limited to the isolated test API fixture and attendance clock actions. If direct DB counts cannot be read from the browser test process, use the already isolated PGlite API test T019 for independent Prisma assertions instead of describing the browser response as a direct DB inspection.
- T021 keeps existing 390/820/1440 no-overflow, layout, link, and refresh assertions. Do not remove or weaken them.

## Focused commands for later Phase 2.2

These commands are proposed; they were **not run** in Phase 2.1.

```powershell
# Web attendance route/time unit compatibility, including T003
pnpm --filter @nexus/web exec node --experimental-strip-types --test test/attendance.test.mjs test/route-policy.test.mjs

# Attendance reporting/identity API and PGlite cases, T016-T019
pnpm --filter @nexus/api exec node scripts/run-tests.mjs tests/features/attendance/management.test.ts tests/features/attendance/superadmin.test.ts

# Mocked PG-007 browser cases, one worker for deterministic held requests
pnpm --filter @nexus/web exec playwright test e2e/attendance-overview.spec.ts --grep PG-007 --workers=1

# Real route and PGlite-backed PG-007 integration plus preserved overview layout
pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts --grep 'PG-007|attendance overview summary layout' --workers=1

# Existing failure/retry compatibility (run outside live mode; the spec intentionally skips in live mode)
pnpm --filter @nexus/web exec playwright test e2e/async-resource.spec.ts --grep 'attendance request failures show an error and recover on retry' --workers=1
```

The API runner currently sets `--test-concurrency=2`. `attendance.spec.ts` is serial; run the focused selection with one Playwright worker because its local fixture and other attendance records share the server process. Do not run the full repository suite under this page-level authorization.

## Quality checks and incidental output

After a separately authorized implementation, run the repository-required documentation/code quality commands `pnpm format`, `pnpm lint`, `pnpm typecheck`, and `git diff --check`; record exit codes and any generated changes. Typecheck may regenerate `apps/web/next-env.d.ts` and Prisma Client outputs; distinguish generated output from source edits and preserve user state. Do not run automated tests during Phase 2.1; the focused tests above are for a future Phase 2.2 task only.

## Compatibility and worker risks

- Preserve PG-004-D-001, PG-006 T018/T024, and all prior ledger records. PG-007 does not use `RowActionsMenu`; a failure in PG-006's 820 px Check-Ins menu step is not a PG-007 defect.
- T024 shares the grouped `attendance.spec.ts` declaration and may fail at 820 px for the Check-Ins route even while `/attendance/overview` assertions pass. Report that exact failure separately and do not count it against a PG-007 overview case without a failing overview assertion.
- Reuse the existing serial browser fixture and dedicate a new actor/date for T020. Avoid mutating the shared admin attendance history, which earlier pages' tests may read.
- Keep API tests isolated under PGlite and the focused command's concurrency of two. Use unique emails/IDs and test-owned cleanup via `TestContext`.
- Browser mocked tests must not be called persistence-backed. Integration T020 must not intercept the overview response. No full PostgreSQL integration is proposed.

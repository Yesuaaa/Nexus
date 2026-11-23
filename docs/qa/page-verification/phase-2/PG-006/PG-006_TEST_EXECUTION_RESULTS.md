# PG-006 Test Execution Results

**Run date:** 2026-11-23  
**Scope:** Focused PG-006 unit, API/PGlite, browser, integration, and direct compatibility checks only. The full repository regression suite was not run.

## Commands and outcomes

Reruns below overlap by design to diagnose and correct test-only defects. Counts are per command; they are not added together into an aggregate.

| Key | Exact command                                                                                                                                       | Result                                                                                                                                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1  | `pnpm --filter @nexus/web exec node --experimental-strip-types --test test/attendance.test.mjs test/route-policy.test.mjs`                          | Final reviewed run **29 passed, 0 failed**, exit 0. The first invocation could not open pnpm's shared-store lock; rerun succeeded. Includes T006 and route-policy/time utility compatibility.                                                                                                                     |
| A1  | `pnpm --filter @nexus/api exec node scripts/run-tests.mjs tests/features/attendance/backend.test.ts tests/features/attendance/management.test.ts`   | Initial run **31 passed, 2 failed**, exit 1. New T003 used an empty clock-out body, so request validation returned 400 before the role guard. Classified **TEST DEFECT**, not an application authorization failure.                                                                                               |
| A2  | Same command as A1 after replacing malformed bodies with endpoint-valid fixture IDs                                                                 | **33 passed, 0 failed**, exit 0. API runner used `--test-concurrency=2`; both test files use isolated `@electric-sql/pglite` through `tests/support/pglite-app.ts`. T003/T004/T011/T016/T021/T022 were covered.                                                                                                   |
| W1  | `pnpm --filter @nexus/web exec playwright test e2e/attendance-entry.spec.ts --grep PG-006`                                                          | Initial run **4 passed, 4 failed**, exit 1, six workers. T005/T015 had ambiguous global alert locators; T023 queried the old button name after it changed to `Saving…`; T018 could not find the keyboard-open menu item. The first three were test locator defects; T018 required source/previous finding review. |
| W2  | Same command as W1 after locator corrections                                                                                                        | **7 passed, 1 failed**, exit 1, six workers. T002, T005, T012, T013, T014, T015, and T023 passed. T018 failed on the keyboard-open `View details` item.                                                                                                                                                           |
| W3  | `pnpm --filter @nexus/web exec playwright test e2e/attendance-entry.spec.ts --grep T018`                                                            | **1 failed**, exit 1, one worker. Final DOM-stable trigger asserts `aria-expanded="true"`; no accessible View details menu item appears. Confirms PG-004-D-001 on PG-006.                                                                                                                                         |
| W4  | `pnpm --filter @nexus/web exec playwright test e2e/attendance-entry.spec.ts --grep T002`                                                            | **1 passed**, exit 0, one worker. The test covers both STAFF and ADMIN alias navigation.                                                                                                                                                                                                                          |
| I1  | `pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts --grep 'PG-006-F001-A004-T009                                                 | real employee clocks overnight                                                                                                                                                                                                                                                                                    | unpaid break timer freezes and correction request uses the real API                                                                                   | grouped attendance pages use live scoped data | existing-session prefills retain the recorded repeated offset and seconds'` | After correcting T007's assertion timing, T007/T017 and T009 passed. Existing T010 then found Clock-in disabled because T009 had left a future workday on the shared staff actor. The remaining four selected declarations did not run after the serial stop. Classified as a **FIXTURE-ISOLATION TEST DEFECT**. |
| I2  | Same command as I1 after T009 moved to dedicated test-only actor `pg006-overnight`                                                                  | T007/T017 and T009 passed again. T010 reached its review-queue assertion but the existing `getByText("Pending", { exact: true })` matched two visible labels and failed Playwright strict mode. Remaining four declarations did not run. Existing assertion was left unchanged.                                   |
| I3  | `pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts --grep 'grouped attendance pages use live scoped data                         | existing-session prefills retain the recorded repeated offset and seconds'`                                                                                                                                                                                                                                       | Before T024's extra seeded-row/action assertions were added, **4 passed**, exit 0, one worker: responsive baseline at 390/820/1440 and existing T020. |
| I4  | `pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts --grep 'grouped attendance pages use live scoped data'`                       | With final T024 assertions: **390 px passed; 820 px failed** because the accessible View details item was absent after the menu trigger opened; 1440 px did not run after the serial stop. A later full-matrix rerun produced the same 390 pass / 820 failure.                                                    |
| I5  | `pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts --grep 'grouped attendance pages use live scoped data at 820px'`              | One isolated final-locator run **passed**, exit 0; another full-matrix run failed at the menu item. Classified **NONDETERMINISTIC / FLAKY** and tracked with the shared RowActionsMenu concern.                                                                                                                   |
| I6  | `pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts --grep 'grouped attendance pages use live scoped data at 1440px'`             | **1 passed**, exit 0. Includes live isolated API/PGlite row, detail-panel, date-filter, and confirmation/dialog assertions.                                                                                                                                                                                       |
| I7  | `pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts --grep 'unpaid break timer freezes and correction request uses the real API'` | Final isolated run **1 passed**, exit 0. This is the existing T010/T019 browser/API/PGlite regression. The combined run's ambiguous Pending assertion is separately recorded under I2.                                                                                                                            |
| I8  | T020 declaration selected in I3                                                                                                                     | Existing-session correction prefill, repeated offset, seconds, linked session, and persistence assertions passed as part of I3.                                                                                                                                                                                   |

## Build and test-defect corrections

- Initial Playwright build rejected T009's `expect(status).toBe(expected, message)` call shape. It was corrected to `expect(status, message).toBe(expected)`. The web TypeScript check then passed.
- The first T003 API failure was due to invalid request bodies being rejected before role authorization. Valid test payload IDs now reach and verify the intended 403 guard; no API code was changed.
- T005/T015 now scope their assertions to the specific current/history alert because the app also has other alerts and a persistent Next route-announcer alert.
- T023 checks the disabled pending submit under its rendered `Saving…` name.
- T007 summary assertions now run while the overnight workday is active at eight hours. The first attempt incorrectly expected a current-day “Clocked out” state after ending a prior-day workday; the application had correctly rendered the completed prior-day history row.
- T009 uses a dedicated test actor after the combined run exposed cross-case state contamination on the shared `staff` actor.
- T024 uses the history-table trigger when the current-workday and history tables render the same workday action ID. The 820 px accessible menu-item result remains intermittent after this locator correction.
- One temporary TypeScript `noUnusedLocals` failure (`table` left unused while correcting T018's trigger locator) was fixed by removing that test variable. Subsequent Playwright builds compiled successfully.

## Environment and integration boundaries

- Web unit: Node test runner; deterministic timestamps; no API/network calls.
- API: offline PGlite databases from `tests/support/pglite-app.ts`; no live PostgreSQL, Supabase, or production data.
- Mocked browser cases: actual `MyAttendancePage` with deterministic same-origin API route responses; these do not verify persistence.
- T017: a second actual page with mocked current/history GETs; its row-format assertions are browser rendering only.
- T007, T009, T010/T019, T020, and T024: Playwright with the isolated Next server and Express API/PGlite fixture in `apps/api/tests/support/attendance-browser-server.ts`. T009 independently reads persisted history after the UI continuation; T024 seeds and reads actual admin attendance rows. These do not claim PostgreSQL-specific behavior.
- `attendance.spec.ts` is serial and used one Playwright worker; the focused `attendance-entry.spec.ts` run used six workers by default; single-case reruns used one worker.
- Existing `test.skip(live, ...)` cases remain intentional and were not selected as passes.

## Failure classification and outstanding coverage

### Confirmed application defect: PG-004-D-001 on PG-006

T018 focuses the Check-Ins row action and presses ArrowDown. The trigger's `aria-expanded` becomes `true`, but `getByRole("menuitem", { name: "View details" })` finds no item. The assertion fails before opening the detail panel. The page uses the same shared `RowActionsMenu` implicated by PG-004-D-001. No production code was changed.

### Nondeterministic T024 menu result at 820 px

The 390 px and 1440 px scenarios passed. At 820 px, a full matrix run twice reached an expanded row-action trigger but the accessible View details item was absent; one isolated 820 px run passed. The test uses the real page and PGlite-backed history row. This is classified as nondeterministic shared-menu behavior, not as a second independently confirmed defect ID.

### Test defect: combined T010 pending locator

The existing combined serial test later failed because `getByText("Pending", { exact: true })` returned two visible matches. T010/T019 passed in an isolated fresh fixture. The original existing assertion was retained and not weakened.

### Contract and execution limits

- T025 / PG-006-C001 remains `BLOCKED - CONTRACT CLARIFICATION REQUIRED`; blank-date history behavior was not asserted.
- The default history date-range timezone basis remains unspecified; tests compare visible values to requests instead of asserting a product timezone.
- Active ADMIN without an Employee profile receives a 409 from personal attendance APIs; the page currently presents Retry but no profile-setup action. This source-backed behavior is documented, not classified as a defect.
- Some selected serial integration runs stopped at the first failure; later cases were run in isolated invocations where noted. No aggregate total combines overlapping reruns.
- No full repository regression command was run.

Quality-gate commands and exit codes are recorded in [PG-006_FINAL_VERIFICATION.md](PG-006_FINAL_VERIFICATION.md) after completion of the documentation and final diff check.

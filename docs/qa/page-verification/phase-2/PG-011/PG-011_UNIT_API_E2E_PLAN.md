# PG-011 Unit, API, and E2E Plan

This is the proposed Phase 2.2 plan only. It does not authorize or implement tests. No test runner, browser, PGlite database, or PostgreSQL database was started during discovery.

## Proposed files and test allocation

| Proposed file                                                                | Planned work                                                                                                                                                                                                                                                                                               | Environment and preservation                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/test/attendance.test.mjs`                                          | Add exact PG-011 route-policy matrix to existing attendance navigation assertions (A001-T001).                                                                                                                                                                                                             | Use production `canAccessRoute`; unit evidence does not replace backend authorization. Preserve generic route assertions.                                                                                                     |
| `apps/api/tests/features/leave/leave-requests.test.ts`                       | Add list search/filter/date/pagination boundaries, policy coverage-gap/no-partial-write cases, remaining schema boundaries, and any missing API scope assertions (A004-T002, A005-T002, A006-T001, A007-T001, A014-T001/T002). Keep API role, replay, conflict, transfer and attendance assertions intact. | Existing `startPgliteApp(t)` fixture. Never point the default suite at configured/live databases. Reuse frozen clock and current actor/Employee/Department/policy fixtures.                                                   |
| `apps/web/e2e/leave-requests.spec.ts` (new)                                  | Mocked page-specific loading/retry/empty, scope/filter/search/pagination queries, row mapping, capability menu, request dialog, preview success/error, form validation, review/cancel/reverse confirmation, keyboard menu and accessibility/responsive cases.                                              | Mock same-origin `/api/leave` and stable typed responses; use authenticated `sessionStorage` fixture. Mocked tests verify UI only, never persistence. Use deterministic delays/clock and initially `--workers=1`.             |
| `apps/web/e2e/attendance.spec.ts`                                            | Add one focused real browser form-submit-and-persist integration case (A013-T001) if the current `attendance-browser-server.ts` fixture can provide active policy coverage and a Head. Preserve direct-link, notification, transfer and stale cases.                                                       | File owns a serial browser/API fixture on `127.0.0.1:5391`; real Browser → Next.js → Express → Prisma/PGlite. Do not run its selections concurrently against the shared fixture.                                              |
| `apps/web/e2e/superadmin-attendance.spec.ts`                                 | Extend mocked capability assertions only if the new Leave spec does not centralize those fixtures (A009-T001/A017-T001).                                                                                                                                                                                   | Its response mocks do not prove server persistence. Inspect current live-mode skip gate before running; preserve it.                                                                                                          |
| `apps/api/tests/features/leave/leave-actions.postgres.ts` (new, opt-in only) | Add a same-request/version competing-decision case using independent PostgreSQL connections and a deterministic barrier (A020-T003).                                                                                                                                                                       | Separate from default `*.test.ts` PGlite suite. Require a new explicit `PG011_POSTGRES_URL`, validate loopback/database/cluster/version and emptiness/cleanup, never use `DATABASE_URL`, and abort if target is not verified. |

No unit test is needed for the backend algorithms by reimplementing them. If a pure `leaveStatusLabel` unit test is desired, add it only if it can test the production function without duplicating capability decisions; current case set covers labels through table browser assertions instead.

## Reusable fixtures and mock boundaries

- **Web route unit:** production route-policy helper and account fixtures in `apps/web/test/attendance.test.mjs`.
- **API/PGlite:** `apps/api/tests/support/pglite-app.ts` / `startPgliteApp`; seed actor accounts, linked/unlinked Employees, Departments/Heads, attendance policies/days/assignments, requests, sessions/adjustments and notifications. Assert persisted Prisma state, not only HTTP status.
- **Mocked browser:** reuse `restoreSession`/typed actor shape as appropriate; intercept same-origin requests before network access. Assert request query/body and visible loading/error/success behavior. Mock capability projection accurately and keep backend auth cases in PGlite.
- **Real browser/API:** reuse `attendance-browser-server.ts` and existing `attendance.spec.ts` serial server lifecycle. Obtain tokens in `sessionStorage`; use actual notification/API services. Test persistence through the isolated backend/Prisma fixture.
- **Concurrency:** two separate PostgreSQL connections and a synchronization barrier are required. A single PGlite connection or sequential replay does not establish competing transaction behavior.

## Source-backed expectations for implementation

1. Keep server-owned role, employee, department, current Head, status and version checks authoritative. UI capability flags are display hints only.
2. Keep exact source constraints: valid date strings; ordered inclusive range 1-366 days; supported type/status enums; reason/note trim lengths 5-2000; cancellation note optional; expected version integer >=1.
3. Treat mocked page tests as presentation/query evidence only. Only Browser/API/PGlite verifies the real frontend/backend path, and only database assertions verify persistence.
4. Preserve API 404 non-disclosure for hidden records, 409 overlap/stale/conflict semantics, request/action idempotency, transactional notifications, and policy-derived day snapshots.
5. Preserve `PG-004-D-001` as a failing assertion if Leave row-menu keyboard reproduction fails. Do not force pointer actions, skip the failing width, increase timeouts to mask it, or reclassify as a PG-011 defect without page-specific evidence.
6. The profileless ADMIN button and filter/detail selection behavior remain contract-blocked. Do not encode UI expectations until product clarification.

## Focused commands for a separately authorized Phase 2.2

These are proposals, not commands executed for Phase 2.1.

```powershell
# Route-policy unit test (includes existing attendance route assertions)
pnpm --filter @nexus/web exec node --experimental-strip-types --test test/attendance.test.mjs

# Focused leave API/PGlite suite
pnpm --filter @nexus/api test -- tests/features/leave/leave-requests.test.ts

# New mocked Leave browser spec
pnpm --filter @nexus/web exec playwright test e2e/leave-requests.spec.ts --workers=1

# Real browser/API/PGlite form-submit selection in the serial attendance fixture
pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts --grep "PG-011" --workers=1

# Existing Leave deep-link, transfer, stale recovery, and shared menu compatibility
pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts --grep "Superadmin opens organization leave|Employee Directory transfer routes both Leave review stages|stale HR approval refreshes leave|stale leave refresh clears details" --workers=1

# Optional real PostgreSQL race (only after verifying isolated target)
$env:PG011_POSTGRES_URL = '<verified disposable local PostgreSQL target>'; pnpm --filter @nexus/api exec node scripts/run-tests.mjs tests/features/leave/leave-actions.postgres.ts
```

The final command must be blocked if the explicit target cannot be independently verified. PostgreSQL 16 was available for PG-010 T032 on a disposable target, which is potential reusable infrastructure evidence only. PG-008's separate assignment concurrency blocker remains unresolved.

## Compatibility, concurrency and quality gates

- First focused browser execution should use `--workers=1`. `attendance.spec.ts` owns a serial fixture and fixed local API port; do not run other tests that start/modify the same fixture concurrently.
- Run the shared row-action keyboard regression at 390, 820 and 1440 px and preserve any failure. PG-006 T024 remains an intermittent 820 px result; PG-008 has a prior 390 px fixture failure. Neither can be treated as a PG-011 failure or as resolved by one passing isolated run.
- Run the new request form through a real Browser/API/PGlite path before claiming persistence. Mocked browser POST success does not establish a database write.
- The opt-in PostgreSQL race is separate from default API/PGlite suites and from the PG-008 assignment race. Do not infer one case resolves the other.
- Under future Phase 2.2 authorization, run `pnpm format`, `pnpm lint`, `pnpm typecheck`, and `git diff --check`. Focused tests above are not regression-suite commands; full regression remains separate authorization/scope.

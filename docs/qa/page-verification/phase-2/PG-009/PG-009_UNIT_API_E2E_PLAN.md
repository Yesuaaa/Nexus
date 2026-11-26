# PG-009 Unit, API, and E2E Implementation Plan

This is a Phase 2.2 plan only. No test files, fixtures, mocks, or application source were changed or executed during Phase 2.1.

## Proposed files and assertions

| File                                                           | Planned work                                                                                                                                                                                                                                                                   | Isolation / fixture                                                                                                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/test/attendance.test.mjs`                            | Add PG-009 exact-route permission decision assertions (A001-T001), preserving generic route and PG-008 tests.                                                                                                                                                                  | Existing Node unit harness; production permission helpers.                                                                                                                             |
| `apps/api/tests/features/attendance/policy-management.test.ts` | Extend the existing summary API case with archived and canceled-separated fixtures; assert source-defined summary counts (A003-T001). Keep canceled per-policy expected semantics deferred (A005-T002).                                                                        | Existing `tests/support/pglite-app.ts` isolated in-memory PostgreSQL fixture. No live database.                                                                                        |
| `apps/web/e2e/attendance.spec.ts`                              | Add page query/loading, pagination requests, KPI values, summary-to-response comparison, ranking, inventory, no-history, links, empty/error/retry, and accessible/responsive assertions (A001-T002 through A012-T001 as applicable). Keep current assertions and role denials. | Reuse existing `signIn`, seeded actor, and `attendance-browser-server.ts` fixture; route interception for mocked cases, real browser→Next→Express→Prisma→PGlite for integration cases. |

No new backend test fixture file is needed unless the current attendance browser fixture cannot safely seed archived/canceled policies. If fixture extension becomes necessary, keep it isolated to PGlite; do not point tests at a developer database.

## Mock and integration boundaries

- **Mocked browser:** Intercept only `/api/attendance/policies` after authenticating with the existing test actor. Use typed response fields accepted by `AttendancePolicy`: `id`, `name`, `timeZone`, `archivedAt`, `createdAt`, `_count.assignments`, paging fields, and summary. This isolates deterministic rendering and error/retry branches.
- **Pagination boundary:** Exercise `attendancePolicies` through the page with mocked same-origin GET responses; assert page 1 then page 2 requests. Its module imports the auth API through the `@/` alias, so the current Node unit harness is not a direct-import boundary for this client without extra resolver infrastructure.
- **API/PGlite:** Use the existing Express/PGlite API test. Create distinct active/archive and canceled/not-canceled records to test the current aggregate query. Keep the canceled relation count's product meaning blocked.
- **Real browser integration:** Use the existing attendance fixture server on 5391 and actual app route/proxy. Compare visible KPI values with the captured API JSON. PGlite establishes persistence for this test; mocked browser cases do not.
- **PostgreSQL concurrency:** Not justified for this read-only page. No new disposable PostgreSQL/Docker requirement; do not inherit PG-008's opt-in concurrency blocker as a PG-009 blocker.

## Focused commands for future authorized Phase 2.2

These commands are proposed, not run in Phase 2.1.

```powershell
# Web permission helper unit case
pnpm --filter @nexus/web exec node --experimental-strip-types --test test/attendance.test.mjs

# Focused API/PGlite policy API tests
pnpm --filter @nexus/api test -- tests/features/attendance/policy-management.test.ts

# Mocked and real PG-009 browser cases, after tagging them with PG-009 IDs
pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts --grep "PG-009" --workers=1

# Preserve grouped-route width and role coverage
pnpm --filter @nexus/web exec playwright test e2e/attendance.spec.ts --grep "grouped attendance pages use live scoped data|grouped attendance routes enforce staff and department-head boundaries" --workers=1

# Backend all-role auth regression
pnpm --filter @nexus/api test -- tests/backend-regression.test.ts
```

The API runner compiles test TypeScript into its isolated `.test-build` tree and uses its PGlite harness; it does not require running a production API. The attendance browser spec is serial and owns a shared fixture lifecycle. Keep `--workers=1` for those selections. The web Playwright config otherwise permits full parallelism; any new page test in the same serial file should not share mutable state across cases. Mocked API tests must not be counted as persistence verification.

Playwright's configured `webServer` builds and starts the web app on port 5273 when `NEXUS_E2E_BASE_URL` is unset. The attendance spec separately launches its isolated API fixture; keep that fixture lifecycle and the Next proxy target aligned as the existing spec currently does.

## Regression and quality gates

After a separately approved implementation, retain the focused commands above and run the required repository quality gates `pnpm format`, `pnpm lint`, `pnpm typecheck`, and `git diff --check`. Any broader regression selection should follow the Phase 2.2 authorization; do not treat a focused pass as full-system reconciliation. Preserve PG-004-D-001, PG-006 T024/T025, PG-008's partial verification, and all prior contract blockers.

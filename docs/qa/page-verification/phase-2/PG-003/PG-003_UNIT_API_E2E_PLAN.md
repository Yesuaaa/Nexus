# PG-003 Unit, API, and E2E Plan

## Recommended test layout

| Layer                       | Proposed work                                                                                                                                    | Location                                                                                       | Fixture / environment                                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                        | Test the pure personal-attendance predicate (T001) and exact `/attendance` route-policy matrix (T002).                                           | Existing `apps/web/test/attendance.test.mjs` or route-policy unit file.                        | Node `node:test`; role/account records only; no API or database.                                                                                                                                                                 |
| Browser                     | Add active STAFF and ADMIN entry cases, denied-account matrix, no-token handoff, and accessible pending-state assertion (T003, T004, T006-T008). | New `apps/web/e2e/attendance-entry.spec.ts`.                                                   | Playwright Chromium, local built Next app, `configureRegressionTest` and `restoreSession`; mock `/api/auth/me` and only the downstream reads required for a stable route smoke check. Skip live mode when using mocked accounts. |
| Existing browser regression | Preserve the eligible SUPERADMIN route assertion (T005); consider history assertion T009 in the same flow or new entry spec.                     | `apps/web/e2e/superadmin-attendance.spec.ts`; `apps/web/e2e/superadmin-module-access.spec.ts`. | Existing regression account and attendance response stubs. These tests skip `NEXUS_E2E_LIVE=1`.                                                                                                                                  |
| API                         | No PG-003-specific API test proposed.                                                                                                            | None.                                                                                          | The entry component has no attendance/leave API client or operation. Shared `GET /api/auth/me` is an auth-layer dependency, not an attendance endpoint.                                                                          |
| Database integration        | Not applicable to PG-003 route selection.                                                                                                        | None.                                                                                          | No attendance persistence read/write occurs in the entry. PGlite is unnecessary; do not attach a live database.                                                                                                                  |

## Reusable setup and mock requirements

- Reuse `accountFor`, `restoreSession`, and `configureRegressionTest` from `apps/web/e2e/regression-support.ts`. Account overrides can model inactive accounts or a SUPERADMIN missing `employees:read`.
- The existing regression helper intercepts `/api/auth/me` and returns the selected fixture account. Do not use live credentials for deterministic route-policy cases.
- If the destination page triggers attendance reads before URL assertions complete, stub only the endpoints necessary to keep the destination shell stable. Do not assert or redesign PG-006/PG-014 content in these tests.
- For the status assertion, install a pre-hydration observer or another deterministic observation; avoid fixed sleeps because the state is intentionally transient.
- Do not introduce React DOM test dependencies just to test this tiny route component unless the broader web unit suite adopts that harness independently.

## Eventual commands and preservation checks

After a future implementation authorization, run the repository's supported runners as needed:

1. `pnpm test:unit` for the web unit additions and standard unit/API regression run.
2. `pnpm test:e2e` for browser additions; Playwright uses the local built web app unless an explicit base URL is configured. Focused command-line filtering can be selected after inspecting the runner's argument forwarding.
3. Re-run the existing direct Superadmin route assertions in both listed E2E files and retain their no-personal-read assertions. Do not remove tests or change expected results without source/contract evidence.
4. The mandatory handoff gates are `pnpm format`, `pnpm lint`, and `pnpm typecheck`. This design phase runs these safe gates only; it does not run any test command.

## Reliability notes

- Use Playwright URL polling rather than arbitrary waits for the client effect and router transition.
- The auth layout resolves the account before rendering the entry component, so tests must distinguish its “Loading your account…” status from PG-003's “Opening attendance…” status.
- Exercise STAFF, ADMIN, SUPERADMIN, USER, inactive, and permission variants at the correct layer: the pure predicate, route policy, and browser guard have different contracts.
- Browser fixture account permission data must mirror actual account permissions; a SUPERADMIN with no `employees:read` must be denied before its component target is tested.
- No concurrency, rollback, PGlite startup, or data seeding is needed for the entry route. Avoid coupling this test slice to the attendance browser server unless later source changes add a real PG-003 API dependency.
- Query-driven testing remains blocked by C001. Once clarified, add only cases for approved inputs and preserve the role/access gate.

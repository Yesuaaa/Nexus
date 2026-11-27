# PG-022 Unit, API and E2E Plan

**Status:** Planned only. No test source or execution environment was created in Phase 2.1.

## Layer allocation

| Layer                              | Cases                                           | Purpose and boundary                                                                                                                                                                                                                               |
| ---------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                               | T001 existing-sufficient                        | Pure route-policy matrix for role, departments-read permission and module ownership. No server/session claim.                                                                                                                                      |
| API/PGlite                         | T004-T008; T007 is the only new API declaration | Real Express router, requireAuth, permission middleware, department service/repository, projection and persisted read-only assertions over migrated in-memory PGlite. No external database.                                                        |
| Mocked Browser                     | T002, T003, T010-T025                           | Actual Next page/component with synthetic account/settings/API responses. Proves rendering, errors, derived display, accessibility, responsive CSS, keyboard link and lifecycle only. Mocked responses do not prove API authorization/persistence. |
| Browser/Express/PGlite integration | T009 existing-sufficient only                   | Reuse prior observed Next rewrite evidence for shared GET /api/departments transport. It does not verify PG-022 markup or freshly verify this page.                                                                                                |
| PostgreSQL                         | None                                            | No page write, uniqueness race, lock or provider-specific final-state invariant exists.                                                                                                                                                            |

Each implementable case has one primary layer: Unit 1, Browser 18, API/PGlite 5, Integration 1. T026/T027 have provisional layers; contract ambiguity is not an environment failure.

## Browser fixtures and assertions

Use regression support with synthetic ADMIN/SUPERADMIN accounts, departments and preferences. Intercept GET /api/auth/me for PortalLayout account resolution, GET /api/auth/settings for PreferencesProvider, and GET /api/departments for the page-owned list. The settings request is mounted only after an account is admitted to the route. Avoid live credentials and production services. T023 observes a browser fetch abort after page unmount. T024 uses an app-facing synthetic promise that ignores AbortSignal and resolves after the account-update event causes /api/auth/me to return STAFF; label this as a mock seam, not a late wire response.

Use role/name locators and native table semantics. Wait on API response, account state or settled visible content. No sleeps, hidden selectors, retries or skip changes. T019 uses the seven source-derived widths and a single worker with zero retries. No mutation is performed; navigation uses synthetic routes/responses.

## API fixtures and assertions

Use startPgliteApp from apps/api/tests/support/pglite-app.ts. It applies migrations to disposable PGlite, wires Prisma and a local Express app, and registers teardown. Create synthetic ADMIN, SUPERADMIN, STAFF, Head and USER accounts with local sessions. Seed department, employee, team and service data for exact list projections. Compare response and persisted snapshots; do not use live DATABASE_URL, customer data or notifications. T007 checks page-used fields and role-specific projection. T008 is existing evidence; no test declaration is edited.

## Integration and isolation

No new real rewrite or database integration is planned. PG-021 A025 ran the real Next rewrite to Express/PGlite for the shared departments API. Its scope was a membership workflow; no PG-022 page result is claimed.

The default apps/web/playwright.config.ts uses Chromium and local Next at 127.0.0.1:5273; its stub public-service upstream uses 127.0.0.1:5274. Browser API routes are intercepted, so Express/database are not part of those cases. Default webServer configuration builds and starts a task-owned Next process. Do not reuse an unrelated server. The PGlite harness uses ephemeral loopback resources and its own cleanup. Record actual ports/processes in a later authorized execution.

Planned commands, not run:

- API focused suite: pnpm test:api tests/features/departments/department-overview.test.ts
- Mocked browser suite: pnpm --filter @nexus/web exec playwright test e2e/departments/department-overview.spec.ts --workers=1 --retries=0

Root scripts forward API selections; the API runner uses PGlite support. Browser command uses existing Playwright configuration. Environment availability is not assessed in Phase 2.1. A later runner/browser limitation is an environment dependency and does not change disposition.

## Concurrency decision

No PostgreSQL test is justified. The page does not mutate department, employee, team or service rows. Figures and gaps reflect the response received by the browser. A later directory change may remain unseen until route reload; no live-refresh or read-your-writes guarantee is documented. There is no winner/loser actor, competing transaction, lock point or final database invariant. PGlite suffices for role projection and read-only API cases. Sequential reads or simultaneous navigation cannot establish database contention.

# PG-020 Unit, API, Browser, and Integration Plan

Phase 2.1 design only. This plan describes safe future implementation and verification. No test command was run in this task.

## Case and layer reconciliation

The authoritative inventory contains 29 unique cases: 8 new declarations, 6 additive assertion groups, 15 existing-sufficient cases, and 0 contract-blocked cases. Layer totals are Unit 2, API/PGlite 9, mocked Browser 17, and Browser/Express/PGlite integration 1. The 23 source-backed abuse hypotheses map to those same case IDs; they do not add cases.

## Unit layer

Existing route and workspace helpers already cover two source behaviors:

- apps/web/test/route-policy.test.mjs: route matrix, Dashboard navigation label/current route, and internal-only /module behavior.
- apps/web/test/workspace-modules.test.mjs and workspace-selection.test.mjs: USER gets no internal workspace entries or remembered module context.

Keep these assertions. No new unit declaration is required by the current source inventory. If extended, test exported helpers only; do not mock React or duplicate the route-policy implementation.

Suggested focused command during a separately authorized implementation:

pnpm --filter @nexus/web test -- test/route-policy.test.mjs test/workspace-modules.test.mjs test/workspace-selection.test.mjs

Confirm exact runner argument behavior from the package script before execution.

## API/PGlite layer

Reuse apps/api/tests/support/pglite-app.ts and the existing request-workflow fixture. Build only synthetic USER identities, owned/foreign service requests, public/internal WorkflowEvents, and WorkflowNotifications.

Preserve existing assertions in:

- apps/api/tests/request-workflow/fixed-price-and-notifications.ts
- apps/api/tests/backend-regression.test.ts
- apps/api/tests/jwt-session.test.ts

The additive projection assertions should inspect only the Client GET response and assert a stable allowlist of selected keys; do not expose unrelated Prisma fields in a test response. If endpoint tests are needed, add them under apps/api/tests/ and use real Express with PGlite, never a live database.

The existing API cases already exercise notification ownership, role access, count/list boundaries, preference suppression, one single-read transition, and mark-all. Add PGlite cases for single-read replay and the combined USER request/project conversation list scope used by the Dashboard Messages badge. Do not require first-read timestamp preservation. A malformed recipient or fabricated userId/body should be rejected or ignored according to current route contract; these endpoints derive identity from auth context.

Suggested focused command during implementation:

pnpm --filter @nexus/api test tests/request-workflow.test.ts tests/backend-regression.test.ts tests/jwt-session.test.ts

This is a proposed future command, not executed here.

## Mocked browser layer

Extend apps/web/e2e/dashboard/dashboard.spec.ts for:

- exact Dashboard heading/description and source-aligned Account menu control/logout,
- Dashboard request-plus-project unread aggregation,
- Escape/backdrop drawer close,
- notification loading/error and displayed semantic time,
- notification unread counts 0, 1, and 105 with 99+ visual cap and full accessible count,
- known non-project Client request link encoding,
- single-read and mark-all UI states,
- deterministic fake-clock 30-second refresh.

Use restoreSession with role USER, page.route for controlled JSON, request gates for ordering, and Playwright clock for refresh. Assert route, accessible name, aria-expanded, status text, PATCH count, toast, and returned unread state. Never use live credentials. Preserve all current test titles and assertions.

Use apps/web/e2e/workspace-selector.spec.ts and shared/messages-topbar.spec.ts as adjacent coverage for USER navigation and message totals. They already parameterize supported viewport widths and role access.

Suggested focused command during implementation:

pnpm --filter @nexus/web exec playwright test e2e/dashboard/dashboard.spec.ts e2e/workspace-selector.spec.ts e2e/shared/messages-topbar.spec.ts --project=chromium --workers=1 --retries=0

Do not run the entire E2E suite for these cases.

## Browser/Express/PGlite integration

Add one isolated integration case for the dashboard’s real account and notification reads. Use a disposable PGlite database and the existing API server fixture pattern; seed two USER accounts and narrowly scoped workflow/event/notification rows. Start the real Next app with API_PROXY_TARGET pointed to the isolated Express server so browser requests pass through the configured same-origin Next rewrite. Do not page.route the tested API endpoints.

Verify /api/auth/me returns the seeded USER, GET /api/request-workflows/notifications displays only that user’s non-internal owned notice, and the other user/internal sentinels never render. Record response and persisted snapshots before/after. The page route and topbar are real; no payment, mail, storage, production service, customer data, or external integration is needed.

This proposed integration has a different boundary from PG-019’s documented rewrite bypass. It must exercise the Next rewrite explicitly if claimed as Next/Express integration.

## PostgreSQL decision and safety

PostgreSQL concurrency is NOT JUSTIFIED for current PG-020 behavior. The page performs reads and two recipient-scoped readAt updates. No inventory, balance, uniqueness, or workflow transition invariant is concurrently mutated by this page. PGlite is sufficient for the API behavior and transaction tests. The existing RepeatableRead listing test checks list/count snapshot structure; it does not create a requirement for a separate PostgreSQL suite.

All proposed API and integration data is disposable and synthetic. No test should contact production, financial systems, mail, live object storage, or the public internet. Do not use destructive operations or unbounded request loops.

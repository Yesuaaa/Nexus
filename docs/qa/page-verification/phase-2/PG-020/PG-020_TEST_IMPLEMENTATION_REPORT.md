# PG-020 Test Implementation Report

Eight new declarations are implemented: five in dashboard/dashboard.spec.ts (badge A006-T002, encoded destination A008-T002, read-click A009-T002, bulk read A010-T002, refresh A011-T002), two in apps/api/tests/pg020-dashboard.test.ts (A005-T003 and A009-T003), one in dashboard/pg020-integration.spec.ts (A008-T003). Stable IDs match the approved specification.

Six additive groups extend existing declarations: A002-T001 heading/description; A004-T001 Escape/overlay; A005-T001 account entries/logout; A005-T002 request 2 plus project 3 unread count; A006-T001 disabled empty-feed action; A007-T003 exact API response keys. Existing titles and original expectations remain, with the authorized Account menu locator correction.

Test-only infrastructure: apps/api/tests/support/pg020-browser-server.ts and apps/web/playwright.pg020.config.ts. Production Next rewrite configuration is unchanged. The isolated upstream binds loopback 5274, forwards to an ephemeral real Express server and disposable migrated PGlite, and exposes synthetic fixture setup/snapshot data on a test-only control path. No production/customer data or external services.

Browser -> Next 5273 -> unchanged `/api/:path*` rewrite -> loopback fixture upstream 5274 -> Express -> Prisma -> PGlite. Real auth/me and notifications are observed upstream; browser response origins remain Next; private/foreign notice sentinels are absent; persisted notification snapshots remain equal. No page.route/route.fetch forwarding substitutes for the rewrite.

See [execution outcomes](PG-020_TEST_EXECUTION_RESULTS.md) for all 29 records. At the initial implementation checkpoint, fifteen existing-sufficient records retained their original declarations and two responsive records were unverified. The recovery addendum below supersedes that checkpoint status while preserving its initial failure evidence.

## Verification-recovery addendum (2026-11-26)

The two Client-navigation cases now pass at 1440px and 390px. The shared `mockApi` fixture explicitly fulfills the source-defined anonymous `GET /api/public/services` request with a typed empty listing before its unchanged Bearer assertion for protected endpoints. The navigation test now verifies that public request’s `GET` method, `q=&page=1` query, HTTP 200 response, and absent Authorization header. It checks that `/` remains the public landing page, then directly opens `/dashboard` and retains the `/module` redirect and original sidebar, workspace-selector, responsive drawer, and overflow checks.

The same directly related suite exposed a stale accessible-name locator in an existing internal-role shell test. It searched for “Open account menu,” while `AccountMenu` sets `aria-label="Account menu"`; the locator was aligned to that exact source name without removing the click, logout, or token assertions.

Final focused browser outcomes: workspace-selector 22/22, anonymous/protected-route and expired-session selections 2/2, Dashboard 14/14. These commands overlap and do not change the 29 unique case count. The final case reconciliation is 28 PASS and 1 PARTIAL: A011-T002’s timer in-flight guard and cleanup are asserted, but actual transport abortion and late-response suppression are not independently observed. The 23-hypothesis assessment is 22/23 VERIFIED CONTROL within mapped assertions; ABUSE-018 retains this limitation. The existing real Next rewrite integration remains 1/1 from its prior execution because it uses a separate fixture and does not import the modified shared mock.

# PG-020 Test Implementation Report

Eight new declarations are implemented: five in dashboard/dashboard.spec.ts (badge A006-T002, encoded destination A008-T002, read-click A009-T002, bulk read A010-T002, refresh A011-T002), two in apps/api/tests/pg020-dashboard.test.ts (A005-T003 and A009-T003), one in dashboard/pg020-integration.spec.ts (A008-T003). Stable IDs match the approved specification.

Six additive groups extend existing declarations: A002-T001 heading/description; A004-T001 Escape/overlay; A005-T001 account entries/logout; A005-T002 request 2 plus project 3 unread count; A006-T001 disabled empty-feed action; A007-T003 exact API response keys. Existing titles and original expectations remain, with the authorized Account menu locator correction.

Test-only infrastructure: apps/api/tests/support/pg020-browser-server.ts and apps/web/playwright.pg020.config.ts. Production Next rewrite configuration is unchanged. The isolated upstream binds loopback 5274, forwards to an ephemeral real Express server and disposable migrated PGlite, and exposes synthetic fixture setup/snapshot data on a test-only control path. No production/customer data or external services.

Browser -> Next 5273 -> unchanged `/api/:path*` rewrite -> loopback fixture upstream 5274 -> Express -> Prisma -> PGlite. Real auth/me and notifications are observed upstream; browser response origins remain Next; private/foreign notice sentinels are absent; persisted notification snapshots remain equal. No page.route/route.fetch forwarding substitutes for the rewrite.

See [execution outcomes](PG-020_TEST_EXECUTION_RESULTS.md) for all 29 records. Fifteen existing-sufficient records retain their original declarations; two responsive records have failed prerequisites and remain unverified.

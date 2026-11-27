# PG-016 Gaps and Dependencies

Preview failures are swallowed by useWorkflowFilePreview; intended error/retry UX requires a contract before asserting it. Inline payment formatting trusts currency and date response fields; current valid API projection is the test contract. Billing has reload recovery, and no in-page retry requirement is invented. The “within 1 business day” copy is rendered text without a page-owned deadline calculator. No new time SLA test inferred.

Real integration needs an isolated fixture and synthetic billing/file seed with two clients, no prior payments and controlled approval/events/proof visibility. PGlite applies actual repository migrations, runs actual Prisma/Express and tears down after owned browser server closes. Store no live customer data. No row-lock requirement found, so PG-015 PostgreSQL success does not resolve earlier blockers or motivate extra PG-016 concurrency work. Browser request forwarding bypasses Next rewrite and must be reported transparently.

PG-004-D-001 remains open for its confirmed pages including PG-015, whose 44/45 result, two contracts and PostgreSQL passes stay unchanged in the cumulative ledger. PG-016 uses direct controls and Radix dialog rather than the affected row-action menu. Page-specific focus/responsive checks remain planned. Discovery establishes source behavior only.

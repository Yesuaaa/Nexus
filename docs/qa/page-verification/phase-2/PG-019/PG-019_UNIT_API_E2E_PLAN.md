# PG-019 Unit, API and E2E Plan

Phase 2.1 design only, 2026-11-26 (Asia/Singapore). No tests implemented or executed. All proposed outcomes remain NOT RUNTIME VERIFIED.

23 atoms;22 abuse hypotheses;46 unique cases =17 new +6 additive +23 existing-sufficient +0 contract-blocked. Primary layers Unit 2/API 21/Browser 22/Integration 1. API includes19 PGlite/catalog and 2 PostgreSQL records. New declarations API 8/Browser 8/Integration 1; additions API 2/Browser 4. The authoritative list is [test specification](PG-019_TEST_CASE_SPECIFICATION.md).

## Proposed bounded implementation (separate authorization required)

| Target                                                                                                         | Future work / preserved source                                                                                                                                                                                                                                                          | Real/mock boundary                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Existing Unit                                                                                                  | client-management-access.test.mjs two access records; route-policy/workspace helpers for compatibility. No artificial algorithm-copy test.                                                                                                                                              | Actual exported helpers, no API/DB                                                                                                  |
| Proposed apps/api/tests/pg019-clients.test.ts                                                                  | Six new PGlite declarations A001-T004, A011-T001, A015-T002, A021-T002, A022-T001 and A022-T003. Preserve client-integration and actor-attribution suites.                                                                                                                              | Real Express/session/Prisma, migrated offline PGlite                                                                                |
| Existing apps/api/tests/client-integration.test.ts                                                             | A005-T002 exact sort and A017-T002 cross-role/retired casefold conflict additions; keep every original assertion and setup.                                                                                                                                                             | Existing real Express/PGlite                                                                                                        |
| Proposed apps/api/tests/pg019-clients.postgres.ts                                                              | Two independent-connection cases A017-T003 and A020-T002; keep existing PGlite overlap assertion separately.                                                                                                                                                                            | Disposable owned loopback PostgreSQL with actual Express/Prisma                                                                     |
| Proposed apps/web/e2e/clients/pg019-regression.spec.ts                                                         | Eight new declarations A003-T002, A006-T003, A008-T001, A012-T001/T002/T003, A016-T003 and A022-T002.                                                                                                                                                                                   | Actual Next components, mocked account/API, controlled time/gates                                                                   |
| Existing browser declarations                                                                                  | A004-T001 NEX-027 adds Clear query/status/sort proof; A010-T001 shared related skeleton adds pre-tab/profile counters; A013-T001 NEX-012 adds keyboard/focus; A016-T001 NEX-029 adds idle keyboard password reveal/value retention and all busy close paths, including disabled reveal. | Original mocks/hooks and assertions retained                                                                                        |
| Proposed apps/web/e2e/clients/pg019-integration.spec.ts and directly necessary support/pg019-browser-server.ts | One A023-T001 actual form -> persisted USER/history -> list/detail/A/B related data -> forbidden callers and read-only snapshot. Adapt existing pg018-browser-server.ts, not production hooks.                                                                                          | Real Next page and forwarded real Express/session/Prisma/PGlite; account/preferences/shell mocked; production Next rewrite bypassed |

## Synthetic fixtures and assertions

Use active ADMIN/SUPERADMIN, ordinary STAFF, explicit Department Head (still STAFF), USER A/B, inactive/retired manager and retained/revoked sessions. Verify actual current DB role/status before negative assertions. The fixed server role catalog has no per-user permission editor. Existing read-only configuration runs an isolated child with --experimental-test-module-mocks; do not introduce a production grant-edit hook.

Seed a small directory (11 or23 rows as needed), tied/distinct sort fields, nullable names, active/inactive clients and internal/retired reserved emails. A/B related records need distinct IDs and counts. Include request-linked/no-start placeholders and legacy requestless/no-start projects. Directory project visibility differs from archival's all-linked-record checks. Dates explicit for Manila leap midnight. No date input/payment/file operation exists on this page.

Use finite named input matrices, valid boundary controls and no destructive probes. One body just over16KiB is sufficient for413. Safe literal/inert text needs no external provider, executable SQL or uncontrolled fuzzing. Compare exact safe response keys. Snapshot User/profile/role/passwordHash, AccountManagementChange, relevant sessions/refresh tokens and children around rejected writes. Snapshot after legitimate creation, before and after integration reads/denials. Exclude authentication lastActiveAt bookkeeping from domain-read equivalence. No new audit requirement for every read/denial is invented.

Keep existing 1280/390 expansions; new responsive cases 390/1440 with actual accessible roles and reduced motion. Do not multiply every case across widths. Assert old request started, new result accepted and old gate released afterward; use promises/finally and abort cleanup rather than arbitrary sleeps. Preserve each file's fixture contracts and shared hook registration. No skip/retry/timeouts/config exclusions added to conceal failures.

## PostgreSQL decision

**REQUIRED FOR APPROVED SCOPE** for the two proposed A017-T003/A020-T002 contention claims, conditional on later authorization. Source explicitly uses Serializable account writes, unique normalized email and conditional Trash/audit. PGlite supports validation, branch predicates, safe projections, serial duplicate/replay, session cascade and rollback; it does not prove independent PostgreSQL backends/SSI schedules.

Concurrent read/count snapshot behavior under external writers is OPTIONAL FUTURE WORK outside these46 records. Archive-versus-booking, optimistic edit versions, distributed rate budgets and stronger mid-flight privilege revocation are not inferred. No database provision/connection or concurrency execution occurred here. Later unavailable infrastructure must be reported environment-blocked, never silently skipped/passed.

### Prerequisites and isolation

Explicit PG019_POSTGRES_URL, protocol postgresql, host127.0.0.1, explicit task-owned port, exact database nexus_pg019_clients and dedicated owner pg019_clients_test. Reject other targets. Provision fresh disposable DB on an owned loopback cluster; apply actual migrations/client; verify database identity and zero existing domain rows before seeding. Never shared/dev/production. Pool supports at least two API transactions plus separate control/observer connections; real synthetic sessions issued before gates. Preserve production DB behavior/isolation.

### A017-T003 forced competing-create schedule

1. Seed two active management actors and a fixed normalized test email; capture domain/history baseline.
2. Disposable DB only: narrow BEFORE INSERT User trigger for that email acquires an advisory transaction lock held by a separate control session. This pauses real inserts after duplicate lookup, without production code changes.
3. Begin two actual POSTs with distinct sessions and padded/cased versions of the same email. Observe distinct backend PIDs/transactions at the insert gate after both duplicate checks. Bound observation; fail if overlap cannot be established.
4. Release control lock. Exactly one201 and one409 (P2002/P2034 mapping), no500. Persisted state: one normalized USER, valid hash, one CREATED history for the winning actor, no losing account/history or unrelated session revocation.
5. Finally remove trigger/function, release locks, close API/control/observer/DB clients and drop only the verified disposable DB/owned cluster resources. Check no task process remains.

### A020-T002 forced competing-archive schedule

1. Seed one unlinked USER with sessions/refresh rows and two Superadmins; baseline zero linked relations and history.
2. Disposable-only BEFORE UPDATE User trigger pauses first accountDeletedAt transition behind control gate. Start first DELETE and observe it at gate. Start second DELETE from independent backend; ensure parent/link reads occur before first commit and it waits on the conflicting row/transaction. Do not require two advisory waiters: row locking may prevent the second trigger from running.
3. Prove actual overlap through pg_stat_activity/pg_locks and known task application names/PIDs; bounded observation, not sleep alone. Release gate: exactly one204 and one409 under this forced Serializable overlap. Separate later replay404.
4. Persisted state: inactive+Trash, sessions/refresh gone, one truthful ARCHIVED row with winning actor and previous active state; no duplicate completion. Existing less-controlled PGlite assertion permits404/409 loser and remains unchanged. Finally teardown every gate/client/app/owned DB resource.

No automatic Serializable write replay is implemented; assert source conflict behavior. If the schedule cannot be proved, report a test/environment blocker rather than relax the expectation.

## Real page integration boundary

Reuse startPgliteApp lifecycle and a secret-protected test-only snapshot/control endpoint only where needed. Start through existing API fixture runner; synthetic handshake tokens never enter reports/traces. Forward only allowlisted /api/clients paths/methods to owned local Express using actual actor bearer. restoreSession mocks only account/preferences/shell; it does not authorize the real backend. Do not forward unrelated shell APIs. Verify persisted USER/hash/actual-actor history, correct A/B parent counts/rows and unchanged read/denial snapshots through control/backend evidence. Finally unroute, release gates, SIGTERM owned fixture, await exit and close resources.

Production Next /api rewrite is bypassed; no proxy/deployment/external-provider/downstream-page readiness claim. No discovered Client-specific proxy requirement justifies another case. Broader proxy acceptance would be separate authorization.

## Future focused commands (NOT EXECUTED)

- `pnpm --filter @nexus/web exec node --experimental-strip-types --test test/client-management-access.test.mjs`; select relevant role-route helper compatibility separately.
- `pnpm --filter @nexus/api test tests/client-integration.test.ts tests/features/clients/actor-attribution.test.ts tests/features/auth/client-create-permission.test.ts tests/pg019-clients.test.ts` after implementation. Existing catalog parent handles its child's experimental module-mock flag.
- `pnpm --filter @nexus/api test tests/pg019-clients.postgres.ts` only against verified disposable environment. Missing prerequisites must be explicit blocked evidence.
- `pnpm --filter @nexus/web exec playwright test e2e/clients e2e/client-create-permission.spec.ts --workers=1 --retries=0` with live=false and owned local build. Select only Client instances of shared/clients.spec.ts and shared/table-interactions.spec.ts by exact observed title filters; avoid unrelated /services and live-backend cases. Node parent-name matching can expand children (documented in PG-018); verify actual selection rather than claim leaf-only execution.
- Run actual-page integration separately if needed for lifecycle evidence. Report expanded counts and unique records separately, all failures/corrections/reruns honestly. Never full repository/Playwright/Attendance regression.
- Required quality gates: pnpm format / pnpm lint / pnpm typecheck / git diff --check. These are not case execution; no runtime command above is authorized in Phase 2.1.

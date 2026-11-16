# System Logs & Diagnostics — Phase 2A management readers

Developed: 2026-11-16. Status: internal backend foundation only, not exposed or deployed. Follow-up to the approved [Phase 1 contracts](system-logs-contracts.md) and [endpoint coverage inventory](system-logs-endpoint-coverage.md). Stop after Phase 2A; Phase 2B requires explicit instruction.

Follow-up: [Phase 2A.1 regression reconciliation](system-logs-backend-regression-reconciliation.md) investigates and corrects the two stale test contracts reported below. The results here preserve the original Phase 2A run; consult the follow-up for current regression validation. No Phase 2B implementation is introduced.

## Changed-file inventory

| File under `apps/api/`                                      | Responsibility                                                                                                   |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/features/system-logs/management-event.ts`              | Management specialization of NormalizedEventV1; closed source payload policies and normalization                 |
| `src/features/system-logs/management-query.ts`              | Bounded input validation, filter-bound signed cursor, ordering                                                   |
| `src/features/system-logs/management-history.repository.ts` | Source-specific explicit projections and parameterized Prisma read queries                                       |
| `src/features/system-logs/management-history.service.ts`    | Current-session Superadmin authorization, bounded merge, per-source gaps, page operation groups and detail reads |
| `tests/features/system-logs/management-history.test.ts`     | Offline normalization, policy, persistence, ordering, failure, read-only and performance tests                   |

Documentation: this report and the feature index. Phase 1 documents/index changes already present at task start are preserved. No app router registration, frontend code, writer, business transaction, permission catalog, schema, migration or configuration changed. No operational/security producer or new table was introduced.

## Adapter architecture and privacy

`listManagementHistory(auth, input)` is an internal service; `getManagementHistoryEvent(auth, source, nativeId, range)` provides bounded exact-ID detail reads. Neither is mounted. Every service call looks up the current session/account, including expiry, active/retired state and exact SUPERADMIN role. It never touches last-active bookkeeping or trusts the role from a stale caller object. Low-level repositories are persistence helpers for the authorized service, not public entry points.

Each source query uses the shared Prisma client through `readTransaction` (RepeatableRead and existing read-only retry policy). Parameterized `Prisma.sql` is needed for explicit `COLLATE "C"` ID order in SQL and continuation predicates; the merge uses the same byte order. SQL selects named columns only, with no actor/subject joins or dynamic identifiers. The typed select declarations describe the same read projections. There is no `$executeRaw`, mutation, source repair or new history write in the feature.

Normalization validates `unknown` with shared closed-object, transition and history payload validators. Read-side per-action policies mirror current writer policies without modifying or invoking writers. Unknown/sensitive fields invalidate the record; no unrestricted JSON fallback is returned. Approved field names remain, personal field values do not. Safe identifier/state transitions and approved cleanup cause/affected-account references survive; `sessionsRevoked` is projected separately. The normalized representation is capped at 16 KiB.

Source/native ID, historical actor/role, operation UUID, timestamp and subject IDs are retained. Deleted records require no live join and remain identifiable by preserved scalar IDs. Missing historical role/actor values can normalize to unknown without current-role inference; current management schema columns are non-null, so these cases are defensive normalization tests rather than claimed production rows. Unsupported or invalid role values are omitted. No live name enrichment or email fallback exists. HTTP/trace/workflow-action correlation remains null; ingestion time is not fabricated.

## Supported queries and pagination

- Category `audit`, area `module`, either management source, and primary module `administration`, `people-hr` or `service-operations`. Registry IDs/types come from the existing JSON registry; unsupported areas/modules/sources return a generic validation error.
- Exact actor ID, subject ID/type, operation UUID, native action and approved normalized event name. Source/subject/action conflicts are rejected. Module mapping follows Phase 1 origins; related modules are references, not additional copies or primary-filter matches.
- Canonical UTC ISO timestamps, inclusive `from`/`to`, default previous seven days, maximum interval 31 days. Internal `pageSize` is a number: default 50, range 1–100. No HTTP string coercion is implemented because there is no route yet.
- Ordering: occurrence descending, source ascending, native ID descending in byte order. Cursors are versioned, bounded, HMAC-authenticated with a domain-separated message using the existing JWT key, expire after 24 hours, and bind normalized filters, enabled sources, current reader/session, date defaults, page size and snapshot boundary. No new secret/configuration is introduced. Key rotation invalidates outstanding cursors; replicas sharing the existing key can validate them.
- At most 501 rows fetched per source, 500 candidates scanned per source; the extra row establishes continuation. The merge never advances beyond an unread source frontier. Malformed-only windows can return an empty page with a continuation and explicit scan-cap/omission metadata.
- Invalid rows are omitted with safe reason/count metadata. Source errors are generic and independent; auth-store failure rejects the read with 503. A partial source failure disables continuation so retrying the same input cannot silently skip recovered events. Consumers must replace/retry a partial page, not append it as complete history.
- `complete` describes coverage of the returned page, not exhaustion of all history. `nextCursor` independently indicates continuation. Invalid source rows or exhausted scan windows make coverage incomplete; ordinary full pages are complete even when later rows remain.
- Operation grouping references event IDs already in the page. `grouping.scope` is `page`; `eventCount` and `operationCount` are distinct. A single operation may span pages or source/module filters. There are no misleading global event/operation totals or operation-completeness claims. Exact operation filtering traverses the same bounded pagination.

Timestamp snapshots do not establish cross-page transaction isolation: late commits/backdated inserts can alter later pages, as specified in Phase 1. A source row with a native ID beyond the approved 100-character identity/cursor limit is omitted; if it is the continuation boundary, no valid cursor can be returned. The incomplete metadata remains explicit; no automatic repair is attempted. Row caps and response byte validation do not bound database-side sort work or the size of legacy JSON transferred before validation.

## Validation and performance

The focused suite uses `tests/support/pglite-app.ts`, real Prisma reads and offline PGlite migrations only. The new fixture explicitly selects UTC: the local socket/driver path otherwise showed a timezone interpretation mismatch between raw SQL fixture inserts and Prisma timestamps. No shared test harness or application timezone configuration was changed.

Coverage includes schema/redaction, historical/deleted/unknown identities, cross-source tied timestamps, mixed-case IDs, cursor tampering/expiry/filter/session binding, current role/status/session denial, temporal boundaries, filters and invalid inputs, exact detail lookup, page grouping without duplicate IDs, empty/malformed/unavailable sources and malformed-only scan-cap continuation. The fixture installs write-rejection triggers on every public table before final list/detail/performance reads; these assertions also require sources to stay available, so caught mutation errors cannot masquerade as a successful read.

The representative fixture contains 10,003 rows per table (20,006 combined), spread across 20 days, 20 actors and 100 subjects, with repeated timestamps and a deliberately high-fanout operation. Five end-to-end reads per query include authorization, both source queries and normalization. This is an offline scale sample, not production latency certification. The smoke budget is 5 seconds per read; actual measurements and final validation outcomes follow below.

An EXPLAIN ANALYZE/BUFFERS sample of the account global date/order query used a sequential scan and top-N heapsort over 10,003 rows (about 184 buffer hits, 77 KiB sort memory in the focused run). It demonstrates remaining global-sort cost, not a justified index specification. No index was introduced. Production collation, volumes, latency budget and query plans require independent review before exposure.

## Remaining risks and Phase 2B prerequisites

1. Explicitly authorize Phase 2B before mounting any API or building UI. Add route/DTO parsing and no-store behavior using existing middleware/client patterns; do not expose low-level repositories.
2. Verify deployed runtime/browser grants, RLS and append-only protections. Management history currently lacks the migration-level protections found in other sources; no production permissions were assumed or changed here.
3. Establish durable logs-access evidence before sensitive production reads. This internal slice intentionally has no access emitter or operational/security collection.
4. Review measured global sort cost and production query budget. Any index/schema change requires separate justification and authorization. Bounded result scans do not promise bounded physical scans.
5. Keep reader and writer policies synchronized with behavioral tests when writer contracts evolve. Existing writers and the original 26-endpoint coverage remain unchanged.
6. Decide route behavior for partial pages, scan caps, exact detail not-found versus malformed source data, and operator-visible gap messages without leaking raw errors. Group counts must retain their page-scoped labels.
7. Perform authorized API denial/privacy and UI validation in Phase 2B. Existing unrelated regression failures, if any, must be reported separately rather than weakening authorization or changing those tests incidentally.

## Executed validation results

Measured end-to-end milliseconds (five reads/query in the final focused-plus-baseline diagnostic run):

| Query                 | Minimum | Median | Maximum |
| --------------------- | ------: | -----: | ------: |
| Global                |   40.00 |  45.99 |   58.99 |
| Actor                 |   27.44 |  32.05 |   46.64 |
| Subject               |   10.16 |  11.95 |   13.86 |
| High-fanout operation |   40.97 |  42.32 |   58.99 |

The ordering-plan sample executed in about 12.7 ms. Timing varies with local load; these observations do not justify an index change or production SLA.

`pnpm test:api` executed 421 tests: 419 passed, two failed on untouched existing paths. The original management-attribution suites and the new reader suite passed. Failures:

- `apps/api/tests/admin-project-workspace-details.test.ts`: existing test expects 404 for an Admin out-of-scope detail request; current authorization returns 403. Reproduced when selected alongside the new suite (10 new tests pass, this test fails). No permission or expectation was changed.
- `apps/api/tests/service-specialists.test.ts`: expected status enum excludes the existing `ACTIVATED` and `CONCLUDED` values. This test fails before its endpoint assertions. No schema, enum or test expectation was changed.

The feature is unmounted and these existing tests do not import it; their application/test/schema files have no task diff. The full backend gate is therefore **not green**; no claim is made that all existing behavior is regression-certified. Non-fatal pg concurrent-query deprecation warnings also appear in existing suites.

| Validation                                            | Result                                                    |
| ----------------------------------------------------- | --------------------------------------------------------- |
| `pnpm format`                                         | PASS, exit 0; scope inspected                             |
| `pnpm lint`                                           | PASS, exit 0                                              |
| `pnpm typecheck`                                      | PASS, exit 0, API and web                                 |
| `pnpm build`                                          | PASS, exit 0, API and web                                 |
| Standalone focused management-reader suite            | PASS, 10 tests, exit 0                                    |
| Full `pnpm test:api`                                  | FAIL, 419/421 pass; the two untouched-path failures above |
| Selected new suite plus existing project-details test | 10 pass, one existing failure; exit 1                     |

A standalone focused run under additional local load measured 44.90–76.94 ms global, 40.03–55.95 ms actor, 14.60–15.54 ms subject and 46.14–79.78 ms operation, illustrating timing variability. The suite's write-denial checks passed.

No browser/web unit tests were run for this backend-only, unexposed slice. No live database, seed, backfill, production privilege inspection or deployment was performed. Full backend success remains a separate unresolved validation limitation; Phase 2B has not begun.

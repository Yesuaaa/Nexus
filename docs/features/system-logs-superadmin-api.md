# System Logs & Diagnostics — Phase 2B Superadmin API

Developed: 2026-11-16. Status: backend endpoints implemented for controlled offline validation; **production exposure remains disabled**. No frontend, collection, emitters, schema or migration work. Follow-ups: [Phase 1 policies](system-logs-contracts.md), [Phase 2A readers](system-logs-management-read-adapters.md), [Phase 2A.1 passing regression baseline](system-logs-backend-regression-reconciliation.md).

## Routes and response contracts

All paths below are relative to `/api/system-logs`. They return JSON and `Cache-Control: no-store`, including denials and disabled responses. GET endpoints also inherit Express's authenticated HEAD behavior. No mutation methods exist; unsupported methods/paths return a safe 404 after the relevant gate/auth checks.

| GET route                                     | Query parameters                                                                                                                                          | Response                                                                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/management-history`                         | `category`, `area`, `moduleId`, `source`, `eventName`, `action`, `actorId`, `subjectType`, `subjectId`, `operationId`, `from`, `to`, `pageSize`, `cursor` | Existing Phase 2A paginated normalized envelope                                                                          |
| `/management-history/events/:source/:eventId` | `from`, `to` only                                                                                                                                         | `{ schemaVersion: 1, event, status, reasonCode }`; event identity is source plus native ID                               |
| `/management-history/operations/:operationId` | Same as list except `operationId` is path-only                                                                                                            | Existing page envelope plus canonical lowercase `operationId`; uses the same list service with an exact operation filter |

Only the two management sources are supported: `audit.account-management`, `audit.workforce-management`. Module IDs and mapping remain the Phase 2A registry-derived mapping. No attendance, workflow, private messages, files, operational or security records are added.

HTTP query parsing accepts scalar strings only; repeated parameters, arrays/bracket keys, unknown keys, malformed page sizes and unsupported filters fail with 400. Page size is a plain positive decimal (default 50, maximum 100). Canonical UTC ranges use the existing inclusive endpoints, default last seven days, maximum 31 days. Path operation IDs must be UUIDs; duplicate/query operation IDs on the operation route are rejected. A small shared-validator addition rejects impossible subject/action pairs such as Team + ROLE_CHANGED. Source/event/action conflicts and signed-cursor tampering are rejected by existing service validation.

The list envelope preserves `schemaVersion`, `events`, `nextCursor`, `snapshotBoundary`, `sources`, `complete` and `grouping`. `grouping.scope` is always `page`; its event count and distinct operation count are separate. Operation investigation does not fetch an unbounded operation or assert globally complete groups. Top-level `complete` concerns returned-page coverage, not operation completeness or historical coverage. Cursors remain HMAC-signed, bound to filters, dates, sources, page size, actor/session and snapshot, with the existing expiry and key-rotation behavior.

| Situation                                                | HTTP / body behavior                                                                                                                    |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Activation disabled, including production                | 404 `{ "error": "Not found" }`; no auth/history query                                                                                   |
| Missing/invalid/revoked/inactive/retired/expired session | Existing safe auth response, 401; current-role denial is 403                                                                            |
| Invalid or conflicting query/path/cursor                 | 400 generic error, no rejected values                                                                                                   |
| Valid empty list/operation window                        | 200 empty page, page counts zero; no claim that the operation never existed                                                             |
| Partial source outage                                    | 200 page with explicit unavailable source, `complete: false`, no continuation; retry the same page rather than appending partial output |
| All requested sources unavailable                        | 503, same page metadata retained plus generic error                                                                                     |
| Invalid source rows / exhausted scan window              | 200 with existing omission/SCAN_CAP metadata; an empty scan-capped page can carry a continuation                                        |
| Detail missing within valid date window                  | 404 with `event: null`, available status and generic not-found error                                                                    |
| Detail malformed                                         | 503 with `event: null`, available source status, `INVALID_RECORD`, generic unavailable error                                            |
| Detail source unavailable                                | 503 with `event: null`, unavailable status, `SOURCE_UNAVAILABLE`, generic unavailable error                                             |
| Unexpected failure                                       | 500 generic error; no exception/cause/database details                                                                                  |

The router is mounted before the development error decorator and JSON-body parser. Its local error boundary uses the shared HttpError type but fixed public messages, and never forwards arbitrary causes to development response enrichment. Thus development responses cannot acquire source paths, stacks or raw diagnostic details. Existing routes retain their middleware ordering and behavior.

## Authorization, offline activation and production lock

The controller uses existing `requireAuth` plus exact `requireRole(SUPERADMIN)` before query/resource validation. Existing services independently re-read the current session/account and enforce current Superadmin status again. No permission catalog, token policy, self-management rule, writer or source response projection is widened. Denied roles receive generic errors even for invalid filters, avoiding resource lookup by ordinary roles.

Production activation is deliberately **not implemented**. The router denies access when constructed in production and when any request runs in production. A router constructed in production stays closed even if NODE_ENV later changes. Normal `startApi()` supplies no activation callback, so normal development/default apps also stay closed. No `SYSTEM_LOGS_ENABLED` or equivalent deployment flag is read; such a flag alone cannot open access or prove prerequisites.

Controlled activation requires all of:

1. Explicit server-side `createApp({ systemLogsOfflineFixture })` composition, never an HTTP header/query/body value.
2. Native Node test-worker context (`NODE_TEST_CONTEXT=child-v8`) at construction and request time, with non-production NODE_ENV at both times. This environment marker alone never enables anything.
3. A fixture verifier returning true on each request. The test-only `tests/support/system-logs-app.ts` owns an actual open PGlite instance, its Prisma client and local socket URL; it verifies instance/client ownership, unchanged target URL and no DIRECT_URL override. Failures/exceptions close the route.

The verifier is a trusted test-composition seam, not evidence of production database protection or durable audit delivery. Production source imports no PGlite test helper. A developer able to replace trusted server code is outside the HTTP authorization boundary; no user-facing configuration can supply this function. Replacing this seam with a production activator requires separately reviewed work, not changing an environment value.

There is no logs-access emitter in this phase. Offline fixture reads are an explicit validation-only exception; they must not be presented as production access-audited reads. The existing required fail-closed access-evidence policy remains a production rollout blocker.

## Changed files

| File                                                              | Change                                                                                                    |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `apps/api/src/app.ts`                                             | Mount the gated router before development error decoration; optional test-composition callback            |
| `apps/api/src/features/system-logs/system-logs.controller.ts`     | New read-only routes, HTTP DTO validation, exact role middleware, activation and safe error boundary      |
| `apps/api/src/features/system-logs/management-query.ts`           | Reject contradictory subject/action pairs; reuse remaining existing validation/cursor logic               |
| `apps/api/src/features/system-logs/management-history.service.ts` | Detail range type permits omitted bounds so the existing seven-day defaults apply; update API-use comment |
| `apps/api/tests/support/system-logs-app.ts`                       | Dedicated offline fixture/activation composition; shared harness unchanged                                |
| `apps/api/tests/features/system-logs/system-logs-api.test.ts`     | Real offline API security, contract, source-failure, production-lock and write-denial tests               |
| Documentation                                                     | This report, feature index and RBAC reference; preserve earlier phase records                             |

Existing Phase 1/2A/2A.1 uncommitted changes are preserved. History writers, normalization policies, persistence queries, business mutations, generated schema definitions, migrations, frontend and production bootstrap are unchanged. The normalizer still returns only closed, minimized management projections; deleted IDs and recorded historical roles are preserved without current-name/role inference.

## Validation and regression baseline

The baseline is Phase 2A.1's 425 passing backend tests. Focused reader/API validation passes 21 tests (the original ten reader tests plus eleven API tests), with no skipped assertions. API cases cover all roles and endpoints, invalid tokens, current demotion/inactivity/retirement/expiry/revocation, filter pollution/conflicts, ordering/cursors, cross-session binding, source-aware details, page counts, operation filters, malformed data, source outage and scan-cap continuation. Production/default apps remain disabled even with an enable-like flag; a router constructed in production remains disabled after an environment-mode change.

The tests install write-denial triggers on all public tables except Session before final API reads. Existing auth session bookkeeping is allowed; domain/history mutations or inserted access records would fail the tests. Offline fixtures use UTC to preserve the established PGlite/socket timestamp test contract. Tests do not inspect or mutate a live database.

| Executed check                      | Result                                           |
| ----------------------------------- | ------------------------------------------------ |
| Focused readers + API suites        | PASS, 21 tests, exit 0                           |
| Full `pnpm test:api`                | PASS, 436/436 tests, zero failures/skips, exit 0 |
| `pnpm format`                       | PASS, exit 0; scope inspected                    |
| `pnpm lint`                         | PASS, zero warnings, exit 0                      |
| `pnpm typecheck`                    | PASS, API and web, exit 0                        |
| `pnpm build`                        | PASS, API and web production build, exit 0       |
| Report links and `git diff --check` | PASS                                             |

The 436-test total is the unchanged 425-test baseline plus eleven new API tests. No baseline assertions were weakened or skipped and no new backend regression remains. Initial lint identified the required but unused fourth Express error-handler parameter; it is now explicitly retained and consumed to preserve error middleware recognition without forwarding to development decorators. Existing non-fatal pg concurrent-query deprecation warnings remain unrelated to the new routes.

No browser/web unit tests, production privilege inspection, deployment, live database access, seed or backfill was run for this backend-only phase.

## Remaining deployment blockers and Phase 2C prerequisites

- **No production access:** there is no production activation path. Keep the gate closed; do not advertise NODE_ENV or a flag as an approval/attestation mechanism.
- **Durable access evidence:** select, implement and verify acknowledged durable logs-access evidence and outage behavior, including the approved fail-closed read policy. This phase neither creates that infrastructure nor claims it exists.
- **Database protection:** verify actual runtime/browser/migration privileges, RLS/bypass behavior, append-only protections and retained-history lifecycle. No production permissions were inspected or assumed. Any needed migration requires separate authorization.
- **Performance and lifecycle:** Phase 2A's bounded scans, physical global-sort costs, malformed boundary limitations, late-commit consistency limits and provisional retention decisions remain. No index or retention change is introduced here.
- **Phase 2C authorization:** explicitly authorize UI work before beginning it. Reuse the existing authenticated same-origin client, Superadmin route/navigation policy, safe table/detail patterns and accessible loading/error states. Treat `grouping.scope=page`, gap metadata and retry-without-append behavior as UI contracts. Keep a test-only preview gated and do not enable production exposure incidentally while building UI.

Stop after Phase 2B. Production activation and Phase 2C are not authorized by completion of this report.

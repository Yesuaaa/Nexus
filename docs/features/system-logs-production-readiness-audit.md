# System Logs production readiness and infrastructure audit (Phase 2D.0)

Audited: 2026-11-16

**Readiness verdict: keep production access disabled.** The repository implements a deliberately offline-only viewer, not a production activation mechanism. Its authorization and read adapters are useful foundations, but durable logs-access evidence, deployed database protections, real browser-to-Express validation, and deployment-scale performance evidence remain release prerequisites.

This is a repository audit and implementation proposal, not an infrastructure attestation or release approval. No production connection, permission inspection, cloud control-plane inspection, database change, application change, or activation occurred. Existing uncommitted implementation work was included as the current working-tree baseline; its presence does not prove that it is committed or deployed.

## Evidence and scope

- **Verified:** behavior or configuration directly inspected in repository files. This does not establish deployed state.
- **Missing in repository:** no implementation/configuration found in the inspected sources and deployment manifests. An external deployment could supply it; that remains unverified.
- **Unavailable evidence:** information requiring authorized deployment access or an operator-supplied, sanitized artifact.
- **Recommendation:** future work, requiring its own phase authorization. Proposed operational policy is not an implemented control.

The [Phase 1 contracts](system-logs-contracts.md), [endpoint coverage matrix](system-logs-endpoint-coverage.md), [Phase 2A adapters](system-logs-management-read-adapters.md), [regression reconciliation](system-logs-backend-regression-reconciliation.md), [Phase 2B API](system-logs-superadmin-api.md), [Phase 2C UI](system-logs-superadmin-ui.md), and [Phase 2C.1 Shared navigation](system-logs-shared-navigation.md) remain the governing scope. No additional history source or Phase 3 collection is proposed for implementation in this audit.

| Inspected evidence                                                                                                                                                                                                                                                                                                                                                             | What it establishes                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| [Controller](../../apps/api/src/features/system-logs/system-logs.controller.ts), [service](../../apps/api/src/features/system-logs/management-history.service.ts), [repository](../../apps/api/src/features/system-logs/management-history.repository.ts)                                                                                                                      | Activation lock, endpoint behavior, current-account checks, query and pagination implementation                  |
| [Event normalizer](../../apps/api/src/features/system-logs/management-event.ts), [query/cursor contract](../../apps/api/src/features/system-logs/management-query.ts), [shared history validation](../../apps/api/src/shared/management-history.ts)                                                                                                                            | Projection, privacy checks, source identity, bounded inputs and signed cursors                                   |
| [App composition](../../apps/api/src/app.ts), [authentication middleware](../../apps/api/src/features/auth/auth.middleware.ts), [database reads](../../apps/api/src/lib/database-read.ts), [database client](../../apps/api/src/lib/db.ts)                                                                                                                                     | Middleware ordering, live session checks, transaction/retry and shared connection behavior                       |
| [Prisma schema](../../apps/api/prisma/schema.prisma), [management migration](../../apps/api/prisma/migrations/20261115030000_management_attribution/migration.sql), all migration references to both management tables                                                                                                                                                         | Existing tables, indexes and absence of management-specific immutable guards/grants/RLS in checked-in migrations |
| [Workflow migration](../../apps/api/prisma/migrations/20261031010000_request_workflow/migration.sql), [attendance migration](../../apps/api/prisma/migrations/20261113150000_attendance_foundation/migration.sql)                                                                                                                                                              | Existing protection patterns in other domains; these do not automatically protect management history             |
| [Dockerfile](../../Dockerfile), [production Compose](../../compose.prod.yaml), [development Compose](../../compose.yaml), [CI](../../.github/workflows/ci.yml), environment templates, [Prisma configuration](../../apps/api/prisma.config.ts)                                                                                                                                 | Supported repository deployment topology and configuration conventions, not the actual hosting provider          |
| [Frontend client](../../apps/web/src/features/system-logs/api/system-logs-api.ts), [page](../../apps/web/src/features/system-logs/pages/system-logs-page.tsx), [model](../../apps/web/src/features/system-logs/model/management-history.ts), [route policy](../../apps/web/src/features/workspaces/model/route-policy.ts), [Next configuration](../../apps/web/next.config.ts) | Same-origin integration, Shared navigation, module coverage and unavailable state                                |
| [API tests](../../apps/api/tests/features/system-logs/system-logs-api.test.ts), [reader tests](../../apps/api/tests/features/system-logs/management-history.test.ts), [offline fixture](../../apps/api/tests/support/system-logs-app.ts), [PGlite harness](../../apps/api/tests/support/pglite-app.ts), [runner](../../apps/api/scripts/run-tests.mjs)                         | Existing offline behavioral and performance coverage; test activation proof                                      |
| [System Logs browser spec](../../apps/web/e2e/system-logs.spec.ts), [attendance browser precedent](../../apps/web/e2e/attendance.spec.ts), [Playwright configuration](../../apps/web/playwright.config.ts)                                                                                                                                                                     | Mocked System Logs browser coverage and an existing real offline API testing pattern                             |

Searches covered grants, policies, RLS, history-table references, collectors, queues, storage clients, deployment manifests, console/error handling and relevant tests. Actual `.env` values, production credentials, remote databases and running cloud/container configuration were not inspected. Absence from these sources is not proof of absence from the hosting environment.

## 1. Existing API and UI controls

### Activation and authorization — verified

The three read endpoints are mounted under `/api/system-logs`:

- `GET /management-history`
- `GET /management-history/events/:source/:eventId`
- `GET /management-history/operations/:operationId`

The router captures an offline-test latch at construction and rechecks it on each request. Access requires non-production `NODE_ENV`, native Node test-worker context `NODE_TEST_CONTEXT=child-v8`, and a trusted server-composition callback returning true. Callback errors deny access. A router constructed in production cannot later open by changing the environment. Normal `startApi()` supplies no callback, so ordinary development and production applications both return a generic 404. There is no `SYSTEM_LOGS_ENABLED` activation flag. A future environment flag alone cannot prove any release prerequisite.

When the offline gate is open, shared middleware verifies the signed Bearer token and current database session, matching account, expiry, active status and non-retired status, then requires the current `SUPERADMIN` role. The service independently rechecks the current session/account before each reader operation. JWT role claims and historical actor roles do not grant access. Session deletion, demotion and deactivation affect subsequent requests without waiting for access-token expiry.

The middleware can update an old session's `lastActiveAt`; that is existing authentication bookkeeping, not a history mutation. Reader transactions themselves perform no writes. Authorization and the two source reads use separate transactions, so a revocation during an already running request is not an atomic revocation-before-disclosure guarantee. The future release contract must explicitly address that interval, particularly when waiting for durable evidence acknowledgement.

Every route uses `Cache-Control: no-store`, including disabled and error responses. The router precedes the development error decorator and general body parser and has a fixed-message error boundary. Unexpected database details and stack traces are not serialized by it. Existing CORS and security headers also apply. Express can service HEAD through GET handlers; future access-evidence and authorization tests must include HEAD rather than assuming only visibly declared GET handlers can read.

### Read behavior and privacy — verified

Only `audit.account-management` and `audit.workforce-management` are supported, reading `AccountManagementChange` and `WorkforceManagementChange`. No generic history copy, access-evidence emitter or operational/security collector exists in this feature.

The repository parameterizes SQL and selects explicit history columns, with no live actor/subject enrichment or domain joins. The normalizer validates action-specific allowlists before returning safe transitions and historical identifiers. Historical role evidence is retained according to the contract; it is not reconstructed from today's role. Malformed records are omitted or rejected safely. Deleted actors/subjects do not require recreating or joining their records. The underlying `changes` JSON is fetched for validation inside the API, but is never an unrestricted API response.

The HTTP parser rejects unknown/repeated/structured query parameters. The service validates module/source/action/subject conflicts, IDs, canonical UTC ranges, pagination and signed cursors. Default range is seven days, maximum interval 31 days; default page size is 50 and maximum 100. These are query limits, not retention policies. Event detail also uses a bounded date window: a 404 outside that window is not proof that an event never existed.

Partial source failure returns explicit source metadata and prevents continuation; all requested sources unavailable produces 503. Invalid records expose safe reason/count metadata. Scan caps remain explicit. Event counts and operation counts are separate, and `grouping.scope` is always `page`; neither list nor operation investigation promises globally complete groups. Consumers retry a partial page from the same input and replace its results.

### Frontend integration — verified

`/system-logs` is the single shared page, not an Administration-owned duplicate. Shared navigation displays `System Logs (Unavailable)` only for an active, non-retired Superadmin and retains authorized workspace context. The initial module filter derives from the originating workspace; manual filters persist through the page's details and operation investigation/back interactions. Page-local investigation state is not a cross-reload saved investigation.

The client uses the standard authenticated same-origin `/api/...` path and sessionStorage tokens. There is no frontend activation switch. Administration and People & HR have scoped management coverage; Service Operations has partial client-account coverage. Other registry modules are visibly not integrated. All Modules means the two supported sources, not complete application history. Backend checks remain authoritative.

The UI uses safe parsed fields and text rendering. The shared network error object may retain response information internally, so future telemetry must not serialize whole errors, API responses or causes. Existing System Logs Playwright tests use isolated response fixtures; they do not establish browser-to-Express integration.

## 2. Database security and history immutability

### Repository assessment

| Control                          | Verified state                                                                                                                                                       | Release implication                                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Domain transaction attribution   | Existing writers append required management records within business transactions, as documented/tested in earlier phases                                             | Preserve writers, rollback semantics and the original 26-endpoint workforce attribution reconciliation                              |
| Historical identity preservation | Both management tables store scalar actor, historical role, operation and subject identities without foreign keys to live accounts/subjects                          | Deleted records remain investigable; do not retrofit deletion-cascading joins or constraints casually                               |
| Immutable database guards        | Management migration creates enums, tables and indexes; no rejecting UPDATE/DELETE/TRUNCATE guards were found for these tables in migrations                         | Application append behavior is not database immutability                                                                            |
| Management grants/RLS            | No explicit management-table browser-role revocations, RLS enablement or policies found in migrations                                                                | Actual direct-access exposure cannot be determined from repository evidence                                                         |
| Existing protection precedents   | Workflow migration enables RLS and conditionally revokes browser roles on its listed tables; workflow and attendance histories have UPDATE/DELETE rejection triggers | Reuse reviewed patterns where suitable; these controls are table-specific and do not establish TRUNCATE or administrator resistance |
| Runtime credential separation    | Shared Prisma uses `DATABASE_URL`, falling back to `DIRECT_URL`; Prisma CLI uses `DIRECT_URL`                                                                        | Separate runtime and migration principals are a convention, not an enforced deployed fact                                           |
| Read-only enforcement            | Reader SQL is SELECT-only; shared helper opens RepeatableRead transactions without an explicit database READ ONLY command                                            | Application tests prove behavior, not denied write privileges of the deployed principal                                             |
| Retention                        | No management-history TTL/purge found                                                                                                                                | Preserve source lifecycle; do not invent expiry or silently prune records                                                           |

Each management table has a primary key and three secondary indexes. Account history has `(subjectAccountId, createdAt, id)`, `(actorAccountId, createdAt, id)` and `(operationId)`. Workforce history has `(subjectType, subjectId, createdAt, id)`, `(actorAccountId, createdAt, id)` and `(operationId)`. No leading global timestamp index or explicit C-collation ordering index is present in the defining migration.

### Required deployment evidence — unavailable

An authorized operator must provide sanitized catalog/grant evidence and test results for the actual target database, including:

1. Migration status and management-table definitions, indexes, trigger definitions and enabled state; PostgreSQL version, collation and pooler behavior.
2. Effective runtime, migration, owner, browser-facing (`anon`/`authenticated` if present), PUBLIC and service-role grants; role memberships, inheritance, schema usage/default privileges, ownership, superuser/BYPASSRLS status and any callable privileged functions.
3. RLS enabled/forced flags and effective policies for each relevant role. RLS does not inherently know the API's application `Role` enum, and this reader does not establish a per-request database identity through SET ROLE or JWT claims.
4. Whether the tables are exposed through a direct database REST interface, views, functions, replication/publications, administrative tools or other credentials; verify denial of browser reads and writes directly, independently of Express.
5. Backup/restore, replication, retention, administrator access and change-auditing arrangements; credential rotation and emergency-access ownership.

Do not publish connection strings, role passwords or sensitive row contents as proof. Catalog exports should be minimized and restricted. This audit did not execute any of these remote checks.

### Recommended target protections

- Give the ordinary API runtime the SELECT and INSERT capabilities needed by existing readers/writers on these tables, with no ordinary UPDATE, DELETE, TRUNCATE, ownership, trigger-disabling or schema-altering authority. Preserve all other established business permissions; changing the shared runtime principal requires a regression-tested privilege matrix.
- Separate privileged migration/maintenance credentials from runtime and browser credentials. A dedicated reader principal can provide defense in depth if deployment evidence justifies the extra pool and configuration; it is not required by the current architecture or assumed to exist.
- Implement appropriate browser-role revocations and RLS/policies only after validating the actual deployment model. Blindly enabling RLS without policies could break required inserts/reads. Revocation from one role is insufficient if PUBLIC, membership, views or privileged functions restore access.
- Add management-specific rejection guards for ordinary destructive changes where justified. Address TRUNCATE privileges/statement triggers separately from UPDATE/DELETE row triggers. Keep retention maintenance separate; never disable immutable guards as an ordinary viewer operation.
- Validate unchanged business write/rollback behavior and deletion semantics. Inserting new history is still possible for a compromised writer principal; append-only protections do not authenticate every inserted value or resist a database owner. Stronger tamper evidence would require separately governed external evidence/archive controls.

No migration, grant, policy, index or permission change is authorized or performed in Phase 2D.0. Any hardening migration and deployment permission work require explicit subsequent authorization.

## 3. Infrastructure, deployment and available logging

### Verified repository topology

The multi-stage Dockerfile uses Node 24, separate API/web builds and non-root runtime users. The API image runs compiled Express with `NODE_ENV=production`; the web image runs the Next standalone server. Production Compose declares only `api` and `web`: web is published on a configurable host port (default 8080), proxies to internal API port 3001, and waits for API database readiness. It does not publish the API port in that manifest. Development Compose is a separate, more exposed development topology.

The web build embeds server-only `API_PROXY_TARGET=http://api:3001` and leaves `NEXT_PUBLIC_API_URL` empty. Next rewrites `/api/...` to Express; default local target is port 3001. Changing the target for an integration build must happen at build time, rather than assuming a later environment change alters the standalone artifact.

Production Compose requires a database URL and JWT secret and configures optional Supabase, web-origin and trusted-proxy settings. The API validates production PostgreSQL URL syntax and the signing key, not effective privileges. The runtime pool defaults to 10 connections with a five-second connection timeout. For recognized Supabase hostname suffixes, the database client enforces certificate validation with bundled/system/extra and repository CA roots. Generic PostgreSQL URLs use their connection configuration; universal verified TLS cannot be inferred for every possible deployment.

The API environment template describes Supabase transaction pooling for runtime and a separate direct/session connection for migrations. Its example usernames are not evidence of a restricted deployed runtime role. Compose supplies no migration job; the runtime image starts the API rather than applying migrations. Repository deployment instructions and the CLI configuration are not proof that deployed migrations are current. Actual hosting could differ from Compose; README hosting suggestions are not an inventory of deployed providers.

The Compose API health check uses `/api/ready`, which tests database connectivity, not grants, immutable guards or durable evidence delivery. Restart policy is `unless-stopped`; stop grace is 20 seconds. Shared API shutdown defaults to 12 seconds request drain, one second forced-close wait, three seconds resource cleanup and an 18-second hard deadline. It currently cleans up realtime/database resources, not an access-evidence spool.

Checked-in CI runs formatting, lint, typecheck/build, secret scanning and dependency scanning. It does not run backend/unit/Playwright suites or provision/deploy migrations/infrastructure. Release regression and integration evidence must therefore be added deliberately in a later phase or provided by another verified release workflow.

### Logging/storage inventory

| Mechanism                                                              | Verified repository use                                                                                                                   | Suitability for durable logs-access evidence                                                                         |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Process stdout/stderr and `console`                                    | Startup/shutdown, health/background failures and shared error reporting                                                                   | No acknowledgement, rotation, persistence or retention guarantee established                                         |
| Docker logging                                                         | Normal container output is possible; no explicit collector, logging driver/rotation policy or persistent log volume in production Compose | Host defaults and hosted forwarding are unknown; stdout success is not durable acceptance                            |
| Supabase image storage                                                 | Server-side service-image helper creates/reconciles a public image bucket and serves public URLs                                          | Unsuitable as configured; do not reuse a public image bucket or its access policy for security records               |
| Supabase Realtime / in-process SSE                                     | Private invalidation delivery and live connections                                                                                        | Not an acknowledged durable audit queue or recovery archive                                                          |
| Application PostgreSQL                                                 | Authoritative domain history; other domain file/storage data also exist                                                                   | Preserve source records; same-DB outbox/table alone does not survive its outage or meet independence requirements    |
| Collector, durable queue, independent security store, persistent spool | No such integration or service definition found in inspected API dependencies/source, Compose or CI                                       | Must first verify whether hosting already supplies a suitable service; otherwise choose and separately authorize one |

There is no repository evidence for a durable logs-access emitter, receipt protocol, backpressure/replay, archive retention, legal holds or access-sink readiness monitoring. Existing generic error logging is not a sanitized centralized diagnostic pipeline. This audit does not expand it into Phase 3.

### Deployment evidence still needed

The deployment owner must identify actual hosting/regions, API replicas, reverse proxy/TLS termination, network exposure and egress, trusted forwarded-header handling, secret management/rotation, service identities, container log driver/forwarders, persistence/backup/failure domains, quotas, monitoring and on-call ownership. Verify that `/api/system-logs` responses are not cached by a proxy/CDN and that credentials, cursors, IDs and query strings are not captured indiscriminately in access logs or traces. Existing Docker environment-file exclusions do not prove hosted secret hygiene.

No Docker control plane, cloud account, production database, secret file or remote storage was contacted. An external collector may exist; its presence and guarantees remain unavailable evidence.

## 4. Durable logs-access auditing recommendation

### Architecture decision proposal

Keep the two domain tables authoritative. Do not duplicate their event payloads in a generic audit table. Add only the minimum security delivery capability needed to evidence use of this viewer in a separately authorized phase; do not implement general operational diagnostics, authentication event collection or additional history adapters as part of that prerequisite.

First evaluate a **verified existing** hosting security/log service. Accept it only if it provides authenticated acknowledged durable ingestion or an acknowledged persistent collector/spool with documented recovery, isolation, retention and access controls. A fire-and-forget stdout write or a collector health ping is insufficient.

If no suitable service exists, compare these alternatives before selecting a product:

| Option                                                                | Conditions for selection                                                                                                                   | Important limitations                                                                                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Managed independent security ingestion/storage                        | Documented durable acknowledgement, independent failure domain, restricted identities, export/retention controls and operational ownership | Network availability and the provider's acknowledgement semantics must be tested; ordinary hosted access logs may not qualify                    |
| Host/sidecar collector with durable spool and independent destination | Persisted protected volume, fsync/ack semantics, restart recovery, quotas, replica ownership, backlog monitoring and replay                | Current Compose has no such volume/service; container filesystem or memory buffering does not qualify; host loss must have an explicit guarantee |
| Independent security service/database behind durable transport        | Separate failure domain/credentials and a tested acceptance/recovery interface                                                             | A second schema/table or public bucket in the application database/project is not automatically independent                                      |

The selected mechanism must still capture safe logs-access attempts/outcomes when the application database is unavailable. It must not trust unverified token claims as a current authenticated actor; record an unknown actor and a safe failure code if authentication cannot be established. Existing auth/business responses remain unchanged. Security evidence is restricted operator data and need not become a third viewer source.

### Minimum evidence and correlation

Reuse the Phase 1 normalized security-event vocabulary and privacy rules. The future emitter should record a server-generated immutable evidence ID, server-generated request/correlation ID, occurrence/acceptance times, authenticated actor ID and current role when verified, route template/method, safe action/outcome/status and the bounded approved scope. Keep logs-access evidence IDs separate from source event IDs and persisted business operation IDs.

Represent bounded module/source/category/date scope and pagination presence, not a raw URL, raw cursor, Bearer/refresh token, session ID, IP/user-agent, arbitrary filters, returned event contents or history JSON. Exact target/actor/subject/operation identifiers in evidence need a stated investigative purpose and explicit allowlist; otherwise record presence/type and a keyed request-scope digest if justified. A digest is still restricted pseudonymous data, not automatic anonymization. Never copy request/response objects or database errors into delivery records.

Each HTTP attempt has its own request ID. Retry delivery of the same evidence uses the same evidence ID for deduplication; a new client request is a new attempt. Optional paired stages share a correlation ID, not an invented historical `operationId`. Do not rewrite historical null HTTP/trace fields to imply correlation that was never recorded.

### Fail-closed disclosure boundary and recovery

1. Evaluate the existing activation and authorization boundaries, validate the query, and create minimized evidence. Record safe denied/invalid outcomes where durable delivery is available; never change existing authentication decisions or recursively invoke this viewer to log its own reads.
2. Before any history-bearing response bytes or headers are committed, require durable acceptance of the access evidence. Prefer a durable attempt followed by a linked, durably accepted release decision containing safe status and availability/count metadata after the reader completes. The final stage's acknowledgement gates disclosure. This avoids claiming that an initial intent record proves query outcome.
3. If neither independent sink nor qualifying durable spool accepts within a bounded deadline, release no history and return generic 503 with `no-store`. Do not send a partial body first. Sink failure must not open the viewer or affect unrelated business routes. Distinguish evidence failure from source availability internally without leaking infrastructure details.
4. A release decision records server authorization to disclose, not proof the client received bytes. Disconnects/crashes after acknowledgement can leave an uncertain delivery outcome; never assert exactly-once client receipt. Record a linked completion/abort stage when observable, using bounded recovery rather than silently amending immutable evidence.
5. On sink outage, replay accepted spool entries with stable IDs, bounded retry/backoff and explicit acceptance/delivery timestamps. Validate ordering/gap indicators, duplicates, poison records, disk-full/read-only volume, process/container restart and multi-replica recovery. A local acknowledgement is valid only for its documented failure model; unpersisted or destructible buffers cannot be treated as durable.
6. If all durable destinations fail, deny the new sensitive read and expose only safe out-of-band availability/loss indicators. Do not claim that the denied attempt itself was durably recorded when it was not. Redaction/schema failure must never trigger raw-payload fallback or recursive logging.

Whether to revalidate current session/role immediately before disclosure after a long query/acknowledgement wait is an explicit release security decision. There is always a race after any check; document the guarantee actually provided and test it. Do not weaken the current per-request checks or introduce token-only authorization.

Feature-specific evidence readiness must include successful durable acceptance and verified deployment protections, not just a flag or process liveness. Keep the general application's readiness semantics independent so a logs-only sink outage does not unnecessarily stop business services. Provide an internal readiness/alerting mechanism without publishing credentials, grants or sink internals.

### Retention and access

Phase 1 proposes security evidence retention of 90 days searchable plus 275 days restricted archive, 365 days total, and a bounded delivery spool of at most 24 hours. These remain **provisional owner decisions**, not deployed retention or asserted legal requirements. Approve duration, cost/volume, region, legal hold, archive/backup expiry and authorized investigators before rollout. A backlog approaching its age/quota bound must alert and close viewer admission before unacknowledged loss; do not silently discard accepted evidence and continue admitting reads.

Ordinary API producers should append only, not search/delete their evidence. Operator investigation, retention maintenance and privileged infrastructure administration require separate credentials and recorded access. Encrypt transport/storage with verified key ownership and rotation. Preserve all existing domain-history retention; no source TTL/backfill/archive operation is included. General operational retention remains outside this slice.

## 5. Controlled real integration testing

### Existing support and the activation constraint

The dedicated fixture starts isolated, migrated PGlite behind a loopback socket, composes the real Express app and verifies ownership of the open fixture/client/database URL with no `DIRECT_URL`. Normal backend tests run through native `node --test`, which supplies the required child-worker context. This is stronger than setting an enable flag.

The existing attendance Playwright suite demonstrates a browser talking to a real offline Express fixture by forwarding same-origin requests to a loopback API. However, its launcher uses `run-tests.mjs --fixture`, which directly imports a compiled module in the launcher. That path must not be assumed to supply System Logs' required `child-v8` context. Copying that entry path or manually setting `NODE_TEST_CONTEXT` would not establish the approved activation proof.

### Recommended later test composition

1. Add a System Logs browser fixture as an explicitly selected **native Node test-worker** entry through the existing runner's normal test path, with bounded lifecycle/teardown. Invoke `startSystemLogsApp` with a real `TestContext`; assert worker context and fixture ownership. Keep all helpers under tests and out of production imports. Validate startup/shutdown and child cleanup on the supported Windows/Linux environments.
2. Use fresh PGlite migrations, synthetic minimized source rows or existing domain writers, real issued sessions and real Express authentication endpoints needed by the shell. Never import live regression credentials or use a live database. Deny external Supabase/geolocation dependencies through test composition. Bind fixture/control endpoints to loopback and isolate per run.
3. For feature integration, forward browser same-origin API requests to that real fixture without synthetic history responses, preserving method, authentication, body, status and relevant headers including `no-store`. Label this as real Express/PGlite integration with test transport forwarding, not proof of the deployed Next reverse proxy.
4. Also perform a distinct Next production-build test with server-only `API_PROXY_TARGET` targeting the controlled loopback fixture at build time. Browser requests must pass through the actual Next `/api` rewrite without Playwright response/transport interception. The built web server can be production-mode while Express remains a verified non-production native test fixture. Do not change or enable a production Express app for this test.
5. Ensure test configuration avoids automatic loading of live credentials and external base URLs; the current Playwright config can load `.env.regression.local` and supports live overrides. Use an explicitly isolated environment/configuration and assert loopback origins. Test tokens stay in sessionStorage, and traces/screenshots contain synthetic data only.

### Required integration acceptance

- All four roles, unauthenticated, inactive/retired, expired/revoked sessions, demotion, refresh/logout and direct API/route denial; current-account behavior after state changes and the documented in-flight revocation policy.
- Shared navigation in every applicable workspace, origin-derived defaults, manual filter changes/back/detail/operation state and unsupported coverage messaging at mobile, tablet, laptop and desktop widths.
- Real pagination with equal timestamps across sources, binding to session/filters, modified/expired cursors, date edges, event detail windows, deleted identities, operation fanout and no duplicate visible records. Count labels must remain page-scoped.
- Empty data, malformed-only pages, scan frontier/cap, partial and full source outage/recovery, retry replacing the same page, and safe errors/redaction. Use controlled fixture faults, not live infrastructure faults.
- Production/default composition remains closed even with enable-like flags, invalid callbacks or environment transitions; no fixture endpoint, credential or activator enters runtime bundles. Test HEAD as well as GET, unknown methods and cache behavior.
- Reader-only database write-denial checks remain separate from allowed shared session activity updates. Future evidence writes go only to their approved independent sink, never the domain histories.

PGlite is appropriate for offline app behavior and migration regressions. It does not certify hosted role grants, TLS, failover, storage durability or pooler semantics. Role/RLS behavior needs a separately authorized disposable PostgreSQL environment and ultimately authorized deployment evidence; never call a superuser fixture equivalent to a restricted production credential.

No real System Logs browser-to-Express test was executed in Phase 2D.0. The above is an implementation strategy, not a completed integration claim.

## 6. Performance, ordering and indexing

### Verified boundaries and remaining risks

| Area                  | Current behavior                                                                                                           | Implication                                                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-source ordering | Per-table `createdAt DESC, id COLLATE "C" DESC`, merged by timestamp descending, source ascending, ID descending           | Deterministic ties and source-aware IDs; deployment/index collation must agree                                                                                                    |
| Work bound            | At most 501 candidates fetched per requested source; only 500 scanned per source; page size at most 100                    | Bounds API-side candidates, not PostgreSQL rows examined/sorted, bytes fetched or total operation fanout                                                                          |
| Continuation          | Earliest source scan frontier prevents passing an unread source; source failure disables continuation                      | Must preserve incomplete metadata and replace partial pages on retry; empty malformed windows can still have a cursor                                                             |
| Snapshot              | Each source is a separate RepeatableRead transaction, with a signed timestamp boundary across pages                        | Not one exported database snapshot; late commits/backdated rows can enter behind a visited boundary; do not claim globally complete historical snapshots                          |
| Cursor                | HMAC-SHA256, versioned, bounded to 4 KiB, maximum 24-hour lifetime, bound to session/account and normalized query          | Integrity, not confidentiality; payload contains IDs/time/source. Never log raw cursor. JWT-key rotation invalidates cursors; replicas need consistent keys/clocks                |
| Storage input         | Raw JSON is loaded before normalizer size validation; source primary-key TEXT has no matching 100-character database limit | Bad/oversized direct writes can consume resources. An invalid frontier ID over the cursor limit can end continuation with incomplete metadata. Do not silently repair source data |
| Read budget           | Shared transactions: maxWait 5 seconds, timeout 20 seconds; transient early failures retry once after 150 ms               | Authorization plus sequential source transactions can exceed a single transaction's budget. A Prisma transaction timeout is not evidence of a deployed SQL statement timeout      |
| Contention            | Shared pool, default 10; no System Logs-specific admission/rate/concurrency control found                                  | Repeated authorized heavy reads can compete with business transactions; add only justified feature-scoped controls later                                                          |

The original offline performance test seeds 20,006 combined history rows across 20 days/20 actors/100 subjects, includes a high-fanout operation, and times five reads for global/actor/subject/operation filters. It includes service authorization and both readers, with a generous five-second smoke budget. It is useful correctness/scale evidence, not a production SLO or certified capacity. Its EXPLAIN sample selects only account IDs/timestamps, rather than every exact production projection/filter. Historical timings in the Phase 2A report were not remeasured here.

### Measurement before any index change

Use synthetic distributions informed by authorized aggregate production statistics: rows/day per source, retention horizon, row/JSON sizes, actor/subject skew, operation fanout, malformed frequency, overlapping module origins and concurrent users. Never export raw histories for a benchmark.

Measure the exact parameterized queries and source merge at default/max ranges and page sizes, first/deep pages, equal timestamps, sparse action/origin filters, workforce subject-ID-only filters, large operations and malformed scans. Capture EXPLAIN ANALYZE/BUFFERS in an authorized disposable database with realistic PostgreSQL version/collation/pooling, plus p50/p95/p99 latency, physical rows/buffers/sort spill, memory/CPU, pool wait and impact on concurrent business traffic. Include evidence-sink latency and timeout/cancellation behavior. Agree a release SLO and resource/concurrency budget with owners before calling the result acceptable.

Potential indexes to **evaluate, not create** include a global `(createdAt DESC, id COLLATE "C" DESC)` index per table and ordered actor/subject/operation variants where the observed workload warrants them. Existing equality-leading indexes may help some queries; their ID collation may not satisfy the explicit C sort. Workforce subject-ID-only queries lack the leading subject type. Current enum-to-text action/origin/subject casts may also affect usable plans. Measure predicates, collation and planner decisions before choosing a new index or a query change.

Any chosen index needs separate authorization, deployment lock/space/write-cost assessment, migration compatibility and before/after plans. Do not deploy every candidate, introduce a global history mirror, relax the scan cap, or promise that LIMIT alone makes the query cheap. Malformed frontier handling and pre-validation payload cost need explicit acceptance or a scoped future fix before release.

## 7. Release blockers and unresolved decisions

| Priority | Blocker / uncertainty                                                   | Required evidence or decision                                                                                | Responsible role                |
| -------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| P0       | Production path deliberately absent                                     | Separately reviewed activator with all prerequisites evidenced; keep current lock until then                 | Backend/security/release owners |
| P0       | No durable logs-access acceptance or failure mechanism                  | Selected verified infrastructure, minimized schema, acknowledgement boundary, fault/recovery results         | Security/platform               |
| P0       | Management DB hardening absent from migrations; deployed grants unknown | Authorized catalog/grant review, direct-role denial, immutable protections and unchanged writer transactions | Database/platform/backend       |
| P0       | Hosting/network/log retention unknown                                   | Sanitized deployed topology, TLS/proxy/cache/secret/storage/ownership evidence                               | Deployment owner                |
| P1       | No real System Logs UI-to-Express proof                                 | Native-worker fixture plus real Next rewrite run, negative auth/privacy/responsive results                   | Web/backend/QA                  |
| P1       | Production capacity not measured                                        | Exact query plans, agreed latency/resource budget, concurrency and bounded overload behavior                 | Backend/database/platform       |
| P1       | In-flight revocation and evidence timing                                | Explicit disclosure guarantee and matching tests                                                             | Security/backend                |
| P1       | Retention, hold, archive and spool policy provisional                   | Approved lifecycle, credentials, expiry/hold/replay/alert ownership                                          | Security/privacy/platform       |
| P1       | Existing CI omits regression/integration execution                      | Repeatable offline release gate with recorded results and no live secrets                                    | Release/QA                      |
| P1       | Direct DB/privileged operator tampering                                 | Least-privilege and emergency-access review; documented residual threat model                                | Database/security               |

P0 blocks any production viewer exposure. P1 items also require resolution or an explicit, documented release-owner decision where the contract allows one; they are not waived by a passing unit suite. Private attendance snapshots, workflow content, messages, files and additional operational/security streams remain excluded. Superadmin status does not erase those source-level privacy boundaries.

## 8. Proposed implementation and validation phases

All phases below are recommendations. Phase 2D.0 authorizes none of their code, infrastructure, permission or activation changes. Phases 2D.1 and 2D.2 can be designed in parallel, but their prerequisites and release evidence must converge before exposure.

### Phase 2D.1 — deployment evidence and database protection

**Deliverable:** a sanitized deployment/privilege inventory, approved threat/lifecycle policy and the minimum separately authorized database protection changes. Confirm hosting and existing collector options before procuring or provisioning anything.

**Dependencies:** operator-authorized target or disposable environment; identified database/platform/security owners; access only to the evidence needed. Any schema/migration/grant work requires explicit authorization beyond this audit.

**Work:** inventory effective roles/grants/policies/owners/default privileges and migration state; define runtime/maintenance boundaries; inspect actual browser/REST exposure; review immutable management guards including TRUNCATE; approve retention and recovery ownership. Preserve source schemas and writers unless an independently justified hardening change is authorized. Validate direct-role access denial without disabling necessary SELECT/INSERT.

**Acceptance:** restricted roles cannot mutate/remove history or read it through browser paths; current business writers still commit/rollback correctly across the inventoried management endpoints; deleted identities persist; privileged exceptions are documented; staged migrations/permissions are reproducible and reviewed. Offline tests plus authorized disposable PostgreSQL role tests pass. No production viewer activation.

### Phase 2D.2 — minimum durable logs-access evidence

**Deliverable:** only the viewer's minimal independent security evidence path, safe schema, receipt/admission behavior, recovery/retention runbook and monitoring.

**Dependencies:** Phase 2D.1 infrastructure inventory and approved retention/privacy/credential/failure-model decisions; explicit permission for any new service, persistent volume, transport or emitter. Reuse a verified suitable service if available. This is not authorization for Phase 3 general diagnostics.

**Work:** integrate minimized attempt/release evidence, server IDs and sink/spool acknowledgements; gate history disclosure; bounded quotas/retry/backpressure/replay; operator-only health/loss alerts; retention/archive/hold controls and restricted evidence access. Keep source records unchanged and normal business/auth behavior intact.

**Acceptance:** with DB unavailable, safe denied/unavailable evidence can still be accepted independently; sink outage, full/read-only/lost spool, slow ack, restart, shutdown, duplicates/reordering and multi-replica cases meet the documented guarantees. No history bytes escape without durable acceptance; no raw secrets/URLs/JSON appear in evidence or errors. An unrecorded failure is not falsely reported as recorded. Production lock remains closed.

### Phase 2D.3 — controlled integration and capacity qualification

**Deliverable:** real offline browser-to-Express/PGlite tests, a separate Next rewrite test, production-like disposable-database performance evidence and release regression results.

**Dependencies:** existing fixture architecture plus explicit test implementation authorization; Phase 2D.1 protection model and Phase 2D.2 receipt contract for their integrated tests. UI/API foundation tests can begin earlier using isolated fixtures, without bypassing activation.

**Work:** implement the native-test-worker browser fixture and loopback-only orchestration; exercise the acceptance matrix in section 5; benchmark exact queries/scan boundaries and evidence overhead. Propose only measured index/admission/time-budget changes, each reviewed and separately authorized if needed. Record actual results and unexecuted checks; distinguish fixture tests from deployed infrastructure certification.

**Acceptance:** full offline backend/frontend regression, responsive Playwright, production build, formatting/lint/typecheck and privacy/accessibility checks pass; actual Next-to-Express request flow is demonstrated; agreed latency/resource/overload goals hold under representative load; no source writes or privacy regression; no production activation.

### Phase 2D.4 — release gate, operational rehearsal and activation decision

**Deliverable:** reviewed production-readiness evidence package, future backend activation design, rollback/outage runbook and a separate go/no-go decision. Any actual production exposure requires explicit authorization; completion of this audit or prior phases is not that authorization.

**Dependencies:** completed 2D.1 protections/effective-role verification, 2D.2 acknowledged delivery/recovery, 2D.3 integration/capacity results, approved ownership/retention and authorized deployment access.

**Work:** implement/review a fail-closed server activation mechanism bound to a versioned approved deployment configuration and verified prerequisites; define freshness/reverification after credential, migration or infrastructure changes. Prove negative cases for missing/stale/failed evidence and sink loss. An operator flag may request release, but cannot replace verification. Do not repurpose the offline fixture callback or expose a browser switch. Keep existing UI Unavailable status until release is explicitly approved; deployment is closed by default.

**Acceptance:** rehearse restart/failover, sink outages, loss alerts, key rotation/cursor invalidation, privilege drift, rollback to closed state and effective direct-access denial in an authorized environment. Confirm secrets and test helpers are absent from web/runtime artifacts. Record independent security/database/platform sign-off, monitoring and incident ownership. Only an explicit subsequent activation instruction permits production exposure; otherwise deliver readiness evidence with the lock intact.

## 9. Phase 2D.0 validation and changed files

This phase changes only this audit document and its entry in the [feature index](README.md). It preserves the pre-existing uncommitted application, tests, schemas, migrations, configuration and skill-reference work.

| Check run in this phase                                                                                        | Result                                                                                                      |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `pnpm.cmd format:check`                                                                                        | Exit 0; repository formatting passed                                                                        |
| `pnpm.cmd lint`                                                                                                | Exit 0; zero-warning lint passed                                                                            |
| `pnpm.cmd --filter @nexus/api exec tsc --noEmit -p tests/tsconfig.json --incremental false`                    | Exit 0; API source and tests checked using the existing generated Prisma client                             |
| `pnpm.cmd --filter @nexus/web exec tsc --noEmit --incremental false`                                           | Exit 0; web source/tests/configuration checked using existing generated Next types                          |
| From `apps/web`: `node --experimental-strip-types --test test/system-logs.test.mjs test/route-policy.test.mjs` | Exit 0; 23 tests passed, none failed/skipped                                                                |
| Relative-link existence check for this report and the feature index                                            | Exit 0; 85 local link targets checked, none missing                                                         |
| `git diff --check` and working-tree review                                                                     | Exit 0; no whitespace errors in tracked changes; only the two documentation paths were edited by this phase |

Only the two authored documentation files were formatted. The repository-wide writing formatter was replaced by `format:check` to preserve the read-only application constraint. Direct TypeScript checks avoid the normal wrappers' Prisma generation, Next type generation and incremental-cache writes; they do not certify freshly regenerated framework/client types. No checks failed.

Full backend/Playwright suites, production builds, Prisma generation, migrations, permission changes, Docker/cloud inspection and new integration/performance runs were not executed in this documentation-only read-only phase. Their runners/builds generate artifacts or require a separately implemented controlled environment; no application change required a new runtime build here. Historical test/build totals in earlier reports are not new verification. All deeper deployment, durability, privilege and capacity validation remains pending as identified above.

**Stop after Phase 2D.0.** No later phase or production activation is implemented or authorized by this report.

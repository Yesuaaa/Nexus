# System Logs & Diagnostics — Phase 1 contracts and policies

Documented: 2026-11-16. Status: design only; no feature implementation or deployment.

This record follows the Phase 0 read-only repository audit. **Verified** means inspected repository source/schema/migrations, not production verification. **Decision** means the proposed contract for subsequent implementation. **Provisional** means an operational policy needing owner approval before rollout. Nothing here changes existing business authorization, writes, transactions, retention or history records. Phase 2 requires explicit instruction.

## 1. Scope and verified foundations

The centralized feature is Superadmin-only and belongs under Administration. It investigates activity/audit, operational diagnostics and security events across modules. It does not grant message participation, private-message access, attachment downloads, business decisions, repair/replay commands, exports or unrestricted snapshots.

Verified sources and constraints:

| Evidence                                                                                                                                                                                     | Verified fact                                                                                                   | Design implication                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [API composition](../../apps/api/src/app.ts), [shared database client](../../apps/api/src/lib/db.ts)                                                                                         | Express feature routers; shared Prisma/PostgreSQL access; API responses use no-store                            | Keep new business/API code in a feature; reuse the client and error conventions                           |
| [Auth middleware](../../apps/api/src/features/auth/auth.middleware.ts), [capabilities](../../apps/api/src/features/auth/auth.capabilities.ts)                                                | Current session/account resolved; exact-role checks exist; administrative and operational authority differ      | Require authenticated current `SUPERADMIN` on every new endpoint, including detail/filter/count endpoints |
| [Web auth client](../../apps/web/src/features/auth/api/auth-api.ts), [route policy](../../apps/web/src/features/workspaces/model/route-policy.ts)                                            | sessionStorage tokens, refresh handling and centralized navigation policy                                       | Same-origin `/api/...`; reuse authenticated client and route policy                                       |
| [Schema](../../apps/api/prisma/schema.prisma), [management writer primitives](../../apps/api/src/shared/management-history.ts)                                                               | Two bounded management histories; server-created actor/role/operation; transaction-scoped writers               | Adapt these records without a duplicate generic audit table                                               |
| [Attendance foundation migration](../../apps/api/prisma/migrations/20261113150000_attendance_foundation/migration.sql) and later attendance migrations                                       | Trigger-owned row audits with transaction-local actor/reason; immutable update/delete guard                     | No parallel application audit inserts; minimize snapshots at read boundary                                |
| [Workflow access/events](../../apps/api/src/features/request-workflow/workflow.access.ts), [safe oversight](../../apps/api/src/features/request-workflow/administrative-workflow.service.ts) | Events can drive notifications; oversight intentionally excludes raw summaries                                  | Reuse approved labels, never participant DTOs or raw summaries                                            |
| [Management migration](../../apps/api/prisma/migrations/20261115030000_management_attribution/migration.sql)                                                                                 | Identity scalars survive deletion; no update/delete guard or explicit browser-role revocation in this migration | Production grants and append-only hardening require verification                                          |
| [Error handler](../../apps/api/src/shared/error-handler.ts), [server](../../apps/api/src/server.ts), [limiter](../../apps/api/src/features/auth/auth.limiter.ts)                             | Console diagnostics; process-local limiting; no common durable security stream                                  | New collection is future work, not assumed infrastructure                                                 |

No deployed database, production privileges, collector, queue, object store for logs, retention configuration or infrastructure log service was verified. The original 26-path attribution reconciliation is preserved in the [Team report](team-management-attribution.md); see the [current endpoint matrix](system-logs-endpoint-coverage.md) for wider scope.

## 2. Normalized event schema v1

**Decision:** normalization is a read/transport contract, not a new universal persistence model. Use strict runtime validation of `unknown`, closed objects, bounded lists/strings and discriminated details. No `any` or unrestricted metadata bag. Existing source JSON is untrusted at the adapter boundary even when its writer is typed.

The following schema notation is documentation, not TypeScript implementation:

```text
NormalizedEventV1 {
  schemaVersion: 1
  eventId: string                         // source + ':' + native ID, max 200
  source: SourceId                        // closed catalog below
  sourceEventId: string                   // opaque native ID, 1..100
  occurredAt: UTC ISO-8601 milliseconds    // source occurrence/commit timestamp
  observedAt: UTC ISO-8601 milliseconds | null // first durable ingestion only
  category: 'audit' | 'operational' | 'security'
  area: 'module' | 'authentication' | 'platform'
  moduleId: RegistryModuleId | null
  relatedModuleIds: RegistryModuleId[]     // unique, max 6, display references
  eventName: string                       // catalog key, max 100
  sourceAction: string | null             // approved native enum/type, max 80
  severity: 'debug' | 'info' | 'warn' | 'error' | 'critical'
  outcome: 'succeeded' | 'denied' | 'failed' | 'unknown'
  actor: {
    kind: 'account' | 'system' | 'anonymous' | 'unknown'
    accountId: string | null              // opaque ID, max 80
    roleAtTime: Role | null
    roleEvidence: 'recorded' | 'not-recorded'
  }
  subject: { type: approved string; id: string } | null
  correlation: {
    operationId: UUID | null
    httpRequestId: UUID | null
    traceId: approved trace ID | null
    workflowActionId: UUID | null
    businessRequestId: string | null
    projectId: string | null
    workdayId: string | null
    jobRunId: UUID | null
  }
  summaryKey: approved string             // server label/template, never raw prose
  details: ManagementDetails | AttendanceDetails |
           WorkflowDetails | OperationalDetails | SecurityDetails
}

ManagementDetails {
  kind: 'management'; origin: approved enum
  changedFields: approved string[]        // max 24, existing writer allowlist
  transitions: approved per-source primitive transitions
  sessionsRevoked: boolean | null
}
AttendanceDetails {
  kind: 'attendance'; entityType: approved enum
  changedFields: approved string[]
  transitionKind: 'insert' | 'update' | 'delete'
  status: approved adjustment status | null
  adjustmentType: 'CORRECTION' | 'OVERTIME' | null
}
WorkflowDetails {
  kind: 'workflow'; eventType: approved enum
  entityType: approved type | null; entityId: string | null
}
OperationalDetails {
  kind: 'operational'; component: approved enum
  method: approved HTTP method | null; routeTemplate: approved string | null
  statusCode: integer 100..599 | null; durationMs: nonnegative integer | null
  errorCode: approved code | null; retryable: boolean | null
}
SecurityDetails {
  kind: 'security'; reasonCode: approved enum
  authenticationMethod: 'bearer' | 'password' | 'refresh' | null
  targetType: approved enum | null; targetId: opaque string | null
}
```

Roles are exactly `SUPERADMIN`, `ADMIN`, `STAFF`, `USER`. IDs remain opaque, validated against their source contract; do not require every legacy ID to be a UUID. UTC timestamps serialize consistently, but ordering does not imply causality. `observedAt` stays null for direct legacy reads; never fill it with the time a user opens the page.

Invariants: module area requires a valid registry module; authentication/platform areas require `moduleId: null`. An account actor requires a recorded account ID. Null actor IDs in legacy rows map to `unknown`, not automatically `system`. `roleEvidence: recorded` requires a valid role actually persisted at event time. Details kind must match source/category. Normalized serialized event limit: 16 KiB; reject oversize optional data without truncating identities or inventing transitions. Invalid source payloads produce a safe adapter warning and coverage gap, never raw JSON fallback.

Example (illustrative IDs; not a production record):

```json
{
  "schemaVersion": 1,
  "eventId": "audit.account-management:change-example",
  "source": "audit.account-management",
  "sourceEventId": "change-example",
  "occurredAt": "2026-11-16T01:00:00.000Z",
  "observedAt": null,
  "category": "audit",
  "area": "module",
  "moduleId": "administration",
  "relatedModuleIds": [],
  "eventName": "account.status_changed",
  "sourceAction": "STATUS_CHANGED",
  "severity": "info",
  "outcome": "succeeded",
  "actor": {
    "kind": "account",
    "accountId": "actor-example",
    "roleAtTime": "SUPERADMIN",
    "roleEvidence": "recorded"
  },
  "subject": { "type": "account", "id": "subject-example" },
  "correlation": {
    "operationId": "5168086b-2d02-4e99-9c14-93cef129aabc",
    "httpRequestId": null,
    "traceId": null,
    "workflowActionId": null,
    "businessRequestId": null,
    "projectId": null,
    "workdayId": null,
    "jobRunId": null
  },
  "summaryKey": "account.status_changed",
  "details": {
    "kind": "management",
    "origin": "ACCOUNT_MANAGEMENT",
    "changedFields": ["isActive"],
    "transitions": { "isActive": { "before": true, "after": false } },
    "sessionsRevoked": true
  }
}
```

## 3. Module, source and event taxonomy

**Verified:** the [shared registry](../../apps/api/src/features/modules/module-registry.json) owns module IDs and titles. **Decision:** derive the module-ID union and display labels from it; no second editable registry. Authentication and Platform are filter areas, not registry modules or new cards.

| Source/event origin                                                      | Area / primary module            | Notes                                                                      |
| ------------------------------------------------------------------------ | -------------------------------- | -------------------------------------------------------------------------- |
| Account `ACCOUNT_MANAGEMENT`                                             | module / `administration`        | Includes lifecycle and password reset audit                                |
| Account `CLIENT_MANAGEMENT`                                              | module / `service-operations`    | Account subject; do not manufacture a separate Client history row          |
| Account `EMPLOYEE_MANAGEMENT`                                            | module / `people-hr`             | May reference Administration as related                                    |
| Workforce origin `ACCOUNT_MANAGEMENT`                                    | module / `administration`        | Related `people-hr`; preserve operation grouping                           |
| Other workforce origins                                                  | module / `people-hr`             | Department/Team/Employee subjects                                          |
| Attendance                                                               | module / `attendance-monitoring` | Display registry title Workforce Compliance                                |
| Workflow consultation/requirements/quotation/agreement/payment events    | module / `service-operations`    | Payment events stay here; do not imply implemented finance module          |
| Approved workspace/project/task/deliverable/staffing events              | module / `project-management`    | Related Service Operations when persisted request linkage exists           |
| Auth/login/refresh/session/access events                                 | authentication / null            | Optional related module for authorization target                           |
| HTTP, database availability, storage, realtime transport, shutdown, jobs | platform / null                  | Optional related business module; no private conversation identity for DMs |
| `billing-finance`                                                        | registry placeholder             | No new emitters or invented payroll coverage                               |

Source IDs v1: `audit.account-management`, `audit.workforce-management`, `audit.attendance`, `audit.workflow`, `operational.api`, `operational.worker`, `security.authentication`, `security.authorization`, `security.logs-access`. First four are existing-source adapters; remaining IDs reserve future producers and do not prove implementation.

Event names use lowercase `domain.action`, stable across UI wording; no user text, IDs, timestamps or error messages in names. Keep native enums in `sourceAction`. Management names map `account.<lowercase action>` and `<employee|department|team>.<lowercase action>`. Attendance maps `attendance.<approved entity>.<inserted|updated|deleted>`. Workflow uses an explicit reviewed type-to-name/label catalog (e.g. `PAYMENT_VERIFIED` → `workflow.payment_verified`, `WORKSPACE_RENAMED` → `project.workspace_renamed`), not automatic exposure of every type. `INTERNAL_NOTE` is excluded; unknown types are omitted with a gap indicator until reviewed. Sharing categories or event names does not merge source identities.

Future operational catalog: `http.request_completed`, `dependency.database_unavailable`, `storage.cleanup_failed`, `realtime.connection_failed`, `job.run_failed`, `process.shutdown_failed`. Future security catalog: `auth.login_succeeded`, `auth.login_denied`, `auth.refresh_reuse_detected`, `auth.session_revoked`, `auth.password_changed`, `access.denied`, `access.rate_limited`, `logs.viewed`, `logs.query_denied`.

Severity rules: `debug` is optional development detail and disabled by default; `info` normal successful activity; `warn` expected denial/throttle or recoverable degradation; `error` unexpected failed operation/dependency/job; `critical` confirmed integrity failure or sustained service-wide failure, not every 500. Audit changes are `info` regardless of business importance. A rejected approval is a successful business decision, not an access denial. A 404 is not automatically a security incident. Severity and outcome are independent; an HTTP 2xx is not proof of a committed domain change.

## 4. Attribution, identity and correlation

**Decision:** preserve management actor ID, role-at-time, UUID and database time exactly. Existing writers continue accepting only their trusted backend operation objects. Never take actor, origin, role, event time or operation IDs from request bodies/headers. Anonymous login attempts have no account actor until identity is verified; a submitted email is not an actor ID.

Attendance/workflow actor role is historically unknown because these records lack a role snapshot. Never infer it from the current account. Optional live name enrichment must be separately labelled `currentDisplayName` and fetched through an explicit projection; it is not historical evidence. No email fallback for missing names. Deleted accounts/subjects remain visible by preserved ID with “record unavailable”; never recreate records or weaken deletion constraints. Existing workflow/attendance foreign-key restrictions remain intact.

| Identifier                | Meaning and rule                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `eventId`                 | Exact source identity; deduplicate only by source/native ID                                                                 |
| `operationId`             | Existing management UUID groups real effects across its two histories; one operation can create many rows                   |
| `httpRequestId`           | Future server-generated UUID per attempt, created before parsing/auth; inbound caller IDs cannot replace it                 |
| `traceId`                 | Optional future trusted tracing context; reject/untrust public propagated identifiers; no tracing infrastructure assumed    |
| `workflowActionId`        | Existing client idempotency token, scoped by business request and authenticated actor; not a trusted global correlation key |
| `businessRequestId`       | Existing ServiceRequest/workflow identity; never call it an HTTP request ID                                                 |
| `workdayId` / `projectId` | Explicit source linkage, not inferred from names or current assignments                                                     |
| `jobRunId`                | Future server-generated job execution UUID, separate from individual retry attempts                                         |

Attendance `actionId` is per trigger row, not a multi-row operation identifier. Workflow receipts do not directly link all events from an action. Legacy HTTP/trace/action correlation stays null when no persisted relationship proves it. Identical times or actors can suggest a search, never a proven causal chain.

Future request-to-operation links belong in a minimized diagnostic correlation event after the operation result is known. This does not add transport fields to existing management payloads or require a second synchronous audit write. Link loss is reported as missing correlation. Retries have new HTTP IDs; repeated receipts must not duplicate domain activity. A future security event may reference a password-reset audit event/operation, but remains a different category with separate counts.

## 5. Data minimization and privacy policy

Default deny: allowlist at producer and adapter before transport, persistence, search indexing, export or rendering. Sanitizing only in the browser is insufficient. Error objects, ORM metadata, nested JSON and user prose must never be blindly serialized. The Superadmin role does not waive privacy boundaries.

| Data                        | Centralized feature policy                                                                                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Management history          | Approved identifiers, fixed enum/boolean/timestamp transitions, changed field names, revocation flag and approved cleanup cause only; retain existing per-action writer allowlists                                          |
| Attendance                  | Entity/action, actor/employee/workday IDs, changed approved field names and adjustment status/type only. No raw before/after, reasons, original session JSON, review/verification notes or exact punch schedules in v1      |
| Workflow                    | Explicit event-type labels, approved entity/request/project references and actor identity only. No raw summary, requirement submission, quotation prose, agreements, payment proof, amounts, bank details or internal notes |
| Service/project messaging   | No bodies, previews, edits, attachments, meeting links/locations or read markers. Business conversation metadata requires separate approved projection                                                                      |
| Internal DMs                | No participant graph, conversation/message IDs or bodies in centralized logs. Generic transport/component failure only; preserve membership checks                                                                          |
| Personal information        | No stored names, emails, contacts, birthdates, addresses, Employee business numbers or profile snapshots. Opaque account/Employee IDs are still restricted personal data                                                    |
| Credentials and identifiers | Never passwords/hashes, JWTs, refresh tokens/hashes, authorization/cookie headers, session IDs, API secrets, connection strings, signed URLs or idempotency payload hashes                                                  |
| Network/device context      | No raw IP, user-agent or geolocation in v1. Any future abuse-detection pseudonym needs approved purpose, separate keyed HMAC, rotation and retention; plain hashes are not anonymization                                    |
| Diagnostics                 | Route template rather than raw URL/path/query; method, status, duration, safe code/component. No payloads, filenames, SQL/bindings, stack traces or host filesystem paths in the viewer                                     |

Restricted operator diagnostics, if later needed, require a separately approved sink/permission policy and redaction; they do not become ordinary System Logs details. Unknown fields are rejected/stripped before collection. Render summaries as text, escape control characters, bound strings, and prohibit HTML interpretation. Search is limited to approved enums/IDs; no full-text indexing of legacy prose. Do not create downloads/deep links that bypass existing record/file access.

## 6. Retention, append-only protection and database access

**Verified:** management retention has no automated expiry in inspected code; attendance/workflow have immutable guards and restrictive links. A source-specific historical migration can initialize workflow events; this does not establish management backfill or universal provenance. **Decision:** preserve all existing source rows and their lifecycle during adapter work.

| Stream                                 | Proposed operational default                                                    | Rollout condition                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Existing domain audit sources          | Inherit existing retention; no new TTL, purge, rewrite or backfill              | Domain/legal owners must agree a separate lifecycle before any future deletion/archive work |
| Operational diagnostics                | Provisional 30 days searchable; debug disabled, approved debug maximum 7 days   | Owner approves volume/cost and collector enforcement                                        |
| Security events, including logs access | Provisional 90 days searchable plus 275 days restricted archive; 365 days total | Security/privacy owner approves purpose, archive access and expiry                          |
| Temporary delivery spool               | Provisional maximum 24 hours, bounded by storage quota                          | Durable shared/replica-safe delivery design and explicit disk-full behavior validated       |

Retention is measured from occurrence, with late-ingestion expiry enforced; legal holds require an explicit authorized hold record and reviewed release. No automatic deletion implementation is authorized here. Approved future retention jobs use separate credentials, auditable range/count manifests, and verified backup/archive expiry. Do not disable source immutability triggers to implement a generic purge. Backups, replicas and archives must have documented expiry too; no indefinite silent archive.

Append-only means producers can insert approved events and readers can select approved projections; no ordinary UPDATE/DELETE/TRUNCATE or UI edit/delete. Retention maintenance is a separately controlled exception, not a producer privilege. Database administrators can still tamper: application-level append-only and trigger guards are not cryptographic or administrator-proof evidence. Optional locked archive storage is a future operational capability, not a verified fact.

Before production exposure: inspect actual runtime, migration, owner and browser-facing roles; verify table/schema grants, RLS and bypass privileges; test denial for direct anonymous/authenticated browser roles. Management tables currently lack the protections established for some workflow tables. A dedicated migration may be required, separately authorized and tested. Use API-side shared Prisma access; never expose a database credential or direct Supabase history query to the browser. No production grant assumptions follow from a checked-in migration.

## 7. Durable storage and logging failure behavior

**Decision:** retain domain databases as authoritative audit stores. No generic audit table copying their records. For operational/security events, prefer an independently durable log pipeline: sanitized structured process output → acknowledged collector/queue with durable buffering → searchable operational store and separately governed security archive. Structured stdout alone is not durable evidence. Separate credentials, quotas and retention even if one managed service supplies both stores.

Deployment alternatives, pending infrastructure discovery:

1. Managed collector and log service with documented acknowledgements, outage buffering, encryption, access and expiry. Preferred if already available and verified.
2. Host/sidecar collector with persistent encrypted spool plus an independent log/search store and restricted archive. Requires volume, multi-replica, quota and recovery ownership.
3. Dedicated security database/service independent of the application database, behind durable transport. Separation must include failure domain and credentials; another table in the same database does not meet outage independence.

Do not install or assume any of these in Phase 1. The application's existing file/image storage is not evidence of a suitable log archive. An application-DB outbox alone cannot capture database outages or denied attempts outside a committed transaction. Existing audit-to-index projection, if later justified, must be rebuildable and deduplicated, never a new source of truth.

| Failure                                                           | Required future behavior                                                                                                                                                                                                         |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Required domain-history insertion                                 | Existing business transaction rolls back; never swallow the history error or emit false success                                                                                                                                  |
| Optional operational sink unavailable                             | Preserve business response; bounded asynchronous buffering/retry with backoff, no unbounded memory or request latency; expose loss/queue metrics                                                                                 |
| Security sink unavailable                                         | Preserve auth/access decision; durable bounded spool where available; alert and record sequence/gap indicators on recovery. If every durable destination fails, explicitly report possible loss; never claim guaranteed delivery |
| New centralized logs query cannot produce its own access evidence | Deny the new sensitive logs read with generic 503 if neither durable sink nor durable spool accepts the access event. Existing auth/business routes retain behavior                                                              |
| Application DB unavailable                                        | Independent operational/security collection continues; audit adapter returns source unavailable, not an empty history                                                                                                            |
| Bad event/redaction failure                                       | Reject optional unsafe payload, emit safe code/count only; never fallback to raw serialization or recursively log logging failures                                                                                               |
| Partial adapter failure                                           | Return explicit per-source availability/omission metadata; never label incomplete results complete                                                                                                                               |

No changes to login/refresh/session behavior are authorized by this policy. Critical delivery requirements cannot be honestly guaranteed until the selected infrastructure is tested. Logs access auditing records actor, time, action, result and bounded category/module/time filters; never raw search text, returned rows or recursive reads of its own audit event.

## 8. Read-adapter and query contract

**Decision:** Phase 2 supports only management histories. Later sources implement the same adapter boundary after privacy review. Adapters receive authenticated server context and validated filters, never caller-supplied identity claims. All list/detail/filter/count operations independently require current Superadmin authorization.

```text
listEvents(filters, cursor, snapshotBoundary) -> {
  schemaVersion: 1, events: NormalizedEventV1[], nextCursor: opaque | null,
  snapshotBoundary: UTC timestamp,
  sources: [{ source, status: 'available'|'unavailable'|'unsupported',
              omittedCount: integer | null, reasonCode: approved code | null }],
  complete: boolean
}
getEvent(source, sourceEventId) -> normalized event | not-found | unavailable
```

Filters: category, area, registry module, source, approved event/action, actor ID, subject type/ID, exact operation UUID and bounded date interval. Later add exact persisted business/correlation IDs supported by each source. Maximum 31-day query interval, default last 7 days, page size 50 with maximum 100. These are query limits, not retention limits. No arbitrary JSON filters, SQL, regex, raw summary search or client-selectable projection. Unknown filters and invalid cursors return 400; unsupported source/filter combinations are explicit, not silently ignored. Phase 2 must prove these limits feasible before release.

Use total ordering `(occurredAt DESC, source ASC, sourceEventId DESC)` and a versioned cursor bound to filters, enabled sources and snapshot boundary; validate and bound it. Query each source with the ordering predicate, merge bounded batches and deduplicate exact IDs. Overfetch for skipped unsafe/unknown rows, with a scan cap and explicit omission status. Do not load all tables into memory or independently paginate sources and concatenate pages. Counts must use the same boundary and approved semantics; omit expensive global totals rather than invent them.

A timestamp boundary stabilizes a browsing window but cannot guarantee cross-request snapshot isolation against late commits/backdated ingestion. Document this eventual consistency; do not hold long database transactions across pages. A future index may supply ingestion sequencing if stronger stability is required. Use existing RepeatableRead read helpers for each bounded database query where appropriate, and read-only retries only; no replay of mutations. Profile global date queries: existing subject/actor indexes do not establish efficient global browsing.

Adapters select explicit fields, validate source payloads, map enums and emit safe labels. No database writes, repair, backfill, new history rows or implicit account/profile creation. Normal session last-active bookkeeping remains separate. Missing current enrichment does not drop the event. Existing Attendance Audit UI and its permissions remain unchanged. Future UI reuses responsive tables, side panels, filters, loading/error/empty states, EXP navy/Inter and existing feedback patterns.

## 9. Architecture decisions and unresolved questions

| Decision                                          | Rationale / consequence                                                                 |
| ------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Three logical streams, one investigation surface  | Different privacy, retention and failure semantics; category-specific counts            |
| Source adapters first; no copied domain ledger    | Preserve transactional ownership and avoid dual writes/double counts                    |
| Management histories first                        | Existing bounded payloads and operation IDs support a reviewable Phase 2 slice          |
| Strict Superadmin checks on backend and frontend  | Existing broad module/organization permissions alone must not authorize the new feature |
| No legacy correlation fabrication                 | Missing role/HTTP/action identity remains unknown                                       |
| Independent durable diagnostics/security pipeline | Application-DB outages must be observable                                               |
| No export, replay, repair or log deletion UI      | Separate scope and policy required                                                      |

Open questions and gates:

- **Phase 2 production prerequisite:** inspect deployed management table protections and runtime/browser roles; authorize any required hardening separately. No production access occurred here.
- **Phase 2 design prerequisite:** settle index/query plan feasibility and cursor behavior using representative offline data. A schema change needs a separate authorized implementation slice.
- **Phase 2 rollout prerequisite:** select minimum durable logs-access evidence mechanism, or keep the viewer unexposed until the security delivery foundation exists. The source reader may be developed/tested offline first.
- **Before collection rollout:** name infrastructure/security/privacy owners; verify available collector/storage failure domains, regional residency, encryption, budget and delivery guarantees.
- **Before retention enforcement:** approve provisional durations, archive/backup expiry and legal-hold procedure. No legal retention requirement is asserted by this document.
- **Before adapter expansion:** review each workflow type and attendance projection; decide whether any additional personal fields are necessary. Default remains excluded.
- **Before coverage claims:** execute relevant existing suites and new behavioral tests. Source inspection and historical passing results are not current regression certification.

## 10. Phase 2 prerequisites, acceptance and later validation

Phase 2 is not authorized by completion of this document. Its proposed deliverable is a Superadmin-only management-history reader/viewer with operation grouping; operational/security collection and other domain adapters remain separate dependencies/slices.

Acceptance checklist for Phase 2:

1. Scope and source/query contracts are agreed; no new audit emitters or duplicated histories. Current Account profile PATCH and original 26 endpoints remain covered by their existing writers.
2. Every API operation denies unauthenticated, inactive, retired, revoked-session and non-Superadmin users; role demotion is effective on the next request. UI hiding alone never passes authorization tests.
3. List/detail/count/operation queries use approved projections, no-store and bounded validation. Tampered filters/cursors and arbitrary source IDs fail safely; private fields never appear in response, search, errors or diagnostic records.
4. Cross-table operation grouping retains each real effect and identifies operation counts separately from event counts. True no-ops create no invented records; legacy synchronization effects remain visible.
5. Deleted actors/subjects, missing names and historical role evidence are correctly represented without domain writes or relaxed foreign keys.
6. Stable tie ordering, date boundaries, empty/partial/unavailable states, scan caps and concurrent-insert limitations are tested. Queries meet a measured performance budget established before release; no unsupported performance claim.
7. Deployment protections and durable logs-access prerequisites above are satisfied before production exposure. Append-only insert/select/update/delete/truncate tests cover intended runtime and browser roles where applicable.
8. Existing transaction, self-role/status, password-reset, leadership, ownership, privacy, attachment and attendance/workflow behavior remains intact. No unrelated repairs or permission changes.
9. Reuse offline API [PGlite harness](../../apps/api/tests/support/pglite-app.ts), web unit tests and isolated Playwright fixtures. Run relevant attribution suites (including late history-write rollback), authorization/privacy regressions, required format/lint/typecheck and build for runtime changes. Do not use a live database as test validation.

Later delivery validation must simulate database outage, collector outage, full spool, process restart, duplicate/reordered delivery, retry exhaustion and retention/hold expiry. Verify deduplication, redaction before transport, explicit gaps and non-recursive failure reporting. Attendance adapters require trigger and privacy tests; workflow adapters require unknown/internal type and unsafe-summary tests. New mutation coverage must verify committed effects, denials, no-ops, retries and rollback within existing transactions.

## Phase 1 validation record

Documentation and endpoint inventory only. Executed on 2026-11-16:

| Check                                                                                       | Result                                                                 |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `pnpm.cmd format:check`                                                                     | PASS, exit 0                                                           |
| `pnpm.cmd lint`                                                                             | PASS, exit 0                                                           |
| `pnpm.cmd --filter @nexus/api exec tsc --noEmit -p tests/tsconfig.json --incremental false` | PASS, exit 0                                                           |
| `pnpm.cmd --filter @nexus/web exec tsc --noEmit --incremental false`                        | PASS, exit 0                                                           |
| Mounted mutation declaration comparison, including explicit loop expansion                  | PASS: 103 routes match 103 documented entries; no missing/extra routes |
| Local link existence and example JSON parsing                                               | PASS: 55 links checked across the two new documents; JSON parses       |
| `git diff --check` and scope inspection                                                     | PASS; only the two new documentation files and feature index changed   |

The route comparison verifies inventory membership, not behavioral coverage. Type checks used existing generated artifacts. No production inspection, behavioral suite, migration, seed or build was run. Standard `pnpm format` and `pnpm typecheck` wrappers write or regenerate files and were excluded in favor of non-mutating equivalents as requested. Only the edited documentation was formatted during authoring; no application/configuration files were modified.

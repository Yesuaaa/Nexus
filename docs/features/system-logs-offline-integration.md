# System Logs real offline integration (Phase 2D.3A)

Developed: 2026-11-16

**Controlled local testing only. Production System Logs remains disabled.** This phase connects the existing Next.js interface and standard authenticated client to the real Express controllers/readers and a fresh PGlite database. It separately verifies the production-built Next `/api` rewrite. No application logic, history writer, API contract, activation guard, schema, migration or database permission is changed.

Governing references: [readiness audit](system-logs-production-readiness-audit.md), [local database hardening](system-logs-local-database-hardening.md), [deployment privilege assessment](system-logs-deployment-privileges.md), [Phase 1 contracts](system-logs-contracts.md), and the existing API/UI reports. This is the explicitly authorized offline integration slice; it does not implement Phase 2D.2, performance hardening or production activation.

## Integration architecture

The root command `pnpm test:system-logs-integration` owns the full lifecycle:

1. Create a unique ignored `.ci-tools/system-logs-offline-*` directory and reserve a loopback web port. Start the existing API compiler/native runner with the explicitly selected `tests/support/system-logs-browser-server.ts` entry, **not** the direct-import `--fixture` path.
2. Native `node --test` creates the child worker. The fixture asserts genuine `NODE_TEST_CONTEXT=child-v8`, test mode and no preconfigured database URLs. No code sets/spoofs that marker. `startSystemLogsApp()` reuses the actual PGlite ownership/client/URL attestation, existing migrations, shared Prisma instance, auth middleware and management-history services.
3. Start the real Express application on an ephemeral loopback port and a second default-composition application that stays closed. A separate nonce-protected loopback control server manages only synthetic sessions, test source faults, counters and shutdown. It is not an Express application route, frontend flag or production endpoint.
4. Write a private, exclusive-create manifest containing controlled origins and synthetic test data. No JWT signing key or database connection string is exported. Session credentials are issued by the real auth service on demand; the browser stores issued access/refresh tokens in sessionStorage. A real internal-login form case exercises the normal sign-in request and subsequent authenticated navigation.
5. Run the root API/web production build with server-only `API_PROXY_TARGET` pointing at the owned Express fixture. Assert the generated routes manifest contains the exact `/api/:path*` destination. Start the resulting standalone Next server on loopback.
6. Run three separately named Playwright projects, sequentially with one worker because session/fault controls share a fixture. Assert that both real projects reached the actual Express server and that the complete history digest remains unchanged.
7. Stop the directly owned web process, request native-worker shutdown, wait for fixture cleanup, and remove the manifest. Existing PGlite/server hooks close connections and the native runner removes its own compiled test directory. Cleanup checks actual exit with bounded waits; forced native-runner cleanup fails the workflow. Only processes created by this run are targeted, never existing servers found by port/name. Browser artifacts contain synthetic data and remain in the ignored run directory.

### Three distinct kinds of browser evidence

| Project             | Request path                                                                                                                           | What it proves                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `express-forwarded` | Browser uses standard same-origin client URL; Playwright continues API traffic to the real Express fixture without replacing responses | Actual UI/client, Bearer auth, controllers, validation, readers, signed cursors and PGlite behavior through a controlled test transport |
| `next-rewrite`      | Browser → production-built standalone Next `/api` rewrite → real Express → PGlite                                                      | The actual Next proxy path works; same-origin API requests are not intercepted, redirected or fulfilled by Playwright                   |
| `frontend-fixtures` | Existing `system-logs.spec.ts` isolated JSON fixtures                                                                                  | Existing mocked UI regression only; not evidence of database/API integration                                                            |

Supplemental raw API requests target Express directly in the forwarded project and the web origin in the rewrite project. The rewrite project only routes **non-loopback external** browser requests to abort; its same-origin API traffic has no Playwright route handler. Service workers are blocked. Normal production security/cache behavior remains active, including `Cache-Control: no-store` and the existing Unavailable indication.

Production-built **Next** does not imply production-mode **Express**: Express remains a real native-worker offline test composition. The normal/default API still returns 404, and the existing backend regression suite retains production-mode activation-denial tests. No production activation mechanism or durable access-evidence exception is added.

## Credential and environment isolation

The launcher copies only required OS/tool-location variables into child environments. Application URLs/keys, cloud credentials, inherited worker markers, live-regression settings and caller NODE_OPTIONS are not inherited. The test-only Node preload blocks reads/opens/stat/copy of private `.env*` files and disables `process.loadEnvFile` before Next/Prisma/dotenv can load them. Checked-in `.env.example` templates remain readable for formatting; they are not loaded into the environment. A focused unit test checks synchronous/asynchronous reads, loader rejection and ordinary/template file access using synthetic files.

The dedicated Playwright configuration never imports the live-capable default configuration or `.env.regression.local`. All fixture origins must be explicit `http://127.0.0.1:<port>` origins without credentials, paths or query strings. Inherited live origins and frontend API overrides are dropped. Native worker context can only be established by Node; the clean-environment helper rejects attempts to supply it as an override.

Build/typecheck commands receive only a synthetic non-listening loopback `DIRECT_URL` where Prisma configuration needs a URL. Generation does not run migrations or connect to that address. API tests receive no configured database URL until their own PGlite fixture assigns one. No real environment-file contents, credentials or production/staging database were read or used by the workflow.

The environment guard, control nonce, manifest and test transport header exist only in test tooling. They neither open the backend production gate nor grant application authorization. No new `NEXT_PUBLIC_` activation variable, mock production endpoint, cookie auth or localStorage token persistence is introduced.

## Synthetic data and fault boundaries

The fixture first verifies a genuinely empty management history and a closed default API. It then appends 64 valid records: 32 account records (31 Administration, one Client Management/Service Operations) and 32 Workforce/People & HR records. Equal timestamps, one shared operation and a native `shared` row ID in **both** sources exercise deterministic ordering, source-aware event identities and page-scoped operation grouping. Actors and subjects intentionally have no live records; role-at-time remains persisted `ADMIN`, with a safe `STAFF → ADMIN` transition for details.

Another 502 malformed synthetic account records live ten days earlier, outside the initial seven-day UI range. They contain a private sentinel and are selected only by explicit date/actor filters. They verify omission counts, a 500-candidate scan frontier, empty incomplete pages and signed continuation without raw history disclosure. No fixture history is deleted, rewritten or repaired; all 566 rows retain the same digest after browser reads and shutdown.

Source failures are injected only at the owned Prisma client's raw source-read boundary. Authentication/current-account reads still use the real database, and controllers/services generate all response bodies and availability metadata. No HTTP JSON is mocked in the real projects. No table rename, permission change, guard disable or schema modification is used to induce these browser faults. This is controlled source-read fault injection, not a physical database/network outage or failover certification.

Synthetic session controls use real users, password hashes, JWT/session issuance and database session/account changes. They cover revoked/expired sessions, inactivity, retirement and demotion. No existing business mutation/writer behavior is changed. Session bookkeeping and test setup account changes are distinct from observational management-history reads.

## Behavioral coverage

- Actual internal sign-in; authenticated same-origin client requests; sessionStorage-only tokens; all non-Superadmin roles, inactive/retired/revoked/expired/demoted accounts and direct-route denial. All three API endpoints deny before invalid-query parsing. An already-open page receives 401 after revocation, hides the table data and loses its token; reload redirects to sign-in.
- Shared navigation from Administration, People & HR, Service Operations, Project Management and Workforce Compliance using the existing registry's actual entry paths. Origin-derived filters, manual module changes, unsupported-module no-query behavior and All Modules' limited coverage remain explicit.
- Mobile 390×844, tablet 768×1024, laptop 1280×800 and desktop 1600×1000. Real pagination, details, Escape/focus restoration, operation investigation and Back run at every width with no page overflow.
- Module/source/event/action/actor/subject type/subject ID/date/operation filtering; real signed cursor progression and Back/previous-page state. Two pages contain 50 and 14 unique source-aware events, with one operation **on each page** and no global completeness claim. Tampered and cross-session cursors, repeated/unknown filters and excessive date ranges are rejected. HEAD preserves authorization/no-store and returns no body.
- Historical actor/role/deleted-subject details and safe transitions; empty results; malformed-only windows; partial-source and all-source unavailable metadata; no continuation on partial outage; retry replaces 32 partial events with 50 recovered events instead of appending. Detail-source errors retry safely.
- Privacy sentinels, raw source JSON keys and internal error indicators stay absent from history responses and visible content. Full history digests are unchanged. Source coverage and `grouping.scope = page` remain visible and correct.

## Initial failures and defect classification

The initial scaffold runs exposed test/harness assumptions, not confirmed product defects:

| Initial failure                                                                                             | Resolution                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Obsolete attendance `/attendance/overview` path redirected to the module selector                           | Derive the actual entry from the shared module registry (`/attendance/time-logs/overview`)                                                                       |
| Expected a literal Shared heading on a module-neutral mobile sidebar                                        | Verify the existing shared utility links and navigation; the current layout intentionally omits that heading when no workspace is selected                       |
| Action option used title case rather than the existing humanizer's sentence case                            | Use the real `Role changed` option                                                                                                                               |
| Unscoped alert locator also matched Next's route announcer                                                  | Scope the assertion to the audit table's error alert                                                                                                             |
| End-of-run request counter saw stripped URLs after Express mounted its router                               | Observe incoming requests before Express with a test-only `prependListener`; retain the positive reachability assertion                                          |
| Environment preload blocked public `.env.example` templates during formatting; CommonJS imports failed lint | Allow only the checked-in template filename for ordinary file IO, keep environment loading blocked, and use an ESM preload without lint suppression              |
| Shell-based process termination silently failed, leaving the command open after passing tests               | Stop the directly owned standalone Node process, assert its exit, cancel unused response bodies and clear cleanup timers; always attempt native fixture shutdown |

No production UI/API defect requiring an application change was established. Assertions, security boundaries, activation checks and API contracts were not weakened to obtain passing tests.

## Changed files

| File                                                                                                                                        | Purpose                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [Native browser server](../../apps/api/tests/support/system-logs-browser-server.ts)                                                         | Owned PGlite/Express fixture, synthetic data/sessions, bounded local controls, source-read fault injection and observational checks |
| [Existing offline app helper](../../apps/api/tests/support/system-logs-app.ts)                                                              | Expose its already-owned HTTP server to test instrumentation; activation attestation unchanged                                      |
| [Real integration spec](../../apps/web/e2e/system-logs-integration.spec.ts)                                                                 | Same real behavior suite through forwarded Express and actual Next rewrite                                                          |
| [Isolated Playwright config](../../apps/web/playwright.system-logs.config.ts)                                                               | Non-live, sequential projects with separate real/mocked evidence                                                                    |
| [Lifecycle runner](../../apps/web/scripts/system-logs-integration.mjs)                                                                      | Own ports, native worker, production build, standalone server, tests and cleanup                                                    |
| [Clean environment](../../apps/web/scripts/offline-environment.mjs), [environment-file guard](../../apps/web/scripts/offline-env-guard.mjs) | Strip inherited credentials/live configuration and prevent private environment-file loading                                         |
| [Environment tests](../../apps/web/test/offline-environment.test.mjs)                                                                       | Verify stripping, native-marker restriction, loader protection and loopback-only origins                                            |
| [Root package](../../package.json)                                                                                                          | Add the explicit offline integration command                                                                                        |
| This report, [feature index](README.md), [module reference](../../.agents/skills/nexus-platform/references/modules.md)                      | Current test capabilities, evidence and limitations                                                                                 |

Existing application code, production configuration, database definitions/permissions, migration files, logging sources and all pre-existing uncommitted work are preserved.

## Commands and validation

From the repository root:

```powershell
# Fresh fixture, root production build, both real projects, separate mocked project.
pnpm.cmd test:system-logs-integration

# Also run formatting, lint, regenerated typechecks and backend/frontend units.
pnpm.cmd test:system-logs-integration -- --quality

# Reuse the same credential-free child environment for quality checks only.
pnpm.cmd test:system-logs-integration -- --quality-only
```

No live credentials or environment-file setup is required. Existing installed dependencies/Chromium are required; the runner does not install services or contact a live database. It always builds the web rewrite for that run's owned API port; it never trusts an arbitrary external base URL or an old build as proxy evidence. **Do not deploy the resulting test artifact:** its rewrite targets a disposable fixture that is stopped after testing. A normal authorized release must build with its separately verified production target while keeping System Logs closed.

Validation on local Windows with the installed Chromium:

| Check                                                                           | Result                                                                    |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Real browser → Express → PGlite, `express-forwarded`                            | 22/22 passed                                                              |
| Real browser → production-built Next rewrite → Express → PGlite, `next-rewrite` | 22/22 passed                                                              |
| Separate mocked System Logs responsive/UI project, `frontend-fixtures`          | 14/14 passed                                                              |
| Native worker fixture, including shutdown/history digest assertions             | 1/1 passed; all 566 history rows unchanged                                |
| Complete backend regression suite                                               | 443/443 passed, no skips                                                  |
| Complete frontend unit suite                                                    | 132/132 passed, no skips; includes three new environment-isolation checks |
| Root `pnpm format`, `pnpm lint`, `pnpm typecheck`                               | Passed, including fresh Prisma and Next type generation                   |
| Root production API/web `pnpm build`                                            | Passed; generated rewrite target verified before browser tests            |

The quality-only workflow exits successfully with the same credential-free environment used by integration. Expected fault-injection diagnostics and an existing `pg` overlapping-query deprecation warning are non-failing; no new application failure remains. Intermediate failed scaffolding runs are retained only in ignored task artifacts. Other feature Playwright suites, real PostgreSQL privilege tests and hosted/live integration are not claimed by this validation.

## Limitations and Phase 2D.3B prerequisites

- Evidence is Chromium on local Windows with synthetic fixtures and responsive viewport widths, not Safari/Firefox, real mobile hardware, hosted TLS/proxy behavior or production traffic.
- PGlite exercises actual SQL through Prisma/pg but does not certify deployed grants, RLS, owners, poolers, replicas, backup/restore or load. Phase 2D.1B's deployed privilege verification remains blocked pending authorized operator evidence; the existing immutability migration is not deployed by this workflow.
- Source-read exceptions are controlled test faults, not a physical database outage. No independently durable logs-access evidence, queue/spool, retention enforcement, security collection or production readiness mechanism is implemented. Phase 2D.2 remains outstanding.
- The fixture is intentionally small and serial. Test durations are functional results, not capacity/SLO measurements. Source scan caps bound fetched candidates, not physical PostgreSQL sorting/scanning; independent source transactions and late-commit pagination limitations remain unchanged.
- Before any separately authorized Phase 2D.3B, approve the performance scope/SLO, representative synthetic distributions and a disposable PostgreSQL/pooler environment matching the intended deployment. Measure exact existing queries, memory/scan/sort/pool contention, cursor boundaries and business-workload impact. Any index, query/admission/time-budget change needs verified justification and separate authorization; none starts here.
- Production activation still requires actual database/credential protection verification, durable access-evidence acceptance/outage behavior, capacity qualification and a separate release decision. Passing this offline suite does not waive those prerequisites.

**Stop after Phase 2D.3A.** No Phase 2D.3B, infrastructure deployment, production permission change or production System Logs access is authorized or enabled.

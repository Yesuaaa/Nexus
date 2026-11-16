# Controlled local System Logs activation (Phase 5A)

Developed: 2026-11-16

System Logs can now be used in the regular Next.js development frontend and Express `startApi` composition through an explicitly selected, synthetic local demonstration. Ordinary `pnpm dev`, ordinary API startup and production remain closed. No environment enable flag or HTTP request can activate diagnostics.

## Start and use

Stop any other Next development server in this checkout first; Next owns one development-output lock per checkout. From the repository root, with the existing pnpm dependencies installed and `NODE_ENV` unset or set to `development` (no `.env` edits are needed):

```sh
pnpm dev:system-logs-demo
```

The command compiles the API, creates and migrates a fresh in-memory PGlite database using existing migrations, and starts the normal Express server and installed Next development CLI on loopback. Open **http://127.0.0.1:5174/internal/login**. Sign in as **superadmin@demo.invalid** with the random **Password for this run** printed in the terminal. Select Administration (or another workspace), then open Shared → **System Logs (Unavailable)**, or navigate to `/system-logs`. The retained Unavailable label and production-release notice refer to production restrictions; this owned local composition supports all three views.

- **Activity & Audit:** synthetic account provisioning uses existing services and history writers, including their dependent Workforce records. Existing workspace defaults, All Modules, compatibility prompts, filters, signed cursors and details are retained. No synthetic Project/Service/Attendance history is fabricated.
- **Errors & Exceptions:** one deliberate, rolled-back division-by-zero probe demonstrates the existing sanitized error collector. Its SQL/raw exception is never returned. Further failures use the normal collector. These are ephemeral demonstration records, not production incidents or durable evidence.
- **System Health:** observes this ordinary API process, its owned database, the actual message-expiry job and retained error buffer. The deliberate sample error can make the recent-error summary Degraded even when database readiness and the job are Healthy. Observations remain instance-local.

`admin@demo.invalid`, `staff@demo.invalid` and `user@demo.invalid` use the same per-run password for authorization demonstrations. They cannot read System Logs. Credentials are never written to a tracked file. **Ctrl+C stops both servers and destroys all demonstration data.** Restart creates a new database, JWT key, password and sessions. This is a separate browser origin from the ordinary application; real application tokens are not reused.

To use a different unoccupied loopback frontend port:

```sh
pnpm dev:system-logs-demo --port 5175
```

The API and database choose ephemeral loopback ports owned by the launcher. No database URL, database path, host or credential override is accepted. A busy frontend port fails instead of reusing or silently switching to an existing application. This mode provides frontend development refresh; restart the command after backend changes to recompile the API. No configured Supabase/file-storage integrations, outbound geolocation or real-data seeding are enabled.

For automated verification against the same ordinary development app, with the existing Playwright browser installed:

```sh
pnpm dev:system-logs-demo --verify
```

This starts the same runtime, signs in through the UI without session injection or API interception, tests mobile/desktop usage and authorization, then stops the owned processes. It does not use a native test worker, the offline fixture callback, or a test-control HTTP server.

## Why normal development returned 404

The original router requires `NODE_TEST_CONTEXT=child-v8` plus a genuine fixture ownership callback, with an unconditional production denial. Normal `createApp()`/`startApi()` supplies neither proof. The existing fixture path is retained. The new development path supplies an opaque process-local capability that only the fresh owned database constructor can issue. Setting `NODE_ENV=development`, an arbitrary System Logs flag, a spoofed callback, or a deserialized object cannot establish that capability in ordinary startup.

## Protections

- The parent launcher rejects production, other non-development environments and native test workers. API capability issuance requires exact development mode, an owned IPC child, no inherited database URLs and no existing Prisma client. It creates its own fresh PGlite instance; callers cannot inject storage, connection URLs or existing data.
- Existing credential-isolation utilities strip inherited database/auth/storage credentials, external origins, test markers, geolocation, live-regression settings and Node preload options from child processes. The existing environment-file preload blocks `.env` reads before Prisma, dotenv or Next can load credentials. The demo generates a fresh signing key and password. It never imports `index.ts`/dotenv or test fixtures.
- Both HTTP servers and the database socket bind IPv4 loopback. Diagnostic demo reads additionally require loopback socket addresses. Next retains its same-origin `/api/*` rewrite to the owned API.
- Every diagnostic request rechecks development mode, IPC lifetime, live database ownership, exact database/Web origins and the same Prisma client. Changed URLs, an unexpected direct URL, disposed ownership or loss of the parent channel close access. Production always returns 404, even with previously issued ownership.
- Existing current-session authentication, active-account and Superadmin checks, revocation/role-change checks, privacy projections, `no-store`, safe error boundaries and read-only diagnostic contracts remain authoritative. Diagnostic routes stay ahead of development error decoration.
- Existing native-worker attestation is unchanged. It cannot mint the demo capability; the demo cannot use it to attest test ownership. No production activation path, durable evidence claim, new provider, schema, migration, diagnostic source or UI redesign is introduced.

## Changed files

- `apps/api/src/features/system-logs/local-demo.ts`: owned synthetic database/capability lifecycle, reusing PGlite, existing migrations and Prisma.
- `apps/api/src/features/system-logs/system-logs.controller.ts`, `apps/api/src/app.ts`, `apps/api/src/server.ts`: narrow explicit composition option, loopback checks and unchanged production/test authorization boundaries.
- `apps/api/src/lib/db.ts`: read-only initialized-client guard to prevent reusing any pre-existing pool.
- `apps/api/src/development/system-logs-demo.ts`: synthetic setup through existing user/history services, sample error through the existing collector, ordinary API startup and disposal.
- `scripts/development/system-logs-demo.mjs`, `apps/web/scripts/system-logs-demo-web.mjs`, `package.json`: credential-isolated owned launcher and installed Next development CLI lifecycle.
- `apps/web/scripts/offline-environment.mjs`, `apps/web/scripts/offline-env-guard.mjs`, `apps/api/src/features/error-logs/error-log.controller.ts`: comments/help text reflecting reuse by controlled local demonstrations; no isolation-policy relaxation.
- `apps/api/tests/features/system-logs/local-demo.test.ts`, `apps/api/tests/support/system-logs-demo-probe.ts`: forged capability/native-worker refusal and genuine native development-process tests for role, inactivity, revocation, production denial, ownership changes, default closure and disposal.
- `apps/web/playwright.system-logs-demo.config.ts`, `apps/web/e2e/system-logs-demo.spec.ts`, `apps/web/test/system-logs-demo-launcher.test.mjs`: ordinary development-app browser verification and launcher misuse/port guards.
- This report and the feature/RBAC/repository-reference indexes: startup and deployment guidance.

## Validation

| Check                                                           | Final result                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm build` | Passed, exit 0. API and production web build are unchanged in default activation behavior.                                                                                                                                                                                                                                                                                                                                                                      |
| Complete frontend unit suite                                    | 143/143 passed, including two new launcher safety tests. Existing environment-isolation tests also passed.                                                                                                                                                                                                                                                                                                                                                      |
| System Logs API suites                                          | 43/43 passed: audit readers, privacy, attribution, filters/cursors, outages, Errors, Health, existing native fixture gating and the new development capability.                                                                                                                                                                                                                                                                                                 |
| Targeted startup/gate/shutdown suites                           | 9/9 passed. Includes the two demo capability tests rerun after the final loopback restriction; these overlap the 43-test feature result rather than adding nine distinct feature cases.                                                                                                                                                                                                                                                                         |
| Existing offline integration workflow                           | 74/74 Playwright cases passed: 26 real Express/PGlite-forwarded, 26 real built Next rewrite and 22 mocked UI regressions. The native fixture lifecycle test passed; histories remained unchanged.                                                                                                                                                                                                                                                               |
| Ordinary development-app browser workflow                       | `pnpm dev:system-logs-demo --port 5174 --verify`: 2/2 Playwright cases passed at 390px and 1600px. Real sign-in/sessionStorage, workspace scope, five genuine provisioning audit records and details, sanitized captured errors/correlation, Healthy database and actual job observations, role denial, missing authentication, invalid-query privacy and revocation were verified without API interception or injected sessions. Both servers stopped cleanly. |
| Ordinary command without `--verify`                             | Separate native-process smoke check passed: normal mode stayed running, accepted sign-in and returned 200 for all three views through Next's same-origin rewrite, then exited 0 on stop. Both owned HTTP ports refused connections afterward.                                                                                                                                                                                                                   |
| Scope, links and whitespace                                     | Baseline hashes and final diff review confirm the listed changes; existing UI/filter compatibility, source adapters, writers, schemas/migrations and unrelated uncommitted work were preserved. Documentation links and `git diff --check` passed.                                                                                                                                                                                                              |

Final logs and exit-code summaries: `.ci-tools/system-logs-5a-*`. The existing integration artifacts are in `.ci-tools/system-logs-offline-mI8wQi`; ordinary app browser output uses `apps/web/test-results/system-logs-demo`. The existing pg overlapping-query deprecation warning and reduced-motion notice were non-failing. The unchanged full backend business-test matrix was not repeated; the feature and affected startup/security suites above were run. These results cover local Chromium synthetic viewports, not a hosted deployment or real mobile hardware. All validation processes were stopped; run the start command above to open a fresh demonstration.

## Deployment requirements and limitations

This mode authorizes only local synthetic demonstrations. It does not unlock an existing configured database, migrate a hosted database, demonstrate a replicated deployment, or make errors/access evidence durable. It is deliberately ephemeral and uses development dependencies and the installed Next CLI. Do not expose it through a tunnel or public reverse proxy, reuse its generated credentials elsewhere, or use it for real records.

Production still requires the deployment privilege/ownership/RLS and append-only protection verification described in [the privilege assessment](system-logs-deployment-privileges.md), an approved durable access-evidence provider and acknowledgement/fail-closed implementation from [the evidence design](system-logs-durable-access-evidence.md), and a separately reviewed activation/access/privacy/operational release plan. Existing buffer loss/24-hour retention and instance-local health limits remain. Nothing in Phase 5A establishes those deployment prerequisites.

Stop after Phase 5A. No production access or additional diagnostic feature is activated.

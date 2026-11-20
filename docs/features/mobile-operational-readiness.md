# Mobile operational readiness

Developed: 2026-11-17

This runbook is the deployment and incident reference for the Nexus client
mobile release. The Kotlin client calls the existing Express API; there is no
mobile facade. In-app workflow notifications remain the release notification
path. Native push is deferred in [Native push plan](mobile-push-plan.md).

## Contract ownership

The inventory is derived from the current repositories under
`apps/mobile/shared/src/commonMain`. A contract is release-owned only when the
listed API suite or the named mobile-regression owner has checked it.

| Mobile area                | Consumed API contracts                                                                                                                                       | Existing evidence or owner                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Authentication and profile | `/api/auth/login`, `register`, `refresh`, `logout`, `me`, `profile`, `profile/images`, `change-password`, `settings`, `sessions/*`                           | `jwt-session.test.ts`, `profile.test.ts`, `settings.test.ts`, native auth/profile tests                                      |
| Catalog and booking        | `/api/client/services`, service detail/specialists, `/api/client/service-requests`, booking detail and cancellation, accepted cancellation through workflows | Client integration, request, specialist, workflow tests; dedicated mobile regression owned by the mobile-regression teammate |
| Request conversations      | Conversation list/history/send/read and `/:id/events`                                                                                                        | `request-conversations.test.ts` plus native communication tests                                                              |
| Project conversations      | Project conversation list/history/send/read                                                                                                                  | `project-conversations.test.ts` plus native communication tests                                                              |
| Workflow                   | Workflow snapshot/actions, file upload/download, notifications/read state                                                                                    | `request-workflow.test.ts` plus native workflow/attachment tests                                                             |
| Projects and calendar      | Project list/detail/brief/change/cancellation/deliverable review/file and calendar                                                                           | Workflow, calendar, and project-conversation API tests; native project tests                                                 |
| Billing                    | `/api/request-workflows/billing` and authorized workflow-file receipts                                                                                       | Native billing tests; backend mobile-contract coverage is owned by the mobile-regression teammate                            |
| Help center                | No API contract; content is bundled in the app                                                                                                               | Native navigation/UI owner                                                                                                   |

The dedicated mobile API regression remains at
`apps/api/src/mobile/regression.spec.ts` and is intentionally not changed by
issue #157. On November 17, 2026, its query-boundary case expected page
`1,000,000` to succeed, but the shared API pagination limit changed to
`100,000` on November 12. The mobile-regression teammate owns reconciling that
assertion and adding any missing billing/mobile journey cases. Do not claim
`pnpm test:mobile` as passing until that follow-up lands.

## Production transport and limits

- Release builds must use a trusted HTTPS origin. Do not ship localhost, LAN
  addresses, cleartext exceptions, embedded credentials, or an `/api` suffix
  duplicated with endpoint paths.
- Web keeps same-origin `/api` routing through Next.js. Native clients use the
  configured API origin directly and send bearer tokens from secure storage.
- Configure only actual reverse-proxy addresses in `TRUST_PROXY`. The ingress
  must replace forwarded headers and preserve `X-Request-Id` responses.
- API replicas must share the same `JWT_SECRET`. Run committed Prisma
  migrations before restarting the API; issue #157 adds no migration.

Current JSON limits are route-specific:

| Routes                                                                   |                                   Limit |
| ------------------------------------------------------------------------ | --------------------------------------: |
| Default API routes, including login and most project/conversation writes |                                  16 KiB |
| Client and legacy service-request routes                                 |                                  64 KiB |
| Workflow actions                                                         |                                  64 KiB |
| Specialist profile updates                                               |                                 128 KiB |
| Profile images                                                           | 3 MiB JSON; decoded image maximum 2 MiB |
| Workflow files                                                           |  7 MiB JSON; decoded file maximum 5 MiB |
| Project deliverable upload                                               |                                   7 MiB |
| Deliverable rejection                                                    |                                   8 KiB |

Workflow files allow PDF, DOC/DOCX, PNG, JPEG, and UTF-8 plain text. File name,
extension, MIME signature, base64 encoding, and ownership are validated. A
request may retain at most 100 files and 100 MiB total. Private or unsent files
must never be placed in logs or public URLs.

Client booking history defaults to page 1 with a fixed page size of 10 and a
maximum page of 100,000. Search is at most 100 characters. Conversation lists
and histories use opaque stable cursors; clients must not manufacture cursors.

Registration, login, refresh, profile update, and profile image upload have
per-process/IP one-minute limits of 10, 60, 120, 30, and 20 respectively in
production. Failed passwords are limited to 10 per IP/email over 15 minutes.
There is no universal application rate limiter. Multi-replica production needs
a shared limiter or trusted ingress limits. Preserve `Retry-After` on 429s.

## SSE deployment behavior

`GET /api/request-conversations/:id/events` authenticates the current session
and participant before opening and again during the stream. It emits
`connected`, `messages-changed`, `heartbeat`, `reconnecting`, and
`access-revoked`; event bodies contain no message text or credentials.

- The API writes a proxy keep-alive comment every 10 seconds and revalidates
  access on a 15-second heartbeat.
- Each stream closes after 55 seconds. The client reconnects with its normal
  serialized access-token refresh and reloads persisted history.
- Ingress must disable response buffering, permit `text/event-stream`, keep the
  connection open longer than 60 seconds, and avoid response compression or
  caching transformations. The API sends `X-Accel-Buffering: no` and
  `Cache-Control: no-store, no-transform`.
- Do not put access tokens, refresh tokens, conversation text, or file data in
  an SSE URL or event.

## Safe observability

Every request receives a server-generated `X-Request-Id`; inbound identifiers
are not trusted. API diagnostics are structured single-line JSON containing
only event name, severity, request ID, method, route path, status, source
location, safe domain identifiers, and a bounded error name/code.

Never log authorization/cookie headers, tokens, passwords, request/response
bodies, data URLs, private storage paths, file bytes, conversation text, or
provider payloads. Search production logs for the request ID, not client data.
The logger redacts sensitive keys and bearer/data-URL patterns as a second
boundary, but callers must still pass metadata rather than payloads.

## Deployment and smoke procedure

1. Record the release SHA and target environment. Confirm the expected database
   and migration status before deployment.
2. Set production secrets and origins. Build and deploy API/web artifacts, then
   wait for `/api/health` and `/api/db-check` to succeed.
3. Run the full staging smoke with controlled USER and current department-head
   accounts, an active service routed to that head, and a client-owned project:

   ```powershell
   $env:NEXUS_SMOKE_MODE="staging"
   $env:NEXUS_SMOKE_BASE_URL="https://staging-api.example.com"
   $env:NEXUS_SMOKE_CLIENT_EMAIL="mobile-smoke-client@example.com"
   $env:NEXUS_SMOKE_CLIENT_PASSWORD="<secret>"
   $env:NEXUS_SMOKE_HEAD_EMAIL="mobile-smoke-head@example.com"
   $env:NEXUS_SMOKE_HEAD_PASSWORD="<secret>"
   $env:NEXUS_SMOKE_PROJECT_ID="<client-owned-project-id>"
   # Optional when the first active service is not the smoke fixture:
   $env:NEXUS_SMOKE_SERVICE_ID="<active-service-id>"
   pnpm smoke:mobile-release
   ```

   The runner verifies auth, catalog/history, booking and department acceptance,
   request SSE/message delivery, workflow upload/download, notifications,
   billing, project reads, and cancellation. Records include a
   `[mobile-release-smoke:<uuid>]` tag. A failed cleanup prints only the booking
   ID so an operator can cancel it manually.

4. After production deployment, use a controlled client account in read-only
   mode. Do not set department-head credentials:

   ```powershell
   $env:NEXUS_SMOKE_MODE="production"
   $env:NEXUS_SMOKE_BASE_URL="https://api.example.com"
   $env:NEXUS_SMOKE_CLIENT_EMAIL="mobile-production-check@example.com"
   $env:NEXUS_SMOKE_CLIENT_PASSWORD="<secret>"
   $env:NEXUS_SMOKE_PROJECT_ID="<optional-client-owned-project-id>"
   pnpm smoke:mobile-release
   ```

5. Record pass/fail, release SHA, UTC time, environment, and emitted request
   IDs. Remove the smoke secrets from the shell/session afterward. Never paste
   tokens, credentials, response payloads, or downloaded files into tickets.

`NEXUS_SMOKE_ALLOW_HTTP=true` is reserved for local/mock verification and must
not be set in staging or production.

## Incident checks

### Authentication failures

1. Use the response request ID and status. Check clock/TLS, account active role,
   session expiry, and shared `JWT_SECRET` before inspecting application code.
2. For `ACCESS_TOKEN_EXPIRED`, confirm one serialized refresh. A failed or
   replayed refresh requires sign-in; do not loop or retry with the same token.
3. For 429, honor `Retry-After`, check ingress and per-process counters, and
   confirm proxy IP trust. Never request the user's token or password for logs.

### SSE disconnects

1. Confirm ordinary 55-second rotation is not being mistaken for an incident.
2. Check proxy buffering, compression, and idle timeout; verify keep-alive data
   every 10 seconds and heartbeat validation every 15 seconds.
3. Distinguish `access-revoked` from `reconnecting`. Confirm the account still
   participates, then reload history to recover missed invalidations.

### Upload or download errors

1. Check 400/413 against the documented JSON/decoded limits, MIME signature,
   extension, file name, and base64 encoding.
2. Check 403/404 against current participant ownership and client visibility;
   do not expose whether a foreign private file exists.
3. Check 409 against workflow stage, upload-ID replay, count, and total bytes.
   Check 503 storage/database configuration using request IDs only.

### Rate limiting

1. Record route, request ID, source environment, replica, status, and
   `Retry-After` without headers or payloads.
2. Verify ingress source-IP normalization and whether traffic is distributed
   across replicas. Do not weaken authentication limits during an incident.

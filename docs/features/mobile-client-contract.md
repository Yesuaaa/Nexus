# Mobile client contract and security audit (#155)

The KMP client uses the existing Express APIs. There is no `/api/mobile`
facade. Web consumers retain same-origin `/api/...` calls through Next.js.
This document covers auth, self-service profiles, discovery, booking and the
workflow cancellation boundary; messaging and other workflow features are excluded.

## Connection and authentication

Base URLs are origins **without** `/api`; endpoint paths already include it.

| Target                                        | API origin                  | Requirements                                                                                        |
| --------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------- |
| Android with USB forwarding (current default) | `http://localhost:3001`     | `adb reverse tcp:3001 tcp:3001`, or `pnpm dev:mobile`; reapply after disconnect/restart             |
| Android standard emulator, direct host access | `http://10.0.2.2:3001`      | Configure the shared HTTP client with this origin; localhost alone points at the emulator           |
| iOS simulator on the API host Mac             | `http://localhost:3001`     | API must run on that Mac; a Windows-hosted API needs its reachable LAN address                      |
| Physical Android/iOS over LAN                 | `http://<host-LAN-IP>:3001` | Same reachable network, listening interface and firewall; development-only HTTP platform allowances |
| Production                                    | `https://<API-host>`        | Trusted TLS; no localhost/LAN address or release cleartext exception                                |

The current shared default is localhost with Android forwarding. Platform/release
configuration belongs to the frontend; backend hardening does not change it.
CORS configuration applies to browser origins, not native authentication.
Images use returned public URLs, never internal bucket paths. Resolve any relative
URL against the configured API origin, not the device's localhost.

Protected calls send `Authorization: Bearer <token>`. There are no session cookies;
API responses use `Cache-Control: no-store`. Web stores tokens in sessionStorage.
Native clients use their existing secure storage abstraction.

Access JWTs last up to 900 seconds, bounded by the session's absolute seven-day
expiry. Refresh uses a 43-character opaque token in JSON, rotates once, and does
not extend that absolute expiry. Replaying a consumed refresh token revokes its
session family. Concurrent refreshes can produce one 200 and one 401, with the
family revoked: clients must serialize refresh and must not retry it blindly.
Logout revokes the current session; password changes revoke all account sessions.
Every protected request reloads the session and current account status/role;
JWT claims cannot retain former role permissions. Inactive/deleted accounts fail
with 401; current non-USER roles cannot use client routes (403).

## Endpoint inventory

All bodies are JSON. Statuses below are success statuses; errors are listed later.
`session` means `{ token, refreshToken, expiresIn, user }`. Refresh returns only
`{ token, refreshToken, expiresIn }`, without a user object.

| Method and path                                | Auth          | Request                                  | Success response                                               |
| ---------------------------------------------- | ------------- | ---------------------------------------- | -------------------------------------------------------------- |
| POST `/api/auth/register`                      | None          | fullName, contactNumber, email, password | 201 session; role always USER, active                          |
| POST `/api/auth/login`                         | None          | email, password                          | 200 session                                                    |
| POST `/api/auth/refresh`                       | Refresh token | refreshToken                             | 200 rotated credentials                                        |
| POST `/api/auth/logout`                        | Bearer        | No body required                         | 204 empty                                                      |
| GET `/api/auth/me`                             | Bearer        | None                                     | 200 `{ user }`                                                 |
| GET `/api/auth/profile`                        | Bearer        | None                                     | 200 profile                                                    |
| PATCH `/api/auth/profile`                      | Bearer        | fullName, contactNumber                  | 200 updated profile                                            |
| POST `/api/auth/profile/images`                | Bearer        | kind, dataUrl                            | 201 `{ url, profile }`                                         |
| POST `/api/auth/change-password`               | Bearer        | currentPassword, newPassword             | 204 empty; sign in again                                       |
| GET `/api/client/services`                     | USER          | None                                     | 200 `{ services }`, unpaginated                                |
| GET `/api/client/services/:id`                 | USER          | Service ID                               | 200 `{ service }`                                              |
| GET `/api/client/services/:id/specialists`     | USER          | Service ID                               | 200 `{ specialists }`, unpaginated                             |
| POST `/api/client/service-requests`            | USER          | Booking draft                            | 201 `{ serviceRequest: receipt }`, including identical retries |
| GET `/api/client/service-requests`             | USER          | History query                            | 200 `{ requests, total, page, pageSize, summary }`             |
| GET `/api/service-requests/:id`                | USER owner    | Request ID                               | 200 `{ serviceRequest }`, full safe client booking detail      |
| POST `/api/client/service-requests/:id/cancel` | USER owner    | No body required                         | 200 `{ success: true }`                                        |
| GET `/api/request-workflows/:id`               | Participant   | Request ID                               | 200 workflow snapshot for cancellation/version                 |
| POST `/api/request-workflows/:id/actions`      | Participant   | CANCEL command below                     | 200 permitted workflow snapshot                                |

Compatibility APIs remain: GET `/api/services/available` is an authenticated
active catalog; POST `/api/service-requests` shares booking submission; GET
`/api/service-requests` returns `{ serviceRequests, total, page, pageSize }`
with safe legacy summary rows rather than the richer client history envelope.
No management endpoints are needed for the mobile booking journey.

### DTOs, validation and projections

Registration trims name/contact and normalizes email; name is 2-100 characters,
email uses the existing .com/.ph rules and contact is `^(08|09)\d{9}$`.
Passwords require 12 characters, upper/lowercase, digit, special character and
at most 1,024 UTF-8 bytes. Login preserves its existing normalization rules.
Profile PATCH requires both fullName (2-100) and contactNumber (empty clears it;
otherwise existing optional-plus/digits/spaces/hyphens, 7-20 characters). Profile
editing intentionally retains its broader contact validation for web compatibility.
Role, status, email and client-supplied user IDs cannot change identity/ownership.

`user` preserves the existing publicUser fields: id, email, fullName, imageUrl,
contactNumber, position, role, isActive, accountDeletedAt, departmentId,
department, teamId, team, permissions, headOf and createdAt. Existing public
metadata stays compatible; password/token hashes, raw storage paths and sessions
are excluded. Profile adds imageUrl, bannerUrl, employee and specialist; for USER
accounts employee and specialist are null. Never serialize an ORM user directly.

Image upload uses kind `avatar` or `banner` for clients; `project` requires STAFF
with a linked employee. dataUrl accepts JPEG, PNG or WebP canonical base64 with
matching signature, nonempty decoded data and at most 2 MiB. JSON limit is 3 MiB;
auth bodies otherwise use 16 KiB. Storage failures return a safe 503, never secrets.

Catalog/details expose active services and active packages, public descriptions,
requirements and image URLs. Service private pricing is omitted; private package
amount/billing interval are null. Monetary amounts are decimal strings.
Specialists must be active employees linked to active, nondeleted STAFF logins in
responsible service departments. Their projection is a public directory profile,
including only published portfolio work, not credentials or HR records.

Booking draft: serviceId, nullable packageId and preferredSpecialistId,
submissionKey (UUID), goals (1-2,000), requirements (1-5,000), expectedTimeline
(1-300), optional additionalDetails (up to 5,000). Strings are trimmed. A package
must be active and belong to the selected active service; services with active
packages require a selection. Specialist eligibility is rechecked at submission.
Stale catalog choices return 409. Body limit is 64 KiB.

Existing aliases packageTier, specialistId, projectGoals/projectRequirements and
legacy single goals/requirements fallback remain supported. Missing/null keys
still generate a server UUID for compatibility, **without retry guarantees**;
mobile must supply and retain a UUID v4 and unchanged draft for retries.
An identical normalized draft for the same client/key returns its existing receipt,
even if the catalog changes. Different draft: 409. Different clients have isolated
key namespaces. Receipts contain only id, referenceNumber, status and createdAt.

History rows expose request identity/reference/title/description/status, package
and preferred specialist display fields, submitted goals/requirements/timeline/
details, public price snapshot, acceptance marker, dates and selected service/
package/specialist summaries. They exclude submission keys, agreed/internal prices,
client account relations and clientId. Legacy references may be null; display the
request ID as fallback. Private prices remain undisclosed snapshots.

### Queries and pagination

Client history: page defaults to 1, fixed pageSize 10; integer decimal digits only,
range 1-1,000,000. search is trimmed, at most 100 characters. status is empty or
SUBMITTED, UNDER_REVIEW, AWAITING_CLIENT_INFO, READY_FOR_QUOTATION, CLOSED,
CANCELLED. sortOrder defaults to desc, accepts asc/desc; empty means default.
Repeated known fields, structured/bracketed fields, malformed/empty page and
out-of-range numbers return 400. Empty search/status mean no filter. Valid pages
beyond results return empty rows with unchanged totals. Sorting uses createdAt
then ID for deterministic ties. total is filtered count; summary is account-wide
`{ total, pending, inProgress, completed, cancelled }` independent of filters.
Legacy history supports page/search/status, max page 100,000, fixed descending
order and pageSize 10. Catalogs/specialists do not implement server search/paging.

### Cancellation and retry rules

Direct cancellation is an atomic ownership/state-conditional update: no accepted
department and status SUBMITTED, UNDER_REVIEW, AWAITING_CLIENT_INFO or
READY_FOR_QUOTATION. Accepted, terminal, missing and foreign requests return the
same 409; no cross-client existence information is returned. Repeating a successful
direct cancellation returns 409; read history/detail to confirm final state.

After acceptance, read the workflow and send
`{ type: "CANCEL", note, actionId, expectedVersion }` to its actions endpoint.
Use a UUID v4 actionId, current integer version and a nonempty cancellation note
(up to 2,000 characters). Owning client/authorized manager and workflow stage are
checked server-side. Missing actionId/version is 400, stale version is 409.
Identical action retries return the current permitted snapshot without repeating
side effects; changed command under the same actionId returns 409. Ownership is
checked before receipt replay. A different action ID cannot repeat a terminal
transition. Preserve the command/actionId when recovering a lost response;
refresh on conflict before deciding another action is needed.

## Errors and client actions

Errors preserve `{ error: string }`; do not require a universal code field.

| Status | Meaning/action                                                                                                                          |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| 400    | Invalid input/query/JSON; show error, correct fields before retry                                                                       |
| 401    | Missing, revoked, expired or invalid credentials; ACCESS_TOKEN_EXPIRED code permits serialized refresh; failed refresh requires sign-in |
| 403    | Current role/permission forbids operation; do not retry unchanged                                                                       |
| 404    | Unavailable service/owned detail/workflow; refresh discovery/history                                                                    |
| 409    | Stale catalog/version, duplicate email or changed idempotent input; refresh or correct input; do not blindly resubmit with a fresh key  |
| 413    | JSON body exceeds route limit; reduce payload                                                                                           |
| 429    | Rate limited; honor Retry-After when present; failed-password lockout can omit it                                                       |
| 503    | Database configuration or image storage unavailable; retain draft and retry later                                                       |
| 500    | Generic unexpected server error; no internal details; reconcile writes using the retained submission/action key                         |

Do not automatically retry writes with new keys. Transient database connection
errors reaching the generic handler remain 500, not a promise of universal 503.
Per-process/IP minute limits: registration 10 (development 50), login 60 (300),
refresh 120, profile PATCH 30, image upload 20. Failed-password limit is 10 per
IP/email per 15 minutes (development 50). Distributed limiting is outside scope.

## Audit evidence and verification

| Requirement                                                              | Offline evidence                                                                                |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Rotation/replay/expiry/logout/password revocation, role/status/deletion  | jwt-session.test.ts, auth/client-auth.test.ts, mobile/regression.spec.ts                        |
| Profile ownership, safe projections, upload boundaries/storage failure   | profile.test.ts, mobile/regression.spec.ts                                                      |
| Catalog visibility, specialist eligibility, input relationships, aliases | client-integration.test.ts, service-specialists.test.ts, client-services/client-booking.test.ts |
| Retry/conflict/concurrent booking, client isolation and catalog changes  | mobile/regression.spec.ts, client-services/client-booking.test.ts                               |
| Totals/filter/sorting/pagination/legacy/projections                      | client-requests.test.ts, client-integration.test.ts, mobile/regression.spec.ts                  |
| Accepted cancellation replay/version/ownership, acceptance race          | request-workflow.test.ts                                                                        |
| Direct cancellation ownership/repetition and persisted state             | mobile/regression.spec.ts, request-workflow.test.ts                                             |
| Rate limits and safe error envelopes                                     | jwt-session.test.ts, auth/auth.limiter.test.ts, app.test.ts                                     |

Demonstrated gaps closed: bracketed history filters were silently ignored by the
Express simple query parser; both history validators now reject them. The dedicated
booking PGlite suite was absent from the main API test command and is now included.
No facade, schema migration or breaking response change was needed. PGlite HTTP
concurrency tests deliberately use a one-connection pool; they verify overlapping
requests and persisted outcomes, not all multi-connection PostgreSQL schedules.

Run from the root: `pnpm format`, `pnpm lint`, `pnpm typecheck`,
`pnpm --filter @nexus/api test`, `pnpm --filter @nexus/web test`.
Consumer checks: shared Android host tests and the existing web booking Playwright
regressions. iOS builds require macOS; mobile implementation changes are follow-ups.

### Verification results

The implementation was checked with the full offline API suite (179 tests), web
unit suite (43 tests), selected service/history/legacy-booking Playwright suites
(25 tests), shared Android host tests, and repository format/lint/typecheck gates.
No live database was used. iOS build/device verification was not run on Windows.

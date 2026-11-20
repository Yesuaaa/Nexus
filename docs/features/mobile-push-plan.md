# Native push notification plan (deferred)

Developed: 2026-11-17

Native Android/iOS push is explicitly deferred from issue #157. The current
release uses `GET /api/request-workflows/notifications` and its read endpoints.
This document is the future contract; it does not authorize a partial provider
integration, Prisma migration, background worker, or client SDK setup.

## Proposed registration contract

Future authenticated endpoints:

- `POST /api/push/device-registrations` upserts the caller's installation with
  `{ installationId, platform, providerToken, permission, appVersion }` and
  returns `{ id, platform, permission, updatedAt }`. It never returns the token.
- `DELETE /api/push/device-registrations/:id` revokes only a registration owned
  by the current user. Missing and foreign IDs return the same unavailable
  response.

`platform` is `ANDROID` or `IOS`; `permission` is `AUTHORIZED`, `DENIED`, or
`PROVISIONAL`. The app generates a random installation ID and stores it with the
platform secure-storage abstraction. Registration occurs only after sign-in and
the OS permission result. Token refresh upserts the same installation. Account
switch, logout, account deactivation/deletion, or permission revocation disables
the former ownership before another user can receive notifications.

## Proposed persistence and ownership

A future migration may add `DeviceRegistration` with ID, user ID, installation
ID, platform, environment, encrypted provider token, token fingerprint,
permission, enabled/revoked timestamps, last-seen/app version, failure count,
and created/updated timestamps. Unique constraints must prevent the same
environment/installation or provider token from being active for multiple
owners.

Provider tokens must be encrypted at rest with a separately managed key because
delivery needs the original token; hashing alone is insufficient. API DTOs,
audit records, metrics, and logs use registration IDs/fingerprints only. The
server authorizes registration changes from the current database account, never
from user IDs or roles supplied by the client.

## Delivery behavior

- A committed in-app notification/event is the source of truth. Push is a
  best-effort hint created after commit and never replaces the notification API.
- Delivery jobs carry a notification event ID, registration ID, environment,
  category, and allowlisted deep-link data—not arbitrary private payloads.
- The `(notificationEventId, registrationId)` pair is the idempotency key.
  Duplicate scheduling or provider acknowledgements must not duplicate user
  effects.
- Retry only transient network/provider failures with bounded exponential
  backoff and jitter. Do not retry malformed payloads, revoked ownership, denied
  permission, or terminal invalid/unregistered-token responses.
- Terminal token errors disable the registration immediately. Repeated transient
  failures eventually quarantine it pending a client re-registration.

## Privacy and deep links

Lock-screen text must remain generic by default: no message body, requirement,
quotation, payment proof, file name/content, client details, or internal notes.
The app fetches authorized details after opening.

Allowlisted destinations are notification center, request conversation/workflow,
project conversation/detail, and billing. Payloads carry opaque record IDs and a
category only. On tap, the app restores authentication, validates the route
against its deep-link allowlist, fetches the resource, and relies on current API
ownership. Missing/forbidden resources fall back to the notification center.

## Environments and observability

Development, staging, and production use separate APNs/FCM credentials,
application identifiers, registration rows, queues/topics, and dashboards. A
registration or job from one environment must be rejected in every other
environment.

Metrics include queued/sent/acknowledged/transient-failed/terminal-failed counts,
latency, retries, invalid-token cleanup, and active registrations by platform
and app version. Logs contain event/job/registration IDs, provider status class,
attempt, duration, and environment only. Provider tokens, credentials, message
content, deep-link parameters, and provider response bodies are forbidden.

## Future acceptance gate

Push work may start only with approved provider accounts/secrets, retention and
privacy review, Android and iOS permission UX, migrations and rollback, queue
ownership, per-environment end-to-end tests, invalid-token cleanup tests,
deduplication tests, and operational dashboards/alerts. Until then, no placeholder
registration rows or partially active delivery code should be merged.

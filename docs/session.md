# Authentication Sessions

Authentication uses signed JWT access tokens with database-backed sessions and rotating refresh tokens. All four roles, including Superadmin, retain their existing permissions.

## Implemented Features

### JWT Access Tokens

- Login and registration issue an HS256-signed JWT using `jose`.
- Access tokens last 15 minutes and cannot outlive their database session.
- Verification checks the signature, algorithm, token type, issuer, audience, user identifier, session identifier, issued-at time, maximum age, and expiry.
- Unsigned, malformed, tampered, future-issued, and expired tokens are rejected. Bearer tokens are limited to 4096 characters.
- Tokens contain identifiers and timing claims, without passwords, contact details, or role snapshots. Signed JWT payloads are readable; they are not encrypted.

### Database-Backed Sessions

- Sessions expire seven days after login or registration. Refreshing does not extend this limit.
- Every authenticated request checks the current database session and account status.
- Permissions come from the user's current database role, so role changes affect subsequent requests immediately.
- Inactive, archived, or permanently deleted accounts cannot authenticate.

### Refresh Token Rotation and Reuse Detection

- Refresh tokens contain 32 cryptographically random bytes encoded as base64url.
- Only SHA-256 hashes are stored in the database.
- Each successful refresh replaces the current refresh token and marks the previous token as consumed.
- Rotation runs in a transaction. A compare-and-swap update ensures only one request can claim the current hash.
- Reusing a consumed refresh token revokes its entire session. Independent sessions remain valid.
- Failed rotations roll back both the session hash and consumption marker.

### Immediate Session Revocation

- Logout revokes the current session.
- Password changes revoke all sessions for the account.
- Account deactivation, archival, and permanent deletion prevent further access.
- Deleting a session also deletes its refresh-token history through a database cascade.

### Browser Session Handling

- Access and refresh tokens are stored only in `sessionStorage`, under `nexus.auth.token` and `nexus.auth.refreshToken`.
- An expired access token triggers automatic refresh and one retry of the original request.
- Concurrent expired requests in the same tab share one refresh operation.
- Invalid signatures, wrong passwords, and authorization denials do not trigger refresh.
- Logout and confirmed authentication failures clear both stored tokens.
- Network errors, throttling, and temporary server failures preserve tokens for retry.
- Session version checks prevent delayed requests, login replies, and refresh replies from restoring a signed-out session or affecting a replacement account.
- Signed-in users opening login or registration are redirected to the dashboard without being logged out.

### Request Protection

- Authentication responses and browser API requests use `no-store` caching controls.
- Registration, login, and refresh have per-source, per-process limits of 10, 60, and 120 requests per minute respectively. Throttled responses include `Retry-After`.
- The existing failed-login limiter remains enabled.
- The existing per-request nonce-based Content Security Policy is retained. Production scripts do not permit `unsafe-inline` or `unsafe-eval`; development permits eval for Next.js debugging.
- Existing password hashing and role restrictions remain in place.

## API Contract

| Endpoint                         | Behavior                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `POST /api/auth/register`        | Creates an account and returns `token`, `refreshToken`, `expiresIn`, and `user`                  |
| `POST /api/auth/login`           | Authenticates credentials and returns `token`, `refreshToken`, `expiresIn`, and `user`           |
| `POST /api/auth/refresh`         | Accepts `{ "refreshToken": "..." }` and returns rotated `token`, `refreshToken`, and `expiresIn` |
| `GET /api/auth/me`               | Returns the current account after JWT and database validation                                    |
| `POST /api/auth/logout`          | Revokes the authenticated session                                                                |
| `POST /api/auth/change-password` | Changes the password and revokes all account sessions                                            |

Access JWTs use token type `at+jwt`, issuer `nexus-api`, audience `nexus-web`, and claims `sub`, `sid`, `iss`, `aud`, `iat`, `exp`, and `jti`. Verified expired tokens return HTTP 401 with code `ACCESS_TOKEN_EXPIRED`; the browser uses that code to initiate refresh.

## Database Records

| Record         | Purpose                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| `Session`      | Links the user to the absolute expiry and current refresh-token hash in `tokenHash`                   |
| `RefreshToken` | Stores issued refresh-token hashes, their session, creation time, and optional `consumedAt` timestamp |

Migration `20261030180000_jwt_sessions` creates refresh-token persistence and invalidates legacy opaque-token sessions. Business records are preserved. The migration was tested offline and has not been applied to the live database as part of this implementation.

## Configuration

`JWT_SECRET` is a required server-only base64url key containing 32 to 128 decoded bytes. The API refuses to start with missing or invalid configuration. There is no built-in fallback key. Docker Compose also requires this variable.

Generate a key locally:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Store the value in the API secret configuration, `apps/api/.env` for direct development, or the root `.env` for Docker Compose. Never commit it or expose it through a public environment variable. API replicas must use the same key.

The database migration and coordinated API/web rebuild are required before enabling this implementation in a deployed environment. The migration signs existing sessions out. Production requires HTTPS and the intended `WEB_ORIGIN`. The production runtime image does not include migration tooling; migrations run from the source checkout or a dedicated migration job.

Expired session records can be removed by a scheduled database cleanup; their refresh history is deleted automatically. Consumed refresh records must remain while their session is active for reuse detection. Signing-key rotation requires revoking existing sessions as well as replacing the key.

## Known Limits

- Same-origin JavaScript can read `sessionStorage`. The CSP reduces script-injection exposure but does not eliminate token-theft risk.
- Duplicated tabs can inherit the same refresh token. Competing refreshes can trigger reuse detection and require another sign-in.
- A lost successful refresh response can require another sign-in because the consumed token cannot be reused.
- In-memory rate limits are per API process. Multiple replicas need shared or trusted-ingress rate limiting. Clients behind a proxy may share its source address.
- MFA and a separate administrator password-reset endpoint are not included.

## Verification

Results recorded on 2026-10-30:

| Check                                                                          | Result                                                                                                  |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Full offline API suite                                                         | 62 passed                                                                                               |
| Browser API unit tests                                                         | Six passed, covering refresh coordination, failures, sign-out, account switching, and delayed responses |
| Chrome against the production build                                            | 17 authentication and CSP checks passed                                                                 |
| Production build, web/API type checks, lint, formatting, and whitespace checks | Passed                                                                                                  |
| Full frontend unit suite                                                       | 25 passed; one existing Client Management Superadmin access expectation fails and remains unchanged     |

Backend lifecycle tests use the real Express API with offline PGlite fixtures. Browser tests mock API responses. PGlite uses one database connection, so these tests do not reproduce independent PostgreSQL transaction lock contention. Production-specific contention requires isolated PostgreSQL validation.

## Implementation Files

- `apps/api/src/features/auth/auth.jwt.ts`: JWT configuration, signing, and verification.
- `apps/api/src/features/auth/auth.service.ts`: Login, registration, refresh, and password-change behavior.
- `apps/api/src/features/auth/auth.repository.ts`: Session persistence and transactional refresh rotation.
- `apps/api/src/features/auth/auth.middleware.ts`: JWT, session, and account validation.
- `apps/web/src/features/auth/api/auth-api.ts`: Browser storage, automatic refresh, and session version checks.
- `apps/web/src/proxy.ts` and `apps/web/src/lib/content-security-policy.ts`: Existing browser script policy.

## References

- [JWT Best Current Practices (RFC 8725)](https://www.rfc-editor.org/rfc/rfc8725.html)
- [jose documentation](https://github.com/panva/jose/tree/main/docs)

# Client authentication verification (#149)

## Agreed delivery

Verify the existing Express/Prisma authentication backend and connect the KMP
client login, registration, session restoration, profile, and logout screens.
The web contract remains authoritative.

## API contract

- `POST /api/auth/register`: required `fullName`, `email`, `password`, and
  `contactNumber`; returns `201` with `token`, `refreshToken`, `expiresIn`, and
  `user`. New accounts are always active `USER` clients, regardless of submitted
  role/status properties.
- `POST /api/auth/login`: email/password; returns the same session shape with `200`.
- `GET /api/auth/me`: verifies the stored Bearer token and returns `{ user }`.
- `POST /api/auth/logout`: revokes the current session and returns `204`.
- Account status is `user.isActive`; no `accessToken`/`active` aliases are added.
- Registration trims the name/contact, normalizes email, requires a 2–100 character
  name, `.com`/`.ph` email, and `^(08|09)\d{9}$` contact number. Passwords require
  12 characters, a maximum of 1,024 UTF-8 bytes, uppercase, lowercase, a digit,
  and a special character. Existing salted scrypt hashing is retained.
- A `User` represents the client. No client-profile model or migration is needed.

## Development limits and test account

| Limit                                | Production/test | Development |
| ------------------------------------ | --------------- | ----------- |
| Register requests/minute/IP          | 10              | 50          |
| Login requests/minute/IP             | 60              | 300         |
| Failed passwords/IP/email/15 minutes | 10              | 50          |
| Refresh requests/minute/IP           | 120             | 120         |

Only `NODE_ENV=development` enables higher limits. No emulator-IP bypass is used.
The emulator connects to the host API at `http://10.0.2.2:3001`.

Use the existing team-managed development client account; credentials are shared
privately. The originally proposed fixed `client@nexus.com` seed is deliberately
replaced by that process. No shared password is committed and seeding does not
create/reset test client credentials.

## Verification

- Backend suite: 149 passing tests, including PGlite registration (`201`, active
  `USER`), duplicate email (`409`), login (`200`), wrong password (`401`), JWT
  verification/revocation, and real HTTP rate-limit boundary checks.
- Mobile auth suite: 10 passing tests for request/response mapping, registration,
  duplicate email, session restoration/expiry/no stored token, and logout success,
  expired session, and connection failure.
- Shared Android host tests and debug APK assembly pass.
- Emulator smoke test: fresh registration and profile details, session restoration
  after process restart (`/me` → `200`), logout, restart remaining signed out,
  invalid-password feedback, duplicate-email feedback, and successful sign-in
  after logout passed on Pixel_8 / Android 14 on November 2, 2026.
- Auth screens respect Android status/navigation bars and keyboard insets.

### Acceptance criteria

- [x] Registration creates an active `USER` with HTTP `201`.
- [x] Login returns the established JWT session contract with HTTP `200`.
- [x] Existing team-managed client replaces the proposed fixed seed credential.
- [x] Offline backend tests and mobile auth tests pass.
- [x] Emulator registration, errors, restart, profile, and logout flows pass.
- [x] Mandatory format, lint, and API/web typecheck gates pass.

Implementation is ready for commit/push review; automatic mobile refresh and the
other follow-ups below are excluded from #149. Keep the issue open until the
branch is reviewed and merged.

Run before handoff from the repository root:

```powershell
pnpm.cmd format
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd --filter @nexus/api test
```

From `apps/mobile`:

```powershell
.\gradlew.bat :shared:testAndroidHostTest :androidApp:assembleDebug
```

The backend tests use isolated offline databases or a deliberately unavailable
database for limiter-only checks; they do not use the live database. Manual
emulator registration uses a uniquely named development smoke-test account.

## Follow-up scope

The #149 notes above are historical. Mobile refresh/session handling has since
been implemented; see the #155 contract below for current backend behavior.
Password recovery and distributed rate limiting remain follow-up work. A saved
session is verified on startup; refresh failure returns the client to sign-in. Logout
clears both local tokens even if the server cannot be reached and displays a
notice when revocation could not be confirmed.

## Backend contract readiness (#155)

See the [mobile client contract and audit](mobile-client-contract.md) for the endpoint inventory,
security behavior, cancellation/retry rules, errors and platform base URLs.

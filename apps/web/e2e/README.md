# Regression modes

`pnpm --filter @nexus/web test:e2e` runs the deterministic mocked regressions.

To run the main regression file alone, use
`pnpm --filter @nexus/web test:e2e regression.spec.ts --workers=2` after building.
Its authentication checks cover both stored tokens, refresh across all roles,
concurrent refresh coordination, a single mutation retry, revoked sessions,
and recoverable refresh failures. Mock tokens exercise browser behavior;
they do not verify JWT signatures or server authorization.

Run `pnpm --filter @nexus/api test` for real JWT verification, rotation/reuse
detection, password-reset session revocation, and account restoration against
offline PGlite databases. No live database is used by that suite.

`pnpm --filter @nexus/web test:e2e:live` signs in to the real backend using
the Superadmin, Admin, Staff, User, and deactivated test accounts configured in
`regression.spec.ts`. It checks login, page access, direct API read permissions,
the available service catalog, and logout. It does not modify business records.
Mutation and injected-error scenarios remain in the mocked suite.

Set the following variables in the environment or in the ignored file
`apps/web/.env.regression.local`:

```dotenv
NEXUS_E2E_SUPERADMIN_PASSWORD=
NEXUS_E2E_ADMIN_PASSWORD=
NEXUS_E2E_STAFF_PASSWORD=
NEXUS_E2E_USER_PASSWORD=
NEXUS_E2E_DEACTIVATED_PASSWORD=
```

Live validation runs all five account cases without temporary exclusions.

Start the API (`pnpm start:api`) with its test database configuration. Build the
web app with `pnpm build`; Playwright starts it on port 5273. To use an already
running web app instead, set `NEXUS_E2E_BASE_URL` to its URL. The web app must
proxy `/api` to the backend containing the supplied test accounts.

Live runs use one worker, no retries, and no traces, screenshots, or videos to
avoid storing passwords and session tokens in test artifacts. Passwords are
required; missing credentials fail the live run rather than falling back to mocks.

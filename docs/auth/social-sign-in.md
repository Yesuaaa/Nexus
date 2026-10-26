# Social sign-in setup

This guide configures Google, Facebook, and Apple sign-in for Nexus. Each provider sends its authorization response to the API; the API validates it and returns the browser to `/auth/social/complete` with a short-lived flow code in the URL fragment. The web app proves the browser flow with its verifier and completes sign-in, linking, or any required onboarding. The API consumes the code when that action succeeds. Provider tokens and credentials stay on the server.

## Before configuring providers

This is the single setup guide for all providers. Use the existing environment files:

- For the API running on the host, copy `apps/api/.env.example` to `apps/api/.env` if needed, then fill in the provider values there.
- For Docker development, use the repository-root `.env`, based on `docker.env.example`. Compose forwards these settings to the API container. After changing values, run `docker compose up -d --no-deps api` to recreate the container with the updated environment. Dependency changes also require `--build`.
- For production, set the same values in the deployment's secret store or API environment.

Existing `.env` files may already contain database credentials; edit them in place instead of replacing them with the examples. Actual `.env` files remain ignored by Git. No separate configuration folder or custom environment loader is required. Restart the host API process after editing its environment file.

Use a public HTTPS web origin and a public HTTPS API origin for any provider callback that is not on localhost. Apple requires a registered domain and return URL, so local Apple testing also needs a stable HTTPS hostname, usually through a development tunnel. Point that hostname at the local web and API services, then use the same hostname consistently in provider settings and environment values. Provider consoles reject callback URLs that differ by scheme, host, port, case, or path.

Set these server environment values in the API deployment. Keep them in the deployment's secret store or a local ignored env file; do not put credentials in the web app env file, source control, browser bundles, or screenshots.

```dotenv
WEB_ORIGIN=https://app.example.com
API_PUBLIC_URL=https://api.example.com

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_GRAPH_API_VERSION=v26.0
APPLE_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=

RESEND_API_KEY=
EMAIL_FROM=Nexus <login@example.com>
```

Replace the example origins and sender with the deployment's real values. `API_PUBLIC_URL` is the public API origin without an `/api` suffix; the registered callback is:

```text
{API_PUBLIC_URL}/api/auth/social/{provider}/callback
```

For example, Google uses `https://api.example.com/api/auth/social/google/callback`. Register each provider's callback separately. `FACEBOOK_GRAPH_API_VERSION` must be a supported Graph API version in the `vNN.N` form. This guide uses `v26.0`, current as of October 2026; check Meta's [Graph API versions](https://developers.facebook.com/docs/graph-api/changelog/versions/) before deploying or upgrading it. For Apple, `APPLE_CLIENT_ID` is the web Services ID. Store the downloaded Apple `.p8` key contents as `APPLE_PRIVATE_KEY`, preserving its PEM header, footer, and real line breaks. Don't replace line breaks with literal `\n` unless the API converts them back before loading the key.

The API uses `RESEND_API_KEY` and `EMAIL_FROM` only when a provider doesn't supply a verified email and Nexus needs the user to confirm an address before account creation. It sends a one-time 8-digit email code; the API never returns that code in a response or writes it to logs. The database stores a hash, expires the code after 10 minutes, and allows five failed attempts. Configure a verified sender domain in Resend before trying this path.

## Google

1. In Google Cloud Console, select or create the project for this environment and configure the OAuth consent screen with the app name, support contact, and authorized domains. Add the identity scopes `openid`, `email`, and `profile`; request no extra scopes for sign-in.
2. Create an OAuth client with application type **Web application**.
3. Add the exact API callback `https://api.example.com/api/auth/social/google/callback` as an authorized redirect URI. This server-side authorization-code flow doesn't need a JavaScript origin.
4. Copy the client ID and client secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the API environment, then restart or redeploy the API.

Google compares the redirect URI exactly, including its scheme, host, port, path, and trailing slash. Do not add a trailing slash unless the API callback actually uses one. The flow requests state and nonce and uses PKCE; the callback validates state, nonce, issuer, audience, expiry, and the ID token signature before accepting the identity. Google's web server flow is documented in [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server).

## Facebook

1. In Meta for Developers, create or select an app, add **Facebook Login**, and configure its web login settings.
2. Add the frontend origin to the app's allowed domains and add the exact API callback `https://api.example.com/api/auth/social/facebook/callback` to **Valid OAuth Redirect URIs**.
3. In the app's settings, copy its App ID and App Secret into `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` in the API environment.
4. Set `FACEBOOK_GRAPH_API_VERSION` to the version used by the app. Check Meta's current supported versions and migration schedule before changing it.
5. In development mode, add the people who will test as app roles. Before public sign-in, complete Meta's current app review and required business verification for the permissions and use case.

The sign-in flow needs the user's public profile and email permission. Facebook may not return an email even when requested, so test the missing-email onboarding path. The API validates the access token against the configured app and checks that the provider user ID matches the profile returned by Graph API. See Meta's [Facebook Login documentation](https://developers.facebook.com/docs/facebook-login/) for current console labels and review requirements.

## Resend email codes

In Resend, add the domain used by `EMAIL_FROM` and publish the DNS records Resend gives you. Wait until the domain can send, then create an API key with sending access, scoped to that domain if the dashboard offers the option. Put the key in `RESEND_API_KEY` and use a sender on the verified domain, such as `Nexus <login@example.com>`, for `EMAIL_FROM`. Resend's [domain setup notes](https://resend.com/changelog/new-domains-workflow) describe the verification flow; its [API key permissions](https://resend.com/changelog/new-api-key-permissions) explain sending-only keys.

The API calls Resend only while delivering an email verification code for provider onboarding. A successful delivery doesn't verify an address by itself; the user must submit the matching code to Nexus before account creation. Nexus must not log the code. Resend receives it as part of the email and may retain delivery records, so restrict who can inspect those records in the Resend account.

## Apple

Apple web sign-in needs an Apple Developer Program team, a primary App ID enabled for Sign in with Apple, a Services ID associated with that App ID, and a Sign in with Apple private key.

1. In Certificates, Identifiers & Profiles, enable Sign in with Apple on the primary App ID. If the site has no related Apple app, create the primary App ID first.
2. Register a Services ID for the web client, enable Sign in with Apple for it, and associate it with the primary App ID.
3. Under the Services ID web configuration, register the web domain and the exact return URL `https://api.example.com/api/auth/social/apple/callback`. Apple needs the domain and return URL registered; a localhost callback alone is not sufficient.
4. Create a Sign in with Apple key, download its `.p8` file once, and record the Key ID shown by Apple. Store the file securely and set `APPLE_PRIVATE_KEY` to its PEM contents, `APPLE_KEY_ID` to the Key ID, `APPLE_TEAM_ID` to the team identifier, and `APPLE_CLIENT_ID` to the Services ID.
5. Deploy the API with these values and confirm the public HTTPS callback is reachable.

Apple posts the authorization response as `application/x-www-form-urlencoded` (`response_mode=form_post`), so the API callback must accept a form POST. Apple returns the user's name only on the first authorization; save it when supplied and don't treat a later missing name as an error. Its email can be a private relay address. The browser flow uses state and a nonce, and Apple doesn't support PKCE for this web authorization request. Apple explains web setup in [Configure Sign in with Apple for the web](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/) and the callback format in [Request an authorization to the Sign in with Apple server](https://developer.apple.com/documentation/signinwithapplerestapi/request-an-authorization-to-the-sign-in-with-apple-server).

## Local development

Run the web app and API on their usual local ports, then expose both through a stable HTTPS development domain. Set `WEB_ORIGIN` to the browser-visible web origin and `API_PUBLIC_URL` to the browser-visible API origin. Configure each provider with callback URLs built from the API origin, and keep the browser on the same web origin from the start of sign-in through `/auth/social/complete`.

The browser keeps the OAuth state and verifier in `sessionStorage`, not in a cookie. Start and finish the flow in the same tab; switching tabs, closing the tab, or clearing site storage removes the pending verifier, and the callback will fail safely. The callback redirects with the one-time exchange code in the URL fragment, which is not sent in the HTTP request to the web server. The web app must exchange it immediately and remove the fragment from the address bar after use. Never copy callback URLs containing codes into tickets, chat, or logs.

For Apple, keep the HTTPS tunnel hostname stable while testing because Apple requires registered domains and return URLs. If the tunnel hostname changes, update the Apple Services ID configuration and `API_PUBLIC_URL`, then restart the API. Never disable TLS validation to make a tunnel work.

## Rotating credentials

Rotate one provider at a time so the other sign-in options remain available.

- **Google:** Create a replacement client secret in the Google Cloud project, update `GOOGLE_CLIENT_SECRET` in the API secret store, redeploy, and test sign-in. Revoke the old secret after the new deployment works. Keep the same client ID and authorized URIs unless the OAuth client itself is being replaced.
- **Facebook:** Regenerate the App Secret in Meta for Developers, update `FACEBOOK_APP_SECRET`, redeploy, and test sign-in. The old secret stops working after regeneration, so schedule the change when the new value can be deployed immediately. If the App ID changes, update `FACEBOOK_APP_ID` and confirm the callback URI is still registered.
- **Apple:** Create a replacement Sign in with Apple key and record its new Key ID, then update `APPLE_KEY_ID` and `APPLE_PRIVATE_KEY` together with the existing Team ID and Services ID. Deploy and test before revoking the old key. Apple permits up to two private keys per primary App ID, which supports this overlap.
- **Resend:** Create a replacement API key, update `RESEND_API_KEY`, redeploy, and test an email-code onboarding. Revoke the previous key after delivery succeeds. Keep `EMAIL_FROM` on a domain verified with Resend.

Never paste credentials into issue trackers or commit them to `.env.example`. If a secret reaches source control or a public log, revoke it at the provider first, then update the deployment value and review the relevant provider audit history.

## Manual verification

Run these checks against a test deployment with provider apps in the correct development or production mode. Use test accounts you control; don't paste real access tokens or callback codes into bug reports.

1. Start sign-in with each provider and complete consent. Confirm a new account can finish the browser flow, receives a Nexus session, and lands on the signed-in page.
2. Sign out and repeat with the same provider account. Confirm Nexus returns to the existing account rather than creating another one.
3. Cancel consent, alter a returned `state` value, and try a callback with a missing or expired code. Each attempt should fail without issuing a session.
4. For Google, confirm the configured client ID and callback work and that a mismatched nonce or invalid ID token is rejected. For Facebook, confirm a token issued to another app is rejected.
5. For Apple, verify the browser reaches the API callback by form POST. Test a first-time authorization with name sharing, then a repeat authorization where Apple omits the name.
6. Use a provider account with no email, or simulate that provider response in an isolated test environment. Confirm the user is asked for an email, receives the Resend code, and can proceed only with the correct code before it expires. Confirm a wrong code fails, the sixth failed attempt is rejected, and responses and API logs never reveal the code.
7. After success, refresh `/auth/social/complete` or replay the exchange code. The code must work once only and must not appear in the browser address bar after exchange.

If sign-in fails, first compare the configured callback character-for-character with the provider console entry, then check that the deployed API has the expected environment values. Provider credentials must not appear in error messages or logs.

## Mobile clients

The current callback and `/auth/social/complete` exchange describe the browser flow. A native mobile app needs its own provider client configuration and redirect URI, plus a native deep-link or universal-link return path. Use the platform provider SDK or system browser flow with PKCE where the provider supports it. Do not embed `GOOGLE_CLIENT_SECRET`, `FACEBOOK_APP_SECRET`, Apple's `.p8` key, or a Resend key in an app bundle. The mobile app should send the authorization result to the API, which validates the provider identity and issues the Nexus session through a mobile-specific exchange flow. Don't reuse the browser's `sessionStorage` verifier or callback URL as a mobile redirect design.

For Google mobile clients, create the matching Android or iOS OAuth client rather than reusing the web client secret. For Apple, add the native app's Sign in with Apple capability and follow Apple's native Authentication Services flow; web Services ID settings alone don't configure a native app. Facebook's native SDK setup also uses platform-specific app configuration. Register every production redirect with its provider before release.

## Migration, cleanup, and verification

Database migration execution is deferred until the final rollout stage. The included `20261026000000_social_sign_in` migration has been tested in an isolated test database, but has not been applied to Supabase during this implementation. When that final stage is authorized, review the target project and schema, then apply the migration before enabling sign-in:

```sh
pnpm --filter @nexus/api exec prisma migrate deploy
pnpm --filter @nexus/api build
pnpm --filter @nexus/api auth:cleanup
```

The migration preserves existing user IDs, password hashes, roles, and sessions. It makes password hashes nullable, adds provider identities, and adds temporary flow records. A rollback that restores a required password column needs an explicit policy for passwordless users; do not drop their identities or assign dummy passwords.

Schedule the cleanup command daily through the deployment scheduler, or invoke `node dist/scripts/cleanup-social-auth.js` from the production API working directory. It removes expired OAuth attempts and flow completions. Expired rows cannot authenticate even before cleanup. The API container includes this compiled script; it does not require development dependencies. `DATABASE_POOL_MAX` optionally limits each API process's PostgreSQL pool (default 10).

Social request limits allow 60 starts and 120 callbacks/completions per IP per minute, plus 10 email sends per IP per minute. Each flow also enforces a one-minute email resend delay and five code guesses; password confirmation has a separate per-session guess limit. IP limits are process-local. Configure shared edge rate limits when running multiple API replicas, and restrict outbound/proxy access logs so provider token query parameters are redacted. Never log callback bodies, authorization codes, or token endpoint responses.

Both Compose files forward the provider and email configuration to the API. In production, expose the registered callback path through the HTTPS reverse proxy or the web app's `/api` proxy; the internal API service is not directly published by production Compose. Keep all private keys and client secrets out of `NEXT_PUBLIC_*` values.

Run automated checks with:

```sh
pnpm --filter @nexus/api test
pnpm --filter @nexus/web test
pnpm typecheck
pnpm lint
pnpm build
pnpm --filter @nexus/web exec playwright install chromium
pnpm --filter @nexus/web test:e2e
```

API tests use an isolated in-memory PostgreSQL-compatible PGlite database and mocked provider/email endpoints; they never migrate or query the configured production database. Browser tests also mock API responses. They prove application handling, not that credentials or provider-console settings are correct. Complete the real-provider checklist above for each environment before release.

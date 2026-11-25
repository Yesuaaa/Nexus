# Nexus Starter

A pnpm workspace with an independent web frontend, API, and mobile app:

| App           | Stack                                                      | Default address       |
| ------------- | ---------------------------------------------------------- | --------------------- |
| `apps/web`    | Next.js App Router, TypeScript, Tailwind CSS v4, shadcn/ui | http://localhost:5173 |
| `apps/api`    | Express, TypeScript, Prisma, PostgreSQL                    | http://localhost:3001 |
| `apps/mobile` | Kotlin Multiplatform (KMP), Compose Multiplatform (CMP)    | Android & iOS         |

The browser calls the API over HTTP. Prisma and database credentials exist only in `apps/api`.

Feature development records and their dates live in [docs/features](docs/features/README.md). See [Employee Management (Admin)](docs/features/employee-management.md) for the feature's access rules, validation, and department integration.

## Requirements

- Node.js 22.12+ or 24+
- pnpm
- Docker Compose for the local PostgreSQL service

## Run locally

```sh
pnpm install
copy docker.env.example .env
copy apps/api/.env.example apps/api/.env
```

On macOS or Linux, use `cp` instead of `copy`. Generate a local `JWT_SECRET` using the command in `apps/api/.env.example` and set it in both files. Set `DEV_SEED_PASSWORD` in `apps/api/.env` to a strong local password if you want the four starter accounts.

```sh
docker compose up -d --wait db
pnpm --filter @nexus/api exec prisma migrate deploy
pnpm --filter @nexus/api db:seed:dev
pnpm dev
```

The optional seed creates `superadmin@nexus.test`, `admin@nexus.test`, `staff@nexus.test`, and `client@nexus.test` with the shared local password. It can fill missing starter accounts and preserves existing credentials. It accepts only the local `nexus_dev` database in development mode and refuses a database with other accounts.

Open http://localhost:5173. Next.js forwards `/api` to the API on port 3001. `/api/health` checks process liveness, `/api/db-check` checks PostgreSQL connectivity, and `/api/ready` also verifies the required schema and migration history. Optional frontend settings are documented in `apps/web/.env.example`.

Service and profile images use Supabase Storage. For local image uploads, set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `SUPABASE_SERVICE_IMAGES_BUCKET` in the API environment. Use a development bucket and keep the key server-side. Request chat refreshes periodically with local PostgreSQL because the database does not publish Supabase Realtime broadcasts.

For verified TLS, download the database CA certificate from Supabase **Database Settings → SSL Configuration**. Set `sslmode=verify-full` and `sslrootcert=<URL-encoded absolute path to the certificate>` on both URLs. For example, a certificate saved as `C:\certs\supabase-ca.crt` uses `sslrootcert=C%3A%2Fcerts%2Fsupabase-ca.crt`. The `pg` driver currently treats `sslmode=require` as `verify-full` and emits a warning; changing only the mode does not fix an untrusted certificate. If your organization installs its CA in the Windows certificate store, Node 24 can also use it when launched with `NODE_USE_SYSTEM_CA=1`.

The `ExampleItem` model in `apps/api/prisma/schema.prisma` is a placeholder for your own data model.

The account pages are at `/login` and `/register`. They use the project's shadcn/ui Button, Input, and Label components and submit to the API. Field validation appears beside inputs, while Sileo shows sign-in and account outcome toasts. Successful sign-in plays the GSAP EXP loader before opening `/dashboard`; the success toast appears after the loader exits. Registration opens the dashboard directly. The registration form saves the full name and contact number, so apply the newest migration before using it. The three community photos in `apps/web/public/auth` are temporary local assets. Social icons on the form are visual placeholders; only email and password sign-in is available.

Frontend code remains organized by feature under `apps/web/src/features`. Within each feature, group code by responsibility: `pages`, `components`, `api`, `hooks`, `providers`, `model`, `content`, and `styles`, creating only the folders needed. Auth owns its API calls, form schema, types, localized copy, account loading, and components. Dashboard is an empty page; accounts owns account management; departments owns department and membership management; status retains the starter health checks. The shared portal shell lives in `components/layout`, shadcn/ui primitives in `components/ui`, and cross-feature utilities in `lib`. See [File structure](docs/filestructure.md#frontend-feature-responsibilities) for the convention and examples for future features. Run `pnpm --filter @nexus/web test` for auth API and validation checks.

`apps/web/src/app` defines the Next.js App Router routes. Route entry points, the root layout, the dashboard, and the 404 page are Server Components. Interactive forms, portal account loading, navigation, and management screens use Client Components. The root auth provider persists the GSAP loader and Sileo toasts across navigation. The `(portal)` layout loads the account and provides it to feature components through context; `components/layout/role-layout.tsx` selects Superadmin, Admin, Staff, or Client layouts while reusing the existing shell and permission-based navigation. Client maps to the API's unchanged `USER` role. Existing URLs remain `/`, `/login`, `/register`, `/dashboard`, `/accounts`, and `/departments`.

Authentication still uses the existing session-storage bearer token and Express endpoints. Account loading and frontend redirects therefore run on the client after hydration; the server renders a neutral loading state for protected pages. The API remains responsible for authorizing every operation. No cookie/session migration, backend changes, database changes, or duplicated Next.js authentication endpoints are introduced.

Browser regression checks use isolated API mocks or real Express/PGlite fixtures and never write to the configured live database. Install Chromium once with `pnpm --filter @nexus/web exec playwright install chromium`, then run `pnpm --filter @nexus/web test:e2e`. Playwright builds the current frontend before starting its test server on port 5273. Close an existing Playwright test server before starting another run so the suite cannot reuse an outdated build. To use an installed Chrome browser instead, set `PLAYWRIGHT_CHANNEL=chrome` in your shell before running the tests.

API tests and the real Attendance browser fixture compile through the existing TypeScript configuration and run with native Node, avoiding `tsx` startup restrictions. `pnpm test:api` runs all offline backend tests; `pnpm --filter @nexus/api test tests/request-workflow.test.ts` selects a suite. See [test regression recovery](docs/features/testing-regression-recovery.md) for the runner, fixture routing and resolved historical failures.

The API follows the same feature layout under `apps/api/src/features`: auth owns credentials, sessions, and login limits; users owns account administration and role rules; health owns service checks. `app.ts` mounts the routes and handles HTTP errors, `index.ts` starts the server, and `lib/db.ts` provides Prisma access. `apps/api/prisma/seed/seed.ts` is the Prisma seed entry point. Run `pnpm --filter @nexus/api test` for backend checks.

## Backend authentication

The API stores users and sessions in PostgreSQL. Apply the migrations above before using these endpoints. New passwords require at least 12 characters. Registration always creates a `USER`; a client-supplied role is ignored. Roles are `SUPERADMIN`, `ADMIN`, `STAFF`, and `USER` in API requests and responses. Their fixed permissions are documented in [docs/rbac.md](docs/rbac.md).

Set `BOOTSTRAP_EMAIL` and `BOOTSTRAP_PASSWORD` in the API environment, then run `pnpm --filter @nexus/api db:seed` to create the first Superadmin. The seed skips creation if a Superadmin already exists, so it is safe to rerun. It will not change an existing account or password. Remove the bootstrap credentials from the environment afterward. An existing Superadmin can promote other accounts through the role endpoint. Prisma 7 only runs seeds when `prisma db seed` is invoked explicitly; applying migrations does not run the seed.

To seed a separate Admin account, set `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` (at least 12 characters) in the API environment and run the same seed command. The Admin seed is skipped unless these variables are set. It creates an `ADMIN` account if the email is unused, skips an existing `ADMIN`, and fails if that email belongs to another role. It never changes an existing account or password. Remove the Admin bootstrap credentials after seeding.

| Method  | Endpoint                    | Access            | Purpose                                   |
| ------- | --------------------------- | ----------------- | ----------------------------------------- |
| `POST`  | `/api/auth/register`        | Public            | Create a User and session                 |
| `POST`  | `/api/auth/login`           | Public            | Create a session                          |
| `GET`   | `/api/auth/me`              | Signed in         | Get the current account and permissions   |
| `POST`  | `/api/auth/logout`          | Signed in         | Revoke the current session                |
| `POST`  | `/api/auth/change-password` | Signed in         | Change password and revoke all sessions   |
| `GET`   | `/api/users`                | Admin, Superadmin | Search, filter, and page through accounts |
| `POST`  | `/api/users`                | Admin, Superadmin | Create an account within role limits      |
| `PATCH` | `/api/users/:id/role`       | Admin, Superadmin | Change an account's role                  |

Log in with JSON such as `{"email":"person@example.com","password":"a long password"}`. Registration also accepts `fullName` and `contactNumber`. Both return `{ "token", "user", "expiresIn" }`; the user includes effective permissions. Send the token on protected requests with `Authorization: Bearer <token>`. Sessions expire after seven days. `change-password` takes `currentPassword` and `newPassword`; the client must log in again after it succeeds. `GET /api/users` accepts `search`, `role`, and `page` query parameters and returns 20 accounts per page. `POST /api/users` requires `email`, `fullName`, `password`, and `role`; `contactNumber` is optional. The role endpoint takes `{ "role": "STAFF" }`.

Admins can change Staff and User accounts between those two roles. Superadmins can assign any role. Nobody can change their own role through the API. Role changes take effect on existing sessions at the next request. Keep bearer tokens out of browser persistent storage when possible, and serve deployed clients and the API over HTTPS. The API has a per-process login attempt limit; use a shared rate limiter if running multiple API replicas.

## Docker

The default Docker Compose setup runs Next.js, the API, and a local PostgreSQL 16 service. The API waits for PostgreSQL to accept connections and applies pending migrations before starting. The database persists in a named volume and is published to `127.0.0.1:5433` for host-run Prisma commands. The same local setup applies on every Git branch.

```sh
docker compose up --build -d
```

Use the root `.env` and `apps/api/.env` setup above. The API container uses `db:5432` on the Compose network. Seed the local accounts from the host with `pnpm --filter @nexus/api db:seed:dev`. Open http://localhost:5173. The API is also available at http://localhost:3001.

```sh
docker compose ps
docker compose down
```

Change `WEB_PORT`, `API_PORT`, or `POSTGRES_PORT` in `.env` to use other host ports. If you change `POSTGRES_PORT`, update both database URLs in `apps/api/.env`. If you change the browser origin, update `WEB_ORIGIN`. Source edits reload automatically. Rebuild after dependency changes with `docker compose up --build -d`. Create new migrations from the host with `pnpm db:migrate --name <name>`.

### Production release with Docker Compose

When releasing from `main`, use `compose.prod.yaml` on the deployment host and supply production credentials from its secret store. A push to `main` runs CI. Set `JWT_SECRET`, `PROD_WEB_ORIGIN` to the public site origin, and `DATABASE_URL` to the writable runtime database in the `public` schema. For Supabase, use the transaction pooler with `pgbouncer=true` for `DATABASE_URL` and a direct or session-pooled connection with migration privileges for `DIRECT_URL`. You may omit `DIRECT_URL` when the runtime URL itself is a direct connection with migration privileges. Apply verified TLS settings on both connections. The API image includes the Supabase 2021 root CA. See the [Prisma guide](docs/prismaGuide.md) for connection settings.

The runtime role needs its application grants and `SELECT` on `public._prisma_migrations`. If this is the first release with separate roles, arrange those grants before startup. If the migration job creates the ledger and its postflight reports missing access, verify the completed migration state, grant `SELECT` on the ledger to the runtime role, and rerun the job while ingress is paused.

1. Confirm the intended PostgreSQL project, database and backup before releasing. Connect with each URL in a restricted operator shell and check `current_database()`, `current_schema()` and `current_user`. The migration job compares both connections against the same writable PostgreSQL instance and database. Run only one release job per target database at a time.
2. Build all three images from the same release revision while the current stack is still serving. Stop any development stack sharing the ports. Put external ingress in maintenance mode and stop and drain the existing production web and API, including replicas outside this Compose project. Keep traffic paused across schema changes.

   ```sh
   docker compose -f compose.prod.yaml build
   docker compose -f compose.prod.yaml stop web api
   ```

3. Remove the previous stopped migration job and start the release. Compose runs one `migrate` service with `prisma migrate deploy` and Prisma's PostgreSQL advisory lock. The API starts after the job exits successfully, and web starts after API health passes. `--wait` makes the command fail if startup fails or the deadline expires. If the job is still running at the deadline, check its state before retrying and keep ingress paused.

   ```sh
   docker compose -f compose.prod.yaml rm -f migrate
   docker compose -f compose.prod.yaml up -d --no-build --wait --wait-timeout 120
   docker compose -f compose.prod.yaml ps -a
   ```

4. Check that `migrate` exited `0` and every API replica is healthy. Check `/api/ready` through the web origin and run the release smoke checks before resuming ingress. The web listener defaults to port `8080`. The production API returns `503` on application routes when its schema or migration ledger is incompatible, including after a restart. The API drains requests for up to 12 seconds on SIGTERM or SIGINT, with a 20-second container stop allowance.

### Migration failure and recovery

Keep ingress paused and web/API stopped if the migration job exits nonzero. Use `docker compose -f compose.prod.yaml logs migrate` to identify the failed stage and any reported Prisma error code. In a restricted operator session, use the same release checkout and verified `DIRECT_URL` with `pnpm --filter @nexus/api exec prisma migrate status`. If the ledger exists, inspect the unresolved entries for the affected database:

```sql
SELECT migration_name, started_at, applied_steps_count
FROM public._prisma_migrations
WHERE finished_at IS NULL AND rolled_back_at IS NULL
ORDER BY started_at;
```

Confirm the job is no longer running and inspect the failed migration's actual database effects, including any partial DDL or data changes. Review row and schema evidence, the migration source and any ledger diagnostics in the restricted session. After the verified effects have been safely undone, an authorized operator can record the attempt with `prisma migrate resolve --rolled-back <migration_name>`. Use `prisma migrate resolve --applied <migration_name>` only after independently verifying that all intended effects are already present. Keep migration files and history intact. Run pending migrations and API/web verification using the release steps above. An already completed job can be rerun safely against the same compatible release.

To stop a failed rollout, keep ingress paused and stop the new web/API. Reopen traffic on a previous release only after confirming its schema and migration history match the database it will use. If committed DDL or data changes make that database incompatible, use a reviewed forward fix or recover a matching database from a verified backup under the recovery plan. Rehearse restore and verify data and readiness before routing traffic to the recovered stack.

## Separate deployment

Build each app independently:

```sh
pnpm --filter @nexus/web build
pnpm --filter @nexus/api build
```

Deploy `apps/web` to a Next.js-compatible Node.js host or Vercel with the repository root as the workspace root. Build the web app and run `pnpm start:web`. The build prepares `.next/standalone` with the server, public assets, and generated static assets. You can deploy that directory independently and run `apps/web/server.js` with Node, setting `PORT` and `HOSTNAME` as needed. Docker uses the same standalone artifact. This is a server deployment; `apps/web/dist` is no longer produced.

Set the server-only `API_PROXY_TARGET` before building to the Express API origin, such as `https://api.example.com`. Rewrites are resolved at build time, so rebuild when this target changes. Docker builds default to `http://api:3001` through a build argument of the same name. Leave `NEXT_PUBLIC_API_URL` empty to use same-origin `/api` calls, or set it at build time to a public API origin for direct browser requests. Direct requests require `WEB_ORIGIN` on the API to match the frontend's origin. Existing local `VITE_API_URL` settings must be renamed to `NEXT_PUBLIC_API_URL`.

Deploy `apps/api` to a Node.js host with its production dependencies, built `dist`, the matching `prisma/migrations` directory, and `DATABASE_URL`. Set `NODE_ENV=production` and `WEB_ORIGIN` to the web app's public origin. Use the same gated release order as above. Drain old traffic, then run `pnpm --filter @nexus/api exec node scripts/deploy-migrations.mjs` once from the built release checkout with Prisma CLI installed and both database URLs set as described above. After the job succeeds, start the API with `pnpm --filter @nexus/api start` and wait for `/api/ready` before enabling traffic. Keep database credentials out of `NEXT_PUBLIC_` variables.

## Commands

| Command                             | Purpose                                             |
| ----------------------------------- | --------------------------------------------------- |
| `pnpm dev`                          | Run both apps                                       |
| `pnpm build`                        | Build both apps                                     |
| `pnpm typecheck`                    | Typecheck both apps                                 |
| `pnpm test`                         | Run every suite: API, web unit, then Playwright     |
| `pnpm test:unit`                    | Run the API and web unit suites (no browser)        |
| `pnpm test:api` / `pnpm test:web`   | Run one suite (runners live in `scripts/tests/`)    |
| `pnpm --filter @nexus/web test`     | Test frontend auth behavior                         |
| `pnpm --filter @nexus/web test:e2e` | Test migration routes, auth, and roles in a browser |
| `pnpm --filter @nexus/api test`     | Test API routes, passwords, and roles               |
| `pnpm --filter @nexus/api db:seed`  | Seed the first Superadmin                           |
| `pnpm start:api`                    | Start the built API                                 |
| `pnpm start:web`                    | Start the built Next.js web app                     |
| `pnpm preview:web`                  | Alias for starting the built web app                |
| `pnpm db:generate`                  | Generate Prisma Client                              |
| `pnpm db:migrate --name <name>`     | Create and apply a migration                        |
| `pnpm db:studio`                    | Open Prisma Studio                                  |

Add shadcn/ui components from `apps/web` with `pnpm dlx shadcn@latest add <component>`. The web app already includes a Button and `components.json`.

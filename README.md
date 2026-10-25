# Nexus Starter

A pnpm workspace with two independent apps:

| App           | Stack                                                             | Default address       |
| ------------- | ----------------------------------------------------------------- | --------------------- |
| `apps/web`    | React, TypeScript, Vite, React Router, Tailwind CSS v4, shadcn/ui | http://localhost:5173 |
| `apps/api`    | Express, TypeScript, Prisma, Supabase PostgreSQL                  | http://localhost:3001 |
| `apps/mobile` | Kotlin Multiplatform (KMP), Compose Multiplatform (CMP)           | Android & iOS         |

The browser calls the API over HTTP. Prisma and database credentials exist only in `apps/api`.

## Requirements

- Node.js 22.12+ or 24+
- pnpm
- A Supabase project for the database check and migrations

## Run locally

```sh
pnpm install
copy apps/api/.env.example apps/api/.env
pnpm dev
```

On macOS or Linux, use `cp` instead of `copy`. Open http://localhost:5173. The web app forwards `/api` to the API on port 3001 during development. The API health check works before database setup.

In Supabase, open **Connect** and copy the **Transaction pooler** URL into `DATABASE_URL` and the **Direct connection** URL into `DIRECT_URL` in `apps/api/.env`. Add `pgbouncer=true` to the transaction pooler URL if it is absent. For migrations from an IPv4-only network, use the **Session pooler** URL for `DIRECT_URL`. Keep these URLs out of web environment variables.

For verified TLS, download the database CA certificate from Supabase **Database Settings → SSL Configuration**. Set `sslmode=verify-full` and `sslrootcert=<URL-encoded absolute path to the certificate>` on both URLs. For example, a certificate saved as `C:\certs\supabase-ca.crt` uses `sslrootcert=C%3A%2Fcerts%2Fsupabase-ca.crt`. The `pg` driver currently treats `sslmode=require` as `verify-full` and emits a warning; changing only the mode does not fix an untrusted certificate. If your organization installs its CA in the Windows certificate store, Node 24 can also use it when launched with `NODE_USE_SYSTEM_CA=1`.

After reviewing the target Supabase project and schema, apply the committed migrations:

```sh
pnpm --filter @nexus/api exec prisma migrate deploy
```

The `ExampleItem` model in `apps/api/prisma/schema.prisma` is a placeholder for your own data model.

The account pages are at `/login` and `/register`. They use the project's shadcn/ui Button, Input, and Label components and submit to the API. Field validation appears beside inputs, while Sileo shows sign-in and account outcome toasts. Successful sign-in plays the GSAP EXP loader before opening `/dashboard`; the success toast appears after the loader exits. Registration opens the dashboard directly. The registration form saves the full name and contact number, so apply the newest migration before using it. The three community photos in `apps/web/public/auth` are temporary local assets. Social icons on the form are visual placeholders; only email and password sign-in is available.

Frontend code is organized by feature under `apps/web/src/features`. Auth owns its API calls, form schema, types, localized copy, account loading, and components. Dashboard is an empty page; accounts owns the Admin and Superadmin account management page; status owns the starter health checks. The shared portal shell lives in `components/layout`, shadcn/ui primitives in `components/ui`, and cross-feature utilities in `lib`. `App.tsx` defines the routes. Run `pnpm --filter @nexus/web test` for auth API and validation checks.

The API follows the same feature layout under `apps/api/src/features`: auth owns credentials, sessions, and login limits; users owns account administration and role rules; health owns service checks. `app.ts` mounts the routes and handles HTTP errors, `index.ts` starts the server, and `lib/db.ts` provides Prisma access. `apps/api/prisma/seed.ts` is the Prisma seed entry point. Run `pnpm --filter @nexus/api test` for backend checks.

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

The default Docker Compose setup runs Vite and the API in development mode. It watches the mounted source files, so frontend edits appear without rebuilding. Vite forwards `/api` requests to the API container. PostgreSQL stays on Supabase.

```sh
copy docker.env.example .env
docker compose up --build -d
```

On macOS or Linux, use `cp` instead of `copy`. Open http://localhost:5173. The API is also available at http://localhost:3001. Fill in `DATABASE_URL` in the root `.env` for Supabase access and use `sslmode=verify-full`. The API image trusts the bundled Supabase 2021 root CA in `certs/supabase-root-2021.crt`. Download an updated CA from Supabase Database Settings if Supabase rotates it. The API health check works without `DATABASE_URL`; the database check reports unavailable until it is set. Do not commit `.env`.

```sh
docker compose ps
docker compose down
```

Change `WEB_PORT` or `API_PORT` in `.env` to use other host ports. If you change the browser origin, update `WEB_ORIGIN`. Source edits reload automatically; dependency changes require `docker compose up --build -d`. Run Prisma migrations using `pnpm db:migrate --name <name>` from the host with `apps/api/.env` configured.

The built Nginx version remains available with `docker compose -f compose.prod.yaml up --build -d` at http://localhost:8080. Stop the development containers first with `docker compose down`. The production runtime API image does not include Prisma CLI tooling.

## Separate deployment

Build each app independently:

```sh
pnpm --filter @nexus/web build
pnpm --filter @nexus/api build
```

Deploy `apps/web/dist` to a static host. Set `VITE_API_URL` when building the web app to the public API origin, such as `https://api.example.com`. Deploy `apps/api` to a Node.js host with its production dependencies, built `dist`, and `DATABASE_URL`. Set `WEB_ORIGIN` to the web app's public origin, then run `pnpm --filter @nexus/api start`. Set `DIRECT_URL` in the environment used to run Prisma migrations.

`VITE_API_URL` contains only the public API address. Never put Supabase database credentials in a `VITE_` variable.

## Commands

| Command                            | Purpose                               |
| ---------------------------------- | ------------------------------------- |
| `pnpm dev`                         | Run both apps                         |
| `pnpm build`                       | Build both apps                       |
| `pnpm typecheck`                   | Typecheck both apps                   |
| `pnpm --filter @nexus/web test`    | Test frontend auth behavior           |
| `pnpm --filter @nexus/api test`    | Test API routes, passwords, and roles |
| `pnpm --filter @nexus/api db:seed` | Seed the first Superadmin             |
| `pnpm start:api`                   | Start the built API                   |
| `pnpm preview:web`                 | Preview the built web app             |
| `pnpm db:generate`                 | Generate Prisma Client                |
| `pnpm db:migrate --name <name>`    | Create and apply a migration          |
| `pnpm db:studio`                   | Open Prisma Studio                    |

Add shadcn/ui components from `apps/web` with `pnpm dlx shadcn@latest add <component>`. The web app already includes a Button and `components.json`.

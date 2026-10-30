# Prisma Guide

## Client Management related records

The `20261027100000_client_related_records` migration adds `ServiceRequest` and `Project` tables, status enums, and client lookup indexes. Both `clientId` foreign keys reference `User.id`; requests also reference `Service.id` through `serviceId`. Deleting a referenced client or service is restricted to preserve history. Existing client accounts remain `User` records with role `USER`. No existing account rows are transformed and no sample data is inserted. See [Client Management](features/client-management.md) for fields, statuses and read endpoints.

Apply with `pnpm --filter @nexus/api exec prisma migrate deploy`, then regenerate with `pnpm db:generate` and restart the API. The client drawer will show saved records associated with the selected client's User ID; an account with no related rows has a genuine empty tab. Requests/projects created through Prisma receive generated CUIDs and maintained timestamps; raw SQL inserts must provide `id` and `updatedAt` as well as required foreign keys.

This guide covers the Prisma 7 setup in Nexus. Run all commands from the repository root. The API uses PostgreSQL through Prisma Client and the `@prisma/adapter-pg` driver adapter.

## Project files

| File or directory                                                   | Purpose                                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma) | Models, relations, enums, and client generator                            |
| [`apps/api/prisma/migrations`](../apps/api/prisma/migrations)       | Versioned SQL migrations; commit these with schema changes                |
| [`apps/api/prisma.config.ts`](../apps/api/prisma.config.ts)         | CLI connection URL, schema path, migrations path, and seed command        |
| [`apps/api/prisma/seed.ts`](../apps/api/prisma/seed.ts)             | Bootstrap accounts and default departments                                |
| [`apps/api/src/lib/db.ts`](../apps/api/src/lib/db.ts)               | Shared Prisma Client and PostgreSQL connection pool                       |
| `apps/api/src/generated/prisma`                                     | Generated client; ignored by Git and regenerated locally or during builds |
| `apps/api/.env`                                                     | Local API credentials; ignored by Git                                     |

The schema contains `User`, `Session`, `Department`, `Team`, and the starter `ExampleItem` model. Roles are `SUPERADMIN`, `ADMIN`, `STAFF`, and `USER`.

## First-time setup

Install dependencies, then copy the environment template only if `apps/api/.env` does not already exist:

```powershell
pnpm install
Copy-Item apps/api/.env.example apps/api/.env
```

On macOS or Linux, use `cp apps/api/.env.example apps/api/.env` for the copy step.

Fill in the connection strings using [`apps/api/.env.example`](../apps/api/.env.example):

| Variable       | Used by                            | Connection                                                              |
| -------------- | ---------------------------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL` | API runtime and seed script        | Supabase transaction pooler; use the URL options from the template      |
| `DIRECT_URL`   | Prisma CLI, migrations, and Studio | Supabase direct connection, or session pooler for networks without IPv6 |

Both URLs should point to the same project and database. `prisma.config.ts` loads `apps/api/.env` when invoked through the filtered commands below. Shell environment variables take precedence over values loaded by dotenv. The API's `getPrisma()` uses `DATABASE_URL`, falling back to `DIRECT_URL` if it is unset.

Keep database credentials in the API environment. Never put them in a frontend `NEXT_PUBLIC_` variable or commit `.env` files. Follow the template's `sslmode` and CA certificate settings; certificate paths must be absolute and URL-encoded in the connection URL.

Apply the repository's existing migrations and generate the client:

```sh
pnpm --filter @nexus/api exec prisma migrate deploy
pnpm db:generate
pnpm --filter @nexus/api exec prisma migrate status
```

This initializes a new database from migration history or applies pending migrations to an existing one. Confirm the target database before running the deploy command.

## Common commands

| Task                                              | Command                                                                                |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Check the installed version                       | `pnpm --filter @nexus/api exec prisma --version`                                       |
| Validate the schema                               | `pnpm --filter @nexus/api exec prisma validate`                                        |
| Format the schema                                 | `pnpm --filter @nexus/api exec prisma format`                                          |
| Generate Prisma Client                            | `pnpm db:generate`                                                                     |
| Create and apply a development migration          | `pnpm --filter @nexus/api exec prisma migrate dev --name migration_name`               |
| Create a migration for SQL review before applying | `pnpm --filter @nexus/api exec prisma migrate dev --name migration_name --create-only` |
| Apply existing migrations                         | `pnpm --filter @nexus/api exec prisma migrate deploy`                                  |
| Compare migration history with the database       | `pnpm --filter @nexus/api exec prisma migrate status`                                  |
| Run the seed script                               | `pnpm --filter @nexus/api db:seed`                                                     |
| Open Prisma Studio                                | `pnpm db:studio`                                                                       |
| Typecheck the API and regenerate the client       | `pnpm --filter @nexus/api typecheck`                                                   |

Generating the client updates TypeScript code; it does not update database tables. Prisma 7 requires explicit client generation and seeding after migrations. Nexus's API `dev`, `build`, `typecheck`, and `test` scripts already generate the client. See the [Prisma 7 CLI reference](https://www.prisma.io/docs/orm/v7/reference/prisma-cli-reference).

The seed script creates the standard company departments and 15 default services. Service seeds are idempotent: rerunning the script refreshes their descriptions and department assignments while preserving any active or inactive status selected in Service Management.

To seed only the prerequisite departments and services without processing account bootstrap variables, run:

```sh
pnpm --filter @nexus/api db:seed:services
```

## Changing the schema

Use a development database when authoring migrations.

1. Edit `apps/api/prisma/schema.prisma`.
2. Format and validate it:

   ```sh
   pnpm --filter @nexus/api exec prisma format
   pnpm --filter @nexus/api exec prisma validate
   ```

3. Create the migration without applying the new SQL yet:

   ```sh
   pnpm --filter @nexus/api exec prisma migrate dev --name describe_your_change --create-only
   ```

4. Review the new `migration.sql` in `apps/api/prisma/migrations`. Check defaults and how the SQL handles existing rows, especially when adding required fields or changing relations.
5. Apply the pending migration to your development database, regenerate the client, and check the API:

   ```sh
   pnpm --filter @nexus/api exec prisma migrate dev
   pnpm db:generate
   pnpm --filter @nexus/api typecheck
   pnpm --filter @nexus/api test
   ```

6. Commit the schema and new migration together. Generated client files stay out of Git. Restart an already-running API after regenerating the client.

`migrate dev`, including `--create-only`, checks migration history and can request a reset when it detects drift. Do not accept a reset on a database containing data you need. Avoid changing SQL migrations that have already been applied; make a new migration for the correction.

Development migrations use a temporary shadow database. If the database user cannot create one, configure a separate disposable database using `datasource.shadowDatabaseUrl` in `prisma.config.ts`. This project does not configure one by default. Never use your application database as the shadow database. See [Prisma's shadow database guide](https://www.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/shadow-database) and [Prisma 7 configuration reference](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference).

## Applying changes after pulling code or deploying

When the migration already exists in the repository, apply it without creating another migration:

```sh
pnpm --filter @nexus/api exec prisma migrate status
pnpm --filter @nexus/api exec prisma migrate deploy
pnpm db:generate
pnpm --filter @nexus/api exec prisma migrate status
```

The first status check can exit with a nonzero status when migrations are pending; read its output. `migrate deploy` applies pending SQL migrations, does not create new migrations from schema edits, and does not need a shadow database. Run it against staging or production from a release environment with Prisma CLI dependencies and the intended `DIRECT_URL` configured. Build and restart the API with the updated client.

The account deactivation feature adds `User.isActive` in `20261026090000_account_status`. Apply that migration before starting the updated API. Existing and new users default to active. Application deactivation also revokes sessions and enforces permissions; use Account Management for that action. See [the access control documentation](rbac.md).

Service Management adds the `Service` table in `20261026120000_add_services`. The `20261026170000_allow_multiple_service_departments` migration converts its original single-department foreign key into a many-to-many relationship and preserves every existing assignment. Each service requires at least one valid department; the API prevents deleting a department while any service still uses it. Service deactivation keeps the row and all department relationships intact.

Docker Compose supplies the runtime `DATABASE_URL` from the root `.env`. Host Prisma commands use `apps/api/.env`; these environments are separate. The production API image does not contain the Prisma CLI, so run migrations from the host or a release job with dependencies installed.

## Seeding accounts and departments

For the first Superadmin, add these variables to `apps/api/.env`, replacing the example values:

```dotenv
BOOTSTRAP_EMAIL="superadmin@example.com"
BOOTSTRAP_PASSWORD="replace-with-a-unique-password-of-at-least-12-characters"
```

Optionally add a separate Admin:

```dotenv
ADMIN_BOOTSTRAP_EMAIL="admin@example.com"
ADMIN_BOOTSTRAP_PASSWORD="replace-with-another-unique-password-of-at-least-12-characters"
```

Then run:

```sh
pnpm --filter @nexus/api db:seed
```

The seed uses the runtime connection from `getPrisma()` and runs these steps in order:

1. Create a Superadmin if none exists. An existing Superadmin causes this step to be skipped, even if inactive. Otherwise, valid bootstrap credentials and an unused email are required.
2. Create the optional Admin if both Admin variables are supplied. An existing Admin with that email is skipped; another role using the email causes an error.
3. Upsert Executive, Administration, Advertising, Marketing, Customer Success, SEO, and Information Technology departments. Existing departments with those names have their code and description updated.

The seed does not reset existing account passwords or reactivate accounts. If an earlier step fails, later steps do not run. Remove bootstrap passwords from the environment after setup.

## Browsing data

```sh
pnpm db:studio
```

Studio uses the CLI connection configured through `DIRECT_URL`. Edits in Studio write directly to the database and bypass API permissions and workflows. For account access changes, use Account Management so the API handles session revocation.

The `db:studio` launcher loads `apps/api/.env` and starts the installed Prisma CLI with a trusted CA. It uses the certificate specified by `sslrootcert`, then `NODE_EXTRA_CA_CERTS`, or the repository's `certs/supabase-root-2021.crt` for Supabase connections. Studio 0.33 uses a different PostgreSQL driver from the API and migrations; the launcher passes the CA through `NODE_EXTRA_CA_CERTS` instead of forwarding `sslrootcert` to PostgreSQL. TLS verification remains enabled. Restart Studio after changing connection or certificate settings.

## Troubleshooting

| Symptom                                                               | What to check                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DIRECT_URL` missing or CLI datasource error                          | Set `DIRECT_URL` in `apps/api/.env` and use `pnpm --filter @nexus/api exec prisma ...` from the repository root.                                                                                                                                                                                |
| Missing generated client or TypeScript does not recognize a new field | Run `pnpm db:generate`, then restart the API or editor TypeScript service.                                                                                                                                                                                                                      |
| Database column or table does not exist                               | Check `migrate status` and apply the pending migrations. Generating the client alone does not change the database.                                                                                                                                                                              |
| Connection fails or times out                                         | Confirm the selected project, hostname, credentials, and network access. For IPv4-only networks, use the session pooler URL for `DIRECT_URL` as described in the environment template.                                                                                                          |
| TLS certificate error                                                 | Check the database CA certificate and URL-encoded absolute `sslrootcert` path. Runtime SSL settings also live in `apps/api/src/lib/db.ts`; CLI and API connection behavior can differ.                                                                                                          |
| Studio: `Could not load schema metadata`                              | Run `pnpm db:studio` to use the CA-aware launcher. A `self-signed certificate in certificate chain` error means the CA is missing; it does not establish a permissions problem. If it persists, inspect the underlying connection error and confirm `DIRECT_URL` targets the intended database. |
| Shadow database permission error                                      | Use a development database with the required permissions, or configure a separate disposable shadow database. Existing migration deployment does not require one.                                                                                                                               |
| Drift or reset prompt                                                 | Stop and compare the actual database with migration history. Preserve needed data before choosing a recovery approach.                                                                                                                                                                          |
| Seed skips an existing account                                        | The seed deliberately preserves accounts and passwords; use the application to manage existing accounts.                                                                                                                                                                                        |

To check runtime connectivity, start the API and open `http://localhost:3001/api/db-check`. Its `SELECT 1` probe checks connectivity, not whether all migrations have been applied. `/api/health` only checks that the API is running.

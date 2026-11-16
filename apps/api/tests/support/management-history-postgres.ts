/** Explicit opt-in native test entry, not a live-DB/URL runner.
 * node scripts/run-tests.mjs tests/support/management-history-postgres.ts
 * Uses only a new, network-isolated local Docker PostgreSQL container. */
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { test } from "node:test"
import { migrationNames, readMigration } from "./pglite-app.js"

const tables = ["AccountManagementChange", "WorkforceManagementChange"] as const
type HistoryTable = (typeof tables)[number]

test(
  "real PostgreSQL: management history privileges, guards and owner limitations",
  { timeout: 180_000 },
  async (t) => {
    const nonce = randomUUID()
    const container = `converyn-history-test-${nonce}`
    // Ignore user Docker contexts/credentials and inherited remote DOCKER_HOST.
    const dockerPrefix = [
      "--config",
      join(tmpdir(), `converyn-history-docker-${nonce}`),
      "--host",
      process.platform === "win32"
        ? "npipe:////./pipe/docker_engine"
        : "unix:///var/run/docker.sock",
    ]
    async function docker(
      args: string[],
      input = "",
      timeout = 30_000,
    ): Promise<string> {
      return new Promise((resolve, reject) => {
        const child = spawn(
          process.platform === "win32" ? "docker.exe" : "docker",
          [...dockerPrefix, ...args],
          {
            windowsHide: true,
            stdio: ["pipe", "pipe", "pipe"],
          },
        )
        let stdout = "",
          stderr = ""
        const timer = setTimeout(() => {
          child.kill()
          reject(new Error("Disposable PostgreSQL command timed out"))
        }, timeout)
        child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
          stdout += chunk
        })
        child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
          stderr += chunk
        })
        child.once("error", (error) => {
          clearTimeout(timer)
          reject(error)
        })
        child.once("close", (code) => {
          clearTimeout(timer)
          if (code === 0) resolve(stdout.trim())
          else
            reject(
              new Error(
                `Disposable PostgreSQL command failed (${code}): ${stderr}`,
              ),
            )
        })
        child.stdin.on("error", () => {
          /* Process failure is reported by close/error. */
        })
        child.stdin.end(input)
      })
    }
    await docker([
      "run",
      "--detach",
      "--rm",
      "--pull=never",
      "--name",
      container,
      "--label",
      `converyn.history-test=${nonce}`,
      "--network",
      "none",
      "--tmpfs",
      "/var/lib/postgresql/data:rw,noexec,nosuid",
      "--env",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "postgres:16-alpine",
    ])
    t.after(async () => {
      assert.equal(
        await docker([
          "inspect",
          "--format",
          '{{ index .Config.Labels "converyn.history-test" }}',
          container,
        ]),
        nonce,
      )
      await docker(["rm", "--force", "--volumes", container])
    })
    for (let attempt = 0; ; attempt++) {
      try {
        await docker(
          [
            "exec",
            container,
            "pg_isready",
            "--host=127.0.0.1",
            "--username=postgres",
          ],
          "",
          5_000,
        )
        break
      } catch (error) {
        if (attempt >= 99) throw error
        await delay(100)
      }
    }
    const sql = (
      user: string,
      statement: string,
      variables: Readonly<Record<string, string>> = {},
    ) =>
      docker(
        [
          "exec",
          "--interactive",
          container,
          "psql",
          "-X",
          "--quiet",
          "--tuples-only",
          "--no-align",
          "--no-password",
          "--dbname=postgres",
          `--username=${user}`,
          "--set=ON_ERROR_STOP=1",
          "--set=VERBOSITY=sqlstate",
          ...Object.entries(variables).map(
            ([key, value]) => `--set=${key}=${value}`,
          ),
        ],
        statement,
      )
    // The real local socket connects as each named LOGIN role; no production URL,
    // host mount, published port, application environment file or cloud service.
    for (const name of await migrationNames())
      await sql("postgres", await readMigration(name))
    t.diagnostic(
      `Disposable ${await sql("postgres", "SHOW server_version;")}; all repository migrations applied`,
    )
    await sql(
      "postgres",
      `
    CREATE ROLE history_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    CREATE ROLE history_writer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    CREATE ROLE history_runtime LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    CREATE ROLE history_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    CREATE ROLE history_browser_anon LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    CREATE ROLE history_browser_authenticated LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    CREATE ROLE history_overgrant LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    CREATE ROLE history_bypass LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;
    CREATE ROLE history_bad_membership LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    GRANT USAGE ON SCHEMA public TO history_owner, history_writer, history_runtime,
      history_reader, history_browser_anon, history_browser_authenticated,
      history_overgrant, history_bypass, history_bad_membership;
    ALTER TABLE public."AccountManagementChange" OWNER TO history_owner;
    ALTER TABLE public."WorkforceManagementChange" OWNER TO history_owner;
    ALTER FUNCTION public.reject_management_history_mutation() OWNER TO history_owner;
    REVOKE ALL ON public."AccountManagementChange", public."WorkforceManagementChange" FROM PUBLIC;
    GRANT SELECT, INSERT ON public."AccountManagementChange", public."WorkforceManagementChange" TO history_writer;
    GRANT history_writer TO history_runtime;
    GRANT SELECT ON public."AccountManagementChange", public."WorkforceManagementChange" TO history_reader;
    GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public."AccountManagementChange", public."WorkforceManagementChange" TO history_overgrant, history_bypass;
    GRANT history_owner TO history_bad_membership;
  `,
    )
    const insert = (table: HistoryTable, id: string) => {
      assert.match(id, /^[a-z0-9-]+$/)
      const subject =
        table === tables[0]
          ? '"subjectAccountId"'
          : '"subjectType", "subjectId"'
      const values =
        table === tables[0] ? "'deleted-account'" : "'TEAM', 'deleted-team'"
      const origin =
        table === tables[0] ? "ACCOUNT_MANAGEMENT" : "TEAM_MANAGEMENT"
      return `INSERT INTO public."${table}" (id, "actorAccountId", "actorRoleAtTime", "operationId", ${subject}, action, origin, "changedFields", changes)
      VALUES ('${id}', 'deleted-actor', 'ADMIN', '10000000-0000-4000-8000-000000000001', ${values}, 'PROFILE_UPDATED', '${origin}', ARRAY[]::text[], '{}');`
    }
    const state = () =>
      sql(
        "postgres",
        `SELECT json_build_array(
    (SELECT json_agg(t ORDER BY id) FROM public."AccountManagementChange" t),
    (SELECT json_agg(t ORDER BY id) FROM public."WorkforceManagementChange" t));`,
      )
    async function denied(
      user: string,
      statement: string,
      code: "23514" | "42501",
    ) {
      await assert.rejects(
        sql(user, statement),
        new RegExp(`ERROR:\\s+${code}`),
      )
    }

    await t.test(
      "explicit model preserves SELECT/INSERT through inherited writer grants",
      async () => {
        assert.equal(
          await sql("history_runtime", "SELECT current_user;"),
          "history_runtime",
        )
        for (const [index, table] of tables.entries()) {
          await sql("history_runtime", insert(table, `runtime-${index}`))
          for (const user of ["history_runtime", "history_reader"])
            assert.equal(
              await sql(user, `SELECT count(*) FROM public."${table}";`),
              "1",
            )
          await denied(
            "history_reader",
            insert(table, `reader-${index}`),
            "42501",
          )
        }
        assert.equal(
          await sql(
            "history_runtime",
            "SELECT pg_has_role(current_user, 'history_writer', 'USAGE'), pg_has_role(current_user, 'history_owner', 'MEMBER');",
          ),
          "t|f",
        )
        assert.equal(
          await sql(
            "postgres",
            `SELECT string_agg(relrowsecurity::text || ':' || relforcerowsecurity::text, ',' ORDER BY relname)
      FROM pg_class WHERE oid IN ('public."AccountManagementChange"'::regclass, 'public."WorkforceManagementChange"'::regclass);`,
          ),
          "false:false,false:false",
        )
      },
    )

    await t.test(
      "browser LOGIN roles have no direct history privileges in this model",
      async () => {
        for (const user of [
          "history_browser_anon",
          "history_browser_authenticated",
        ]) {
          for (const [index, table] of tables.entries()) {
            await denied(user, `SELECT * FROM public."${table}";`, "42501")
            await denied(user, insert(table, `browser-${index}`), "42501")
            await denied(
              user,
              `UPDATE public."${table}" SET changes = '{}';`,
              "42501",
            )
            await denied(user, `DELETE FROM public."${table}";`, "42501")
            await denied(user, `TRUNCATE public."${table}";`, "42501")
          }
        }
      },
    )

    await t.test(
      "runtime ACL denies destruction and over-granted nonowners hit immutable guards",
      async () => {
        const before = await state()
        for (const table of tables) {
          for (const statement of [
            `UPDATE public."${table}" SET changes = '{}';`,
            `UPDATE public."${table}" SET changes = '{}' WHERE false;`,
            `DELETE FROM public."${table}";`,
            `DELETE FROM public."${table}" WHERE false;`,
            `TRUNCATE public."${table}" CASCADE;`,
          ]) {
            await denied("history_runtime", statement, "42501")
            await denied("history_overgrant", statement, "23514")
            await denied("history_bypass", statement, "23514")
          }
        }
        assert.equal(await state(), before)
      },
    )

    await t.test(
      "ordinary runtime cannot disable/drop guards, replace the function or assume owner",
      async () => {
        for (const table of tables) {
          await denied(
            "history_runtime",
            `ALTER TABLE public."${table}" DISABLE TRIGGER ALL;`,
            "42501",
          )
          await denied(
            "history_runtime",
            `DROP TABLE public."${table}" CASCADE;`,
            "42501",
          )
        }
        await denied(
          "history_runtime",
          'DROP TRIGGER account_management_history_immutable ON public."AccountManagementChange";',
          "42501",
        )
        await denied(
          "history_runtime",
          "CREATE OR REPLACE FUNCTION public.reject_management_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;",
          "42501",
        )
        await denied(
          "history_runtime",
          "DROP FUNCTION public.reject_management_history_mutation() CASCADE;",
          "42501",
        )
        await denied(
          "history_runtime",
          "SELECT public.reject_management_history_mutation();",
          "42501",
        )
        await denied("history_runtime", "SET ROLE history_owner;", "42501")
        await denied("history_runtime", "DROP SCHEMA public CASCADE;", "42501")
        await denied(
          "history_runtime",
          "SET session_replication_role = replica;",
          "42501",
        )
      },
    )

    await t.test(
      "ALWAYS guards still reject a superuser session in replica mode",
      async () => {
        for (const table of tables)
          await denied(
            "postgres",
            `BEGIN; SET LOCAL session_replication_role = replica; DELETE FROM public."${table}"; COMMIT;`,
            "23514",
          )
        assert.equal(
          await sql(
            "postgres",
            `SELECT string_agg(tgenabled::text, ',' ORDER BY tgname) FROM pg_trigger
      WHERE tgname IN ('account_management_history_immutable', 'workforce_management_history_immutable');`,
          ),
          "A,A",
        )
      },
    )

    await t.test(
      "multi-table TRUNCATE cannot partially remove unrelated rows",
      async () => {
        await sql(
          "postgres",
          `CREATE TABLE public.history_sibling (id integer); INSERT INTO public.history_sibling VALUES (1);
      GRANT SELECT, TRUNCATE ON public.history_sibling TO history_overgrant;`,
        )
        const before = await state()
        await denied(
          "history_overgrant",
          'TRUNCATE public.history_sibling, public."AccountManagementChange", public."WorkforceManagementChange" CASCADE;',
          "23514",
        )
        assert.equal(
          await sql("postgres", "SELECT count(*) FROM public.history_sibling;"),
          "1",
        )
        assert.equal(await state(), before)
      },
    )

    await t.test(
      "failed destructive statement rolls back preceding history inserts",
      async () => {
        const before = await state()
        await denied(
          "history_overgrant",
          `BEGIN; ${insert(tables[0], "rollback-account")} ${insert(tables[1], "rollback-workforce")}
      DELETE FROM public."WorkforceManagementChange"; COMMIT;`,
          "23514",
        )
        assert.equal(await state(), before)
      },
    )

    await t.test(
      "owner or SET ROLE membership remains a privileged bypass, even with NOINHERIT",
      async () => {
        const before = await state()
        await sql(
          "history_bad_membership",
          `BEGIN; SET LOCAL ROLE history_owner;
      ALTER TABLE public."AccountManagementChange" DISABLE TRIGGER account_management_history_immutable;
      UPDATE public."AccountManagementChange" SET "actorAccountId" = 'tampered'; ROLLBACK;`,
        )
        assert.equal(await state(), before)
        assert.equal(
          await sql(
            "postgres",
            `SELECT tgenabled FROM pg_trigger WHERE tgname = 'account_management_history_immutable';`,
          ),
          "A",
        )
      },
    )

    await t.test(
      "incorrect browser inheritance grants access; rollback restores denial",
      async () => {
        assert.equal(
          await sql(
            "postgres",
            `BEGIN; GRANT history_writer TO history_browser_authenticated;
      SET LOCAL ROLE history_browser_authenticated; SELECT count(*) FROM public."AccountManagementChange"; ROLLBACK;`,
          ),
          "1",
        )
        await denied(
          "history_browser_authenticated",
          'SELECT * FROM public."AccountManagementChange";',
          "42501",
        )
      },
    )

    const inspectionSql = await readFile(
      new URL("./system-logs-privilege-inspection.sql", import.meta.url),
      "utf8",
    )
    type InspectionItem = Record<string, unknown>
    type Inspection = {
      verification: string
      transactionReadOnly: boolean
      foundTableCount: number
      runtimeEqualsMigration: boolean | null
      currentUserAliases: string[]
      sections: Record<
        string,
        { total: number; truncated: boolean; items: InspectionItem[] }
      >
    }
    const inspectionVariables = {
      runtime_role: "history_runtime",
      migration_role: "postgres",
      history_owner_role: "history_owner",
      database_owner_role: "postgres",
      service_role: "history_bypass",
      browser_anon_role: "history_browser_anon",
      browser_authenticated_role: "history_browser_authenticated",
    }
    async function inspect(
      user = "postgres",
      variables: Readonly<Record<string, string>> = inspectionVariables,
    ): Promise<Inspection> {
      const before = await state()
      const output = await sql(user, inspectionSql, variables)
      for (const privateValue of [
        "history_runtime",
        "history_writer",
        "history_browser_anon",
        "history_browser_authenticated",
        "history_bad_membership",
        "history_bypass",
        "deleted-actor",
        "deleted-account",
        "deleted-team",
        "inspection-private-sentinel",
      ])
        assert.ok(
          !output.includes(privateValue),
          `Inspection leaked ${privateValue}`,
        )
      const report: Inspection = JSON.parse(output)
      assert.equal(report.verification, "operator-review-required")
      assert.equal(report.transactionReadOnly, true)
      assert.equal(await state(), before)
      return report
    }
    const items = (report: Inspection, section: string, alias?: string) => {
      assert.equal(
        report.sections[section].truncated,
        false,
        `${section} unexpectedly truncated in fixture`,
      )
      return report.sections[section].items.filter(
        (row) => alias === undefined || row.alias === alias,
      )
    }

    await t.test(
      "operator inspection is read-only, sanitized and usable by the actual runtime LOGIN",
      async () => {
        const report = await inspect("history_runtime")
        assert.deepEqual(report.currentUserAliases, ["runtime"])
        assert.equal(report.foundTableCount, 2)
        assert.equal(report.runtimeEqualsMigration, false)
        assert.equal(items(report, "guards").length, 2)
        for (const guard of items(report, "guards")) {
          assert.equal(guard.enabled, "A")
          assert.equal(guard.event_bits, 58)
          assert.equal(guard.expected_function, true)
          assert.equal(guard.has_condition, false)
        }
        assert.equal(items(report, "guard_function")[0].empty_search_path, true)
        assert.equal(items(report, "guard_function")[0].prosecdef, false)
        for (const row of items(report, "effective_table_access", "runtime")) {
          assert.equal(row.select, true)
          assert.equal(row.insert, true)
          assert.equal(row.update, false)
          assert.equal(row.delete, false)
          assert.equal(row.truncate, false)
          assert.equal(row.can_set_table_owner, false)
        }
        for (const alias of ["browser_anon", "browser_authenticated"])
          for (const row of items(report, "effective_table_access", alias)) {
            assert.equal(row.select, false)
            assert.equal(row.any_column_select, false)
            assert.equal(row.insert, false)
          }
        assert.equal(items(report, "roles", "service")[0].rolbypassrls, true)
      },
    )

    await t.test(
      "unmapped, missing and identical role aliases never become verification success",
      async () => {
        const missing = await inspect("postgres", {})
        assert.ok(
          items(missing, "roles").every((row) => row.status === "not-supplied"),
        )
        assert.equal(missing.runtimeEqualsMigration, null)
        const unknown = await inspect("postgres", {
          runtime_role: "missing'role",
        })
        assert.equal(items(unknown, "roles", "runtime")[0].status, "not-found")
        const same = await inspect("postgres", {
          ...inspectionVariables,
          runtime_role: "postgres",
        })
        assert.equal(same.runtimeEqualsMigration, true)
        assert.equal(items(same, "roles", "runtime")[0].rolsuper, true)
        const ownerPath = await inspect("postgres", {
          ...inspectionVariables,
          runtime_role: "history_bad_membership",
        })
        assert.ok(
          items(ownerPath, "role_contexts", "runtime").some(
            (row) =>
              row.can_set_role === true && row.immediately_inherited === false,
          ),
        )
        assert.ok(
          items(ownerPath, "effective_table_access", "runtime").some(
            (row) => row.can_set_table_owner === true,
          ),
        )
      },
    )

    await t.test(
      "catalog inspection detects column/PUBLIC grants, inherited read paths and default ACLs",
      async () => {
        await sql(
          "postgres",
          `GRANT SELECT (id) ON public."AccountManagementChange" TO history_browser_anon;
        GRANT SELECT ON public."WorkforceManagementChange" TO PUBLIC;
        GRANT history_writer TO history_browser_authenticated;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO history_browser_anon;`,
        )
        try {
          const report = await inspect()
          const columns = items(
            report,
            "effective_table_access",
            "browser_anon",
          ).find((row) => row.source_table === tables[0])!
          assert.equal(columns.select, false)
          assert.equal(columns.any_column_select, true)
          assert.ok(
            items(report, "column_acls").some(
              (row) => row.privilege === "SELECT",
            ),
          )
          assert.ok(
            items(report, "object_acls").some(
              (row) =>
                row.kind === "table" &&
                row.public === true &&
                row.privilege === "SELECT",
            ),
          )
          assert.ok(
            items(report, "default_acls").some(
              (row) => row.privilege === "SELECT",
            ),
          )
          assert.ok(
            items(
              report,
              "effective_table_access",
              "browser_authenticated",
            ).every((row) => row.select === true),
          )
        } finally {
          await sql(
            "postgres",
            `REVOKE SELECT (id) ON public."AccountManagementChange" FROM history_browser_anon;
          REVOKE SELECT ON public."WorkforceManagementChange" FROM PUBLIC;
          REVOKE history_writer FROM history_browser_authenticated;
          ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM history_browser_anon;`,
          )
        }
      },
    )

    await t.test(
      "view/function and RLS metadata expose indirect risks without bodies or expressions",
      async () => {
        await sql(
          "postgres",
          `CREATE VIEW public."inspection-private-sentinel-view" AS SELECT id FROM public."AccountManagementChange";
        GRANT SELECT ON public."inspection-private-sentinel-view" TO history_browser_anon;
        CREATE FUNCTION public."inspection-private-sentinel-function"() RETURNS text LANGUAGE sql SECURITY DEFINER
          AS $$ SELECT 'inspection-private-sentinel-body'::text $$;
        REVOKE ALL ON FUNCTION public."inspection-private-sentinel-function"() FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public."inspection-private-sentinel-function"() TO history_browser_anon;
        ALTER TABLE public."AccountManagementChange" ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "inspection-private-sentinel-policy" ON public."AccountManagementChange" FOR SELECT TO history_runtime
          USING (id <> 'inspection-private-sentinel-expression');`,
        )
        try {
          const report = await inspect()
          assert.ok(
            items(report, "dependent_views", "browser_anon").some(
              (row) => row.select === true && row.security_invoker === false,
            ),
          )
          assert.ok(
            items(report, "callable_security_definers", "browser_anon").length >
              0,
          )
          assert.equal(items(report, "policies")[0].has_using, true)
          assert.equal(
            items(report, "tables").find(
              (row) => row.source_table === tables[0],
            )!.relrowsecurity,
            true,
          )
        } finally {
          await sql(
            "postgres",
            `DROP VIEW public."inspection-private-sentinel-view";
          DROP FUNCTION public."inspection-private-sentinel-function"();
          DROP POLICY "inspection-private-sentinel-policy" ON public."AccountManagementChange";
          ALTER TABLE public."AccountManagementChange" DISABLE ROW LEVEL SECURITY;`,
          )
        }
      },
    )

    await t.test(
      "missing source metadata remains explicit rather than certifying a partial inventory",
      async () => {
        await sql(
          "postgres",
          'ALTER TABLE public."WorkforceManagementChange" RENAME TO "inspection_missing_source";',
        )
        try {
          // state() deliberately uses both normal source names, so this case calls
          // the metadata-only pack directly and validates the missing inventory.
          const report: Inspection = JSON.parse(
            await sql("postgres", inspectionSql, inspectionVariables),
          )
          assert.equal(report.verification, "operator-review-required")
          assert.equal(report.foundTableCount, 1)
          assert.equal(items(report, "guards").length, 1)
        } finally {
          await sql(
            "postgres",
            'ALTER TABLE public."inspection_missing_source" RENAME TO "WorkforceManagementChange";',
          )
        }
      },
    )
  },
)

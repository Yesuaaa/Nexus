import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import pg from "pg"
import { createServer as createTcpServer, type Socket } from "node:net"
import { createSecureContext, TLSSocket } from "node:tls"
import {
  auditPayrollDatabasePermissions,
  requireExplicitPayrollAuditUrl,
  type PayrollAuditQueryClient,
} from "../../../src/lib/payroll-db-permissions-audit.js"
import { databasePoolConfig } from "../../../src/lib/postgres-connection.js"

test("Payroll PostgreSQL connection config preserves local and verified TLS behavior", () => {
  const localUrl =
    "postgresql://local_user:local_password@127.0.0.1:5432/payroll?sslmode=disable"
  const local = databasePoolConfig(localUrl)
  assert.equal(local.connectionString, localUrl)
  assert.equal(local.ssl, undefined)

  const supabase = databasePoolConfig(
    "postgresql://audit:synthetic@db.example.supabase.co:5432/postgres?sslmode=disable&sslrootcert=/ignored/by/verified-config",
  )
  assert.doesNotMatch(supabase.connectionString ?? "", /sslmode|sslrootcert/i)
  const tls = supabase.ssl as {
    ca?: string | string[]
    rejectUnauthorized?: boolean
  }
  assert.equal(tls.rejectUnauthorized, true)
  assert.match(
    Array.isArray(tls.ca) ? tls.ca.join("\n") : (tls.ca ?? ""),
    /-----BEGIN CERTIFICATE-----/,
  )

  const externalTlsUrl =
    "postgresql://user:password@db.example.test:5432/payroll?sslmode=verify-full"
  const externalTls = databasePoolConfig(externalTlsUrl)
  assert.equal(externalTls.connectionString, externalTlsUrl)
  assert.equal(externalTls.ssl, undefined)
})

test(
  "Supabase-style PostgreSQL TLS rejects a server with an untrusted certificate",
  { timeout: 10_000 },
  async (t) => {
    const certificateDirectory = mkdtempSync(
      join(tmpdir(), "payroll-tls-rejection-"),
    )
    const keyPath = join(certificateDirectory, "server.key")
    const certificatePath = join(certificateDirectory, "server.crt")
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-subj",
        "/CN=localhost",
        "-days",
        "1",
        "-keyout",
        keyPath,
        "-out",
        certificatePath,
      ],
      { stdio: "ignore" },
    )
    const secureContext = createSecureContext({
      key: readFileSync(keyPath),
      cert: readFileSync(certificatePath),
    })
    const sockets = new Set<Socket>()
    const server = createTcpServer((socket) => {
      sockets.add(socket)
      socket.once("data", () => {
        socket.pause()
        socket.write("S", () => {
          const secureSocket = new TLSSocket(socket, {
            isServer: true,
            secureContext,
          })
          secureSocket.on("error", () => {})
          secureSocket.once("secure", () => secureSocket.end())
        })
      })
      socket.on("close", () => sockets.delete(socket))
      socket.on("error", () => {})
    })
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject)
      server.listen(0, "127.0.0.1", resolve)
    })
    const address = server.address()
    assert.ok(address && typeof address !== "string")
    const connection = databasePoolConfig(
      "postgresql://synthetic:synthetic@db.example.supabase.co:5432/postgres?sslmode=disable",
    )
    const client = new pg.Client({
      host: "127.0.0.1",
      port: address.port,
      database: "postgres",
      user: "synthetic",
      password: "synthetic",
      ssl: connection.ssl,
      connectionTimeoutMillis: 2_000,
    })
    t.after(async () => {
      await client.end().catch(() => {})
      for (const socket of sockets) socket.destroy()
      await new Promise<void>((resolve) => server.close(() => resolve()))
      rmSync(certificateDirectory, { recursive: true, force: true })
    })

    await assert.rejects(client.connect(), (error: unknown) => {
      const tlsError = error as NodeJS.ErrnoException
      assert.ok(
        tlsError.code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
          tlsError.code === "SELF_SIGNED_CERT_IN_CHAIN" ||
          /certificate|issuer|self.signed/i.test(tlsError.message ?? ""),
        `Expected certificate verification to reject the server, received ${tlsError.code ?? tlsError.message}`,
      )
      return true
    })
  },
)

test("payroll permission audit requires its dedicated explicit URL", () => {
  assert.throws(
    () =>
      requireExplicitPayrollAuditUrl({
        DATABASE_URL: "postgresql://runtime:secret@db.example.test/payroll",
        DIRECT_URL: "postgresql://migration:secret@db.example.test/payroll",
      }),
    /PAYROLL_DB_AUDIT_URL explicitly.*never falls back/s,
  )
  assert.throws(
    () =>
      requireExplicitPayrollAuditUrl({
        PAYROLL_DB_AUDIT_URL: "https://example.test/not-postgres",
      }),
    /must use the PostgreSQL protocol/,
  )
  assert.equal(
    requireExplicitPayrollAuditUrl({
      PAYROLL_DB_AUDIT_URL: "postgresql://audit:secret@localhost/payroll",
    }),
    "postgresql://audit:secret@localhost/payroll",
  )
})

test("permission audit reports unavailable catalog checks without leaking errors", async () => {
  const issued: string[] = []
  const client: PayrollAuditQueryClient = {
    async query(text) {
      issued.push(text)
      if (
        text === "BEGIN READ ONLY" ||
        text.startsWith("SAVEPOINT") ||
        text.startsWith("RELEASE SAVEPOINT") ||
        text.startsWith("ROLLBACK TO SAVEPOINT") ||
        text === "ROLLBACK"
      ) {
        return { rows: [] }
      }
      if (text.includes("current_user::text AS current_user")) {
        return {
          rows: [
            {
              current_user: "payroll_audit_test",
              session_user: "payroll_audit_test",
              database: "disposable_payroll",
              server_version: "PostgreSQL 16.0",
              server_version_number: 160000,
              transaction_read_only: true,
              default_read_only: true,
            },
          ],
        }
      }
      if (
        text.includes("FROM pg_catalog.pg_roles") &&
        text.includes("rolsuper")
      ) {
        return {
          rows: [
            {
              rolname: "payroll_audit_test",
              rolsuper: false,
              rolbypassrls: false,
              rolcreaterole: false,
              rolcreatedb: false,
              rolinherit: true,
              rolreplication: false,
            },
          ],
        }
      }
      if (text.includes("pg_has_role(current_user, r.oid")) return { rows: [] }
      if (text.includes("pg_get_userbyid(c.relowner) AS owner_name")) {
        return { rows: [{ owner_name: "migration_owner" }] }
      }
      if (text.includes("has_table_privilege(current_user")) {
        return { rows: [] }
      }
      if (text.includes("has_schema_privilege(current_user")) {
        return {
          rows: [
            {
              schema_name: "public",
              owner_name: "migration_owner",
              can_create: false,
              can_use: true,
              owns_schema: false,
            },
          ],
        }
      }
      if (text.includes("has_database_privilege(current_user")) {
        return { rows: [{ can_create: false }] }
      }
      if (text.includes("FROM pg_catalog.pg_trigger")) return { rows: [] }
      if (text.includes("ledger_exists"))
        return { rows: [{ ledger_exists: true }] }
      if (text.includes("SELECT migration_name")) {
        throw Object.assign(
          new Error("permission denied; secret=must-not-leak"),
          { code: "42501" },
        )
      }
      throw new Error(`Unexpected query: ${text}`)
    },
  }

  const report = await auditPayrollDatabasePermissions(client)
  assert.equal(report.verdict, "FAIL")
  assert.equal(
    report.checks.find(({ id }) => id === "guard-migration-applied")?.status,
    "UNVERIFIED",
  )
  assert.equal(
    report.checks.find(({ id }) => id === "guard-migration-row-catalog-access")
      ?.status,
    "UNVERIFIED",
  )
  assert.equal(JSON.stringify(report).includes("must-not-leak"), false)
  assert.equal(
    issued.some((query) =>
      /^\s*(INSERT|UPDATE|DELETE|TRUNCATE|MERGE|ALTER|DROP|CREATE|GRANT|REVOKE|SET\s+ROLE)\b/i.test(
        query,
      ),
    ),
    false,
  )
  assert.ok(issued.includes("BEGIN READ ONLY"))
  assert.ok(issued.includes("ROLLBACK"))
})

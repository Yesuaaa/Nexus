import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { test, type TestContext } from "node:test"
import { setTimeout as delay } from "node:timers/promises"
import pg from "pg"
import { createApp } from "../src/app.js"
import { issueSession } from "../src/features/auth/auth.service.js"
import { disconnectPrisma, getPrisma } from "../src/lib/db.js"
import { listen, closeServer } from "./support/pglite-app.js"
import { clientInput } from "./support/pg019-client-fixture.js"

async function contention(t: TestContext, kind: "create" | "archive") {
  const inputUrl = process.env.PG019_POSTGRES_URL
  assert.ok(
    inputUrl,
    "BLOCKED ENVIRONMENT: PG019_POSTGRES_URL must identify a migrated disposable loopback database",
  )
  const url = new URL(inputUrl)
  assert.equal(url.protocol, "postgresql:")
  assert.equal(url.hostname, "127.0.0.1")
  assert.equal(url.pathname, "/nexus_pg019_clients")
  assert.equal(url.username, "pg019_clients_test")
  assert.ok(url.port)
  url.searchParams.set("sslmode", "disable")
  const control = new pg.Client({ connectionString: url.toString() }),
    observer = new pg.Client({ connectionString: url.toString() })
  await control.connect()
  await observer.connect()
  const identity = (
    await control.query<{
      database: string
      role: string
      address: string
      users: number
      table: string | null
    }>(
      `SELECT current_database() AS database,current_user AS role,host(inet_server_addr()) AS address,(SELECT count(*)::int FROM "User") AS users,to_regclass('public."AccountManagementChange"')::text AS "table"`,
    )
  ).rows[0]!
  assert.equal(identity.database, "nexus_pg019_clients")
  assert.equal(identity.role, "pg019_clients_test")
  assert.equal(identity.address, "127.0.0.1")
  assert.equal(identity.users, 0)
  assert.equal(identity.table, '"AccountManagementChange"')
  const old = {
    database: process.env.DATABASE_URL,
    direct: process.env.DIRECT_URL,
    pool: process.env.DATABASE_POOL_MAX,
    jwt: process.env.JWT_SECRET,
  }
  const appName = "pg019-" + randomUUID()
  url.searchParams.set("application_name", appName)
  process.env.DATABASE_URL = url.toString()
  delete process.env.DIRECT_URL
  process.env.DATABASE_POOL_MAX = "6"
  process.env.JWT_SECRET = randomBytes(32).toString("base64url")
  const prisma = getPrisma()!
  const { server, origin } = await listen(createApp())
  const key = 760019001
  let requests: Promise<Response>[] = []
  t.after(async () => {
    await control.query("SELECT pg_advisory_unlock_all()")
    await Promise.allSettled(requests)
    await closeServer(server)
    await control.query(
      `DROP TRIGGER IF EXISTS pg019_gate ON "User"; DROP FUNCTION IF EXISTS pg019_pause();`,
    )
    await control.query(`TRUNCATE "User", "AccountManagementChange" CASCADE`)
    await disconnectPrisma()
    await observer.end()
    await control.end()
    for (const [name, value] of [
      ["DATABASE_URL", old.database],
      ["DIRECT_URL", old.direct],
      ["DATABASE_POOL_MAX", old.pool],
      ["JWT_SECRET", old.jwt],
    ]) {
      if (value === undefined) delete process.env[name!]
      else process.env[name!] = value
    }
  })
  const actors: { user: { id: string }; token: string }[] = []
  for (const label of ["one", "two"]) {
    const user = await prisma.user.create({
      data: {
        id: "pg019-" + label,
        email: label + "@contention.test",
        role: "SUPERADMIN",
        passwordHash: "synthetic-only",
      },
    })
    actors.push({ user, token: (await issueSession(user)).token })
  }
  const email = "concurrent@pg019.test",
    targetId = "pg019-archive"
  if (kind === "archive") {
    const target = await prisma.user.create({
      data: {
        id: targetId,
        email: "archive@pg019.test",
        role: "USER",
        passwordHash: "synthetic-only",
      },
    })
    await issueSession(target)
  }
  await control.query(
    `CREATE FUNCTION pg019_pause() RETURNS trigger AS $$ BEGIN PERFORM pg_advisory_xact_lock(${key}); RETURN NEW; END; $$ LANGUAGE plpgsql; CREATE TRIGGER pg019_gate BEFORE ${kind === "create" ? "INSERT" : "UPDATE"} ON "User" FOR EACH ROW WHEN (${kind === "create" ? `NEW.email = '${email}'` : `NEW.id = '${targetId}' AND OLD."accountDeletedAt" IS NULL AND NEW."accountDeletedAt" IS NOT NULL`}) EXECUTE FUNCTION pg019_pause();`,
  )
  await control.query("SELECT pg_advisory_lock($1)", [key])
  const send = (i: number) =>
    fetch(
      origin + "/api/clients" + (kind === "archive" ? "/" + targetId : ""),
      {
        method: kind === "create" ? "POST" : "DELETE",
        headers: {
          authorization: "Bearer " + actors[i]!.token,
          "content-type": "application/json",
        },
        ...(kind === "create"
          ? {
              body: JSON.stringify({
                ...clientInput,
                email: i === 0 ? email : " CONCURRENT@PG019.TEST ",
              }),
            }
          : {}),
      },
    )
  async function waiting(count: number) {
    const deadline = Date.now() + 3500
    let rows: { pid: number; wait_event: string }[] = []
    while (Date.now() < deadline) {
      rows = (
        await observer.query<{ pid: number; wait_event: string }>(
          `SELECT pid,wait_event FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND state='active'`,
          [appName],
        )
      ).rows
      if (rows.length === count) return rows
      await delay(20)
    }
    assert.fail(
      "Independent transaction overlap not established: " +
        JSON.stringify(rows),
    )
  }
  if (kind === "create") {
    requests = [send(0), send(1)]
    const rows = await waiting(2)
    assert.equal(new Set(rows.map((r) => r.pid)).size, 2)
    assert.ok(rows.every((r) => r.wait_event === "advisory"))
  } else {
    requests = [send(0)]
    await waiting(1)
    requests.push(send(1))
    const rows = await waiting(2)
    assert.equal(new Set(rows.map((r) => r.pid)).size, 2)
    assert.ok(rows.some((r) => r.wait_event === "advisory"))
    assert.ok(rows.some((r) => r.wait_event !== "advisory"))
  }
  await control.query("SELECT pg_advisory_unlock($1)", [key])
  const responses = await Promise.all(requests)
  assert.deepEqual(
    responses.map((r) => r.status).sort(),
    kind === "create" ? [201, 409] : [204, 409],
  )
  const winner = responses.findIndex(
    (r) => r.status === (kind === "create" ? 201 : 204),
  )
  const rows = await prisma.accountManagementChange.findMany()
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.actorAccountId, actors[winner]!.user.id)
  assert.equal(rows[0]!.origin, "CLIENT_MANAGEMENT")
  if (kind === "create") {
    const targets = await prisma.user.findMany({ where: { email } })
    assert.equal(targets.length, 1)
    assert.equal(targets[0]!.role, "USER")
    assert.match(targets[0]!.passwordHash, /^scrypt\$/)
    assert.equal(rows[0]!.action, "CREATED")
  } else {
    const target = await prisma.user.findUniqueOrThrow({
      where: { id: targetId },
    })
    assert.equal(target.isActive, false)
    assert.ok(target.accountDeletedAt)
    assert.equal(await prisma.session.count({ where: { userId: targetId } }), 0)
    assert.equal(rows[0]!.action, "ARCHIVED")
    assert.equal((await send(0)).status, 404)
    assert.equal(await prisma.accountManagementChange.count(), 1)
  }
  const conflict = responses.find((r) => r.status === 409)!
  assert.deepEqual(Object.keys((await conflict.json()) as object), ["error"])
}
test(
  "[PG-019-F001-A017-T003] PostgreSQL concurrent normalized-email creation commits one account and one truthful history",
  { timeout: 60000 },
  (t) => contention(t, "create"),
)
test(
  "[PG-019-F001-A020-T002] PostgreSQL overlapping archival revokes once with one truthful completion",
  { timeout: 60000 },
  (t) => contention(t, "archive"),
)

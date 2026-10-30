import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "../../app.js"
import { getPrisma } from "../../lib/db.js"
import { Role } from "../../generated/prisma/client.js"
import { hashPassword } from "../auth/auth.password.js"
import { usersRepository } from "./users.repository.js"
import { issueSession } from "../auth/auth.service.js"
import type { publicUser } from "./users.dto.js"

test(
  "Superadmins restore trashed accounts as inactive while preserving their records",
  { timeout: 120_000 },
  async (t) => {
    const originalJwtSecret = process.env.JWT_SECRET
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    const originalUrl = process.env.DATABASE_URL
    const originalDirectUrl = process.env.DIRECT_URL
    const originalPoolMax = process.env.DATABASE_POOL_MAX
    const database = new PGlite()
    const cleanup: {
      socket?: PGLiteSocketServer
      server?: Server
      prisma?: ReturnType<typeof getPrisma>
    } = {}
    t.after(async () => {
      if (cleanup.server)
        await new Promise<void>((resolve) =>
          cleanup.server!.close(() => resolve()),
        )
      await cleanup.prisma?.$disconnect()
      await cleanup.socket?.stop()
      await database.close()
      if (originalJwtSecret === undefined) delete process.env.JWT_SECRET
      else process.env.JWT_SECRET = originalJwtSecret
      if (originalUrl === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = originalUrl
      if (originalDirectUrl === undefined) delete process.env.DIRECT_URL
      else process.env.DIRECT_URL = originalDirectUrl
      if (originalPoolMax === undefined) delete process.env.DATABASE_POOL_MAX
      else process.env.DATABASE_POOL_MAX = originalPoolMax
    })
    await database.waitReady
    const migrations = new URL("../../../prisma/migrations/", import.meta.url)
    for (const name of (await readdir(migrations))
      .filter((name) => /^\d/.test(name))
      .sort()) {
      await database.exec(
        await readFile(new URL(`${name}/migration.sql`, migrations), "utf8"),
      )
    }
    const socket = new PGLiteSocketServer({
      db: database,
      port: 0,
      host: "127.0.0.1",
    })
    cleanup.socket = socket
    await socket.start()
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?sslmode=disable`
    process.env.DATABASE_POOL_MAX = "1"
    delete process.env.DIRECT_URL
    const prisma = getPrisma()!
    cleanup.prisma = prisma
    const password = "OriginalPassword123!"
    const passwordHash = await hashPassword(password)
    const tokens = new Map<string, string>()
    const deletedAt = new Date("2026-10-01T00:00:00Z")
    for (const [id, role, deleted] of [
      ["actor", Role.SUPERADMIN, false],
      ["admin", Role.ADMIN, false],
      ["staff", Role.STAFF, false],
      ["user", Role.USER, false],
      ["target", Role.STAFF, true],
      ["peer", Role.SUPERADMIN, true],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          id,
          role,
          email: `${id}@example.com`,
          fullName: `${id} Person`,
          passwordHash,
          isActive: !deleted,
          accountDeletedAt: deleted ? deletedAt : null,
        },
      })
      const session = await issueSession(user)
      tokens.set(id, session.token)
    }
    const department = await prisma.department.create({
      data: { name: "Design" },
    })
    const team = await prisma.team.create({
      data: { name: "Creative", departmentId: department.id },
    })
    await prisma.user.update({
      where: { id: "target" },
      data: { departmentId: department.id, teamId: team.id },
    })
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: "target" },
    })
    const server = createApp().listen(0, "127.0.0.1")
    cleanup.server = server
    await new Promise<void>((resolve) => server.once("listening", resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
    const headers = (actor: string) => ({
      Authorization: `Bearer ${tokens.get(actor)}`,
    })
    const restore = (actor: string | null, target = "target") =>
      fetch(`${base}/users/${target}/restore`, {
        method: "POST",
        headers: actor ? headers(actor) : {},
      })
    assert.equal((await restore(null)).status, 401)
    for (const actor of ["admin", "staff", "user"]) {
      assert.equal((await restore(actor)).status, 403)
      assert.equal((await restore(actor, "peer")).status, 403)
    }
    assert.equal((await restore("actor", "actor")).status, 403)
    assert.equal((await restore("actor", "missing")).status, 404)
    assert.equal((await restore("actor", "user")).status, 409)
    assert.equal((await restore("target")).status, 401)
    assert.equal(
      await usersRepository.restoreUser("target", Role.USER, deletedAt),
      null,
    )
    assert.equal(
      await usersRepository.restoreUser("target", Role.STAFF, new Date(0)),
      null,
    )
    assert.equal(
      (
        await prisma.user.findUniqueOrThrow({ where: { id: "target" } })
      ).accountDeletedAt?.toISOString(),
      deletedAt.toISOString(),
    )

    // Restoring the record and removing stale sessions must succeed together.
    await database.exec(`
    CREATE FUNCTION reject_restore_session_deletion() RETURNS trigger AS $$
    BEGIN RAISE EXCEPTION 'Simulated revocation failure'; END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER reject_restore_session_deletion BEFORE DELETE ON "Session"
    FOR EACH ROW EXECUTE FUNCTION reject_restore_session_deletion();
  `)
    await assert.rejects(() =>
      usersRepository.restoreUser("target", Role.STAFF, deletedAt),
    )
    assert.equal(
      (
        await prisma.user.findUniqueOrThrow({ where: { id: "target" } })
      ).accountDeletedAt?.toISOString(),
      deletedAt.toISOString(),
    )
    assert.equal(await prisma.session.count({ where: { userId: "target" } }), 1)
    await database.exec(
      `DROP TRIGGER reject_restore_session_deletion ON "Session"; DROP FUNCTION reject_restore_session_deletion();`,
    )

    const restored = await restore("actor")
    assert.equal(restored.status, 200)
    const body = (await restored.json()) as {
      user: ReturnType<typeof publicUser>
    }
    assert.equal(body.user.accountDeletedAt, null)
    assert.equal(body.user.isActive, false)
    assert.equal(body.user.department?.id, department.id)
    assert.equal(body.user.team?.id, team.id)
    assert.equal("passwordHash" in body.user, false)
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: "target" },
    })
    assert.deepEqual(
      {
        ...after,
        updatedAt: before.updatedAt,
        accountDeletedAt: before.accountDeletedAt,
      },
      before,
    )
    assert.equal(await prisma.session.count({ where: { userId: "target" } }), 0)
    assert.equal(await prisma.session.count({ where: { userId: "actor" } }), 1)
    assert.equal((await restore("actor")).status, 409)
    const list = (await (
      await fetch(`${base}/users`, { headers: headers("actor") })
    ).json()) as { users: { id: string }[] }
    assert.ok(list.users.some((user: { id: string }) => user.id === "target"))
    const trash = (await (
      await fetch(`${base}/users?deleted=true`, { headers: headers("actor") })
    ).json()) as { users: { id: string }[] }
    assert.ok(!trash.users.some((user: { id: string }) => user.id === "target"))
    const login = () =>
      fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "target@example.com", password }),
      })
    assert.equal((await login()).status, 401)
    assert.equal(
      (await fetch(`${base}/auth/me`, { headers: headers("target") })).status,
      401,
    )
    const activated = await fetch(`${base}/users/target/status`, {
      method: "PATCH",
      headers: { ...headers("actor"), "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    })
    assert.equal(activated.status, 200)
    assert.equal((await login()).status, 200)
    assert.equal((await restore("actor", "peer")).status, 200)
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: "peer" } })).role,
      Role.SUPERADMIN,
    )
  },
)

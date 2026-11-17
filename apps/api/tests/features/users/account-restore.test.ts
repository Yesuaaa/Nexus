import assert from "node:assert/strict"
import { test } from "node:test"
import { Role } from "../../../src/generated/prisma/client.js"
import { hashPassword } from "../../../src/features/auth/auth.password.js"
import { usersRepository } from "../../../src/features/users/users.repository.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import type { publicUser } from "../../../src/features/users/users.dto.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "Superadmins restore trashed accounts as inactive while preserving their records",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, db: database, origin } = await startPgliteApp(t)
    const base = `${origin}/api`
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

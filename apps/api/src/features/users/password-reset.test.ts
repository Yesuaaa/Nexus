import assert from "node:assert/strict"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { createApp } from "../../app.js"
import { Role, type User } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { hashPassword, verifyPassword } from "../auth/password.js"

test("Superadmins can reset another account password without exposing it", async (t) => {
  const previousUrl = process.env.DATABASE_URL
  process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test"
  const prisma = getPrisma()!
  const token = "a".repeat(43)
  const oldPassword = "OldPassword123!"
  const newPassword = "NewPassword123!"
  const target: User = {
    id: "target",
    email: "target@example.com",
    fullName: "Target User",
    contactNumber: null,
    position: null,
    passwordHash: await hashPassword(oldPassword),
    role: Role.USER,
    isActive: true,
    accountDeletedAt: null,
    departmentId: null,
    teamId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const actor: User = { ...target, id: "actor", role: Role.SUPERADMIN }
  let targetExists = true
  const revoked = t.mock.fn(async () => ({ count: 2 }))
  const audit = t.mock.fn(async () => ({ id: "audit" }))
  const updated = t.mock.fn(
    async (args: { data: { passwordHash: string } }) => {
      target.passwordHash = args.data.passwordHash
      return { count: 1 }
    },
  )
  const sessionCreate = t.mock.fn(async () => ({}))
  const originalUser = prisma.user
  const originalSession = prisma.session
  const originalAuditLog = prisma.auditLog
  const originalTransaction = prisma.$transaction
  Reflect.set(prisma, "session", {
    findUnique: async () => ({
      id: "session",
      user: actor,
      expiresAt: new Date(Date.now() + 60_000),
    }),
    deleteMany: revoked,
    create: sessionCreate,
  })
  Reflect.set(prisma, "user", {
    findUnique: async () => (targetExists ? { ...target } : null),
    updateMany: updated,
  })
  Reflect.set(prisma, "auditLog", { create: audit })
  Reflect.set(
    prisma,
    "$transaction",
    async (operation: (transaction: typeof prisma) => Promise<unknown>) =>
      operation(prisma),
  )
  t.after(() => {
    Reflect.set(prisma, "user", originalUser)
    Reflect.set(prisma, "session", originalSession)
    Reflect.set(prisma, "auditLog", originalAuditLog)
    Reflect.set(prisma, "$transaction", originalTransaction)
    if (previousUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousUrl
  })

  const server = createApp().listen(0)
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve))
    const { port } = server.address() as AddressInfo
    const base = `http://127.0.0.1:${port}`
    const reset = (password: unknown, id = target.id, authorized = true) =>
      fetch(`${base}/api/users/${id}/password`, {
        method: "PATCH",
        headers: {
          ...(authorized ? { authorization: `Bearer ${token}` } : {}),
          "content-type": "application/json",
        },
        body: JSON.stringify({ newPassword: password }),
      })

    assert.equal((await reset(newPassword, target.id, false)).status, 401)
    actor.role = Role.ADMIN
    assert.equal((await reset(newPassword)).status, 403)
    actor.role = Role.SUPERADMIN
    assert.equal((await reset("short")).status, 400)
    assert.equal((await reset(newPassword, actor.id)).status, 403)
    targetExists = false
    assert.equal((await reset(newPassword)).status, 404)
    targetExists = true

    const response = await reset(newPassword)
    assert.equal(response.status, 204)
    assert.equal(await verifyPassword(oldPassword, target.passwordHash), false)
    assert.equal(await verifyPassword(newPassword, target.passwordHash), true)
    assert.equal(revoked.mock.callCount(), 1)
    assert.deepEqual(revoked.mock.calls[0].arguments, [
      { where: { userId: target.id } },
    ])
    assert.deepEqual(audit.mock.calls[0].arguments, [
      {
        data: {
          action: "PASSWORD_RESET",
          actorId: actor.id,
          targetUserId: target.id,
        },
      },
    ])
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
})

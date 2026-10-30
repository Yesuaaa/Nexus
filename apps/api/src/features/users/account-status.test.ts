import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { createApp } from "../../app.js"
import { Role, type Prisma, type User } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { hashPassword } from "../auth/auth.password.js"
import { signAccessToken } from "../auth/auth.jwt.js"

test("account status, deletion, and authentication enforce access", async (t) => {
  const previousUrl = process.env.DATABASE_URL
  const previousJwtSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = randomBytes(32).toString("base64url")
  // All database operations below are mocked; never connect to a real database.
  process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test"
  const prisma = getPrisma()!
  const token = (
    await signAccessToken("actor", "session", new Date(Date.now() + 60_000))
  ).token
  const password = "a long unique password"
  const user: User = {
    id: "target",
    email: "target@example.com",
    fullName: "Test User",
    contactNumber: null,
    position: null,
    passwordHash: await hashPassword(password),
    role: Role.USER,
    isActive: true,
    accountDeletedAt: null,
    departmentId: null,
    teamId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  let actor: User = { ...user, id: "actor", role: Role.SUPERADMIN }
  const target = { ...user }
  let targetExists = true
  let conflict = false

  const sessionCreate = t.mock.fn(async () => ({
    id: "new-session",
    expiresAt: new Date(Date.now() + 60_000),
  }))
  const revoke = t.mock.fn(async (args: { where: { userId: string } }) => {
    assert.equal(args.where.userId, "target")
    return { count: 2 }
  })
  const update = t.mock.fn(async (args: Prisma.UserUpdateManyArgs) => {
    assert.equal(args.where?.id, "target")
    assert.equal(args.where?.role, target.role)
    assert.equal(args.where?.isActive, target.isActive)
    if (conflict) return { count: 0 }
    if ("isActive" in args.data) {
      target.isActive = args.data.isActive as boolean
    }
    if ("accountDeletedAt" in args.data) {
      assert.equal(args.where?.accountDeletedAt, null)
      target.accountDeletedAt = args.data.accountDeletedAt as Date
    }
    return { count: 1 }
  })
  const remove = t.mock.fn(async (args: Prisma.UserDeleteManyArgs) => {
    assert.equal(args.where?.id, "target")
    assert.equal(args.where?.role, target.role)
    assert.equal(args.where?.isActive, false)
    assert.deepEqual(args.where?.accountDeletedAt, { not: null })
    targetExists = false
    return { count: 1 }
  })
  // Replace Prisma's proxy delegates with in-memory operations.
  const originalUser = prisma.user
  const originalSession = prisma.session
  const originalTransaction = prisma.$transaction
  Reflect.set(prisma, "session", {
    findUnique: async () => ({
      id: "session",
      userId: actor.id,
      user: actor,
      expiresAt: new Date(Date.now() + 60_000),
    }),
    create: sessionCreate,
    deleteMany: revoke,
  })
  Reflect.set(prisma, "user", {
    findUnique: async () => (targetExists ? { ...target } : null),
    updateMany: update,
    deleteMany: remove,
    findUniqueOrThrow: async () => ({ ...target }),
  })
  Reflect.set(
    prisma,
    "$transaction",
    async (
      operation: (transaction: Prisma.TransactionClient) => Promise<unknown>,
    ) => operation(prisma),
  )
  t.after(() => {
    Reflect.set(prisma, "user", originalUser)
    Reflect.set(prisma, "session", originalSession)
    Reflect.set(prisma, "$transaction", originalTransaction)
  })

  const server = createApp().listen(0)
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve))
    const { port } = server.address() as AddressInfo
    const base = `http://127.0.0.1:${port}`
    const headers = {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    }
    const changeStatus = (isActive: unknown, id = "target") =>
      fetch(`${base}/api/users/${id}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ isActive }),
      })
    const moveToTrash = (id = "target") =>
      fetch(`${base}/api/users/${id}`, { method: "DELETE", headers })
    const deletePermanently = (id = "target") =>
      fetch(`${base}/api/users/${id}/permanent`, {
        method: "DELETE",
        headers,
      })

    assert.equal(
      (await fetch(`${base}/api/users/target/status`, { method: "PATCH" }))
        .status,
      401,
    )
    assert.equal((await changeStatus("false")).status, 400)
    assert.equal((await changeStatus(false, actor.id)).status, 403)
    targetExists = false
    assert.equal((await changeStatus(false)).status, 404)
    targetExists = true

    for (const role of [Role.ADMIN, Role.STAFF, Role.USER]) {
      actor.role = role
      assert.equal((await changeStatus(false)).status, 403)
      assert.equal((await moveToTrash()).status, 403)
      assert.equal((await deletePermanently()).status, 403)
    }
    actor.role = Role.SUPERADMIN
    target.role = Role.USER
    assert.equal(update.mock.callCount(), 0)
    assert.equal(revoke.mock.callCount(), 0)

    conflict = true
    assert.equal((await changeStatus(false)).status, 409)
    assert.equal(revoke.mock.callCount(), 0)
    conflict = false

    const deactivated = await changeStatus(false)
    assert.equal(deactivated.status, 200)
    const payload = (await deactivated.json()) as {
      user: Record<string, unknown>
    }
    assert.equal(payload.user.isActive, false)
    assert.equal("passwordHash" in payload.user, false)
    assert.deepEqual(revoke.mock.calls[0].arguments, [
      { where: { userId: "target" } },
    ])

    const login = () =>
      fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: target.email, password }),
      })
    assert.equal((await login()).status, 401)
    assert.equal(sessionCreate.mock.callCount(), 0)
    actor = { ...target }
    assert.equal((await fetch(`${base}/api/auth/me`, { headers })).status, 401)

    actor = { ...user, id: "actor", role: Role.SUPERADMIN }
    const reactivated = await changeStatus(true)
    assert.equal(reactivated.status, 200)
    assert.equal(target.isActive, true)
    assert.equal(revoke.mock.callCount(), 1)
    assert.equal((await login()).status, 200)
    assert.equal(sessionCreate.mock.callCount(), 1)

    actor.role = Role.SUPERADMIN
    target.role = Role.ADMIN
    assert.equal((await moveToTrash()).status, 409)
    assert.equal((await changeStatus(false)).status, 200)
    assert.equal(revoke.mock.callCount(), 2)
    assert.equal((await deletePermanently()).status, 409)
    assert.equal((await moveToTrash(actor.id)).status, 403)
    assert.equal((await moveToTrash()).status, 200)
    assert.ok(target.accountDeletedAt instanceof Date)
    assert.equal(targetExists, true)
    assert.equal((await moveToTrash()).status, 404)
    assert.equal((await deletePermanently(actor.id)).status, 403)
    assert.equal((await deletePermanently()).status, 200)
    assert.equal(remove.mock.callCount(), 1)
    assert.equal((await deletePermanently()).status, 404)
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
    if (previousUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousUrl
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previousJwtSecret
  }
})

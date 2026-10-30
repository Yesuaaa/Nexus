import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "../../app.js"
import { Role } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { hashPassword } from "./auth.password.js"

test(
  "Self-service password recovery flow works end-to-end",
  { timeout: 60_000 },
  async (t) => {
    const original = {
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX,
    }
    const db = new PGlite()
    const socket = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" })
    const cleanup: {
      prisma?: ReturnType<typeof getPrisma>
      server?: ReturnType<ReturnType<typeof createApp>["listen"]>
    } = {}

    t.after(async () => {
      if (cleanup.server) {
        await new Promise<void>((resolve) =>
          cleanup.server!.close(() => resolve()),
        )
      }
      await cleanup.prisma?.$disconnect()
      await socket.stop()
      await db.close()
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })

    await db.waitReady
    const migrations = new URL("../../../prisma/migrations/", import.meta.url)
    for (const name of (await readdir(migrations))
      .filter((name) => /^\d/.test(name))
      .sort()) {
      await db.exec(
        await readFile(new URL(`${name}/migration.sql`, migrations), "utf8"),
      )
    }

    await socket.start()
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?sslmode=disable`
    process.env.DATABASE_POOL_MAX = "1"
    delete process.env.DIRECT_URL
    const prisma = getPrisma()!
    cleanup.prisma = prisma

    const initialPassword = "InitialPassword123!"
    const updatedPassword = "UpdatedPassword456!"
    const user = await prisma.user.create({
      data: {
        email: "recovery.user@example.com",
        fullName: "Recovery User",
        passwordHash: await hashPassword(initialPassword),
        role: Role.USER,
        isActive: true,
      },
    })

    const server = createApp().listen(0, "127.0.0.1")
    cleanup.server = server
    await new Promise<void>((resolve) => server!.once("listening", resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth`

    const forgotPassword = (email: unknown) =>
      fetch(`${base}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

    const resetPassword = (token: unknown, newPassword: unknown) =>
      fetch(`${base}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      })

    const login = (email: string, password: string) =>
      fetch(`${base}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

    await t.test("Validates input and prevents email enumeration", async () => {
      // Invalid email returns 400
      const invalid = await forgotPassword("not-an-email")
      assert.equal(invalid.status, 400)

      // Non-existent user returns 200 with identical message
      const nonexistent = await forgotPassword("does.not.exist@example.com")
      assert.equal(nonexistent.status, 200)
      const nonExistentPayload = (await nonexistent.json()) as {
        message: string
      }
      assert.match(nonExistentPayload.message, /If an account exists/i)

      // Existing user returns 200 with identical message
      const existing = await forgotPassword("recovery.user@example.com")
      assert.equal(existing.status, 200)
      const existingPayload = (await existing.json()) as { message: string }
      assert.equal(existingPayload.message, nonExistentPayload.message)

      // Verify token record in database
      const tokenRecord = await prisma.passwordResetToken.findFirst({
        where: { userId: user.id },
      })
      assert.ok(tokenRecord)
      assert.equal(tokenRecord.usedAt, null)
      assert.ok(tokenRecord.expiresAt > new Date())
    })

    await t.test("Rejects weak passwords and invalid tokens", async () => {
      // Missing token
      assert.equal((await resetPassword("", updatedPassword)).status, 400)
      // Weak password
      assert.equal((await resetPassword("invalid-token", "weak")).status, 400)
      // Invalid token
      assert.equal(
        (await resetPassword("invalid-token", updatedPassword)).status,
        400,
      )
    })

    await t.test(
      "Resets password, invalidates sessions, and logs audit record",
      async () => {
        // First log in to obtain an active session
        const loginBefore = await login(
          "recovery.user@example.com",
          initialPassword,
        )
        assert.equal(loginBefore.status, 200)
        assert.equal(
          await prisma.session.count({ where: { userId: user.id } }),
          1,
        )

        // Request a new reset token
        await forgotPassword("recovery.user@example.com")
        const tokens = await prisma.passwordResetToken.findMany({
          where: { userId: user.id, usedAt: null },
          orderBy: { createdAt: "desc" },
        })
        const latest = tokens[0]
        assert.ok(latest)

        // In test mode, we can construct or test a token using repository/hash
        // Or directly create a known rawToken + hash in db
        const rawToken = "test-raw-recovery-token-12345"
        const { createHash } = await import("node:crypto")
        const knownHash = createHash("sha256").update(rawToken).digest("hex")
        await prisma.passwordResetToken.create({
          data: {
            tokenHash: knownHash,
            userId: user.id,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          },
        })

        // Reset password using the valid token
        const resetRes = await resetPassword(rawToken, updatedPassword)
        assert.equal(resetRes.status, 204)

        // Verify token is now marked used
        const usedToken = await prisma.passwordResetToken.findUnique({
          where: { tokenHash: knownHash },
        })
        assert.ok(usedToken?.usedAt)

        // Verify active sessions were purged
        assert.equal(
          await prisma.session.count({ where: { userId: user.id } }),
          0,
        )

        // Verify AuditLog entry was created
        const audit = await prisma.auditLog.findFirst({
          where: { targetUserId: user.id, action: "PASSWORD_RESET" },
        })
        assert.ok(audit)

        // Old password no longer works
        assert.equal(
          (await login("recovery.user@example.com", initialPassword)).status,
          401,
        )

        // New password works
        const loginAfter = await login(
          "recovery.user@example.com",
          updatedPassword,
        )
        assert.equal(loginAfter.status, 200)

        // Reusing the same token fails
        assert.equal(
          (await resetPassword(rawToken, "AnotherPassword789!")).status,
          400,
        )
      },
    )

    await t.test("Rejects expired tokens", async () => {
      const expiredRawToken = "expired-token-123"
      const { createHash } = await import("node:crypto")
      const expiredHash = createHash("sha256")
        .update(expiredRawToken)
        .digest("hex")
      await prisma.passwordResetToken.create({
        data: {
          tokenHash: expiredHash,
          userId: user.id,
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        },
      })

      assert.equal(
        (await resetPassword(expiredRawToken, updatedPassword)).status,
        400,
      )
    })
  },
)

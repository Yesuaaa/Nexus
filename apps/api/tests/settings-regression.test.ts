import assert from "node:assert/strict"
import { test } from "node:test"
import {
  hashPassword,
  verifyPassword,
} from "../src/features/auth/auth.password.js"
import { issueSession } from "../src/features/auth/auth.service.js"
import { startPgliteApp } from "./support/pglite-app.js"

test(
  "Settings password change enforces password boundaries and account ownership",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const base = `${origin}/api/auth`
    const currentPassword = "Current-password-123!"
    let nextId = 0

    async function createActor(role: "USER" | "ADMIN" = "USER") {
      nextId += 1
      const user = await prisma.user.create({
        data: {
          email: `settings-security-${nextId}@example.test`,
          fullName: "Settings Security Test",
          role,
          passwordHash: await hashPassword(
            role === "USER" ? currentPassword : "Other-password-123!",
          ),
        },
      })
      return {
        user,
        session: await issueSession(user),
        password: role === "USER" ? currentPassword : "Other-password-123!",
      }
    }

    async function request(
      path: string,
      options: {
        token?: string
        method?: string
        body?: unknown
      } = {},
    ) {
      return fetch(`${base}${path}`, {
        method: options.method ?? "GET",
        headers: {
          "content-type": "application/json",
          ...(options.token
            ? { authorization: `Bearer ${options.token}` }
            : {}),
        },
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
      })
    }

    await t.test(
      "incorrect current password and a 1,025-byte new password preserve the old credential",
      async () => {
        const actor = await createActor()
        const validNewPassword = "New-password-value1"
        const oversizedPassword = "A1!x" + "é".repeat(510) + "a"
        assert.equal(Buffer.byteLength(oversizedPassword), 1025)

        assert.equal(
          (
            await request("/change-password", {
              token: actor.session.token,
              method: "POST",
              body: {
                currentPassword: "Incorrect-password-123!",
                newPassword: validNewPassword,
              },
            })
          ).status,
          400,
        )
        assert.equal(
          (
            await request("/change-password", {
              token: actor.session.token,
              method: "POST",
              body: {
                currentPassword,
                newPassword: oversizedPassword,
              },
            })
          ).status,
          400,
        )
        const stored = await prisma.user.findUniqueOrThrow({
          where: { id: actor.user.id },
          select: { passwordHash: true },
        })
        assert.equal(
          await verifyPassword(currentPassword, stored.passwordHash),
          true,
        )
        assert.equal(
          (
            await request("/login", {
              method: "POST",
              body: { email: actor.user.email, password: currentPassword },
            })
          ).status,
          200,
        )
      },
    )

    await t.test(
      "a 1,024-byte Unicode password is accepted, hashed, and leaves the current session active",
      async () => {
        const actor = await createActor()
        const exactMaximumPassword = "A1!x" + "é".repeat(510)
        assert.equal(Buffer.byteLength(exactMaximumPassword), 1024)

        assert.equal(
          (
            await request("/change-password", {
              token: actor.session.token,
              method: "POST",
              body: {
                currentPassword,
                newPassword: exactMaximumPassword,
              },
            })
          ).status,
          204,
        )

        const stored = await prisma.user.findUniqueOrThrow({
          where: { id: actor.user.id },
          select: { passwordHash: true },
        })
        assert.equal(stored.passwordHash.startsWith("scrypt$"), true)
        assert.equal(
          await verifyPassword(exactMaximumPassword, stored.passwordHash),
          true,
        )
        assert.equal(
          await verifyPassword(currentPassword, stored.passwordHash),
          false,
        )
        assert.equal(
          (await request("/me", { token: actor.session.token })).status,
          200,
        )
        assert.equal(
          await prisma.session.count({ where: { userId: actor.user.id } }),
          1,
        )
        assert.equal(
          (
            await request("/login", {
              method: "POST",
              body: { email: actor.user.email, password: currentPassword },
            })
          ).status,
          401,
        )

        const login = await request("/login", {
          method: "POST",
          body: {
            email: actor.user.email,
            password: exactMaximumPassword,
          },
        })
        assert.equal(login.status, 200)
        const body = (await login.json()) as {
          user: Record<string, unknown>
        }
        assert.equal("passwordHash" in body.user, false)
      },
    )

    await t.test(
      "the exact 12-character minimum is accepted and target-account fields cannot redirect the update",
      async () => {
        const actor = await createActor()
        const other = await createActor("ADMIN")
        const exactMinimumPassword = "Aa1!bcdefghi"
        assert.equal(exactMinimumPassword.length, 12)

        assert.equal(
          (
            await request("/change-password", {
              token: actor.session.token,
              method: "POST",
              body: {
                currentPassword,
                newPassword: exactMinimumPassword,
                targetUserId: other.user.id,
              },
            })
          ).status,
          204,
        )
        assert.equal(
          (
            await request("/login", {
              method: "POST",
              body: {
                email: actor.user.email,
                password: exactMinimumPassword,
              },
            })
          ).status,
          200,
        )
        assert.equal(
          (
            await request("/login", {
              method: "POST",
              body: { email: other.user.email, password: other.password },
            })
          ).status,
          200,
        )
      },
    )
  },
)

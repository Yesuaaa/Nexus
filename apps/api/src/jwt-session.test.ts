import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "./app.js"
import { getPrisma } from "./lib/db.js"
import { signAccessToken } from "./features/auth/auth.jwt.js"
import { authRepository } from "./features/auth/auth.repository.js"
import { tokenHash } from "./features/auth/auth.service.js"

test(
  "JWT sessions rotate, reject replay, and preserve immediate revocation",
  { timeout: 120_000 },
  async (t) => {
    const original = {
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX,
      JWT_SECRET: process.env.JWT_SECRET,
    }
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    const db = new PGlite()
    const socket = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 0 })
    const cleanup: {
      prisma?: ReturnType<typeof getPrisma>
      server?: ReturnType<ReturnType<typeof createApp>["listen"]>
    } = {}
    t.after(async () => {
      if (cleanup.server)
        await new Promise<void>((resolve) =>
          cleanup.server!.close(() => resolve()),
        )
      await cleanup.prisma?.$disconnect()
      await socket.stop()
      await db.close()
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })
    await db.waitReady
    const migrations = new URL("../prisma/migrations/", import.meta.url)
    for (const directory of (await readdir(migrations))
      .filter((name) => /^\d/.test(name))
      .sort()) {
      await db.exec(
        await readFile(
          new URL(`${directory}/migration.sql`, migrations),
          "utf8",
        ),
      )
    }
    await socket.start()
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?sslmode=disable`
    process.env.DATABASE_POOL_MAX = "1"
    delete process.env.DIRECT_URL
    const prisma = getPrisma()!
    cleanup.prisma = prisma
    const server = createApp().listen(0, "127.0.0.1")
    cleanup.server = server
    await new Promise<void>((resolve) => server!.once("listening", resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth`
    const password = "A-test-password-123!"
    const post = (path: string, body: unknown, token?: string) =>
      fetch(`${base}/${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })
    const me = (token: string) =>
      fetch(`${base}/me`, { headers: { authorization: `Bearer ${token}` } })
    type Tokens = {
      token: string
      refreshToken: string
      expiresIn: number
      user: { id: string }
    }
    const login = async () => {
      const response = await post("login", {
        email: "jwt@example.com",
        password,
      })
      assert.equal(response.status, 200)
      return (await response.json()) as Tokens
    }
    const registration = await post("register", {
      email: "jwt@example.com",
      password,
      fullName: "JWT Tester",
      contactNumber: "09123456789",
    })
    assert.equal(registration.status, 201)
    const initial = (await registration.json()) as Tokens
    assert.equal(initial.token.split(".").length, 3)
    assert.equal(initial.expiresIn, 900)
    assert.match(initial.refreshToken, /^[A-Za-z0-9_-]{43}$/)
    assert.equal(registration.headers.get("cache-control"), "no-store")
    assert.equal((await me(initial.token)).status, 200)
    const claims = JSON.parse(
      Buffer.from(initial.token.split(".")[1], "base64url").toString(),
    ) as Record<string, unknown>
    assert.equal(claims.sub, initial.user.id)
    assert.equal("email" in claims, false)
    assert.equal("role" in claims, false)
    const parts = initial.token.split(".")
    parts[1] = Buffer.from(
      JSON.stringify({ ...claims, sub: "someone-else" }),
    ).toString("base64url")
    assert.equal((await me(parts.join("."))).status, 401)

    await t.test(
      "refresh rotates and replay revokes its entire session",
      async () => {
        const response = await post("refresh", {
          refreshToken: initial.refreshToken,
        })
        assert.equal(response.status, 200)
        const rotated = (await response.json()) as Tokens
        assert.notEqual(rotated.refreshToken, initial.refreshToken)
        assert.equal((await me(rotated.token)).status, 200)
        assert.equal(
          (await post("refresh", { refreshToken: initial.refreshToken }))
            .status,
          401,
        )
        assert.equal((await me(rotated.token)).status, 401)
        assert.equal(
          (await post("refresh", { refreshToken: rotated.refreshToken }))
            .status,
          401,
        )
      },
    )
    await t.test(
      "concurrent refresh has one winner and reuse revokes the family",
      async () => {
        const session = await login()
        const responses = await Promise.all([
          post("refresh", { refreshToken: session.refreshToken }),
          post("refresh", { refreshToken: session.refreshToken }),
        ])
        assert.deepEqual(
          responses.map((response) => response.status).sort(),
          [200, 401],
        )
        const winner = (await responses
          .find((response) => response.status === 200)!
          .json()) as Tokens
        assert.equal((await me(winner.token)).status, 401)
      },
    )
    await t.test("logout revokes access and refresh", async () => {
      const session = await login()
      assert.equal((await post("logout", {}, session.token)).status, 204)
      assert.equal((await me(session.token)).status, 401)
      assert.equal(
        (await post("refresh", { refreshToken: session.refreshToken })).status,
        401,
      )
    })
    await t.test(
      "expired JWTs request refresh while invalid signatures do not",
      async () => {
        const session = await login()
        const row = await prisma!.session.findUniqueOrThrow({
          where: { tokenHash: tokenHash(session.refreshToken) },
        })
        const expired = await signAccessToken(
          initial.user.id,
          row.id,
          new Date(Date.now() - 1000),
        )
        const response = await me(expired.token)
        assert.equal(response.status, 401)
        assert.equal(
          ((await response.json()) as { code: string }).code,
          "ACCESS_TOKEN_EXPIRED",
        )
        assert.equal(
          (await post("refresh", { refreshToken: session.refreshToken }))
            .status,
          200,
        )
      },
    )
    await t.test(
      "failed rotation rolls back consumption and session hash",
      async () => {
        const session = await login()
        const hash = tokenHash(session.refreshToken)
        await assert.rejects(authRepository.rotateRefreshToken(hash, hash))
        assert.equal(
          (await post("refresh", { refreshToken: session.refreshToken }))
            .status,
          200,
        )
      },
    )
    await t.test(
      "current roles are read from the database and permanent deletion revokes tokens",
      async () => {
        const session = await login()
        await prisma!.user.update({
          where: { id: initial.user.id },
          data: { role: "STAFF" },
        })
        const response = await me(session.token)
        assert.equal(response.status, 200)
        assert.equal(
          ((await response.json()) as { user: { role: string } }).user.role,
          "STAFF",
        )
        await prisma!.user.update({
          where: { id: initial.user.id },
          data: { role: "USER" },
        })
        const deleted = await prisma!.user.create({
          data: { email: "deleted-jwt@example.com", passwordHash: "unused" },
        })
        const { issueSession } = await import("./features/auth/auth.service.js")
        const deletedSession = await issueSession(deleted)
        await prisma!.user.delete({ where: { id: deleted.id } })
        assert.equal((await me(deletedSession.token)).status, 401)
        assert.equal(
          (await post("refresh", { refreshToken: deletedSession.refreshToken }))
            .status,
          401,
        )
      },
    )
    await t.test(
      "deactivation and archive block both token types",
      async () => {
        for (const data of [
          { isActive: false },
          { accountDeletedAt: new Date() },
        ]) {
          const session = await login()
          await prisma!.user.update({ where: { id: initial.user.id }, data })
          assert.equal((await me(session.token)).status, 401)
          assert.equal(
            (await post("refresh", { refreshToken: session.refreshToken }))
              .status,
            401,
          )
          await prisma!.user.update({
            where: { id: initial.user.id },
            data: { isActive: true, accountDeletedAt: null },
          })
        }
      },
    )
    await t.test(
      "absolute expiry blocks refresh and old opaque tokens are rejected",
      async () => {
        const session = await login()
        await prisma!.session.updateMany({
          where: { userId: initial.user.id },
          data: { expiresAt: new Date(0) },
        })
        assert.equal(
          (await post("refresh", { refreshToken: session.refreshToken }))
            .status,
          401,
        )
        assert.equal((await me(session.token)).status, 401)
        assert.equal((await me("a".repeat(43))).status, 401)
      },
    )
    await t.test("password changes revoke every session", async () => {
      const first = await login()
      const second = await login()
      assert.equal(
        (
          await post(
            "change-password",
            { currentPassword: password, newPassword: "Another-password-123!" },
            first.token,
          )
        ).status,
        204,
      )
      for (const session of [first, second]) {
        assert.equal((await me(session.token)).status, 401)
        assert.equal(
          (await post("refresh", { refreshToken: session.refreshToken }))
            .status,
          401,
        )
      }
    })
    await t.test(
      "authentication endpoints bound requests and advertise retry timing",
      async () => {
        for (const [path, count] of [
          ["register", 11],
          ["login", 61],
          ["refresh", 121],
        ] as const) {
          let response: Response | undefined
          for (let index = 0; index < count; index++)
            response = await post(path, {})
          assert.equal(response!.status, 429)
          assert.ok(Number(response!.headers.get("retry-after")) > 0)
          assert.equal(response!.headers.get("cache-control"), "no-store")
        }
      },
    )
  },
)

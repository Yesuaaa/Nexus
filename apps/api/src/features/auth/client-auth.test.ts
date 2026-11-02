import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "../../app.js"
import { getPrisma } from "../../lib/db.js"

interface AuthResponse {
  token: string
  refreshToken: string
  expiresIn: number
  user: {
    id: string
    email: string
    fullName: string
    contactNumber: string
    role: string
    isActive: boolean
  }
}

test(
  "client registration and login preserve the mobile authentication contract",
  { timeout: 120_000 },
  async (t) => {
    const original = {
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX,
      JWT_SECRET: process.env.JWT_SECRET,
    }
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    const database = new PGlite()
    const socket = new PGLiteSocketServer({
      db: database,
      host: "127.0.0.1",
      port: 0,
    })
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
      await database.close()
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })

    await database.waitReady
    const migrations = new URL("../../../prisma/migrations/", import.meta.url)
    for (const directory of (await readdir(migrations))
      .filter((name) => /^\d/.test(name))
      .sort()) {
      await database.exec(
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
    await new Promise<void>((resolve) => server.once("listening", resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth`
    const password = "Secure-Password-123!"
    const registration = {
      fullName: "Client Dela Cruz",
      contactNumber: "09123456789",
      email: "client@example.com",
      password,
      role: "ADMIN",
      isActive: false,
    }
    const post = (path: string, body: unknown) =>
      fetch(`${base}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })

    const created = await post("register", registration)
    assert.equal(created.status, 201)
    const session = (await created.json()) as AuthResponse
    assert.match(
      session.token,
      /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
    )
    assert.match(session.refreshToken, /^[A-Za-z0-9_-]{43}$/)
    assert.equal(session.expiresIn, 900)
    assert.equal(session.user.email, "client@example.com")
    assert.equal(session.user.role, "USER")
    assert.equal(session.user.isActive, true)
    assert.equal("accessToken" in session, false)
    assert.equal("active" in session.user, false)

    const stored = await prisma.user.findUniqueOrThrow({
      where: { email: registration.email },
    })
    assert.equal(stored.role, "USER")
    assert.equal(stored.isActive, true)
    assert.notEqual(stored.passwordHash, password)
    assert.equal(JSON.stringify(session).includes(stored.passwordHash), false)

    assert.equal((await post("register", registration)).status, 409)
    const validLogin = await post("login", {
      email: "CLIENT@EXAMPLE.COM",
      password,
    })
    assert.equal(validLogin.status, 200)
    const loginSession = (await validLogin.json()) as AuthResponse
    assert.match(loginSession.token, /^[A-Za-z0-9_-]+\./)
    assert.match(loginSession.refreshToken, /^[A-Za-z0-9_-]{43}$/)
    assert.equal(loginSession.user.id, session.user.id)
    assert.equal(
      (await post("login", { email: registration.email, password: "wrong" }))
        .status,
      401,
    )
  },
)

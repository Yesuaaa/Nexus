import { randomBytes } from "node:crypto"
import { createServer, type Server } from "node:http"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { Role } from "../../src/generated/prisma/client.js"
import { createApp } from "../../src/app.js"
import { hashPassword } from "../../src/features/auth/auth.password.js"
import { applyMigrations } from "./pglite-app.js"
import { disconnectPrisma, getPrisma } from "../../src/lib/db.js"

const apiPort = Number(process.env.PG002_API_PORT ?? "31371")
const controlPort = Number(process.env.PG002_CONTROL_PORT ?? "31372")
const fixtureEmail = "pg002-fixture-admin@example.test"
const fixturePassword = "PG002FixturePassword1!"
const originalEnvironment = new Map(
  ["DATABASE_URL", "DIRECT_URL", "DATABASE_POOL_MAX", "JWT_SECRET"].map(
    (key) => [key, process.env[key]],
  ),
)

function listen(server: Server, port: number) {
  return new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(port, "127.0.0.1", resolve)
  })
}

function close(server: Server) {
  return new Promise<void>((resolve) => {
    server.close(() => resolve())
    server.closeAllConnections()
  })
}

function json(
  response: import("node:http").ServerResponse,
  status: number,
  value: unknown,
) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  })
  response.end(JSON.stringify(value))
}

const database = new PGlite()
await database.waitReady
await applyMigrations(database)
const socket = new PGLiteSocketServer({
  db: database,
  host: "127.0.0.1",
  port: 0,
})
await socket.start()
process.env.DATABASE_URL =
  "postgresql://postgres:postgres@" +
  socket.getServerConn() +
  "/postgres?sslmode=disable"
process.env.DATABASE_POOL_MAX = "1"
delete process.env.DIRECT_URL
process.env.JWT_SECRET = randomBytes(32).toString("base64url")

const prisma = getPrisma()
if (!prisma) throw new Error("Prisma client was not initialized")
await prisma.user.create({
  data: {
    id: "pg002-browser-root",
    email: fixtureEmail,
    fullName: "PG002 Browser Superadmin",
    passwordHash: await hashPassword(fixturePassword),
    role: Role.SUPERADMIN,
  },
})

const apiServer = createApp().listen(apiPort, "127.0.0.1")
await new Promise<void>((resolve, reject) => {
  apiServer.once("error", reject)
  apiServer.once("listening", resolve)
})

const controlServer = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1")
  if (request.method !== "GET") {
    json(response, 405, { error: "Method not allowed" })
    return
  }
  if (url.pathname === "/ready") {
    json(response, 200, { ready: true })
    return
  }
  if (url.pathname !== "/state") {
    json(response, 404, { error: "Not found" })
    return
  }

  const email = url.searchParams.get("email")
  if (!email || !email.endsWith("@example.test")) {
    json(response, 400, { error: "A fixture email is required" })
    return
  }

  void (async () => {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        accountDeletedAt: true,
        employee: { select: { id: true } },
      },
    })
    if (!user) {
      json(response, 200, { user: null, createdHistory: [], workforceCount: 0 })
      return
    }
    const createdHistory = await prisma.accountManagementChange.findMany({
      where: { subjectAccountId: user.id, action: "CREATED" },
      select: {
        actorAccountId: true,
        actorRoleAtTime: true,
        origin: true,
        operationId: true,
      },
    })
    const operationId = createdHistory[0]?.operationId
    const workforceCount = operationId
      ? await prisma.workforceManagementChange.count({
          where: { operationId },
        })
      : 0
    json(response, 200, {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        accountDeletedAt: user.accountDeletedAt,
        employeeId: user.employee?.id ?? null,
      },
      createdHistory: createdHistory.map((entry) => ({
        actorAccountId: entry.actorAccountId,
        actorRoleAtTime: entry.actorRoleAtTime,
        origin: entry.origin,
      })),
      workforceCount,
    })
  })().catch((error: unknown) => {
    console.error("PG-002 fixture state query failed", error)
    if (!response.headersSent)
      json(response, 500, { error: "Fixture query failed" })
  })
})
await listen(controlServer, controlPort)
console.log("PG002_BROWSER_FIXTURE_READY")

let closing: Promise<void> | undefined
const shutdown = () => {
  if (closing) return
  closing = (async () => {
    await close(controlServer)
    await close(apiServer)
    await disconnectPrisma()
    await socket.stop()
    await database.close()
    for (const [key, value] of originalEnvironment) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })()
  void closing.catch((error: unknown) => {
    console.error("PG-002 fixture cleanup failed", error)
    process.exitCode = 1
  })
}

process.once("SIGINT", shutdown)
process.once("SIGTERM", shutdown)

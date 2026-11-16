/** Native node --test worker fixture. No production imports or activation flag. */
import assert from "node:assert/strict"
import { test } from "node:test"
import { createServer } from "node:http"
import { randomBytes, randomUUID, createHash } from "node:crypto"
import { writeFile } from "node:fs/promises"
import { startSystemLogsApp } from "./system-logs-app.js"
import { listen, closeServer } from "./pglite-app.js"
import { createApp } from "../../src/app.js"
import { errorLogs } from "../../src/features/error-logs/error-log.js"
import { issueSession } from "../../src/features/auth/auth.service.js"
import { hashPassword } from "../../src/features/auth/auth.password.js"
import type { Prisma, Role } from "../../src/generated/prisma/client.js"

test(
  "native offline System Logs browser fixture",
  { timeout: 1_800_000 },
  async (t) => {
    assert.equal(process.env.NODE_TEST_CONTEXT, "child-v8")
    assert.equal(process.env.NODE_ENV, "test")
    assert.equal(process.env.DATABASE_URL, undefined)
    assert.equal(process.env.DIRECT_URL, undefined)
    const destination = process.env.SYSTEM_LOGS_OFFLINE_MANIFEST
    const webOrigin = process.env.WEB_ORIGIN
    assert.ok(destination && webOrigin?.startsWith("http://127.0.0.1:"))
    const fixture = await startSystemLogsApp(t)
    errorLogs.captureInternal(
      new Error("private-error-sentinel"),
      "people-hr",
      "messages.expire",
    )
    const { prisma, server, beforeShutdown } = fixture
    const closed = await listen(createApp())
    beforeShutdown(() => closeServer(closed.server))
    const roles = {
      root: "SUPERADMIN",
      admin: "ADMIN",
      staff: "STAFF",
      user: "USER",
    } as const
    const password = "OfflineSynthetic123!"
    const passwordHash = await hashPassword(password)
    for (const [actor, role] of Object.entries(roles))
      await prisma.user.create({
        data: {
          id: `offline-${actor}`,
          email: `${actor}@offline.test`,
          passwordHash,
          fullName: `Offline ${actor}`,
          role,
        },
      })
    async function session(actor: keyof typeof roles, state = "active") {
      const user = await prisma.user.update({
        where: { id: `offline-${actor}` },
        data: {
          role: roles[actor],
          isActive: true,
          accountDeletedAt: null,
        },
      })
      await prisma.session.deleteMany({ where: { userId: user.id } })
      const issued = await issueSession(user)
      if (state === "revoked")
        await prisma.session.deleteMany({ where: { userId: user.id } })
      else if (state === "expired")
        await prisma.session.updateMany({
          where: { userId: user.id },
          data: { expiresAt: new Date(0) },
        })
      else if (state !== "active")
        await prisma.user.update({
          where: { id: user.id },
          data: {
            ...(state === "inactive" ? { isActive: false } : {}),
            ...(state === "retired" ? { accountDeletedAt: new Date() } : {}),
            ...(state === "demoted" ? { role: "ADMIN" as Role } : {}),
          },
        })
      return {
        token: issued.token,
        refreshToken: issued.refreshToken,
        userId: user.id,
      }
    }
    const first = await session("root")
    const empty = await fetch(`${fixture.base}/management-history`, {
      headers: { Authorization: `Bearer ${first.token}` },
    })
    assert.equal(empty.status, 200)
    assert.deepEqual(((await empty.json()) as { events: unknown[] }).events, [])
    assert.equal(
      (await fetch(`${closed.origin}/api/system-logs/management-history`))
        .status,
      404,
    )
    const operationId = randomUUID()
    const at = new Date(Date.now() - 3_600_000)
    const malformedAt = new Date(at.getTime() - 10 * 86_400_000)
    await prisma.accountManagementChange.createMany({
      data: Array.from({ length: 32 }, (_, i) => ({
        id: i === 0 ? "shared" : `account-${String(i).padStart(3, "0")}`,
        actorAccountId: "deleted-auditor",
        actorRoleAtTime: "ADMIN",
        operationId,
        subjectAccountId:
          i === 0 ? "deleted-subject-shared" : `deleted-account-${i}`,
        action: i === 0 ? "ROLE_CHANGED" : "PROFILE_UPDATED",
        origin: i === 31 ? "CLIENT_MANAGEMENT" : "ACCOUNT_MANAGEMENT",
        changedFields: [i === 0 ? "role" : "fullName"],
        changes: i === 0 ? { role: { before: "STAFF", after: "ADMIN" } } : {},
        createdAt: at,
      })),
    })
    await prisma.workforceManagementChange.createMany({
      data: Array.from({ length: 32 }, (_, i) => ({
        id: i === 0 ? "shared" : `workforce-${String(i).padStart(3, "0")}`,
        actorAccountId: "deleted-auditor",
        actorRoleAtTime: "ADMIN",
        operationId,
        subjectType: "TEAM",
        subjectId: `deleted-team-${i}`,
        action: "PROFILE_UPDATED",
        origin: "TEAM_MANAGEMENT",
        changedFields: ["description"],
        changes: {},
        createdAt: at,
      })),
    })
    await prisma.accountManagementChange.createMany({
      data: Array.from({ length: 502 }, (_, i) => ({
        id: `invalid-${String(i).padStart(3, "0")}`,
        actorAccountId: "invalid-auditor",
        actorRoleAtTime: "ADMIN",
        operationId,
        subjectAccountId: "unavailable-subject",
        action: "PROFILE_UPDATED",
        origin: "ACCOUNT_MANAGEMENT",
        changedFields: ["email"],
        changes: {
          email: "private-history-sentinel",
          password: "private-history-sentinel",
        },
        createdAt: malformedAt,
      })),
    })
    await prisma.attendanceAudit.create({
      data: {
        id: "attendance-safe-event",
        entityType: "AttendanceAdjustment",
        entityId: "historical-adjustment",
        actorId: "offline-root",
        action: "UPDATE",
        reason: "private-attendance-sentinel",
        before: { reason: "private-attendance-sentinel" },
        after: { proposedStartedAt: "private-attendance-sentinel" },
        actionId: randomUUID(),
        createdAt: malformedAt,
      },
    })
    const projectService = await prisma.service.create({
      data: {
        name: "Offline project audit service",
        description: "private-project-sentinel",
      },
    })
    const projectRequest = await prisma.serviceRequest.create({
      data: {
        clientId: "offline-user",
        serviceId: projectService.id,
        title: "private-project-sentinel",
        workflow: { create: { state: "ACTIVE_PROJECT" } },
      },
    })
    await prisma.workflowEvent.create({
      data: {
        id: "project-safe-event",
        requestId: projectRequest.id,
        actorId: "offline-staff",
        entityId: "recorded-project-identity",
        type: "PROJECT_MILESTONE_UPDATED",
        summary: "private-project-sentinel",
        internal: false,
        createdAt: malformedAt,
      },
    })
    await prisma.workflowEvent.create({
      data: {
        id: "excluded-service-event",
        requestId: projectRequest.id,
        entityId: "recorded-project-identity",
        type: "CONSULTATION_OPENED",
        summary: "private-project-sentinel",
        internal: false,
        createdAt: malformedAt,
      },
    })
    await prisma.workflowEvent.create({
      data: {
        id: "service-safe-event",
        requestId: projectRequest.id,
        actorId: "offline-user",
        entityId: "private-service-entity",
        type: "APPROVAL_CONFIRMED",
        summary: "private-service-sentinel quotation amount",
        internal: false,
        createdAt: malformedAt,
      },
    })
    const historyDigest = async () =>
      createHash("sha256")
        .update(
          JSON.stringify([
            await prisma.accountManagementChange.findMany({
              orderBy: { id: "asc" },
            }),
            await prisma.workforceManagementChange.findMany({
              orderBy: { id: "asc" },
            }),
            await prisma.attendanceAudit.findMany({ orderBy: { id: "asc" } }),
            await prisma.workflowEvent.findMany({ orderBy: { id: "asc" } }),
          ]),
        )
        .digest("hex")
    const baselineDigest = await historyDigest()
    const unavailable = new Set<string>()
    const observed: Record<string, number> = {}
    // Observe the original URL before Express temporarily strips mount prefixes.
    server.prependListener("request", (request) => {
      if (request.url?.startsWith("/api/system-logs/")) {
        const transport = request.headers["x-system-logs-offline-transport"]
        if (transport === "express-forwarded" || transport === "next-rewrite")
          observed[transport] = (observed[transport] ?? 0) + 1
      }
    })
    // Fault only the owned fixture client's source-read boundary. No schema, grant,
    // history writer or response mocking; the real service produces all metadata.
    const transaction = prisma.$transaction
    prisma.$transaction = new Proxy(transaction, {
      apply(target, context, args: unknown[]) {
        const callback = args[0]
        if (typeof callback !== "function")
          return Reflect.apply(target, context, args)
        return Reflect.apply(target, context, [
          (tx: Prisma.TransactionClient) =>
            Reflect.apply(callback, undefined, [
              new Proxy(tx, {
                get(client, key) {
                  const value: unknown = Reflect.get(client, key)
                  if (key !== "$queryRaw" || typeof value !== "function")
                    return value
                  return new Proxy(value, {
                    apply(query, queryContext, parameters: unknown[]) {
                      const input = parameters[0]
                      if (
                        input &&
                        typeof input === "object" &&
                        "strings" in input &&
                        Array.isArray(input.strings)
                      ) {
                        const text = input.strings
                          .filter(
                            (part): part is string => typeof part === "string",
                          )
                          .join("")
                        for (const source of unavailable)
                          if (text.includes(`FROM "${source}"`))
                            throw new Error("Offline source fault")
                      }
                      return Reflect.apply(query, queryContext, parameters)
                    },
                  })
                },
              }),
            ]),
          ...args.slice(1),
        ])
      },
    })
    beforeShutdown(() => {
      prisma.$transaction = transaction
    })
    const secret = randomBytes(24).toString("hex")
    let finish = () => {}
    const stopped = new Promise<void>((resolve) => {
      finish = resolve
    })
    const control = createServer(async (request, response) => {
      response.setHeader("Cache-Control", "no-store")
      if (
        request.headers["x-offline-control"] !== secret ||
        request.method !== "POST"
      ) {
        response.writeHead(404).end()
        return
      }
      try {
        const chunks: Buffer[] = []
        let length = 0
        for await (const chunk of request) {
          const buffer = Buffer.from(chunk as Uint8Array)
          length += buffer.length
          if (length > 4096) throw new Error("Invalid control")
          chunks.push(buffer)
        }
        const body: unknown = JSON.parse(
          Buffer.concat(chunks).toString("utf8") || "{}",
        )
        if (!body || typeof body !== "object" || Array.isArray(body))
          throw new Error("Invalid control")
        const value = body as Record<string, unknown>
        let result: unknown = {}
        if (request.url === "/session") {
          if (
            typeof value.actor !== "string" ||
            !Object.hasOwn(roles, value.actor) ||
            ![
              "active",
              "revoked",
              "expired",
              "inactive",
              "retired",
              "demoted",
            ].includes(String(value.state ?? "active"))
          )
            throw new Error("Invalid control")
          result = await session(
            value.actor as keyof typeof roles,
            String(value.state ?? "active"),
          )
        } else if (request.url === "/sources") {
          if (
            !Array.isArray(value.unavailable) ||
            value.unavailable.some(
              (item) =>
                ![
                  "AccountManagementChange",
                  "WorkforceManagementChange",
                  "AttendanceAudit",
                  "WorkflowEvent",
                ].includes(item),
            )
          )
            throw new Error("Invalid control")
          unavailable.clear()
          for (const source of value.unavailable)
            unavailable.add(source as string)
        } else if (request.url === "/stats") {
          result = {
            observed,
            historiesUnchanged: baselineDigest === (await historyDigest()),
          }
        } else if (request.url !== "/stop") throw new Error("Invalid control")
        response
          .writeHead(200, { "Content-Type": "application/json" })
          .end(JSON.stringify(result))
        if (request.url === "/stop") finish()
      } catch {
        response
          .writeHead(400, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: "Invalid offline control" }))
      }
    })
    control.listen(0, "127.0.0.1")
    await new Promise<void>((resolve) => control.once("listening", resolve))
    beforeShutdown(() => closeServer(control))
    const address = control.address()
    assert.ok(address && typeof address !== "string")
    await writeFile(
      destination,
      JSON.stringify({
        webOrigin,
        apiOrigin: fixture.origin,
        closedOrigin: closed.origin,
        controlOrigin: `http://127.0.0.1:${address.port}`,
        secret,
        operationId,
        mainDay: at.toISOString().slice(0, 10),
        malformedDay: malformedAt.toISOString().slice(0, 10),
        password,
        rootEmail: "root@offline.test",
        nativeWorker: true,
      }),
      { flag: "wx", mode: 0o600 },
    )
    console.log("System Logs native offline fixture ready")
    await stopped
    unavailable.clear()
    assert.equal(await historyDigest(), baselineDigest)
  },
)

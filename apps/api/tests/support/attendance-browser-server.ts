/** Real offline API for Playwright. This helper is never mounted in production. */
import { test } from "node:test"
import { createServer } from "node:http"
import { randomUUID } from "node:crypto"
import { startPgliteApp } from "./pglite-app.js"
import { issueSession } from "../../src/features/auth/auth.service.js"
import type { Role } from "../../src/generated/prisma/client.js"

test("attendance browser API fixture", { timeout: 1800000 }, async (t) => {
  let now = new Date("2026-11-13T20:00:00+08:00")
  const secret = randomUUID()
  const { prisma, origin } = await startPgliteApp(t, {
    app: { attendanceClock: () => new Date(now) },
  })
  const department = await prisma.department.create({
    data: { name: "Attendance browser department" },
  })
  const policy = await prisma.attendancePolicy.create({
    data: {
      name: "Browser flexible policy",
      timeZone: "Asia/Manila",
      days: {
        create: Array.from({ length: 7 }, (_, weekday) => ({
          weekday,
          isWorkingDay: true,
          requiredMinutes: 480,
        })),
      },
    },
  })
  const actors: Record<
    string,
    { token: string; refreshToken: string; employeeId: string; userId: string }
  > = {}
  for (const [name, role] of [
    ["staff", "STAFF"],
    ["head", "STAFF"],
    ["admin", "ADMIN"],
    ["client", "USER"],
    ["superadmin", "SUPERADMIN"],
  ] as const) {
    const user = await prisma.user.create({
      data: {
        email: `${name}@attendance-browser.test`,
        fullName: `Attendance ${name}`,
        passwordHash: "test-only",
        role: role as Role,
        departmentId: department.id,
      },
    })
    const employee = await prisma.employee.create({
      data: {
        employeeId: `BROWSER-${name}`,
        fullName: `Attendance ${name}`,
        userId: user.id,
        departmentId: department.id,
      },
    })
    await prisma.attendancePolicyAssignment.create({
      data: {
        employeeId: employee.id,
        policyId: policy.id,
        effectiveFrom: new Date("2026-01-01"),
      },
    })
    actors[name] = {
      ...(await issueSession(user)),
      employeeId: employee.id,
      userId: user.id,
    }
    if (name === "head")
      await prisma.department.update({
        where: { id: department.id },
        data: { headId: user.id },
      })
  }
  const proxy = createServer(async (req, res) => {
    try {
      if (req.url === "/__attendance_clock") {
        if (req.headers["x-attendance-fixture"] !== secret) {
          res.writeHead(403).end()
          return
        }
        const chunks: Buffer[] = []
        for await (const chunk of req)
          chunks.push(Buffer.from(chunk as Uint8Array))
        now = new Date(Buffer.concat(chunks).toString("utf8"))
        res.writeHead(204).end()
        return
      }
      const chunks: Buffer[] = []
      for await (const chunk of req)
        chunks.push(Buffer.from(chunk as Uint8Array))
      const response = await fetch(`${origin}${req.url}`, {
        method: req.method,
        headers: {
          ...(req.headers.authorization
            ? { authorization: req.headers.authorization }
            : {}),
          ...(req.headers["content-type"]
            ? { "content-type": String(req.headers["content-type"]) }
            : {}),
        },
        ...(req.method === "GET" || req.method === "HEAD"
          ? {}
          : { body: Buffer.concat(chunks).toString("utf8") }),
      })
      res.writeHead(response.status, {
        "content-type":
          response.headers.get("content-type") ?? "application/json",
      })
      res.end(Buffer.from(await response.arrayBuffer()))
    } catch {
      res.writeHead(500).end("Fixture request failed")
    }
  })
  await new Promise<void>((resolve, reject) => {
    proxy.once("error", reject)
    proxy.listen(5391, "127.0.0.1", resolve)
  })
  t.after(() => {
    proxy.closeAllConnections()
    proxy.close()
  })
  console.log(`ATTENDANCE_READY:${JSON.stringify({ secret, actors })}`)
  await new Promise<void>((resolve) => process.once("SIGTERM", resolve))
})

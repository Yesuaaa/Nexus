/** Real offline API for Playwright. This helper is never mounted in production. */
import { test } from "node:test"
import { createServer } from "node:http"
import { randomUUID } from "node:crypto"
import { startPgliteApp } from "./pglite-app.js"
import { issueSession } from "../../src/features/auth/auth.service.js"
import { hashPassword } from "../../src/features/auth/auth.password.js"
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
  const requestsDepartment = await prisma.department.create({
    data: { name: "WC06 request summaries" },
  })
  const transferOrigin = await prisma.department.create({
    data: { name: "WC07 transfer origin" },
  })
  const transferDestination = await prisma.department.create({
    data: { name: "WC07 transfer destination" },
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
  for (const [name, role, placement = department] of [
    ["staff", "STAFF"],
    ["head", "STAFF"],
    ["admin", "ADMIN"],
    ["client", "USER"],
    ["superadmin", "SUPERADMIN"],
    ["recovery", "STAFF"],
    ["correction-dst", "STAFF"],
    ["overtime-staff", "STAFF"],
    ["wc06-head", "STAFF", requestsDepartment],
    ["wc06-requester", "STAFF", requestsDepartment],
    ["wc07-requester", "STAFF", transferOrigin],
    ["wc07-origin-head", "STAFF", transferOrigin],
    ["wc07-destination-head", "STAFF", transferDestination],
    ["wc07-reconcile", "STAFF"],
  ] as const) {
    const user = await prisma.user.create({
      data: {
        email: `${name}@attendance-browser.test`,
        fullName: `Attendance ${name}`,
        passwordHash:
          name === "recovery"
            ? await hashPassword("AttendanceFixture-42!")
            : "test-only",
        role: role as Role,
        departmentId: placement.id,
      },
    })
    const employee = await prisma.employee.create({
      data: {
        employeeId: `BROWSER-${name}`,
        fullName: `Attendance ${name}`,
        userId: user.id,
        departmentId: placement.id,
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
    if (name.endsWith("head"))
      await prisma.department.update({
        where: { id: placement.id },
        data: { headId: user.id },
      })
  }
  const reportingDepartment = await prisma.department.create({
    data: { name: "WC06 reporting" },
  })
  for (const [name, departmentId, startedAt, endedAt, suspendedAt] of [
    ["Working", department.id, "2026-09-18T22:00:00+08:00", null, null],
    ["Break", department.id, "2026-09-18T21:00:00+08:00", null, null],
    [
      "Overnight",
      department.id,
      "2026-09-18T20:00:00+08:00",
      "2026-09-19T02:00:00+08:00",
      null,
    ],
    [
      "Suspended",
      reportingDepartment.id,
      "2026-09-18T23:00:00+08:00",
      null,
      "2026-09-19T00:00:00+08:00",
    ],
  ] as const) {
    const employee = await prisma.employee.create({
      data: {
        employeeId: `BROWSER-WC06-${name}`,
        fullName: `WC06 ${name}`,
        departmentId,
      },
    })
    await prisma.attendancePolicyAssignment.create({
      data: {
        employeeId: employee.id,
        policyId: policy.id,
        effectiveFrom: new Date("2026-01-01"),
      },
    })
    const session = await prisma.attendanceWorkSession.create({
      data: {
        employeeId: employee.id,
        startedAt: new Date(startedAt),
        endedAt: endedAt ? new Date(endedAt) : null,
        suspendedAt: suspendedAt ? new Date(suspendedAt) : null,
      },
    })
    if (name === "Break") {
      await prisma.attendanceBreak.create({
        data: {
          sessionId: session.id,
          startedAt: new Date("2026-09-18T22:00:00+08:00"),
        },
      })
    }
  }
  const { id: pagingEmployeeId } = await prisma.employee.create({
    data: {
      employeeId: "EXP-WC07-PAGING-NEWEST",
      fullName: "Workforce Paging Needle",
    },
  })
  const { id: pagingRestId } = await prisma.employee.create({
    data: {
      employeeId: "EXP-WC07-PAGING-REST",
      fullName: "Workforce Paging Needle",
    },
  })
  const pagingStamp = Date.now() - 60_000
  await prisma.attendanceAudit.createMany({
    data: Array.from({ length: 27 }, (_, index) => ({
      id: `browser-wc07-page-${index}`,
      actionId: `browser-wc07-action-${index}`,
      entityId: `browser-wc07-session-${index}`,
      entityType: "AttendanceWorkSession",
      employeeId: index === 0 ? pagingEmployeeId : pagingRestId,
      action: "INSERT",
      reason: "Isolated paging fixture",
      after: { startedAt: new Date(pagingStamp).toISOString(), endedAt: null },
      createdAt: new Date(pagingStamp - index * 1000),
    })),
  })
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
        "x-correlation-id": response.headers.get("x-correlation-id") ?? "",
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
  console.log(
    `ATTENDANCE_READY:${JSON.stringify({ secret, actors, transferDestinationId: transferDestination.id, pagingEmployeeId })}`,
  )
  await new Promise<void>((resolve) => process.once("SIGTERM", resolve))
})

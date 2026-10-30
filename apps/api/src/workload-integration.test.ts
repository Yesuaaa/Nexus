import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "./app.js"
import { getPrisma } from "./lib/db.js"
import { issueSession } from "./features/auth/auth.service.js"
import { calculateCapacity } from "./features/workload/calculation.js"

test(
  "staff workload uses actual capacity and current departmental authorization",
  { timeout: 120_000 },
  async (t) => {
    const original = {
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX,
      JWT_SECRET: process.env.JWT_SECRET,
    }
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    const db = new PGlite(),
      socket = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" })
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
    for (const name of (await readdir(migrations))
      .filter((name) => /^\d/.test(name))
      .sort())
      await db.exec(
        await readFile(new URL(`${name}/migration.sql`, migrations), "utf8"),
      )
    await socket.start()
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?sslmode=disable`
    process.env.DATABASE_POOL_MAX = "1"
    delete process.env.DIRECT_URL
    const prisma = getPrisma()!
    cleanup.prisma = prisma
    const tokens = new Map<string, string>()
    for (const [id, role] of [
      ["a", "STAFF"],
      ["b", "STAFF"],
      ["c", "ADMIN"],
      ["ordinary", "STAFF"],
      ["admin", "ADMIN"],
      ["super", "SUPERADMIN"],
      ["client", "USER"],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          id,
          role,
          email: `${id}@example.com`,
          fullName: `${id} Manager`,
          passwordHash: "private-password",
        },
      })
      tokens.set(id, (await issueSession(user)).token)
    }
    for (const id of ["a", "b", "c"])
      await prisma.department.create({
        data: { id, name: `Department ${id}`, headId: id },
      })
    for (const [id, departmentId, status] of [
      ["a1", "a", "ACTIVE"],
      ["a2", "a", "ON_LEAVE"],
      ["b1", "b", "ACTIVE"],
    ] as const)
      await prisma.employee.create({
        data: {
          id,
          employeeId: id,
          fullName: `Employee ${id}`,
          departmentId,
          status,
          skills: ["design"],
        },
      })
    await prisma.service.create({
      data: {
        id: "service",
        name: "Work service",
        description: "Work",
        departments: { connect: { id: "a" } },
      },
    })
    await prisma.serviceRequest.create({
      data: {
        id: "request",
        clientId: "client",
        serviceId: "service",
        title: "Client work",
        preferredSpecialistId: "b1",
        preferredSpecialistName: "Employee b1",
      },
    })
    await prisma.project.create({
      data: {
        id: "project",
        clientId: "client",
        name: "Project A",
        departments: { connect: { id: "a" } },
        tasks: { create: { id: "task", title: "Design deliverable" } },
      },
    })
    const future = new Date(Date.now() + 14 * 86_400_000)
    future.setUTCDate(future.getUTCDate() + ((8 - future.getUTCDay()) % 7))
    const day = future.toISOString().slice(0, 10)
    const at = (time: string) => `${day}T${time}:00+08:00`
    const nextDay = new Date(+new Date(`${day}T00:00:00Z`) + 86_400_000)
      .toISOString()
      .slice(0, 10)
    const schedule = [1, 2, 3, 4, 5].flatMap((weekday) => [
      { weekday, startMinute: 540, endMinute: 720 },
      { weekday, startMinute: 780, endMinute: 1020 },
    ])
    const baseWork = {
      serviceRequestId: "request",
      title: "Design block",
      requiredSkills: ["design"],
      startsAt: at("09:00"),
      endsAt: at("11:00"),
      estimatedHours: 2,
      priority: "HIGH",
      deadline: at("17:00"),
    }
    const server = createApp().listen(0, "127.0.0.1")
    cleanup.server = server
    await new Promise<void>((resolve) => server.once("listening", resolve))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    const call = (path = "", actor = "a", method = "GET", body?: unknown) =>
      fetch(`${base}/api/workload${path}`, {
        method,
        headers: {
          authorization: `Bearer ${tokens.get(actor)}`,
          "content-type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    const range = `?start=${day}&days=7`
    const config = (employeeId: string, actor = "a", shifts = schedule) =>
      call(`/employees/${employeeId}/configuration`, actor, "PUT", {
        skills: ["design", "typescript"],
        workingSchedule: shifts,
      })
    type Row = {
      id: string
      capacityHours: number
      scheduledHours: number
      blockedHours: number
      remainingHours: number
      allocatedHours: number
      status: string
      workload: string
      conflicts: string[]
      utilization: number | null
      assignmentCount: number
    }
    const overview = async (actor = "a") => {
      const res = await call(range, actor)
      assert.equal(res.status, 200)
      return (await res.json()) as {
        employees: Row[]
        staffing: { id: string; status: string }[]
      }
    }

    await t.test(
      "heads receive effective permissions; roles alone cannot open the module",
      async () => {
        for (const actor of ["ordinary", "admin", "super", "client"])
          assert.equal((await call(range, actor)).status, 403)
        assert.equal((await fetch(`${base}/api/workload`)).status, 401)
        assert.equal((await call(range, "c")).status, 200)
        const me = await fetch(`${base}/api/auth/me`, {
          headers: { authorization: `Bearer ${tokens.get("a")}` },
        })
        assert.equal(me.status, 200)
        assert.ok(
          (
            (await me.json()) as { user: { permissions: string[] } }
          ).user.permissions.includes("workload:manage"),
        )
      },
    )
    await t.test(
      "scoped list/details contain no employee contacts, credentials or other departments",
      async () => {
        const result = await overview()
        assert.deepEqual(
          result.employees.map((e) => e.id),
          ["a1", "a2"],
        )
        assert.equal(JSON.stringify(result).includes("private-password"), false)
        assert.equal(JSON.stringify(result).includes("@example.com"), false)
        assert.equal((await call(`/employees/b1${range}`)).status, 404)
        assert.equal((await config("b1")).status, 404)
        assert.equal(result.employees[0].capacityHours, 0)
        assert.equal(result.employees[0].status, "UNAVAILABLE")
        assert.equal(
          await prisma.workAssignment.count(),
          0,
          "a client preference never assigns personnel",
        )
      },
    )
    await t.test(
      "manual schedules calculate capacity with lunch breaks and employment status",
      async () => {
        assert.equal((await config("a1")).status, 200)
        assert.equal((await config("a2")).status, 200)
        assert.equal((await config("b1", "b")).status, 200)
        const result = await overview()
        assert.equal(result.employees[0].capacityHours, 35)
        assert.equal(result.employees[1].capacityHours, 0)
        assert.equal(result.employees[1].status, "UNAVAILABLE")
        const overlapping = [
          { weekday: 1, startMinute: 540, endMinute: 720 },
          { weekday: 1, startMinute: 600, endMinute: 780 },
        ]
        assert.equal((await config("a1", "a", overlapping)).status, 400)
        assert.equal((await call("?start=2026-02-30")).status, 400)
        assert.equal((await call("?start=bad&days=7")).status, 400)
        assert.equal((await call(`?start=${day}&days=1000`)).status, 400)
      },
    )
    await t.test(
      "appointments and leave subtract their union only during working hours",
      async () => {
        for (const [kind, startsAt, endsAt] of [
          ["LEAVE", at("10:00"), at("12:00")],
          ["APPOINTMENT", at("11:00"), at("14:00")],
        ] as const)
          assert.equal(
            (
              await call("/employees/a1/commitments", "a", "POST", {
                kind,
                title: "Approved commitment",
                startsAt,
                endsAt,
              })
            ).status,
            201,
          )
        const row = (await overview()).employees[0]
        assert.equal(row.scheduledHours, 35)
        assert.equal(row.blockedHours, 3)
        assert.equal(row.capacityHours, 32)
        assert.equal(row.status, "PARTIALLY_AVAILABLE")
        assert.equal(
          (
            await call("/assignments", "a", "POST", {
              ...baseWork,
              employeeId: "a1",
            })
          ).status,
          409,
        )
        await prisma.workCommitment.deleteMany()
      },
    )
    await t.test(
      "assignment authorization, required skills, breaks and estimated effort are checked",
      async () => {
        assert.equal(
          (
            await call("/assignments", "a", "POST", {
              ...baseWork,
              employeeId: "b1",
            })
          ).status,
          404,
        )
        assert.equal(
          (
            await call("/assignments", "b", "POST", {
              ...baseWork,
              employeeId: "b1",
            })
          ).status,
          404,
        )
        assert.equal(
          (
            await call("/assignments", "a", "POST", {
              ...baseWork,
              employeeId: "a2",
            })
          ).status,
          409,
        )
        assert.equal(
          (
            await call("/assignments", "a", "POST", {
              ...baseWork,
              employeeId: "a1",
              requiredSkills: ["unknown"],
            })
          ).status,
          409,
        )
        assert.equal(
          (
            await call("/assignments", "a", "POST", {
              ...baseWork,
              employeeId: "a1",
              startsAt: at("11:00"),
              endsAt: at("14:00"),
            })
          ).status,
          409,
        )
        assert.equal(
          (
            await call("/assignments", "a", "POST", {
              ...baseWork,
              employeeId: "a1",
              estimatedHours: 5,
            })
          ).status,
          400,
        )
        assert.equal(
          (
            await call("/assignments", "a", "POST", {
              ...baseWork,
              employeeId: "a1",
              projectId: "project",
            })
          ).status,
          400,
        )
        await prisma.employee.update({
          where: { id: "a1" },
          data: { startDate: new Date(`${nextDay}T00:00:00Z`) },
        })
        assert.equal(
          (
            await call("/assignments", "a", "POST", {
              ...baseWork,
              employeeId: "a1",
            })
          ).status,
          409,
        )
        await prisma.employee.update({
          where: { id: "a1" },
          data: { startDate: null },
        })
        const result = await call("/assignments", "a", "POST", {
          ...baseWork,
          employeeId: "a1",
        })
        assert.equal(result.status, 201)
        const row = (await overview()).employees[0]
        assert.equal(row.allocatedHours, 2)
        assert.equal(row.remainingHours, 33)
        assert.equal(
          (
            await call("/assignments", "a", "POST", {
              ...baseWork,
              employeeId: "a1",
            })
          ).status,
          409,
        )
        // Back-to-back reservations are allowed; half-open intervals do not overlap.
        assert.equal(
          (
            await call("/assignments", "a", "POST", {
              ...baseWork,
              employeeId: "a1",
              startsAt: at("11:00"),
              endsAt: at("12:00"),
              estimatedHours: 1,
            })
          ).status,
          201,
        )
      },
    )
    await t.test(
      "calendar, daily effort proration and changed capacity highlight conflicts",
      async () => {
        const res = await call(`/employees/a1${range}`)
        assert.equal(res.status, 200)
        const detail = (await res.json()) as {
          calendar: Row[]
          assignments: { id: string }[]
        }
        assert.equal(detail.calendar.length, 7)
        assert.equal(detail.calendar[0].allocatedHours, 3)
        assert.equal(detail.calendar[0].capacityHours, 7)
        assert.equal((await config("a1", "a", [])).status, 200)
        const row = (await overview()).employees[0]
        assert.equal(row.workload, "OVER_CAPACITY")
        assert.equal(row.utilization, null)
        assert.equal(row.conflicts.length, 2)
        assert.equal((await config("a1")).status, 200)
        const partial = calculateCapacity(
          {
            status: "ACTIVE",
            workingSchedule: [
              { weekday: 1, startMinute: 0, endMinute: 1440 },
              { weekday: 2, startMinute: 0, endMinute: 1440 },
            ],
            commitments: [],
            workAssignments: [
              {
                id: "overnight",
                status: "CONFIRMED",
                startsAt: new Date(at("23:00")),
                endsAt: new Date(`${nextDay}T01:00:00+08:00`),
                estimatedHours: 1,
              },
            ],
          },
          {
            startsAt: new Date(at("00:00")),
            endsAt: new Date(`${nextDay}T00:00:00+08:00`),
          },
        )
        assert.equal(partial.allocatedHours, 0.5)
      },
    )
    await t.test(
      "cross-department requests remain pending until the receiving head chooses personnel",
      async () => {
        const res = await call("/staffing-requests", "a", "POST", {
          ...baseWork,
          recipientDepartmentId: "b",
        })
        assert.equal(res.status, 201)
        const request = (await res.json()) as { id: string }
        assert.equal((await overview("b")).employees[0].allocatedHours, 0)
        assert.equal((await overview("c")).staffing.length, 0)
        assert.equal(
          (
            await call(`/staffing-requests/${request.id}`, "a", "PATCH", {
              decision: "APPROVED",
              employeeId: "b1",
            })
          ).status,
          404,
        )
        assert.equal(
          (
            await call(`/staffing-requests/${request.id}`, "b", "PATCH", {
              decision: "APPROVED",
              employeeId: "a1",
            })
          ).status,
          404,
        )
        const approved = await call(
          `/staffing-requests/${request.id}`,
          "b",
          "PATCH",
          { decision: "APPROVED", employeeId: "b1" },
        )
        assert.equal(approved.status, 200)
        assert.equal((await overview("b")).employees[0].allocatedHours, 2)
        assert.equal(
          (await overview()).employees.some((e) => e.id === "b1"),
          false,
        )
        assert.equal(
          (
            await call(`/staffing-requests/${request.id}`, "b", "PATCH", {
              decision: "APPROVED",
              employeeId: "b1",
            })
          ).status,
          409,
        )
        const data = (await approved.json()) as { assignmentId: string }
        assert.equal(
          (
            await call(`/assignments/${data.assignmentId}`, "c", "PATCH", {
              status: "CANCELLED",
            })
          ).status,
          404,
        )
        assert.equal(
          (
            await call(`/assignments/${data.assignmentId}`, "a", "PATCH", {
              status: "CANCELLED",
            })
          ).status,
          200,
        )
        assert.equal((await overview("b")).employees[0].allocatedHours, 0)
      },
    )
    await t.test(
      "approval rechecks availability after request creation; rejection never assigns",
      async () => {
        const res = await call("/staffing-requests", "a", "POST", {
          ...baseWork,
          recipientDepartmentId: "b",
        })
        const request = (await res.json()) as { id: string }
        assert.equal(
          (
            await call("/employees/b1/commitments", "b", "POST", {
              kind: "UNAVAILABLE",
              title: "Temporary absence",
              startsAt: at("09:00"),
              endsAt: at("11:00"),
            })
          ).status,
          201,
        )
        assert.equal(
          (
            await call(`/staffing-requests/${request.id}`, "b", "PATCH", {
              decision: "APPROVED",
              employeeId: "b1",
            })
          ).status,
          409,
        )
        assert.equal(
          (
            await call(`/staffing-requests/${request.id}`, "b", "PATCH", {
              decision: "REJECTED",
            })
          ).status,
          200,
        )
        assert.equal(
          await prisma.workAssignment.count({
            where: { staffingRequestId: request.id },
          }),
          0,
        )
        await prisma.workCommitment.deleteMany()
      },
    )
    await t.test(
      "projects and tasks retain department responsibility; closing their parent releases capacity",
      async () => {
        const res = await call("/assignments", "a", "POST", {
          ...baseWork,
          serviceRequestId: null,
          taskId: "task",
          employeeId: "a1",
          startsAt: at("13:00"),
          endsAt: at("15:00"),
        })
        assert.equal(res.status, 201)
        assert.equal((await overview()).employees[0].allocatedHours, 5)
        await prisma.project.update({
          where: { id: "project" },
          data: { status: "COMPLETED" },
        })
        assert.equal((await overview()).employees[0].allocatedHours, 3)
        assert.equal(
          (
            await call("/assignments", "a", "POST", {
              ...baseWork,
              serviceRequestId: null,
              projectId: "project",
              employeeId: "a1",
            })
          ).status,
          409,
        )
      },
    )
    await t.test(
      "concurrent requests cannot double-book an employee",
      async () => {
        const work = {
          ...baseWork,
          employeeId: "a1",
          startsAt: at("15:00"),
          endsAt: at("16:00"),
          estimatedHours: 1,
        }
        const results = await Promise.all([
          call("/assignments", "a", "POST", work),
          call("/assignments", "a", "POST", work),
        ])
        assert.deepEqual(results.map((r) => r.status).sort(), [201, 409])
      },
    )
    await t.test(
      "project responsibility is explicitly established by Admin and task creation remains scoped",
      async () => {
        await prisma.project.create({
          data: {
            id: "unallocated",
            clientId: "client",
            name: "Unallocated project",
          },
        })
        assert.equal(
          (await call("/projects/unallocated/responsibility", "a", "PUT"))
            .status,
          403,
        )
        assert.equal(
          (await call("/projects/unallocated/responsibility", "c", "PUT"))
            .status,
          200,
        )
        assert.equal(
          (await call("/projects/unallocated/responsibility", "c", "PUT"))
            .status,
          409,
        )
        assert.equal(
          (
            await call("/projects/unallocated/tasks", "a", "POST", {
              title: "Unauthorized task",
            })
          ).status,
          404,
        )
        assert.equal(
          (
            await call("/projects/unallocated/tasks", "c", "POST", {
              title: "Approved task",
            })
          ).status,
          201,
        )
      },
    )
    await t.test(
      "handoffs and permission revocations take effect with the same session",
      async () => {
        await prisma.department.update({
          where: { id: "a" },
          data: { headId: "ordinary" },
        })
        assert.equal((await call(range)).status, 403)
        assert.equal((await call(range, "ordinary")).status, 200)
        await prisma.user.update({
          where: { id: "ordinary" },
          data: { role: "USER" },
        })
        assert.equal((await call(range, "ordinary")).status, 403)
      },
    )
  },
)

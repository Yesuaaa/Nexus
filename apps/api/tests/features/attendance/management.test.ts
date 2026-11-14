import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import type { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "attendance management policies, department scope, and correction approvals",
  { timeout: 120000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t, {
      app: { attendanceClock: () => new Date("2026-11-14T20:00:00+08:00") },
    })
    const department = await prisma.department.create({
      data: { name: "Attendance team" },
    })
    const outside = await prisma.department.create({
      data: { name: "Outside team" },
    })
    const days = Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      isWorkingDay: true,
      requiredMinutes: 480,
    }))
    const policy = await prisma.attendancePolicy.create({
      data: {
        name: "Flexible",
        timeZone: "Asia/Manila",
        days: { create: days },
      },
    })
    async function account(
      name: string,
      role: Role,
      departmentId = department.id,
    ) {
      const user = await prisma.user.create({
        data: {
          email: `${name}@management.test`,
          fullName: name,
          role,
          passwordHash: "test-only",
          departmentId,
        },
      })
      const employee = await prisma.employee.create({
        data: {
          employeeId: `MGMT-${name}`,
          fullName: name,
          userId: user.id,
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
      return { user, employee, token: (await issueSession(user)).token }
    }
    const staff = await account("staff", "STAFF"),
      head = await account("head", "STAFF"),
      admin = await account("admin", "ADMIN"),
      other = await account("other", "STAFF", outside.id)
    await prisma.department.update({
      where: { id: department.id },
      data: { headId: head.user.id },
    })
    const session = await prisma.attendanceWorkSession.create({
      data: {
        employeeId: staff.employee.id,
        startedAt: new Date("2026-11-13T09:00:00+08:00"),
        endedAt: new Date("2026-11-13T17:00:00+08:00"),
      },
    })
    type Actor = typeof staff
    async function request(actor: Actor, path: string, body?: unknown) {
      return fetch(`${base}/attendance${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Authorization: `Bearer ${actor.token}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    }
    async function submit(
      actor = staff,
      target = session.id,
      end = "2026-11-13T18:00:00+08:00",
    ) {
      const body = {
        requestKey: randomUUID(),
        ...(target ? { sessionId: target } : {}),
        startedAt: target
          ? "2026-11-13T09:00:00+08:00"
          : "2026-11-12T09:00:00+08:00",
        endedAt: target ? end : "2026-11-12T10:00:00+08:00",
        reason: "Correct actual working time",
      }
      const response = await request(actor, "/adjustments", body)
      assert.equal(response.status, 201, await response.clone().text())
      return {
        body,
        adjustment: ((await response.json()) as { adjustment: { id: string } })
          .adjustment,
      }
    }

    await t.test(
      "records and summaries are scoped to the current department head",
      async () => {
        assert.equal((await request(staff, "/employees")).status, 403)
        const list = await request(head, "/employees")
        assert.equal(list.status, 200)
        const employees = (
          (await list.json()) as { employees: { id: string }[] }
        ).employees
        assert.ok(employees.some((item) => item.id === staff.employee.id))
        assert.ok(!employees.some((item) => item.id === other.employee.id))
        assert.equal(
          (await request(head, `/employees/${staff.employee.id}/history`))
            .status,
          200,
        )
        assert.equal(
          (await request(head, `/employees/${other.employee.id}/history`))
            .status,
          404,
        )
        const overview = await request(
          head,
          "/overview?from=2026-11-13&to=2026-11-13",
        )
        assert.equal(
          ((await overview.json()) as { workedHours: number }).workedHours,
          8,
        )
      },
    )

    await t.test(
      "policy creation and assignment require Admin and preserve historical targets",
      async () => {
        const input = {
          name: "Six hour version",
          timeZone: "Asia/Manila",
          days: days.map((day) => ({ ...day, requiredMinutes: 360 })),
          unpaidBreaksEnabled: false,
          overnightRequiresReview: true,
        }
        assert.equal((await request(head, "/policies", input)).status, 403)
        assert.equal((await request(staff, "/policies")).status, 403)
        assert.equal(
          (await request(admin, "/policies", { ...input, days: [] })).status,
          400,
        )
        assert.equal(
          (await request(admin, "/policies", { ...input, timeZone: "+08:00" }))
            .status,
          400,
        )
        const created = await request(admin, "/policies", input)
        assert.equal(created.status, 201)
        const next = ((await created.json()) as { policy: { id: string } })
          .policy
        assert.equal(
          (
            await request(admin, "/assignments", {
              employeeId: staff.employee.id,
              policyId: next.id,
              effectiveFrom: "2026-11-13",
            })
          ).status,
          400,
        )
        const assigned = await request(admin, "/assignments", {
          employeeId: staff.employee.id,
          policyId: next.id,
          effectiveFrom: "2026-11-15",
        })
        assert.equal(assigned.status, 201, await assigned.clone().text())
        assert.equal(
          (
            await prisma.attendanceWorkday.findUniqueOrThrow({
              where: { id: session.workdayId },
            })
          ).requiredMinutes,
          480,
        )
      },
    )

    await t.test(
      "requests are owned, replay-safe, and cannot target other employees",
      async () => {
        const foreign = await request(other, "/adjustments", {
          requestKey: randomUUID(),
          sessionId: session.id,
          startedAt: "2026-11-13T09:00:00+08:00",
          endedAt: "2026-11-13T18:00:00+08:00",
          reason: "Unauthorized correction",
        })
        assert.equal(foreign.status, 404)
        const created = await submit()
        const replay = await request(staff, "/adjustments", created.body)
        assert.equal(replay.status, 201)
        assert.equal(
          ((await replay.json()) as { adjustment: { id: string } }).adjustment
            .id,
          created.adjustment.id,
        )
        assert.equal(
          (
            await request(staff, "/adjustments", {
              ...created.body,
              reason: "Changed replay payload",
            })
          ).status,
          409,
        )
        assert.equal(
          (await request(staff, "/adjustments?scope=team")).status,
          403,
        )
        const searched = await request(
          head,
          "/adjustments?scope=team&search=Correct%20actual",
        )
        assert.equal(searched.status, 200, await searched.clone().text())
        assert.ok(
          (
            (await searched.json()) as {
              adjustments: { id: string }[]
            }
          ).adjustments.some((item) => item.id === created.adjustment.id),
        )
        assert.equal(
          (
            await request(
              staff,
              `/adjustments/${created.adjustment.id}/review`,
              { decision: "APPROVED", note: "Cannot approve own request" },
            )
          ).status,
          403,
        )
        const reviewed = await request(
          head,
          `/adjustments/${created.adjustment.id}/review`,
          {
            decision: "APPROVED",
            note: "Verified with department work records",
          },
        )
        assert.equal(reviewed.status, 200, await reviewed.clone().text())
        assert.equal(
          (
            await prisma.attendanceWorkSession.findUniqueOrThrow({
              where: { id: session.id },
            })
          ).endedAt?.toISOString(),
          "2026-11-13T10:00:00.000Z",
        )
        assert.equal(
          (
            await request(
              head,
              `/adjustments/${created.adjustment.id}/review`,
              { decision: "REJECTED", note: "Repeated decision" },
            )
          ).status,
          409,
        )
      },
    )

    await t.test(
      "reviewers cannot approve their own requests and rejections preserve time",
      async () => {
        const own = await submit(head, "")
        assert.equal(
          (
            await request(head, `/adjustments/${own.adjustment.id}/review`, {
              decision: "APPROVED",
              note: "Self approval attempt",
            })
          ).status,
          403,
        )
        const rejection = await request(
          admin,
          `/adjustments/${own.adjustment.id}/review`,
          {
            decision: "REJECTED",
            note: "Please provide supporting information",
          },
        )
        assert.equal(rejection.status, 200)
        assert.equal(
          await prisma.attendanceWorkSession.count({
            where: { employeeId: head.employee.id },
          }),
          0,
        )
        const missing = await submit(staff, "")
        assert.equal(
          (
            await request(
              head,
              `/adjustments/${missing.adjustment.id}/review`,
              { decision: "APPROVED", note: "Confirmed missing attendance" },
            )
          ).status,
          200,
        )
        assert.equal(
          await prisma.attendanceWorkSession.count({
            where: { employeeId: staff.employee.id },
          }),
          2,
        )
      },
    )

    await t.test(
      "monitoring filters and audit trails enforce company and department scope",
      async () => {
        await prisma.attendanceWorkSession.create({
          data: {
            employeeId: other.employee.id,
            startedAt: new Date("2026-11-13T09:00:00+08:00"),
            endedAt: new Date("2026-11-13T17:00:00+08:00"),
          },
        })
        assert.equal((await request(staff, "/records")).status, 403)
        assert.equal((await request(staff, "/audit")).status, 403)
        assert.equal((await request(staff, "/departments")).status, 403)
        assert.equal(
          (await request(head, `/records?departmentId=${outside.id}`)).status,
          403,
        )
        assert.equal(
          (await request(head, `/employees?departmentId=${outside.id}`)).status,
          403,
        )
        assert.equal(
          (await request(head, `/audit?departmentId=${outside.id}`)).status,
          403,
        )
        assert.equal(
          (await request(head, `/records?employeeId=${other.employee.id}`))
            .status,
          404,
        )
        const response = await request(
          admin,
          `/records?departmentId=${outside.id}&from=2026-11-13&to=2026-11-13`,
        )
        assert.equal(response.status, 200)
        const result = (await response.json()) as {
          total: number
          workdays: { employee: { id: string }; workedHours: number }[]
        }
        assert.equal(result.total, 1)
        assert.equal(result.workdays[0].employee.id, other.employee.id)
        assert.equal(result.workdays[0].workedHours, 8)
        assert.equal(
          (
            await request(
              admin,
              `/records?employeeId=${other.employee.id}&departmentId=${department.id}`,
            )
          ).status,
          404,
        )
        const choices = (await (
          await request(head, "/departments")
        ).json()) as { departments: { id: string }[] }
        assert.deepEqual(
          choices.departments.map((item) => item.id),
          [department.id],
        )
        const trail = (await (await request(head, "/audit")).json()) as {
          events: {
            employeeId: string
            entityType: string
            action: string
            before: unknown
            after: unknown
          }[]
        }
        assert.ok(trail.events.length)
        assert.ok(
          trail.events.every((entry) => entry.employeeId !== other.employee.id),
        )
        assert.ok(
          trail.events.some(
            (entry) =>
              entry.entityType === "AttendanceAdjustment" &&
              entry.action === "UPDATE" &&
              entry.before &&
              entry.after,
          ),
        )
        assert.equal(
          (await request(admin, "/records?departmentId[]=invalid")).status,
          400,
        )
      },
    )

    await t.test(
      "stale corrections cannot overwrite intervening punches or head handoffs",
      async () => {
        // Resolve the OT automatically submitted by the earlier approved corrections.
        const overtime = await prisma.attendanceAdjustment.findMany({
          where: {
            employeeId: staff.employee.id,
            type: "OVERTIME",
            status: "PENDING",
          },
        })
        for (const item of overtime) {
          assert.equal(
            (
              await request(admin, `/adjustments/${item.id}/review`, {
                decision: "REJECTED",
                note: "Resolve overtime before correcting attendance",
              })
            ).status,
            200,
          )
        }
        const correction = await submit(
          staff,
          session.id,
          "2026-11-13T19:00:00+08:00",
        )
        const monitoring = await request(
          head,
          "/records?from=2026-11-13&to=2026-11-13",
        )
        assert.equal(
          (
            (await monitoring.json()) as {
              workdays: { pendingCorrections: number }[]
            }
          ).workdays[0].pendingCorrections,
          1,
        )
        await prisma.attendanceWorkSession.update({
          where: { id: session.id },
          data: { endedAt: new Date("2026-11-13T18:30:00+08:00") },
        })
        assert.equal(
          (
            await request(
              head,
              `/adjustments/${correction.adjustment.id}/review`,
              { decision: "APPROVED", note: "Stale proposal review" },
            )
          ).status,
          409,
        )
        await prisma.department.update({
          where: { id: department.id },
          data: { headId: null },
        })
        assert.equal(
          (await request(head, `/employees/${staff.employee.id}/history`))
            .status,
          403,
        )
        assert.equal(
          (await request(head, "/adjustments?scope=team")).status,
          403,
        )
        assert.equal((await request(head, "/records")).status, 403)
        assert.equal((await request(head, "/audit")).status, 403)
        assert.equal(
          (
            await request(
              head,
              `/adjustments/${correction.adjustment.id}/review`,
              { decision: "REJECTED", note: "Former head decision" },
            )
          ).status,
          403,
        )
      },
    )
  },
)

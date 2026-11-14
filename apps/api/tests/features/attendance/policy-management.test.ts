import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "policy edits, assignment directory, and archive/delete lifecycle preserve recorded attendance",
  { timeout: 120000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t, {
      app: { attendanceClock: () => new Date("2026-11-13T12:00:00+08:00") },
    })
    const admin = await prisma.user.create({
      data: {
        email: "policy-admin@test.example",
        passwordHash: "test-only",
        role: "ADMIN",
      },
    })
    const staff = await prisma.user.create({
      data: {
        email: "policy-staff@test.example",
        passwordHash: "test-only",
        role: "STAFF",
      },
    })
    const employee = await prisma.employee.create({
      data: {
        employeeId: "POLICY-001",
        fullName: "Assigned employee",
        userId: staff.id,
      },
    })
    const adminToken = (await issueSession(admin)).token
    const staffToken = (await issueSession(staff)).token
    async function request(
      path: string,
      method = "GET",
      body?: unknown,
      token = adminToken,
    ) {
      return fetch(`${base}/attendance${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    }
    const input = {
      name: "Original policy",
      timeZone: "Asia/Manila",
      unpaidBreaksEnabled: true,
      overnightRequiresReview: false,
      days: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        isWorkingDay: true,
        requiredMinutes: 480,
      })),
    }
    const created = await request("/policies", "POST", input)
    assert.equal(created.status, 201)
    const { policy } = (await created.json()) as { policy: { id: string } }
    const path = `/policies/${policy.id}`
    const assignment = await request("/assignments", "POST", {
      employeeId: employee.id,
      policyId: policy.id,
      effectiveFrom: "2026-11-13",
    })
    assert.equal(assignment.status, 201, await assignment.clone().text())
    const session = await prisma.attendanceWorkSession.create({
      data: {
        employeeId: employee.id,
        startedAt: new Date("2026-11-13T09:00:00+08:00"),
      },
    })
    const edited = {
      ...input,
      name: "Updated policy",
      unpaidBreaksEnabled: false,
      overnightRequiresReview: true,
      days: input.days.map((day) => ({ ...day, requiredMinutes: 360 })),
    }

    await t.test(
      "edits require management access and update the same policy ID",
      async () => {
        assert.equal(
          (await request(path, "PATCH", edited, staffToken)).status,
          403,
        )
        assert.equal(
          (await request(path, "PATCH", { ...edited, days: [] })).status,
          400,
        )
        assert.equal(
          (await request(path, "PATCH", { ...edited, timeZone: "UTC" })).status,
          409,
        )
        const response = await request(path, "PATCH", edited)
        assert.equal(response.status, 200, await response.clone().text())
        const result = (await response.json()) as {
          policy: {
            id: string
            name: string
            days: { requiredMinutes: number }[]
          }
        }
        assert.equal(result.policy.id, policy.id)
        assert.equal(result.policy.name, edited.name)
        assert.equal(result.policy.days[0].requiredMinutes, 360)
        assert.equal(await prisma.attendancePolicy.count(), 1)
      },
    )
    await t.test(
      "historical rules and open-session break permissions are preserved",
      async () => {
        const current = await request(
          "/me/current",
          "GET",
          undefined,
          staffToken,
        )
        const state = (await current.json()) as {
          workday: {
            requiredMinutes: number
            policy: {
              name: string
              unpaidBreaksEnabled: boolean
              overnightRequiresReview: boolean
            }
          }
        }
        assert.equal(state.workday.requiredMinutes, 480)
        assert.deepEqual(state.workday.policy, {
          id: policy.id,
          name: input.name,
          unpaidBreaksEnabled: true,
          overnightRequiresReview: false,
        })
        assert.equal(
          (
            await request(
              "/me/breaks/start",
              "POST",
              { sessionId: session.id },
              staffToken,
            )
          ).status,
          200,
        )
        // Close the open session and its break before recording the next workday.
        const pause = await prisma.attendanceBreak.findFirstOrThrow({
          where: { sessionId: session.id },
        })
        await prisma.attendanceBreak.update({
          where: { id: pause.id },
          data: { endedAt: new Date("2026-11-13T12:30:00+08:00") },
        })
        await prisma.attendanceWorkSession.update({
          where: { id: session.id },
          data: { endedAt: new Date("2026-11-13T13:00:00+08:00") },
        })
        const future = await prisma.attendanceWorkSession.create({
          data: {
            employeeId: employee.id,
            startedAt: new Date("2026-11-14T09:00:00+08:00"),
            endedAt: new Date("2026-11-14T10:00:00+08:00"),
          },
        })
        const day = await prisma.attendanceWorkday.findUniqueOrThrow({
          where: { id: future.workdayId },
        })
        assert.equal(day.requiredMinutes, 360)
        assert.equal(day.policyName, edited.name)
        assert.equal(day.unpaidBreaksEnabled, false)
        assert.equal(day.overnightRequiresReview, true)
      },
    )
    await t.test(
      "assignment details are paginated and restricted to managers",
      async () => {
        assert.equal(
          (await request(`${path}/assignments`, "GET", undefined, staffToken))
            .status,
          403,
        )
        assert.equal(
          (await request(`${path}/assignments?page=invalid`)).status,
          400,
        )
        const response = await request(`${path}/assignments`)
        assert.equal(response.status, 200)
        const result = (await response.json()) as {
          total: number
          assignments: {
            status: string
            employee: { fullName: string; employeeId: string }
          }[]
        }
        assert.equal(result.total, 1)
        assert.equal(result.assignments[0].employee.fullName, employee.fullName)
        assert.equal(
          result.assignments[0].employee.employeeId,
          employee.employeeId,
        )
        assert.equal(result.assignments[0].status, "CURRENT")
      },
    )
    await t.test(
      "archiving prevents new assignments and preserves existing history",
      async () => {
        assert.equal((await request(path, "DELETE")).status, 409)
        assert.equal(
          (await request(`${path}/archive`, "POST", undefined, staffToken))
            .status,
          403,
        )
        assert.equal((await request(`${path}/archive`, "POST")).status, 200)
        assert.equal((await request(path, "PATCH", edited)).status, 409)
        assert.equal(
          (
            await request("/assignments", "POST", {
              employeeId: employee.id,
              policyId: policy.id,
              effectiveFrom: "2026-12-01",
            })
          ).status,
          409,
        )
        assert.equal((await request(path, "DELETE")).status, 409)
        const current = await request(
          "/me/current",
          "GET",
          undefined,
          staffToken,
        )
        assert.equal(current.status, 200)
        assert.equal(
          ((await current.json()) as { needsPolicy: boolean }).needsPolicy,
          false,
        )
        assert.equal((await request(`${path}/restore`, "POST")).status, 200)
        assert.equal(
          (
            await prisma.attendancePolicy.findUniqueOrThrow({
              where: { id: policy.id },
            })
          ).archivedAt,
          null,
        )
      },
    )
    await t.test(
      "unassigned policies can be permanently deleted only after archiving",
      async () => {
        const response = await request("/policies", "POST", input)
        const { policy: disposable } = (await response.json()) as {
          policy: { id: string }
        }
        const disposablePath = `/policies/${disposable.id}`
        assert.equal((await request(disposablePath, "DELETE")).status, 409)
        assert.equal(
          (await request(`${disposablePath}/archive`, "POST")).status,
          200,
        )
        assert.equal(
          (await request(disposablePath, "DELETE", undefined, staffToken))
            .status,
          403,
        )
        assert.equal((await request(disposablePath, "DELETE")).status, 200)
        assert.equal(
          await prisma.attendancePolicy.findUnique({
            where: { id: disposable.id },
          }),
          null,
        )
        assert.equal(
          await prisma.attendancePolicyDay.count({
            where: { policyId: disposable.id },
          }),
          0,
        )
        assert.equal((await request(disposablePath, "DELETE")).status, 404)
        assert.ok(
          await prisma.attendanceAudit.count({
            where: {
              entityId: disposable.id,
              action: "DELETE",
              actorId: admin.id,
            },
          }),
        )
      },
    )
  },
)

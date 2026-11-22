import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import type { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "policy unassignment uses the effective instant at a repeated midnight",
  { timeout: 120000 },
  async (t) => {
    const setupTime = "2026-10-30T12:00:00.000Z"
    const firstMidnight = "2026-11-01T04:30:00.000Z"
    const beforeCutoff = "2026-11-01T04:59:59.999Z"
    const cutoff = "2026-11-01T05:00:00.000Z"
    let now = new Date(setupTime)
    const { prisma, base } = await startPgliteApp(t, {
      app: { attendanceClock: () => now },
    })
    async function account(name: string, role: Role, departmentId?: string) {
      const user = await prisma.user.create({
        data: {
          email: `${name}@unassignment.test`,
          fullName: name,
          passwordHash: "test-only",
          role,
          departmentId,
        },
      })
      return { user, token: (await issueSession(user)).token }
    }

    const admin = await account("Admin", "ADMIN")
    const superadmin = await account("Superadmin", "SUPERADMIN")
    const client = await account("Client", "USER")
    const department = await prisma.department.create({
      data: { name: "Attendance department" },
    })
    const head = await account("Head", "STAFF", department.id)
    await prisma.department.update({
      where: { id: department.id },
      data: { headId: head.user.id },
    })

    function request(
      path: string,
      token: string | null,
      method = "GET",
      body?: unknown,
    ) {
      return fetch(`${base}${path}`, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    }

    async function policy(timeZone: string) {
      return prisma.attendancePolicy.create({
        data: {
          name: timeZone,
          timeZone,
          days: {
            create: Array.from({ length: 7 }, (_, weekday) => ({
              weekday,
              isWorkingDay: true,
              requiredMinutes: 480,
            })),
          },
        },
      })
    }
    const originalPolicy = await policy("Asia/Manila")
    const replacementPolicy = await policy("America/Havana")
    const nextPolicy = await policy("UTC")

    async function assign(
      employeeId: string,
      policyId: string,
      effectiveFrom: string,
    ) {
      const response = await request(
        "/attendance/assignments",
        admin.token,
        "POST",
        {
          employeeId,
          policyId,
          effectiveFrom,
        },
      )
      assert.equal(response.status, 201, await response.clone().text())
      const { assignment } = (await response.json()) as {
        assignment: { id: string }
      }
      return assignment.id
    }

    async function replacementFor(name: string) {
      now = new Date(setupTime)
      const staff = await account(name, "STAFF", department.id)
      const employee = await prisma.employee.create({
        data: {
          employeeId: `DST-${name}`,
          fullName: name,
          userId: staff.user.id,
          departmentId: department.id,
        },
      })
      const original = await assign(
        employee.id,
        originalPolicy.id,
        "2026-10-30",
      )
      const replacement = await assign(
        employee.id,
        replacementPolicy.id,
        "2026-11-01",
      )
      return { staff, employee, original, replacement }
    }

    function unassign(
      assignmentId: string,
      token: string | null,
      expectedStatus?: "CURRENT" | "SCHEDULED",
    ) {
      return request(
        `/attendance/assignments/${assignmentId}/unassign`,
        token,
        "POST",
        expectedStatus ? { expectedStatus } : undefined,
      )
    }

    async function assignmentStatus(policyId: string, assignmentId: string) {
      const response = await request(
        `/attendance/policies/${policyId}/assignments`,
        admin.token,
      )
      assert.equal(response.status, 200, await response.clone().text())
      const { assignments } = (await response.json()) as {
        assignments: { id: string; status: string }[]
      }
      return assignments.find(({ id }) => id === assignmentId)?.status
    }

    async function effectivePolicy(token: string) {
      const response = await request("/attendance/me/current", token)
      assert.equal(response.status, 200, await response.clone().text())
      const { workday } = (await response.json()) as {
        workday: { policy: { id: string }; workDate: string } | null
      }
      return workday && { id: workday.policy.id, workDate: workday.workDate }
    }

    await t.test(
      "Admin cancels during the first midnight and restores coverage after denied attempts",
      async () => {
        const { staff, original, replacement } = await replacementFor("Cancel")
        now = new Date(firstMidnight)
        const assignmentAudit = { entityId: { in: [original, replacement] } }
        const auditCount = await prisma.attendanceAudit.count({
          where: assignmentAudit,
        })
        for (const [token, status] of [
          [null, 401],
          [staff.token, 403],
          [head.token, 403],
          [client.token, 403],
        ] as const) {
          assert.equal((await unassign(replacement, token)).status, status)
        }
        assert.equal(
          await prisma.attendanceAudit.count({ where: assignmentAudit }),
          auditCount,
        )
        assert.equal(
          await assignmentStatus(replacementPolicy.id, replacement),
          "SCHEDULED",
        )
        assert.equal(
          await assignmentStatus(originalPolicy.id, original),
          "CURRENT",
        )

        const response = await unassign(replacement, admin.token, "SCHEDULED")
        assert.equal(response.status, 200, await response.clone().text())
        assert.equal(
          await assignmentStatus(replacementPolicy.id, replacement),
          undefined,
        )
        assert.equal(
          await prisma.attendancePolicyAssignment.findUnique({
            where: { id: replacement },
          }),
          null,
        )
        assert.equal(
          (
            await prisma.attendancePolicyAssignment.findUniqueOrThrow({
              where: { id: original },
            })
          ).effectiveUntil,
          null,
        )
        assert.ok(
          await prisma.attendanceAudit.count({
            where: {
              entityId: replacement,
              action: "DELETE",
              actorId: admin.user.id,
            },
          }),
        )
        for (const [instant, workDate] of [
          [beforeCutoff, "2026-11-01"],
          [cutoff, "2026-11-01"],
          ["2026-11-02T05:00:00.000Z", "2026-11-02"],
        ]) {
          now = new Date(instant)
          assert.equal(
            await assignmentStatus(originalPolicy.id, original),
            "CURRENT",
          )
          assert.deepEqual(await effectivePolicy(staff.token), {
            id: originalPolicy.id,
            workDate,
          })
        }
      },
    )

    await t.test(
      "Superadmin cancellation protects open leave and retains terminal leave and the successor",
      async () => {
        const { staff, employee, original, replacement } =
          await replacementFor("Leave")
        const next = await assign(employee.id, nextPolicy.id, "2026-11-02")
        const submitted = await request(
          "/leave/requests",
          staff.token,
          "POST",
          {
            requestKey: randomUUID(),
            type: "ANNUAL",
            reason: "Planned personal leave",
            startDate: "2026-11-01",
            endDate: "2026-11-01",
          },
        )
        assert.equal(submitted.status, 201, await submitted.clone().text())
        const { request: leave } = (await submitted.json()) as {
          request: { id: string; version: number }
        }

        now = new Date(beforeCutoff)
        assert.equal(
          await assignmentStatus(replacementPolicy.id, replacement),
          "SCHEDULED",
        )
        const blocked = await unassign(replacement, superadmin.token)
        assert.equal(blocked.status, 409)
        assert.match(await blocked.text(), /Resolve future leave requests/)
        assert.equal(
          await assignmentStatus(replacementPolicy.id, replacement),
          "SCHEDULED",
        )

        const cancelledLeave = await request(
          `/leave/requests/${leave.id}/cancel`,
          staff.token,
          "POST",
          {
            actionId: randomUUID(),
            expectedVersion: leave.version,
            note: "Leave is no longer needed",
          },
        )
        assert.equal(
          cancelledLeave.status,
          200,
          await cancelledLeave.clone().text(),
        )
        const response = await unassign(replacement, superadmin.token)
        assert.equal(response.status, 200, await response.clone().text())
        assert.equal(
          await assignmentStatus(replacementPolicy.id, replacement),
          "CANCELLED",
        )
        const retained =
          await prisma.attendancePolicyAssignment.findUniqueOrThrow({
            where: { id: replacement },
          })
        assert.equal(retained.cancelledAt?.toISOString(), beforeCutoff)
        assert.equal(
          retained.effectiveFrom.toISOString().slice(0, 10),
          "2026-11-01",
        )
        assert.equal(
          retained.effectiveUntil?.toISOString().slice(0, 10),
          "2026-11-02",
        )
        assert.equal(
          (
            await prisma.leaveRequestDay.findFirstOrThrow({
              where: { requestId: leave.id },
            })
          ).assignmentId,
          replacement,
        )
        const successor =
          await prisma.attendancePolicyAssignment.findUniqueOrThrow({
            where: { id: next },
          })
        assert.equal(successor.replacedAssignmentId, original)
        assert.equal(successor.replacedUntil, null)
        assert.equal(
          (await unassign(replacement, superadmin.token)).status,
          200,
        )

        now = new Date(cutoff)
        assert.deepEqual(await effectivePolicy(staff.token), {
          id: originalPolicy.id,
          workDate: "2026-11-01",
        })
        now = new Date("2026-11-02T00:00:00.000Z")
        assert.equal(
          await assignmentStatus(originalPolicy.id, original),
          "ENDED",
        )
        assert.deepEqual(await effectivePolicy(staff.token), {
          id: nextPolicy.id,
          workDate: "2026-11-02",
        })
      },
    )

    await t.test(
      "the second midnight starts coverage and current unassign ends it tomorrow",
      async () => {
        const { staff, original, replacement } = await replacementFor("Current")
        now = new Date(beforeCutoff)
        assert.equal(
          await assignmentStatus(originalPolicy.id, original),
          "CURRENT",
        )
        assert.equal(
          await assignmentStatus(replacementPolicy.id, replacement),
          "SCHEDULED",
        )
        assert.deepEqual(await effectivePolicy(staff.token), {
          id: originalPolicy.id,
          workDate: "2026-10-31",
        })

        now = new Date(cutoff)
        assert.equal(
          await assignmentStatus(originalPolicy.id, original),
          "ENDED",
        )
        assert.equal(
          await assignmentStatus(replacementPolicy.id, replacement),
          "CURRENT",
        )
        assert.equal(
          (await unassign(replacement, admin.token, "SCHEDULED")).status,
          409,
        )
        const response = await unassign(replacement, admin.token, "CURRENT")
        assert.equal(response.status, 200, await response.clone().text())
        assert.equal(
          await assignmentStatus(replacementPolicy.id, replacement),
          "CURRENT",
        )
        assert.deepEqual(await effectivePolicy(staff.token), {
          id: replacementPolicy.id,
          workDate: "2026-11-01",
        })
        assert.equal((await unassign(replacement, admin.token)).status, 409)

        now = new Date("2026-11-02T04:59:59.999Z")
        assert.deepEqual(await effectivePolicy(staff.token), {
          id: replacementPolicy.id,
          workDate: "2026-11-01",
        })
        now = new Date("2026-11-02T05:00:00.000Z")
        assert.equal(
          await assignmentStatus(replacementPolicy.id, replacement),
          "ENDED",
        )
        assert.equal(await effectivePolicy(staff.token), null)
        assert.equal((await unassign(replacement, admin.token)).status, 409)
        const ended = await prisma.attendancePolicyAssignment.findUniqueOrThrow(
          {
            where: { id: replacement },
          },
        )
        assert.equal(ended.cancelledAt, null)
        assert.equal(
          ended.effectiveUntil?.toISOString().slice(0, 10),
          "2026-11-02",
        )
      },
    )

    await t.test(
      "blocked policy changes identify the latest recorded workday and leave the assignment audit unchanged",
      async () => {
        const { employee, replacement } = await replacementFor("Recorded")
        for (const workDate of ["2026-11-02", "2026-11-04"]) {
          await prisma.attendanceWorkSession.create({
            data: {
              employeeId: employee.id,
              startedAt: new Date(`${workDate}T13:00:00Z`),
              endedAt: new Date(`${workDate}T14:00:00Z`),
            },
          })
        }
        now = new Date(cutoff)
        const auditCount = () =>
          prisma.attendanceAudit.count({
            where: {
              entityType: "AttendancePolicyAssignment",
              entityId: replacement,
            },
          })
        const before = await auditCount()
        const ended = await unassign(replacement, admin.token, "CURRENT")
        assert.equal(ended.status, 409)
        assert.match(
          await ended.text(),
          /2026-11-04.*2026-11-02.*America\/Havana.*Time Logs/,
        )
        const reassigned = await request(
          "/attendance/assignments",
          admin.token,
          "POST",
          {
            employeeId: employee.id,
            policyId: nextPolicy.id,
            effectiveFrom: "2026-11-03",
            replacesAssignmentId: replacement,
          },
        )
        assert.equal(reassigned.status, 409)
        assert.match(
          await reassigned.text(),
          /2026-11-04.*Choose an effective date after that workday/,
        )
        assert.equal(await auditCount(), before)
        assert.equal(
          await assignmentStatus(replacementPolicy.id, replacement),
          "CURRENT",
        )
        const records = await request(
          `/attendance/records?employeeId=${employee.id}&from=2026-11-04&to=2026-11-04`,
          admin.token,
        )
        assert.equal(records.status, 200)
        assert.match(await records.text(), /"workDate":"2026-11-04"/)
      },
    )
  },
)

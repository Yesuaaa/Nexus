import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import type { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "overtime and corrections protect the same effective attendance workday",
  { timeout: 120000 },
  async (t) => {
    const reviewTime = new Date("2026-11-20T12:00:00+08:00")
    let now = reviewTime
    const { prisma, base } = await startPgliteApp(t, {
      app: { attendanceClock: () => now },
    })
    const department = await prisma.department.create({
      data: { name: "Overtime corrections" },
    })
    function policy(timeZone: string) {
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
    const manila = await policy("Asia/Manila")

    async function account(name: string, role: Role = "STAFF") {
      const { user, employee } = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: `${name}@ot-corrections.test`,
            passwordHash: "test",
            role,
          },
        })
        const employee = await tx.employee.create({
          data: {
            fullName: name,
            employeeId: `OT-CORRECTION-${name}`,
            userId: user.id,
            departmentId: department.id,
          },
        })
        const assignment = await tx.attendancePolicyAssignment.create({
          data: {
            employeeId: employee.id,
            policyId: manila.id,
            effectiveFrom: new Date("2026-01-01"),
          },
        })
        return { user, employee: { ...employee, assignmentId: assignment.id } }
      })
      return { user, employee, token: (await issueSession(user)).token }
    }
    const head = await account("head")
    const hr = await account("hr", "ADMIN")
    await prisma.department.update({
      where: { id: department.id },
      data: { headId: head.user.id },
    })

    function call(actor: { token: string }, path: string, body?: object) {
      return fetch(`${base}/attendance${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Authorization: `Bearer ${actor.token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: JSON.stringify(body),
      })
    }
    function proposal(startedAt: string, endedAt: string) {
      return {
        requestKey: randomUUID(),
        startedAt,
        endedAt,
        reason: "Record actual working time",
      }
    }
    const missing = () =>
      proposal("2026-11-11T06:00:00+08:00", "2026-11-11T08:00:00+08:00")
    const overtime = () => ({
      ...proposal("2026-11-11T16:00:00+08:00", "2026-11-11T18:00:00+08:00"),
      type: "OVERTIME",
    })
    function session(employeeId: string, start: string, end: string) {
      return prisma.attendanceWorkSession.create({
        data: {
          employeeId,
          startedAt: new Date(start),
          endedAt: new Date(end),
        },
      })
    }
    async function split(employeeId: string) {
      const first = await session(
        employeeId,
        "2026-11-11T08:00:00+08:00",
        "2026-11-11T14:00:00+08:00",
      )
      const second = await session(
        employeeId,
        "2026-11-11T14:00:00+08:00",
        "2026-11-11T18:00:00+08:00",
      )
      assert.equal(first.workdayId, second.workdayId)
      return { first, second }
    }
    async function submit(actor: { token: string }, body: object) {
      const response = await call(actor, "/adjustments", body)
      assert.equal(response.status, 201, await response.clone().text())
      return (
        (await response.json()) as {
          adjustment: { id: string; sessionId: string | null; status: string }
        }
      ).adjustment
    }
    function review(
      actor: { token: string },
      id: string,
      decision = "APPROVED",
    ) {
      return call(actor, `/adjustments/${id}/review`, {
        decision,
        note: "Reviewed recorded work",
      })
    }
    async function reviewed(
      actor: { token: string },
      id: string,
      status: string,
      decision?: string,
    ) {
      const response = await review(actor, id, decision)
      assert.equal(response.status, 200, await response.clone().text())
      assert.equal(
        ((await response.json()) as { adjustment: { status: string } })
          .adjustment.status,
        status,
      )
    }
    async function snapshot(employeeId: string) {
      const where = { employeeId }
      const orderBy = { id: "asc" } as const
      return {
        days: await prisma.attendanceWorkday.findMany({ where, orderBy }),
        sessions: await prisma.attendanceWorkSession.findMany({
          where,
          orderBy,
          include: { breaks: { orderBy } },
        }),
        adjustments: await prisma.attendanceAdjustment.findMany({
          where,
          orderBy,
        }),
        notifications: await prisma.workflowNotification.findMany({
          where: { attendanceAdjustment: where },
          orderBy,
        }),
        audit: await prisma.attendanceAudit.findMany({ where, orderBy }),
      }
    }
    const correctionConflict = /Resolve overtime requests for this workday/
    const overtimeConflict = /Resolve pending attendance corrections/
    async function conflict(
      employeeId: string,
      operation: () => Promise<Response>,
      message: RegExp,
    ) {
      const before = await snapshot(employeeId)
      const response = await operation()
      assert.equal(response.status, 409, await response.clone().text())
      assert.match(await response.text(), message)
      assert.deepEqual(await snapshot(employeeId), before)
    }

    for (const status of ["PENDING", "VERIFIED", "APPROVED"]) {
      await t.test(
        `split workday with ${status} overtime blocks both correction types`,
        async () => {
          const staff = await account(status.toLowerCase())
          const { first, second } = await split(staff.employee.id)
          const request = await submit(staff, overtime())
          assert.equal(request.sessionId, second.id)
          if (status !== "PENDING") await reviewed(head, request.id, "VERIFIED")
          if (status === "APPROVED") await reviewed(hr, request.id, "APPROVED")
          await conflict(
            staff.employee.id,
            () =>
              call(staff, "/adjustments", {
                ...proposal(
                  "2026-11-11T08:00:00+08:00",
                  "2026-11-11T13:00:00+08:00",
                ),
                sessionId: first.id,
              }),
            correctionConflict,
          )
          await conflict(
            staff.employee.id,
            () => call(staff, "/adjustments", missing()),
            correctionConflict,
          )
        },
      )
    }

    await t.test(
      "a pending missing-session correction blocks manual overtime",
      async () => {
        const staff = await account("missing-first")
        await session(
          staff.employee.id,
          "2026-11-11T08:00:00+08:00",
          "2026-11-11T18:00:00+08:00",
        )
        const correction = await submit(staff, missing())
        assert.equal(correction.status, "PENDING")
        assert.equal(correction.sessionId, null)
        await conflict(
          staff.employee.id,
          () => call(staff, "/adjustments", overtime()),
          overtimeConflict,
        )
        await reviewed(head, correction.id, "VERIFIED")
        await conflict(
          staff.employee.id,
          () => call(staff, "/adjustments", overtime()),
          overtimeConflict,
        )
      },
    )

    await t.test(
      "rejected overtime releases both correction paths",
      async () => {
        const staff = await account("rejected-overtime")
        const { first } = await split(staff.employee.id)
        const request = await submit(staff, overtime())
        await reviewed(head, request.id, "REJECTED", "REJECTED")
        const existing = await submit(staff, {
          ...proposal("2026-11-11T08:00:00+08:00", "2026-11-11T13:00:00+08:00"),
          sessionId: first.id,
        })
        await conflict(
          staff.employee.id,
          () => call(staff, "/adjustments", overtime()),
          overtimeConflict,
        )
        await reviewed(head, existing.id, "REJECTED", "REJECTED")
        const correction = await submit(staff, missing())
        await reviewed(head, correction.id, "VERIFIED")
        await reviewed(hr, correction.id, "APPROVED")
        const retained = await prisma.attendanceAdjustment.findUniqueOrThrow({
          where: { id: request.id },
        })
        assert.equal(retained.status, "REJECTED")
        assert.equal(retained.overtimeMinutes, 120)
      },
    )

    for (const decision of ["APPROVED", "REJECTED"]) {
      await t.test(
        `overnight clock-out defers overtime until missing attendance is ${decision.toLowerCase()}`,
        async () => {
          const staff = await account(`overnight-${decision.toLowerCase()}`)
          try {
            now = new Date("2026-11-11T20:00:00+08:00")
            const correction = await submit(
              staff,
              proposal(
                "2026-11-11T18:00:00+08:00",
                "2026-11-11T20:00:00+08:00",
              ),
            )
            const punched = await call(staff, "/me/clock-in", {})
            assert.equal(punched.status, 201, await punched.clone().text())
            const { workday } = (await punched.json()) as {
              workday: { activeSessionId: string }
            }
            now = new Date("2026-11-12T06:00:00+08:00")
            const closed = await call(staff, "/me/clock-out", {
              sessionId: workday.activeSessionId,
            })
            assert.equal(closed.status, 200, await closed.clone().text())
            const before = await snapshot(staff.employee.id)
            assert.equal(
              before.sessions[0]?.endedAt?.toISOString(),
              now.toISOString(),
            )
            assert.deepEqual(
              before.adjustments.map(({ type }) => type),
              ["CORRECTION"],
            )
            const afterMidnight = {
              ...proposal(
                "2026-11-12T04:00:00+08:00",
                "2026-11-12T06:00:00+08:00",
              ),
              type: "OVERTIME",
            }
            await conflict(
              staff.employee.id,
              () => call(staff, "/adjustments", afterMidnight),
              overtimeConflict,
            )
            now = reviewTime
            const nextDay = await submit(
              staff,
              proposal(
                "2026-11-12T07:00:00+08:00",
                "2026-11-12T08:00:00+08:00",
              ),
            )
            assert.equal(nextDay.status, "PENDING")
            await reviewed(head, correction.id, "VERIFIED")
            await reviewed(hr, correction.id, decision, decision)
            const after = await snapshot(staff.employee.id)
            assert.deepEqual(
              after.days.map(({ workDate }) =>
                workDate.toISOString().slice(0, 10),
              ),
              ["2026-11-11"],
            )
            assert.equal(after.sessions.length, decision === "APPROVED" ? 2 : 1)
            assert.ok(
              after.sessions.every(
                ({ workdayId }) => workdayId === after.days[0]?.id,
              ),
            )
            const generated = after.adjustments.filter(
              ({ type }) => type === "OVERTIME",
            )
            assert.equal(generated.length, 1)
            assert.equal(generated[0]?.status, "PENDING")
            assert.equal(generated[0]?.sessionId, workday.activeSessionId)
            assert.equal(
              generated[0]?.overtimeMinutes,
              decision === "APPROVED" ? 240 : 120,
            )
            assert.ok(
              after.notifications.some(
                ({ attendanceAdjustmentId, type }) =>
                  attendanceAdjustmentId === generated[0]?.id &&
                  type === "ATTENDANCE_OVERTIME_PENDING",
              ),
            )
            const history = await call(
              staff,
              "/me/history?from=2026-11-11&to=2026-11-12",
            )
            assert.equal(history.status, 200, await history.clone().text())
            const { workdays } = (await history.json()) as {
              workdays: {
                workDate: string
                workedMinutes: number
                requiredMinutes: number
              }[]
            }
            assert.deepEqual(
              workdays.map(({ workDate, workedMinutes, requiredMinutes }) => ({
                workDate,
                workedMinutes,
                requiredMinutes,
              })),
              [
                {
                  workDate: "2026-11-11",
                  workedMinutes: decision === "APPROVED" ? 720 : 600,
                  requiredMinutes: 480,
                },
              ],
            )
          } finally {
            now = reviewTime
          }
        },
      )
    }

    await t.test(
      "policy timezone handoff uses the outgoing workday before incoming midnight",
      async () => {
        const staff = await account("policy-handoff")
        const honolulu = await policy("Pacific/Honolulu")
        await prisma.attendancePolicyAssignment.update({
          where: { id: staff.employee.assignmentId },
          data: { effectiveUntil: new Date("2026-11-12") },
        })
        await prisma.attendancePolicyAssignment.create({
          data: {
            employeeId: staff.employee.id,
            policyId: honolulu.id,
            effectiveFrom: new Date("2026-11-12"),
          },
        })
        const outgoing = proposal(
          "2026-11-12T00:00:00+08:00",
          "2026-11-12T02:00:00+08:00",
        )
        const incoming = proposal(
          "2026-11-12T00:00:00-10:00",
          "2026-11-12T02:00:00-10:00",
        )
        await session(
          staff.employee.id,
          "2026-11-11T08:00:00+08:00",
          "2026-11-11T18:00:00+08:00",
        )
        const request = await submit(staff, overtime())
        const next = await submit(staff, incoming)
        assert.equal(next.status, "PENDING")
        await conflict(
          staff.employee.id,
          () => call(staff, "/adjustments", outgoing),
          correctionConflict,
        )
        await reviewed(head, request.id, "REJECTED", "REJECTED")
        const correction = await submit(staff, outgoing)
        await conflict(
          staff.employee.id,
          () => call(staff, "/adjustments", overtime()),
          overtimeConflict,
        )
        await reviewed(head, correction.id, "VERIFIED")
        await reviewed(hr, correction.id, "APPROVED")
        const recorded = await snapshot(staff.employee.id)
        assert.equal(recorded.days.length, 1)
        assert.equal(
          recorded.days[0]?.workDate.toISOString().slice(0, 10),
          "2026-11-11",
        )
        assert.equal(recorded.sessions.length, 2)
        assert.ok(
          recorded.sessions.every(
            ({ workdayId }) => workdayId === recorded.days[0]?.id,
          ),
        )
      },
    )

    for (const type of ["CORRECTION", "OVERTIME"]) {
      await t.test(
        `final ${type.toLowerCase()} approval rechecks a conflict introduced after verification`,
        async () => {
          const staff = await account(`stale-${type.toLowerCase()}`)
          const { second } = await split(staff.employee.id)
          const request = await submit(
            staff,
            type === "CORRECTION" ? missing() : overtime(),
          )
          await reviewed(head, request.id, "VERIFIED")
          // Model conflicting rows submitted before the guard was applied.
          const other = type === "CORRECTION" ? overtime() : missing()
          await prisma.attendanceAdjustment.create({
            data: {
              employeeId: staff.employee.id,
              requestedById: staff.user.id,
              type: type === "CORRECTION" ? "OVERTIME" : "CORRECTION",
              proposedStartedAt: new Date(other.startedAt),
              proposedEndedAt: new Date(other.endedAt),
              ...(type === "CORRECTION"
                ? { sessionId: second.id, overtimeMinutes: 120 }
                : {}),
              requestKey: other.requestKey,
              reason: other.reason,
            },
          })
          await conflict(
            staff.employee.id,
            () => review(hr, request.id),
            type === "CORRECTION" ? correctionConflict : overtimeConflict,
          )
        },
      )
    }
  },
)

import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { applyMigrations, startPgliteApp } from "../../support/pglite-app.js"

test(
  "policy edits, assignment directory, and archive/delete lifecycle preserve recorded attendance",
  { timeout: 120000 },
  async (t) => {
    let now = new Date("2026-11-13T12:00:00+08:00")
    const { prisma, base } = await startPgliteApp(t, {
      app: { attendanceClock: () => now },
      migrate: async (db) => {
        await applyMigrations(db)
        await db.exec("SET TIME ZONE 'Asia/Manila'")
      },
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
    await t.test(
      "policy overview totals cover the inventory and remain configuration-only",
      async () => {
        assert.equal(
          (await request("/policies", "GET", undefined, staffToken)).status,
          403,
        )
        const response = await request("/policies")
        assert.equal(response.status, 200)
        const result = (await response.json()) as {
          summary: {
            totalPolicies: number
            activePolicies: number
            archivedPolicies: number
            assignmentPeriods: number
          }
        }
        assert.deepEqual(result.summary, {
          totalPolicies: await prisma.attendancePolicy.count(),
          activePolicies: await prisma.attendancePolicy.count({
            where: { archivedAt: null },
          }),
          archivedPolicies: await prisma.attendancePolicy.count({
            where: { archivedAt: { not: null } },
          }),
          assignmentPeriods: await prisma.attendancePolicyAssignment.count(),
        })
      },
    )

    for (const transition of [
      {
        outgoingZone: "Asia/Manila",
        incomingZone: "UTC",
        before: "2026-11-24T07:59:59.999+08:00",
        cutoff: "2026-11-24T08:00:00.000+08:00",
      },
      {
        outgoingZone: "UTC",
        incomingZone: "Asia/Manila",
        before: "2026-11-23T23:59:59.999+08:00",
        cutoff: "2026-11-24T00:00:00.000+08:00",
      },
    ]) {
      await t.test(
        `clock-in follows a single cutoff from ${transition.outgoingZone} to ${transition.incomingZone}`,
        async () => {
          now = new Date("2026-11-22T12:00:00+08:00")
          const worker = await prisma.user.create({
            data: {
              email: `${transition.outgoingZone === "UTC" ? "utc" : "manila"}-worker@test.example`,
              passwordHash: "test-only",
              role: "STAFF",
            },
          })
          const profile = await prisma.employee.create({
            data: {
              employeeId: `HANDOFF-${worker.id}`,
              fullName: "Handoff employee",
              userId: worker.id,
            },
          })
          const token = (await issueSession(worker)).token

          async function assign(
            name: string,
            timeZone: string,
            effectiveFrom: string,
            requiredMinutes = 480,
          ) {
            const created = await request("/policies", "POST", {
              ...input,
              name,
              timeZone,
              days: input.days.map((day) => ({ ...day, requiredMinutes })),
            })
            assert.equal(created.status, 201, await created.clone().text())
            const { policy } = (await created.json()) as {
              policy: { id: string }
            }
            const assigned = await request("/assignments", "POST", {
              employeeId: profile.id,
              policyId: policy.id,
              effectiveFrom,
            })
            assert.equal(assigned.status, 201, await assigned.text())
            return policy.id
          }

          const outgoing = await assign(
            "Outgoing policy",
            transition.outgoingZone,
            "2026-11-22",
          )
          const incoming = await assign(
            "Incoming policy",
            transition.incomingZone,
            "2026-11-24",
            360,
          )

          async function expectAssignmentStatus(
            policyId: string,
            status: string,
          ) {
            const response = await request(`/policies/${policyId}/assignments`)
            assert.equal(response.status, 200, await response.clone().text())
            const { assignments } = (await response.json()) as {
              assignments: { status: string }[]
            }
            assert.equal(assignments[0].status, status)
          }

          async function expectWorkday(
            response: Response,
            status: number,
            policyId: string,
            date: string,
          ) {
            assert.equal(response.status, status, await response.clone().text())
            const { workday } = (await response.json()) as {
              workday: {
                workDate: string
                policy: { id: string }
                activeSessionId: string
              }
            }
            assert.equal(
              workday.policy.id,
              policyId,
              `Policy at ${now.toISOString()}`,
            )
            assert.equal(workday.workDate, date)
            return workday.activeSessionId
          }

          const justBefore = new Date(transition.before).getTime()
          now = new Date(justBefore - 2)
          const firstSession = await expectWorkday(
            await request("/me/clock-in", "POST", {}, token),
            201,
            outgoing,
            "2026-11-23",
          )
          const { workdayId } =
            await prisma.attendanceWorkSession.findUniqueOrThrow({
              where: { id: firstSession },
            })
          now = new Date(justBefore - 1)
          await expectWorkday(
            await request(
              "/me/clock-out",
              "POST",
              { sessionId: firstSession },
              token,
            ),
            200,
            outgoing,
            "2026-11-23",
          )
          now = new Date(justBefore)
          await expectAssignmentStatus(outgoing, "CURRENT")
          await expectAssignmentStatus(incoming, "SCHEDULED")
          await expectWorkday(
            await request("/me/current", "GET", undefined, token),
            200,
            outgoing,
            "2026-11-23",
          )
          const sessionId = await expectWorkday(
            await request("/me/clock-in", "POST", { workdayId }, token),
            201,
            outgoing,
            "2026-11-23",
          )

          now = new Date(transition.cutoff)
          await expectAssignmentStatus(outgoing, "ENDED")
          await expectAssignmentStatus(incoming, "CURRENT")
          await expectWorkday(
            await request("/me/clock-out", "POST", { sessionId }, token),
            200,
            outgoing,
            "2026-11-23",
          )
          const current = await request("/me/current", "GET", undefined, token)
          await expectWorkday(current.clone(), 200, incoming, "2026-11-24")
          const readWrites = async () => ({
            sessions: await prisma.attendanceWorkSession.findMany({
              where: { employeeId: profile.id },
              orderBy: { id: "asc" },
            }),
            audit: await prisma.attendanceAudit.findMany({
              where: { employeeId: profile.id },
              orderBy: { id: "asc" },
            }),
          })
          const before = await readWrites()
          const stale = await request(
            "/me/clock-in",
            "POST",
            { workdayId },
            token,
          )
          assert.equal(stale.status, 409, await stale.clone().text())
          assert.deepEqual(await readWrites(), before)
          const { continuation } = (await current.json()) as {
            continuation: unknown
          }
          assert.equal(continuation, null)

          const incomingSession = await expectWorkday(
            await request("/me/clock-in", "POST", {}, token),
            201,
            incoming,
            "2026-11-24",
          )
          now = new Date(new Date(transition.cutoff).getTime() + 7 * 3600000)
          await expectWorkday(
            await request(
              "/me/clock-out",
              "POST",
              { sessionId: incomingSession },
              token,
            ),
            200,
            incoming,
            "2026-11-24",
          )
          const history = await request(
            "/me/history?from=2026-11-23&to=2026-11-24",
            "GET",
            undefined,
            token,
          )
          assert.equal(history.status, 200)
          const { workdays } = (await history.json()) as {
            workdays: {
              workDate: string
              policy: { id: string }
              requiredMinutes: number
              sessions: { id: string }[]
            }[]
          }
          assert.deepEqual(
            workdays.map((day) => [
              day.workDate,
              day.policy.id,
              day.requiredMinutes,
              day.sessions.map(({ id }) => id),
            ]),
            [
              ["2026-11-24", incoming, 360, [incomingSession]],
              ["2026-11-23", outgoing, 480, [firstSession, sessionId]],
            ],
          )
          const overtime = await prisma.attendanceAdjustment.findMany({
            where: { employeeId: profile.id },
            select: { sessionId: true, type: true, overtimeMinutes: true },
          })
          assert.deepEqual(overtime, [
            {
              sessionId: incomingSession,
              type: "OVERTIME",
              overtimeMinutes: 60,
            },
          ])
        },
      )
    }
  },
)

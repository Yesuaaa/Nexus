import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { applyMigrations, startPgliteApp } from "../../support/pglite-app.js"

test(
  "policy replacements preserve positive effective durations across the date line",
  { timeout: 120000 },
  async (t) => {
    const setupTime = "2026-12-02T12:00:00.000Z"
    let now = new Date(setupTime)
    const { prisma, base } = await startPgliteApp(t, {
      app: { attendanceClock: () => now },
      migrate: async (db) => {
        await applyMigrations(db)
        await db.exec("SET TIME ZONE 'Asia/Manila'")
      },
    })
    const admin = await prisma.user.create({
      data: {
        email: "policy-replacement-admin@test.example",
        passwordHash: "test-only",
        role: "ADMIN",
      },
    })
    const { token } = await issueSession(admin)

    async function policy(timeZone: string) {
      const { id } = await prisma.attendancePolicy.create({
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
      return id
    }

    const manila = await policy("Asia/Manila")
    const pagoPago = await policy("Pacific/Pago_Pago")
    const honolulu = await policy("Pacific/Honolulu")
    const kiritimati = await policy("Pacific/Kiritimati")

    async function employee(name: string) {
      now = new Date(setupTime)
      const { id } = await prisma.employee.create({
        data: { employeeId: `DATE-LINE-${name}`, fullName: name },
      })
      return id
    }

    function post(path: string, body?: object) {
      return fetch(`${base}/attendance/assignments${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
    }

    async function assign(
      employeeId: string,
      policyId: string,
      effectiveFrom: string,
    ) {
      const response = await post("", { employeeId, policyId, effectiveFrom })
      assert.equal(response.status, 201, await response.clone().text())
      const { assignment } = (await response.json()) as {
        assignment: { id: string }
      }
      return assignment.id
    }

    async function snapshot(employeeId: string) {
      return {
        assignments: await prisma.attendancePolicyAssignment.findMany({
          where: { employeeId },
          orderBy: { effectiveFrom: "asc" },
        }),
        audit: await prisma.attendanceAudit.findMany({
          where: { employeeId },
          orderBy: { id: "asc" },
        }),
      }
    }

    async function effectiveAssignment(employeeId: string, instant: string) {
      const [result] = await prisma.$queryRaw<{ assignmentId: string }[]>`
        SELECT "assignmentId" FROM attendance_policy_at(${employeeId}, ${instant}::timestamptz)
      `
      return result?.assignmentId
    }

    async function rejectKiritimati(employeeId: string) {
      const before = await snapshot(employeeId)
      const response = await post("", {
        employeeId,
        policyId: kiritimati,
        effectiveFrom: "2026-12-11",
      })
      assert.equal(response.status, 409, await response.clone().text())
      assert.match(
        await response.text(),
        /after the previous assignment starts/,
      )
      assert.deepEqual(await snapshot(employeeId), before)
    }

    for (const [name, relation, outgoingPolicy, outgoingStart] of [
      ["earlier", "an hour before", pagoPago, "2026-12-10T11:00:00.000Z"],
      ["equal", "equal to", honolulu, "2026-12-10T10:00:00.000Z"],
    ] as const) {
      await t.test(
        `rejects an incoming midnight ${relation} the predecessor start`,
        async () => {
          const id = await employee(name)
          const original = await assign(id, manila, "2026-12-02")
          const predecessor = await assign(id, outgoingPolicy, "2026-12-10")
          await rejectKiritimati(id)
          const beforeStart = new Date(
            Date.parse(outgoingStart) - 1,
          ).toISOString()
          assert.equal(await effectiveAssignment(id, beforeStart), original)
          assert.equal(
            await effectiveAssignment(id, outgoingStart),
            predecessor,
          )
          assert.equal(
            await effectiveAssignment(id, "2026-12-11T10:00:00.000Z"),
            predecessor,
          )
        },
      )
    }

    await t.test(
      "rejects a conflicting successor on an already scheduled end date",
      async () => {
        const id = await employee("ending")
        const predecessor = await assign(id, pagoPago, "2026-12-10")
        now = new Date("2026-12-10T11:00:00.000Z")
        const response = await post(`/${predecessor}/unassign`)
        assert.equal(response.status, 200, await response.clone().text())
        const { assignments } = await snapshot(id)
        assert.equal(
          assignments[0].effectiveUntil?.toISOString(),
          "2026-12-11T00:00:00.000Z",
        )

        await rejectKiritimati(id)
        assert.equal(
          await effectiveAssignment(id, "2026-12-10T11:00:00.000Z"),
          predecessor,
        )
        assert.equal(
          await effectiveAssignment(id, "2026-12-11T10:59:59.999Z"),
          predecessor,
        )
        assert.equal(
          await effectiveAssignment(id, "2026-12-11T11:00:00.000Z"),
          undefined,
        )

        const successor = await assign(id, manila, "2026-12-11")
        const after = await snapshot(id)
        assert.deepEqual(after.assignments[0], assignments[0])
        assert.equal(after.assignments[1].replacedAssignmentId, null)
        assert.equal(
          await effectiveAssignment(id, "2026-12-10T15:59:59.999Z"),
          predecessor,
        )
        assert.equal(
          await effectiveAssignment(id, "2026-12-10T16:00:00.000Z"),
          successor,
        )

        const cancelled = await post(`/${successor}/unassign`)
        assert.equal(cancelled.status, 200, await cancelled.clone().text())
        assert.deepEqual((await snapshot(id)).assignments, assignments)
        assert.equal(
          await effectiveAssignment(id, "2026-12-11T10:59:59.999Z"),
          predecessor,
        )
      },
    )

    await t.test(
      "accepts the reversed transition at its incoming midnight",
      async () => {
        const id = await employee("reversed")
        const predecessor = await assign(id, kiritimati, "2026-12-10")
        const successor = await assign(id, pagoPago, "2026-12-11")
        const {
          assignments: [first, second],
        } = await snapshot(id)
        assert.deepEqual(first.effectiveUntil, second.effectiveFrom)
        assert.equal(second.replacedAssignmentId, predecessor)
        assert.equal(
          await effectiveAssignment(id, "2026-12-09T10:00:00.000Z"),
          predecessor,
        )
        assert.equal(
          await effectiveAssignment(id, "2026-12-11T10:59:59.999Z"),
          predecessor,
        )
        assert.equal(
          await effectiveAssignment(id, "2026-12-11T11:00:00.000Z"),
          successor,
        )
      },
    )

    await t.test(
      "accepts a later Kiritimati midnight and restores the predecessor through the successor cutoff",
      async () => {
        const id = await employee("restore")
        const original = await assign(id, manila, "2026-12-02")
        const historicalSession = await prisma.attendanceWorkSession.create({
          data: {
            employeeId: id,
            startedAt: new Date("2026-12-02T01:00:00.000Z"),
            endedAt: new Date("2026-12-02T02:00:00.000Z"),
          },
          include: { workday: true },
        })
        assert.equal(historicalSession.workday.assignmentId, original)
        const predecessor = await assign(id, pagoPago, "2026-12-10")
        const beforeReplacement = await snapshot(id)
        const replacement = await assign(id, kiritimati, "2026-12-12")
        const afterReplacement = await snapshot(id)
        const assigned = afterReplacement.audit.filter(
          ({ id }) => !beforeReplacement.audit.some((row) => row.id === id),
        )
        assert.deepEqual(
          assigned.map(({ action, entityId }) => [action, entityId]).sort(),
          [
            ["INSERT", replacement],
            ["UPDATE", predecessor],
          ],
        )
        assert.ok(assigned[0].operationId)
        assert.ok(
          assigned.every(
            (row) =>
              row.actorId === admin.id &&
              row.operationId === assigned[0].operationId,
          ),
        )
        const successor = await assign(id, manila, "2026-12-13")
        const beforeCancellation = await snapshot(id)
        assert.equal(
          beforeCancellation.assignments[2].replacedAssignmentId,
          predecessor,
        )
        assert.equal(
          beforeCancellation.assignments[3].replacedAssignmentId,
          replacement,
        )
        assert.equal(
          await effectiveAssignment(id, "2026-12-11T09:59:59.999Z"),
          predecessor,
        )
        assert.equal(
          await effectiveAssignment(id, "2026-12-11T10:00:00.000Z"),
          replacement,
        )

        const response = await post(`/${replacement}/unassign`)
        assert.equal(response.status, 200, await response.clone().text())
        const afterCancellation = await snapshot(id)
        assert.deepEqual(
          afterCancellation.assignments.map(({ id }) => id),
          [original, predecessor, successor],
        )
        const [, restored, rewired] = afterCancellation.assignments
        assert.deepEqual(restored.effectiveUntil, rewired.effectiveFrom)
        assert.equal(restored.replacedAssignmentId, original)
        assert.equal(rewired.replacedAssignmentId, predecessor)
        assert.equal(rewired.replacedUntil, null)
        assert.equal(
          await effectiveAssignment(id, "2026-12-11T10:00:00.000Z"),
          predecessor,
        )
        assert.equal(
          await effectiveAssignment(id, "2026-12-12T15:59:59.999Z"),
          predecessor,
        )
        assert.equal(
          await effectiveAssignment(id, "2026-12-12T16:00:00.000Z"),
          successor,
        )

        const cancelled = afterCancellation.audit.filter(
          ({ id }) => !beforeCancellation.audit.some((row) => row.id === id),
        )
        assert.deepEqual(
          cancelled.map(({ action, entityId }) => [action, entityId]).sort(),
          [
            ["DELETE", replacement],
            ...[predecessor, successor].sort().map((id) => ["UPDATE", id]),
          ],
        )
        assert.ok(cancelled[0].operationId)
        assert.ok(
          cancelled.every(
            (row) =>
              row.actorId === admin.id &&
              row.operationId === cancelled[0].operationId,
          ),
        )
        assert.deepEqual(
          afterCancellation.audit.filter((row) => !cancelled.includes(row)),
          beforeCancellation.audit,
        )
        assert.deepEqual(
          await prisma.attendanceWorkSession.findUnique({
            where: { id: historicalSession.id },
            include: { workday: true },
          }),
          historicalSession,
        )
      },
    )
  },
)

import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { issueSession } from "../../../../src/features/auth/auth.service.js"
import type { TestContext } from "node:test"
import type { ManagementContext } from "./context.js"

/** API access, filters, unassignment, directory, verification, scope and policies. */
export async function accessAndPolicies(
  t: TestContext,
  {
    prisma,
    base,
    staff,
    admin,
    request,
    head,
    account,
    policy,
    submit,
    superadmin,
    other,
    days,
    session,
  }: ManagementContext,
) {
  await t.test(
    "[PG-010-F001-A001-T003] correction API authentication is independent of route access",
    async () => {
      const basicUser = await prisma.user.create({
        data: {
          email: "pg010-api-basic-user@management.test",
          fullName: "PG-010 Basic User",
          role: "USER",
          passwordHash: "test-only",
        },
      })
      const userToken = (await issueSession(basicUser)).token
      const before = await prisma.attendanceAdjustment.count()
      const path = "/attendance/adjustments?scope=mine&type=CORRECTION"
      const anonymous = await fetch(`${base}${path}`)
      assert.equal(anonymous.status, 401)
      const invalidSession = await fetch(`${base}${path}`, {
        headers: { authorization: "Bearer not-a-valid-token" },
      })
      assert.equal(invalidSession.status, 401)
      const userRead = await fetch(`${base}${path}`, {
        headers: { authorization: `Bearer ${userToken}` },
      })
      assert.equal(userRead.status, 403)

      for (const actor of [staff, admin]) {
        const allowed = await request(
          actor,
          "/adjustments?scope=mine&type=CORRECTION",
        )
        assert.equal(allowed.status, 200, await allowed.clone().text())
      }

      const forbiddenCreate = await fetch(`${base}/attendance/adjustments`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${userToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requestKey: randomUUID(),
          startedAt: "2026-11-12T09:00:00+08:00",
          endedAt: "2026-11-12T10:00:00+08:00",
          reason: "Unauthorized correction request",
        }),
      })
      assert.equal(forbiddenCreate.status, 403)
      assert.equal(await prisma.attendanceAdjustment.count(), before)
    },
  )

  await t.test(
    "[PG-010-F001-A014-T018] adjustment API rejects unsupported filters and malformed inputs without writes",
    async () => {
      const before = await prisma.attendanceAdjustment.count()
      const invalidQueries = [
        "/adjustments?scope=organization",
        "/adjustments?page=0",
        "/adjustments?page=1.5",
        "/adjustments?page=100001",
        `/adjustments?search=${"x".repeat(101)}`,
        "/adjustments?type=LEAVE",
        "/adjustments?status=CANCELLED",
        "/adjustments?status=PENDING&status=REJECTED",
        "/adjustments?unknown=1",
      ]
      for (const path of invalidQueries) {
        const response = await request(staff, path)
        assert.equal(response.status, 400, `${path}: ${await response.text()}`)
      }

      const malformedDetail = await request(
        head,
        "/adjustments/not-a-valid-id!",
      )
      assert.equal(malformedDetail.status, 400)

      const invalidBodies = [
        {
          requestKey: randomUUID(),
          startedAt: "2026-11-12T09:00:00",
          endedAt: "2026-11-12T10:00:00+08:00",
          reason: "Timestamp without an offset",
        },
        {
          requestKey: randomUUID(),
          startedAt: "2026-11-12T09:00:00+08:00",
          endedAt: "2026-11-12T10:00:00+08:00",
          reason: "Extra employee field",
          employeeId: staff.employee.id,
        },
      ]
      for (const body of invalidBodies) {
        const response = await request(staff, "/adjustments", body)
        assert.equal(response.status, 400, await response.text())
      }

      const unknownSession = await request(staff, "/adjustments", {
        requestKey: randomUUID(),
        sessionId: "missing-session-id",
        startedAt: "2026-11-12T09:00:00+08:00",
        endedAt: "2026-11-12T10:00:00+08:00",
        reason: "Unknown session reference",
      })
      assert.equal(unknownSession.status, 404)
      assert.equal(await prisma.attendanceAdjustment.count(), before)
    },
  )

  await t.test(
    "unassign requires policy administration and preserves history",
    async () => {
      const person = await account("unassign", "STAFF")
      const assignment =
        await prisma.attendancePolicyAssignment.findFirstOrThrow({
          where: { employeeId: person.employee.id },
        })
      const path = `/assignments/${assignment.id}/unassign`
      assert.equal((await request(staff, path, {})).status, 403)
      assert.equal((await request(head, path, {})).status, 403)
      assert.equal((await request(admin, path, {})).status, 200)
      const ended = await prisma.attendancePolicyAssignment.findUniqueOrThrow({
        where: { id: assignment.id },
      })
      assert.equal(
        ended.effectiveUntil?.toISOString().slice(0, 10),
        "2026-11-15",
      )
      assert.equal((await request(admin, path, {})).status, 409)
      const scheduled = await prisma.attendancePolicyAssignment.create({
        data: {
          employeeId: person.employee.id,
          policyId: policy.id,
          effectiveFrom: new Date("2026-11-16"),
        },
      })
      assert.equal(
        (await request(admin, `/assignments/${scheduled.id}/unassign`, {}))
          .status,
        200,
      )
      assert.equal(
        await prisma.attendancePolicyAssignment.findUnique({
          where: { id: scheduled.id },
        }),
        null,
      )
    },
  )

  await t.test(
    "attendance directory resolves legacy email names from the linked account",
    async () => {
      const person = await account("Display Name", "STAFF")
      await prisma.employee.update({
        where: { id: person.employee.id },
        data: { fullName: "legacy@example.test" },
      })
      const response = await request(admin, "/employees?search=legacy")
      assert.equal(response.status, 200)
      const body = (await response.json()) as {
        employees: { id: string; fullName: string; user?: unknown }[]
      }
      const employee = body.employees.find(
        (item) => item.id === person.employee.id,
      )
      assert.equal(employee?.fullName, "Display Name")
      assert.equal(employee?.user, undefined)
    },
  )

  await t.test(
    "corrections require Head verification before HR visibility and allow Superadmin override",
    async () => {
      const person = await account("staged-correction", "STAFF")
      const created = await submit(person, "")
      const path = `/adjustments/${created.adjustment.id}/review`
      for (const decision of ["APPROVED", "REJECTED"])
        assert.equal(
          (
            await request(admin, path, {
              decision,
              note: "Premature HR decision",
            })
          ).status,
          403,
        )
      const pending = (await (
        await request(admin, "/adjustments?scope=team&status=PENDING")
      ).json()) as { total: number }
      assert.equal(pending.total, 0)
      const summary = (await (
        await request(admin, "/adjustments/overview?scope=team")
      ).json()) as { groups: { status: string }[] }
      assert.ok(summary.groups.every((group) => group.status !== "PENDING"))
      assert.equal(
        (
          await request(head, path, {
            decision: "APPROVED",
            note: "Department verifies correction",
          })
        ).status,
        200,
      )
      assert.equal(
        await prisma.attendanceWorkSession.count({
          where: { employeeId: person.employee.id },
        }),
        0,
      )
      const queue = (await (
        await request(admin, "/adjustments?scope=team&status=VERIFIED")
      ).json()) as { adjustments: { id: string }[] }
      assert.ok(
        queue.adjustments.some((item) => item.id === created.adjustment.id),
      )
      assert.equal(
        (
          await request(admin, path, {
            decision: "APPROVED",
            note: "HR final correction approval",
          })
        ).status,
        200,
      )
      assert.equal(
        await prisma.attendanceWorkSession.count({
          where: { employeeId: person.employee.id },
        }),
        1,
      )
      const overridePerson = await account("override-correction", "STAFF")
      const direct = await submit(overridePerson, "")
      assert.equal(
        (
          await request(
            superadmin,
            `/adjustments/${direct.adjustment.id}/review`,
            {
              decision: "APPROVED",
              note: "Superadmin final correction approval",
            },
          )
        ).status,
        200,
      )
      assert.equal(
        await prisma.attendanceWorkSession.count({
          where: { employeeId: overridePerson.employee.id },
        }),
        1,
      )
    },
  )

  await t.test(
    "records and summaries are scoped to the current department head",
    async () => {
      assert.equal((await request(staff, "/employees")).status, 403)
      const list = await request(head, "/employees")
      assert.equal(list.status, 200)
      const employees = ((await list.json()) as { employees: { id: string }[] })
        .employees
      assert.ok(employees.some((item) => item.id === staff.employee.id))
      assert.ok(!employees.some((item) => item.id === other.employee.id))
      assert.equal(
        (await request(head, `/employees/${staff.employee.id}/history`)).status,
        200,
      )
      assert.equal(
        (await request(head, `/employees/${other.employee.id}/history`)).status,
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
      const next = ((await created.json()) as { policy: { id: string } }).policy
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
}

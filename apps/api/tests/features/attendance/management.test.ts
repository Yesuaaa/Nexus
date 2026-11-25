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
    const superadmin = await account("superadmin", "SUPERADMIN")
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
          assert.equal(
            response.status,
            400,
            `${path}: ${await response.text()}`,
          )
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
        const ended = await prisma.attendancePolicyAssignment.findUniqueOrThrow(
          { where: { id: assignment.id } },
        )
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

        const whitespaceBaseline = await prisma.attendanceAdjustment.count({
          where: { requestedById: staff.user.id },
        })
        const whitespaceOnly = await request(staff, "/adjustments", {
          requestKey: randomUUID(),
          startedAt: "2026-11-12T09:00:00+08:00",
          endedAt: "2026-11-12T10:00:00+08:00",
          reason: "     ",
        })
        assert.equal(whitespaceOnly.status, 400)
        assert.equal(
          await prisma.attendanceAdjustment.count({
            where: { requestedById: staff.user.id },
          }),
          whitespaceBaseline,
        )
        const paddedReason = await request(staff, "/adjustments", {
          requestKey: randomUUID(),
          startedAt: "2026-11-12T09:00:00+08:00",
          endedAt: "2026-11-12T10:00:00+08:00",
          reason: "  Valid correction context  ",
        })
        assert.equal(
          paddedReason.status,
          201,
          await paddedReason.clone().text(),
        )
        assert.equal(
          (
            (await paddedReason.json()) as {
              adjustment: { reason: string }
            }
          ).adjustment.reason,
          "Valid correction context",
        )

        const invalidBaseline = await prisma.attendanceAdjustment.count({
          where: { requestedById: staff.user.id },
        })
        const invalidRequests = [
          {
            requestKey: randomUUID(),
            startedAt: "2026-11-12T10:00:00+08:00",
            endedAt: "2026-11-12T09:00:00+08:00",
            reason: "Reversed correction interval",
            expected: 400,
          },
          {
            requestKey: randomUUID(),
            startedAt: "2026-11-15T09:00:00+08:00",
            endedAt: "2026-11-15T10:00:00+08:00",
            reason: "Future correction interval",
            expected: 400,
          },
          {
            requestKey: randomUUID(),
            startedAt: "2026-11-13T10:00:00+08:00",
            endedAt: "2026-11-13T11:00:00+08:00",
            reason: "Overlapping correction interval",
            expected: 409,
          },
        ] as const
        for (const { expected, ...body } of invalidRequests) {
          const response = await request(staff, "/adjustments", body)
          assert.equal(
            response.status,
            expected,
            `${body.reason}: ${await response.clone().text()}`,
          )
        }
        assert.equal(
          await prisma.attendanceAdjustment.count({
            where: { requestedById: staff.user.id },
          }),
          invalidBaseline,
        )

        // PG-006-F001-A010-T021 extends this existing PGlite request test
        // with the API's inclusive reason-length boundaries.
        const priorCount = await prisma.attendanceAdjustment.count({
          where: { requestedById: staff.user.id },
        })
        for (const [length, expectedStatus] of [
          [4, 400],
          [5, 201],
          [2000, 201],
          [2001, 400],
        ] as const) {
          const reason = "x".repeat(length)
          const boundary = await request(staff, "/adjustments", {
            requestKey: randomUUID(),
            startedAt: "2026-11-12T09:00:00+08:00",
            endedAt: "2026-11-12T10:00:00+08:00",
            reason,
          })
          assert.equal(
            boundary.status,
            expectedStatus,
            `reason length ${length}: ${await boundary.clone().text()}`,
          )
          if (expectedStatus === 201) {
            const body = (await boundary.json()) as {
              adjustment: { reason: string }
            }
            assert.equal(body.adjustment.reason, reason)
          }
        }
        assert.equal(
          await prisma.attendanceAdjustment.count({
            where: { requestedById: staff.user.id },
          }),
          priorCount + 2,
        )

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
          "2026-11-13T09:00:00.000Z",
        )
        assert.equal(
          (
            await request(
              admin,
              `/adjustments/${created.adjustment.id}/review`,
              {
                decision: "APPROVED",
                note: "HR final approval after verification",
              },
            )
          ).status,
          200,
        )
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
      "[PG-010-F001-A016-T022] one active correction is allowed per attendance session",
      async () => {
        const subject = await account(
          `pg010-duplicate-${randomUUID()}`,
          "STAFF",
        )
        const target = await prisma.attendanceWorkSession.create({
          data: {
            employeeId: subject.employee.id,
            startedAt: new Date("2026-11-13T09:00:00+08:00"),
            endedAt: new Date("2026-11-13T10:00:00+08:00"),
          },
        })
        const firstBody = {
          requestKey: randomUUID(),
          sessionId: target.id,
          startedAt: "2026-11-13T09:00:00+08:00",
          endedAt: "2026-11-13T10:00:00+08:00",
          reason: "Correct this completed attendance session",
        }
        const first = await request(subject, "/adjustments", firstBody)
        assert.equal(first.status, 201, await first.clone().text())
        const firstId = ((await first.json()) as { adjustment: { id: string } })
          .adjustment.id

        const duplicate = await request(subject, "/adjustments", {
          ...firstBody,
          requestKey: randomUUID(),
        })
        assert.equal(duplicate.status, 409)
        assert.equal(
          ((await duplicate.json()) as { error: string }).error,
          "This session already has a pending correction",
        )
        const rows = await prisma.attendanceAdjustment.findMany({
          where: {
            sessionId: target.id,
            type: "CORRECTION",
            status: { in: ["PENDING", "VERIFIED"] },
          },
        })
        assert.equal(rows.length, 1)
        assert.equal(rows[0].id, firstId)
        assert.equal(rows[0].status, "PENDING")
        assert.equal(rows[0].requestedById, subject.user.id)
        assert.deepEqual(
          await prisma.attendanceWorkSession.findUniqueOrThrow({
            where: { id: target.id },
          }),
          target,
        )
      },
    )

    await t.test(
      "[PG-010-F001-A020-T027] HR finalizes only pending corrections without an independent Head",
      async () => {
        async function departmentCase(name: string, selfHead: boolean) {
          const unit = await prisma.department.create({
            data: { name: `PG-010 ${name} ${randomUUID()}` },
          })
          const subject = await account(
            `pg010-${name}-${randomUUID()}`,
            "STAFF",
            unit.id,
          )
          const independent = selfHead
            ? null
            : await account(`pg010-head-${randomUUID()}`, "STAFF", unit.id)
          await prisma.department.update({
            where: { id: unit.id },
            data: { headId: (independent ?? subject).user.id },
          })
          const created = await request(subject, "/adjustments", {
            requestKey: randomUUID(),
            startedAt: "2026-11-12T09:00:00+08:00",
            endedAt: "2026-11-12T10:00:00+08:00",
            reason: `Pending request for ${name}`,
          })
          assert.equal(created.status, 201, await created.clone().text())
          return {
            id: ((await created.json()) as { adjustment: { id: string } })
              .adjustment.id,
            subject,
          }
        }

        const normal = await departmentCase("independent-head", false)
        const hrListPath =
          "/adjustments?scope=team&type=CORRECTION&status=PENDING"
        const normalList = await request(admin, hrListPath)
        assert.equal(normalList.status, 200, await normalList.clone().text())
        const normalRows = (
          (await normalList.json()) as { adjustments: { id: string }[] }
        ).adjustments
        assert.equal(
          normalRows.some(({ id }) => id === normal.id),
          false,
        )
        const premature = await request(
          admin,
          `/adjustments/${normal.id}/review`,
          { decision: "APPROVED", note: "Head review is still required" },
        )
        assert.equal(premature.status, 403)
        assert.equal(
          (
            await prisma.attendanceAdjustment.findUniqueOrThrow({
              where: { id: normal.id },
            })
          ).status,
          "PENDING",
        )

        const exception = await departmentCase("self-head", true)
        const exceptionList = await request(admin, hrListPath)
        assert.equal(
          exceptionList.status,
          200,
          await exceptionList.clone().text(),
        )
        const exceptionRows = (
          (await exceptionList.json()) as { adjustments: { id: string }[] }
        ).adjustments
        assert.equal(
          exceptionRows.some(({ id }) => id === exception.id),
          true,
        )
        const final = await request(
          admin,
          `/adjustments/${exception.id}/review`,
          { decision: "APPROVED", note: "No independent active Head exists" },
        )
        assert.equal(final.status, 200, await final.clone().text())
        assert.equal(
          (
            await prisma.attendanceAdjustment.findUniqueOrThrow({
              where: { id: exception.id },
            })
          ).status,
          "APPROVED",
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
          superadmin,
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
          (
            await request(
              admin,
              `/adjustments/${missing.adjustment.id}/review`,
              {
                decision: "APPROVED",
                note: "HR confirms missing attendance",
              },
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
      "attendance audit search covers scoped event and identity fields before pagination",
      async () => {
        await prisma.attendanceAudit.createMany({
          data: [
            ...Array.from({ length: 12 }, (_, index) => ({
              entityType: "AttendanceWorkSession",
              entityId: `searchable-${index}`,
              employeeId: staff.employee.id,
              actorId: admin.user.id,
              action: "SEARCHABLE_ACTION",
              reason: `SeriesNeedle ${index}`,
              actionId: randomUUID(),
              createdAt: new Date(
                `2026-11-13T12:${String(index).padStart(2, "0")}:00Z`,
              ),
            })),
            {
              entityType: "AttendanceWorkSession",
              entityId: "searchable-outside",
              employeeId: other.employee.id,
              actorId: admin.user.id,
              action: "SEARCHABLE_ACTION",
              reason: "SeriesNeedle outside department",
              actionId: randomUUID(),
              createdAt: new Date("2026-11-13T12:30:00Z"),
            },
            {
              entityType: "AttendanceWorkSession",
              entityId: "searchable-next-day",
              employeeId: staff.employee.id,
              actorId: admin.user.id,
              action: "SEARCHABLE_ACTION",
              reason: "SeriesNeedle next day",
              actionId: randomUUID(),
              createdAt: new Date("2026-11-14T12:00:00Z"),
            },
          ],
        })
        const dateQuery = "from=2026-11-13&to=2026-11-13"
        for (const term of [
          "staff",
          "MGMT-staff",
          "admin",
          "admin@management.test",
          admin.user.id,
          "SEARCHABLE_ACTION",
          "AttendanceWorkSession",
          "Needle",
        ]) {
          const response = await request(
            head,
            `/audit?${dateQuery}&search=${encodeURIComponent(term)}`,
          )
          assert.equal(response.status, 200, await response.clone().text())
          const result = (await response.json()) as {
            total: number
            events: {
              actor: Record<string, unknown> | null
              employee: Record<string, unknown> | null
            }[]
          }
          assert.equal(result.total, 12, `search term: ${term}`)
          assert.equal(result.events.length, 10, `search term: ${term}`)
          assert.deepEqual(Object.keys(result.events[0]!.actor ?? {}), [
            "fullName",
          ])
          assert.deepEqual(Object.keys(result.events[0]!.employee ?? {}), [
            "fullName",
          ])
        }

        const firstPage = (await (
          await request(head, `/audit?${dateQuery}&search=SeriesNeedle`)
        ).json()) as {
          total: number
          page: number
          pageSize: number
          events: unknown[]
          actionCounts: { count: number }[]
        }
        const secondPageResponse = await request(
          head,
          `/audit?${dateQuery}&search=SeriesNeedle&page=2`,
        )
        assert.equal(secondPageResponse.status, 200)
        const secondPage = (await secondPageResponse.json()) as {
          total: number
          page: number
          events: unknown[]
          actionCounts: { count: number }[]
        }
        assert.equal(firstPage.total, 12)
        assert.equal(firstPage.page, 1)
        assert.equal(firstPage.pageSize, 10)
        assert.equal(firstPage.events.length, 10)
        assert.equal(secondPage.total, 12)
        assert.equal(secondPage.page, 2)
        assert.equal(secondPage.events.length, 2)
        assert.equal(
          firstPage.actionCounts.reduce((sum, row) => sum + row.count, 0),
          12,
        )
        const scopedAdmin = await request(
          admin,
          `/audit?${dateQuery}&departmentId=${department.id}&search=SeriesNeedle`,
        )
        assert.equal(scopedAdmin.status, 200)
        assert.equal(
          ((await scopedAdmin.json()) as { total: number }).total,
          12,
        )
        const unrestrictedAdmin = await request(
          admin,
          `/audit?${dateQuery}&search=SeriesNeedle`,
        )
        assert.equal(unrestrictedAdmin.status, 200)
        assert.equal(
          ((await unrestrictedAdmin.json()) as { total: number }).total,
          13,
        )
        assert.equal(
          (
            await request(
              head,
              `/audit?${dateQuery}&departmentId=${outside.id}&search=SeriesNeedle`,
            )
          ).status,
          403,
        )
        const missing = await request(
          head,
          `/audit?${dateQuery}&search=does-not-exist`,
        )
        assert.equal(missing.status, 200)
        assert.equal(((await missing.json()) as { total: number }).total, 0)

        // PG-005-F001-A010-T017: UTC interval, stable tie order, and projection.
        const boundaryEvent = (id: string, createdAt: string) => ({
          id,
          entityType: "AttendanceWorkSession",
          entityId: id,
          employeeId: staff.employee.id,
          actorId: admin.user.id,
          action: "BOUNDARY_CHECK",
          reason: "BoundaryMarker",
          actionId: randomUUID(),
          createdAt: new Date(createdAt),
          operationId: randomUUID(),
          correlationId: randomUUID(),
          actorRoleAtTime: "ADMIN" as const,
        })
        await prisma.attendanceAudit.createMany({
          data: [
            boundaryEvent("boundary-start", "2026-11-13T00:00:00.000Z"),
            boundaryEvent("boundary-tie-a", "2026-11-13T12:00:00.000Z"),
            boundaryEvent("boundary-tie-z", "2026-11-13T12:00:00.000Z"),
            boundaryEvent("boundary-end", "2026-11-13T23:59:59.999Z"),
            boundaryEvent("boundary-outside", "2026-11-14T00:00:00.000Z"),
          ],
        })
        const boundaryResponse = await request(
          head,
          "/audit?from=2026-11-13&to=2026-11-13&search=BoundaryMarker",
        )
        assert.equal(boundaryResponse.status, 200)
        const boundaryResult = (await boundaryResponse.json()) as {
          total: number
          events: {
            id: string
            operationId?: unknown
            correlationId?: unknown
            actorRoleAtTime?: unknown
            actor: Record<string, unknown> | null
            employee: Record<string, unknown> | null
          }[]
        }
        assert.equal(boundaryResult.total, 4)
        assert.deepEqual(
          boundaryResult.events.map((event) => event.id),
          [
            "boundary-end",
            "boundary-tie-z",
            "boundary-tie-a",
            "boundary-start",
          ],
        )
        const projected = boundaryResult.events.find(
          (event) => event.id === "boundary-tie-z",
        )
        assert.ok(projected)
        assert.equal("operationId" in projected, false)
        assert.equal("correlationId" in projected, false)
        assert.equal("actorRoleAtTime" in projected, false)
        assert.deepEqual(Object.keys(projected.actor ?? {}), ["fullName"])
        assert.deepEqual(Object.keys(projected.employee ?? {}), ["fullName"])
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
          total: number
          pageSize: number
          events: {
            employeeId: string
            entityType: string
            action: string
            before: unknown
            after: unknown
          }[]
        }
        const auditEvents = [...trail.events]
        for (
          let page = 2;
          page <= Math.ceil(trail.total / trail.pageSize);
          page += 1
        ) {
          const pageResponse = await request(head, `/audit?page=${page}`)
          assert.equal(pageResponse.status, 200)
          auditEvents.push(
            ...((await pageResponse.json()) as typeof trail).events,
          )
        }
        assert.ok(auditEvents.length)
        assert.ok(
          auditEvents.every((entry) => entry.employeeId !== other.employee.id),
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
              await request(superadmin, `/adjustments/${item.id}/review`, {
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
    await t.test(
      "request summaries count all rows and preserve scope and status filtering",
      async () => {
        for (let index = 0; index < 27; index += 1) {
          await prisma.attendanceAdjustment.create({
            data: {
              employeeId: other.employee.id,
              requestedById: other.user.id,
              requestKey: randomUUID(),
              type: "CORRECTION",
              status: "PENDING",
              reason: "Outside department request",
              proposedStartedAt: new Date("2026-11-12T01:00:00Z"),
              proposedEndedAt: new Date("2026-11-12T02:00:00Z"),
            },
          })
        }
        assert.equal(
          (await request(staff, "/adjustments/overview?scope=team")).status,
          403,
        )
        assert.equal(
          (await request(head, "/adjustments/overview?scope=team")).status,
          403,
        )
        assert.equal(
          (await request(admin, "/adjustments/overview?scope=invalid")).status,
          400,
        )
        assert.equal(
          (await request(admin, "/adjustments?status=invalid")).status,
          400,
        )
        const summaryUser = await account("summary-user", "USER")
        const anonymous = await fetch(
          base + "/attendance/adjustments/overview?scope=mine",
        )
        assert.equal(anonymous.status, 401)
        const unsupportedRole = await request(
          summaryUser,
          "/adjustments/overview?scope=mine",
        )
        assert.equal(unsupportedRole.status, 403)
        const unknownQuery = await request(
          other,
          "/adjustments/overview?scope=mine&unexpected=true",
        )
        assert.equal(unknownQuery.status, 400)
        const deniedBody = (await unsupportedRole.json()) as Record<
          string,
          unknown
        >
        assert.equal("groups" in deniedBody, false)
        const anonymousBody = (await anonymous.json()) as Record<
          string,
          unknown
        >
        assert.equal("groups" in anonymousBody, false)

        const result = await request(other, "/adjustments/overview?scope=mine")
        assert.equal(result.status, 200)
        const summary = (await result.json()) as {
          groups: {
            type: string
            status: string
            count: number
            overtimeMinutes: number
            awaitingHrPending: number
          }[]
        }
        const pendingCorrection = summary.groups.find(
          (group) => group.type === "CORRECTION" && group.status === "PENDING",
        )
        assert.ok(pendingCorrection)
        assert.deepEqual(Object.keys(pendingCorrection).sort(), [
          "awaitingHrPending",
          "count",
          "overtimeMinutes",
          "status",
          "type",
        ])
        assert.deepEqual(
          {
            type: pendingCorrection.type,
            status: pendingCorrection.status,
            count: pendingCorrection.count,
            overtimeMinutes: pendingCorrection.overtimeMinutes,
            awaitingHrPending: pendingCorrection.awaitingHrPending,
          },
          {
            type: "CORRECTION",
            status: "PENDING",
            count: 27,
            overtimeMinutes: 0,
            awaitingHrPending: 27,
          },
        )
        // PG-013-F001-A014-T002: omission defaults to the personal scope.
        const omittedScope = await request(other, "/adjustments/overview")
        assert.equal(omittedScope.status, 200)
        assert.deepEqual(await omittedScope.json(), summary)

        await prisma.department.update({
          where: { id: department.id },
          data: { headId: head.user.id },
        })
        const scoped = (await (
          await request(head, "/adjustments/overview?scope=team")
        ).json()) as typeof summary
        const expected = await prisma.attendanceAdjustment.count({
          where: { employee: { departmentId: department.id } },
        })
        assert.equal(
          scoped.groups.reduce((sum, g) => sum + g.count, 0),
          expected,
        )
        const filtered = (await (
          await request(
            admin,
            "/adjustments?scope=team&type=CORRECTION&status=REJECTED",
          )
        ).json()) as {
          adjustments: { type: string; status: string }[]
          total: number
        }
        assert.equal(
          filtered.total,
          await prisma.attendanceAdjustment.count({
            where: { type: "CORRECTION", status: "REJECTED" },
          }),
        )
        assert.ok(
          filtered.adjustments.every(
            (g) => g.type === "CORRECTION" && g.status === "REJECTED",
          ),
        )
      },
    )
    await t.test(
      "check-in overview counts sessions and breaks and scopes recent overnight activity",
      async () => {
        const closed = await account("checkin-closed", "STAFF")
        const working = await account("checkin-working", "STAFF")
        const paused = await account("checkin-paused", "STAFF")
        const suspended = await account("checkin-suspended", "STAFF")
        await prisma.attendanceWorkSession.create({
          data: {
            employeeId: closed.employee.id,
            startedAt: new Date("2026-11-10T09:00:00+08:00"),
            endedAt: new Date("2026-11-10T10:00:00+08:00"),
          },
        })
        const overnight = await prisma.attendanceWorkSession.create({
          data: {
            employeeId: closed.employee.id,
            startedAt: new Date("2026-11-10T20:00:00+08:00"),
            endedAt: new Date("2026-11-11T04:00:00+08:00"),
          },
        })
        await prisma.attendanceBreak.create({
          data: {
            sessionId: overnight.id,
            startedAt: new Date("2026-11-10T22:00:00+08:00"),
            endedAt: new Date("2026-11-10T22:30:00+08:00"),
            isPaid: false,
          },
        })
        await prisma.attendanceWorkSession.create({
          data: {
            employeeId: working.employee.id,
            startedAt: new Date("2026-11-10T10:00:00+08:00"),
          },
        })
        const open = await prisma.attendanceWorkSession.create({
          data: {
            employeeId: paused.employee.id,
            startedAt: new Date("2026-11-10T11:00:00+08:00"),
          },
        })
        await prisma.attendanceBreak.create({
          data: {
            sessionId: open.id,
            startedAt: new Date("2026-11-10T12:00:00+08:00"),
            isPaid: false,
          },
        })
        const suspendedSession = await prisma.attendanceWorkSession.create({
          data: {
            employeeId: suspended.employee.id,
            startedAt: new Date("2026-11-10T07:00:00+08:00"),
            suspendedAt: new Date("2026-11-10T08:00:00+08:00"),
          },
        })
        await prisma.attendanceBreak.create({
          data: {
            sessionId: suspendedSession.id,
            startedAt: new Date("2026-11-10T07:30:00+08:00"),
            isPaid: false,
          },
        })
        await prisma.attendanceWorkSession.create({
          data: {
            employeeId: other.employee.id,
            startedAt: new Date("2026-11-10T13:00:00+08:00"),
            endedAt: new Date("2026-11-10T14:00:00+08:00"),
          },
        })
        type Summary = {
          checkIns: {
            employees: number
            total: number
            closed: number
            working: number
            onBreak: number
            suspended: number
            recentActivity: {
              id: string
              action: string
              at: string
              employeeName: string
            }[]
          }
        }
        const response = await request(
          head,
          "/overview?from=2026-11-10&to=2026-11-10",
        )
        assert.equal(response.status, 200)
        const { checkIns } = (await response.json()) as Summary
        assert.deepEqual(
          { ...checkIns, recentActivity: undefined },
          {
            employees: 4,
            total: 5,
            closed: 2,
            working: 1,
            onBreak: 1,
            suspended: 1,
            recentActivity: undefined,
          },
        )
        assert.equal(checkIns.recentActivity.length, 8)
        assert.ok(
          checkIns.recentActivity.every(
            (event) => event.employeeName !== other.employee.fullName,
          ),
        )
        assert.equal(checkIns.recentActivity[0].at, "2026-11-10T20:00:00.000Z")
        assert.equal(checkIns.recentActivity[0].action, "CLOCK_OUT")
        assert.ok(
          checkIns.recentActivity.some(
            (event) => event.action === "BREAK_START",
          ),
        )
        assert.ok(
          checkIns.recentActivity.some((event) => event.action === "BREAK_END"),
        )
        for (let index = 1; index < checkIns.recentActivity.length; index++)
          assert.ok(
            Date.parse(checkIns.recentActivity[index - 1].at) >=
              Date.parse(checkIns.recentActivity[index].at),
          )
        const empty = (await (
          await request(head, "/overview?from=2026-11-09&to=2026-11-09")
        ).json()) as Summary
        assert.deepEqual(empty.checkIns, {
          employees: 0,
          total: 0,
          closed: 0,
          working: 0,
          onBreak: 0,
          suspended: 0,
          recentActivity: [],
        })
        assert.equal(
          (await request(staff, "/overview?from=2026-11-10&to=2026-11-10"))
            .status,
          403,
        )
      },
    )
    await t.test(
      "record audit summaries filter before pagination and preserve department boundaries",
      async () => {
        const latest = await prisma.attendanceAudit.findFirstOrThrow({
          orderBy: { createdAt: "desc" },
        })
        const date = latest.createdAt.toISOString().slice(0, 10)
        const from = new Date(date + "T00:00:00Z"),
          to = new Date(from.getTime() + 86400000)
        const query = "?from=" + date + "&to=" + date + "&recordsOnly=true"
        const response = await request(head, "/audit" + query)
        assert.equal(response.status, 200)
        type Audit = {
          total: number
          events: {
            entityType: string
            employeeId: string | null
            createdAt: string
          }[]
          actionCounts: { action: string; count: number }[]
        }
        const result = (await response.json()) as Audit
        const types = [
          "AttendanceWorkday",
          "AttendanceWorkSession",
          "AttendanceBreak",
        ]
        const where = {
          entityType: { in: types },
          createdAt: { gte: from, lt: to },
          employee: { is: { departmentId: department.id } },
        }
        assert.equal(
          result.total,
          await prisma.attendanceAudit.count({ where }),
        )
        assert.ok(result.total > result.events.length)
        assert.equal(
          result.actionCounts.reduce((sum, row) => sum + row.count, 0),
          result.total,
        )
        assert.ok(
          result.events.every(
            (event) =>
              types.includes(event.entityType) &&
              event.employeeId !== other.employee.id,
          ),
        )
        const grouped = await prisma.attendanceAudit.groupBy({
          by: ["action"],
          where,
          _count: { _all: true },
          orderBy: { action: "asc" },
        })
        assert.deepEqual(
          result.actionCounts,
          grouped.map((row) => ({
            action: row.action,
            count: row._count._all,
          })),
        )
        const all = (await (
          await request(admin, "/audit?from=" + date + "&to=" + date)
        ).json()) as Audit
        const records = (await (
          await request(admin, "/audit" + query)
        ).json()) as Audit
        assert.ok(all.total > records.total)
        assert.equal((await request(staff, "/audit" + query)).status, 403)
        assert.equal(
          (await request(head, "/audit?recordsOnly=false")).status,
          400,
        )
        assert.equal(
          (await request(head, "/audit?recordsOnly[]=true")).status,
          400,
        )
        assert.equal(
          (await request(head, "/records?recordsOnly=true")).status,
          400,
        )
        const empty = (await (
          await request(
            head,
            "/audit?from=2020-01-01&to=2020-01-01&recordsOnly=true",
          )
        ).json()) as Audit
        assert.equal(empty.total, 0)
        assert.deepEqual(empty.actionCounts, [])
        await prisma.department.update({
          where: { id: department.id },
          data: { headId: null },
        })
        assert.equal((await request(head, "/audit" + query)).status, 403)
      },
    )
    await t.test(
      "personal overview derives identity from the session and rejects scope overrides",
      async () => {
        const response = await request(
          staff,
          "/me/overview?from=2026-11-13&to=2026-11-13",
        )
        assert.equal(response.status, 200)
        const data = (await response.json()) as {
          scope: string
          checkIns: {
            total: number
            employees: number
            recentActivity: { employeeName: string }[]
          }
        }
        assert.equal(data.scope, "PERSONAL")
        assert.equal(
          data.checkIns.total,
          await prisma.attendanceWorkSession.count({
            where: {
              employeeId: staff.employee.id,
              workday: { workDate: new Date("2026-11-13") },
            },
          }),
        )
        assert.equal(data.checkIns.employees, 1)
        assert.ok(
          data.checkIns.recentActivity.every(
            (event) => event.employeeName === staff.employee.fullName,
          ),
        )
        const own = await request(
          admin,
          "/me/overview?from=2026-11-13&to=2026-11-13",
        )
        assert.equal(own.status, 200)
        const adminData = (await own.json()) as typeof data
        assert.equal(adminData.checkIns.total, 0)
        assert.equal(
          (await request(staff, "/me/overview?departmentId=" + outside.id))
            .status,
          400,
        )
        assert.equal(
          (await request(staff, "/me/overview?employeeId=" + other.employee.id))
            .status,
          400,
        )

        // PG-007-F001-A011-T016 additive authorization assertions.
        const anonymous = await fetch(
          `${base}/attendance/me/overview?from=2026-11-13&to=2026-11-13`,
        )
        assert.equal(anonymous.status, 401)
        const anonymousBody = (await anonymous.json()) as {
          scope?: unknown
          checkIns?: unknown
        }
        assert.equal("scope" in anonymousBody, false)
        assert.equal("checkIns" in anonymousBody, false)

        const basicUser = await prisma.user.create({
          data: {
            email: "pg007-overview-user@management.test",
            fullName: "PG-007 basic user",
            role: "USER",
            passwordHash: "test-only",
          },
        })
        const basicUserToken = (await issueSession(basicUser)).token
        const forbidden = await fetch(
          `${base}/attendance/me/overview?from=2026-11-13&to=2026-11-13`,
          { headers: { authorization: `Bearer ${basicUserToken}` } },
        )
        assert.equal(forbidden.status, 403)
        const forbiddenBody = (await forbidden.json()) as {
          scope?: unknown
          checkIns?: unknown
        }
        assert.equal("scope" in forbiddenBody, false)
        assert.equal("checkIns" in forbiddenBody, false)
      },
    )
    await t.test(
      "[PG-007-F001-A011-T017] personal overview requires a linked Employee without creating one",
      async () => {
        const profileless = await prisma.user.create({
          data: {
            email: "pg007-profileless-admin@management.test",
            fullName: "PG-007 profileless admin",
            role: "ADMIN",
            passwordHash: "test-only",
          },
        })
        const token = (await issueSession(profileless)).token
        const adjustmentCount = await prisma.attendanceAdjustment.count()
        const correctionList = await fetch(
          `${base}/attendance/adjustments?scope=team&type=CORRECTION`,
          { headers: { authorization: `Bearer ${token}` } },
        )
        assert.equal(
          correctionList.status,
          200,
          await correctionList.clone().text(),
        )
        assert.equal(
          (
            (await correctionList.json()) as {
              capabilities: { requestCorrection: boolean }
            }
          ).capabilities.requestCorrection,
          false,
        )
        const createCorrection = await fetch(`${base}/attendance/adjustments`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            requestKey: randomUUID(),
            startedAt: "2026-11-12T09:00:00+08:00",
            endedAt: "2026-11-12T10:00:00+08:00",
            reason: "Profileless administrator request",
          }),
        })
        assert.equal(createCorrection.status, 409)
        assert.equal(await prisma.attendanceAdjustment.count(), adjustmentCount)
        const before = {
          employees: await prisma.employee.count(),
          workdays: await prisma.attendanceWorkday.count(),
          sessions: await prisma.attendanceWorkSession.count(),
        }
        const response = await fetch(
          `${base}/attendance/me/overview?from=2026-11-13&to=2026-11-13`,
          { headers: { authorization: `Bearer ${token}` } },
        )
        assert.equal(response.status, 409)
        const body = (await response.json()) as { error?: string }
        assert.equal(
          body.error,
          "Complete your employee profile before using attendance",
        )
        assert.deepEqual(
          {
            employees: await prisma.employee.count(),
            workdays: await prisma.attendanceWorkday.count(),
            sessions: await prisma.attendanceWorkSession.count(),
          },
          before,
        )
      },
    )
    await t.test(
      "[PG-007-F001-A012-T018] personal overview validates date range boundaries",
      async () => {
        const invalidCalendar = await request(
          staff,
          "/me/overview?from=2026-02-30&to=2026-02-30",
        )
        assert.equal(invalidCalendar.status, 400)
        const reversed = await request(
          staff,
          "/me/overview?from=2026-11-14&to=2026-11-13",
        )
        assert.equal(reversed.status, 400)
        const acceptedBoundary = await request(
          staff,
          "/me/overview?from=2025-01-01&to=2026-01-01",
        )
        assert.equal(acceptedBoundary.status, 200)
        const rejectedBoundary = await request(
          staff,
          "/me/overview?from=2025-01-01&to=2026-01-02",
        )
        assert.equal(rejectedBoundary.status, 400)
        const unsupportedKey = await request(
          staff,
          "/me/overview?from=2026-11-13&to=2026-11-13&unexpected=true",
        )
        assert.equal(unsupportedKey.status, 400)
      },
    )
    await t.test(
      "[PG-007-F001-A012-T019] personal overview aggregates attendance, approved leave, and recent activity",
      async () => {
        const personal = await account("pg007-reporting", "STAFF")
        const foreign = await account("pg007-foreign", "STAFF", outside.id)

        async function createSession(
          employeeId: string,
          startedAt: string,
          endedAt: string | null = null,
          suspendedAt: string | null = null,
        ) {
          return prisma.attendanceWorkSession.create({
            data: {
              employeeId,
              startedAt: new Date(startedAt),
              endedAt: endedAt ? new Date(endedAt) : null,
              suspendedAt: suspendedAt ? new Date(suspendedAt) : null,
            },
          })
        }

        const closedWithBreak = await createSession(
          personal.employee.id,
          "2026-11-13T09:00:00+08:00",
          "2026-11-13T09:30:00+08:00",
        )
        await prisma.attendanceBreak.create({
          data: {
            sessionId: closedWithBreak.id,
            startedAt: new Date("2026-11-13T09:10:00+08:00"),
            endedAt: new Date("2026-11-13T09:15:00+08:00"),
            isPaid: false,
          },
        })
        await createSession(
          personal.employee.id,
          "2026-11-13T10:00:00+08:00",
          "2026-11-13T10:30:00+08:00",
        )
        await createSession(
          personal.employee.id,
          "2026-11-13T11:00:00+08:00",
          "2026-11-13T11:30:00+08:00",
        )
        const onBreak = await createSession(
          personal.employee.id,
          "2026-11-14T09:00:00+08:00",
        )
        await prisma.attendanceBreak.create({
          data: {
            sessionId: onBreak.id,
            startedAt: new Date("2026-11-14T10:00:00+08:00"),
            isPaid: false,
          },
        })
        await createSession(
          foreign.employee.id,
          "2026-11-14T09:30:00+08:00",
          "2026-11-14T09:45:00+08:00",
        )

        const assignment =
          await prisma.attendancePolicyAssignment.findFirstOrThrow({
            where: { employeeId: personal.employee.id },
          })
        for (const workDate of ["2026-11-15", "2026-11-16"])
          await prisma.attendanceWorkday.create({
            data: {
              employeeId: personal.employee.id,
              assignmentId: assignment.id,
              workDate: new Date(`${workDate}T00:00:00.000Z`),
              timeZone: "Asia/Manila",
              isWorkingDay: true,
              requiredMinutes: 480,
              policyName: "Flexible",
              unpaidBreaksEnabled: false,
              overnightRequiresReview: false,
            },
          })

        // The database overlap constraint permits only one unfinished session
        // per employee. Keep the suspended and working status cases isolated.
        const suspendedActor = await account("pg007-suspended", "STAFF")
        await createSession(
          suspendedActor.employee.id,
          "2026-11-15T09:00:00+08:00",
          null,
          "2026-11-15T10:00:00+08:00",
        )
        const workingActor = await account("pg007-working", "STAFF")
        await createSession(
          workingActor.employee.id,
          "2026-11-16T09:00:00+08:00",
        )

        await prisma.leaveRequest.create({
          data: {
            requestKey: randomUUID(),
            employeeId: personal.employee.id,
            requestedById: personal.user.id,
            type: "ANNUAL",
            reason: "PG-007 approved leave report fixture",
            startDate: new Date("2026-11-13T00:00:00.000Z"),
            endDate: new Date("2026-11-17T00:00:00.000Z"),
            status: "APPROVED",
            days: {
              create: [
                {
                  employeeId: personal.employee.id,
                  assignmentId: assignment.id,
                  workDate: new Date("2026-11-13T00:00:00.000Z"),
                  timeZone: "Asia/Manila",
                  policyName: "Flexible",
                  baseRequiredMinutes: 480,
                  leaveMinutes: 240,
                },
                {
                  employeeId: personal.employee.id,
                  assignmentId: assignment.id,
                  workDate: new Date("2026-11-17T00:00:00.000Z"),
                  timeZone: "Asia/Manila",
                  policyName: "Flexible",
                  baseRequiredMinutes: 480,
                  leaveMinutes: 480,
                },
              ],
            },
          },
        })

        const seededWorkdays = await prisma.attendanceWorkday.findMany({
          where: { employeeId: personal.employee.id },
          orderBy: { workDate: "asc" },
          select: { workDate: true },
        })
        assert.deepEqual(
          seededWorkdays.map((day) => day.workDate.toISOString().slice(0, 10)),
          ["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16"],
        )
        assert.equal(
          await prisma.attendanceWorkSession.count({
            where: { employeeId: personal.employee.id },
          }),
          4,
        )

        type PersonalOverview = {
          scope: string
          employees: number
          recordedDays: number
          approvedLeaveDays: number
          approvedLeaveHours: number
          checkIns: {
            employees: number
            total: number
            closed: number
            working: number
            onBreak: number
            suspended: number
            recentActivity: {
              action: string
              at: string
              employeeName: string
            }[]
          }
        }
        const response = await request(
          personal,
          "/me/overview?from=2026-11-13&to=2026-11-17",
        )
        assert.equal(response.status, 200)
        const result = (await response.json()) as PersonalOverview
        assert.equal(result.scope, "PERSONAL")
        assert.equal(result.employees, 1)
        assert.equal(result.recordedDays, 4)
        assert.equal(result.approvedLeaveDays, 2)
        assert.equal(result.approvedLeaveHours, 12)
        assert.deepEqual(
          {
            employees: result.checkIns.employees,
            total: result.checkIns.total,
            closed: result.checkIns.closed,
            working: result.checkIns.working,
            onBreak: result.checkIns.onBreak,
            suspended: result.checkIns.suspended,
          },
          {
            employees: 1,
            total: 4,
            closed: 3,
            working: 0,
            onBreak: 1,
            suspended: 0,
          },
        )
        assert.equal(result.checkIns.recentActivity.length, 8)
        assert.ok(
          result.checkIns.recentActivity.every(
            (event) => event.employeeName === personal.employee.fullName,
          ),
        )
        assert.deepEqual(
          result.checkIns.recentActivity.map((event) => event.action),
          [
            "BREAK_START",
            "CLOCK_IN",
            "CLOCK_OUT",
            "CLOCK_IN",
            "CLOCK_OUT",
            "CLOCK_IN",
            "CLOCK_OUT",
            "BREAK_END",
          ],
        )
        assert.deepEqual(
          result.checkIns.recentActivity.map((event) => event.at),
          [
            "2026-11-14T02:00:00.000Z",
            "2026-11-14T01:00:00.000Z",
            "2026-11-13T03:30:00.000Z",
            "2026-11-13T03:00:00.000Z",
            "2026-11-13T02:30:00.000Z",
            "2026-11-13T02:00:00.000Z",
            "2026-11-13T01:30:00.000Z",
            "2026-11-13T01:15:00.000Z",
          ],
        )

        const suspendedResponse = await request(
          suspendedActor,
          "/me/overview?from=2026-11-15&to=2026-11-15",
        )
        assert.equal(suspendedResponse.status, 200)
        const suspendedResult =
          (await suspendedResponse.json()) as PersonalOverview
        assert.deepEqual(
          {
            total: suspendedResult.checkIns.total,
            closed: suspendedResult.checkIns.closed,
            working: suspendedResult.checkIns.working,
            onBreak: suspendedResult.checkIns.onBreak,
            suspended: suspendedResult.checkIns.suspended,
          },
          { total: 1, closed: 0, working: 0, onBreak: 0, suspended: 1 },
        )

        const workingResponse = await request(
          workingActor,
          "/me/overview?from=2026-11-16&to=2026-11-16",
        )
        assert.equal(workingResponse.status, 200)
        const workingResult = (await workingResponse.json()) as PersonalOverview
        assert.deepEqual(
          {
            total: workingResult.checkIns.total,
            closed: workingResult.checkIns.closed,
            working: workingResult.checkIns.working,
            onBreak: workingResult.checkIns.onBreak,
            suspended: workingResult.checkIns.suspended,
          },
          { total: 1, closed: 0, working: 1, onBreak: 0, suspended: 0 },
        )
      },
    )
  },
)

test(
  "[PG-005-F001-A003-T015] audit endpoint denies anonymous and USER callers",
  { timeout: 120000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const user = await prisma.user.create({
      data: {
        email: "pg005-audit-user@test.local",
        fullName: "PG005 audit user",
        role: "USER",
        passwordHash: "test-only",
      },
    })
    const token = (await issueSession(user)).token
    const anonymous = await fetch(base + "/attendance/audit")
    assert.equal(anonymous.status, 401)
    const forbidden = await fetch(base + "/attendance/audit", {
      headers: { Authorization: "Bearer " + token },
    })
    assert.equal(forbidden.status, 403)
    for (const response of [anonymous, forbidden]) {
      const body = (await response.json()) as Record<string, unknown>
      assert.equal("events" in body, false)
    }
  },
)

test(
  "[PG-005-F001-A010-T016] audit endpoint validates query values and boundaries",
  { timeout: 120000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const headUser = await prisma.user.create({
      data: {
        email: "pg005-audit-head@test.local",
        fullName: "PG005 audit head",
        role: "STAFF",
        passwordHash: "test-only",
      },
    })
    await prisma.department.create({
      data: { name: "PG005 audit department", headId: headUser.id },
    })
    const adminUser = await prisma.user.create({
      data: {
        email: "pg005-audit-admin@test.local",
        fullName: "PG005 audit admin",
        role: "ADMIN",
        passwordHash: "test-only",
      },
    })
    const headToken = (await issueSession(headUser)).token
    const adminToken = (await issueSession(adminUser)).token
    const request = (token: string, path: string) =>
      fetch(base + "/attendance" + path, {
        headers: { Authorization: "Bearer " + token },
      })
    const range = "from=2026-11-13&to=2026-11-13"
    const invalidQueries: [string, string][] = [
      ["search-over-100", range + "&search=" + "x".repeat(101)],
      ["repeated-search", range + "&search=one&search=two"],
      ["impossible-date", "from=2026-02-30&to=2026-03-01"],
      ["wrong-date-format", "from=2026/11/13&to=2026-11-13"],
      ["reversed-range", "from=2026-11-14&to=2026-11-13"],
      ["range-over-366-days", "from=2026-01-01&to=2027-01-02"],
      ["page-zero", range + "&page=0"],
      ["page-over-limit", range + "&page=100001"],
      ["malformed-department-id", range + "&departmentId=!"],
      ["unsupported-query-key", range + "&unsupported=1"],
    ]
    for (const [caseName, query] of invalidQueries) {
      const response = await request(headToken, "/audit?" + query)
      assert.equal(response.status, 400, caseName)
    }

    const maximumSearch = await request(
      headToken,
      "/audit?" + range + "&search=" + "x".repeat(100),
    )
    assert.equal(maximumSearch.status, 200, "100-character search is accepted")
    const whitespaceSearch = await request(
      headToken,
      "/audit?" + range + "&search=%20%20",
    )
    assert.equal(whitespaceSearch.status, 200, "whitespace search trims empty")
    const maximumRange = await request(
      headToken,
      "/audit?from=2026-01-01&to=2027-01-01",
    )
    assert.equal(maximumRange.status, 200, "366 inclusive dates are accepted")
    const maximumPage = await request(
      headToken,
      "/audit?" + range + "&page=100000",
    )
    assert.equal(maximumPage.status, 200, "page 100000 is accepted")
    assert.equal(((await maximumPage.json()) as { page: number }).page, 100000)

    const missingDepartment = await prisma.department.create({
      data: { name: "PG005 department to remove" },
    })
    await prisma.department.delete({ where: { id: missingDepartment.id } })
    const missing = await request(
      adminToken,
      "/audit?" +
        range +
        "&departmentId=" +
        encodeURIComponent(missingDepartment.id),
    )
    assert.equal(missing.status, 404)
  },
)

test(
  "[PG-004-F001-A002-T009] adjustment list paginates ten stable scoped rows",
  { timeout: 120000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const department = await prisma.department.create({
      data: { name: "Adjustment pagination team" },
    })
    const user = await prisma.user.create({
      data: {
        email: "adjustment-pagination@management.test",
        fullName: "Pagination Staff",
        role: "STAFF",
        passwordHash: "test-only",
      },
    })
    const employee = await prisma.employee.create({
      data: {
        employeeId: "ADJ-PAGE-001",
        fullName: "Pagination Staff",
        userId: user.id,
        departmentId: department.id,
      },
    })
    const token = (await issueSession(user)).token
    const reviewer = await prisma.user.create({
      data: {
        email: "adjustment-pagination-reviewer@management.test",
        fullName: "Pagination Reviewer",
        role: "STAFF",
        passwordHash: "test-only",
        departmentId: department.id,
      },
    })
    const request = (page: string) =>
      fetch(`${base}/attendance/adjustments?scope=mine&page=${page}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

    for (let index = 0; index < 11; index += 1) {
      const startedAt = new Date(Date.UTC(2026, 10, 1, 9, index))
      await prisma.attendanceAdjustment.create({
        data: {
          employeeId: employee.id,
          requestedById: user.id,
          requestKey: randomUUID(),
          reason: `Pagination fixture ${index}`,
          proposedStartedAt: startedAt,
          proposedEndedAt: new Date(startedAt.getTime() + 60_000),
          createdAt: new Date(Date.UTC(2026, 10, 1, 0, index)),
        },
      })
    }

    const firstResponse = await request("1")
    assert.equal(firstResponse.status, 200, await firstResponse.clone().text())
    const first = (await firstResponse.json()) as {
      adjustments: { id: string }[]
      total: number
      page: number
      pageSize: number
    }
    assert.equal(first.total, 11)
    assert.equal(first.page, 1)
    assert.equal(first.pageSize, 10)
    assert.equal(first.adjustments.length, 10)

    const secondResponse = await request("2")
    assert.equal(
      secondResponse.status,
      200,
      await secondResponse.clone().text(),
    )
    const second = (await secondResponse.json()) as {
      adjustments: { id: string }[]
      total: number
      page: number
      pageSize: number
    }
    assert.equal(second.total, 11)
    assert.equal(second.page, 2)
    assert.equal(second.pageSize, 10)
    assert.equal(second.adjustments.length, 1)

    const expected = await prisma.attendanceAdjustment.findMany({
      where: { employeeId: employee.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    })
    assert.deepEqual(
      [...first.adjustments, ...second.adjustments].map(({ id }) => id),
      expected.map(({ id }) => id),
    )

    for (const invalidPage of ["0", "1.5", "100001"]) {
      const invalid = await request(invalidPage)
      assert.equal(invalid.status, 400, `page=${invalidPage}`)
    }

    const overtimeRows = []
    const overtimeStatuses = [
      "PENDING",
      "VERIFIED",
      "APPROVED",
      "REJECTED",
    ] as const
    for (const [index, status] of overtimeStatuses.entries()) {
      const startedAt = new Date(Date.UTC(2026, 10, 2, 9, index))
      overtimeRows.push(
        await prisma.attendanceAdjustment.create({
          data: {
            employeeId: employee.id,
            requestedById: user.id,
            requestKey: randomUUID(),
            type: "OVERTIME",
            overtimeMinutes: 30 + index,
            status,
            reason:
              index === 2
                ? "Needle overtime approved search marker"
                : `Overtime status fixture ${status}`,
            proposedStartedAt: startedAt,
            proposedEndedAt: new Date(startedAt.getTime() + 60_000),
            createdAt: new Date(startedAt.getTime() + index),
            ...(status === "VERIFIED" || status === "APPROVED"
              ? {
                  verifiedById: reviewer.id,
                  verifiedAt: startedAt,
                  verificationNote: "Recorded Department Head verification",
                }
              : {}),
            ...(status === "APPROVED" || status === "REJECTED"
              ? {
                  reviewedById: reviewer.id,
                  reviewedAt: startedAt,
                  reviewNote: "Recorded final review decision",
                }
              : {}),
          },
        }),
      )
    }
    async function overtimeList(query: Record<string, string> = {}) {
      const params = new URLSearchParams({
        scope: "mine",
        page: "1",
        type: "OVERTIME",
        ...query,
      })
      return fetch(`${base}/attendance/adjustments?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    }

    // PG-012-F001-A005-T001: preserve the generic pagination checks above and
    // verify all four statuses filter Overtime rows at the shared API boundary.
    for (const [index, status] of overtimeStatuses.entries()) {
      const filtered = await overtimeList({ status })
      assert.equal(filtered.status, 200, `status=${status}`)
      const body = (await filtered.json()) as {
        adjustments: { id: string; type: string; status: string }[]
        total: number
      }
      assert.equal(body.total, 1, `status=${status}`)
      assert.deepEqual(
        body.adjustments.map(({ id, type, status: actual }) => [
          id,
          type,
          actual,
        ]),
        [[overtimeRows[index]!.id, "OVERTIME", status]],
      )
    }

    // PG-012-F001-A004-T002: search is supported over reason, Employee name,
    // and Employee ID; the server accepts 100 characters and rejects 101.
    for (const [search, expected] of [
      ["Needle overtime approved", [overtimeRows[2]!.id]],
      ["Pagination Staff", overtimeRows.map(({ id }) => id)],
      ["ADJ-PAGE-001", overtimeRows.map(({ id }) => id)],
    ] as const) {
      const searched = await overtimeList({ search })
      assert.equal(searched.status, 200, `search=${search}`)
      const body = (await searched.json()) as {
        adjustments: { id: string }[]
        total: number
      }
      assert.equal(body.total, expected.length, `search=${search}`)
      assert.deepEqual(
        body.adjustments.map(({ id }) => id).sort(),
        [...expected].sort(),
      )
    }
    assert.equal((await overtimeList({ search: "x".repeat(100) })).status, 200)

    // PG-012-F001-A016-T001: keep supported response projection and query
    // validation source-backed without replacing existing invalid-page checks.
    const projected = await overtimeList({ status: "APPROVED" })
    const projection = (await projected.json()) as {
      adjustments: {
        type: string
        employee: Record<string, unknown>
        capabilities: { approve: boolean; verify: boolean; reject: boolean }
      }[]
      total: number
      page: number
      pageSize: number
    }
    assert.equal(projected.status, 200)
    assert.equal(projection.total, 1)
    assert.equal(projection.page, 1)
    assert.equal(projection.pageSize, 10)
    assert.equal(projection.adjustments[0]?.type, "OVERTIME")
    assert.deepEqual(Object.keys(projection.adjustments[0]!.employee).sort(), [
      "departmentId",
      "employeeId",
      "fullName",
      "id",
    ])
    assert.deepEqual(projection.adjustments[0]?.capabilities, {
      approve: false,
      verify: false,
      reject: false,
    })
    const invalidQueries: Record<string, string>[] = [
      { status: "INVALID" },
      { type: "INVALID" },
      { scope: "organization" },
      { search: "x".repeat(101) },
    ]
    for (const query of invalidQueries)
      assert.equal(
        (await overtimeList(query)).status,
        400,
        JSON.stringify(query),
      )
  },
)

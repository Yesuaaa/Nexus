import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import type { Role } from "../../../src/generated/prisma/client.js"
import { submitRecordedOvertime } from "../../../src/features/attendance/attendance.overtime.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "overtime and corrections protect the same effective attendance workday",
  { timeout: 120000 },
  async (t) => {
    const reviewTime = new Date("2026-11-20T12:00:00+08:00")
    let now = reviewTime
    const { db, prisma, base } = await startPgliteApp(t, {
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

    async function clockShift(
      staff: { token: string },
      start: string,
      end: string,
    ) {
      try {
        now = new Date(start)
        const punched = await call(staff, "/me/clock-in", {})
        assert.equal(punched.status, 201, await punched.clone().text())
        const { workday } = (await punched.json()) as {
          workday: { activeSessionId: string }
        }
        const sessionId = workday.activeSessionId
        now = new Date(end)
        const closed = await call(staff, "/me/clock-out", { sessionId })
        assert.equal(closed.status, 200, await closed.clone().text())
        return sessionId
      } finally {
        now = reviewTime
      }
    }

    async function rejectedNovember12Shift(staff: { token: string }) {
      const sessionId = await clockShift(
        staff,
        "2026-11-12T08:00:00+08:00",
        "2026-11-12T18:00:00+08:00",
      )
      const original = await prisma.attendanceAdjustment.findFirstOrThrow({
        where: { sessionId, type: "OVERTIME" },
      })
      assert.deepEqual(overtimeInterval(original), {
        startedAt: "2026-11-12T08:00:00.000Z",
        endedAt: "2026-11-12T10:00:00.000Z",
        minutes: 120,
        status: "PENDING",
      })
      await reviewed(head, original.id, "REJECTED", "REJECTED")
      return sessionId
    }

    function overtimeInterval(request: {
      proposedStartedAt: Date
      proposedEndedAt: Date
      overtimeMinutes: number
      status: string
    }) {
      return {
        startedAt: request.proposedStartedAt.toISOString(),
        endedAt: request.proposedEndedAt.toISOString(),
        minutes: request.overtimeMinutes,
        status: request.status,
      }
    }

    async function history(actor: { token: string }, route: string) {
      const response = await call(actor, route)
      assert.equal(response.status, 200, await response.clone().text())
      const { workdays } = (await response.json()) as {
        workdays: {
          id: string
          workDate: string
          timeZone: string
          workedMinutes: number
          requiredMinutes: number
          excessMinutes: number
          unpaidBreakMilliseconds: number
        }[]
      }
      return workdays.map(
        ({
          id,
          workDate,
          timeZone,
          workedMinutes,
          requiredMinutes,
          excessMinutes,
          unpaidBreakMilliseconds,
        }) => ({
          id,
          workDate,
          timeZone,
          workedMinutes,
          requiredMinutes,
          excessMinutes,
          unpaidBreakMilliseconds,
        }),
      )
    }

    await t.test(
      "corrected Manila attendance requests the 60 minutes adjacent to rejected overtime",
      async () => {
        const staff = await account("corrected-overtime")
        const sessionId = await rejectedNovember12Shift(staff)
        const original = await snapshot(staff.employee.id)
        const correction = await submit(staff, {
          ...proposal("2026-11-12T07:00:00+08:00", "2026-11-12T18:00:00+08:00"),
          sessionId,
        })
        await reviewed(head, correction.id, "VERIFIED")
        await reviewed(hr, correction.id, "APPROVED")

        const corrected = await snapshot(staff.employee.id)
        assert.deepEqual(corrected.days, original.days)
        assert.equal(corrected.sessions[0]?.id, sessionId)
        assert.equal(corrected.sessions[0]?.workdayId, original.days[0]?.id)
        assert.equal(
          corrected.sessions[0]?.startedAt.toISOString(),
          "2026-11-11T23:00:00.000Z",
        )
        const range = "?from=2026-11-12&to=2026-11-12"
        const totals = [
          {
            id: original.days[0]?.id,
            workDate: "2026-11-12",
            timeZone: "Asia/Manila",
            workedMinutes: 660,
            requiredMinutes: 480,
            excessMinutes: 180,
            unpaidBreakMilliseconds: 0,
          },
        ]
        assert.deepEqual(await history(staff, `/me/history${range}`), totals)
        assert.deepEqual(
          await history(hr, `/employees/${staff.employee.id}/history${range}`),
          totals,
        )

        const originalRequest = original.adjustments[0]
        assert.equal(originalRequest.status, "REJECTED")
        assert.deepEqual(
          corrected.adjustments.find(({ id }) => id === originalRequest.id),
          originalRequest,
        )
        assert.deepEqual(
          corrected.audit.filter(
            ({ entityId }) => entityId === originalRequest.id,
          ),
          original.audit.filter(
            ({ entityId }) => entityId === originalRequest.id,
          ),
        )
        const pending = corrected.adjustments.filter(
          ({ type, status }) => type === "OVERTIME" && status === "PENDING",
        )
        assert.deepEqual(pending.map(overtimeInterval), [
          {
            startedAt: "2026-11-12T07:00:00.000Z",
            endedAt: "2026-11-12T08:00:00.000Z",
            minutes: 60,
            status: "PENDING",
          },
        ])
        const generated = pending[0]
        assert.equal(generated.sessionId, sessionId)
        assert.ok(
          corrected.notifications.some(
            ({ attendanceAdjustmentId, userId, type }) =>
              attendanceAdjustmentId === generated.id &&
              userId === head.user.id &&
              type === "ATTENDANCE_OVERTIME_PENDING",
          ),
        )
        const overtimeAudit = corrected.audit.find(
          ({ entityId }) => entityId === generated.id,
        )
        assert.ok(overtimeAudit?.operationId)
        assert.ok(
          corrected.audit.some(
            ({ entityId, action, operationId }) =>
              entityId === sessionId &&
              action === "UPDATE" &&
              operationId === overtimeAudit.operationId,
          ),
        )
        const repeat = await review(hr, correction.id)
        assert.equal(repeat.status, 409)
        await prisma.$transaction((tx) =>
          submitRecordedOvertime(
            tx,
            staff.user.id,
            staff.employee.id,
            sessionId,
            now,
          ),
        )
        assert.deepEqual(await snapshot(staff.employee.id), corrected)
      },
    )

    await t.test(
      "a correction with no increase in excess does not resubmit rejected overtime",
      async () => {
        const staff = await account("unchanged-excess")
        const sessionId = await rejectedNovember12Shift(staff)
        const before = await snapshot(staff.employee.id)
        const correction = await submit(staff, {
          ...proposal("2026-11-12T07:30:00+08:00", "2026-11-12T17:30:00+08:00"),
          sessionId,
        })
        await reviewed(head, correction.id, "VERIFIED")
        await reviewed(hr, correction.id, "APPROVED")
        const after = await snapshot(staff.employee.id)
        assert.deepEqual(
          after.adjustments.filter(({ type }) => type === "OVERTIME"),
          before.adjustments,
        )
        assert.equal(
          after.sessions[0]?.endedAt?.toISOString(),
          "2026-11-12T09:30:00.000Z",
        )
        assert.deepEqual(
          await history(staff, "/me/history?from=2026-11-12&to=2026-11-12"),
          [
            {
              id: before.days[0]?.id,
              workDate: "2026-11-12",
              timeZone: "Asia/Manila",
              workedMinutes: 600,
              requiredMinutes: 480,
              excessMinutes: 120,
              unpaidBreakMilliseconds: 0,
            },
          ],
        )
      },
    )

    await t.test(
      "a split overnight correction allocates disjoint overtime atomically on the original workday",
      async (t) => {
        const staff = await account("split-overnight-overtime")
        const first = await session(
          staff.employee.id,
          "2026-11-13T15:00:00+08:00",
          "2026-11-13T18:00:00+08:00",
        )
        const second = await session(
          staff.employee.id,
          "2026-11-13T20:00:00+08:00",
          "2026-11-14T05:00:00+08:00",
        )
        assert.equal(second.workdayId, first.workdayId)
        await prisma.attendanceBreak.createMany({
          data: [
            {
              startedAt: "2026-11-13T23:30:00+08:00",
              endedAt: "2026-11-14T00:30:00+08:00",
              isPaid: false,
            },
            {
              startedAt: "2026-11-14T03:30:00+08:00",
              endedAt: "2026-11-14T04:00:00+08:00",
              isPaid: false,
            },
            {
              startedAt: "2026-11-14T04:00:00+08:00",
              endedAt: "2026-11-14T04:15:00+08:00",
              isPaid: true,
            },
          ].map((pause) => ({ ...pause, sessionId: second.id })),
        })
        const prior = await submit(staff, {
          ...proposal("2026-11-14T02:00:00+08:00", "2026-11-14T03:00:00+08:00"),
          type: "OVERTIME",
        })
        await reviewed(head, prior.id, "REJECTED", "REJECTED")
        const correction = await submit(staff, {
          ...proposal("2026-11-13T14:00:00+08:00", "2026-11-13T18:00:00+08:00"),
          sessionId: first.id,
        })
        await reviewed(head, correction.id, "VERIFIED")
        const before = await snapshot(staff.employee.id)

        const failures = [
          {
            table: "AttendanceAdjustment",
            condition: `NEW.type = 'OVERTIME' AND NEW."proposedStartedAt" = TIMESTAMPTZ '2026-11-13 17:00:00Z'`,
          },
          {
            table: "WorkflowNotification",
            condition: `NEW.type = 'ATTENDANCE_OVERTIME_PENDING' AND EXISTS (
              SELECT 1 FROM "AttendanceAdjustment" WHERE id = NEW."attendanceAdjustmentId"
                AND "proposedStartedAt" = TIMESTAMPTZ '2026-11-13 17:00:00Z'
            )`,
          },
        ]
        for (const { table, condition } of failures) {
          await t.test(
            `a failed ${table} write rolls back the correction and both overtime windows`,
            async () => {
              // The later window must already have a request and notice inside the transaction.
              await db.exec(`
              CREATE FUNCTION fail_overtime_window() RETURNS trigger LANGUAGE plpgsql AS $$
              BEGIN
                IF ${condition} AND EXISTS (
                  SELECT 1 FROM "WorkflowNotification" n
                  JOIN "AttendanceAdjustment" a ON a.id = n."attendanceAdjustmentId"
                  WHERE n.type = 'ATTENDANCE_OVERTIME_PENDING' AND a.status = 'PENDING'
                    AND a."proposedStartedAt" = TIMESTAMPTZ '2026-11-13 19:00:00Z'
                ) THEN
                  RAISE EXCEPTION 'Synthetic overtime window write failure';
                END IF;
                RETURN NEW;
              END $$;
              CREATE TRIGGER fail_overtime_window BEFORE INSERT ON "${table}"
              FOR EACH ROW EXECUTE FUNCTION fail_overtime_window();
            `)
              try {
                const response = await review(hr, correction.id)
                assert.equal(response.status, 500, await response.text())
                assert.deepEqual(await snapshot(staff.employee.id), before)
              } finally {
                await db.exec(
                  `DROP TRIGGER fail_overtime_window ON "${table}"; DROP FUNCTION fail_overtime_window();`,
                )
              }
            },
          )
        }

        await reviewed(hr, correction.id, "APPROVED")
        const after = await snapshot(staff.employee.id)
        assert.deepEqual(after.days, before.days)
        assert.deepEqual(
          after.adjustments.find(({ id }) => id === prior.id),
          before.adjustments.find(({ id }) => id === prior.id),
        )
        const generated = after.adjustments
          .filter(
            ({ type, status }) => type === "OVERTIME" && status === "PENDING",
          )
          .sort(
            (a, b) =>
              a.proposedStartedAt.getTime() - b.proposedStartedAt.getTime(),
          )
        assert.deepEqual(generated.map(overtimeInterval), [
          {
            startedAt: "2026-11-13T17:00:00.000Z",
            endedAt: "2026-11-13T18:00:00.000Z",
            minutes: 60,
            status: "PENDING",
          },
          {
            startedAt: "2026-11-13T19:00:00.000Z",
            endedAt: "2026-11-13T21:00:00.000Z",
            minutes: 90,
            status: "PENDING",
          },
        ])
        for (const request of generated) {
          assert.equal(request.sessionId, second.id)
          assert.equal(
            after.notifications.filter(
              ({ attendanceAdjustmentId, userId, type }) =>
                attendanceAdjustmentId === request.id &&
                userId === head.user.id &&
                type === "ATTENDANCE_OVERTIME_PENDING",
            ).length,
            1,
          )
        }
        assert.deepEqual(
          await history(staff, "/me/history?from=2026-11-13&to=2026-11-14"),
          [
            {
              id: first.workdayId,
              workDate: "2026-11-13",
              timeZone: "Asia/Manila",
              workedMinutes: 690,
              requiredMinutes: 480,
              excessMinutes: 210,
              unpaidBreakMilliseconds: 90 * 60_000,
            },
          ],
        )
        await reviewed(head, generated[1].id, "VERIFIED")
        await reviewed(hr, generated[1].id, "APPROVED")
      },
    )

    await t.test(
      "a prior request outside the eligible window still consumes the same day's budget",
      async () => {
        const staff = await account("overtime-budget")
        const recorded = await session(
          staff.employee.id,
          "2026-11-12T08:00:00+08:00",
          "2026-11-12T18:00:00+08:00",
        )
        const claim = await submit(staff, {
          ...proposal("2026-11-12T08:00:00+08:00", "2026-11-12T09:00:00+08:00"),
          type: "OVERTIME",
        })
        await reviewed(head, claim.id, "REJECTED", "REJECTED")
        const correction = await submit(staff, {
          ...proposal("2026-11-12T07:00:00+08:00", "2026-11-12T18:00:00+08:00"),
          sessionId: recorded.id,
        })
        await reviewed(head, correction.id, "VERIFIED")
        await reviewed(hr, correction.id, "APPROVED")
        const after = await snapshot(staff.employee.id)
        const pending = after.adjustments.filter(
          ({ type, status }) => type === "OVERTIME" && status === "PENDING",
        )
        assert.deepEqual(pending.map(overtimeInterval), [
          {
            startedAt: "2026-11-12T08:00:00.000Z",
            endedAt: "2026-11-12T10:00:00.000Z",
            minutes: 120,
            status: "PENDING",
          },
        ])
      },
    )

    await t.test(
      "an old overnight rejection blocks only its overlapping time on the next workday",
      async () => {
        const staff = await account("prior-workday-rejection")
        const sessionId = await clockShift(
          staff,
          "2026-11-14T15:00:00+08:00",
          "2026-11-15T16:00:00+08:00",
        )
        const original = await prisma.attendanceAdjustment.findFirstOrThrow({
          where: { sessionId, type: "OVERTIME" },
        })
        await reviewed(head, original.id, "REJECTED", "REJECTED")
        const correction = await submit(staff, {
          ...proposal("2026-11-14T15:00:00+08:00", "2026-11-14T23:00:00+08:00"),
          sessionId,
        })
        await reviewed(head, correction.id, "VERIFIED")
        await reviewed(hr, correction.id, "APPROVED")
        const nextSession = await clockShift(
          staff,
          "2026-11-15T00:00:00+08:00",
          "2026-11-15T18:00:00+08:00",
        )
        const after = await snapshot(staff.employee.id)
        const pending = after.adjustments.filter(
          ({ type, status }) => type === "OVERTIME" && status === "PENDING",
        )
        assert.deepEqual(pending.map(overtimeInterval), [
          {
            startedAt: "2026-11-15T08:00:00.000Z",
            endedAt: "2026-11-15T10:00:00.000Z",
            minutes: 120,
            status: "PENDING",
          },
        ])
        assert.equal(pending[0].sessionId, nextSession)
        assert.equal(after.days.length, 2)
        assert.equal(
          after.adjustments.find(({ id }) => id === original.id)?.status,
          "REJECTED",
        )
        await prisma.$transaction((tx) =>
          submitRecordedOvertime(
            tx,
            staff.user.id,
            staff.employee.id,
            nextSession,
            now,
          ),
        )
        assert.deepEqual(await snapshot(staff.employee.id), after)
      },
    )

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

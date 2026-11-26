import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import type { TestContext } from "node:test"
import type { ManagementContext } from "./context.js"

/** Request ownership, active-correction limits, HR exceptions and reviewer rules. */
export async function requestsAndReviews(
  t: TestContext,
  {
    request,
    other,
    session,
    prisma,
    staff,
    submit,
    head,
    admin,
    account,
    superadmin,
  }: ManagementContext,
) {
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
      assert.equal(paddedReason.status, 201, await paddedReason.clone().text())
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
        ((await replay.json()) as { adjustment: { id: string } }).adjustment.id,
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
          await request(staff, `/adjustments/${created.adjustment.id}/review`, {
            decision: "APPROVED",
            note: "Cannot approve own request",
          })
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
          await request(admin, `/adjustments/${created.adjustment.id}/review`, {
            decision: "APPROVED",
            note: "HR final approval after verification",
          })
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
          await request(head, `/adjustments/${created.adjustment.id}/review`, {
            decision: "REJECTED",
            note: "Repeated decision",
          })
        ).status,
        409,
      )
    },
  )

  await t.test(
    "[PG-010-F001-A016-T022] one active correction is allowed per attendance session",
    async () => {
      const subject = await account(`pg010-duplicate-${randomUUID()}`, "STAFF")
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
          await request(head, `/adjustments/${missing.adjustment.id}/review`, {
            decision: "APPROVED",
            note: "Confirmed missing attendance",
          })
        ).status,
        200,
      )
      assert.equal(
        (
          await request(admin, `/adjustments/${missing.adjustment.id}/review`, {
            decision: "APPROVED",
            note: "HR confirms missing attendance",
          })
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
}

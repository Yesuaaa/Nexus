import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import type { TestContext } from "node:test"
import type { LeaveContext } from "./context.js"

/** Stable pagination and policy gaps. */
export async function paginationAndPolicyGaps(
  t: TestContext,
  { account, submit, prisma, api, policy, department }: LeaveContext,
) {
  await t.test(
    "[PG-011-F001-A007-T001] leave-list pages keep metadata and deterministic tie order",
    async () => {
      const subject = await account("pg011-page-order", "STAFF")
      const dates = [
        "2026-12-01",
        "2026-12-02",
        "2026-12-03",
        "2026-12-04",
        "2026-12-07",
        "2026-12-08",
        "2026-12-09",
        "2026-12-10",
        "2026-12-11",
        "2026-12-14",
        "2026-12-15",
      ]
      const tieTime = new Date("2026-12-20T12:00:00.000Z")
      const ids: string[] = []
      for (const date of dates) {
        const result = await submit(date, date, subject)
        ids.push(result.request.id)
        await prisma.leaveRequest.update({
          where: { id: result.request.id },
          data: { createdAt: tieTime },
        })
      }
      const expected = [...ids].sort().reverse()
      const firstResponse = await api(
        subject,
        "/leave/requests?scope=mine&page=1",
      )
      assert.equal(
        firstResponse.status,
        200,
        await firstResponse.clone().text(),
      )
      const first = (await firstResponse.json()) as {
        requests: { id: string }[]
        total: number
        page: number
        pageSize: number
      }
      assert.deepEqual(
        { total: first.total, page: first.page, pageSize: first.pageSize },
        { total: 11, page: 1, pageSize: 10 },
      )
      assert.deepEqual(
        first.requests.map(({ id }) => id),
        expected.slice(0, 10),
      )
      const secondResponse = await api(
        subject,
        "/leave/requests?scope=mine&page=2",
      )
      const second = (await secondResponse.json()) as {
        requests: { id: string }[]
        total: number
        page: number
        pageSize: number
      }
      assert.equal(secondResponse.status, 200)
      assert.deepEqual(
        { total: second.total, page: second.page, pageSize: second.pageSize },
        { total: 11, page: 2, pageSize: 10 },
      )
      assert.deepEqual(
        second.requests.map(({ id }) => id),
        expected.slice(10),
      )
      const repeated = await api(subject, "/leave/requests?scope=mine&page=1")
      assert.deepEqual(
        (
          (await repeated.json()) as { requests: { id: string }[] }
        ).requests.map(({ id }) => id),
        expected.slice(0, 10),
      )
      assert.equal(
        (await api(subject, "/leave/requests?scope=mine&page=0")).status,
        400,
      )
      const outside = await api(subject, "/leave/requests?scope=mine&page=99")
      assert.equal(outside.status, 200)
      const outsideBody = (await outside.json()) as {
        requests: unknown[]
        total: number
        page: number
        pageSize: number
      }
      assert.deepEqual(
        {
          requests: outsideBody.requests,
          total: outsideBody.total,
          page: outsideBody.page,
          pageSize: outsideBody.pageSize,
        },
        { requests: [], total: 11, page: 99, pageSize: 10 },
      )
    },
  )

  await t.test(
    "[PG-011-F001-A014-T002] policy gaps reject preview and submission without partial writes",
    async () => {
      const noAssignment = await account("pg011-no-policy", "STAFF")
      await prisma.attendancePolicyAssignment.deleteMany({
        where: { employeeId: noAssignment.employee.id },
      })

      const ambiguous = await account("pg011-ambiguous-policy", "STAFF")
      // Model legacy-corrupt overlap only to exercise this service branch.
      // The isolated database guard is restored before any API request.
      await prisma.$executeRaw`ALTER TABLE "AttendancePolicyAssignment" DISABLE TRIGGER USER`
      try {
        await prisma.attendancePolicyAssignment.create({
          data: {
            employeeId: ambiguous.employee.id,
            policyId: policy.id,
            effectiveFrom: new Date("2026-12-01T00:00:00.000Z"),
          },
        })
      } finally {
        await prisma.$executeRaw`ALTER TABLE "AttendancePolicyAssignment" ENABLE TRIGGER USER`
      }

      const incompletePolicy = await prisma.attendancePolicy.create({
        data: {
          name: "PG-011 incomplete weekday policy",
          timeZone: "Asia/Manila",
          days: {
            create: Array.from({ length: 7 }, (_, weekday) => ({
              weekday,
              isWorkingDay: weekday > 0 && weekday < 6,
              requiredMinutes: weekday > 0 && weekday < 6 ? 480 : 0,
            })),
          },
        },
      })
      const incomplete = await account(
        "pg011-incomplete-policy",
        "STAFF",
        department.id,
        incompletePolicy.id,
      )
      // Assignment guards require all weekday rows. Remove one only after
      // assignment to represent a legacy-corrupt/incomplete policy state.
      await prisma.$executeRaw`ALTER TABLE "AttendancePolicyDay" DISABLE TRIGGER USER`
      try {
        await prisma.attendancePolicyDay.deleteMany({
          where: { policyId: incompletePolicy.id, weekday: 3 },
        })
      } finally {
        await prisma.$executeRaw`ALTER TABLE "AttendancePolicyDay" ENABLE TRIGGER USER`
      }

      const zeroPolicy = await prisma.attendancePolicy.create({
        data: {
          name: "PG-011 zero-work policy",
          timeZone: "Asia/Manila",
          days: {
            create: Array.from({ length: 7 }, (_, weekday) => ({
              weekday,
              isWorkingDay: false,
              requiredMinutes: 0,
            })),
          },
        },
      })
      const zero = await account(
        "pg011-zero-policy",
        "STAFF",
        department.id,
        zeroPolicy.id,
      )

      async function counts() {
        return {
          requests: await prisma.leaveRequest.count(),
          days: await prisma.leaveRequestDay.count(),
          decisions: await prisma.leaveDecision.count(),
          notifications: await prisma.workflowNotification.count(),
        }
      }
      const cases = [
        {
          actor: noAssignment,
          startDate: "2026-12-08",
          endDate: "2026-12-08",
          expected: 409,
        },
        {
          actor: ambiguous,
          startDate: "2026-12-08",
          endDate: "2026-12-08",
          expected: 409,
        },
        {
          actor: incomplete,
          startDate: "2026-12-09",
          endDate: "2026-12-09",
          expected: 409,
        },
        {
          actor: zero,
          startDate: "2026-12-06",
          endDate: "2026-12-06",
          expected: 400,
        },
      ] as const
      for (const { actor, startDate, endDate, expected } of cases) {
        const before = await counts()
        const previewResult = await api(actor, "/leave/preview", {
          body: { startDate, endDate },
        })
        assert.equal(previewResult.status, expected, "preview")
        const submitted = await api(actor, "/leave/requests", {
          body: {
            requestKey: randomUUID(),
            type: "ANNUAL",
            reason: "Policy coverage failure",
            startDate,
            endDate,
          },
        })
        assert.equal(submitted.status, expected, "submission")
        assert.deepEqual(await counts(), before)
      }
    },
  )
}

import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import type { LeaveContext } from "./context.js"

/** Input limits and policy edit protection. */
export async function inputBoundaries({
  account,
  prisma,
  api,
  admin,
  policy,
  employee,
  clock,
}: LeaveContext) {
  // PG-011-F001-A014-T001: direct API boundaries reject malformed input
  // without leaving request snapshots, decisions, or notices.
  const boundaryActor = await account("pg011-boundaries", "STAFF")
  const boundaryBase = {
    requestKey: randomUUID(),
    type: "ANNUAL",
    reason: "Valid request reason",
    startDate: "2026-12-08",
    endDate: "2026-12-08",
  }
  async function boundaryCounts() {
    return {
      requests: await prisma.leaveRequest.count({
        where: { requestedById: boundaryActor.user.id },
      }),
      days: await prisma.leaveRequestDay.count({
        where: { employeeId: boundaryActor.employee.id },
      }),
      decisions: await prisma.leaveDecision.count({
        where: { actorId: boundaryActor.user.id },
      }),
      notifications: await prisma.workflowNotification.count(),
    }
  }
  const invalidBoundaryInputs: { label: string; body: object }[] = [
    { label: "extra field", body: { ...boundaryBase, unsupported: true } },
    {
      label: "malformed UUID",
      body: { ...boundaryBase, requestKey: "not-a-uuid" },
    },
    {
      label: "unsupported type",
      body: { ...boundaryBase, type: "VACATION" },
    },
    {
      label: "four-character reason",
      body: { ...boundaryBase, reason: "four" },
    },
    {
      label: "2001-character reason",
      body: { ...boundaryBase, reason: "x".repeat(2001) },
    },
    {
      label: "invalid non-leap date",
      body: {
        ...boundaryBase,
        startDate: "2027-02-29",
        endDate: "2027-02-29",
      },
    },
    {
      label: "reversed date range",
      body: {
        ...boundaryBase,
        startDate: "2026-12-09",
        endDate: "2026-12-08",
      },
    },
    {
      label: "367 inclusive dates",
      body: {
        ...boundaryBase,
        startDate: "2027-01-01",
        endDate: "2028-01-02",
      },
    },
  ]
  for (const { label, body } of invalidBoundaryInputs) {
    const before = await boundaryCounts()
    const result = await api(boundaryActor, "/leave/requests", { body })
    assert.equal(result.status, 400, label)
    assert.deepEqual(await boundaryCounts(), before, label)
  }
  for (const [label, body] of [
    [
      "five-character reason",
      { ...boundaryBase, requestKey: randomUUID(), reason: "12345" },
    ],
    [
      "2000-character reason",
      {
        ...boundaryBase,
        requestKey: randomUUID(),
        reason: "x".repeat(2000),
        startDate: "2026-12-09",
        endDate: "2026-12-09",
      },
    ],
    [
      "valid leap day",
      {
        ...boundaryBase,
        requestKey: randomUUID(),
        startDate: "2028-02-29",
        endDate: "2028-02-29",
      },
    ],
    [
      "366 inclusive dates",
      {
        ...boundaryBase,
        requestKey: randomUUID(),
        startDate: "2027-01-01",
        endDate: "2028-01-01",
      },
    ],
  ] as const) {
    const result = await api(boundaryActor, "/leave/requests", { body })
    assert.equal(result.status, 201, label)
  }

  const policyEdit = await api(admin, `/attendance/policies/${policy.id}`, {
    method: "PATCH",
    body: {
      name: "Weekdays",
      timeZone: "Asia/Manila",
      unpaidBreaksEnabled: true,
      overnightRequiresReview: true,
      days: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        isWorkingDay: weekday > 0 && weekday < 6,
        requiredMinutes: weekday > 0 && weekday < 6 ? 600 : 0,
      })),
    },
  })
  assert.equal(policyEdit.status, 409)
  assert.equal(
    (
      await api(admin, "/attendance/assignments", {
        body: {
          employeeId: employee.employee.id,
          policyId: policy.id,
          effectiveFrom: "2026-11-24",
        },
      })
    ).status,
    409,
  )

  // An eleven-hour shift has three hours of overtime, two of them during leave.
  clock.now = new Date("2026-11-23T15:00:00+08:00")
}

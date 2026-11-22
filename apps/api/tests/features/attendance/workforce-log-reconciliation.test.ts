import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import type { Role } from "../../../src/generated/prisma/client.js"
import { startPgliteApp } from "../../support/pglite-app.js"

type Log = {
  message: string
  event: string
  operationId?: string
  correlationId: string | null
  actor: { id: string | null; role: Role | null; name: string }
  summaryDetail: string | null
  effects: {
    id: string
    target: { type: string; id: string }
    changes: { field: string; before?: unknown; after?: unknown }[]
  }[]
}

test(
  "WC-07-F03 distinguishes suspension, manager reconciliation and clock-out in Workforce Logs",
  { timeout: 120_000 },
  async (t) => {
    let now = new Date("2026-11-14T08:00:00+08:00")
    const { prisma, base, db } = await startPgliteApp(t, {
      app: { attendanceClock: () => now },
    })
    const department = await prisma.department.create({
      data: { name: "Reconciliation fixture" },
    })
    async function account(fullName: string, role: Role) {
      const user = await prisma.user.create({
        data: {
          fullName,
          role,
          email: `${fullName.toLowerCase().replaceAll(" ", "-")}-private@fixture.test`,
          passwordHash: "private-password-fixture",
          departmentId: role === "STAFF" ? department.id : undefined,
        },
      })
      return { ...user, ...(await issueSession(user)) }
    }
    const hr = await account("Fixture HR", "ADMIN")
    const superadmin = await account("Fixture Superadmin", "SUPERADMIN")
    const staff = await account("Suspended Worker", "STAFF")
    const regular = await account("Regular Worker", "STAFF")
    const head = await account("Fixture Head", "STAFF")
    const client = await account("Fixture Client", "USER")
    await prisma.department.update({
      where: { id: department.id },
      data: { headId: head.id },
    })
    const policy = await prisma.attendancePolicy.create({
      data: {
        name: "Fixture policy",
        timeZone: "Asia/Manila",
        unpaidBreaksEnabled: true,
        days: {
          create: Array.from({ length: 7 }, (_, weekday) => ({
            weekday,
            isWorkingDay: true,
            requiredMinutes: 480,
          })),
        },
      },
    })
    async function employee(user: typeof staff) {
      const record = await prisma.employee.create({
        data: {
          employeeId: `EXP-${user.id}`,
          fullName: user.fullName!,
          userId: user.id,
          departmentId: department.id,
        },
      })
      await prisma.attendancePolicyAssignment.create({
        data: {
          employeeId: record.id,
          policyId: policy.id,
          effectiveFrom: new Date("2026-01-01"),
        },
      })
      return record
    }
    const subject = await employee(staff)
    const regularEmployee = await employee(regular)
    await employee(head)
    async function call(
      actor: typeof hr,
      path: string,
      status: number,
      method = "GET",
      body?: object,
    ) {
      const response = await fetch(base + path, {
        method,
        headers: {
          authorization: `Bearer ${actor.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      })
      assert.equal(response.status, status, await response.clone().text())
      return response
    }
    const logs = "/workforce-compliance-logs"
    const note = "Private reconciliation fixture reason"
    async function read(params: URLSearchParams) {
      const response = await call(superadmin, `${logs}?${params}`, 200)
      const text = await response.text()
      assert.doesNotMatch(
        text,
        /Private reconciliation fixture reason|@fixture\.test|private-password-fixture|requestKey|originalSession|reviewNote|requestedById/,
      )
      return (JSON.parse(text) as { events: Log[] }).events
    }
    const byCorrelation = (correlationId: string) =>
      read(new URLSearchParams({ correlationId }))
    function correlation(response: Response) {
      const id = response.headers.get("x-correlation-id")
      assert.ok(id)
      return id
    }
    const punch = (
      actor: typeof staff,
      action: string,
      status: number,
      body: object,
    ) => call(actor, `/attendance/me/${action}`, status, "POST", body)
    await punch(staff, "clock-in", 201, {})
    const shift = await prisma.attendanceWorkSession.findFirstOrThrow({
      where: { employeeId: subject.id },
    })
    now = new Date("2026-11-14T17:00:00+08:00")
    await punch(staff, "breaks/start", 200, { sessionId: shift.id })

    const deactivated = await call(
      hr,
      `/employees/${subject.id}/account/status`,
      204,
      "PATCH",
      { isActive: false },
    )
    const suspended = await prisma.attendanceWorkSession.findUniqueOrThrow({
      where: { id: shift.id },
    })
    assert.ok(suspended.suspendedAt)
    assert.equal(suspended.endedAt, null)
    const suspendedTrace = correlation(deactivated)
    const [suspension] = await byCorrelation(suspendedTrace)
    const state = async () => ({
      shift: await prisma.attendanceWorkSession.findUnique({
        where: { id: shift.id },
        include: { breaks: true },
      }),
      adjustments: await prisma.attendanceAdjustment.findMany({
        where: { employeeId: subject.id },
        orderBy: { id: "asc" },
      }),
      audits: await prisma.attendanceAudit.findMany({
        where: { employeeId: subject.id },
        orderBy: { id: "asc" },
      }),
      notifications: await prisma.workflowNotification.count(),
    })
    const before = await state()
    const reconcile = `/attendance/employees/${subject.id}/sessions/${shift.id}/reconcile`
    now = new Date("2026-11-14T18:00:00+08:00")
    const invalid = await call(hr, reconcile, 409, "POST", {
      endedAt: shift.startedAt.toISOString(),
      note,
    })
    assert.deepEqual(await state(), before)
    assert.deepEqual(await byCorrelation(correlation(invalid)), [])
    await db.exec(`CREATE FUNCTION test_fail_overtime_notice() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Synthetic overtime notice failure'; END $$;
    CREATE TRIGGER test_fail_overtime_notice BEFORE INSERT ON "WorkflowNotification"
    FOR EACH ROW WHEN (NEW.type = 'ATTENDANCE_OVERTIME_PENDING')
    EXECUTE FUNCTION test_fail_overtime_notice();`)
    try {
      const failed = await call(hr, reconcile, 500, "POST", {
        endedAt: now.toISOString(),
        note,
      })
      assert.deepEqual(await state(), before)
      assert.deepEqual(await byCorrelation(correlation(failed)), [])
    } finally {
      await db.exec(
        'DROP TRIGGER test_fail_overtime_notice ON "WorkflowNotification"',
      )
    }
    const reconciliationResponse = await call(hr, reconcile, 200, "POST", {
      endedAt: now.toISOString(),
      note,
    })
    const reconciliationTrace = correlation(reconciliationResponse)
    const [reconciliation] = await byCorrelation(reconciliationTrace)
    const stored = await state()
    const storedReconciliation = stored.audits.find(
      ({ entityId, correlationId }) =>
        entityId === shift.id && correlationId === reconciliationTrace,
    )
    assert.equal(storedReconciliation?.reason, note)
    assert.equal(
      suspension.message,
      "Suspended an open attendance session for Suspended Worker.",
      JSON.stringify({
        suspension: {
          message: suspension.message,
          effects: suspension.effects,
        },
        reconciliation: {
          message: reconciliation.message,
          effects: reconciliation.effects,
        },
      }),
    )
    const [suspensionTime] = suspension.effects[0].changes
    assert.equal(suspension.effects[0].changes.length, 1)
    assert.equal(suspensionTime.field, "Suspension time")
    assert.equal(suspensionTime.before, null)
    assert.ok(typeof suspensionTime.after === "string")
    assert.equal(
      Date.parse(suspensionTime.after),
      suspended.suspendedAt.getTime(),
    )
    assert.equal(
      reconciliation.message,
      "Reconciled a suspended attendance session for Suspended Worker.",
    )
    assert.equal(
      reconciliation.summaryDetail,
      "Overtime request also submitted",
    )
    assert.deepEqual(
      reconciliation.effects.map(({ target }) => target.type).sort(),
      ["Attendance session", "Break", "Overtime request"],
    )
    for (const effect of reconciliation.effects.filter(
      ({ target }) => target.type !== "Overtime request",
    )) {
      const end = effect.changes.find(({ field }) => field === "End time")
      assert.ok(end && typeof end.after === "string")
      assert.equal(end.before, null)
      assert.equal(new Date(end.after).toISOString(), now.toISOString())
    }
    assert.deepEqual(
      stored.adjustments.map(({ type, overtimeMinutes, requestedById }) => ({
        type,
        overtimeMinutes,
        requestedById,
      })),
      [{ type: "OVERTIME", overtimeMinutes: 60, requestedById: staff.id }],
    )
    assert.deepEqual(
      (
        await read(
          new URLSearchParams({ source: "overtime", event: "SUBMITTED" }),
        )
      ).map(({ message }) => message),
      [reconciliation.message],
    )
    for (const [effect, trace] of [
      [suspension, suspendedTrace],
      [reconciliation, reconciliationTrace],
    ] as const) {
      assert.equal(effect.event, "UPDATED")
      assert.ok(effect.operationId)
      assert.equal(effect.correlationId, trace)
      assert.deepEqual(effect.actor, {
        id: hr.id,
        role: "ADMIN",
        name: hr.fullName,
        attribution: "CURRENT",
      })
      const rows = stored.audits.filter(({ id }) =>
        effect.effects.some(({ id: effectId }) => id === effectId),
      )
      assert.equal(rows.length, effect.effects.length)
      assert.ok(
        rows.every(
          (row) =>
            row.correlationId === trace &&
            row.actorId === hr.id &&
            row.actorRoleAtTime === "ADMIN" &&
            row.operationId === effect.operationId,
        ),
      )
    }
    assert.notEqual(suspension.operationId, reconciliation.operationId)
    assert.deepEqual(
      stored.audits.filter(({ id }) =>
        before.audits.some((old) => old.id === id),
      ),
      before.audits,
    )
    const deniedLogs = `${logs}?${new URLSearchParams({ correlationId: reconciliationTrace })}`
    for (const denied of [regular, head, hr, client])
      await call(denied, deniedLogs, 403)
    for (const search of [note, staff.email, "automatic-overtime:"])
      assert.deepEqual(await read(new URLSearchParams({ search })), [])
    assert.deepEqual(await state(), stored)

    now = new Date("2026-11-15T08:00:00+08:00")
    await punch(regular, "clock-in", 201, {})
    const normal = await prisma.attendanceWorkSession.findFirstOrThrow({
      where: { employeeId: regularEmployee.id },
    })
    now = new Date("2026-11-15T16:00:00+08:00")
    const clockOut = await punch(regular, "clock-out", 200, {
      sessionId: normal.id,
    })
    const [ordinary] = await byCorrelation(correlation(clockOut))
    assert.equal(ordinary.message, "Recorded clock-out for Regular Worker.")
    assert.equal(ordinary.actor.id, regular.id)

    // Corrections can also end a suspended session. The decision must still
    // describe the group when the audit viewer is filtered to its session effect.
    now = new Date("2026-11-16T08:00:00+08:00")
    await punch(regular, "clock-in", 201, {})
    const toCorrect = await prisma.attendanceWorkSession.findFirstOrThrow({
      where: { employeeId: regularEmployee.id, endedAt: null },
    })
    now = new Date("2026-11-16T16:00:00+08:00")
    const submitted = await call(
      regular,
      "/attendance/adjustments",
      201,
      "POST",
      {
        sessionId: toCorrect.id,
        requestKey: randomUUID(),
        startedAt: toCorrect.startedAt.toISOString(),
        endedAt: now.toISOString(),
        reason: "Correct the recorded end of the shift",
      },
    )
    const { adjustment } = (await submitted.json()) as {
      adjustment: { id: string }
    }
    await call(
      hr,
      `/employees/${regularEmployee.id}/account/status`,
      204,
      "PATCH",
      { isActive: false },
    )
    const corrected = await call(
      superadmin,
      `/attendance/adjustments/${adjustment.id}/review`,
      200,
      "POST",
      { decision: "APPROVED", note: "Confirmed the correction" },
    )
    const [correction] = await read(
      new URLSearchParams({
        correlationId: correlation(corrected),
        source: "time-logs",
      }),
    )
    assert.equal(
      correction.message,
      "Approved an attendance correction for Regular Worker.",
    )
    assert.ok(
      correction.effects.some(({ target }) => target.id === toCorrect.id),
    )

    for (const [id, metadata] of [
      ["legacy-session", {}],
      [
        "legacy-grouped-session",
        {
          operationId: randomUUID(),
          correlationId: randomUUID(),
          actorId: hr.id,
          actorRoleAtTime: "ADMIN",
        },
      ],
    ] as const) {
      await prisma.attendanceAudit.create({
        data: {
          ...metadata,
          actionId: randomUUID(),
          entityId: id,
          entityType: "AttendanceWorkSession",
          action: "UPDATE",
          employeeId: regularEmployee.id,
          reason: "Database change",
          before: { endedAt: null },
          after: { endedAt: now.toISOString() },
          createdAt: new Date(Date.now() - 1000),
        },
      })
      const [legacy] = await read(new URLSearchParams({ subjectId: id }))
      assert.equal(
        legacy.message,
        "Ended an attendance session for Regular Worker.",
      )
      assert.equal(
        legacy.actor.id,
        "actorId" in metadata ? metadata.actorId : null,
      )
    }
  },
)

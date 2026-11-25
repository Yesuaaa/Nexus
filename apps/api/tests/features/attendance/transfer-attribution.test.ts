import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import type { Role } from "../../../src/generated/prisma/client.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "WC-07-F01 attributes attendance review resets to employee placement operations",
  { timeout: 120_000 },
  async (t) => {
    let now = new Date("2026-11-14T08:00:00+08:00")
    const { prisma, base, db } = await startPgliteApp(t, {
      app: { attendanceClock: () => now },
    })
    async function account(name: string, role: Role, departmentId?: string) {
      const user = await prisma.user.create({
        data: {
          fullName: name,
          email: `${name.replaceAll(" ", "-")}@transfer.test`,
          passwordHash: "test-only",
          role,
          departmentId,
        },
      })
      return { id: user.id, token: (await issueSession(user)).token }
    }
    const north = await prisma.department.create({ data: { name: "North" } })
    const south = await prisma.department.create({ data: { name: "South" } })
    const hr = await account("Transfer HR", "ADMIN")
    const superadmin = await account("Transfer Superadmin", "SUPERADMIN")
    const staff = await account("Transfer Employee", "STAFF", north.id)
    const northHead = await account("North Head", "STAFF", north.id)
    const southHead = await account("South Head", "STAFF", south.id)
    for (const [department, head] of [
      [north, northHead],
      [south, southHead],
    ] as const)
      await prisma.department.update({
        where: { id: department.id },
        data: { headId: head.id },
      })
    const employee = await prisma.employee.create({
      data: {
        employeeId: "EXP-WC07",
        fullName: "Transfer Employee",
        userId: staff.id,
        departmentId: north.id,
      },
    })
    const policy = await prisma.attendancePolicy.create({
      data: {
        name: "Transfer policy",
        timeZone: "Asia/Manila",
        days: {
          create: Array.from({ length: 7 }, (_, weekday) => ({
            weekday,
            isWorkingDay: true,
            requiredMinutes: 480,
          })),
        },
      },
    })
    await prisma.attendancePolicyAssignment.create({
      data: {
        employeeId: employee.id,
        policyId: policy.id,
        effectiveFrom: new Date("2026-01-01"),
      },
    })

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
          "x-correlation-id": randomUUID(),
        },
        body: JSON.stringify(body),
      })
      assert.equal(response.status, status, await response.clone().text())
      return response
    }
    const path = `/employees/${employee.id}`
    const move = (departmentId: string, status = 200, actor = hr) =>
      call(actor, path, status, "PUT", { departmentId })
    const adjustments = "/attendance/adjustments"
    await call(staff, adjustments, 201, "POST", {
      requestKey: randomUUID(),
      startedAt: "2026-11-13T08:00:00+08:00",
      endedAt: "2026-11-13T09:00:00+08:00",
      reason: "Record a missed shift",
    })
    await call(staff, "/attendance/me/clock-in", 201, "POST", {})
    const session = await prisma.attendanceWorkSession.findFirstOrThrow({
      where: { employeeId: employee.id },
    })
    now = new Date("2026-11-14T18:00:00+08:00")
    await call(staff, "/attendance/me/clock-out", 200, "POST", {
      sessionId: session.id,
    })
    const requests = await prisma.attendanceAdjustment.findMany({
      where: { employeeId: employee.id },
      orderBy: { type: "asc" },
    })
    assert.deepEqual(
      requests.map(({ type, status }) => [type, status]),
      [
        ["CORRECTION", "PENDING"],
        ["OVERTIME", "PENDING"],
      ],
    )
    assert.notEqual(
      requests[0].proposedStartedAt?.toISOString().slice(0, 10),
      requests[1].proposedStartedAt?.toISOString().slice(0, 10),
    )
    const requestIds = requests.map(({ id }) => id)
    const verify = async (head: typeof hr) => {
      for (const id of requestIds)
        await call(head, `${adjustments}/${id}/review`, 200, "POST", {
          decision: "APPROVED",
          note: "Verified by current Head",
        })
    }
    const audit = () =>
      prisma.attendanceAudit.findMany({
        where: { employeeId: employee.id },
        orderBy: { id: "asc" },
      })
    const resets = () =>
      prisma.attendanceAudit.findMany({
        where: {
          entityId: { in: requestIds },
          before: { path: ["status"], equals: "VERIFIED" },
          after: { path: ["status"], equals: "PENDING" },
        },
        orderBy: { entityId: "asc" },
      })
    const logs = async (query: string) =>
      (await (
        await call(superadmin, `/workforce-compliance-logs?${query}`, 200)
      ).json()) as {
        total: number
        events: {
          operationId: string
          correlationId: string
          actor: { id: string; name: string; role: Role }
          effects: {
            target: { type: string; id: string }
            changes: unknown[]
          }[]
        }[]
      }
    async function expectOperation(
      response: Response,
      from: string | null,
      to: string | null,
      resetCount: number,
    ) {
      const correlationId = response.headers.get("x-correlation-id")
      assert.ok(correlationId)
      const rows = (await audit()).filter(
        (row) => row.correlationId === correlationId,
      )
      assert.equal(rows.length, resetCount + 1, JSON.stringify(await resets()))
      const placement = rows.find((row) => row.entityId === employee.id)
      assert.ok(placement?.operationId)
      const operationId = placement.operationId
      assert.deepEqual(placement.before, { departmentId: from })
      assert.deepEqual(placement.after, { departmentId: to })
      for (const row of rows) {
        assert.equal(row.actorId, hr.id)
        assert.equal(row.actorRoleAtTime, "ADMIN")
        assert.equal(row.operationId, operationId)
      }
      for (const query of [
        `search=${correlationId}`,
        `correlationId=${correlationId}`,
      ]) {
        const result = await logs(query)
        assert.equal(result.total, 1)
        const [event] = result.events
        assert.equal(event.operationId, operationId)
        assert.equal(event.correlationId, correlationId)
        assert.equal(event.actor.id, hr.id)
        assert.equal(event.actor.name, "Transfer HR")
        assert.equal(event.actor.role, "ADMIN")
        assert.deepEqual(
          event.effects.map(({ target }) => target.id).sort(),
          rows.map(({ entityId }) => entityId).sort(),
        )
        assert.deepEqual(
          event.effects.find(({ target }) => target.id === employee.id)
            ?.changes,
          [{ field: "Department ID", before: from, after: to }],
        )
      }
      const management = await prisma.workforceManagementChange.findFirst({
        where: { operationId, actorAccountId: hr.id },
      })
      assert.ok(management)
      return rows.filter(({ entityId }) => entityId !== employee.id)
    }

    await verify(northHead)
    const verifiedHistory = await audit()
    const verified = await prisma.attendanceAdjustment.findMany({
      where: { id: { in: requestIds } },
    })
    assert.ok(
      verified.every(
        ({
          status,
          verifiedById,
          verifiedDepartmentId,
          verifiedAt,
          verificationNote,
        }) =>
          status === "VERIFIED" &&
          verifiedById === northHead.id &&
          verifiedDepartmentId === north.id &&
          verifiedAt &&
          verificationNote,
      ),
    )
    const transfer = await move(south.id)
    const initialResets = await resets()
    const resetRows = await expectOperation(transfer, north.id, south.id, 2)
    assert.deepEqual(
      resetRows.map(({ id }) => id).sort(),
      initialResets.map(({ id }) => id).sort(),
    )
    t.diagnostic(
      JSON.stringify(
        resetRows.map(
          ({
            entityId,
            actorId,
            actorRoleAtTime,
            operationId,
            correlationId,
            reason,
          }) => ({
            type: requests.find(({ id }) => id === entityId)?.type,
            entityId,
            actorId,
            actorRoleAtTime,
            operationId,
            correlationId,
            reason,
          }),
        ),
      ),
    )
    for (const { id } of requests) {
      await call(northHead, `${adjustments}/${id}`, 404)
      const detail = await call(southHead, `${adjustments}/${id}`, 200)
      const { adjustment } = (await detail.json()) as {
        adjustment: { capabilities: { verify: boolean } }
      }
      assert.equal(adjustment.capabilities.verify, true)
    }
    const correction = requests.find(({ type }) => type === "CORRECTION")
    assert(correction)
    await call(
      northHead,
      `${adjustments}/${correction.id}/review`,
      404,
      "POST",
      {
        decision: "APPROVED",
        note: "Former Head cannot verify after transfer",
      },
    )
    const reopened = await prisma.attendanceAdjustment.findMany({
      where: { id: { in: requestIds } },
    })
    for (const {
      status,
      verifiedById,
      verifiedDepartmentId,
      verifiedAt,
      verificationNote,
    } of reopened)
      assert.deepEqual(
        [
          status,
          verifiedById,
          verifiedDepartmentId,
          verifiedAt,
          verificationNote,
        ],
        ["PENDING", null, null, null, null],
      )
    const oldAuditIds = new Set(verifiedHistory.map(({ id }) => id))
    assert.deepEqual(
      (await audit()).filter(({ id }) => oldAuditIds.has(id)),
      verifiedHistory,
    )
    const date = resetRows[0].createdAt.toISOString().slice(0, 10)
    const trail = `/attendance/audit?from=${date}&to=${date}&employeeId=${employee.id}&search=Transfer+HR`
    const trailResult = await call(southHead, trail, 200)
    const { events } = (await trailResult.json()) as {
      events: { id: string; actor: { fullName: string } }[]
    }
    for (const row of resetRows)
      assert.equal(
        events.find(({ id }) => id === row.id)?.actor.fullName,
        "Transfer HR",
      )
    await call(northHead, trail, 404)

    await expectOperation(await move(north.id), south.id, north.id, 0)
    assert.deepEqual(await resets(), initialResets)
    await verify(northHead)
    const state = async () => ({
      employee: await prisma.employee.findUniqueOrThrow({
        where: { id: employee.id },
      }),
      linkedAccount: await prisma.user.findUniqueOrThrow({
        where: { id: staff.id },
        select: { departmentId: true, teamId: true },
      }),
      requests: await prisma.attendanceAdjustment.findMany({
        where: { id: { in: requestIds } },
        orderBy: { id: "asc" },
      }),
      notices: await prisma.workflowNotification.findMany({
        where: { attendanceAdjustmentId: { in: requestIds } },
        orderBy: { id: "asc" },
      }),
      managementCount: await prisma.workforceManagementChange.count(),
      audit: await audit(),
    })
    const beforeFailure = await state()
    for (const response of [
      await move(south.id, 403, staff),
      await move("missing-department", 400),
    ])
      assert.equal(
        (await logs(`search=${response.headers.get("x-correlation-id")}`))
          .total,
        0,
      )
    assert.deepEqual(await state(), beforeFailure)
    await db.exec(`CREATE FUNCTION test_abort_placement() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Synthetic placement failure'; END $$;`)
    for (const table of ["WorkflowNotification", "AttendanceAudit"]) {
      const when =
        table === "WorkflowNotification"
          ? ""
          : `WHEN (NEW."entityType" = 'EmployeeDepartmentPlacement')`
      await db.exec(`CREATE TRIGGER test_abort_placement BEFORE INSERT ON "${table}"
      FOR EACH ROW ${when} EXECUTE FUNCTION test_abort_placement()`)
      try {
        const failure = await move(south.id, 500)
        assert.deepEqual(await state(), beforeFailure)
        assert.equal(
          (await logs(`search=${failure.headers.get("x-correlation-id")}`))
            .total,
          0,
        )
      } finally {
        await db.exec(`DROP TRIGGER test_abort_placement ON "${table}"`)
      }
    }

    await expectOperation(
      await call(
        hr,
        `/departments/${north.id}/members/${employee.id}`,
        200,
        "DELETE",
      ),
      north.id,
      null,
      2,
    )
    await expectOperation(
      await call(hr, `/departments/${south.id}/members`, 200, "POST", {
        employeeIds: [employee.id],
      }),
      null,
      south.id,
      0,
    )
    await verify(southHead)
    await expectOperation(
      await call(
        hr,
        `/departments/${south.id}/members/${staff.id}`,
        200,
        "DELETE",
      ),
      south.id,
      null,
      2,
    )
    await expectOperation(
      await call(hr, `/departments/${south.id}/members`, 200, "POST", {
        userIds: [staff.id],
      }),
      null,
      south.id,
      0,
    )
    await verify(southHead)
    // The PGlite harness uses one pooled connection. A direct write on that
    // connection must have no attribution from the preceding HTTP transaction.
    const beforeDirect = new Set((await audit()).map(({ id }) => id))
    await prisma.employee.update({
      where: { id: employee.id },
      data: { departmentId: north.id },
    })
    const direct = (await audit()).filter(({ id }) => !beforeDirect.has(id))
    assert.equal(direct.length, 2)
    assert.ok(direct.every(({ entityId }) => requestIds.includes(entityId)))
    for (const {
      actorId,
      actorRoleAtTime,
      operationId,
      correlationId,
      reason,
    } of direct)
      assert.deepEqual(
        [actorId, actorRoleAtTime, operationId, correlationId, reason],
        [null, null, null, null, "Database change"],
      )

    await verify(northHead)
    await expectOperation(
      await call(hr, `/departments/${north.id}`, 200, "DELETE"),
      north.id,
      null,
      2,
    )
  },
)

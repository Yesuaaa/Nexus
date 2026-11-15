import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import type { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "Superadmin oversees attendance without Employee identity and retains existing HR stages",
  { timeout: 120000 },
  async (t) => {
    const now = new Date("2026-11-14T20:00:00+08:00")
    const { prisma, base } = await startPgliteApp(t, {
      app: { attendanceClock: () => now },
    })
    async function actor(name: string, role: Role) {
      const user = await prisma.user.create({
        data: {
          email: `${name}@attendance-oversight.test`,
          fullName: name,
          role,
          passwordHash: "PRIVATE-CREDENTIAL",
        },
      })
      return {
        user,
        headers: {
          authorization: `Bearer ${(await issueSession(user)).token}`,
          "content-type": "application/json",
        },
      }
    }
    const sa = await actor("Superadmin", "SUPERADMIN")
    const admin = await actor("Admin", "ADMIN")
    const head = await actor("Head", "STAFF")
    const staff = await actor("Staff", "STAFF")
    const outside = await actor("Outside", "STAFF")
    const client = await actor("Client", "USER")
    const departments = await Promise.all(
      [0, 1].map((index) =>
        prisma.department.create({
          data: {
            name: `Department ${index}`,
            ...(index === 0 ? { headId: head.user.id } : {}),
          },
        }),
      ),
    )
    const policy = await prisma.attendancePolicy.create({
      data: {
        name: "Eight hours",
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
    const employees = []
    for (const [index, who] of [staff, outside, admin, head].entries()) {
      const employee = await prisma.employee.create({
        data: {
          employeeId: `OVERSIGHT-${index}`,
          fullName: who.user.fullName!,
          userId: who.user.id,
          departmentId: departments[index === 1 ? 1 : 0].id,
          email: "PRIVATE-HR-CONTACT",
        },
      })
      await prisma.attendancePolicyAssignment.create({
        data: {
          employeeId: employee.id,
          policyId: policy.id,
          effectiveFrom: new Date("2026-01-01"),
        },
      })
      employees.push(employee)
    }
    const sessions = []
    for (const employee of employees.slice(0, 2))
      sessions.push(
        await prisma.attendanceWorkSession.create({
          data: {
            employeeId: employee.id,
            startedAt: new Date("2026-11-13T20:00:00+08:00"),
            endedAt: new Date("2026-11-14T06:00:00+08:00"),
          },
        }),
      )
    const correction = await prisma.attendanceAdjustment.create({
      data: {
        employeeId: employees[0].id,
        requestKey: randomUUID(),
        type: "CORRECTION",
        proposedStartedAt: new Date("2026-11-12T09:00:00+08:00"),
        proposedEndedAt: new Date("2026-11-12T17:00:00+08:00"),
        reason: "Missing earlier attendance",
        requestedById: staff.user.id,
      },
    })
    const overtime = await prisma.attendanceAdjustment.create({
      data: {
        employeeId: employees[0].id,
        sessionId: sessions[0].id,
        requestKey: randomUUID(),
        type: "OVERTIME",
        overtimeMinutes: 120,
        proposedStartedAt: new Date("2026-11-14T04:00:00+08:00"),
        proposedEndedAt: new Date("2026-11-14T06:00:00+08:00"),
        reason: "Recorded excess attendance",
        requestedById: staff.user.id,
      },
    })
    const verified = await prisma.attendanceAdjustment.create({
      data: {
        employeeId: employees[1].id,
        sessionId: sessions[1].id,
        requestKey: randomUUID(),
        type: "OVERTIME",
        status: "VERIFIED",
        verifiedById: head.user.id,
        verifiedAt: now,
        verificationNote: "Department verified recorded hours",
        overtimeMinutes: 120,
        proposedStartedAt: new Date("2026-11-14T04:00:00+08:00"),
        proposedEndedAt: new Date("2026-11-14T06:00:00+08:00"),
        reason: "Verified excess attendance",
        requestedById: outside.user.id,
      },
    })
    const own = await prisma.attendanceAdjustment.create({
      data: {
        employeeId: employees[2].id,
        requestKey: randomUUID(),
        proposedStartedAt: new Date("2026-11-12T09:00:00+08:00"),
        proposedEndedAt: new Date("2026-11-12T17:00:00+08:00"),
        reason: "Legacy request with another requester",
        requestedById: staff.user.id,
      },
    })
    const request = (path: string, who = sa, body?: unknown) =>
      fetch(`${base}/attendance${path}`, {
        method: body ? "POST" : "GET",
        headers: who.headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    const range = "from=2026-11-12&to=2026-11-14"
    const overview = await request(`/overview?${range}`)
    assert.equal(overview.status, 200)
    const summary = (await overview.json()) as {
      scope: string
      employees: number
      workedHours: number
      checkIns: { total: number }
    }
    assert.equal(summary.scope, "ORGANIZATION")
    assert.equal(summary.employees, 2)
    assert.equal(summary.checkIns.total, 2)
    assert.equal(summary.workedHours, 20)
    const departmentList = await request("/departments")
    assert.equal(departmentList.status, 200)
    assert.equal(
      ((await departmentList.json()) as { departments: unknown[] }).departments
        .length,
      2,
    )
    const recordsResponse = await request(`/records?${range}`)
    const recordsText = await recordsResponse.text()
    assert.equal(recordsResponse.status, 200)
    assert.ok(!recordsText.includes("PRIVATE-"))
    const records = (
      JSON.parse(recordsText) as {
        workdays: {
          employeeId: string
          workDate: string
          workedHours: number
        }[]
      }
    ).workdays
    assert.deepEqual(
      records.map((day) => day.employeeId).sort(),
      employees
        .slice(0, 2)
        .map((employee) => employee.id)
        .sort(),
    )
    assert.ok(
      records.every(
        (day) =>
          day.workDate.startsWith("2026-11-13") && day.workedHours === 10,
      ),
    )
    for (const employee of employees.slice(0, 2))
      assert.equal(
        (await request(`/employees/${employee.id}/history?${range}`)).status,
        200,
      )
    for (const path of [
      `/audit?${range}`,
      "/employees",
      "/policies",
      `/policies/${policy.id}/assignments`,
      "/adjustments/overview?scope=team",
    ])
      assert.equal((await request(path)).status, 200, path)
    type Row = {
      id: string
      capabilities: { approve: boolean; verify: boolean; reject: boolean }
    }
    async function adjustments(who = sa, scope = "team") {
      const response = await request(`/adjustments?scope=${scope}`, who)
      assert.equal(response.status, 200)
      return (await response.json()) as {
        adjustments: Row[]
        capabilities: { requestCorrection: boolean }
      }
    }
    const global = await adjustments()
    assert.equal(global.capabilities.requestCorrection, false)
    assert.deepEqual(
      global.adjustments.find((row) => row.id === correction.id)!.capabilities,
      { approve: true, verify: false, reject: true },
    )
    assert.deepEqual(
      global.adjustments.find((row) => row.id === overtime.id)!.capabilities,
      { approve: false, verify: false, reject: true },
    )
    assert.deepEqual(
      global.adjustments.find((row) => row.id === verified.id)!.capabilities,
      { approve: true, verify: false, reject: true },
    )
    const adminRows = await adjustments(admin)
    assert.equal(adminRows.capabilities.requestCorrection, true)
    assert.deepEqual(
      adminRows.adjustments.find((row) => row.id === own.id)!.capabilities,
      { approve: false, verify: false, reject: false },
    )
    const headRows = await adjustments(head)
    assert.equal(headRows.capabilities.requestCorrection, true)
    assert.ok(!headRows.adjustments.some((row) => row.id === verified.id))
    assert.deepEqual(
      headRows.adjustments.find((row) => row.id === overtime.id)!.capabilities,
      { approve: false, verify: true, reject: true },
    )
    const personal = await adjustments(staff, "mine")
    assert.equal(personal.capabilities.requestCorrection, true)
    assert.ok(
      personal.adjustments.every((row) =>
        Object.values(row.capabilities).every((value) => !value),
      ),
    )
    for (const path of [
      "/me/current",
      `/me/history?${range}`,
      `/me/overview?${range}`,
      "/adjustments?scope=mine",
      "/adjustments/overview?scope=mine",
    ])
      assert.equal((await request(path)).status, 403, path)
    for (const path of [
      "/me/clock-in",
      "/me/clock-out",
      "/me/breaks/start",
      "/me/breaks/end",
    ])
      assert.equal(
        (
          await request(
            path,
            sa,
            path === "/me/clock-in"
              ? {}
              : {
                  sessionId: sessions[0].id,
                  ...(path.endsWith("/end") ? { breakId: "pause" } : {}),
                },
          )
        ).status,
        403,
        path,
      )
    for (const type of ["CORRECTION", "OVERTIME"])
      assert.equal(
        (
          await request("/adjustments", sa, {
            type,
            requestKey: randomUUID(),
            startedAt: "2026-11-12T09:00:00+08:00",
            endedAt: "2026-11-12T17:00:00+08:00",
            reason: "Cannot submit as an employee",
          })
        ).status,
        403,
      )
    assert.equal(
      (
        await request(`/adjustments/${overtime.id}/review`, sa, {
          decision: "APPROVED",
          note: "Cannot bypass verification",
        })
      ).status,
      409,
    )
    assert.equal(
      (
        await request(`/adjustments/${own.id}/review`, admin, {
          decision: "APPROVED",
          note: "Cannot review own employee",
        })
      ).status,
      403,
    )
    assert.equal(
      (
        await request(`/adjustments/${verified.id}/review`, head, {
          decision: "APPROVED",
          note: "Cannot access another department",
        })
      ).status,
      404,
    )
    assert.equal(
      (
        await request(`/adjustments/${correction.id}/review`, staff, {
          decision: "REJECTED",
          note: "Cannot self review",
        })
      ).status,
      403,
    )
    const verification = await request(
      `/adjustments/${overtime.id}/review`,
      head,
      { decision: "APPROVED", note: "Verified recorded excess" },
    )
    assert.equal(verification.status, 200, await verification.clone().text())
    assert.equal(
      ((await verification.json()) as { adjustment: { status: string } })
        .adjustment.status,
      "VERIFIED",
    )
    assert.deepEqual(
      (await adjustments(head)).adjustments.find(
        (row) => row.id === overtime.id,
      )!.capabilities,
      { approve: false, verify: false, reject: false },
    )
    assert.equal(
      (
        await request(`/adjustments/${overtime.id}/review`, head, {
          decision: "REJECTED",
          note: "HR must finalize",
        })
      ).status,
      403,
    )
    const approved = await request(`/adjustments/${overtime.id}/review`, sa, {
      decision: "APPROVED",
      note: "Existing HR approval authority",
    })
    assert.equal(approved.status, 200, await approved.clone().text())
    const final = await prisma.attendanceAdjustment.findUniqueOrThrow({
      where: { id: overtime.id },
    })
    assert.equal(final.status, "APPROVED")
    assert.equal(final.verifiedById, head.user.id)
    assert.equal(final.reviewedById, sa.user.id)
    assert.deepEqual(
      (await adjustments()).adjustments.find((row) => row.id === overtime.id)!
        .capabilities,
      { approve: false, verify: false, reject: false },
    )
    assert.equal((await request(`/overview?${range}`, admin)).status, 200)
    assert.equal(
      (
        await request(
          `/overview?${range}&departmentId=${departments[1].id}`,
          head,
        )
      ).status,
      403,
    )
    assert.equal(
      (await request(`/employees/${employees[1].id}/history?${range}`, head))
        .status,
      404,
    )
    for (const who of [staff, client])
      for (const path of [
        `/overview?${range}`,
        `/records?${range}`,
        "/adjustments?scope=team",
        "/policies",
      ])
        assert.equal(
          (await request(path, who)).status,
          403,
          `${who.user.role}: ${path}`,
        )
    assert.equal(
      await prisma.employee.count({ where: { userId: sa.user.id } }),
      0,
    )
    assert.equal(
      await prisma.department.count({ where: { headId: sa.user.id } }),
      0,
    )
    assert.equal(await prisma.attendancePolicyAssignment.count(), 4)
    await prisma.user.update({
      where: { id: sa.user.id },
      data: { role: "STAFF" },
    })
    assert.equal((await request(`/overview?${range}`)).status, 403)
    assert.equal((await request("/adjustments?scope=team")).status, 403)
  },
)

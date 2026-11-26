import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import type { Role } from "../../../../src/generated/prisma/client.js"
import { issueSession } from "../../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../../support/pglite-app.js"
import type { TestContext } from "node:test"

/** Shared fixtures for the attendance management steps, which run in order on one database. */
export async function createManagementContext(t: TestContext) {
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

  return {
    prisma,
    base,
    department,
    outside,
    days,
    policy,
    account,
    staff,
    head,
    admin,
    other,
    superadmin,
    session,
    request,
    submit,
  }
}

export type ManagementContext = Awaited<
  ReturnType<typeof createManagementContext>
>
export type Actor = ManagementContext["staff"]

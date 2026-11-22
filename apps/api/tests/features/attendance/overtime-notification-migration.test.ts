import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import type { Role } from "../../../src/generated/prisma/client.js"
import {
  applyMigrations,
  readMigration,
  startPgliteDatabase,
} from "../../support/pglite-app.js"

test(
  "overtime notice migration backfills pending routes and preserves historical records",
  { timeout: 120000 },
  async (t) => {
    const migration = "20261121200000_overtime_pending_notifications"
    const { prisma, db } = await startPgliteDatabase(t, {
      migrate: (database) =>
        applyMigrations(database, (name) => name < migration),
    })
    function account(name: string, role: Role = "STAFF", isActive = true) {
      return prisma.user.create({
        data: {
          email: `${name}@overtime-upgrade.test`,
          passwordHash: "test-only",
          role,
          isActive,
        },
      })
    }
    const requester = await account("requester")
    const formerHead = await account("former-head")
    const currentHead = await account("current-head")
    const disabledHead = await account("disabled-head", "STAFF", false)
    const hr = await account("hr", "ADMIN")
    const superadmin = await account("superadmin", "SUPERADMIN")
    const headed = await prisma.department.create({
      data: { name: "Legacy headed overtime", headId: currentHead.id },
    })
    const fallback = await prisma.department.create({
      data: { name: "Legacy fallback overtime", headId: disabledHead.id },
    })
    const employee = await prisma.employee.create({
      data: {
        fullName: "Legacy requester",
        employeeId: "LEGACY-OVERTIME",
        userId: requester.id,
        departmentId: headed.id,
      },
    })
    const fallbackEmployee = await prisma.employee.create({
      data: {
        fullName: "Legacy fallback requester",
        employeeId: "LEGACY-OVERTIME-FALLBACK",
        departmentId: fallback.id,
      },
    })
    async function request(employeeId: string, day: string) {
      return prisma.attendanceAdjustment.create({
        data: {
          requestKey: randomUUID(),
          type: "OVERTIME",
          overtimeMinutes: 120,
          employeeId,
          requestedById: requester.id,
          proposedStartedAt: new Date(`2026-11-${day}T16:00:00+08:00`),
          proposedEndedAt: new Date(`2026-11-${day}T18:00:00+08:00`),
          reason: "Legacy overtime request for populated migration",
        },
      })
    }
    const pending = await request(employee.id, "10")
    const pendingFallback = await request(fallbackEmployee.id, "11")
    const pendingWithNotice = await request(employee.id, "12")
    const rejected = await request(employee.id, "13")
    await prisma.attendanceAdjustment.update({
      where: { id: rejected.id },
      data: {
        status: "REJECTED",
        reviewedById: currentHead.id,
        reviewedAt: new Date("2026-11-14T09:00:00Z"),
        reviewNote: "Historical overtime decision",
      },
    })
    async function previousNotice(
      attendanceAdjustmentId: string,
      userId: string,
    ) {
      return prisma.workflowNotification.create({
        data: {
          attendanceAdjustmentId,
          userId,
          type: "ATTENDANCE_OVERTIME_PENDING",
          summary: "Previous overtime notice",
          readAt: new Date("2026-11-14T09:00:00Z"),
        },
      })
    }
    const historical = [
      await previousNotice(pending.id, formerHead.id),
      await previousNotice(pending.id, superadmin.id),
      await previousNotice(pendingWithNotice.id, currentHead.id),
      await previousNotice(rejected.id, formerHead.id),
    ]
    const requests = () =>
      prisma.attendanceAdjustment.findMany({ orderBy: { id: "asc" } })
    const audit = () =>
      prisma.attendanceAudit.findMany({ orderBy: { id: "asc" } })
    const before = await requests()
    const beforeAudit = await audit()
    await db.exec(await readMigration(migration))

    const rows = await prisma.workflowNotification.findMany()
    for (const row of historical)
      assert.deepEqual(
        rows.find(({ id }) => id === row.id),
        row,
      )
    const newRows = rows.filter(
      ({ id }) => !historical.some((row) => row.id === id),
    )
    assert.deepEqual(
      newRows
        .map(({ userId, attendanceAdjustmentId, readAt, summary }) => ({
          userId,
          attendanceAdjustmentId,
          readAt,
          summary,
        }))
        .sort((a, b) => a.userId.localeCompare(b.userId)),
      [
        {
          userId: currentHead.id,
          attendanceAdjustmentId: pending.id,
          readAt: null,
          summary:
            "Legacy requester: 120 overtime minutes awaiting department verification.",
        },
        {
          userId: hr.id,
          attendanceAdjustmentId: pendingFallback.id,
          readAt: null,
          summary:
            "Legacy fallback requester: 120 overtime minutes awaiting HR review.",
        },
      ].sort((a, b) => a.userId.localeCompare(b.userId)),
    )
    assert.deepEqual(await requests(), before)
    assert.deepEqual(await audit(), beforeAudit)
  },
)

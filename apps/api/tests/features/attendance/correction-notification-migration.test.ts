import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import {
  applyMigrations,
  readMigration,
  startPgliteDatabase,
} from "../../support/pglite-app.js"

test(
  "correction notice migration backfills pending routes and retains historical reads",
  { timeout: 120000 },
  async (t) => {
    const migration = "20261121190000_correction_pending_notifications"
    const { prisma, db } = await startPgliteDatabase(t, {
      migrate: (database) =>
        applyMigrations(database, (name) => name < migration),
    })
    async function staff(name: string) {
      return prisma.user.create({
        data: {
          email: `${name}@correction-upgrade.test`,
          passwordHash: "test-only",
          role: "STAFF",
        },
      })
    }
    const requester = await staff("requester")
    const formerHead = await staff("former-head")
    const currentHead = await staff("current-head")
    const department = await prisma.department.create({
      data: { name: "Legacy correction", headId: currentHead.id },
    })
    const employee = await prisma.employee.create({
      data: {
        fullName: "Legacy requester",
        employeeId: "LEGACY-NOTICE",
        userId: requester.id,
        departmentId: department.id,
      },
    })
    const correction = await prisma.attendanceAdjustment.create({
      data: {
        requestKey: randomUUID(),
        type: "CORRECTION",
        employeeId: employee.id,
        requestedById: requester.id,
        proposedStartedAt: new Date("2026-11-13T09:00:00+08:00"),
        proposedEndedAt: new Date("2026-11-13T09:30:00+08:00"),
        reason: "Legacy pending correction with a prior reviewer",
      },
    })
    const historical = await prisma.workflowNotification.create({
      data: {
        attendanceAdjustmentId: correction.id,
        userId: formerHead.id,
        type: "ATTENDANCE_CORRECTION_PENDING",
        summary: "Previous correction notice",
        readAt: new Date("2026-11-14T09:00:00Z"),
      },
    })
    await db.exec(await readMigration(migration))
    const rows = await prisma.workflowNotification.findMany({
      where: { attendanceAdjustmentId: correction.id },
    })
    assert.equal(rows.length, 2)
    assert.deepEqual(
      rows.find(({ userId }) => userId === formerHead.id),
      historical,
    )
    assert.equal(
      rows.find(({ userId }) => userId === currentHead.id)?.readAt,
      null,
    )
    assert.deepEqual(
      await prisma.attendanceAdjustment.findUniqueOrThrow({
        where: { id: correction.id },
      }),
      correction,
    )
  },
)

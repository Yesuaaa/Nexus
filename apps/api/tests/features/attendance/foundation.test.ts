import assert from "node:assert/strict"
import { test } from "node:test"
import type { Prisma } from "../../../src/generated/prisma/client.js"
import {
  applyMigrations,
  readMigration,
  startPgliteDatabase,
} from "../../support/pglite-app.js"
import {
  attendancePolicyDays,
  attendanceTimestamp,
  attendanceTimeZone,
  attendanceWorkedMilliseconds,
  attendanceWorkDate,
  requiredAttendanceMinutes,
} from "../../../src/features/attendance/attendance.validation.js"

const migration = "20261113150000_attendance_foundation"
const instant = (value: string) => attendanceTimestamp(value)
const days = () =>
  Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    isWorkingDay: weekday > 0 && weekday < 6,
    requiredMinutes: weekday === 5 ? 450 : weekday > 0 && weekday < 6 ? 360 : 0,
  }))

test(
  "attendance migration and database invariants",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, db } = await startPgliteDatabase(t, {
      migrate: async (database) => {
        await applyMigrations(database, (name) => name < migration)
        await database.exec(`INSERT INTO "Employee" (id, "employeeId", "fullName", "updatedAt") VALUES ('existing-employee', 'EXISTING', 'Preserved Employee', '2026-01-01');
      INSERT INTO "WorkloadCapacity" (id, "employeeId", week, "scheduledHours", "timeOffHours", "updatedById") VALUES ('existing-capacity', 'existing-employee', '2026-11-09', 37.5, 2.5, 'existing-actor');`)
        const before = await database.query(
          'SELECT * FROM "Employee" ORDER BY id',
        )
        const capacityBefore = await database.query(
          'SELECT * FROM "WorkloadCapacity" ORDER BY id',
        )
        await database.exec(await readMigration(migration))
        await applyMigrations(database, (name) => name > migration)
        assert.deepEqual(
          (await database.query('SELECT * FROM "Employee" ORDER BY id')).rows,
          before.rows,
        )
        assert.deepEqual(
          (await database.query('SELECT * FROM "WorkloadCapacity" ORDER BY id'))
            .rows,
          capacityBefore.rows,
        )
      },
    })
    const employeeId = "existing-employee"
    const actor = await prisma.user.create({
      data: {
        email: "attendance-actor@example.com",
        passwordHash: "test-only",
        role: "ADMIN",
      },
    })
    const reject = async (
      write: (tx: Prisma.TransactionClient) => Promise<unknown>,
      message: RegExp,
    ) => {
      // Roll back expected errors explicitly: PGlite's socket stays reusable.
      await assert.rejects(prisma.$transaction(write), message)
    }

    await t.test(
      "no policies or attendance are inferred for existing employees",
      async () => {
        assert.equal(await prisma.attendancePolicy.count(), 0)
        assert.equal(await prisma.attendanceWorkday.count(), 0)
        await reject(
          (tx) =>
            tx.attendanceWorkSession.create({
              data: {
                employeeId,
                startedAt: instant("2026-11-13T09:00:00+08:00"),
              },
            }),
          /unique effective policy/,
        )
      },
    )

    const policy = await prisma.attendancePolicy.create({
      data: {
        name: "Flexible working week",
        timeZone: "Asia/Manila",
        days: { create: days() },
      },
    })
    await t.test(
      "policy validates timezone, duration, working days, and complete weekday setup",
      async () => {
        await reject(
          (tx) =>
            tx.attendancePolicy.create({
              data: { name: "Invalid", timeZone: "invalid-zone" },
            }),
          /Invalid attendance timezone/,
        )
        await reject(
          (tx) =>
            tx.attendancePolicyDay.update({
              where: { policyId_weekday: { policyId: policy.id, weekday: 0 } },
              data: { requiredMinutes: 60 },
            }),
          /attendance_rest_day/,
        )
        await reject(
          (tx) =>
            tx.attendancePolicyDay.update({
              where: { policyId_weekday: { policyId: policy.id, weekday: 5 } },
              data: { requiredMinutes: -1 },
            }),
          /attendance_daily_minutes/,
        )
        const incomplete = await prisma.attendancePolicy.create({
          data: { name: "Draft", timeZone: "UTC" },
        })
        await reject(
          (tx) =>
            tx.attendancePolicyAssignment.create({
              data: {
                employeeId,
                policyId: incomplete.id,
                effectiveFrom: new Date("2026-11-01"),
              },
            }),
          /seven weekdays/,
        )
      },
    )

    const assignment = await prisma.attendancePolicyAssignment.create({
      data: {
        employeeId,
        policyId: policy.id,
        effectiveFrom: new Date("2026-11-01"),
        effectiveUntil: new Date("2026-12-01"),
      },
    })
    await t.test(
      "assignments use exclusive end dates and preserve their timezone",
      async () => {
        await reject(
          (tx) =>
            tx.attendancePolicyAssignment.create({
              data: {
                employeeId,
                policyId: policy.id,
                effectiveFrom: new Date("2026-11-02"),
              },
            }),
          /assignments overlap/,
        )
        await reject(
          (tx) =>
            tx.attendancePolicyAssignment.create({
              data: {
                employeeId,
                policyId: policy.id,
                effectiveFrom: new Date("2026-12-01"),
                effectiveUntil: new Date("2026-12-01"),
              },
            }),
          /end must follow/,
        )
        await prisma.attendancePolicyAssignment.create({
          data: {
            employeeId,
            policyId: policy.id,
            effectiveFrom: new Date("2026-12-01"),
          },
        })
        await reject(
          (tx) =>
            tx.attendancePolicy.update({
              where: { id: policy.id },
              data: { timeZone: "UTC" },
            }),
          /immutable/,
        )
        await prisma.attendancePolicyDay.update({
          where: { policyId_weekday: { policyId: policy.id, weekday: 5 } },
          data: { requiredMinutes: 480 },
        })
        await prisma.attendancePolicyDay.update({
          where: { policyId_weekday: { policyId: policy.id, weekday: 5 } },
          data: { requiredMinutes: 450 },
        })
      },
    )

    const startedAt = instant("2026-11-13T22:00:00+08:00")
    const endedAt = instant("2026-11-14T06:00:00+08:00")
    const session = await prisma.attendanceWorkSession.create({
      data: { employeeId, startedAt, endedAt },
    })
    const day = await prisma.attendanceWorkday.findUniqueOrThrow({
      where: { id: session.workdayId },
    })
    await t.test(
      "overnight session defaults to its starting policy day and retains instants",
      async () => {
        assert.equal(day.workDate.toISOString().slice(0, 10), "2026-11-13")
        assert.equal(day.timeZone, "Asia/Manila")
        assert.equal(day.requiredMinutes, 450)
        assert.equal(day.isWorkingDay, true)
        assert.equal(
          session.startedAt.toISOString(),
          "2026-11-13T14:00:00.000Z",
        )
        assert.equal(session.endedAt?.toISOString(), "2026-11-13T22:00:00.000Z")
        await reject(
          (tx) =>
            tx.attendanceWorkday.update({
              where: { id: day.id },
              data: { requiredMinutes: 480 },
            }),
          /immutable/,
        )
        await reject(
          (tx) =>
            tx.attendancePolicyAssignment.update({
              where: { id: assignment.id },
              data: { effectiveUntil: new Date("2026-11-13") },
            }),
          /exclude recorded workdays/,
        )
      },
    )

    const unpaid = {
      startedAt: instant("2026-11-14T02:00:00+08:00"),
      endedAt: instant("2026-11-14T02:30:00+08:00"),
      isPaid: false,
    }
    const paid = {
      startedAt: instant("2026-11-14T03:00:00+08:00"),
      endedAt: instant("2026-11-14T03:15:00+08:00"),
      isPaid: true,
    }
    await prisma.attendanceBreak.create({
      data: { sessionId: session.id, ...unpaid },
    })
    await prisma.attendanceBreak.create({
      data: { sessionId: session.id, ...paid },
    })
    await t.test(
      "breaks stay within sessions without overlap or double deduction",
      async () => {
        await reject(
          (tx) =>
            tx.attendanceBreak.create({
              data: { sessionId: session.id, ...unpaid },
            }),
          /breaks overlap/,
        )
        await reject(
          (tx) =>
            tx.attendanceBreak.create({
              data: {
                sessionId: session.id,
                startedAt: endedAt,
                endedAt: instant("2026-11-14T07:00:00+08:00"),
              },
            }),
          /outside session/,
        )
        assert.equal(
          attendanceWorkedMilliseconds([
            { startedAt, endedAt, breaks: [unpaid, paid] },
          ]),
          7.5 * 3600000,
        )
      },
    )

    const second = {
      startedAt: endedAt,
      endedAt: instant("2026-11-14T07:00:00+08:00"),
      breaks: [],
    }
    await prisma.attendanceWorkSession.create({
      data: {
        employeeId,
        workdayId: day.id,
        startedAt: second.startedAt,
        endedAt: second.endedAt,
      },
    })
    const saturday = await prisma.attendanceWorkSession.create({
      data: {
        employeeId,
        startedAt: instant("2026-11-14T08:00:00+08:00"),
        endedAt: instant("2026-11-14T09:00:00+08:00"),
      },
    })
    await t.test(
      "multiple sessions share one requirement and overlap checks span workdays",
      async () => {
        assert.equal(
          await prisma.attendanceWorkSession.count({
            where: { workdayId: day.id },
          }),
          2,
        )
        assert.equal(
          attendanceWorkedMilliseconds([
            { startedAt, endedAt, breaks: [unpaid, paid] },
            second,
          ]),
          8.5 * 3600000,
        )
        const rest = await prisma.attendanceWorkday.findUniqueOrThrow({
          where: { id: saturday.workdayId },
        })
        assert.equal(rest.requiredMinutes, 0)
        assert.equal(rest.isWorkingDay, false)
        assert.notEqual(rest.id, day.id)
        await reject(
          (tx) =>
            tx.attendanceWorkSession.create({
              data: {
                employeeId,
                workdayId: rest.id,
                startedAt: instant("2026-11-14T05:00:00+08:00"),
                endedAt: second.endedAt,
              },
            }),
          /sessions overlap/,
        )
        await reject(
          (tx) =>
            tx.attendanceWorkSession.create({
              data: { employeeId, startedAt: endedAt, endedAt: startedAt },
            }),
          /end must follow/,
        )
        await reject(
          (tx) =>
            tx.attendanceWorkSession.create({
              data: { employeeId: actor.id, workdayId: day.id, startedAt },
            }),
          /belong to the employee/,
        )
      },
    )

    await t.test(
      "open sessions and breaks are unique and must close in order",
      async () => {
        const open = await prisma.attendanceWorkSession.create({
          data: { employeeId, startedAt: instant("2026-11-15T09:00:00+08:00") },
        })
        const pause = await prisma.attendanceBreak.create({
          data: {
            sessionId: open.id,
            startedAt: instant("2026-11-15T10:00:00+08:00"),
          },
        })
        await reject(
          (tx) =>
            tx.attendanceWorkSession.create({
              data: {
                employeeId,
                startedAt: instant("2026-11-16T09:00:00+08:00"),
              },
            }),
          /sessions overlap/,
        )
        await reject(
          (tx) =>
            tx.attendanceBreak.create({
              data: {
                sessionId: open.id,
                startedAt: instant("2026-11-15T10:30:00+08:00"),
              },
            }),
          /breaks overlap/,
        )
        await reject(
          (tx) =>
            tx.attendanceWorkSession.update({
              where: { id: open.id },
              data: { endedAt: instant("2026-11-15T12:00:00+08:00") },
            }),
          /exclude a break/,
        )
        await prisma.attendanceBreak.update({
          where: { id: pause.id },
          data: { endedAt: instant("2026-11-15T11:00:00+08:00") },
        })
        await prisma.attendanceWorkSession.update({
          where: { id: open.id },
          data: { endedAt: instant("2026-11-15T12:00:00+08:00") },
        })
      },
    )

    await t.test(
      "automatic append-only history captures policies, assignments, sessions, and breaks",
      async () => {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.attendance_actor_id', ${actor.id}, true)`
          await tx.$executeRaw`SELECT set_config('app.attendance_reason', 'Corrected end time', true)`
          await tx.attendanceWorkSession.update({
            where: { id: saturday.id },
            data: { endedAt: instant("2026-11-14T09:30:00+08:00") },
          })
        })
        const audit = await prisma.attendanceAudit.findFirstOrThrow({
          where: { entityId: saturday.id, action: "UPDATE" },
        })
        assert.equal(audit.actorId, actor.id)
        assert.equal(audit.reason, "Corrected end time")
        assert.ok(audit.before)
        assert.ok(audit.after)
        const entities = new Set(
          (await prisma.attendanceAudit.findMany()).map(
            (entry) => entry.entityType,
          ),
        )
        for (const entity of [
          "AttendancePolicy",
          "AttendancePolicyDay",
          "AttendancePolicyAssignment",
          "AttendanceWorkday",
          "AttendanceWorkSession",
          "AttendanceBreak",
        ])
          assert.ok(entities.has(entity))
        await reject(
          (tx) => tx.attendanceAudit.delete({ where: { id: audit.id } }),
          /append-only/,
        )
        await reject(
          (tx) =>
            tx.attendanceAudit.update({
              where: { id: audit.id },
              data: { reason: "Altered" },
            }),
          /append-only/,
        )
        await reject(
          (tx) => tx.employee.delete({ where: { id: employeeId } }),
          /Foreign key constraint/,
        )
        assert.equal(
          (
            await db.query<{ scheduledHours: number }>(
              'SELECT "scheduledHours" FROM "WorkloadCapacity"',
            )
          ).rows[0].scheduledHours,
          37.5,
        )
      },
    )

    await t.test(
      "repeatable-read mutations reject stale-snapshot overlap checks",
      async () => {
        await assert.rejects(
          prisma.$transaction(
            (tx) =>
              tx.attendanceWorkSession.create({
                data: {
                  employeeId,
                  startedAt: instant("2026-11-20T09:00:00+08:00"),
                },
              }),
            { isolationLevel: "RepeatableRead" },
          ),
          /ReadCommitted or Serializable/,
        )
      },
    )
  },
)

test("attendance validation handles flexible durations, timezones, and explicit instants", () => {
  assert.equal(requiredAttendanceMinutes(0), 0)
  assert.equal(requiredAttendanceMinutes(450), 450)
  for (const value of [-1, 1441, 1.5, NaN, "450", null])
    assert.throws(() => requiredAttendanceMinutes(value))
  assert.equal(attendancePolicyDays(days()).length, 7)
  assert.throws(() => attendancePolicyDays(days().slice(1)))
  assert.throws(() =>
    attendancePolicyDays(days().map((day) => ({ ...day, weekday: 0 }))),
  )
  assert.throws(() =>
    attendancePolicyDays(
      days().map((day) => ({ ...day, isWorkingDay: false })),
    ),
  )
  assert.equal(attendanceTimeZone("Asia/Manila"), "Asia/Manila")
  assert.throws(() => attendanceTimeZone("invalid-zone"))
  assert.equal(
    attendanceWorkDate(instant("2026-11-13T23:30:00Z"), "Asia/Manila"),
    "2026-11-14",
  )
  assert.equal(
    attendanceWorkDate(instant("2026-11-13T23:30:00Z"), "America/New_York"),
    "2026-11-13",
  )
  for (const value of [
    "2026-02-30T09:00:00Z",
    "2026-11-13",
    "2026-11-13T09:00:00",
    "2026-11-13T24:00:00Z",
    null,
  ])
    assert.throws(() => attendanceTimestamp(value))
  assert.throws(() => attendanceWorkDate(new Date(NaN), "UTC"))
  const session = {
    startedAt: instant("2026-11-13T09:00:00Z"),
    endedAt: instant("2026-11-13T10:00:00Z"),
    breaks: [],
  }
  assert.throws(() => attendanceWorkedMilliseconds([session, session]))
  assert.throws(() =>
    attendanceWorkedMilliseconds([{ ...session, endedAt: session.startedAt }]),
  )
  // Actual elapsed time remains correct across a DST fallback.
  assert.equal(
    attendanceWorkedMilliseconds([
      {
        startedAt: instant("2026-11-01T01:30:00-04:00"),
        endedAt: instant("2026-11-01T01:30:00-05:00"),
        breaks: [],
      },
    ]),
    3600000,
  )
})

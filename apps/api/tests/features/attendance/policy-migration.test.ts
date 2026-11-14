import assert from "node:assert/strict"
import { test } from "node:test"
import {
  applyMigrations,
  startPgliteDatabase,
} from "../../support/pglite-app.js"

test(
  "policy management migration backfills rules for existing workdays",
  { timeout: 120000 },
  async (t) => {
    const migration = "20261113170000_attendance_policy_management"
    const { prisma } = await startPgliteDatabase(t, {
      migrate: async (db) => {
        await applyMigrations(db, (name) => name < migration)
        await db.exec(`
        INSERT INTO "Employee" (id, "employeeId", "fullName", "updatedAt") VALUES ('backfill-employee', 'BACKFILL', 'Existing Employee', CURRENT_TIMESTAMP);
        INSERT INTO "AttendancePolicy" (id, name, "timeZone", "unpaidBreaksEnabled", "overnightRequiresReview") VALUES ('backfill-policy', 'Existing policy', 'Asia/Manila', false, true);
        INSERT INTO "AttendancePolicyDay" ("policyId", weekday, "isWorkingDay", "requiredMinutes") SELECT 'backfill-policy', weekday, true, 450 FROM generate_series(0, 6) AS weekday;
        INSERT INTO "AttendancePolicyAssignment" (id, "employeeId", "policyId", "effectiveFrom") VALUES ('backfill-assignment', 'backfill-employee', 'backfill-policy', '2026-01-01');
        INSERT INTO "AttendanceWorkSession" (id, "employeeId", "startedAt", "endedAt") VALUES ('backfill-session', 'backfill-employee', '2026-11-13T01:00:00Z', '2026-11-13T02:00:00Z');
      `)
        await applyMigrations(db, (name) => name >= migration)
      },
    })
    const day = await prisma.attendanceWorkday.findFirstOrThrow()
    assert.equal(day.policyName, "Existing policy")
    assert.equal(day.unpaidBreaksEnabled, false)
    assert.equal(day.overnightRequiresReview, true)
    assert.equal(day.requiredMinutes, 450)
    assert.equal(day.timeZone, "Asia/Manila")
    await assert.rejects(
      prisma.$transaction((tx) =>
        tx.attendanceWorkday.update({
          where: { id: day.id },
          data: { policyName: "Rewritten" },
        }),
      ),
      /snapshots are immutable/,
    )
  },
)

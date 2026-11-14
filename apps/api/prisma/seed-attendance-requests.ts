import "dotenv/config"
import { randomUUID } from "node:crypto"
import { getPrisma } from "../src/lib/db.js"
import { createAttendanceManagement } from "../src/features/attendance/attendance.management.js"

async function main() {
  const prisma = getPrisma()
  if (!prisma) throw new Error("Set DATABASE_URL before seeding")
  try {
    const assignments = await prisma.attendancePolicyAssignment.findMany({
      where: {
        policyId: "demo-attendance-adjustments-policy",
        employee: {
          user: {
            is: {
              role: "STAFF",
              isActive: true,
              accountDeletedAt: null,
              email: { endsWith: "@example.com" },
            },
          },
        },
      },
      include: { employee: true },
      orderBy: { employeeId: "asc" },
      take: 3,
    })
    if (!assignments.length)
      throw new Error("Seed demo correction requests first")
    const management = createAttendanceManagement(() => new Date())
    let created = 0
    for (const assignment of assignments) {
      const employee = assignment.employee
      if (!employee.userId) continue
      const reason = "[Demo] Overtime for an urgent client delivery."
      if (
        await prisma.attendanceAdjustment.findFirst({
          where: { employeeId: employee.id, type: "OVERTIME", reason },
        })
      )
        continue
      const sessionId = `demo-overtime-session-${employee.id}`
      let session = await prisma.attendanceWorkSession.findUnique({
        where: { id: sessionId },
      })
      if (!session) {
        for (let offset = 0; offset < 10; offset++) {
          const date = new Date(
            assignment.effectiveFrom.getTime() + offset * 86400000,
          )
          if (assignment.effectiveUntil && date >= assignment.effectiveUntil)
            break
          const day = date.toISOString().slice(0, 10)
          const start = new Date(`${day}T09:00:00+08:00`),
            end = new Date(`${day}T20:00:00+08:00`)
          if (end >= new Date()) continue
          if (
            await prisma.attendanceWorkday.findUnique({
              where: {
                employeeId_workDate: {
                  employeeId: employee.id,
                  workDate: date,
                },
              },
            })
          )
            continue
          if (
            await prisma.attendanceAdjustment.findFirst({
              where: {
                employeeId: employee.id,
                proposedStartedAt: { lt: end },
                proposedEndedAt: { gt: start },
              },
            })
          )
            continue
          session = await prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.attendance_reason', ${"Seeded demo overtime attendance"}, true)`
            return tx.attendanceWorkSession.create({
              data: {
                id: sessionId,
                employeeId: employee.id,
                startedAt: start,
                endedAt: end,
                breaks: {
                  create: {
                    startedAt: new Date(`${day}T12:00:00+08:00`),
                    endedAt: new Date(`${day}T13:00:00+08:00`),
                    isPaid: false,
                  },
                },
              },
            })
          })
          break
        }
      }
      if (!session?.endedAt)
        throw new Error(
          `No unused demo date available for ${employee.fullName}`,
        )
      await management.requestAdjustment(employee.userId, {
        type: "OVERTIME",
        requestKey: randomUUID(),
        reason,
        startedAt: new Date(
          session.endedAt.getTime() - 2 * 3600000,
        ).toISOString(),
        endedAt: session.endedAt.toISOString(),
      })
      created++
      console.log(`Seeded pending overtime: ${employee.fullName}, 120 minutes`)
    }
    console.log(
      `Created ${created} overtime requests; existing corrections and requests preserved.`,
    )
    console.log(
      `Verified ${await prisma.attendanceAdjustment.count({ where: { type: "OVERTIME", reason: { startsWith: "[Demo]" } } })} demo overtime requests.`,
    )
  } finally {
    await prisma.$disconnect()
  }
}
main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})

import "dotenv/config"
import { getPrisma } from "../src/lib/db.js"

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
      throw new Error(
        "Seed demo attendance adjustments before seeding time logs",
      )
    let created = 0
    for (const assignment of assignments) {
      if (!assignment.effectiveUntil) continue
      let selected = 0
      for (let offset = 1; offset <= 10 && selected < 5; offset += 1) {
        const date = new Date(
          assignment.effectiveUntil.getTime() - offset * 86400000,
        )
        if (
          date < assignment.effectiveFrom ||
          date.getUTCDay() === 0 ||
          date.getUTCDay() === 6
        )
          continue
        const day = date.toISOString().slice(0, 10)
        const sessionId = `demo-time-log-${assignment.employeeId}-${day}`
        const startedAt = new Date(`${day}T09:00:00+08:00`)
        const endedAt = new Date(
          `${day}T${selected % 3 === 1 ? "16" : "18"}:00:00+08:00`,
        )
        if (endedAt >= new Date()) continue
        const result = await prisma.$transaction(async (tx) => {
          if (
            await tx.attendanceWorkSession.findUnique({
              where: { id: sessionId },
            })
          )
            return "existing"
          const workday = await tx.attendanceWorkday.findUnique({
            where: {
              employeeId_workDate: {
                employeeId: assignment.employeeId,
                workDate: date,
              },
            },
          })
          const correction = await tx.attendanceAdjustment.findFirst({
            where: {
              employeeId: assignment.employeeId,
              proposedStartedAt: { lt: endedAt },
              proposedEndedAt: { gt: startedAt },
            },
          })
          if (workday || correction) return "skipped"
          await tx.$executeRaw`SELECT set_config('app.attendance_reason', ${"Seeded demo completed time log"}, true)`
          await tx.attendanceWorkSession.create({
            data: {
              id: sessionId,
              employeeId: assignment.employeeId,
              startedAt,
              endedAt,
              breaks: {
                create: {
                  startedAt: new Date(`${day}T12:00:00+08:00`),
                  endedAt: new Date(`${day}T13:00:00+08:00`),
                  isPaid: false,
                },
              },
            },
          })
          return "created"
        })
        if (result === "skipped") continue
        selected += 1
        if (result === "created") created += 1
        console.log(`${result}: ${assignment.employee.fullName}, ${day}`)
      }
    }
    const total = await prisma.attendanceWorkSession.count({
      where: { id: { startsWith: "demo-time-log-" } },
    })
    console.log(
      `Created ${created} time logs. Verified ${total} demo time logs.`,
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})

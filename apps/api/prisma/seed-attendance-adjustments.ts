import "dotenv/config"
import { randomUUID } from "node:crypto"
import { getPrisma } from "../src/lib/db.js"
import { createAttendanceManagement } from "../src/features/attendance/attendance.management.js"

const policyId = "demo-attendance-adjustments-policy"
const reasons = [
  "[Demo] Missing morning clock-in after a device connection issue.",
  "[Demo] Missing afternoon session after an offsite client meeting.",
] as const

async function main() {
  const prisma = getPrisma()
  if (!prisma) throw new Error("Set DATABASE_URL before seeding")
  try {
    const employees = await prisma.employee.findMany({
      where: {
        user: {
          is: {
            role: "STAFF",
            isActive: true,
            accountDeletedAt: null,
            email: { endsWith: "@example.com" },
          },
        },
      },
      select: {
        id: true,
        fullName: true,
        userId: true,
      },
      orderBy: { fullName: "asc" },
      take: 3,
    })
    if (!employees.length)
      throw new Error("Seed demo staff before seeding correction requests")
    const policy = await prisma.attendancePolicy.upsert({
      where: { id: policyId },
      update: {},
      create: {
        id: policyId,
        name: "Demo correction request policy",
        timeZone: "Asia/Manila",
        days: {
          create: Array.from({ length: 7 }, (_, weekday) => ({
            weekday,
            isWorkingDay: weekday > 0 && weekday < 6,
            requiredMinutes: weekday > 0 && weekday < 6 ? 480 : 0,
          })),
        },
      },
    })
    const anchor = new Date(
      `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Manila" }).format(policy.createdAt)}T00:00:00Z`,
    )
    const from = new Date(anchor.getTime() - 10 * 86400000)
    const management = createAttendanceManagement(() => new Date())
    let seeded = 0
    for (const employee of employees) {
      const userId = employee.userId
      if (!userId) continue
      const assignmentId = `demo-correction-assignment-${employee.id}`
      await prisma.$transaction(async (tx) => {
        const existing = await tx.attendancePolicyAssignment.findUnique({
          where: { id: assignmentId },
        })
        if (existing) return
        const overlap = await tx.attendancePolicyAssignment.findFirst({
          where: {
            employeeId: employee.id,
            effectiveFrom: { lt: anchor },
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: from } }],
          },
        })
        if (overlap)
          throw new Error(
            `Demo assignment would overlap an existing policy for ${employee.fullName}`,
          )
        await tx.$executeRaw`SELECT set_config('app.attendance_reason', ${"Seeded demo correction request policy assignment"}, true)`
        await tx.attendancePolicyAssignment.create({
          data: {
            id: assignmentId,
            employeeId: employee.id,
            policyId,
            effectiveFrom: from,
            effectiveUntil: anchor,
          },
        })
      })
      for (const [index, reason] of reasons.entries()) {
        const existing = await prisma.attendanceAdjustment.findFirst({
          where: { employeeId: employee.id, reason },
        })
        if (existing) {
          console.log(
            `Already seeded: ${employee.fullName} (${existing.status})`,
          )
          continue
        }
        const date = new Date(anchor.getTime() - (index + 2) * 86400000)
          .toISOString()
          .slice(0, 10)
        await management.requestAdjustment(userId, {
          requestKey: randomUUID(),
          startedAt: `${date}T${index ? "13" : "09"}:00:00+08:00`,
          endedAt: `${date}T${index ? "17" : "12"}:00:00+08:00`,
          reason,
        })
        seeded += 1
        console.log(`Seeded pending correction: ${employee.fullName}, ${date}`)
      }
    }
    console.log(
      `Created ${seeded} pending correction requests. Existing requests were preserved.`,
    )
    const pending = await prisma.attendanceAdjustment.count({
      where: {
        employeeId: { in: employees.map((employee) => employee.id) },
        reason: { in: [...reasons] },
        status: "PENDING",
      },
    })
    console.log(`Verified ${pending} pending demo requests in the database.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})

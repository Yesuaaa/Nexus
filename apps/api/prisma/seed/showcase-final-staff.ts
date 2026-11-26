import { getPrisma } from "../../src/lib/db.js"
import { weekValue } from "../../src/features/workload/workload.schema.js"
import { assertPhase2Target } from "./showcase-phase2-foundation.js"
import { assertShowcaseRealtimeDisabled } from "./showcase-realtime.js"
import { showcaseId } from "./showcase-plan.js"

const skills: Record<string, string[]> = {
  "Digital Studio Lead": [
    "Creative Direction",
    "Design Strategy",
    "Team Leadership",
  ],
  "Project Coordinator": [
    "Project Planning",
    "Scheduling",
    "Resource Coordination",
  ],
  Designer: ["Figma", "Graphic Design", "Branding"],
  "Web Developer": ["React", "TypeScript", "Responsive Design"],
}

export async function seedFinalShowcaseStaff(
  headId: string,
  weekInput: string,
  apply = false,
) {
  const target = assertPhase2Target(process.env)
  const week = weekValue(weekInput)
  const weekStart = new Date(`${week}T00:00:00Z`)
  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000)
  const db = getPrisma()
  if (!db) throw new Error("Database configuration is required")
  return db.$transaction(
    async (tx) => {
      const [connected] = await tx.$queryRaw<
        { name: string }[]
      >`SELECT current_database() AS name`
      if (connected?.name !== target.database)
        throw new Error("Connected database does not match confirmed target")
      await assertShowcaseRealtimeDisabled(tx)
      const department = await tx.department.findFirst({
        where: {
          headId,
          head: {
            email: "advertising.head@local.test",
            role: "STAFF",
            isActive: true,
            accountDeletedAt: null,
          },
        },
        select: { id: true },
      })
      if (!department) throw new Error("Confirmed Advertising head required")
      const result = {
        skillsUpdated: 0,
        skillsSkipped: 0,
        capacitiesCreated: 0,
        capacitiesSkipped: 0,
      }
      for (let index = 0; index < 20; index++) {
        const id = showcaseId("employee", index)
        const employee = await tx.employee.findUnique({
          where: { id },
          select: {
            departmentId: true,
            status: true,
            employmentType: true,
            position: true,
            profileSpecialties: true,
            user: {
              select: {
                id: true,
                email: true,
                isActive: true,
                accountDeletedAt: true,
                role: true,
              },
            },
          },
        })
        if (
          !employee ||
          employee.departmentId !== department.id ||
          employee.status !== "ACTIVE" ||
          employee.user?.id !== showcaseId("user", index + 2) ||
          employee.user.email !== `team${index + 1}@showcase.invalid` ||
          employee.user.role !== "STAFF" ||
          !employee.user.isActive ||
          employee.user.accountDeletedAt
        )
          throw new Error("Showcase employee ownership changed")
        const mapped = employee.position ? skills[employee.position] : undefined
        if (employee.profileSpecialties.length === 0 && mapped) {
          result.skillsUpdated++
          if (apply)
            await tx.employee.update({
              where: { id },
              data: { profileSpecialties: mapped },
            })
        } else result.skillsSkipped++
        const capacity = await tx.workloadCapacity.findUnique({
          where: { employeeId_week: { employeeId: id, week } },
          select: { id: true },
        })
        const approvedLeave = await tx.leaveRequest.count({
          where: {
            employeeId: id,
            status: "APPROVED",
            startDate: { lte: weekEnd },
            endDate: { gte: weekStart },
          },
        })
        if (
          capacity ||
          employee.employmentType !== "FULL_TIME" ||
          approvedLeave > 0
        ) {
          result.capacitiesSkipped++
          continue
        }
        result.capacitiesCreated++
        if (apply)
          await tx.workloadCapacity.create({
            data: {
              id: showcaseId(`capacity-${week}`, index),
              employeeId: id,
              week,
              scheduledHours: 40,
              timeOffHours: 0,
              updatedById: headId,
            },
          })
      }
      return result
    },
    { isolationLevel: "Serializable", timeout: 30000 },
  )
}

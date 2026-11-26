import { getPrisma } from "../../src/lib/db.js"
import { weekValue } from "../../src/features/workload/workload.schema.js"
import { assertPhase2Target } from "./showcase-phase2-foundation.js"
import { assertShowcaseRealtimeDisabled } from "./showcase-realtime.js"
import { showcaseId, showcaseUuid } from "./showcase-plan.js"

/** Enrich only untouched allocations in the four workflow-activated showcase projects. */
export async function seedShowcaseWorkload(
  headId: string,
  weekInput: string,
  apply = true,
) {
  const target = assertPhase2Target(process.env)
  const week = weekValue(weekInput)
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
          head: { role: "STAFF", isActive: true, accountDeletedAt: null },
        },
        select: { id: true },
      })
      if (!department) throw new Error("An active department head is required")
      const ids = Array.from({ length: 8 }, (_, index) =>
        showcaseId("employee", index),
      )
      const employees = await tx.employee.findMany({
        where: {
          id: { in: ids },
          departmentId: department.id,
          status: "ACTIVE",
          user: { role: "STAFF", isActive: true, accountDeletedAt: null },
        },
        select: { id: true, user: { select: { id: true, email: true } } },
      })
      if (
        employees.length !== ids.length ||
        employees.some((employee) => {
          const index = ids.indexOf(employee.id)
          return (
            employee.user?.id !== showcaseId("user", index + 2) ||
            employee.user.email !== `team${index + 1}@showcase.invalid`
          )
        })
      )
        throw new Error(
          "Eight active showcase employees in the head's department are required",
        )
      const projects = await tx.project.findMany({
        where: {
          status: { in: ["IN_PROGRESS", "ON_HOLD"] },
          request: {
            submissionKey: {
              in: Array.from({ length: 4 }, (_, index) =>
                showcaseUuid("phase2-request", index),
              ),
            },
            acceptedDepartmentId: department.id,
            workflow: { state: "ACTIVE_PROJECT" },
          },
        },
        select: {
          id: true,
          status: true,
          request: { select: { submissionKey: true } },
        },
      })
      if (projects.length !== 4)
        throw new Error("Four active Phase 2 showcase projects are required")
      const start = new Date(`${week}T00:00:00.000Z`)
      const end = new Date(start.getTime() + 27 * 86400000)
      const counts = {
        createdCapacities: 0,
        updatedAllocations: 0,
        skippedCapacities: 0,
        skippedAllocations: 0,
      }
      for (const [index, employeeId] of ids.entries()) {
        const existing = await tx.workloadCapacity.findUnique({
          where: { employeeId_week: { employeeId, week } },
          select: { id: true },
        })
        if (existing) {
          counts.skippedCapacities++
          continue
        }
        counts.createdCapacities++
        if (apply)
          await tx.workloadCapacity.create({
            data: {
              id: showcaseId(`capacity-${week}`, index),
              employeeId,
              week,
              scheduledHours: index === 5 ? 32 : 40,
              timeOffHours: 0,
              updatedById: headId,
            },
          })
      }
      const allocationHours = [7, 9, 11, 5]
      for (const project of projects) {
        for (const [index, employeeId] of ids.slice(0, 4).entries()) {
          const assignment = await tx.projectStaff.findUnique({
            where: {
              projectId_employeeId: { projectId: project.id, employeeId },
            },
            select: {
              id: true,
              weeklyHours: true,
              allocationStart: true,
              allocationEnd: true,
            },
          })
          if (!assignment)
            throw new Error(
              "Expected existing showcase project assignments are missing",
            )
          if (
            assignment.weeklyHours !== null ||
            assignment.allocationStart !== null ||
            assignment.allocationEnd !== null
          ) {
            counts.skippedAllocations++
            continue
          }
          if (project.status === "ON_HOLD") {
            counts.skippedAllocations++
            continue
          }
          counts.updatedAllocations++
          if (apply) {
            const updated = await tx.projectStaff.updateMany({
              where: {
                id: assignment.id,
                weeklyHours: null,
                allocationStart: null,
                allocationEnd: null,
              },
              data: {
                weeklyHours: allocationHours[index],
                allocationStart: start,
                allocationEnd: end,
              },
            })
            if (updated.count !== 1)
              throw new Error("Allocation changed during seed; retry inventory")
          }
        }
      }
      const featured = await tx.project.findFirst({
        where: {
          status: "IN_PROGRESS",
          request: {
            submissionKey: showcaseUuid("featured-request", 0),
            acceptedDepartmentId: department.id,
            workflow: { state: "ACTIVE_PROJECT" },
          },
        },
        select: { id: true },
      })
      if (featured) {
        for (const [index, employeeId] of ids.slice(0, 6).entries()) {
          const assignment = await tx.projectStaff.findUnique({
            where: {
              projectId_employeeId: { projectId: featured.id, employeeId },
            },
            select: {
              id: true,
              weeklyHours: true,
              allocationStart: true,
              allocationEnd: true,
            },
          })
          if (!assignment)
            throw new Error("Featured project staffing is incomplete")
          if (
            assignment.weeklyHours !== null ||
            assignment.allocationStart !== null ||
            assignment.allocationEnd !== null
          ) {
            counts.skippedAllocations++
            continue
          }
          counts.updatedAllocations++
          if (apply) {
            const updated = await tx.projectStaff.updateMany({
              where: {
                id: assignment.id,
                weeklyHours: null,
                allocationStart: null,
                allocationEnd: null,
              },
              data: {
                weeklyHours: index < 4 ? 2 : 4,
                allocationStart: start,
                allocationEnd: end,
              },
            })
            if (updated.count !== 1)
              throw new Error("Allocation changed during seed; retry inventory")
          }
        }
      }
      return counts
    },
    { isolationLevel: "Serializable", timeout: 30000 },
  )
}

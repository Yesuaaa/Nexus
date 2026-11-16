import type { Prisma } from "../../generated/prisma/client.js"
import { activeStaff } from "../../shared/query/accounts.js"
import { workloadPlanningContext } from "./workload-availability.service.js"

/** Shared read only; callers must authorize the requested scope separately. */
export async function readDepartmentWorkload(
  tx: Prisma.TransactionClient,
  department: { id: string | null; headId: string | null },
  week: string,
) {
  const end = new Date(`${week}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 6)
  const staff = await tx.employee.findMany({
    where: { departmentId: department.id, user: activeStaff },
    select: {
      id: true,
      userId: true,
      fullName: true,
      position: true,
      status: true,
      profileSpecialties: true,
      team: { select: { id: true, name: true } },
      projectAssignments: {
        where: {
          project: {
            status: { in: ["PLANNED", "IN_PROGRESS", "ON_HOLD"] },
          },
        },
        include: {
          project: { select: { id: true, name: true, status: true } },
        },
      },
    },
    orderBy: { fullName: "asc" },
  })
  const planning = await workloadPlanningContext(tx, department, week, staff)
  const capacities = await tx.workloadCapacity.findMany({
    where: { week, employeeId: { in: staff.map((s) => s.id) } },
  })
  return staff.map((employee) => ({
    ...employee,
    userId: undefined,
    planning: planning.get(employee.id),
    capacity: capacities.find((c) => c.employeeId === employee.id) ?? null,
    assignments: employee.projectAssignments.filter(
      (a) =>
        (!a.allocationStart || a.allocationStart <= end) &&
        (!a.allocationEnd || a.allocationEnd >= new Date(`${week}T00:00:00Z`)),
    ),
    projectAssignments: undefined,
  }))
}

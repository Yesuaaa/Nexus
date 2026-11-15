import { Router } from "express"
import { getPrisma } from "../../lib/db.js"
import { fail } from "../../shared/http-error.js"
import { requireAuth } from "../auth/auth.middleware.js"
import {
  AdministrativeCapability,
  hasAdministrativeCapability,
} from "../auth/auth.capabilities.js"
import { readDepartmentWorkload } from "./workload-read.service.js"
import { weekValue } from "./workload.schema.js"

export const administrativeWorkloadRouter = Router()
administrativeWorkloadRouter.use(requireAuth, (request, _response, next) => {
  const actor = request.auth!.user
  if (
    !hasAdministrativeCapability(
      actor,
      AdministrativeCapability.MODULE_ACCESS,
    ) ||
    !hasAdministrativeCapability(
      actor,
      AdministrativeCapability.ORGANIZATION_READ,
    )
  )
    fail(403, "Organization-wide workload read access is required")
  next()
})

administrativeWorkloadRouter.get("/", async (request, response) => {
  const week = weekValue(request.query.week)
  const result = await getPrisma()!.$transaction(
    async (tx) => {
      const departments = await tx.department.findMany({
        select: { id: true, name: true, headId: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      })
      const groups = [
        ...departments,
        { id: null, name: "No department", headId: null },
      ]
      const staff = []
      for (const department of groups) {
        const rows = await readDepartmentWorkload(tx, department, week)
        for (const row of rows) {
          const planning = row.planning!
          // Response-local IDs preserve conflict matching without exposing private
          // meeting/consultation identifiers or implying conversation access.
          const ids = new Map(
            planning.commitments.map((item, index) => [
              item.id,
              `commitment-${index + 1}`,
            ]),
          )
          staff.push({
            id: row.id,
            fullName: row.fullName,
            position: row.position,
            status: row.status,
            profileSpecialties: row.profileSpecialties,
            team: row.team,
            department: department.id
              ? { id: department.id, name: department.name }
              : null,
            capacity: row.capacity
              ? {
                  scheduledHours: row.capacity.scheduledHours,
                  timeOffHours: row.capacity.timeOffHours,
                }
              : null,
            assignments: row.assignments.map((assignment) => ({
              id: assignment.id,
              employeeId: assignment.employeeId,
              projectId: assignment.projectId,
              weeklyHours: assignment.weeklyHours,
              allocationStart: assignment.allocationStart,
              allocationEnd: assignment.allocationEnd,
              project: assignment.project,
            })),
            planning: {
              ...planning,
              commitments: planning.commitments.map((item) => ({
                ...item,
                id: ids.get(item.id)!,
              })),
              overlaps: planning.overlaps.map((pair) => ({
                firstId: ids.get(pair.firstId)!,
                secondId: ids.get(pair.secondId)!,
              })),
            },
          })
        }
      }
      return {
        department: null,
        departments: departments.map(({ id, name }) => ({ id, name })),
        week,
        staff,
        projects: [],
        capabilities: {
          read: true,
          manageCapacity: false,
          assign: false,
          reassign: false,
          unassign: false,
          updateAvailability: false,
        },
      }
    },
    { isolationLevel: "RepeatableRead" },
  )
  response.json(result)
})

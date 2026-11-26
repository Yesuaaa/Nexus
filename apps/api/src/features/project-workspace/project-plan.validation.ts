import { isRecordId } from "../../shared/validation.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import { readWorkPlan, type ProjectWorkPlan } from "./templates.js"

export const MAX_PHASE_TASKS = 50

export function validateEditablePlan(input: unknown): ProjectWorkPlan {
  const plan = readWorkPlan(input)
  if (
    !plan ||
    !plan.phases.length ||
    plan.phases.length > 20 ||
    plan.phases.some(
      (phase) =>
        !phase.title.trim() ||
        phase.title.length > 120 ||
        phase.tasks.length > MAX_PHASE_TASKS ||
        phase.tasks.some(
          (task) =>
            !task.title.trim() ||
            task.title.length > 180 ||
            task.role.length > 80,
        ),
    )
  )
    throw new ServiceRequestsError(
      400,
      `Add 1–20 named phases, with up to ${MAX_PHASE_TASKS} named tasks per phase`,
    )
  const ids = plan.phases.flatMap((phase) => [
    phase.id,
    ...phase.tasks.map((task) => task.id),
  ])
  for (const task of plan.phases.flatMap((phase) => phase.tasks)) {
    if (task.employeeId != null && !isRecordId(task.employeeId))
      throw new ServiceRequestsError(400, "Choose a valid assigned employee")
    if (
      task.dueDate != null &&
      (typeof task.dueDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) ||
        !Number.isFinite(Date.parse(task.dueDate)) ||
        new Date(task.dueDate).toISOString().slice(0, 10) !== task.dueDate)
    )
      throw new ServiceRequestsError(400, "Enter a valid due date")
  }
  if (new Set(ids).size !== ids.length || ids.some((id) => !isRecordId(id)))
    throw new ServiceRequestsError(400, "Invalid phase or task identifiers")
  return plan
}

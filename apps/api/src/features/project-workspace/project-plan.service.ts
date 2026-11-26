import { randomUUID } from "node:crypto"
import { isDeepStrictEqual } from "node:util"
import { projectAuditStatus } from "../project-management-logs/events.js"
import { writeProjectLog } from "../project-management-logs/writer.js"
import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { activeStaff } from "../../shared/query/accounts.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import {
  readWorkPlan,
  type ProjectTaskStatus,
  type ProjectWorkPlan,
} from "./templates.js"
import {
  MAX_PHASE_TASKS,
  validateEditablePlan,
} from "./project-plan.validation.js"
import { getProjectWorkspace } from "./workspace-details.service.js"
import {
  getStaffContext,
  lockAndRevalidateProjectForEdit,
} from "./workspace-access.js"
import { writeWorkspaceEvent } from "./workspace-activity.js"

export async function saveProjectPlan(
  userId: string,
  workspaceId: string,
  projectId: string,
  input: unknown,
) {
  if (!input || typeof input !== "object")
    throw new ServiceRequestsError(400, "Enter a project plan")
  const body = input as Record<string, unknown>
  const plan = validateEditablePlan(body.plan)
  if (
    typeof body.expectedUpdatedAt !== "string" ||
    !Number.isFinite(Date.parse(body.expectedUpdatedAt))
  )
    throw new ServiceRequestsError(400, "Reload the project before editing")
  await getPrisma()!.$transaction(async (tx) => {
    const initialContext = await getStaffContext(tx, userId)
    const { project, acceptedDepartmentId } =
      await lockAndRevalidateProjectForEdit(
        tx,
        userId,
        initialContext,
        workspaceId,
        projectId,
      )
    const head = await tx.department.findFirst({
      where: { id: acceptedDepartmentId ?? "", headId: userId },
      select: { id: true },
    })
    const previousPlan = readWorkPlan(project.workPlan)
    const previousTasks = new Map(
      (previousPlan?.phases.flatMap((phase) => phase.tasks) ?? []).map(
        (task) => [task.id, task],
      ),
    )
    const assignedIds: string[] = []
    const nextTaskIds = new Set(
      plan.phases.flatMap((phase) => phase.tasks.map((task) => task.id)),
    )
    if (
      !head &&
      [...previousTasks.values()].some(
        (task) => task.employeeId && !nextTaskIds.has(task.id),
      )
    )
      throw new ServiceRequestsError(
        403,
        "Only the department head can remove assigned tasks",
      )
    for (const task of plan.phases.flatMap((phase) => phase.tasks)) {
      const previous = previousTasks.get(task.id)
      if ((previous?.employeeId ?? null) !== (task.employeeId ?? null)) {
        if (!head)
          throw new ServiceRequestsError(
            403,
            "Only the department head can change task assignments",
          )
        if (task.employeeId) assignedIds.push(task.employeeId)
      }
    }
    for (const employeeId of new Set(assignedIds)) {
      const approved = await tx.projectStaff.count({
        where: {
          projectId,
          employeeId,
          employee: {
            departmentId: acceptedDepartmentId,
            status: "ACTIVE",
            user: activeStaff,
          },
        },
      })
      if (!approved)
        throw new ServiceRequestsError(
          409,
          "Select an active employee already approved for this project",
        )
    }
    const changed = await tx.project.updateMany({
      where: {
        id: project.id,
        updatedAt: new Date(body.expectedUpdatedAt as string),
      },
      data: { workPlan: plan as Prisma.InputJsonValue, updatedAt: new Date() },
    })
    if (!changed.count)
      throw new ServiceRequestsError(
        409,
        "The plan changed while you were editing. Reload before saving again.",
      )
    await writeWorkspaceEvent(
      tx,
      project.requestId!,
      project.id,
      userId,
      "WORKSPACE_TASK_UPDATED",
      "Updated the project phases and task plan.",
    )
    if (!isDeepStrictEqual(previousPlan, plan)) {
      const previousPhases = previousPlan?.phases ?? []
      const tasks = plan.phases.flatMap(({ tasks }) => tasks)
      const editedTasks = tasks.filter(
        (task) =>
          previousTasks.has(task.id) &&
          !isDeepStrictEqual(previousTasks.get(task.id), task),
      ).length
      const editedPhases = plan.phases.filter((phase, index) => {
        const previous = previousPhases[index]
        return (
          !previous ||
          previous.id !== phase.id ||
          previous.title !== phase.title ||
          !isDeepStrictEqual(
            previous.tasks.map(({ id }) => id),
            phase.tasks.map(({ id }) => id),
          )
        )
      }).length
      await writeProjectLog(tx, userId, project.id, "PLAN_UPDATED", {
        "Phase count": [previousPhases.length, plan.phases.length],
        "Task count": [previousTasks.size, tasks.length],
        "Phases edited": [0, editedPhases],
        "Tasks edited": [0, editedTasks],
      })
    }
  })
  return getProjectWorkspace(userId, workspaceId)
}

export async function updateProjectTask(
  userId: string,
  workspaceId: string,
  projectId: string,
  taskId: string,
  status: ProjectTaskStatus,
) {
  if (!["NOT_STARTED", "IN_PROGRESS", "DONE"].includes(status))
    throw new ServiceRequestsError(400, "Choose a valid task status")
  await getPrisma()!.$transaction(async (tx) => {
    const initialContext = await getStaffContext(tx, userId)
    const { project: scoped } = await lockAndRevalidateProjectForEdit(
      tx,
      userId,
      initialContext,
      workspaceId,
      projectId,
    )
    const project = await tx.project.findUniqueOrThrow({
      where: { id: scoped.id },
    })
    const plan = readWorkPlan(project.workPlan)
    if (!plan)
      throw new ServiceRequestsError(409, "This project has no task plan yet")
    const current = plan.phases
      .flatMap(({ tasks }) => tasks)
      .find(({ id }) => id === taskId)
    if (!current) throw new ServiceRequestsError(404, "Task not found")
    const nextPlan: ProjectWorkPlan = {
      phases: plan.phases.map((phase) => ({
        ...phase,
        tasks: phase.tasks.map((task) => {
          if (task.id !== taskId) return task
          return { ...task, status }
        }),
      })),
    }
    await tx.project.update({
      where: { id: project.id },
      data: {
        workPlan: nextPlan as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    })
    await writeWorkspaceEvent(
      tx,
      project.requestId!,
      project.id,
      userId,
      "WORKSPACE_TASK_UPDATED",
      `Updated “${current.title}” to ${status.toLowerCase().replaceAll("_", " ")}.`,
    )
    if (current.status !== status)
      await writeProjectLog(
        tx,
        userId,
        projectId,
        "TASK_STATUS_CHANGED",
        {
          Status: [
            projectAuditStatus(current.status),
            projectAuditStatus(status),
          ],
        },
        { id: taskId, label: current.title },
      )
  })
  return getProjectWorkspace(userId, workspaceId)
}

export async function addProjectTask(
  userId: string,
  workspaceId: string,
  projectId: string,
  input: unknown,
) {
  if (!input || typeof input !== "object")
    throw new ServiceRequestsError(400, "Enter a task title")
  const value = input as Record<string, unknown>
  const phaseId = typeof value.phaseId === "string" ? value.phaseId : ""
  const title = typeof value.title === "string" ? value.title.trim() : ""
  const role =
    typeof value.role === "string" ? value.role.trim() : "Project team"
  if (!phaseId || title.length < 2 || title.length > 180 || role.length > 80)
    throw new ServiceRequestsError(
      400,
      "Enter a task title between 2 and 180 characters",
    )
  await getPrisma()!.$transaction(async (tx) => {
    const initialContext = await getStaffContext(tx, userId)
    const { project: scoped } = await lockAndRevalidateProjectForEdit(
      tx,
      userId,
      initialContext,
      workspaceId,
      projectId,
    )
    const project = await tx.project.findUniqueOrThrow({
      where: { id: scoped.id },
    })
    const plan = readWorkPlan(project.workPlan)
    if (!plan)
      throw new ServiceRequestsError(409, "This project has no task plan yet")
    const phase = plan.phases.find(({ id }) => id === phaseId)
    if (!phase) throw new ServiceRequestsError(404, "Project phase not found")
    if (phase.tasks.length >= MAX_PHASE_TASKS)
      throw new ServiceRequestsError(
        400,
        `A phase can have up to ${MAX_PHASE_TASKS} tasks`,
      )
    const task = {
      id: randomUUID(),
      title,
      role: role || "Project team",
      status: "NOT_STARTED" as const,
    }
    phase.tasks.push(task)
    await tx.project.update({
      where: { id: project.id },
      data: { workPlan: plan as Prisma.InputJsonValue, updatedAt: new Date() },
    })
    await writeWorkspaceEvent(
      tx,
      project.requestId!,
      project.id,
      userId,
      "WORKSPACE_TASK_ADDED",
      `Added “${title}” to ${phase.title}.`,
    )
    await writeProjectLog(
      tx,
      userId,
      projectId,
      "TASK_ADDED",
      {
        Status: [null, projectAuditStatus(task.status)],
      },
      { id: task.id, label: task.title },
    )
  })
  return getProjectWorkspace(userId, workspaceId)
}

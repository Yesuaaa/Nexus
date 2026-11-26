import {
  projectAuditStatus,
  type ProjectLogEvent,
} from "../project-management-logs/events.js"
import { writeProjectLog } from "../project-management-logs/writer.js"
import { finishLoggedRequest } from "../service-operation-logs/request-status-log.js"
import type { ProjectStatus } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { activeStaff } from "../../shared/query/accounts.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import { readWorkPlan } from "./templates.js"
import {
  type MutableWorkspaceProject,
  getMutableWorkspace,
  getStaffContext,
  lockAndRevalidateManagedWorkspace,
  requireWorkspaceManager,
} from "./workspace-access.js"
import { getProjectWorkspace } from "./workspace-details.service.js"
import { writeWorkspaceEvent } from "./workspace-activity.js"

export async function assignProjectTeamLead(
  userId: string,
  workspaceId: string,
  projectId: string,
  employeeId: unknown,
) {
  if (typeof employeeId !== "string" || !employeeId)
    throw new ServiceRequestsError(400, "Choose a project team member")

  await getPrisma()!.$transaction(async (tx) => {
    const context = await getStaffContext(tx, userId)
    const current = await getMutableWorkspace(tx, context, workspaceId)
    requireWorkspaceManager(context, current.projects)
    const { workspace } = await lockAndRevalidateManagedWorkspace(
      tx,
      userId,
      workspaceId,
      current,
    )
    const project = workspace.projects.find(({ id }) => id === projectId)
    if (!project || !["PLANNED", "IN_PROGRESS"].includes(project.status))
      throw new ServiceRequestsError(409, "Choose a planned or active project")

    const projectScope = workspace.groupId
      ? { workspaceGroupId: workspace.groupId }
      : { id: projectId }
    const projectCount = await tx.project.count({ where: projectScope })
    if (projectCount !== workspace.projects.length)
      throw new ServiceRequestsError(
        403,
        "Only the department head can manage the full project team",
      )
    const previousLeads = await tx.projectStaff.findMany({
      where: { project: projectScope, isTeamLead: true },
      select: {
        projectId: true,
        employeeId: true,
        employee: { select: { fullName: true } },
      },
    })
    await tx.projectStaff.updateMany({
      where: { project: projectScope, isTeamLead: true },
      data: { isTeamLead: false },
    })
    const updated = await tx.projectStaff.updateMany({
      where: {
        projectId,
        employeeId,
        employee: {
          departmentId: project.request?.acceptedDepartmentId,
          status: "ACTIVE",
          user: activeStaff,
        },
      },
      data: { isTeamLead: true },
    })
    if (!updated.count)
      throw new ServiceRequestsError(
        409,
        "Choose an active project team member",
      )
    const wasSelected = previousLeads.some(
      (lead) => lead.projectId === projectId && lead.employeeId === employeeId,
    )
    for (const lead of previousLeads) {
      if (lead.projectId === projectId && lead.employeeId === employeeId)
        continue
      await writeProjectLog(
        tx,
        userId,
        lead.projectId,
        "TEAM_LEAD_CHANGED",
        {
          "Team lead": [true, false],
        },
        { id: lead.employeeId, label: lead.employee.fullName },
      )
    }
    if (!wasSelected) {
      const employee = await tx.employee.findUniqueOrThrow({
        where: { id: employeeId },
        select: { fullName: true },
      })
      await writeProjectLog(
        tx,
        userId,
        projectId,
        "TEAM_LEAD_CHANGED",
        {
          "Team lead": [false, true],
        },
        { id: employeeId, label: employee.fullName },
      )
    }
  })
  return getProjectWorkspace(userId, workspaceId)
}

export async function cancelProjectWorkspace(
  userId: string,
  workspaceId: string,
) {
  await getPrisma()!.$transaction(async (tx) => {
    const context = await getStaffContext(tx, userId)
    const current = await getMutableWorkspace(tx, context, workspaceId)
    requireWorkspaceManager(context, current.projects)
    const { workspace } = await lockAndRevalidateManagedWorkspace(
      tx,
      userId,
      workspaceId,
      current,
    )
    const cancellable = workspace.projects.filter(({ status }) =>
      ["PLANNED", "IN_PROGRESS", "ON_HOLD"].includes(status),
    )
    if (!cancellable.length)
      throw new ServiceRequestsError(409, "This project is already archived")

    const updated = await tx.project.updateMany({
      where: {
        id: { in: cancellable.map(({ id }) => id) },
        status: { in: ["PLANNED", "IN_PROGRESS", "ON_HOLD"] },
      },
      data: { status: "CANCELLED", updatedAt: new Date() },
    })
    if (updated.count !== cancellable.length)
      throw new ServiceRequestsError(
        409,
        "The project changed while you were cancelling it. Refresh and try again.",
      )
    for (const project of cancellable) {
      await writeProjectLog(tx, userId, project.id, "WORKSPACE_CANCELLED", {
        Status: [
          projectAuditStatus(project.status),
          projectAuditStatus("CANCELLED"),
        ],
      })
      if (project.requestId) {
        await finishLoggedRequest(tx, project.requestId, userId, "CANCELLED")
        await tx.requestWorkflow.updateMany({
          where: { requestId: project.requestId },
          data: { state: "CANCELLED" },
        })
      }
      if (project.requestId)
        await writeWorkspaceEvent(
          tx,
          project.requestId,
          project.id,
          userId,
          "WORKSPACE_CANCELLED",
          "Cancelled the project workspace.",
        )
    }
  })
  return { saved: true }
}

export async function updateProjectWorkspaceStatus(
  userId: string,
  workspaceId: string,
  action: "ON_HOLD" | "RESUME" | "COMPLETE",
) {
  await getPrisma()!.$transaction(async (tx) => {
    const context = await getStaffContext(tx, userId)
    const current = await getMutableWorkspace(tx, context, workspaceId)
    requireWorkspaceManager(context, current.projects)
    const { workspace } = await lockAndRevalidateManagedWorkspace(
      tx,
      userId,
      workspaceId,
      current,
    )

    let affected: MutableWorkspaceProject[]
    let status: ProjectStatus
    let eventType: ProjectLogEvent
    let summary: string

    if (action === "ON_HOLD") {
      affected = workspace.projects.filter(
        ({ status: currentStatus }) => currentStatus === "IN_PROGRESS",
      )
      status = "ON_HOLD"
      eventType = "WORKSPACE_ON_HOLD"
      summary = "Put the project workspace on hold."
      if (!affected.length)
        throw new ServiceRequestsError(
          409,
          "Only projects in progress can be put on hold",
        )
    } else if (action === "RESUME") {
      affected = workspace.projects.filter(
        ({ status: currentStatus }) => currentStatus === "ON_HOLD",
      )
      status = "IN_PROGRESS"
      eventType = "WORKSPACE_RESUMED"
      summary = "Resumed the project workspace."
      if (!affected.length)
        throw new ServiceRequestsError(409, "This project is not on hold")
    } else {
      if (
        workspace.projects.some(
          ({ status: currentStatus }) =>
            !["IN_PROGRESS", "ON_HOLD", "COMPLETED"].includes(currentStatus),
        )
      )
        throw new ServiceRequestsError(
          409,
          "Start every service and resolve cancelled services before completing the workspace",
        )

      const projects = await tx.project.findMany({
        where: { id: { in: workspace.projects.map(({ id }) => id) } },
        select: {
          id: true,
          name: true,
          workPlan: true,
          milestones: { select: { deliveryStatus: true } },
        },
      })
      const hasUnfinishedTasks = projects.some((project) => {
        const plan = readWorkPlan(project.workPlan)
        return (
          !plan ||
          plan.phases.some((phase) =>
            phase.tasks.some((task) => task.status !== "DONE"),
          )
        )
      })
      if (hasUnfinishedTasks)
        throw new ServiceRequestsError(
          409,
          "Finish every project task before completing the workspace",
        )
      if (
        projects.some((project) =>
          project.milestones.some(
            ({ deliveryStatus }) => deliveryStatus !== "SENT_TO_CLIENT",
          ),
        )
      )
        throw new ServiceRequestsError(
          409,
          "Send every deliverable to the client before completing the workspace",
        )

      affected = workspace.projects.filter(
        ({ status: currentStatus }) =>
          currentStatus === "IN_PROGRESS" || currentStatus === "ON_HOLD",
      )
      if (!affected.length)
        throw new ServiceRequestsError(
          409,
          "This workspace is already complete",
        )
      status = "COMPLETED"
      eventType = "WORKSPACE_COMPLETED"
      summary = "Completed the project workspace."
    }

    const updated = await tx.project.updateMany({
      where: {
        id: { in: affected.map(({ id }) => id) },
        status:
          action === "ON_HOLD"
            ? "IN_PROGRESS"
            : action === "RESUME"
              ? "ON_HOLD"
              : { in: ["IN_PROGRESS", "ON_HOLD"] },
      },
      data: { status, updatedAt: new Date() },
    })
    if (updated.count !== affected.length)
      throw new ServiceRequestsError(
        409,
        "The project changed while you were updating its status. Reload and try again.",
      )

    for (const project of affected) {
      await writeProjectLog(tx, userId, project.id, eventType, {
        Status: [
          projectAuditStatus(project.status),
          projectAuditStatus(status),
        ],
      })
      if (project.requestId && status === "COMPLETED")
        await finishLoggedRequest(tx, project.requestId, userId, "CONCLUDED")
      if (project.requestId)
        await writeWorkspaceEvent(
          tx,
          project.requestId,
          project.id,
          userId,
          eventType,
          summary,
        )
    }
  })
  return getProjectWorkspace(userId, workspaceId)
}

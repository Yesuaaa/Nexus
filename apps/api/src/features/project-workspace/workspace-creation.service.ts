import { writeProjectLog } from "../project-management-logs/writer.js"
import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { isRecordId } from "../../shared/validation.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import {
  makeWorkPlan,
  projectTemplates,
  type ProjectWorkPlan,
} from "./templates.js"
import {
  getStaffContext,
  scopedProjectWhere,
  terminalProjectStatuses,
} from "./workspace-access.js"
import { validateEditablePlan } from "./project-plan.validation.js"

export async function listProjectWorkspaceTemplates(userId: string) {
  await getPrisma()!.$transaction((tx) => getStaffContext(tx, userId))
  return projectTemplates
}

export async function listApprovedBookings(userId: string) {
  return getPrisma()!.$transaction(async (tx) => {
    const context = await getStaffContext(tx, userId)
    if (!context.canCreate)
      throw new ServiceRequestsError(
        403,
        "Only a department head can set up projects",
      )
    const projects = await tx.project.findMany({
      where: {
        ...scopedProjectWhere(context),
        request: {
          acceptedDepartmentId: { in: context.headDepartmentIds },
          workflow: { is: { approval: { isNot: null } } },
        },
        workspaceGroupId: null,
        templateKey: null,
        status: { notIn: terminalProjectStatuses },
      },
      select: {
        id: true,
        name: true,
        request: {
          select: {
            id: true,
            title: true,
            referenceNumber: true,
            conversationId: true,
            acceptedDepartmentId: true,
            client: { select: { id: true, fullName: true } },
            service: { select: { name: true } },
            workflow: {
              select: { state: true, approval: { select: { id: true } } },
            },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    })
    return projects.flatMap(({ id, request }) =>
      request?.workflow?.approval
        ? [
            {
              projectId: id,
              requestId: request.id,
              name: request.title,
              serviceName: request.service.name,
              referenceNumber: request.referenceNumber,
              workflowState: request.workflow.state,
              conversationId: request.conversationId,
              client: request.client,
            },
          ]
        : [],
    )
  })
}

type CreateWorkspaceInput = {
  customPlans: Record<string, ProjectWorkPlan>
  requestIds: string[]
  structure: "SEPARATE" | "MULTI_WORKSTREAM"
  name: string
  templateKeys: Record<string, string>
}

function parseCreateWorkspace(input: unknown): CreateWorkspaceInput {
  if (!input || typeof input !== "object")
    throw new ServiceRequestsError(400, "Choose an approved booking")
  const value = input as Record<string, unknown>
  const requestIds = value.requestIds
  const templateKeys = value.templateKeys
  const structure = value.structure
  const name = typeof value.name === "string" ? value.name.trim() : ""
  if (
    !Array.isArray(requestIds) ||
    !requestIds.length ||
    requestIds.length > 8 ||
    requestIds.some((id) => !isRecordId(id)) ||
    new Set(requestIds).size !== requestIds.length
  )
    throw new ServiceRequestsError(400, "Choose one to eight approved bookings")
  if (structure !== "SEPARATE" && structure !== "MULTI_WORKSTREAM")
    throw new ServiceRequestsError(400, "Choose how to structure the project")
  if (
    !templateKeys ||
    typeof templateKeys !== "object" ||
    Array.isArray(templateKeys) ||
    requestIds.some(
      (id) =>
        typeof (templateKeys as Record<string, unknown>)[id] !== "string" ||
        !projectTemplates.some(
          ({ key }) => key === (templateKeys as Record<string, unknown>)[id],
        ),
    )
  )
    throw new ServiceRequestsError(400, "Choose a template for every booking")
  if (
    structure === "MULTI_WORKSTREAM" &&
    (name.length < 2 || name.length > 120)
  )
    throw new ServiceRequestsError(
      400,
      "Enter a project name between 2 and 120 characters",
    )
  return {
    customPlans: Object.fromEntries(
      requestIds
        .filter(
          (id) =>
            (templateKeys as Record<string, string>)[id] === "blank-custom",
        )
        .map((id) => {
          const plans = value.customPlans as Record<string, unknown> | undefined
          return [id, validateEditablePlan(plans?.[id])]
        }),
    ),
    requestIds: requestIds as string[],
    structure,
    name,
    templateKeys: templateKeys as Record<string, string>,
  }
}

export async function createProjectWorkspaces(userId: string, input: unknown) {
  const command = parseCreateWorkspace(input)
  return getPrisma()!.$transaction(async (tx) => {
    const context = await getStaffContext(tx, userId)
    if (!context.canCreate)
      throw new ServiceRequestsError(
        403,
        "Only a department head can set up projects",
      )
    const projects = await tx.project.findMany({
      where: {
        requestId: { in: command.requestIds },
        ...scopedProjectWhere(context),
        workspaceGroupId: null,
        templateKey: null,
        status: { notIn: terminalProjectStatuses },
      },
      include: {
        request: {
          select: {
            id: true,
            title: true,
            acceptedDepartmentId: true,
            workflow: {
              select: { state: true, approval: { select: { id: true } } },
            },
          },
        },
      },
    })
    if (
      projects.length !== command.requestIds.length ||
      projects.some(
        ({ request }) =>
          !request ||
          !request.workflow?.approval ||
          !request.acceptedDepartmentId ||
          !context.headDepartmentIds.includes(request.acceptedDepartmentId) ||
          ["CANCELLED", "DECLINED"].includes(request.workflow.state),
      )
    )
      throw new ServiceRequestsError(
        409,
        "One or more bookings are no longer available",
      )
    const clients = new Set(projects.map(({ clientId }) => clientId))
    if (clients.size !== 1)
      throw new ServiceRequestsError(
        400,
        "Combine bookings for the same client",
      )

    const groups =
      command.structure === "MULTI_WORKSTREAM"
        ? [projects]
        : projects.map((project) => [project])
    const workspaces: { id: string; name: string }[] = []
    for (const groupedProjects of groups) {
      const name =
        command.structure === "MULTI_WORKSTREAM"
          ? command.name
          : (groupedProjects[0].request?.title ?? groupedProjects[0].name)
      const group = await tx.projectWorkspaceGroup.create({
        data: {
          name,
          structure: command.structure,
          clientId: groupedProjects[0].clientId,
          createdById: userId,
        },
        select: { id: true, name: true },
      })
      workspaces.push(group)
      for (const project of groupedProjects) {
        const requestId = project.requestId!
        const templateKey = command.templateKeys[requestId]
        const workPlan =
          command.customPlans[requestId] ?? makeWorkPlan(templateKey)
        if (
          workPlan.phases.some((phase) =>
            phase.tasks.some((task) => task.employeeId),
          )
        )
          throw new ServiceRequestsError(
            400,
            "Create the workspace and approve project staff before assigning tasks",
          )
        const changed = await tx.project.updateMany({
          where: {
            id: project.id,
            workspaceGroupId: null,
            templateKey: null,
            status: { notIn: terminalProjectStatuses },
          },
          data: {
            workspaceGroupId: group.id,
            templateKey,
            workPlan: workPlan as Prisma.InputJsonValue,
            updatedAt: new Date(),
          },
        })
        if (changed.count !== 1)
          throw new ServiceRequestsError(
            409,
            "A booking was set up by someone else",
          )
        await tx.workflowEvent.create({
          data: {
            requestId,
            actorId: userId,
            type: "WORKSPACE_CREATED",
            summary: `Added ${project.name} to the ${group.name} project workspace using the ${projectTemplates.find(({ key }) => key === templateKey)?.name ?? "selected"} template.`,
            entityId: project.id,
            internal: true,
          },
        })
        await writeProjectLog(tx, userId, project.id, "WORKSPACE_CREATED", {
          "Workspace configured": [false, true],
          "Workspace structure": [
            null,
            command.structure === "SEPARATE" ? "Separate" : "Multi-workstream",
          ],
          "Phase count": [null, workPlan.phases.length],
          "Task count": [
            null,
            workPlan.phases.flatMap(({ tasks }) => tasks).length,
          ],
        })
      }
    }
    return { workspaces }
  })
}

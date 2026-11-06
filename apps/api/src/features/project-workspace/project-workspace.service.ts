import { randomUUID } from "node:crypto"
import type { Prisma, ProjectStatus } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import {
  makeWorkPlan,
  projectTemplates,
  readWorkPlan,
  type ProjectTaskStatus,
  type ProjectWorkPlan,
} from "./templates.js"

const activeAccount = { isActive: true, accountDeletedAt: null } as const

function validateEditablePlan(input: unknown): ProjectWorkPlan {
  const plan = readWorkPlan(input)
  if (
    !plan ||
    !plan.phases.length ||
    plan.phases.length > 20 ||
    plan.phases.some(
      (phase) =>
        !phase.title.trim() ||
        phase.title.length > 120 ||
        phase.tasks.length > 50 ||
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
      "Add 1–20 named phases, with up to 50 named tasks per phase",
    )
  const ids = plan.phases.flatMap((phase) => [
    phase.id,
    ...phase.tasks.map((task) => task.id),
  ])
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => !/^[A-Za-z0-9_-]{1,80}$/.test(id))
  )
    throw new ServiceRequestsError(400, "Invalid phase or task identifiers")
  return plan
}

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
    const context = await getStaffContext(tx, userId)
    const project = await scopedProjectForEdit(
      tx,
      context,
      workspaceId,
      projectId,
    )
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
  })
  return getProjectWorkspace(userId, workspaceId)
}
const activityTypes = [
  "PROJECT_ACTIVATED",
  "PROJECT_MILESTONE_UPDATED",
  "STAFFING_APPROVED",
  "WORKSPACE_CREATED",
  "WORKSPACE_TASK_ADDED",
  "WORKSPACE_TASK_UPDATED",
] as const

type StaffContext = {
  id: string
  departmentIds: string[]
  headDepartmentIds: string[]
  canCreate: boolean
}

async function getStaffContext(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<StaffContext> {
  const user = await tx.user.findFirst({
    where: { id: userId, role: "STAFF", ...activeAccount },
    select: {
      id: true,
      departmentId: true,
      headOf: { select: { id: true } },
    },
  })
  if (!user) throw new ServiceRequestsError(403, "Staff access is required")
  const headDepartmentIds = user.headOf ? [user.headOf.id] : []
  const departmentIds = [
    ...new Set(
      [user.departmentId, ...headDepartmentIds].filter((id): id is string =>
        Boolean(id),
      ),
    ),
  ]
  return {
    id: user.id,
    departmentIds,
    headDepartmentIds,
    canCreate: headDepartmentIds.length > 0,
  }
}

function scopedProjectWhere(context: StaffContext): Prisma.ProjectWhereInput {
  if (!context.departmentIds.length) return { id: "no-project-access" }
  return {
    request: { acceptedDepartmentId: { in: context.departmentIds } },
  }
}

const projectInclude = {
  client: { select: { id: true, fullName: true } },
  request: {
    select: {
      id: true,
      title: true,
      referenceNumber: true,
      acceptedDepartmentId: true,
      workflow: { select: { state: true } },
      service: { select: { name: true } },
    },
  },
  milestones: {
    select: { id: true, title: true, completedAt: true },
    orderBy: [{ displayOrder: "asc" as const }, { id: "asc" as const }],
  },
  staff: {
    select: {
      approvedAt: true,
      employee: {
        select: {
          id: true,
          fullName: true,
          position: true,
          status: true,
          profileSpecialties: true,
        },
      },
    },
  },
  workspaceGroup: {
    select: { id: true, name: true, structure: true, updatedAt: true },
  },
} satisfies Prisma.ProjectInclude

type WorkspaceProject = Prisma.ProjectGetPayload<{
  include: typeof projectInclude
}>

function summarizeStatus(projects: WorkspaceProject[]): ProjectStatus {
  if (projects.some(({ status }) => status === "IN_PROGRESS"))
    return "IN_PROGRESS"
  if (projects.some(({ status }) => status === "ON_HOLD")) return "ON_HOLD"
  if (projects.some(({ status }) => status === "PLANNED")) return "PLANNED"
  if (projects.every(({ status }) => status === "CANCELLED")) return "CANCELLED"
  return "COMPLETED"
}

function projectWorkstream(project: WorkspaceProject, includePlan: boolean) {
  const plan = readWorkPlan(project.workPlan)
  const tasks =
    plan?.phases.flatMap(({ tasks: phaseTasks }) => phaseTasks) ?? []
  return {
    id: project.id,
    requestId: project.request?.id ?? null,
    name: project.name,
    description: project.description,
    serviceName: project.request?.service.name ?? "Custom project",
    referenceNumber: project.request?.referenceNumber ?? null,
    workflowState: project.request?.workflow?.state ?? null,
    status: project.status,
    startDate: project.startDate,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    templateKey: project.templateKey,
    taskCount: tasks.length,
    completedTaskCount: tasks.filter(({ status }) => status === "DONE").length,
    plan: includePlan ? plan : undefined,
    milestones: project.milestones,
    staff: project.staff.map(({ employee, approvedAt }) => ({
      ...employee,
      approvedAt,
    })),
  }
}

async function activityCounts(
  tx: Prisma.TransactionClient,
  projects: WorkspaceProject[],
) {
  const requestIds = projects.flatMap(({ requestId }) =>
    requestId ? [requestId] : [],
  )
  if (!requestIds.length) return new Map<string, number>()
  const grouped = await tx.workflowEvent.groupBy({
    by: ["requestId"],
    where: { requestId: { in: requestIds }, type: { in: [...activityTypes] } },
    _count: { _all: true },
  })
  return new Map(
    grouped.map(({ requestId, _count }) => [requestId, _count._all]),
  )
}

function workspaceRows(
  projects: WorkspaceProject[],
  counts: Map<string, number>,
  context: StaffContext,
  includePlan = false,
) {
  const buckets = new Map<string, WorkspaceProject[]>()
  for (const project of projects) {
    const key = project.workspaceGroupId ?? `project:${project.id}`
    const bucket = buckets.get(key) ?? []
    bucket.push(project)
    buckets.set(key, bucket)
  }
  return [...buckets.values()].map((groupProjects) => {
    const first = groupProjects[0]
    const group = first.workspaceGroup
    const requestIds = groupProjects.flatMap(({ requestId }) =>
      requestId ? [requestId] : [],
    )
    const activityCount = requestIds.reduce(
      (sum, requestId) => sum + (counts.get(requestId) ?? 0),
      0,
    )
    const updatedAt = groupProjects.reduce(
      (latest, project) =>
        project.updatedAt > latest ? project.updatedAt : latest,
      group?.updatedAt ?? first.updatedAt,
    )
    return {
      id: group?.id ?? first.id,
      name: group?.name ?? first.name,
      structure: group?.structure ?? "SEPARATE",
      status: summarizeStatus(groupProjects),
      client: first.client,
      updatedAt,
      activityCount,
      canCreate: context.canCreate,
      workstreams: groupProjects.map((project) => ({
        ...projectWorkstream(project, includePlan),
        canAssign: Boolean(
          project.request?.acceptedDepartmentId &&
          context.headDepartmentIds.includes(
            project.request.acceptedDepartmentId,
          ),
        ),
      })),
    }
  })
}

export async function listProjectWorkspaces(
  userId: string,
  options: { sort?: string; limit?: number } = {},
) {
  return getPrisma()!.$transaction(async (tx) => {
    const context = await getStaffContext(tx, userId)
    const projects = await tx.project.findMany({
      where: scopedProjectWhere(context),
      include: projectInclude,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: Math.min(Math.max(options.limit ?? 200, 1), 250),
    })
    const counts = await activityCounts(tx, projects)
    const rows = workspaceRows(projects, counts, context)
    if (options.sort === "most-active")
      rows.sort(
        (left, right) =>
          right.activityCount - left.activityCount ||
          right.updatedAt.getTime() - left.updatedAt.getTime(),
      )
    return {
      workspaces: rows,
      canCreate: context.canCreate,
    }
  })
}

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
        status: { notIn: ["CANCELLED", "COMPLETED"] },
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
    requestIds.some(
      (id) => typeof id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(id),
    ) ||
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
        const changed = await tx.project.updateMany({
          where: { id: project.id, workspaceGroupId: null, templateKey: null },
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
      }
    }
    return { workspaces }
  })
}

export async function getProjectWorkspace(userId: string, id: string) {
  return getPrisma()!.$transaction(async (tx) => {
    const context = await getStaffContext(tx, userId)
    const scope = scopedProjectWhere(context)
    const group = await tx.projectWorkspaceGroup.findUnique({
      where: { id },
      include: {
        projects: {
          where: scope,
          include: projectInclude,
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    })
    let projects = group?.projects ?? []
    if (!projects.length) {
      const single = await tx.project.findFirst({
        where: { id, ...scope },
        include: projectInclude,
      })
      if (!single)
        throw new ServiceRequestsError(404, "Project workspace not found")
      projects = [single]
    }
    const counts = await activityCounts(tx, projects)
    const workspace = workspaceRows(projects, counts, context, true)[0]
    const requestIds = projects.flatMap(({ requestId }) =>
      requestId ? [requestId] : [],
    )
    const events = requestIds.length
      ? await tx.workflowEvent.findMany({
          where: {
            requestId: { in: requestIds },
            type: { in: [...activityTypes] },
          },
          select: {
            id: true,
            type: true,
            summary: true,
            createdAt: true,
            actor: { select: { fullName: true } },
            workflow: {
              select: {
                request: { select: { project: { select: { name: true } } } },
              },
            },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 100,
        })
      : []
    return {
      ...workspace,
      activity: events.map(({ workflow, ...event }) => ({
        ...event,
        projectName: workflow.request.project?.name ?? workspace.name,
      })),
    }
  })
}

async function scopedProjectForEdit(
  tx: Prisma.TransactionClient,
  context: StaffContext,
  workspaceId: string,
  projectId: string,
) {
  const project = await tx.project.findFirst({
    where: {
      id: projectId,
      ...scopedProjectWhere(context),
      OR: [
        { workspaceGroupId: workspaceId },
        { id: workspaceId, workspaceGroupId: null },
      ],
    },
  })
  if (!project || !project.requestId)
    throw new ServiceRequestsError(404, "Project workstream not found")
  return project
}

async function writeWorkspaceEvent(
  tx: Prisma.TransactionClient,
  requestId: string,
  projectId: string,
  userId: string,
  type: string,
  summary: string,
) {
  await tx.workflowEvent.create({
    data: {
      requestId,
      entityId: projectId,
      actorId: userId,
      type,
      summary,
      internal: true,
    },
  })
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
    const context = await getStaffContext(tx, userId)
    const scoped = await scopedProjectForEdit(
      tx,
      context,
      workspaceId,
      projectId,
    )
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${scoped.id} FOR UPDATE`
    const project = await tx.project.findUniqueOrThrow({
      where: { id: scoped.id },
    })
    const plan = readWorkPlan(project.workPlan)
    if (!plan)
      throw new ServiceRequestsError(409, "This project has no task plan yet")
    let taskTitle = ""
    let found = false
    const nextPlan: ProjectWorkPlan = {
      phases: plan.phases.map((phase) => ({
        ...phase,
        tasks: phase.tasks.map((task) => {
          if (task.id !== taskId) return task
          found = true
          taskTitle = task.title
          return { ...task, status }
        }),
      })),
    }
    if (!found) throw new ServiceRequestsError(404, "Task not found")
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
      `Updated “${taskTitle}” to ${status.toLowerCase().replaceAll("_", " ")}.`,
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
    const context = await getStaffContext(tx, userId)
    const scoped = await scopedProjectForEdit(
      tx,
      context,
      workspaceId,
      projectId,
    )
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${scoped.id} FOR UPDATE`
    const project = await tx.project.findUniqueOrThrow({
      where: { id: scoped.id },
    })
    const plan = readWorkPlan(project.workPlan)
    if (!plan)
      throw new ServiceRequestsError(409, "This project has no task plan yet")
    const phase = plan.phases.find(({ id }) => id === phaseId)
    if (!phase) throw new ServiceRequestsError(404, "Project phase not found")
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
  })
  return getProjectWorkspace(userId, workspaceId)
}

import { randomUUID } from "node:crypto"
import type { Prisma, ProjectStatus } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { activeStaff } from "../../shared/query/accounts.js"
import { isRecordId } from "../../shared/validation.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import { parseWorkflowUpload } from "../request-workflow/workflow.files.js"
import {
  readDeliverableCard,
  recordProjectDeliverableMessage,
} from "../project-conversations/deliverable-messages.js"
import {
  makeWorkPlan,
  projectTemplates,
  readWorkPlan,
  type ProjectTaskStatus,
  type ProjectWorkPlan,
} from "./templates.js"
import { lockRows, lockServiceRequest } from "../../shared/db/locks.js"

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
    const acceptedDepartmentId = await lockServiceRequest(tx, project.requestId)
    const head = await tx.department.findFirst({
      where: { id: acceptedDepartmentId ?? "", headId: userId },
      select: { id: true },
    })
    const previousTasks = new Map(
      (
        readWorkPlan(project.workPlan)?.phases.flatMap(
          (phase) => phase.tasks,
        ) ?? []
      ).map((task) => [task.id, task]),
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
  })
  return getProjectWorkspace(userId, workspaceId)
}
const activityTypes = [
  "PROJECT_ACTIVATED",
  "PROJECT_MILESTONE_UPDATED",
  "STAFFING_APPROVED",
  "WORKSPACE_CREATED",
  "WORKSPACE_RENAMED",
  "WORKSPACE_CANCELLED",
  "WORKSPACE_ON_HOLD",
  "WORKSPACE_RESUMED",
  "WORKSPACE_COMPLETED",
  "WORKSPACE_TASK_ADDED",
  "WORKSPACE_TASK_UPDATED",
  "PROJECT_DELIVERABLE_UPDATED",
  "PROJECT_DELIVERABLE_UPLOADED",
  "PROJECT_DELIVERABLE_REMOVED",
  "PROJECT_DELIVERABLE_APPROVED",
  "PROJECT_DELIVERABLE_REJECTED",
  "PROJECT_DELIVERABLE_SENT_TO_CLIENT",
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
    where: { id: userId, ...activeStaff },
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
  if (!context.headDepartmentIds.length) {
    return {
      staff: {
        some: {
          employee: { userId: context.id },
        },
      },
    }
  }
  if (!context.departmentIds.length) return { id: "no-project-access" }
  return {
    request: { acceptedDepartmentId: { in: context.departmentIds } },
  }
}

function workspaceReadWhere(context: StaffContext): Prisma.ProjectWhereInput {
  if (!context.canCreate) return scopedProjectWhere(context)
  return {
    request: { acceptedDepartmentId: { in: context.headDepartmentIds } },
  }
}

async function mixedWorkspaceGroupIds(
  tx: Prisma.TransactionClient,
  groupIds: string[],
  context: StaffContext,
) {
  if (!context.canCreate || !groupIds.length) return new Set<string>()
  const groups = await tx.projectWorkspaceGroup.findMany({
    where: {
      id: { in: groupIds },
      projects: {
        some: {
          OR: [
            { request: null },
            { request: { acceptedDepartmentId: null } },
            {
              request: {
                acceptedDepartmentId: { notIn: context.headDepartmentIds },
              },
            },
          ],
        },
      },
    },
    select: { id: true },
  })
  return new Set(groups.map(({ id }) => id))
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
    select: {
      id: true,
      title: true,
      description: true,
      expectedFileType: true,
      deliveryStatus: true,
      rejectionReason: true,
      reviewedAt: true,
      sentToClientAt: true,
      workflowFileId: true,
      updatedAt: true,
      workflowFile: {
        select: {
          id: true,
          name: true,
          mimeType: true,
          size: true,
          uploaderId: true,
          createdAt: true,
          clientVisible: true,
        },
      },
      completedAt: true,
    },
    orderBy: [{ displayOrder: "asc" as const }, { id: "asc" as const }],
  },
  staff: {
    select: {
      approvedAt: true,
      isTeamLead: true,
      employee: {
        select: {
          id: true,
          fullName: true,
          userId: true,
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
  if (projects.some(({ status }) => status === "CANCELLED")) return "CANCELLED"
  return "COMPLETED"
}

function projectWorkstream(
  project: WorkspaceProject,
  includePlan: boolean,
  userId: string,
) {
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
    staff: project.staff.map(({ employee, approvedAt, isTeamLead }) => {
      const { userId: _userId, ...safeEmployee } = employee
      void _userId
      return { ...safeEmployee, approvedAt, isTeamLead }
    }),
    canUploadDeliverables: project.staff.some(
      ({ employee }) =>
        employee.userId === userId && employee.status === "ACTIVE",
    ),
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
  mixedGroupIds: Set<string>,
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
    const mixed = Boolean(group && mixedGroupIds.has(group.id))
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
      (mixed ? undefined : group?.updatedAt) ?? first.updatedAt,
    )
    const canManage = groupProjects.every(({ request }) =>
      Boolean(
        request?.acceptedDepartmentId &&
        context.headDepartmentIds.includes(request.acceptedDepartmentId),
      ),
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
      canManage,
      canRename:
        canManage &&
        !mixed &&
        groupProjects.some(
          ({ status }) => !["COMPLETED", "CANCELLED"].includes(status),
        ),
      workstreams: groupProjects.map((project) => ({
        ...projectWorkstream(project, includePlan, context.id),
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
  return getPrisma()!.$transaction(
    async (tx) => {
      const context = await getStaffContext(tx, userId)
      const projects = await tx.project.findMany({
        where: workspaceReadWhere(context),
        include: projectInclude,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: Math.min(Math.max(options.limit ?? 200, 1), 250),
      })
      const counts = await activityCounts(tx, projects)
      const mixedGroupIds = await mixedWorkspaceGroupIds(
        tx,
        projects.flatMap(({ workspaceGroupId }) =>
          workspaceGroupId ? [workspaceGroupId] : [],
        ),
        context,
      )
      const rows = workspaceRows(projects, counts, context, mixedGroupIds)
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
    },
    { isolationLevel: "RepeatableRead" },
  )
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
  return getPrisma()!.$transaction(
    async (tx) => {
      const context = await getStaffContext(tx, userId)
      const scope = workspaceReadWhere(context)
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
      const groupId = projects[0].workspaceGroupId
      const mixedGroupIds = await mixedWorkspaceGroupIds(
        tx,
        groupId ? [groupId] : [],
        context,
      )
      const workspace = workspaceRows(
        projects,
        counts,
        context,
        mixedGroupIds,
        true,
      )[0]
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
          summary:
            event.type === "STAFFING_APPROVED" &&
            event.summary.startsWith(
              "The department head approved project staffing. Employee records: ",
            )
              ? "The department head updated the project team."
              : event.summary,
          projectName: workflow.request.project?.name ?? workspace.name,
        })),
      }
    },
    { isolationLevel: "RepeatableRead" },
  )
}

type MutableWorkspaceProject = {
  id: string
  status: ProjectStatus
  requestId: string | null
  request: { acceptedDepartmentId: string | null } | null
}

async function getMutableWorkspace(
  tx: Prisma.TransactionClient,
  context: StaffContext,
  workspaceId: string,
  scope = scopedProjectWhere(context),
) {
  const group = await tx.projectWorkspaceGroup.findFirst({
    where: { id: workspaceId, projects: { some: scope } },
    select: {
      id: true,
      projects: {
        where: scope,
        select: {
          id: true,
          status: true,
          requestId: true,
          request: { select: { acceptedDepartmentId: true } },
        },
      },
    },
  })
  if (group?.projects.length)
    return { groupId: group.id, projects: group.projects }

  const project = await tx.project.findFirst({
    where: { id: workspaceId, ...scope },
    select: {
      id: true,
      status: true,
      requestId: true,
      request: { select: { acceptedDepartmentId: true } },
    },
  })
  if (!project)
    throw new ServiceRequestsError(404, "Project workspace not found")
  return { groupId: null, projects: [project] }
}

function requireWorkspaceManager(
  context: StaffContext,
  projects: MutableWorkspaceProject[],
) {
  if (
    !projects.length ||
    projects.some(
      ({ request }) =>
        !request?.acceptedDepartmentId ||
        !context.headDepartmentIds.includes(request.acceptedDepartmentId),
    )
  )
    throw new ServiceRequestsError(
      403,
      "Only the department head can manage this project workspace",
    )
}

async function lockWorkspaceProjects(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  groupId: string | null,
  projects: MutableWorkspaceProject[],
) {
  if (groupId) await lockRows(tx, "ProjectWorkspaceGroup", groupId)
  for (const project of projects) await lockRows(tx, "Project", project.id)
  if (!groupId && projects[0]?.id !== workspaceId)
    throw new ServiceRequestsError(404, "Project workspace not found")
}

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
    await lockWorkspaceProjects(
      tx,
      workspaceId,
      current.groupId,
      current.projects,
    )
    const workspace = await getMutableWorkspace(tx, context, workspaceId)
    requireWorkspaceManager(context, workspace.projects)
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
  })
  return getProjectWorkspace(userId, workspaceId)
}

export async function renameProjectWorkspace(
  userId: string,
  workspaceId: string,
  input: unknown,
) {
  const name =
    input &&
    typeof input === "object" &&
    "name" in input &&
    typeof input.name === "string"
      ? input.name.trim()
      : ""
  if (name.length < 2 || name.length > 120)
    throw new ServiceRequestsError(
      400,
      "Enter a project name between 2 and 120 characters",
    )

  await getPrisma()!.$transaction(async (tx) => {
    const context = await getStaffContext(tx, userId)
    const current = await getMutableWorkspace(
      tx,
      context,
      workspaceId,
      workspaceReadWhere(context),
    )
    requireWorkspaceManager(context, current.projects)
    const targetProjectId = current.groupId ? undefined : current.projects[0].id
    const groupId =
      current.groupId ??
      (
        await tx.project.findUniqueOrThrow({
          where: { id: targetProjectId },
          select: { workspaceGroupId: true },
        })
      ).workspaceGroupId
    // The group lock also conflicts with foreign-key checks for new members.
    await lockRows(tx, "ProjectWorkspaceGroup", groupId)
    const membership = groupId
      ? { workspaceGroupId: groupId }
      : { id: targetProjectId }
    const members = await tx.project.findMany({
      where: membership,
      select: { id: true, requestId: true },
      orderBy: { id: "asc" },
    })
    await lockRows(
      tx,
      "ServiceRequest",
      members.map(({ requestId }) => requestId),
      "share",
    )
    await lockRows(tx, "Department", context.headDepartmentIds, "share")
    await lockRows(tx, "User", userId, "share")
    await lockRows(
      tx,
      "Project",
      members.map(({ id }) => id),
    )
    const lockedMembers = await tx.project.findMany({
      where: membership,
      select: { id: true, requestId: true, workspaceGroupId: true },
      orderBy: { id: "asc" },
    })
    if (
      lockedMembers.length !== members.length ||
      lockedMembers.some(
        (member, index) =>
          member.id !== members[index].id ||
          member.requestId !== members[index].requestId ||
          member.workspaceGroupId !== groupId,
      ) ||
      (targetProjectId &&
        !lockedMembers.some(({ id }) => id === targetProjectId))
    ) {
      throw new ServiceRequestsError(
        409,
        "Workspace membership changed. Refresh and try again.",
      )
    }
    const lockedContext = await getStaffContext(tx, userId)
    if (lockedContext.headDepartmentIds[0] !== context.headDepartmentIds[0])
      throw new ServiceRequestsError(403, "Department leadership changed")
    const workspace = await getMutableWorkspace(
      tx,
      lockedContext,
      workspaceId,
      workspaceReadWhere(lockedContext),
    )
    requireWorkspaceManager(lockedContext, workspace.projects)
    if (
      groupId &&
      (await mixedWorkspaceGroupIds(tx, [groupId], lockedContext)).has(groupId)
    )
      throw new ServiceRequestsError(
        403,
        "Only the department head for every project can rename this workspace",
      )
    if (
      workspace.projects.every(({ status }) =>
        ["COMPLETED", "CANCELLED"].includes(status),
      )
    )
      throw new ServiceRequestsError(409, "Archived projects cannot be renamed")

    if (workspace.groupId) {
      await tx.projectWorkspaceGroup.update({
        where: { id: workspace.groupId },
        data: { name },
      })
    } else {
      await tx.project.update({
        where: { id: workspace.projects[0].id },
        data: { name },
      })
    }
    for (const project of workspace.projects) {
      if (project.requestId)
        await writeWorkspaceEvent(
          tx,
          project.requestId,
          project.id,
          userId,
          "WORKSPACE_RENAMED",
          `Renamed the project workspace to “${name}”.`,
        )
    }
  })
  return { saved: true }
}

export async function cancelProjectWorkspace(
  userId: string,
  workspaceId: string,
) {
  await getPrisma()!.$transaction(async (tx) => {
    const context = await getStaffContext(tx, userId)
    const current = await getMutableWorkspace(tx, context, workspaceId)
    requireWorkspaceManager(context, current.projects)
    await lockWorkspaceProjects(
      tx,
      workspaceId,
      current.groupId,
      current.projects,
    )
    const workspace = await getMutableWorkspace(tx, context, workspaceId)
    requireWorkspaceManager(context, workspace.projects)
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
    await lockWorkspaceProjects(
      tx,
      workspaceId,
      current.groupId,
      current.projects,
    )
    const workspace = await getMutableWorkspace(tx, context, workspaceId)
    requireWorkspaceManager(context, workspace.projects)

    let affected: MutableWorkspaceProject[]
    let status: ProjectStatus
    let eventType: string
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

const projectDeliverableSelect = {
  id: true,
  title: true,
  description: true,
  expectedFileType: true,
  deliveryStatus: true,
  rejectionReason: true,
  reviewedAt: true,
  sentToClientAt: true,
  workflowFileId: true,
  updatedAt: true,
  completedAt: true,
  workflowFile: {
    select: {
      id: true,
      name: true,
      mimeType: true,
      size: true,
      uploaderId: true,
      createdAt: true,
      clientVisible: true,
    },
  },
} satisfies Prisma.ProjectMilestoneSelect

async function getDeliverableAccess(
  tx: Prisma.TransactionClient,
  userId: string,
  workspaceId: string,
  projectId: string,
  deliverableId: string,
  headOnly = false,
) {
  const context = await getStaffContext(tx, userId)
  const project = await scopedProjectForEdit(
    tx,
    context,
    workspaceId,
    projectId,
  )
  const request = await tx.serviceRequest.findUnique({
    where: { id: project.requestId! },
    select: {
      acceptedDepartmentId: true,
      workflow: { select: { state: true } },
    },
  })
  const isHead = Boolean(
    request?.acceptedDepartmentId &&
    context.headDepartmentIds.includes(request.acceptedDepartmentId),
  )
  if (headOnly && !isHead)
    throw new ServiceRequestsError(
      403,
      "Only the department head can manage deliverables",
    )
  const isAssignedStaff = isHead
    ? true
    : Boolean(
        await tx.projectStaff.findFirst({
          where: {
            projectId: project.id,
            employee: {
              userId,
              status: "ACTIVE",
              user: activeStaff,
            },
          },
          select: { id: true },
        }),
      )
  if (!isHead && !isAssignedStaff)
    throw new ServiceRequestsError(
      403,
      "Only assigned project staff can manage deliverable attachments",
    )
  const milestone = await tx.projectMilestone.findFirst({
    where: { id: deliverableId, projectId: project.id },
    select: projectDeliverableSelect,
  })
  if (!milestone)
    throw new ServiceRequestsError(404, "Project deliverable not found")
  return { context, project, milestone, isHead, request }
}

function recordDeliverableEvent(
  tx: Prisma.TransactionClient,
  requestId: string,
  deliverableId: string,
  userId: string,
  type: string,
  summary: string,
  internal = true,
) {
  return tx.workflowEvent.create({
    data: {
      requestId,
      entityId: deliverableId,
      actorId: userId,
      type,
      summary,
      internal,
    },
  })
}

function deliverableInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ServiceRequestsError(400, "Enter deliverable details")
  return input as Record<string, unknown>
}

export async function updateProjectDeliverable(
  userId: string,
  workspaceId: string,
  projectId: string,
  deliverableId: string,
  input: unknown,
) {
  const body = deliverableInput(input)
  const update: Prisma.ProjectMilestoneUpdateInput = {}
  if (body.title !== undefined) {
    if (
      typeof body.title !== "string" ||
      !body.title.trim() ||
      body.title.trim().length > 300
    )
      throw new ServiceRequestsError(
        400,
        "Use a deliverable name up to 300 characters",
      )
    update.title = body.title.trim()
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string" || body.description.length > 4000)
      throw new ServiceRequestsError(
        400,
        "Keep the description under 4,000 characters",
      )
    update.description = body.description.trim() || null
  }
  if (body.expectedFileType !== undefined) {
    if (
      typeof body.expectedFileType !== "string" ||
      body.expectedFileType.length > 50
    )
      throw new ServiceRequestsError(400, "Choose a valid attachment type")
    update.expectedFileType = body.expectedFileType.trim() || null
  }
  if (!Object.keys(update).length)
    throw new ServiceRequestsError(400, "Change at least one deliverable field")

  await getPrisma()!.$transaction(async (tx) => {
    const { project, isHead } = await getDeliverableAccess(
      tx,
      userId,
      workspaceId,
      projectId,
      deliverableId,
      true,
    )
    if (!isHead)
      throw new ServiceRequestsError(
        403,
        "Only the department head can edit deliverables",
      )
    await lockRows(tx, "Project", project.id)
    await lockRows(tx, "ProjectMilestone", deliverableId)
    const current = await tx.projectMilestone.findUniqueOrThrow({
      where: { id: deliverableId },
      select: { deliveryStatus: true, title: true },
    })
    if (current.deliveryStatus === "SENT_TO_CLIENT")
      throw new ServiceRequestsError(409, "Sent deliverables cannot be edited")
    await tx.projectMilestone.update({
      where: { id: deliverableId },
      data: update,
    })
    await tx.project.update({
      where: { id: project.id },
      data: { updatedAt: new Date() },
    })
    await recordDeliverableEvent(
      tx,
      project.requestId!,
      deliverableId,
      userId,
      "PROJECT_DELIVERABLE_UPDATED",
      `Updated the details for deliverable “${body.title ?? current.title}”.`,
    )
  })
  return getProjectWorkspace(userId, workspaceId)
}

export async function uploadProjectDeliverable(
  userId: string,
  workspaceId: string,
  projectId: string,
  deliverableId: string,
  input: unknown,
) {
  const parsed = parseWorkflowUpload(input)
  const noteValue = deliverableInput(input).note
  if (
    noteValue !== undefined &&
    (typeof noteValue !== "string" ||
      noteValue.length > 2000 ||
      noteValue.includes("\u0000"))
  )
    throw new ServiceRequestsError(
      400,
      "Use a submission note up to 2,000 characters",
    )
  const note = typeof noteValue === "string" ? noteValue.trim() : ""
  await getPrisma()!.$transaction(async (tx) => {
    const initial = await getDeliverableAccess(
      tx,
      userId,
      workspaceId,
      projectId,
      deliverableId,
    )
    await lockRows(tx, "ServiceRequest", initial.project.requestId, "share")
    await lockRows(tx, "Project", projectId)
    const { project, milestone, isHead, request } = await getDeliverableAccess(
      tx,
      userId,
      workspaceId,
      projectId,
      deliverableId,
    )
    if (isHead)
      throw new ServiceRequestsError(
        403,
        "Department Heads review deliverables; assigned staff upload them",
      )
    if (!request?.workflow || project.status === "CANCELLED")
      throw new ServiceRequestsError(409, "Deliverable uploads are unavailable")
    const lockedProject = await tx.project.findUniqueOrThrow({
      where: { id: project.id },
      select: { status: true },
    })
    if (!["IN_PROGRESS", "ON_HOLD"].includes(lockedProject.status))
      throw new ServiceRequestsError(
        409,
        "Deliverable submissions are unavailable for this project",
      )
    const existing = await tx.projectMessage.findUnique({
      where: {
        projectId_senderId_clientMessageId: {
          projectId,
          senderId: userId,
          clientMessageId: parsed.uploadId,
        },
      },
      select: { body: true, deliverable: true },
    })
    if (existing) {
      const card = readDeliverableCard(existing.deliverable)
      const metadata = existing.deliverable
      if (
        !card ||
        card.id !== deliverableId ||
        card.fileName !== parsed.name ||
        existing.body !== (note || "Submitted for review.") ||
        !metadata ||
        typeof metadata !== "object" ||
        Array.isArray(metadata) ||
        metadata.sha256 !== parsed.sha256
      )
        throw new ServiceRequestsError(
          409,
          "This upload ID was already used for another submission",
        )
      return
    }
    await lockRows(tx, "ProjectMilestone", deliverableId)
    const current = await tx.projectMilestone.findUniqueOrThrow({
      where: { id: deliverableId },
      select: { deliveryStatus: true, workflowFileId: true, title: true },
    })
    if (!["NOT_SUBMITTED", "REJECTED"].includes(current.deliveryStatus))
      throw new ServiceRequestsError(
        409,
        "This deliverable is locked while it is being reviewed or after approval",
      )
    if (current.workflowFileId)
      await tx.workflowFile.delete({ where: { id: current.workflowFileId } })
    const file = await tx.workflowFile.create({
      data: {
        requestId: project.requestId!,
        uploaderId: userId,
        uploadId: parsed.uploadId,
        name: parsed.name,
        mimeType: parsed.mimeType,
        size: parsed.size,
        sha256: parsed.sha256,
        data: parsed.data,
        clientVisible: false,
      },
      select: { id: true },
    })
    await tx.projectMilestone.update({
      where: { id: deliverableId },
      data: {
        workflowFileId: file.id,
        deliveryStatus: "IN_REVIEW",
        rejectionReason: null,
        reviewedAt: null,
        reviewedById: null,
      },
    })
    await tx.project.update({
      where: { id: project.id },
      data: { updatedAt: new Date() },
    })
    await recordDeliverableEvent(
      tx,
      project.requestId!,
      deliverableId,
      userId,
      "PROJECT_DELIVERABLE_UPLOADED",
      `Submitted “${milestone.title}” for review.`,
    )
    await recordProjectDeliverableMessage(tx, {
      projectId,
      senderId: userId,
      deliverableId,
      title: current.title,
      fileId: file.id,
      fileName: parsed.name,
      kind: "submission",
      note,
      uploadId: parsed.uploadId,
      sha256: parsed.sha256,
    })
  })
  return getProjectWorkspace(userId, workspaceId)
}

export async function removeProjectDeliverableAttachment(
  userId: string,
  workspaceId: string,
  projectId: string,
  deliverableId: string,
) {
  await getPrisma()!.$transaction(async (tx) => {
    const { project, milestone, isHead } = await getDeliverableAccess(
      tx,
      userId,
      workspaceId,
      projectId,
      deliverableId,
    )
    if (isHead)
      throw new ServiceRequestsError(
        403,
        "Department Heads review deliverables; assigned staff manage uploads",
      )
    if (!milestone.workflowFileId)
      throw new ServiceRequestsError(409, "This deliverable has no attachment")
    await lockRows(tx, "Project", project.id)
    await lockRows(tx, "ProjectMilestone", deliverableId)
    const current = await tx.projectMilestone.findUniqueOrThrow({
      where: { id: deliverableId },
      select: { deliveryStatus: true, workflowFileId: true, title: true },
    })
    if (
      !["IN_REVIEW", "REJECTED", "NOT_SUBMITTED"].includes(
        current.deliveryStatus,
      )
    )
      throw new ServiceRequestsError(
        409,
        "Approved deliverables can no longer be removed",
      )
    if (!current.workflowFileId)
      throw new ServiceRequestsError(409, "This deliverable has no attachment")
    await tx.workflowFile.delete({ where: { id: current.workflowFileId } })
    await tx.projectMilestone.update({
      where: { id: deliverableId },
      data: {
        workflowFileId: null,
        deliveryStatus:
          current.deliveryStatus === "REJECTED" ? "REJECTED" : "NOT_SUBMITTED",
      },
    })
    await tx.project.update({
      where: { id: project.id },
      data: { updatedAt: new Date() },
    })
    await recordDeliverableEvent(
      tx,
      project.requestId!,
      deliverableId,
      userId,
      "PROJECT_DELIVERABLE_REMOVED",
      `Removed the attachment for “${current.title}”.`,
    )
  })
  return getProjectWorkspace(userId, workspaceId)
}

export async function reviewProjectDeliverable(
  userId: string,
  workspaceId: string,
  projectId: string,
  deliverableId: string,
  decision: "approve" | "reject",
  input?: unknown,
) {
  const reasonValue = input ? deliverableInput(input).reason : undefined
  const reason =
    decision === "reject" && typeof reasonValue === "string"
      ? reasonValue.trim()
      : ""
  if (decision === "reject" && (reason.length < 3 || reason.length > 2000))
    throw new ServiceRequestsError(
      400,
      "Enter a rejection reason between 3 and 2,000 characters",
    )

  await getPrisma()!.$transaction(async (tx) => {
    const { project, request } = await getDeliverableAccess(
      tx,
      userId,
      workspaceId,
      projectId,
      deliverableId,
      true,
    )
    await lockRows(tx, "Project", project.id)
    await lockRows(tx, "ProjectMilestone", deliverableId)
    const current = await tx.projectMilestone.findUniqueOrThrow({
      where: { id: deliverableId },
      select: { title: true, deliveryStatus: true, workflowFileId: true },
    })
    if (current.deliveryStatus !== "IN_REVIEW" || !current.workflowFileId)
      throw new ServiceRequestsError(
        409,
        "Only submitted deliverables can be reviewed",
      )
    const approved = decision === "approve"
    await tx.projectMilestone.update({
      where: { id: deliverableId },
      data: {
        deliveryStatus: approved ? "APPROVED" : "REJECTED",
        rejectionReason: approved ? null : reason,
        reviewedById: userId,
        reviewedAt: new Date(),
      },
    })
    await tx.project.update({
      where: { id: project.id },
      data: { updatedAt: new Date() },
    })
    await recordDeliverableEvent(
      tx,
      project.requestId!,
      deliverableId,
      userId,
      approved
        ? "PROJECT_DELIVERABLE_APPROVED"
        : "PROJECT_DELIVERABLE_REJECTED",
      approved
        ? `Approved “${current.title}”.`
        : `Rejected “${current.title}”: ${reason}`,
    )
    if (!request?.workflow)
      throw new ServiceRequestsError(409, "This project has no client workflow")
  })
  return getProjectWorkspace(userId, workspaceId)
}

export async function sendProjectDeliverableToClient(
  userId: string,
  workspaceId: string,
  projectId: string,
  deliverableId: string,
) {
  await getPrisma()!.$transaction(async (tx) => {
    const { project, request } = await getDeliverableAccess(
      tx,
      userId,
      workspaceId,
      projectId,
      deliverableId,
      true,
    )
    if (!request?.workflow)
      throw new ServiceRequestsError(409, "This project has no client workflow")
    await lockRows(tx, "Project", project.id)
    const lockedStatus = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { status: true },
    })
    if (["COMPLETED", "CANCELLED"].includes(lockedStatus.status))
      throw new ServiceRequestsError(
        409,
        "Archived projects cannot share new deliverables",
      )
    await lockRows(tx, "ProjectMilestone", deliverableId)
    const current = await tx.projectMilestone.findUniqueOrThrow({
      where: { id: deliverableId },
      select: { title: true, deliveryStatus: true, workflowFileId: true },
    })
    if (current.deliveryStatus !== "APPROVED" || !current.workflowFileId)
      throw new ServiceRequestsError(
        409,
        "Approve the deliverable before sending it to the client",
      )
    await tx.workflowFile.update({
      where: { id: current.workflowFileId },
      data: { clientVisible: true },
    })
    const sharedFile = await tx.workflowFile.findUniqueOrThrow({
      where: { id: current.workflowFileId },
      select: { name: true },
    })
    await recordProjectDeliverableMessage(tx, {
      projectId,
      senderId: userId,
      deliverableId,
      title: current.title,
      fileId: current.workflowFileId,
      fileName: sharedFile.name,
      kind: "delivery",
    })
    await tx.projectMilestone.update({
      where: { id: deliverableId },
      data: {
        deliveryStatus: "SENT_TO_CLIENT",
        sentToClientById: userId,
        sentToClientAt: new Date(),
      },
    })
    await tx.project.update({
      where: { id: project.id },
      data: { updatedAt: new Date() },
    })
    await recordDeliverableEvent(
      tx,
      project.requestId!,
      current.workflowFileId,
      userId,
      "PROJECT_DELIVERABLE_SENT_TO_CLIENT",
      `A project deliverable was shared with you: “${current.title}”.`,
      false,
    )
    await tx.requestWorkflow.update({
      where: { requestId: project.requestId! },
      data: { version: { increment: 1 } },
    })
    await tx.serviceRequest.update({
      where: { id: project.requestId! },
      data: { updatedAt: new Date() },
    })
  })
  return getProjectWorkspace(userId, workspaceId)
}

export async function downloadProjectDeliverable(
  userId: string,
  workspaceId: string,
  projectId: string,
  deliverableId: string,
) {
  return getPrisma()!.$transaction(async (tx) => {
    const { milestone } = await getDeliverableAccess(
      tx,
      userId,
      workspaceId,
      projectId,
      deliverableId,
    )
    if (!milestone.workflowFileId)
      throw new ServiceRequestsError(404, "No attachment is available")
    const file = await tx.workflowFile.findUnique({
      where: { id: milestone.workflowFileId },
      select: { name: true, mimeType: true, size: true, data: true },
    })
    if (!file) throw new ServiceRequestsError(404, "No attachment is available")
    return file
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
    await lockRows(tx, "Project", scoped.id)
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
    await lockRows(tx, "Project", scoped.id)
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

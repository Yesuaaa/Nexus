import type { Prisma, ProjectStatus } from "../../generated/prisma/client.js"
import { readWorkPlan } from "./templates.js"
import {
  type StaffContext,
  terminalProjectStatuses,
} from "./workspace-access.js"
import { activityTypes } from "./workspace-activity.js"

export const projectInclude = {
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
  context: StaffContext,
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
    isTeamLead: project.staff.some(
      ({ employee, isTeamLead }) =>
        isTeamLead &&
        employee.status === "ACTIVE" &&
        employee.userId === context.id,
    ),
    hasTeamLead: project.staff.some(
      ({ employee, isTeamLead }) => isTeamLead && employee.status === "ACTIVE",
    ),
    isDepartmentHead: Boolean(
      project.request?.acceptedDepartmentId &&
      context.headDepartmentIds.includes(project.request.acceptedDepartmentId),
    ),
    canReviewDeliverables:
      project.staff.some(
        ({ employee, isTeamLead }) =>
          isTeamLead &&
          employee.status === "ACTIVE" &&
          employee.userId === context.id,
      ) ||
      Boolean(
        project.request?.acceptedDepartmentId &&
        context.headDepartmentIds.includes(
          project.request.acceptedDepartmentId,
        ),
      ),
    staff: project.staff.map(({ employee, approvedAt, isTeamLead }) => {
      const { userId: _userId, ...safeEmployee } = employee
      void _userId
      return { ...safeEmployee, approvedAt, isTeamLead }
    }),
    canUploadDeliverables: project.staff.some(
      ({ employee }) =>
        employee.userId === context.id && employee.status === "ACTIVE",
    ),
  }
}

export async function activityCounts(
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

export function workspaceRows(
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
      rowId: group ? `group:${group.id}` : `ungrouped-project:${first.id}`,
      kind: group ? ("group" as const) : ("ungrouped-project" as const),
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
          ({ status }) => !terminalProjectStatuses.includes(status),
        ),
      workstreams: groupProjects.map((project) => ({
        ...projectWorkstream(project, includePlan, context),
        canAssign: Boolean(
          project.request?.acceptedDepartmentId &&
          context.headDepartmentIds.includes(
            project.request.acceptedDepartmentId,
          ),
        ),
        canReviewRequests: Boolean(
          project.request?.acceptedDepartmentId &&
          context.headDepartmentIds.includes(
            project.request.acceptedDepartmentId,
          ),
        ),
      })),
    }
  })
}

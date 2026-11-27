import type { Prisma, ProjectStatus } from "../../generated/prisma/client.js"
import { activeStaff } from "../../shared/query/accounts.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import { lockRows, lockServiceRequest } from "../../shared/db/locks.js"
import { parseWorkspaceIdentity } from "./workspace-identity.js"

export const terminalProjectStatuses: ProjectStatus[] = [
  "COMPLETED",
  "CANCELLED",
]

export type StaffContext = {
  id: string
  departmentIds: string[]
  headDepartmentIds: string[]
  canCreate: boolean
}

export async function getStaffContext(
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

export function scopedProjectWhere(
  context: StaffContext,
): Prisma.ProjectWhereInput {
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

export function workspaceReadWhere(
  context: StaffContext,
): Prisma.ProjectWhereInput {
  if (!context.canCreate) return scopedProjectWhere(context)
  return {
    request: { acceptedDepartmentId: { in: context.headDepartmentIds } },
  }
}

export async function mixedWorkspaceGroupIds(
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

export type MutableWorkspaceProject = {
  id: string
  name: string
  status: ProjectStatus
  requestId: string | null
  request: { acceptedDepartmentId: string | null } | null
}

export async function getMutableWorkspace(
  tx: Prisma.TransactionClient,
  context: StaffContext,
  workspaceId: string,
  scope?: Prisma.ProjectWhereInput,
) {
  const { id, kind } = parseWorkspaceIdentity(workspaceId)
  scope ??= kind ? workspaceReadWhere(context) : scopedProjectWhere(context)
  const group =
    kind === "ungrouped-project"
      ? null
      : await tx.projectWorkspaceGroup.findFirst({
          where: { id, projects: { some: scope } },
          select: {
            id: true,
            projects: {
              where: scope,
              select: {
                id: true,
                name: true,
                status: true,
                requestId: true,
                request: { select: { acceptedDepartmentId: true } },
              },
            },
          },
        })
  if (group?.projects.length)
    return { groupId: group.id, projects: group.projects }

  const project =
    kind === "group"
      ? null
      : await tx.project.findFirst({
          where: {
            id,
            ...scope,
            ...(kind === "ungrouped-project" ? { workspaceGroupId: null } : {}),
          },
          select: {
            id: true,
            name: true,
            status: true,
            requestId: true,
            request: { select: { acceptedDepartmentId: true } },
          },
        })
  if (!project)
    throw new ServiceRequestsError(404, "Project workspace not found")
  return { groupId: null, projects: [project] }
}

export function requireWorkspaceManager(
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

export async function lockAndRevalidateManagedWorkspace(
  tx: Prisma.TransactionClient,
  userId: string,
  workspaceId: string,
  initial: Awaited<ReturnType<typeof getMutableWorkspace>>,
) {
  const { groupId } = initial
  if (groupId) await lockRows(tx, "ProjectWorkspaceGroup", groupId)
  const membership = groupId
    ? { workspaceGroupId: groupId }
    : { id: initial.projects[0]?.id ?? "no-project-access" }
  const members = await tx.project.findMany({
    where: membership,
    select: { id: true, requestId: true, workspaceGroupId: true },
    orderBy: { id: "asc" },
  })
  const requestIds = members.flatMap(({ requestId }) =>
    requestId ? [requestId] : [],
  )
  await lockRows(tx, "ServiceRequest", requestIds)
  const requests = requestIds.length
    ? await tx.serviceRequest.findMany({
        where: { id: { in: requestIds } },
        select: { acceptedDepartmentId: true },
      })
    : []
  await lockRows(
    tx,
    "Department",
    requests.map(({ acceptedDepartmentId }) => acceptedDepartmentId),
    "share",
  )
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
        member.id !== members[index]?.id ||
        member.requestId !== members[index]?.requestId ||
        member.workspaceGroupId !== groupId,
    )
  )
    throw new ServiceRequestsError(
      409,
      "Workspace membership changed. Refresh and try again.",
    )

  const context = await getStaffContext(tx, userId)
  const workspace = await getMutableWorkspace(
    tx,
    context,
    workspaceId,
    workspaceReadWhere(context),
  )
  requireWorkspaceManager(context, workspace.projects)
  return { context, workspace }
}

export async function scopedProjectForEdit(
  tx: Prisma.TransactionClient,
  context: StaffContext,
  workspaceId: string,
  projectId: string,
) {
  const { id, kind } = parseWorkspaceIdentity(workspaceId)
  const projectScope = context.canCreate
    ? workspaceReadWhere(context)
    : scopedProjectWhere(context)
  const project = await tx.project.findFirst({
    where: {
      id: projectId,
      ...projectScope,
      OR: [
        ...(kind === "ungrouped-project" ? [] : [{ workspaceGroupId: id }]),
        ...(kind === "group" ? [] : [{ id, workspaceGroupId: null }]),
      ],
    },
  })
  if (!project || !project.requestId)
    throw new ServiceRequestsError(404, "Project workstream not found")
  return project
}

export async function lockAndRevalidateProjectForEdit(
  tx: Prisma.TransactionClient,
  userId: string,
  initialContext: StaffContext,
  workspaceId: string,
  projectId: string,
) {
  const initialProject = await scopedProjectForEdit(
    tx,
    initialContext,
    workspaceId,
    projectId,
  )
  const acceptedDepartmentId = await lockServiceRequest(
    tx,
    initialProject.requestId,
  )
  await lockRows(tx, "User", userId, "share")
  await lockRows(tx, "Project", initialProject.id)
  const context = await getStaffContext(tx, userId)
  const project = await scopedProjectForEdit(
    tx,
    context,
    workspaceId,
    projectId,
  )
  if (
    project.id !== initialProject.id ||
    project.requestId !== initialProject.requestId
  )
    throw new ServiceRequestsError(
      409,
      "Project ownership changed. Reload before editing again.",
    )
  if (terminalProjectStatuses.includes(project.status))
    throw new ServiceRequestsError(409, "Archived projects cannot be edited")
  return { context, project, acceptedDepartmentId }
}

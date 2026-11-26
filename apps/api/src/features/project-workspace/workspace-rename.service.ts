import { auditLabel } from "../project-management-logs/events.js"
import { writeProjectLog } from "../project-management-logs/writer.js"
import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { activeAccount } from "../../shared/query/accounts.js"
import {
  AdministrativeCapability,
  hasAdministrativeCapability,
} from "../auth/auth.capabilities.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import { lockRows } from "../../shared/db/locks.js"
import { parseWorkspaceIdentity } from "./workspace-identity.js"
import {
  getMutableWorkspace,
  getStaffContext,
  mixedWorkspaceGroupIds,
  requireWorkspaceManager,
  terminalProjectStatuses,
  workspaceReadWhere,
} from "./workspace-access.js"
import { writeWorkspaceEvent } from "./workspace-activity.js"

export async function renameProjectWorkspace(
  userId: string,
  workspaceId: string,
  input: unknown,
) {
  if (parseWorkspaceIdentity(workspaceId).kind === "ungrouped-project")
    throw new ServiceRequestsError(403, "Set up a workspace before renaming it")
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
        terminalProjectStatuses.includes(status),
      )
    )
      throw new ServiceRequestsError(409, "Archived projects cannot be renamed")

    const previousName = await workspaceName(
      tx,
      workspace.groupId,
      workspace.projects[0].id,
    )
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
      await recordWorkspaceRename(tx, userId, project.id, previousName, name)
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

async function getAdministrativelyManagedWorkspace(
  tx: Prisma.TransactionClient,
  identity: string,
) {
  const { id, kind } = parseWorkspaceIdentity(identity)
  if (kind === "group") {
    const group = await tx.projectWorkspaceGroup.findUnique({
      where: { id },
      select: {
        id: true,
        projects: {
          orderBy: { id: "asc" },
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
  } else if (kind === "ungrouped-project") {
    const project = await tx.project.findFirst({
      where: { id, workspaceGroupId: null },
      select: {
        id: true,
        status: true,
        requestId: true,
        request: { select: { acceptedDepartmentId: true } },
      },
    })
    if (project) return { groupId: null, projects: [project] }
  }
  throw new ServiceRequestsError(404, "Project workspace not found")
}

async function workspaceName(
  tx: Prisma.TransactionClient,
  groupId: string | null,
  projectId: string,
) {
  const query = { select: { name: true } } as const
  const record = groupId
    ? await tx.projectWorkspaceGroup.findUniqueOrThrow({
        ...query,
        where: { id: groupId },
      })
    : await tx.project.findUniqueOrThrow({ ...query, where: { id: projectId } })
  return record.name
}

async function recordWorkspaceRename(
  tx: Prisma.TransactionClient,
  userId: string,
  projectId: string,
  before: string,
  after: string,
) {
  if (before !== after)
    await writeProjectLog(tx, userId, projectId, "WORKSPACE_RENAMED", {
      Name: [auditLabel(before), auditLabel(after)],
    })
}

export async function renameProjectWorkspaceAdministratively(
  userId: string,
  projectId: string,
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
    const actor = await tx.user.findFirst({
      where: { id: userId, ...activeAccount },
      select: {
        id: true,
        role: true,
        isActive: true,
        accountDeletedAt: true,
      },
    })
    if (
      !actor ||
      !hasAdministrativeCapability(
        actor,
        AdministrativeCapability.MODULE_ACCESS,
      ) ||
      !hasAdministrativeCapability(
        actor,
        AdministrativeCapability.ORGANIZATION_READ,
      ) ||
      !hasAdministrativeCapability(actor, AdministrativeCapability.MANAGEMENT)
    )
      throw new ServiceRequestsError(
        403,
        "Administrative project management is required",
      )

    const target = await tx.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceGroupId: true },
    })
    if (!target) throw new ServiceRequestsError(404, "Project not found")
    const identity = target.workspaceGroupId
      ? `group:${target.workspaceGroupId}`
      : `ungrouped-project:${target.id}`
    const initial = await getAdministrativelyManagedWorkspace(tx, identity)
    if (initial.groupId)
      await lockRows(tx, "ProjectWorkspaceGroup", initial.groupId)

    const membership = initial.groupId
      ? { workspaceGroupId: initial.groupId }
      : { id: target.id }
    const members = await tx.project.findMany({
      where: membership,
      select: { id: true, requestId: true, workspaceGroupId: true },
      orderBy: { id: "asc" },
    })
    await lockRows(
      tx,
      "ServiceRequest",
      members.map(({ requestId }) => requestId),
      "share",
    )
    const requests = await tx.serviceRequest.findMany({
      where: {
        id: {
          in: members.flatMap(({ requestId }) =>
            requestId ? [requestId] : [],
          ),
        },
      },
      select: { acceptedDepartmentId: true },
    })
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

    const lockedActor = await tx.user.findFirst({
      where: { id: userId, ...activeAccount },
      select: {
        id: true,
        role: true,
        isActive: true,
        accountDeletedAt: true,
      },
    })
    if (
      !lockedActor ||
      !hasAdministrativeCapability(
        lockedActor,
        AdministrativeCapability.MODULE_ACCESS,
      ) ||
      !hasAdministrativeCapability(
        lockedActor,
        AdministrativeCapability.ORGANIZATION_READ,
      ) ||
      !hasAdministrativeCapability(
        lockedActor,
        AdministrativeCapability.MANAGEMENT,
      )
    )
      throw new ServiceRequestsError(
        403,
        "Administrative project management is required",
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
          member.workspaceGroupId !== initial.groupId,
      ) ||
      !lockedMembers.some(({ id }) => id === target.id)
    )
      throw new ServiceRequestsError(
        409,
        "Workspace membership changed. Refresh and try again.",
      )

    const workspace = await getAdministrativelyManagedWorkspace(tx, identity)
    if (
      workspace.groupId !== initial.groupId ||
      workspace.projects.length !== initial.projects.length ||
      workspace.projects.some(
        (project, index) => project.id !== initial.projects[index]?.id,
      )
    )
      throw new ServiceRequestsError(
        409,
        "Workspace membership changed. Refresh and try again.",
      )
    if (
      workspace.projects.every(({ status }) =>
        terminalProjectStatuses.includes(status),
      )
    )
      throw new ServiceRequestsError(409, "Archived projects cannot be renamed")
    if (workspace.projects.some(({ requestId }) => !requestId))
      throw new ServiceRequestsError(
        409,
        "Workspace renaming requires request history for actor attribution",
      )

    const requestIds = workspace.projects.flatMap(({ requestId }) =>
      requestId ? [requestId] : [],
    )
    const histories = await tx.requestWorkflow.count({
      where: { requestId: { in: requestIds } },
    })
    if (histories !== workspace.projects.length)
      throw new ServiceRequestsError(
        409,
        "Workspace renaming requires existing workflow history for actor attribution",
      )

    const previousName = await workspaceName(
      tx,
      workspace.groupId,
      workspace.projects[0]!.id,
    )
    if (workspace.groupId) {
      await tx.projectWorkspaceGroup.update({
        where: { id: workspace.groupId },
        data: { name },
      })
    } else {
      await tx.project.update({
        where: { id: workspace.projects[0]!.id },
        data: { name },
      })
    }
    for (const project of workspace.projects) {
      await recordWorkspaceRename(tx, userId, project.id, previousName, name)
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
